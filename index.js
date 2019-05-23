"use strict";

const _ = require("lodash");

let flagCache = {};

function decodeFlags(flags) {
  const f = flags.split(/\s+/).filter(x => x.length);
  const out = {};
  for (const flag of f) out[flag] = true;
  return out;
}

function flagsToObject(flags) {
  return flagCache[flags] = flagCache[flags] || decodeFlags(flags);
}

class ESIterator {
  constructor(opt, buf) {
    this.opt = opt;
    this.buf = buf;
  }

  [ Symbol.iterator]() {

    const opt = this.opt;
    let buf = this.buf;
    const len = buf.length;
    let pos = 0;

    function nextUTF8(peek) {
      let cp;
      let length;

      if ((peek & 0xfe) === 0xfc) {
        [cp, length] = [peek & 0x01, 6];
      } else if ((peek & 0xfc) === 0xf8) {
        [cp, length] = [peek & 0x03, 5];
      } else if ((peek & 0xf8) === 0xf0) {
        [cp, length] = [peek & 0x07, 4];
      } else if ((peek & 0xf0) === 0xe0) {
        [cp, length] = [peek & 0x0f, 3];
      } else if ((peek & 0xe0) === 0xc0) {
        [cp, length] = [peek & 0x1f, 2];
      } else {
        assert.fail("Unhandled utf8 header: 0x" + peek.toString(16));
        return false;
      }

      // End of buffer?
      if (pos + length > len)
        return false;

      for (let i = 1; i < length; i++) {
        const cc = buf[pos + i];
        if ((cc & 0xc0) !== 0x80)
          return false;
        cp = (cp << 6) | (cc & 0x3f);
      }

      let flags = "";
      if (opt.checkUTF8) {
        let f = [];
        if (opt.checkUTF8Illegal && cp >= 0xd800 && cp < 0xe000)
          f.push("illegal");
        if (opt.checkUTF8Specials && cp >= 0xfff0 && cp < 0x10000)
          f.push("special");
        if (opt.checkUTF8Bom && cp === 0xfeff)
          f.push("bom");
        if (opt.checkUTF8Replacement && cp === 0xfffd)
          f.push("replacement");
        if (opt.checkUTF8MaxCodePoint !== false && cp >= opt.checkUTF8MaxCodePoint)
          f.push("above-max");
        if (opt.checkUTF8NonCanonicalEncoding && cp < Math.max(0x80, 1 << (length * 5 - 4)))
          f.push("non-canonical");
        flags = f.join(" ");
      }

      const rv = {
        length,
        cp: [cp],
        enc: "utf8",
        flags
      };

      pos += length;
      return rv;

    }

    function next() {
      if (pos === len)
        return false;

      let peek = buf[pos];

      if ((peek & 0x80) === 0) {
        let cp = [peek];
        const start = pos;
        pos++;

        while (pos < len - 1) {
          peek = buf[pos];
          if (peek & 0x80) break;
          cp.push(peek);
          pos++;
        }

        return {
          length: pos - start,
          cp,
          enc: "7bit",
          flags: ""
        };
      }

      if ((peek & 0xc0) === 0xc0 && (peek & 0xfe) !== 0xfe) {
        const utf = nextUTF8(peek);
        if (utf !== false) return utf;
      }

      pos++;
      return {
        length: 1,
        cp: [peek],
        flags: "",
        enc: "unknown"
      };
    }

    function addBuffer(span) {
      if (span) {
        span.buf = buf.subarray(span.pos, span.pos + span.length);
        span.oflags = flagsToObject(span.flags);
        return {
          done: false,
          value: span
        };
      }

      return {
        done: true
      };
    }

    let lastEnc = null;
    let lastFlags = null;
    let span = null;
    let eof = false;

    function nextSpan() {
      if (eof) return addBuffer(null);

      while (true) {
        const lastPos = pos; // before fetch
        const tok = next();
        if (tok === false) break;

        if (lastEnc === tok.enc && lastFlags === tok.flags) {
          span.length += tok.length;
          Array.prototype.push.apply(span.cp, tok.cp);
          continue;
        }

        const oldSpan = span;

        // new span
        lastEnc = tok.enc;
        lastFlags = tok.flags;

        span = tok;
        span.pos = lastPos;

        if (oldSpan)
          return addBuffer(oldSpan);
      }

      eof = true;
      return addBuffer(span);
    }

    return {
      next: nextSpan
    };
  }
}

class EncodingSleuth {
  constructor(opt) {
    this.opt = Object.assign({}, {
      checkUTF8Illegal: true,
      checkUTF8Replacement: true,
      checkUTF8Specials: true,
      checkUTF8Bom: true,
      checkUTF8MaxCodePoint: true,
      checkUTF8NonCanonicalEncoding: true,
      checkUTF8: true,
    }, opt || {});

    if (!(this.opt.checkUTF8Illegal
      || this.opt.checkUTF8Replacement
      || this.opt.checkUTF8Specials
      || this.opt.checkUTF8Bom
      || this.opt.checkUTF8MaxCodePoint
      || this.opt.checkUTF8NonCanonicalEncoding))
      this.opt.checkUTF8 = false;

    if (this.opt.checkUTF8MaxCodePoint === true)
      this.opt.checkUTF8MaxCodePoint = 0x110000;
  }

  analyse(buf) {
    if (!(buf instanceof Uint8Array))
      throw new Error("analyse needs a Uint8Array (or a Buffer)");
    return new ESIterator(this.opt, buf);
  }
}

module.exports = EncodingSleuth;

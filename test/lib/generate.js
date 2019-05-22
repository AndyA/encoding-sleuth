"use strict";

const encodeUTF8 = require("./encode-utf8");
const Random = require("./random");
const RunRandom = require("./runrandom");
const _ = require("lodash");

class Generate {

  static parseFlags(flags) {
    return flags.split(/\s+/).filter(x => x.length);
  }

  static addFlags(flags, extra) {
    if (!_.isArray(extra))
      return this.addFlags(flags, [extra]);
    let list = this.parseFlags(flags);
    let seen = new Set(list);
    for (const f of extra) {
      if (seen.has(f)) continue;
      list.push(f);
      seen.add(f);
    }
    return list.join(" ");
  }

  static random7bit() {
    const r = new Random();
    return RunRandom.one(() => {
      const cp = r.randomBetween(0, 0x80);
      return {
        length: 1,
        flags: "",
        enc: "7bit",
        cp: [cp],
        buf: Uint8Array.from([cp])
      }
    });
  }

  static randomCorruptUTF8() {
    const r = new Random();

    const rr = this.randomUTF8();

    return RunRandom.one(() => {
      let span = rr.runOne();
      const bytes = Array.from(span.buf);
      bytes[0] = bytes[0] ^ 0x40;

      return {
        length: bytes.length,
        flags: "",
        enc: "unknown",
        cp: bytes,
        buf: Uint8Array.from(bytes)
      };
    });
  }

  static randomBad() {
    function makeSpan(cp) {
      return {
        length: 1,
        flags: "",
        enc: "unknown",
        cp: [cp],
        buf: Uint8Array.from([cp]),
      };
    }

    const r = new Random();
    return new RunRandom([
      {
        weight: 10,
        f: () => makeSpan(r.randomBetween(0x80, 0xc0))
      },
      {
        weight: 1,
        f: () => makeSpan(r.randomBetween(0xfe, 0x100))
      },
    ]);
  }

  static randomUTF8() {
    function makeSpan(cp, flags, buf) {
      buf = buf || encodeUTF8(cp);
      return {
        length: buf.length,
        flags: flags || "",
        enc: "utf8",
        cp: [cp],
        buf,
      };
    }

    function legalCP(max) {
      while (true) {
        const cp = r.randomBetween(0x80, max);
        if (cp >= 0xd800 && cp < 0xe000) continue;
        if (cp >= 0xfff0 && cp < 0x10000) continue;
        return cp;
      }
    }

    const r = new Random({
      pow: 3
    });

    const rr = new RunRandom([
      {
        weight: 10,
        f: () => {
          return makeSpan(legalCP(0x110000));
        }
      }, {
        weight: 1,
        f: () => {
          return makeSpan(r.randomBetween(0x110000, 0x80000000), "above-max");
        }
      }, {
        weight: 1,
        f: () => {
          return makeSpan(r.randomBetween(0xd800, 0xe000), "illegal");
        }
      }, {
        weight: 1,
        f: () => {
          return makeSpan(0xfffd, "special replacement");
        }
      }]);

    // Sometimes non-canonicalise a char.
    const rrnc = new RunRandom([
      {
        weight: 10,
        f: () => rr.runOne()
      }, {
        weight: 1,
        f: () => {
          let span = rr.runOne();
          const optLen = span.length;
          if (optLen === 6) return span;
          const newLen = r.randomBetween(optLen + 1, 7);
          const buf = encodeUTF8(span.cp, newLen);
          span.length = buf.length;
          span.buf = buf;
          span.flags = this.addFlags(span.flags, "non-canonical");
          return span
        }
      }
    ]);

    return rrnc;
  }

  static randomAnything() {
    const rr7bit = this.random7bit();
    const rrUTF8 = this.randomUTF8();
    const rrBad = this.randomBad();
    const rrCorruptUTF8 = this.randomCorruptUTF8();

    return new RunRandom([
      {
        weight: 10,
        f: () => rr7bit.runOne()
      },
      {
        weight: 10,
        f: () => rrUTF8.runOne()
      },
      {
        weight: 10,
        f: () => rrBad.runOne()
      },
      {
        weight: 10,
        f: () => rrCorruptUTF8.runOne()
      },
    ]);
  }

  static randToSpans(rr, len) {
    let spans = [];
    for (let i = 0; i < len; i++) {
      spans.push(rr.runOne());
    }
    return spans;
  }

}

module.exports = Generate;

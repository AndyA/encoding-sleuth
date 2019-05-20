"use strict";

class EncodingSleuth {
  constructor(opt) {
    this.opt = Object.assign({}, {
      maxUnknown: false,
      maxChunk: false,
      allowNonCanonical: false,
      allowIllegalCodePoints: false,
      allowReplacement: false,
      allowSpecials: false,
      maxCodePoint: true,
    }, opt || {});

    if (this.opt.maxCodePoint === true)
      this.opt.maxCodePoint = 0x110000;
  }

  _makePushChunk(buf, chunks) {
    let startPos = 0;
    let lastPos = 0;
    let lastTag = null;

    return function(pos, tag) {
      if (tag !== lastTag && startPos !== lastPos) {
        // push pending chunk
        chunks.push({
          tag: lastTag,
          buf: buf.slice(startPos, lastPos)
        });
        startPos = lastPos;
      }

      lastPos = pos;
      lastTag = tag;
    }
  }

  examine(buf) {
    if (!Buffer.isBuffer(buf))
      throw new Error("examine needs a Buffer");

    const opt = this.opt;
    const len = buf.length;

    let pos = 0;
    let unknowns = 0;
    let chunks = [];

    const pushChunk = this._makePushChunk(buf, chunks);

    function utf8cp() {
      let cp;
      let length;

      const c = buf[pos];

      if ((c & 0xfe) === 0xfc) {
        [cp, length] = [c & 0x01, 6];
      } else if ((c & 0xfc) === 0xf8) {
        [cp, length] = [c & 0x03, 5];
      } else if ((c & 0xf8) === 0xf0) {
        [cp, length] = [c & 0x07, 4];
      } else if ((c & 0xf0) === 0xe0) {
        [cp, length] = [c & 0x0f, 3];
      } else if ((c & 0xe0) === 0xc0) {
        [cp, length] = [c & 0x1f, 2];
      } else {
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

      // Replacement char?
      if (!opt.allowReplacement && cp === 0xfffd)
        return false;

      // Special character?
      if (!opt.allowSpecials && cp >= 0xfff0 && cp < 0x10000)
        return false;

      // Illegal code points?
      if (!opt.allowIllegalCodePoints && cp >= 0xd800 && cp < 0xe000)
        return false;

      // Max code point?
      if (opt.maxCodePoint !== false && cp >= opt.maxCodePoint)
        return false;

      // Non-canonical encoding?
      if (!opt.allowNonCanonical && cp < Math.max(0x80, 1 << (length * 5 - 4)))
        return false;

      pos += length;
      return cp;
    }

    function finish() {
      pushChunk(pos = buf.length, "unclassified");
    }

    while (pos < len) {
      if (opt.maxChunk !== false && chunks.len >= opt.maxChunk) {
        finish();
        break;
      }

      if ((buf[pos] & 0x80) === 0) {
        pos++;
        while (pos < len && (buf[pos] & 0x80) === 0) pos++;
        pushChunk(pos, "7bit");
        continue;
      }

      if (false !== utf8cp()) {
        while (pos < len) {
          if (false === utf8cp()) break;
        }
        pushChunk(pos, "utf8");
        continue;
      }

      pos++;
      pushChunk(pos, "unknown");
      unknowns++;

      if (opt.maxUnknown !== false && unknowns >= opt.maxUnknown) {
        finish();
        break;
      }
    }

    pushChunk(pos, "EOF"); // flush

    return chunks;
  }
}

module.exports = EncodingSleuth;

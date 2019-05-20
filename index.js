"use strict";

class EncodingSleuth {
  constructor(opt) {
    this.opt = Object.assign({}, opt || {}, {
      maxUnknown: false,
      maxChunk: false,
      allowInefficientEncoding: false,
      allowIllegalCodepoints: false,
      maxCodePoint: 0x110000
    });
  }

  _makePushChunk(buf, chunks) {
    let startPos = 0;
    let lastPos = 0;
    let lastTag = null;

    return function(pos, tag) {
      if (0) {
        console.log("pushChunk(" + tag + ") pos=" + pos +
          " lastPos=" + lastPos +
          " startPos=" + startPos +
          " lastTag=" + lastTag);
      }

      if (tag !== lastTag && startPos !== lastPos) {
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

    //    console.log(buf);

    const opt = this.opt;
    const len = buf.length;

    let pos = 0;
    let unknowns = 0;
    let chunks = [];

    const pushChunk = this._makePushChunk(buf, chunks);

    function getUTF8CP() {
      let cp = 0;
      let extra;

      const c = buf[pos];

      if ((c & 0xfe) === 0xfc) {
        cp = c & 0x01;
        extra = 5;
      } else if ((c & 0xfc) === 0xf8) {
        cp = c & 0x03;
        extra = 4;
        extra = 4;
      } else if ((c & 0xf8) === 0xf0) {
        cp = c & 0x07;
        extra = 3;
      } else if ((c & 0xf0) === 0xe0) {
        cp = c & 0x0f;
        extra = 2;
      } else if ((c & 0xe0) === 0xc0) {
        cp = c & 0x1f;
        extra = 1;
      } else {
        return false;
      }

      // End of buffer?
      if (pos + 1 + extra > len)
        return false;

      for (let i = 1; i <= extra; i++) {
        const cc = buf[pos + i];
        if ((cc & 0xc0) !== 0x80)
          return false;
        cp = (cp << 6) | (cc & 0x3f);
      }

      if (!opt.allowIllegalCodepoints) {
        // Illegal code points
        if (cp >= 0xd800 && cp < 0xe000)
          return false;

        // Max code point
        if (cp >= opt.maxCodePoint)
          return false;
      }

      if (!opt.allowInefficientEncoding) {
        // Inefficient encoding?
        const min = Math.max(0x80, 1 << (extra * 5 + 1));
        if (cp < min)
          return false;
      }

      pos += 1 + extra;
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

      const cp = getUTF8CP();
      if (false !== getUTF8CP()) {
        while (pos < len) {
          if (false === getUTF8CP()) break;
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

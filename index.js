"use strict";

function encodingSleuth(buf, strict = 0) {
  if (!Buffer.isBuffer(buf))
    throw new Error("encodingSleuth needs a Buffer");

  const len = buf.length;
  let pos = 0;
  let startPos = 0;
  let lastPos = 0;
  let lastTag = null;
  let chunks = [];

  function pushChunk(tag) {
    if (0) {
      console.log("pushChunk(" + tag + ") pos=" + pos +
        " lastPos=" + lastPos +
        " startPos=" + startPos +
        " lastTag=" + lastTag);
    }

    if (tag === lastTag) return;

    if (startPos !== lastPos) {
      chunks.push({
        tag: lastTag,
        buf: buf.slice(startPos, lastPos)
      });
      startPos = lastPos;
    }

    lastPos = pos;
    lastTag = tag;
  }

  function getUTF8CP() {
    let cp = 0;
    let extra;
    let min;
    let max;

    const c = buf[pos];

    if ((c & 0xfe) == 0xfc) {
      cp = c & 0x01;
      [extra, min, max] = [5, 0x04000000, 0x7fffffff];
    } else if ((c & 0xfc) == 0xf8) {
      cp = c & 0x03;
      [extra, min, max] = [4, 0x00200000, 0x03ffffff];
      extra = 4;
    } else if ((c & 0xf8) == 0xf0) {
      cp = c & 0x07;
      [extra, min, max] = [3, 0x00010000, 0x001fffff];
    } else if ((c & 0xf0) == 0xe0) {
      cp = c & 0x0f;
      [extra, min, max] = [2, 0x00000800, 0x0000ffff];
    } else if ((c & 0xe0) == 0xc0) {
      cp = c & 0x1f;
      [extra, min, max] = [1, 0x00000080, 0x000007ff];
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

    if (strict > 0) {
      // Illegal code points
      if (cp >= 0xd800 && cp < 0xe000)
        return false;

      // Max code point
      if (cp > 0x10ffff)
        return false;

      if (strict > 1) {
        // Inefficient encoding
        if (cp < min)
          return false;
      }
    }

    pos += 1 + extra;
    return cp;
  }

  while (pos < len) {
    if ((buf[pos] & 0x80) === 0) {
      pos++;
      while (pos < len && (buf[pos] & 0x80) === 0) pos++;
      pushChunk("7bit");
      continue;
    }

    const cp = getUTF8CP();
    if (false !== getUTF8CP()) {
      while (pos < len) {
        if (false === getUTF8CP()) break;
      }
      pushChunk("utf8");
      continue;
    }

    pos++;
    pushChunk("unknown");
  }

  pushChunk("EOF"); // flush

  return chunks;
}

module.exports = encodingSleuth;

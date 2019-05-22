"use strict";

function encodeUTF8(cp, minLen = 0) {
  let need = 1;

  if (cp < 0 || cp >= 0x100000000)
    throw new Error("Invalid code point");

  if (cp >= 0x04000000)
    need = 6;
  else if (cp >= 0x00200000)
    need = 5;
  else if (cp >= 0x00010000)
    need = 4;
  else if (cp >= 0x00000800)
    need = 3;
  else if (cp >= 0x00000080)
    need = 2;

  // Allow inefficent encoding
  const len = Math.max(need, minLen);

  if (len > 6)
    throw new Error("Can't use more than 6 bytes / utf8 char");

  if (len === 1)
    return Uint8Array.from([cp]);

  let bytes = [];

  if (len >= 3) {
    if (len >= 4) {
      if (len >= 5) {
        if (len === 6) {
          bytes.push(0xfc | ((cp & 0x40000000) >> 30)); // 6
          bytes.push(0x80 | ((cp & 0x3f000000) >> 24));
        } else {
          bytes.push(0xf8 | ((cp & 0x03000000) >> 24)); // 5
        }
        bytes.push(0x80 | ((cp & 0x00fc0000) >> 18));
      } else {
        bytes.push(0xf0 | ((cp & 0x001c0000) >> 18)); // 4
      }
      bytes.push(0x80 | ((cp & 0x0003f000) >> 12));
    } else {
      bytes.push(0xe0 | ((cp & 0x0000f000) >> 12)); // 3
    }
    bytes.push(0x80 | ((cp & 0x00000fc0) >> 6));
  } else {
    bytes.push(0xc0 | ((cp & 0x000007c0) >> 6)); // 2
  }
  bytes.push(0x80 | ((cp & 0x00000003f) >> 0));

  return Uint8Array.from(bytes);
}

module.exports = encodeUTF8;

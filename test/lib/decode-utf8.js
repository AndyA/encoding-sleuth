"use strict";

function decodeUTF8(buf) {
  let cp = 0;
  let extra;

  const c = buf[0];

  if ((c & 0x80) === 0)
    return c;

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
  if (1 + extra > buf.length)
    return false;

  for (let i = 1; i <= extra; i++) {
    const cc = buf[i];
    if ((cc & 0xc0) !== 0x80)
      return false;
    cp = (cp << 6) | (cc & 0x3f);
  }

  return cp;
}

module.exports = decodeUTF8;

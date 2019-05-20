"use strict";

class CodePoint {
  static biasedRandom(pow) {
    return Math.pow(Math.random(), pow);
  }

  static isValid(cp) {
    if (cp < 0x80) return false;
    if (cp >= 0xd800 && cp < 0xe000) return false;
    if (cp >= 0x110000) return false;
    return true;
  }

  static randomValidCodePoint(pow = 3) {
    while (true) {
      const cp = Math.floor(this.biasedRandom(pow) * 0x110000);
      if (this.isValid(cp)) return cp;
    }
  }

  static randomCodePoint(pow = 6) {
    return Math.floor(this.biasedRandom(pow) * 0x80000000);
  }
}

module.exports = CodePoint;
"use strict";

class CodePoint {
  static biasedRandom(pow) {
    return Math.pow(Math.random(), pow);
  }

  static isValid(cp) {
    if (cp < 0x80) return false; // valid but requires no encoding
    if (cp >= 0xd800 && cp < 0xe000) return false;
    if (cp >= 0x110000) return false;
    return true;
  }

  static randomValid(pow = 3) {
    while (true) {
      const cp = Math.floor(this.biasedRandom(pow) * 0x110000);
      if (this.isValid(cp)) return cp;
    }
  }

  static random(pow = 6) {
    return Math.floor(this.biasedRandom(pow) * 0x80000000);
  }

  static randomInvalid(pow = 6) {
    while (true) {
      const cp = this.random(pow);
      if (!this.isValid(cp) && cp >= 0x80) return cp;
    }
  }
}

module.exports = CodePoint;

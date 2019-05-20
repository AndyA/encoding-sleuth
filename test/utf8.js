"use strict";

const encodeUTF8 = require("./lib/encode-utf8");
const decodeUTF8 = require("./lib/decode-utf8");
const expect = require("chai").expect;

function randomValidCodePoint() {
  while (true) {
    const cp = Math.floor(Math.random() * 0x110000);
    if ((cp >= 0x80 && cp < 0xd800) || cp >= 0xe000)
      return cp;
  }
}

function randomCodePoint() {
  return Math.floor(Math.pow(Math.random(), 6) * 0x80000000);
}

describe("encodeUTF8", () => {
  for (let i = 0; i < 20; i++) {
    const cp = randomValidCodePoint();

    it("should encode 0x" + cp.toString(16), () => {
      const want = Array.from(Buffer.from(String.fromCodePoint(cp)));
      const got = Array.from(encodeUTF8(cp));
      expect(got).to.deep.equal(want);
    });

    it("should decode 0x" + cp.toString(16), () => {
      const got = decodeUTF8(encodeUTF8(cp));
      expect(got).to.equal(cp);
    });

    it("should inefficiently encode 0x" + cp.toString(16), () => {
      const baseline = encodeUTF8(cp);
      const len = Math.floor(baseline.length + 1 + Math.random() * (6 - baseline.length));
      const enc = encodeUTF8(cp, len);
      expect(enc.length).to.equal(len);
      expect(decodeUTF8(enc)).to.equal(cp);
    });
  }

  for (let i = 0; i < 20; i++) {
    const cp = randomCodePoint();

    it("should round trip 0x" + cp.toString(16), () => {
      const got = decodeUTF8(encodeUTF8(cp));
      expect(got).to.equal(cp);
    });

    it("should inefficiently encode 0x" + cp.toString(16), () => {
      const baseline = encodeUTF8(cp);
      const len = Math.min(6, Math.floor(baseline.length + 1 + Math.random() * (6 - baseline.length)));
      const enc = encodeUTF8(cp, len);
      expect(enc.length).to.equal(len);
      expect(decodeUTF8(enc)).to.equal(cp);
    });
  }
});


"use strict";

const encodeUTF8 = require("./lib/encode-utf8");
const decodeUTF8 = require("./lib/decode-utf8");
const CodePoint = require("./lib/codepoint");
const expect = require("chai").expect;

describe("encodeUTF8", () => {
  for (let i = 0; i < 20; i++) {
    const cp = CodePoint.randomValidCodePoint();

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
    const cp = CodePoint.randomCodePoint();

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


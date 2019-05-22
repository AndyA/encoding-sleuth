"use strict";

const encodeUTF8 = require("./lib/encode-utf8");
const decodeUTF8 = require("./lib/decode-utf8");
const Random = require("./lib/random");
const TestData = require("./lib/testdata");
const expect = require("chai").expect;

function randomValid() {
  while (true) {
    const cp = Math.floor(Random.biasedRandom(3) * 0x110000);
    if (TestData.isValidUTF8(cp)) return cp;
  }
}

function random() {
  return Math.floor(Random.biasedRandom(6) * 0x80000000);
}

describe("encodeUTF8", () => {
  for (let i = 0; i < 20; i++) {
    const cp = randomValid();

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
      const len = Math.floor(baseline.length + 1 + Random.random() * (6 - baseline.length));
      const enc = encodeUTF8(cp, len);
      expect(enc.length).to.equal(len);
      expect(decodeUTF8(enc)).to.equal(cp);
    });
  }

  for (let i = 0; i < 20; i++) {
    const cp = random();

    it("should round trip 0x" + cp.toString(16), () => {
      const got = decodeUTF8(encodeUTF8(cp));
      expect(got).to.equal(cp);
    });

    it("should inefficiently encode 0x" + cp.toString(16), () => {
      const baseline = encodeUTF8(cp);
      const len = Math.min(6, Math.floor(baseline.length + 1 + Random.random() * (6 - baseline.length)));
      const enc = encodeUTF8(cp, len);

      expect(enc.length).to.equal(len);
      expect(decodeUTF8(enc)).to.equal(cp);
    });
  }
});


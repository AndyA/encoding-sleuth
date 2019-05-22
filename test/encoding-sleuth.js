"use strict";

const expect = require("chai").expect;
const TestData = require("./lib/testdata");
const _ = require("lodash");

const EncodingSleuth = require("../");

const checkMap = {
  checkUTF8Illegal: "illegal",
  checkUTF8Specials: "special",
  checkUTF8Replacement: "replacement",
  checkUTF8MaxCodePoint: "above-max",
  checkUTF8NonCanonicalEncoding: "non-canonical"
};

function checkSleuth(es, ref, msg) {
  it("should handle " + msg, () => {
    const want = TestData.mergeSpans(ref);
    const got = Array.from(es.analyse(TestData.gatherSpans(want)));
    expect(want.length > 0).to.be.true;
    expect(got).to.deep.equal(want, msg);
  });
}

function testSleuth(want, msg) {
  const flags = Array.from(TestData.flagsSeen(want)).sort();

  if (0 === flags.length) {
    // no permutations
    const es = new EncodingSleuth();
    checkSleuth(es, want, msg);
    return;
  }

  const flagToOpt = _.invert(checkMap);
  const lim = 1 << flags.length;
  for (let sel = 0; sel < lim; sel++) {
    let opt = {};
    let allow = new Set();
    for (let bit = 0; bit < flags.length; bit++) {
      const flag = flags[bit];
      const name = flagToOpt[flag];
      const ok = (sel & (1 << bit)) !== 0;
      opt[name] = ok;
      if (ok) allow.add(flag);
    }
    const allowed = Array.from(allow);
    if (!allowed.length) allowed.push("none");
    const desc = " (flags: " + allowed.join(", ") + ")";
    const test = TestData.filterFlags(want, allow);
    const es = new EncodingSleuth(opt);
    checkSleuth(es, test, msg + desc);
  }
}

function slidingTest() {

}

describe.only("EncodingSleuth", () => {
  describe("analyse", () => {

    it("should throw on bad input", () => {
      const es = new EncodingSleuth();
      expect(() => es.analyse("Hello")).to.throw(/needs a Uint8Array/i);
    });

    const len = 1000;
    testSleuth(TestData.generateSpans(TestData.random7bit(), len), "7bit");
    testSleuth(TestData.generateSpans(TestData.randomUTF8(), len), "utf8");
    testSleuth(TestData.generateSpans(TestData.randomBad(), len), "bad");
    testSleuth(TestData.generateSpans(TestData.randomCorruptUTF8(), len), "corrupt utf8");
    testSleuth(TestData.generateSpans(TestData.randomAnything(), len), "a mixture");

  });

});

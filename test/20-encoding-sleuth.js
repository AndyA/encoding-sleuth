"use strict";

const expect = require("chai").expect;
const TestData = require("./lib/testdata");
const Random = require("./lib/random");
const encodeUTF8 = require("./lib/encode-utf8");
const _ = require("lodash");

const EncodingSleuth = require("../");

//Random.seed();

const checkMap = {
  checkUTF8Illegal: "illegal",
  checkUTF8Specials: "special",
  checkUTF8Bom: "bom",
  checkUTF8Replacement: "replacement",
  checkUTF8MaxCodePoint: "aboveMax",
  checkUTF8NonCanonicalEncoding: "nonCanonical"
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

function memcpy(dst, src, offset) {
  let out = [];
  Array.prototype.push.apply(out, dst.slice(0, offset));
  Array.prototype.push.apply(out, src);
  Array.prototype.push.apply(out, dst.slice(offset + src.length));
  return Uint8Array.from(out);
}

function makeUnknown(cp) {
  return {
    length: 1,
    flags: "",
    enc: "unknown",
    cp: [cp],
    buf: Uint8Array.from([cp])
  };
}

function makeSlidingSpans(under, underSpans, over, overSpans, offset) {
  // Make the expected spans
  let pos = 0;
  let spans = [];
  let uSpans = underSpans.slice(0);

  // Spans that precede overlap
  while (uSpans.length && uSpans[0].pos + uSpans[0].length <= offset) {
    const us = uSpans.shift();
    spans.push(us);
    pos += us.length;
  }

  // Pad with unknowns
  while (pos < offset) {
    spans.push(makeUnknown(under[pos++]));
  }

  // Then over
  for (const ov of overSpans) {
    const overlay = Object.assign({}, ov, {
      pos
    });
    spans.push(overlay);
    pos += overlay.length;
  }

  // Skip any under spans that are occluded
  while (uSpans.length && uSpans[0].pos < pos) {
    uSpans.shift();
  }

  // More unknowns up to the next complete under char.
  const nextUnder = uSpans.length ? uSpans[0].pos : under.length;
  while (pos < nextUnder) {
    spans.push(makeUnknown(under[pos++]));
  }

  // Remaining under spans
  Array.prototype.push.apply(spans, uSpans);

  //  return spans;
  return TestData.mergeSpans(spans);
}

function slidingTest() {
  const r = new Random({
    pow: 5
  });
  const es = new EncodingSleuth();

  const over = encodeUTF8(r.randomBetween(0x80, 0x80000000));
  const overSpans = Array.from(es.analyse(over));

  let underBytes = [];
  let underSpans = [];
  while (underBytes.length < over.length * 3) {
    const ch = encodeUTF8(r.randomBetween(0x80, 0x80000000));
    Array.prototype.push.apply(underBytes, ch);
    Array.prototype.push.apply(underSpans, Array.from(es.analyse(ch)));
  }
  const under = Uint8Array.from(underBytes);
  TestData.fixSpanPos(underSpans);

  // Slide over over under. And stop calling me Shirley. 
  for (let offset = 0; offset <= under.length - over.length; offset++) {
    const sample = memcpy(under, over, offset);
    const sampleSpans = makeSlidingSpans(under, underSpans, over, overSpans, offset);

    it("should handle an offset " + offset + " overlay", () => {
      expect(Array.from(es.analyse(sample))).to.deep.equal(sampleSpans);
    });
  }
}

describe("EncodingSleuth", () => {
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

  describe("analyse (sliding UTF8 overlay)", () => {
    for (let i = 0; i < 5; i++)
      slidingTest();
  });

});

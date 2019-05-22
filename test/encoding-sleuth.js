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

function mergeSpans(spans) {
  // Current span we're building
  let pos = 0;
  let length = 0;
  let cp = [];
  let buf = [];

  let lastEnc = null;
  let lastFlags = null;

  let out = [];

  function flushSpan() {
    if (lastEnc === null)
      return;

    out.push({
      enc: lastEnc,
      flags: lastFlags,
      pos,
      length,
      cp,
      buf: Uint8Array.from(buf)
    });

    pos += length;
    length = 0;
    cp = [];
    buf = [];
  }

  for (const span of spans) {
    if (lastEnc !== null && lastEnc !== span.enc && lastFlags !== span.flags) {
      flushSpan();
      lastEnc = span.enc;
      lastFlags = span.flags;
    }

    Array.prototype.push.apply(cp, span.cp);
    Array.prototype.push.apply(buf, span.buf);
    length += span.length;
  }
  flushSpan();
  return out;
}

function checkSleuth(es, ref, msg) {
  it("should handle " + msg, () => {
    const want = mergeSpans(ref);
    let bytes = [];
    for (const ch of want)
      Array.prototype.push.apply(bytes, ch.buf);

    const got = Array.from(es.analyse(Uint8Array.from(bytes)));

    //    console.log({ want, got });

    expect(got).to.deep.equal(want, msg);
  });
}

function filterFlags(want, allow) {
  let out = [];
  for (const span of want) {
    const flags = TestData.parseFlags(span.flags).filter(f => allow.has(f));
    out.push(Object.assign({}, span, {
      flags: flags.join(" ")
    }));
  }
  return out;
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
    const test = filterFlags(want, allow);
    const es = new EncodingSleuth(opt);
    checkSleuth(es, test, msg + desc);
  }


}

describe.only("EncodingSleuth", () => {
  describe("analyse", () => {

    it("should throw on bad input", () => {
      const es = new EncodingSleuth();
      expect(() => es.analyse("Hello")).to.throw(/needs a Uint8Array/i);
    });

    const len = 1000;
    testSleuth(TestData.randToSpans(TestData.random7bit(), len), "7bit");
    testSleuth(TestData.randToSpans(TestData.randomUTF8(), len), "utf8");
    testSleuth(TestData.randToSpans(TestData.randomBad(), len), "bad");
    testSleuth(TestData.randToSpans(TestData.randomCorruptUTF8(), len), "corrupt utf8");
    testSleuth(TestData.randToSpans(TestData.randomAnything(), len), "a mixture");

  });

});

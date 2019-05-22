"use strict";

const expect = require("chai").expect;
const Random = require("./lib/random");
const RunRandom = require("./lib/runrandom");
const Generate = require("./lib/generate");
const _ = require("lodash");

console.log(Generate);

const EncodingSleuth = require("../");

const checkMap = {
  checkUTF8Illegal: "illegal",
  checkUTF8Specials: "special",
  checkUTF8Replacement: "replacement",
  checkUTF8MaxCodePoint: "above-max",
  checkUTF8NonCanonicalEncoding: "non-canonical"
};

function parseFlags(flags) {
  return flags.split(/\s+/).filter(x => x.length);
}

function mergeSpans(spans) {
  let out = [];
  let lastEnc = null;
  let lastFlags = null;
  let pos = 0;

  function mergeSpan(a, b) {
    let cp = a.cp.slice(0);
    Array.prototype.push.apply(cp, b.cp);
    let buf = Buffer.alloc(a.length + b.length);
    a.buf.copy(buf, 0);
    b.buf.copy(buf, a.length);
    return {
      enc: a.enc,
      flags: a.flags,
      length: a.length + b.length,
      pos: a.pos,
      cp,
      buf,
    }
  }

  function cloneSpan(span) {
    return mergeSpan(span, {
      length: 0,
      cp: [],
      buf: Buffer.from([])
    });
  }

  for (const span of spans) {
    if (lastEnc === null || lastEnc !== span.enc
      || lastFlags === null || lastFlags !== span.flags) {
      let newSpan = cloneSpan(span);
      newSpan.pos = pos;
      pos += span.length;
      out.push(newSpan);
      lastEnc = span.enc;
      lastFlags = span.flags;
      continue;
    }

    pos += span.length;
    out.push(mergeSpan(out.pop(), span));
  }
  return out;
}


function checkSleuth(es, ref, msg) {
  it("should handle " + msg, () => {
    const want = mergeSpans(ref);
    let bytes = [];
    for (const ch of want)
      Array.prototype.push.apply(bytes, ch.buf);

    const got = Array.from(es.analyse(Buffer.from(bytes)));

    //    console.log({ want, got });

    expect(got).to.deep.equal(want, msg);
  });
}

function flagsSeen(want) {
  let flags = new Set();
  for (const ch of want) {
    const flagNames = (ch.flags || "").split(/\s+/).filter(x => x.length);
    for (const flag of flagNames)
      flags.add(flag);
  }
  return flags;
}

function filterFlags(want, allow) {
  let out = [];
  for (const span of want) {
    const flags = Generate.parseFlags(span.flags).filter(f => allow.has(f));
    out.push(Object.assign({}, span, {
      flags: flags.join(" ")
    }));
  }
  return out;
}

function testSleuth(want, msg) {
  const flags = Array.from(flagsSeen(want)).sort();

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
      expect(() => es.analyse("Hello")).to.throw(/needs a Buffer/i);
    });

    const len = 1000;
    testSleuth(Generate.randToSpans(Generate.random7bit(), len), "7bit");
    testSleuth(Generate.randToSpans(Generate.randomUTF8(), len), "utf8");
    testSleuth(Generate.randToSpans(Generate.randomBad(), len), "bad");
    testSleuth(Generate.randToSpans(Generate.randomCorruptUTF8(), len), "corrupt utf8");
    testSleuth(Generate.randToSpans(Generate.randomAnything(), len), "a mixture");

  });

});

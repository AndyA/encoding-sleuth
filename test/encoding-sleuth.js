"use strict";

const expect = require("chai").expect;
const encodeUTF8 = require("./lib/encode-utf8");
const CodePoint = require("./lib/codepoint");
const Random = require("./lib/random");
const RunRandom = require("./lib/runrandom");
const _ = require("lodash");

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

function addFlags(flags, extra) {
  if (!_.isArray(extra))
    return addFlags(flags, [extra]);
  let list = parseFlags(flags);
  let seen = new Set(list);
  for (const f of extra) {
    if (seen.has(f)) continue;
    list.push(f);
    seen.add(f);
  }
  return list.join(" ");
}

function random7bit() {
  const r = new Random();
  return RunRandom.singleton(() => {
    const cp = r.randomBetween(0, 0x80);
    return {
      length: 1,
      flags: "",
      enc: "7bit",
      cp: [cp],
      buf: Buffer.from([cp])
    }
  });
}

function randomCorruptUTF8() {
  const r = new Random();

  const rr = randomUTF8();

  return RunRandom.singleton(() => {
    let span = rr.runOne();
    const bytes = Array.from(span.buf);
    bytes[0] = bytes[0] ^ 0x40;

    return {
      length: bytes.length,
      flags: "",
      enc: "unknown",
      cp: bytes,
      buf: Buffer.from(bytes)
    };
  });
}

function randomBad() {
  function makeSpan(cp) {
    return {
      length: 1,
      flags: "",
      enc: "unknown",
      cp: [cp],
      buf: Buffer.from([cp]),
    };
  }

  const r = new Random();
  return new RunRandom([
    {
      weight: 10,
      f: () => makeSpan(r.randomBetween(0x80, 0xc0))
    },
    {
      weight: 1,
      f: () => makeSpan(r.randomBetween(0xfe, 0x100))
    },
  ]);
}

function randomUTF8() {
  function makeSpan(cp, flags, buf) {
    buf = buf || encodeUTF8(cp);
    return {
      length: buf.length,
      flags: flags || "",
      enc: "utf8",
      cp: [cp],
      buf,
    };
  }

  function legalCP(max) {
    while (true) {
      const cp = r.randomBetween(0x80, max);
      if (cp >= 0xd800 && cp < 0xe000) continue;
      if (cp >= 0xfff0 && cp < 0x10000) continue;
      return cp;
    }
  }

  const r = new Random({
    pow: 3
  });

  const rr = new RunRandom([
    {
      weight: 10,
      f: () => {
        return makeSpan(legalCP(0x110000));
      }
    }, {
      weight: 1,
      f: () => {
        return makeSpan(r.randomBetween(0x110000, 0x80000000), "above-max");
      }
    }, {
      weight: 1,
      f: () => {
        return makeSpan(r.randomBetween(0xd800, 0xe000), "illegal");
      }
    }, {
      weight: 1,
      f: () => {
        return makeSpan(0xfffd, "special replacement");
      }
    }]);

  // Sometimes non-canonicalise a char.
  const rrnc = new RunRandom([
    {
      weight: 10,
      f: () => rr.runOne()
    }, {
      weight: 1,
      f: () => {
        let span = rr.runOne();
        const optLen = span.length;
        if (optLen === 6) return span;
        const newLen = r.randomBetween(optLen + 1, 7);
        const buf = encodeUTF8(span.cp, newLen);
        span.length = buf.length;
        span.buf = buf;
        span.flags = addFlags(span.flags, "non-canonical");
        return span
      }
    }
  ]);

  return rrnc;
}

function randomAnything() {
  const rr7bit = random7bit();
  const rrUTF8 = randomUTF8();
  const rrBad = randomBad();
  const rrCorruptUTF8 = randomCorruptUTF8();

  return new RunRandom([
    {
      weight: 10,
      f: () => rr7bit.runOne()
    },
    {
      weight: 10,
      f: () => rrUTF8.runOne()
    },
    {
      weight: 10,
      f: () => rrBad.runOne()
    },
    {
      weight: 10,
      f: () => rrCorruptUTF8.runOne()
    },
  ]);
}

function randToSpans(rr, len) {
  let spans = [];
  for (let i = 0; i < len; i++) {
    spans.push(rr.runOne());
  }
  return spans;
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
    const flags = parseFlags(span.flags).filter(f => allow.has(f));
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
    testSleuth(randToSpans(random7bit(), len), "7bit");
    testSleuth(randToSpans(randomUTF8(), len), "utf8");
    testSleuth(randToSpans(randomBad(), len), "bad");
    testSleuth(randToSpans(randomCorruptUTF8(), len), "corrupt utf8");
    testSleuth(randToSpans(randomAnything(), len), "a mixture");

  });

});

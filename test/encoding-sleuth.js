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

function addFlags(flags, extra) {
  if (!_.isArray(extra))
    return addFlags(flags, [extra]);
  let list = flags.split(/\s+/).filter(x => x.length);
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

  for (const span of spans) {
    if (lastEnc === null || lastEnc !== span.enc
      || lastFlags === null || lastFlags !== span.flags) {
      span.pos = pos;
      pos += span.length;
      out.push(span);
      lastEnc = span.enc;
      lastFlags = span.flags;
      continue;
    }

    let last = out.pop();
    Array.prototype.push.apply(last.cp, span.cp);
    let buf = Buffer.alloc(last.length + span.length);
    last.buf.copy(buf, 0);
    span.buf.copy(buf, last.length);
    last.buf = buf;
    last.length += span.length;
    pos += span.length;
    out.push(last);
  }
  return out;
}


function checkAnalyse(es, ref, msg) {
  it("should handle " + msg, () => {
    const want = mergeSpans(ref);
    let bytes = [];
    for (const ch of want)
      Array.prototype.push.apply(bytes, ch.buf);

    let got = [];
    es.analyse(Buffer.from(bytes), span => got.push(span));

    //                console.log({ got, want });

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

function testAnalyse(want, msg) {
  const flags = flagsSeen(want);

  if (true || 0 === flags.size) {
    // no permutations
    const es = new EncodingSleuth();
    checkAnalyse(es, want, msg);
    return;
  }

}

describe.only("EncodingSleuth", () => {
  describe("analyse", () => {

    it("should throw on bad input", () => {
      const es = new EncodingSleuth();
      expect(() => es.analyse("Hello", function() {})).to.throw(/needs a Buffer/i);
      expect(() => es.analyse(Buffer.from("Hello"), "func")).to.throw(/needs a function/i);
    });

    testAnalyse(randToSpans(random7bit(), 1000), "7bit");
    testAnalyse(randToSpans(randomUTF8(), 1000), "utf8");
    testAnalyse(randToSpans(randomBad(), 1000), "bad");
    testAnalyse(randToSpans(randomCorruptUTF8(), 1000), "corrupt utf8");
    testAnalyse(randToSpans(randomAnything(), 1000), "a mixture");

  });

});

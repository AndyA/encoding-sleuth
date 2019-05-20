"use strict";

const expect = require("chai").expect;
const encodeUTF8 = require("./lib/encode-utf8");
const CodePoint = require("./lib/codepoint");

const EncodingSleuth = require("../");

function generateBytes(len, gen) {
  let bytes = [];
  for (let i = 0; i < len; i++) {
    const buf = gen();
    Array.prototype.push.apply(bytes, Array.from(buf).map(Math.floor));
  }
  return bytes;
}

function sevenBitSafe(len) {
  return generateBytes(len, () => [Math.random() * 0x80]);
}

function utf8Valid(len) {
  return generateBytes(len, () => encodeUTF8(CodePoint.randomValid()));
}

function utf8Invalid(len) {
  return generateBytes(len, () => encodeUTF8(CodePoint.randomInvalid()));
}

function scrambleUTF8(src, amount = 0.3) {
  let buf = Buffer.from(src);
  buf[0] = Math.floor(Math.random() * 64 + 128);
  return buf;
}

function scrambledUTF8(len) {
  return generateBytes(len, () => scrambleUTF8(encodeUTF8(CodePoint.random())));
}

function nonUTF8(len) {
  return generateBytes(len, () => [Math.floor(Math.random() * 64 + 128)]);
}

describe("EncodingSleuth", () => {

  function esBytes(res) {
    let out = [];
    for (const chunk of res) {
      out.push({
        tag: chunk.tag,
        buf: Array.from(chunk.buf)
      });
    }
    return out;
  }

  function checkES(es, res, msg) {
    let bytes = [];

    for (const chunk of res)
      Array.prototype.push.apply(bytes, chunk.buf);

    const got = es.examine(Buffer.from(bytes));

    expect(esBytes(got)).to.deep.equal(res, msg);
  }

  it("should throw on bad input", () => {
    const es = new EncodingSleuth();
    expect(() => es.examine("Hello")).to.throw(/needs a Buffer/);
  });

  it("should recognise pure 7-bit safe bytes", () => {
    const es = new EncodingSleuth();
    checkES(es, [{
      tag: "7bit",
      buf: sevenBitSafe(1)
    }], "7-bit safe");

    checkES(es, [{
      tag: "7bit",
      buf: sevenBitSafe(40)
    }], "7-bit safe");
  });

  it("should recognise pure valid utf8 bytes", () => {
    const es = new EncodingSleuth();
    checkES(es, [{
      tag: "utf8",
      buf: utf8Valid(1)
    }], "valid utf8");

    checkES(es, [{
      tag: "utf8",
      buf: utf8Valid(40)
    }], "valid utf8");
  });

  it("should recognise non utf8 bytes", () => {
    const es = new EncodingSleuth();
    checkES(es, [{
      tag: "unknown",
      buf: nonUTF8(40)
    }], "invalid");
  });

  it("should recognise non utf8 bytes", () => {
    const es = new EncodingSleuth();
    checkES(es, [{
      tag: "unknown",
      buf: scrambledUTF8(40)
    }], "invalid");
  });

  it("should recognise a mixture of encodings", () => {
    const es = new EncodingSleuth();
    checkES(es, [
      {
        tag: "7bit",
        buf: sevenBitSafe(40)
      }, {
        tag: "utf8",
        buf: utf8Valid(40)
      }, {
        tag: "unknown",
        buf: nonUTF8(40)
      }, {
        tag: "7bit",
        buf: sevenBitSafe(40)
      }, {
        tag: "utf8",
        buf: utf8Valid(40)
      }, {
        tag: "unknown",
        buf: nonUTF8(40)
      }
    ], "mixed encoding");
  });

  it("should handle invalid utf8 code points with allowIllegalCodepoints", () => {
    const es = new EncodingSleuth({
      allowIllegalCodepoints: true,
    });
    checkES(es, [{
      tag: "utf8",
      buf: utf8Invalid(1)
    }], "invalid utf8");
    checkES(es, [{
      tag: "utf8",
      buf: utf8Invalid(40)
    }], "invalid utf8");
  });

});

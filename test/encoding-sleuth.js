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
  return generateBytes(len, () => encodeUTF8(CodePoint.randomValidCodePoint()));
}

function scrambleUTF8(src, amount = 0.3) {
  let buf = Buffer.from(src);

  while (true) {
    let done = false;
    for (let p = 0; p < buf.length; p++) {
      if (Math.random() < amount) {
        done = true;
        if (p === 0) {
          // byte 0 mods
          let c = buf[p];
          let pfx = 1;
          // count leading bits
          while (c & 0x80) {
            pfx++;
            c = c << 1;
          }
          buf[p] = (buf[p] & (0xff >> pfx)) |
            (Math.floor(Math.random() * ((1 << pfx) - 2)) ^ 1) << (8 - pfx);
        } else {
          // invalid top bits: 0x00, 0x01, 0x11
          let topBits = Math.floor(Math.random() * 0x03);
          if (topBits === 0x02)
            topBits = 0x03
          buf[p] = (buf[p] & 0x3f) | (topBits << 6);
        }
      }
    }
    if (done) return buf;
  }
}

function scrambledUTF8(len) {
  return generateBytes(len, () => scrambleUTF8(encodeUTF8(CodePoint.randomCodePoint())));
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
        bytes: Array.from(chunk.buf)
      });
    }
    return out;
  }

  function checkES(es, res, msg) {
    let bytes = [];

    for (const chunk of res)
      Array.prototype.push.apply(bytes, chunk.bytes);

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
      bytes: sevenBitSafe(40)
    }], "7-bit safe");
  });

  it("should recognise pure valid utf8 bytes", () => {
    const es = new EncodingSleuth();
    checkES(es, [{
      tag: "utf8",
      bytes: utf8Valid(40)
    }], "valid utf8");
  });

  it("should recognise non utf8 bytes", () => {
    const es = new EncodingSleuth();
    checkES(es, [{
      tag: "unknown",
      bytes: nonUTF8(40)
    }], "invalid");
  });

  //  it("should recognise non utf8 bytes", () => {
  //    const es = new EncodingSleuth();
  //    checkES(es, [{
  //      tag: "unknown",
  //      bytes: scrambledUTF8(40)
  //    }], "invalid");
  //  });

});

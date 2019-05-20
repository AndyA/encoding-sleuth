"use strict";

const expect = require("chai").expect;
const encodeUTF8 = require("./lib/encode-utf8");
const encodingSleuth = require("../");

function sevenBitSafe() {
  let bytes = [];
  for (let b = 0; b < 0x80; b++)
    bytes.push(b);
  return bytes;
}

describe("encodingSleuth", () => {

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

  function checkES(res, msg) {
    let bytes = [];

    for (const chunk of res)
      Array.prototype.push.apply(bytes, chunk.bytes);

    const got = encodingSleuth(Buffer.from(bytes));

    expect(esBytes(got)).to.deep.equal(res, msg);
  }

  it("should throw on bad input", () => {

    expect(() => encodingSleuth("Hello")).to.throw(/needs a Buffer/);

  });

  it("should recognise pure 7-bit safe bytes", () => {
    checkES([{
      tag: "7bit",
      bytes: sevenBitSafe()
    }], "7-bit safe");

  });

});

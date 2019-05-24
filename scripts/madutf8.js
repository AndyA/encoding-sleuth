"use strict";

// Just for fun produce versions of files with each character encoded as
// six utf8 bytes. Both node and perl (and probably most other languages)
// consider the resulting file to be malformed - but vim, and possibly others
// will edit it and it displays OK but syntax highlighting, search and replace
// etc don't work.

const encodeUTF8 = require("../test/lib/encode-utf8");
const fs = require("fs");

for (const inFile of process.argv.slice(2)) {
  const outFile = inFile + ".mad";
  const src = fs.readFileSync(inFile, "utf8");
  let enc = [];
  for (const ch of src) {
    const cc = ch.charCodeAt(0);
    Array.prototype.push.apply(enc, cc >= 32 ? encodeUTF8(cc, 6) : [cc]);
  }
  const buf = Uint8Array.from(enc);
  fs.writeFileSync(outFile, buf);
}

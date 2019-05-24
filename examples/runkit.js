const EncodingSleuth = require("encoding-sleuth");

const es = new EncodingSleuth();

// Analyse some bytes
const span = Array.from(es.analyse(Uint8Array.from([
  65, 66, 67,  // ABC
  200, // unknown
  220, 129 // utf8
])));

console.log(span);

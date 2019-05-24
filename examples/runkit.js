const EncodingSleuth = require("encoding-sleuth");

const es = new EncodingSleuth();

// Analyse some bytes
const span = Array.from(es.analyse(Uint8Array.from([
  65, 66, 67, // ABC
  200, // unknown
  220, 129, // utf8
  248, 128, 128, 156, 129, // nonCanonical
  237, 160, 131, // illegal 
  244, 163, 145, 150, // above max
])));

console.log(span);




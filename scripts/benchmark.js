"use strict";

const Benchmark = require("benchmark");
const EncodingSleuth = require("../");
const Random = require("../test/lib/random");
const TestData = require("../test/lib/testdata");

Random.seed();

let bm = new Benchmark.Suite();

function makeData(rr, len) {
  return TestData.gatherSpans(TestData.generateSpans(rr, len));
}

function drain(es, buf) {
  return Array.from(es.analyse(buf));
}

bm.on("cycle", event => {
  console.log(String(event.target));
});

const len = 100000;
const kinds = ["7bit", "UTF8", "Bad", "CorruptUTF8", "Anything"];
const es = new EncodingSleuth();

for (const kind of kinds) {
  const m = "random" + kind;
  const data = makeData((TestData[m])(), len);

  bm.add(kind, () => {
    drain(es, data);
  });
}

bm.run();

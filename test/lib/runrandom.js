"use strict";

const assert = require("assert");
const _ = require("lodash");
const Random = require("./random");

function getAlt(f) {
  if (_.isFunction(f)) return getAlt({
      f
    });
  assert(_.isFunction(f.f));
  return f;
}

function getAlts(alts) {
  let hasOnly = false;
  let out = [];

  for (let a of alts.map(getAlt)) {
    if (a.only)
      hasOnly = true;
    const weight = a.weight == undefined ? 1 : a.weight;
    out.push({
      f: a.f,
      weight,
      only: a.only || false
    });
  }

  return hasOnly ? out.filter(x => x.only) : out;
}

class RunRandom {
  constructor(alts, opt) {
    this.opt = Object.assign({}, {
      pow: 1
    }, opt || {});

    this.alts = getAlts(alts);
    this.tw = 0;
    this.rng = new Random({
      pow: this.opt.pow
    });

    for (let a of this.alts)
      this.tw += a.weight;
  }

  static one(f) {
    return new RunRandom([f]);
  }

  _pickOne() {
    let r = this.rng.random() * this.tw;
    for (const a of this.alts) {
      if (a.weight >= r)
        return a;
      r -= a.weight;
    }
  }

  runOne() {
    const alt = this._pickOne();
    assert(alt);
    return alt.f.apply(null, arguments);
  }
}

module.exports = RunRandom;

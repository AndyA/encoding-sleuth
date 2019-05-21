"use strict";

class Random {
  constructor(opt) {
    this.opt = Object.assign({}, {
      pow: 1
    }, opt || {});
  }

  random() {
    return Math.pow(Math.random(), this.opt.pow);
  }

  randomBetween(low, high) {
    return Math.floor(this.random() * (high - low) + low);
  }
}

module.exports = Random;

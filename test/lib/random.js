"use strict";

class Random {
  constructor(opt) {
    this.opt = Object.assign({}, {
      pow: 1
    }, opt || {});
  }

  // From
  //   https://stackoverflow.com/questions/521295/ \
  //     seeding-the-random-number-generator-in-javascript/47593316#47593316
  // 
  static sfc32(ra, rb, rc, rd) {
    return () => {
      ra >>>= 0;
      rb >>>= 0;
      rc >>>= 0;
      rd >>>= 0;
      let tmp = (ra + rb) | 0;
      ra = rb ^ rb >>> 9;
      rb = rc + (rc << 3) | 0;
      rc = (rc << 21 | rc >>> 11);
      rd = rd + 1 | 0;
      tmp = tmp + rd | 0;
      rc = rc + tmp | 0;
      return (tmp >>> 0) / 4294967296;
    }
  }

  static seed(ra, rb, rc, rd) {
    if (ra === undefined)
      ra = 0x181e9665;
    if (rb === undefined)
      rb = (ra ^ -1) >>> 0;
    if (rc === undefined)
      rc = (rb ^ -1) >>> 0;
    if (rd === undefined)
      rd = (rc ^ -1) >>> 0;

    this.random = this.sfc32(ra, rb, rc, rd);

    // Warm it up
    for (let i = 0; i < 20; i++)
      this.random();
  }

  static randomise() {
    this.seed(Math.random() * 4294967296);
  }

  random() {
    return Math.pow(this.constructor.random(), this.opt.pow);
  }

  randomBetween(low, high) {
    return Math.floor(this.random() * (high - low) + low);
  }
}

Random.randomize = Random.randomise;
Random.randomize();

module.exports = Random;

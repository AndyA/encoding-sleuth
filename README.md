# encoding-sleuth

Rigorously analyse an array of bytes into spans of

* 7-bit clean (ASCII)
* UTF8 (with validity checks)
* unknown (bytes that are neither ASCII or part of a UTF8 sequence)

## Installation

Using npm:
```shell
$ npm install encoding-sleuth
```

## Usage

```javascript
const EncodingSleuth = require("encoding-sleuth");
const fs = require("fs");

const mystery = fs.readFileSync("suspect.txt");
const es = new EncodingSleuth();
for (const span of es.analyse(mystery)) {
  console.log(span.enc, span.flags, span.pos, span.length);
}
```

## Overview

encoding-sleuth parses a `Uint8Array` (or node `Buffer`) of bytes and breaks that text into spans that contain

* 7-bit clean bytes (0x00 - 0x7f) which encode identically in both UTF8 and ASCII
* bytes that contain an encoded UTF8 character
* bytes that can't be interpreted as either of the above

It can be used to

* validate encoding
* guess the encoding of arbitrary bytes
* automatically fix the encoding (with some extra code that you write)




## API

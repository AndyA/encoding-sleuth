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
* bytes that contain a correctly encoded UTF8 character
* bytes that can't be interpreted as either of the above

It can be used to

* validate encoding
* guess the encoding of arbitrary bytes
* automatically fix the encoding (with some extra code that you write)

## API

Create a new `EncodingSleuth` like this:

```javascript
const es = new EncodingSleuth(options);
```

`options` is an optional object with the following default values:

```javascript
{
  checkUTF8Illegal: true,
  checkUTF8Replacement: true,
  checkUTF8Specials: true,
  checkUTF8Bom: true,
  checkUTF8MaxCodePoint: true,
  checkUTF8NonCanonicalEncoding: true,
  checkUTF8: true,
}
```

Each option enables a check that is performed on every decoded UTF8 code point:

* `checkUTF8Illegal`: flag code points between 0xd800 and 0xdfff as 'illegal'
* `checkUTF8Replacement`: flag the UTF8 replacement character (xfffd) as 'replacement'
* `checkUTF8Specials`: flag code points between 0xfff0 and 0xffff as 'special'
* `checkUTF8Bom`: flag the UTF8 BOM (0xfeff) as 'bom'
* `checkUTF8MaxCodePoint`: flag code points >= 0x110000 as 'above-max'. Can be `true`, `false` or a number - in which case it will be used as the upper limit instead of 0x110000
* `checkUTF8NonCanonicalEncoding`: flag unnecessary long encodings as 'non-canonical'
* `checkUTF8`: set `false` to disable all UTF8 checks.

Having created a `EncodingSleuth` instance use it to analyse some bytes:

```javascript
const es = new EncodingSleuth();
const mystery = fs.readFileSync("suspect.txt");

for (const span of es.analyse(mystery)) {
  console.log(span.enc, span.flags, span.pos, span.length);
}
```

`analyse` returns an iterator which can consumed in a variety of ways:

```javascript
// in a loop
for (const span of es.analyse(mystery)) {
  console.log(span.enc, span.flags, span.pos, span.length);
}

// or grab it all into an Array
const spans = Array.from(es.analyse(mystery));

// etc
```

Each span is an object like this:

```javascript
{
  enc: "utf8",    // or "7bit", "unknown"
  pos: 0,         // offset of this span in original array
  length: 18,     // length in bytes of this span
  flags: "",      // see below
  f: {},          // object version of flags: true for each set flag
  cp: [...],      // array of decoded code points in this span
  buf: Uint8Array // portion of the buffer subtended by this span
```

A span describes a run of bytes. Each span has a `pos` where it starts in the original bytes, a `length` indicating how many bytes it covers and a `buf` containing the actual bytes for this span.

The `enc` field describes the encoding of this span of bytes:

* `7bit`: a run of bytes between 0x00 and 0x7F inclusive
* `utf8`: a run of syntactically valid UTF8 encodings
* `unknown`: any bytes that are neither `7bit` or `utf8`

Syntactically valid UTF8 takes one of the following forms

```
bytes bits   min      max
used  enc
1      7     00000000 0000007f 0xxxxxxx
2     11     00000080 000007FF 110xxxxx  10xxxxxx
3     16     00000800 0000FFFF 1110xxxx  10xxxxxx  10xxxxxx
4     21     00010000 001FFFFF 11110xxx  10xxxxxx  10xxxxxx  10xxxxxx
5     26     00200000 03FFFFFF 111110xx  10xxxxxx  10xxxxxx  10xxxxxx  10xxxxxx
6     31     04000000 7FFFFFFF 1111110x  10xxxxxx  10xxxxxx  10xxxxxx  10xxxxxx  10xxxxxx
```

The single byte form (0x00 - 0x7F) is 7 bit safe, synonymous with ASCII and is identified as `7bit`.

The other forms allow any code point between 0x80 an 0x7fffffff to be encoded.

The `flags` and `f` fields are only interesting for UTF8 sequences. With all checks enabled (see constructor above) the following flags will be set for each utf8 span:

* flag code points between 0xd800 and 0xdfff as '`illegal`'
* flag the UTF8 replacement character (xfffd) as '`replacement`'
* flag code points between 0xfff0 and 0xffff as '`special`'
* flag the UTF8 BOM (0xfeff) as '`bom`'
* flag code points >= 0x110000 as '`above-max`'
* flag unnecessary long encodings as '`non-canonical`'

During parsing by `analyse` a new span is returned each time the `enc` or `flags` fields change; runs of bytes with the same encoding are returned as a single span. There's a very slight speed up from turning off tests that you're not interested in but the main reason to do that is to simplify processing of the returned spans. Generally it's fine to use the defaults.

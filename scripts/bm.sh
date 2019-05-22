#!/bin/bash

host="$( hostname -s )"
dir="bm"

mkdir -p "$dir"

log="$dir/$host.$( date -u +'%Y%m%d-%H%M%S' ).txt"

echo "Writing $log"
node scripts/benchmark.js | tee "$log"

# vim:ts=2:sw=2:sts=2:et:ft=sh


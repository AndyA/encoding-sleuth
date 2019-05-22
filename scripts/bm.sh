#!/bin/bash

host="$( hostname -s )"
dir="bm"

mkdir -p "$dir"

name="$host.$( date -u +'%Y%m%d-%H%M%S' )"
log="$dir/$name.txt"

echo "Writing $log"
echo "=== $name ===" > $log
node scripts/benchmark.js | tee -a "$log"

# vim:ts=2:sw=2:sts=2:et:ft=sh


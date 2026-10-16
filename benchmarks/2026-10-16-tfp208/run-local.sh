#!/usr/bin/env bash
# Copied from R1 (benchmarks/2026-10-15-tfp207-regression/run-local.sh), changed only in where it writes, so the
# re-run is R1's, on TFP-208's commit.
# TFP-208 (post-Phase 42 review R2): the Toolshop known-bug benchmark on one local copy, Standard only, as
# Phase 41's Gate B ran it (benchmarks/2026-10-13-tfp188/run-local.sh), changed only in where it writes and in
# leaving out the two Comprehensive runs (the ticket's scope). A fresh crawl through the app's crawl route,
# Phase 40's selection unedited, then Standard (all ten areas, fast) on Standard's pages with TFP-175's driver:
# the template's own suite (mockGenerate), so no site suite, no candidates and no gap writer are involved.
# Read-only gate, one worker, Chromium. Refuses to run on a working tree with changes to the code under test
# (src/, scripts/, package*.json), so every run measures a commit.
# The copy must be running first: scripts/toolshop-local/start-toolshop.ps1 -Sprint <sprint>.
# Usage (from the repo root): bash benchmarks/2026-10-16-tfp208/run-local.sh <with-bugs|clean>
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
label=$1
site=http://localhost:4200
D=benchmarks/2026-10-07-tfp175-selection
R=benchmarks/2026-10-16-tfp208/runs
mkdir -p "$R"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
echo "$label: $(date +%H:%M:%S) crawl ($MEASURE_COMMIT)"
$TS "$D/crawl-and-select.mts" "$label" "$site" "$R" || exit 1
standard=$(node -e "console.log(require('./$R/$label-selection.json').standard.pages.join(' '))")
echo "$label: $(date +%H:%M:%S) standard"
$TS "$D/run-tfp175.ts" "$label-standard" "$site" standard "$R" $standard || exit 1
echo "$label: $(date +%H:%M:%S) done"

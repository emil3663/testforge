#!/usr/bin/env bash
# Phase 41 (TFP-188, Gate B): the re-score with Phase 41's checks, on one local Toolshop copy, as TFP-180
# scored the baseline (benchmarks/2026-10-07-phase41-local/run-local.sh), changed only in where it writes:
# a fresh crawl through the app's crawl route, Phase 40's selection unedited, then Standard (all ten areas,
# fast) on Standard's pages and Comprehensive security (passive) and accessibility on Comprehensive's.
# Read-only gate, one worker, Chromium - TFP-175's own scripts. Refuses to run on a working tree with
# changes to the code under test (src/, scripts/, package*.json), so every run measures a commit.
# The copy must be running first: scripts/toolshop-local/start-toolshop.ps1 -Sprint <sprint>.
# Usage (from the repo root): bash benchmarks/2026-10-13-tfp188/run-local.sh <with-bugs|clean>
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
label=$1
site=http://localhost:4200
D=benchmarks/2026-10-07-tfp175-selection
R=benchmarks/2026-10-13-tfp188/runs
mkdir -p "$R"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
echo "$label: $(date +%H:%M:%S) crawl ($MEASURE_COMMIT)"
$TS "$D/crawl-and-select.mts" "$label" "$site" "$R"
standard=$(node -e "console.log(require('./$R/$label-selection.json').standard.pages.join(' '))")
comprehensive=$(node -e "console.log(require('./$R/$label-selection.json').comprehensive.pages.join(' '))")
echo "$label: $(date +%H:%M:%S) standard"
$TS "$D/run-tfp175.ts" "$label-standard" "$site" standard "$R" $standard
echo "$label: $(date +%H:%M:%S) security"
$TS "$D/run-tfp175.ts" "$label-security" "$site" security "$R" $comprehensive
echo "$label: $(date +%H:%M:%S) accessibility"
$TS "$D/run-tfp175.ts" "$label-accessibility" "$site" accessibility "$R" $comprehensive
echo "$label: $(date +%H:%M:%S) done"

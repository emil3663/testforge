#!/usr/bin/env bash
# Phase 41 (TFP-180, Decision 7): today's TestForge scored on one local Toolshop copy, as TFP-175 scored
# the hosted ones: a fresh crawl through the app's crawl route, Phase 40's selection unedited, then
# Standard (all ten areas, fast) on Standard's pages and Comprehensive security (passive) and
# accessibility on Comprehensive's. Read-only gate, one worker, Chromium - TFP-175's own scripts.
# The copy must be running first: scripts/toolshop-local/start-toolshop.ps1 -Sprint <sprint>.
# Usage (from the repo root): bash benchmarks/2026-10-07-phase41-local/run-local.sh <with-bugs|clean>
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
label=$1
site=http://localhost:4200
D=benchmarks/2026-10-07-tfp175-selection
R=benchmarks/2026-10-07-phase41-local/runs
mkdir -p "$R"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
$TS "$D/crawl-and-select.mts" "$label" "$site" "$R"
standard=$(node -e "console.log(require('./$R/$label-selection.json').standard.pages.join(' '))")
comprehensive=$(node -e "console.log(require('./$R/$label-selection.json').comprehensive.pages.join(' '))")
$TS "$D/run-tfp175.ts" "$label-standard" "$site" standard "$R" $standard
$TS "$D/run-tfp175.ts" "$label-security" "$site" security "$R" $comprehensive
$TS "$D/run-tfp175.ts" "$label-accessibility" "$site" accessibility "$R" $comprehensive

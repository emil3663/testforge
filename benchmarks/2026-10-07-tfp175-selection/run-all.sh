#!/usr/bin/env bash
# TFP-175: crawl, select and run both Toolshops, one run at a time:
# Standard (all ten areas, fast) on Standard's selection, and Comprehensive
# security (passive) and accessibility on Comprehensive's. Read-only gate
# (TESTFORGE_INTERACTIVE=0 in the driver), one worker, Chromium.
# Usage (from the repo root): bash benchmarks/2026-10-07-tfp175-selection/run-all.sh
set -u
# Git Bash rewrites arguments that start with "/" into Windows paths
# ("/#/product/6" -> "C:/Program Files/Git/#/product/6"); the page paths
# must reach the driver as given. (Found on the first attempt, whose runs
# visited local file paths and were discarded.)
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
D=benchmarks/2026-10-07-tfp175-selection
R="$D/runs"
mkdir -p "$R"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
for pair in "with-bugs https://with-bugs.practicesoftwaretesting.com" "clean https://practicesoftwaretesting.com"; do
    set -- $pair
    label=$1; site=$2
    $TS "$D/crawl-and-select.mts" "$label" "$site" "$R"
    standard=$(node -e "console.log(require('./$R/$label-selection.json').standard.pages.join(' '))")
    comprehensive=$(node -e "console.log(require('./$R/$label-selection.json').comprehensive.pages.join(' '))")
    $TS "$D/run-tfp175.ts" "$label-standard" "$site" standard "$R" $standard
    $TS "$D/run-tfp175.ts" "$label-security" "$site" security "$R" $comprehensive
    $TS "$D/run-tfp175.ts" "$label-accessibility" "$site" accessibility "$R" $comprehensive
done

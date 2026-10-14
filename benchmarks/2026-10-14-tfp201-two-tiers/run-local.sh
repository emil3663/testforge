#!/usr/bin/env bash
# Phase 42 (TFP-201): the coverage map, in two tiers, on one local Toolshop copy (TFP-192's script) - a fresh crawl through the app's crawl
# route and Phase 40's selection unedited (TFP-175's script, as TFP-188 ran it), then the map of Standard's
# suite on Standard's pages. Refuses to run on a working tree with changes to the code under test.
# The copy must be running first: scripts/toolshop-local/start-toolshop.ps1 -Sprint <sprint>.
# Usage (from the repo root): bash benchmarks/2026-10-14-tfp192-coverage-map/run-local.sh <with-bugs|clean> (this folder)
set -eu
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
label=$1
site=http://localhost:4200
R=benchmarks/2026-10-14-tfp201-two-tiers/runs
mkdir -p "$R"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
echo "$label: $(date +%H:%M:%S) crawl ($MEASURE_COMMIT)"
$TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" "$site" "$R"
standard=$(node -e "console.log(require('./$R/$label-selection.json').standard.pages.join(' '))")
echo "$label: $(date +%H:%M:%S) coverage map"
$TS benchmarks/2026-10-14-tfp192-coverage-map/coverage-map.mts "$label" "$site" "$R" $standard
echo "$label: $(date +%H:%M:%S) done"

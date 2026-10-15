#!/usr/bin/env bash
# Phase 42 (TFP-197, Gate B): one Standard run of one local Toolshop copy with the gap writer (run.mts).
# The first run of a copy crawls it through the app's crawl route and keeps Phase 40's selection, unedited
# (TFP-175's crawl-and-select.mts); a later run of the same copy uses that selection again. Refuses to run on a
# working tree with changes to the code under test (src/, scripts/, package*.json), so every run measures a
# commit, and without TESTFORGE_DATA_DIR (one folder outside the repo, shared by both copies; Emil, 2026-10-15).
# The copy must be running first: scripts/toolshop-local/start-toolshop.ps1 -Sprint <sprint>.
# Usage (from the repo root): TESTFORGE_DATA_DIR=<folder> bash benchmarks/2026-10-15-tfp197-gap-writer/run-local.sh <clean|with-bugs> <label>
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
if [ -z "${TESTFORGE_DATA_DIR:-}" ]; then echo "TESTFORGE_DATA_DIR must name the run's data folder, outside the repo" >&2; exit 1; fi
copy=$1
label=$2
site=http://localhost:4200
R=benchmarks/2026-10-15-tfp197-gap-writer/runs
mkdir -p "$R"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
if [ ! -f "$R/$copy-selection.json" ]; then
    echo "$label: $(date +%H:%M:%S) crawl $copy ($MEASURE_COMMIT)"
    $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$copy" "$site" "$R" || exit 1
fi
standard=$(node -e "console.log(require('./$R/$copy-selection.json').standard.pages.join(' '))")
echo "$label: $(date +%H:%M:%S) standard with the gap writer on $standard"
$TS benchmarks/2026-10-15-tfp197-gap-writer/run.mts "$label" "$site" "$R" $standard || exit 1
echo "$label: $(date +%H:%M:%S) done"

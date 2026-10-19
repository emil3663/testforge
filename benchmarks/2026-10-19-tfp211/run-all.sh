#!/usr/bin/env bash
# TFP-211 (Phase 39, Decision 1): every measurement run, one after another, none loading another.
# 1. The fixture (scripts/comparison-fixture.mjs, clean), on port 4410.
# 2. The local Toolshop, with-bugs, then clean: one version at a time (scripts/toolshop-local), Docker Desktop
#    running first. Each start seeds the database again.
# On each: a fresh crawl through the app's crawl route and Phase 40's selection (TFP-175's crawl-and-select.mts),
# then measure.mts: Standard, Comprehensive security and Comprehensive accessibility, three runs each.
# Refuses to run on a working tree with changes to the code under test, so every run measures a commit.
# Usage (from the repo root, in Git Bash): bash benchmarks/2026-10-19-tfp211/run-all.sh
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
B=benchmarks/2026-10-19-tfp211
R=$B/runs
L=$B/logs
mkdir -p "$R" "$L"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
echo "$MEASURE_COMMIT" > "$L/commit.txt"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
step() {
    local name=$1; shift
    date +%s > "$L/$name.start"
    echo "$name: $(date +%H:%M:%S) start"
    "$@" > "$L/$name.log" 2>&1
    echo "exit=$?" >> "$L/$name.log"
    date +%s > "$L/$name.end"
    echo "$name: $(date +%H:%M:%S) $(tail -1 "$L/$name.log")"
}
measure() {
    local label=$1 site=$2
    step "crawl-$label" $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" "$site" "$R"
    step "measure-$label" $TS "$B/measure.mts" "$label" "$site" "$R" 3
}

node scripts/comparison-fixture.mjs --port 4410 > "$L/fixture-server.log" 2>&1 &
fixture=$!
sleep 2
measure fixture http://localhost:4410
kill "$fixture"

for sprint in sprint5-with-bugs sprint5; do
    label=$([ "$sprint" = sprint5 ] && echo clean || echo with-bugs)
    step "start-$label" powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint "$sprint"
    measure "$label" http://localhost:4200
done
step stop powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
echo "all: $(date +%H:%M:%S) done"

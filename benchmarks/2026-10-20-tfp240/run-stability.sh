#!/usr/bin/env bash
# TFP-240's acceptance: Standard on both local Toolshop copies, three runs each, in one session, so the sort check's
# result can be read in every run. Clean first (it is the copy that was unstable), then with-bugs. Each copy: a fresh
# crawl and Phase 40's selection, then TFP-211's measure.mts on Standard alone (the suite generated once, run three
# times, one worker, with the timing reporter). Refuses to run on a working tree with changes to the code under test.
# Usage (from the repo root, in Git Bash, Docker Desktop running): bash benchmarks/2026-10-20-tfp240/run-stability.sh
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
B=benchmarks/2026-10-20-tfp240
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
for sprint in sprint5 sprint5-with-bugs; do
    label=$([ "$sprint" = sprint5 ] && echo clean || echo with-bugs)
    step "start-$label" powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint "$sprint"
    step "crawl-$label" $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" http://localhost:4200 "$R"
    step "measure-$label" $TS benchmarks/2026-10-19-tfp211/measure.mts "$label" http://localhost:4200 "$R" 3 standard
done
step stop powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
echo "all: $(date +%H:%M:%S) done"

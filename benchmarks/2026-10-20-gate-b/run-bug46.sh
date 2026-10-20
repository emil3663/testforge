#!/usr/bin/env bash
# Phase 39 Gate B: bug 46's evidence, A against C. Bug 46 (the product badge's contrast) is found by a manual-review
# item of the axe scan, which the with-bugs half of the session didn't record (its run.mts kept no issues; edc67c0).
# This runs only the axe scans ("passes the WCAG 2.2 A and AA scan") of A's and C's with-bugs Standard suites - the
# session's own suites, unchanged - three rounds, interleaved, with each record's issues, after the session.
# Usage (from the repo root, in Git Bash, Docker Desktop running): bash benchmarks/2026-10-20-gate-b/run-bug46.sh
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
B=benchmarks/2026-10-20-gate-b
R=$B/runs
L=$B/logs
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
for variant in A C; do
    mkdir -p "$R/bug46/$variant"
    cp "$R/$variant/with-bugs-standard-suite.spec.ts" "$R/bug46/$variant/"
done
step() {
    local name=$1; shift
    date +%s > "$L/$name.start"
    echo "$name: $(date +%H:%M:%S) start"
    "$@" > "$L/$name.log" 2>&1
    echo "exit=$?" >> "$L/$name.log"
    date +%s > "$L/$name.end"
    echo "$name: $(date +%H:%M:%S) $(tail -1 "$L/$name.log")"
}
step bug46-start powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint sprint5-with-bugs
step bug46-run $TS "$B/run.mts" with-bugs http://localhost:4200 "$R/bug46" "A:standard;C:standard" 3 "passes the WCAG 2.2 A and AA scan"
step bug46-stop powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
echo "bug46: $(date +%H:%M:%S) done"

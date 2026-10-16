#!/usr/bin/env bash
# TFP-208: the unit and regression criteria again, on a later commit than run-all.sh's: three full unit runs and
# three regression attempts, one after another, into logs/<commit>/. The Toolshop runs are run-all.sh's alone: the
# benchmark driver runs Playwright itself, so a fix to the app's run code doesn't change them.
# Usage (from the repo root): bash benchmarks/2026-10-16-tfp208/run-tests.sh
set -u
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
commit=$(git rev-parse --short HEAD)
L=benchmarks/2026-10-16-tfp208/logs/$commit
mkdir -p "$L"
echo "$commit" > "$L/commit.txt"
step() {
    local name=$1; shift
    date +%s > "$L/$name.start"
    echo "$name: $(date +%H:%M:%S) start"
    "$@" > "$L/$name.log" 2>&1
    echo "exit=$?" >> "$L/$name.log"
    date +%s > "$L/$name.end"
    echo "$name: $(date +%H:%M:%S) $(tail -1 "$L/$name.log")"
}
for n in 1 2 3; do step "unit$n" npm run test:unit; done
for n in 1 2 3; do step "regression$n" npm run test:regression; done
echo "all: $(date +%H:%M:%S) done"

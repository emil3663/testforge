#!/usr/bin/env bash
# Phase 39 Gate B: TFP-212, TFP-213 and TFP-215 against the locked targets, before against after, in one session,
# interleaved, three runs each side, on a quiet machine (the Gate A rules, phase-39-run-concurrency-decision-record.md).
#   A = before (the commit before TFP-212), B = TFP-212 and TFP-213, C = B with TFP-215.
#   Gate B's targets: A against C, Standard and Comprehensive security and accessibility, on both local copies.
#   TFP-215's own bar: B against C, Standard on with-bugs.
# Each variant is a git worktree (node_modules linked to this repo's), so each generates its suites with its own code.
# Per copy (with-bugs, then clean, one version at a time): start it, crawl and select once, inspect once, every
# variant generates its suites from that one inspection, then run.mts runs them, interleaved, three rounds.
# Usage (from the repo root, in Git Bash, Docker Desktop running): bash benchmarks/2026-10-20-gate-b/run-all.sh <A> <B> <C>
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
REPO=$(pwd -W 2>/dev/null || pwd)
B=benchmarks/2026-10-20-gate-b
R=$B/runs
L=$B/logs
mkdir -p "$R/shared" "$L"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
declare -A COMMIT=([A]=$1 [B]=$2 [C]=$3)
printf 'A %s\nB %s\nC %s\nrunner %s\n' "$1" "$2" "$3" "$MEASURE_COMMIT" > "$L/commits.txt"
step() {
    local name=$1; shift
    date +%s > "$L/$name.start"
    echo "$name: $(date +%H:%M:%S) start"
    "$@" > "$L/$name.log" 2>&1
    echo "exit=$?" >> "$L/$name.log"
    date +%s > "$L/$name.end"
    echo "$name: $(date +%H:%M:%S) $(tail -1 "$L/$name.log")"
}
for variant in A B C; do
    tree="../testforge-gate-b-$variant"
    git worktree add --detach "$tree" "${COMMIT[$variant]}" > "$L/worktree-$variant.log" 2>&1 || { echo "worktree $variant failed" >&2; exit 1; }
    # A junction to this repo's node_modules (no admin rights), as check:template-unchanged links its own.
    node -e "require('fs').symlinkSync(require('path').resolve('node_modules'), require('path').resolve('$tree', 'node_modules'), 'junction')" >> "$L/worktree-$variant.log" 2>&1 || { echo "node_modules link $variant failed" >&2; exit 1; }
done
for sprint in sprint5-with-bugs sprint5; do
    label=$([ "$sprint" = sprint5 ] && echo clean || echo with-bugs)
    step "start-$label" powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint "$sprint"
    step "crawl-$label" $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" http://localhost:4200 "$R/shared"
    step "inspect-$label" $TS "$B/inspect.mts" "$label" http://localhost:4200 "$R/shared"
    plan="A:standard,security,accessibility;C:standard,security,accessibility"
    [ "$label" = with-bugs ] && plan="A:standard,security,accessibility;B:standard;C:standard,security,accessibility"
    for variant in A B C; do
        kinds=$(echo "$plan" | tr ';' '\n' | sed -n "s/^$variant://p")
        [ -z "$kinds" ] && continue
        step "generate-$label-$variant" bash -c "cd ../testforge-gate-b-$variant && $TS '$REPO/$B/generate.mts' '$label' http://localhost:4200 '$REPO/$R/shared' '$REPO/$R/$variant' '$kinds'"
    done
    step "run-$label" $TS "$B/run.mts" "$label" http://localhost:4200 "$R" "$plan" 3
done
step stop powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
for variant in A B C; do
    tree="../testforge-gate-b-$variant"
    # The link alone first, so removing the worktree can never reach through it into this repo's node_modules.
    node -e "require('fs').unlinkSync(require('path').resolve('$tree', 'node_modules'))" >> "$L/worktree-$variant.log" 2>&1
    git worktree remove --force "$tree" >> "$L/worktree-$variant.log" 2>&1
done
echo "all: $(date +%H:%M:%S) done"

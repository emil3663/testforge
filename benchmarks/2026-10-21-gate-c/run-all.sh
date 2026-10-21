#!/usr/bin/env bash
# Phase 39 Gate C: one overnight session, interleaved, three runs each, one worker, a quiet machine (Emil, 2026-10-20;
# phase-39-run-concurrency-decision-record.md, "Gate C"). Variants:
#   A  = before TFP-212 (4a85f1f)       C  = Gate B's code (2be975c)      C1 = with TFP-241 (3b1210c)
#   C2 = with TFP-214 (d3e197e)         F  = the final code (TFP-222, TFP-155, TFP-156): run as units, serial second
#   FL = F with the axe scan last (TFP-214's switch, Emil 2026-10-21), generated in F's worktree
# What each comparison needs, and nothing more (the record's trimming rule), per copy:
#   with-bugs: Standard C, C1, C2, F (C against C1, C1 against C2, C2 against F); accessibility A, C2, F, FL
#   clean:     Standard C1, C2, F;                                                  accessibility A, C2, F, FL
# Each variant is a git worktree (node_modules linked to this repo's), so each generates its suites with its own code.
# Per copy (with-bugs, then clean, one version at a time): start it, crawl and select once, inspect once, every variant
# generates from that one inspection, then run.mts runs them, interleaved.
# Plane's testforge-plane-* containers are stopped at the start and restarted at the end. Docker Desktop is not updated.
# Usage (from the repo root, in Git Bash, Docker Desktop running):
#   bash benchmarks/2026-10-21-gate-c/run-all.sh <A> <C> <C1> <C2> <F>
#   DRY=1 bash ... : the dry run, on the comparison fixture: one round, its own folder (dry/), Plane and the Toolshop untouched.
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
REPO=$(pwd -W 2>/dev/null || pwd)
B=benchmarks/2026-10-21-gate-c
DRY=${DRY:-0}
OUT=$B$([ "$DRY" = 1 ] && echo /dry)
R=$OUT/runs
L=$OUT/logs
mkdir -p "$R/shared" "$L"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
declare -A COMMIT=([A]=$1 [C]=$2 [C1]=$3 [C2]=$4 [F]=$5)
TREES="A C C1 C2 F"
ROUNDS=$([ "$DRY" = 1 ] && echo 1 || echo 3)
printf 'A %s\nC %s\nC1 %s\nC2 %s\nF %s\nFL F with the axe scan last\nrunner %s\n' "$1" "$2" "$3" "$4" "$5" "$MEASURE_COMMIT" > "$L/commits.txt"
date +%s > "$L/all.start"
step() {
    local name=$1; shift
    date +%s > "$L/$name.start"
    echo "$name: $(date +%H:%M:%S) start"
    "$@" > "$L/$name.log" 2>&1
    echo "exit=$?" >> "$L/$name.log"
    date +%s > "$L/$name.end"
    echo "$name: $(date +%H:%M:%S) $(tail -1 "$L/$name.log")"
}
machine() {
    echo "--- $1 ($(date '+%a %b %d %H:%M:%S %Z %Y'))"
    echo "--- processes"
    powershell -NoProfile -Command "Get-Process | Group-Object ProcessName | Sort-Object Count -Descending | Select-Object -First 25 | ForEach-Object { '{0,-22} {1}' -f \$_.Name, \$_.Count }"
    echo "--- memory"
    powershell -NoProfile -Command "\$os = Get-CimInstance Win32_OperatingSystem; 'free GB {0:N1} of {1:N1}' -f (\$os.FreePhysicalMemory/1MB), (\$os.TotalVisibleMemorySize/1MB)"
    echo "--- docker"
    docker ps --format '{{.Names}} {{.Status}}'
}
if [ "$DRY" != 1 ]; then
    machine "at start" > "$L/machine-at-start.txt" 2>&1
    docker ps --filter name=testforge-plane- --format '{{.Names}}' > "$L/plane-stopped.txt"
    [ -s "$L/plane-stopped.txt" ] && docker stop $(cat "$L/plane-stopped.txt") >> "$L/plane.log" 2>&1
    machine "after stopping Plane" >> "$L/machine-at-start.txt" 2>&1
fi
for variant in $TREES; do
    tree="../testforge-gate-c-$variant"
    git worktree add --detach "$tree" "${COMMIT[$variant]}" > "$L/worktree-$variant.log" 2>&1 || { echo "worktree $variant failed" >&2; exit 1; }
    # A junction to this repo's node_modules (no admin rights), as check:template-unchanged links its own.
    node -e "require('fs').symlinkSync(require('path').resolve('node_modules'), require('path').resolve('$tree', 'node_modules'), 'junction')" >> "$L/worktree-$variant.log" 2>&1 || { echo "node_modules link $variant failed" >&2; exit 1; }
done
if [ "$DRY" = 1 ]; then
    COPIES="fixture"
else
    COPIES="with-bugs clean"
fi
FIXTURE_PID=""
for label in $COPIES; do
    if [ "$label" = fixture ]; then
        node scripts/comparison-fixture.mjs --port 4471 > "$L/fixture.log" 2>&1 &
        FIXTURE_PID=$!
        sleep 3
        SITE=http://127.0.0.1:4471
    else
        sprint=$([ "$label" = clean ] && echo sprint5 || echo sprint5-with-bugs)
        step "start-$label" powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint "$sprint"
        SITE=http://localhost:4200
    fi
    step "crawl-$label" $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" "$SITE" "$R/shared"
    step "inspect-$label" $TS benchmarks/2026-10-20-gate-b/inspect.mts "$label" "$SITE" "$R/shared"
    plan="C1:standard;C2:standard,accessibility;F:standard,accessibility;FL:accessibility;A:accessibility"
    [ "$label" != clean ] && plan="C:standard;$plan"
    for variant in A C C1 C2 F FL; do
        kinds=$(echo "$plan" | tr ';' '\n' | sed -n "s/^$variant://p")
        [ -z "$kinds" ] && continue
        tree=$([ "$variant" = FL ] && echo F || echo "$variant")
        axe=$([ "$variant" = FL ] && echo last || echo "")
        step "generate-$label-$variant" bash -c "cd ../testforge-gate-c-$tree && $TS '$REPO/$B/generate.mts' '$label' '$SITE' '$REPO/$R/shared' '$REPO/$R/$variant' '$kinds' $axe"
    done
    step "run-$label" $TS "$B/run.mts" "$label" "$SITE" "$R" "$plan" "$ROUNDS"
done
if [ -n "$FIXTURE_PID" ]; then kill "$FIXTURE_PID" 2>/dev/null; fi
[ "$DRY" != 1 ] && step stop powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
for variant in $TREES; do
    tree="../testforge-gate-c-$variant"
    # The link alone first, so removing the worktree can never reach through it into this repo's node_modules.
    node -e "require('fs').unlinkSync(require('path').resolve('$tree', 'node_modules'))" >> "$L/worktree-$variant.log" 2>&1
    git worktree remove --force "$tree" >> "$L/worktree-$variant.log" 2>&1
done
if [ "$DRY" != 1 ] && [ -s "$L/plane-stopped.txt" ]; then
    docker start $(cat "$L/plane-stopped.txt") >> "$L/plane.log" 2>&1
    docker ps --filter name=testforge-plane- --format '{{.Names}} {{.Status}}' > "$L/plane-restarted.txt"
fi
date +%s > "$L/all.end"
echo "all: $(date +%H:%M:%S) done"

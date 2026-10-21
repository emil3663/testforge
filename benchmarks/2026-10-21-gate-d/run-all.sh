#!/usr/bin/env bash
# Phase 39 Gate D (TFP-158, Decision 13): one overnight session, interleaved, three runs each, a quiet machine.
# Variants (run.mts): W1 = this code, 1 worker; WN = this code, the machine's limit; CAP = this code on a capped host
# (3 workers sharing 5 requests per second); A = before TFP-212 (Gate C's accessibility gap); P38B and P38A = Phase 38's
# before (d90de57) and after (d202315), each inspecting with its own code, as TFP-150 did.
# Targets, in order (one Docker site at a time):
#   fixture:      W1, WN: Standard, security, accessibility        (Decision 12: the same results with 1 and N)
#   with-bugs:    W1, WN: Standard, security, accessibility; A: accessibility
#   clean:        W1, WN: Standard, security, accessibility
#   the-internet: W1, WN: Standard, security, accessibility; P38B, P38A: Standard on Phase 38's five paths
#   practicesoftwaretesting.com (hosted): CAP: Standard, security, accessibility, one round, recorded only
# Only the older variants get worktrees (node_modules linked by a Node junction, removed at the end); W1, WN and CAP run
# this repo's code.
# Plane's testforge-plane-* containers are stopped at the start and restarted at the end. Docker Desktop is not updated.
# Usage (from the repo root, in Git Bash, Docker Desktop running):
#   bash benchmarks/2026-10-21-gate-d/run-all.sh <A> <P38B> <P38A>
#   DRY=1 bash ... : the dry run, one round, its own folder (dry/): the fixture, the-internet's local copy, and CAP on
#   the fixture through this machine's LAN address (lan-forward.mjs); Plane, the Toolshop and the hosted site untouched.
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
REPO=$(pwd -W 2>/dev/null || pwd)
B=benchmarks/2026-10-21-gate-d
DRY=${DRY:-0}
OUT=$B$([ "$DRY" = 1 ] && echo /dry)
R=$OUT/runs
L=$OUT/logs
mkdir -p "$R/shared" "$L"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
declare -A COMMIT=([A]=$1 [P38B]=$2 [P38A]=$3)
TREES=$([ "$DRY" = 1 ] && echo "P38B P38A" || echo "A P38B P38A")
ROUNDS=$([ "$DRY" = 1 ] && echo 1 || echo 3)
P38_PATHS="/,/login,/checkboxes,/dropdown,/tables"
printf 'W1 WN CAP %s (this repo)\nA %s\nP38B %s\nP38A %s\nworkers WN %s\n' "$MEASURE_COMMIT" "$1" "$2" "$3" "$($TS -e "import('./src/lib/run/host-limits.ts').then((m) => console.log(m.machineWorkerLimit()))" 2>/dev/null)" > "$L/commits.txt"
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
    echo "--- ollama"
    powershell -NoProfile -Command "if (Get-Process ollama* -ErrorAction SilentlyContinue) { 'running' } else { 'not running' }"
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
    tree="../testforge-gate-d-$variant"
    git worktree add --detach "$tree" "${COMMIT[$variant]}" > "$L/worktree-$variant.log" 2>&1 || { echo "worktree $variant failed" >&2; exit 1; }
    # A junction to this repo's node_modules (no admin rights), as check:template-unchanged links its own.
    node -e "require('fs').symlinkSync(require('path').resolve('node_modules'), require('path').resolve('$tree', 'node_modules'), 'junction')" >> "$L/worktree-$variant.log" 2>&1 || { echo "node_modules link $variant failed" >&2; exit 1; }
done

# One target: crawl and select once, inspect once, generate each variant, then run. $1 label, $2 site, $3 plan,
# $4 rounds; variants named in P38_VARIANTS inspect Phase 38's paths with their own code.
target() {
    local label=$1 site=$2 plan=$3 rounds=$4
    step "crawl-$label" $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" "$site" "$R/shared"
    step "inspect-$label" $TS benchmarks/2026-10-20-gate-b/inspect.mts "$label" "$site" "$R/shared"
    for entry in $(echo "$plan" | tr ';' ' '); do
        local variant=${entry%%:*} kinds=${entry#*:}
        case $variant in
            W1|WN|CAP)
                # One suite set for the variants on this code: W1's, copied to the others, so they run the same files.
                if [ ! -d "$R/W1-$label" ]; then
                    step "generate-$label" $TS "$B/generate.mts" "$label" "$site" "$R/shared" "$R/W1-$label" "standard,security,accessibility"
                fi
                mkdir -p "$R/$variant"
                for kind in $(echo "$kinds" | tr ',' ' '); do cp "$R/W1-$label/$label-$kind-suite.spec.ts" "$R/$variant/"; done
                ;;
            P38B|P38A)
                step "generate-$label-$variant" bash -c "cd ../testforge-gate-d-$variant && $TS '$REPO/$B/generate.mts' '$label' '$site' '$REPO/$R/shared' '$REPO/$R/$variant' '$kinds' '$P38_PATHS'"
                ;;
            *)
                step "generate-$label-$variant" bash -c "cd ../testforge-gate-d-$variant && $TS '$REPO/$B/generate.mts' '$label' '$site' '$REPO/$R/shared' '$REPO/$R/$variant' '$kinds'"
                ;;
        esac
    done
    step "run-$label" $TS "$B/run.mts" "$label" "$site" "$R" "$plan" "$rounds"
}

ALL="standard,security,accessibility"
node scripts/comparison-fixture.mjs --port 4471 > "$L/fixture.log" 2>&1 &
FIXTURE_PID=$!
sleep 3
target fixture http://127.0.0.1:4471 "W1:$ALL;WN:$ALL" "$ROUNDS"
if [ "$DRY" = 1 ]; then
    node "$B/lan-forward.mjs" 4471 4472 > "$L/lan-forward.log" 2>&1 &
    FORWARD_PID=$!
    sleep 2
    target cap-fixture "$(head -1 "$L/lan-forward.log")" "CAP:$ALL" 1
    kill "$FORWARD_PID" 2>/dev/null
fi
kill "$FIXTURE_PID" 2>/dev/null

if [ "$DRY" != 1 ]; then
    for label in with-bugs clean; do
        sprint=$([ "$label" = clean ] && echo sprint5 || echo sprint5-with-bugs)
        step "start-$label" powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint "$sprint"
        plan="W1:$ALL;WN:$ALL"
        [ "$label" = with-bugs ] && plan="$plan;A:accessibility"
        target "$label" http://localhost:4200 "$plan" "$ROUNDS"
    done
    step stop-toolshop powershell -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
fi

step start-the-internet powershell -NoProfile -ExecutionPolicy Bypass -File scripts/the-internet-local/start-the-internet.ps1
target the-internet http://localhost:7080 "W1:$ALL;WN:$ALL;P38B:standard;P38A:standard" "$ROUNDS"
step stop-the-internet powershell -NoProfile -ExecutionPolicy Bypass -File scripts/the-internet-local/stop-the-internet.ps1

# The hosted practice site, capped (Decision 10), last: recorded for its time and requests per second, not judged.
[ "$DRY" != 1 ] && target practicesoftwaretesting https://practicesoftwaretesting.com "CAP:$ALL" 1

for variant in $TREES; do
    tree="../testforge-gate-d-$variant"
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

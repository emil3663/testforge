#!/usr/bin/env bash
# Phase 39 Gate D's re-measurement (Gate D ruling 4, 2026-10-26): one overnight session, interleaved, three runs each, a
# quiet machine, after TFP-157's leak fix (66cd0c0) and D26 (the Toolshop copies in WSL, eed5cac).
# Variants (run.mts): W1 = this code, 1 worker; WN = this code, the machine's limit; W3 = this code, 3 workers, the
# lower local-host limit, when W3=1; CAP = this code on a capped host (3 workers sharing 5 requests per second).
# Targets, in order (one Docker site at a time):
#   fixture:    W1, WN: Standard, security, accessibility     (Decision 13's condition: the same results with 1 and N)
#   with-bugs:  W1, WN (and W3): Standard, security, accessibility
#   clean:      W1, WN (and W3): Standard, security, accessibility
#   practicesoftwaretesting.com (hosted): CAP: Standard, security, accessibility, one round, recorded (ruling 5's number)
# Each Toolshop copy is started fresh, then crawled, inspected and generated on that start (the clean copy reseeds its
# product ids on every start, so a suite is good for the start it was crawled on).
# Plane's testforge-plane-* containers are stopped at the start and restarted at the end. Docker Desktop is not updated.
# Usage (from the repo root, in Git Bash, Docker Desktop running, Ubuntu under WSL with Docker's integration on):
#   W3=1 bash benchmarks/2026-10-27-gate-d-rerun/run-all.sh
#   DRY=1 W3=1 bash ... : the dry run, one round, its own folder (dry/): the fixture, both Toolshop copies, and CAP on the
#   fixture through this machine's LAN address (../2026-10-21-gate-d/lan-forward.mjs); Plane and the hosted site untouched.
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
B=benchmarks/2026-10-27-gate-d-rerun
GD=benchmarks/2026-10-21-gate-d
DRY=${DRY:-0}
W3=${W3:-0}
OUT=$B$([ "$DRY" = 1 ] && echo /dry)
R=$OUT/runs
L=$OUT/logs
mkdir -p "$R/shared" "$L"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
ROUNDS=$([ "$DRY" = 1 ] && echo 1 || echo 3)
ALL="standard,security,accessibility"
LOCAL_PLAN="W1:$ALL;WN:$ALL$([ "$W3" = 1 ] && echo ";W3:$ALL")"
printf 'W1 WN W3 CAP %s (this repo)\nworkers WN %s\nW3 %s\nrounds %s\n' "$MEASURE_COMMIT" "$($TS -e "import('./src/lib/run/host-limits.ts').then((m) => console.log(m.machineWorkerLimit()))" 2>/dev/null)" "$W3" "$ROUNDS" > "$L/commits.txt"
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
    echo "--- noise"
    noise
}
# Background load the session can't subtract (2026-10-27: 7 msedge processes all session; 15 tail | grep pipelines left
# by Gate D's Monitors still running six days later). Lists each with its PID and start time; a monitor armed for this
# session shows here too, so the reader judges which are leftovers.
noise() {
    powershell -NoProfile -Command "\$p = Get-CimInstance Win32_Process; \$e = @(\$p | Where-Object Name -eq 'msedge.exe'); \$m = @(\$p | Where-Object { \$_.Name -in 'grep.exe','tail.exe' -or (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match 'watch|monitor') }); if (\$e.Count) { 'WARNING: {0} msedge processes running (turn off Startup boost and background apps)' -f \$e.Count }; if (\$m.Count) { 'WARNING: {0} grep/tail/monitor processes running (kill leftovers by PID before measuring):' -f \$m.Count; \$m | Sort-Object CreationDate | ForEach-Object { '  {0} {1} {2:yyyy-MM-dd HH:mm:ss} {3}' -f \$_.ProcessId, \$_.Name, \$_.CreationDate, \$_.CommandLine } }; if (-not (\$e.Count + \$m.Count)) { 'none' }"
}
machine "at start" > "$L/machine-at-start.txt" 2>&1
grep '^WARNING' "$L/machine-at-start.txt" >&2
if [ "$DRY" != 1 ]; then
    docker ps --filter name=testforge-plane- --format '{{.Names}}' > "$L/plane-stopped.txt"
    [ -s "$L/plane-stopped.txt" ] && docker stop $(cat "$L/plane-stopped.txt") >> "$L/plane.log" 2>&1
    machine "after stopping Plane" >> "$L/machine-at-start.txt" 2>&1
fi

# One target: crawl and select once, inspect once, generate once, then run every variant on the same files.
target() {
    local label=$1 site=$2 plan=$3 rounds=$4
    step "crawl-$label" $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts "$label" "$site" "$R/shared"
    step "inspect-$label" $TS benchmarks/2026-10-20-gate-b/inspect.mts "$label" "$site" "$R/shared"
    step "generate-$label" $TS "$GD/generate.mts" "$label" "$site" "$R/shared" "$R/suites-$label" "$ALL"
    for entry in $(echo "$plan" | tr ';' ' '); do
        local variant=${entry%%:*} kinds=${entry#*:}
        mkdir -p "$R/$variant"
        for kind in $(echo "$kinds" | tr ',' ' '); do cp "$R/suites-$label/$label-$kind-suite.spec.ts" "$R/$variant/"; done
    done
    step "run-$label" $TS "$B/run.mts" "$label" "$site" "$R" "$plan" "$rounds"
}

node scripts/comparison-fixture.mjs --port 4471 > "$L/fixture.log" 2>&1 &
FIXTURE_PID=$!
sleep 3
target fixture http://127.0.0.1:4471 "W1:$ALL;WN:$ALL" "$ROUNDS"
if [ "$DRY" = 1 ]; then
    node "$GD/lan-forward.mjs" 4471 4472 > "$L/lan-forward.log" 2>&1 &
    FORWARD_PID=$!
    sleep 2
    target cap-fixture "$(head -1 "$L/lan-forward.log")" "CAP:$ALL" 1
    kill "$FORWARD_PID" 2>/dev/null
fi
kill "$FIXTURE_PID" 2>/dev/null

for label in with-bugs clean; do
    sprint=$([ "$label" = clean ] && echo sprint5 || echo sprint5-with-bugs)
    step "start-$label" powershell -NoProfile -File scripts/toolshop-local/start-toolshop.ps1 -Sprint "$sprint"
    target "$label" http://localhost:4200 "$LOCAL_PLAN" "$ROUNDS"
done
step stop-toolshop powershell -NoProfile -File scripts/toolshop-local/stop-toolshop.ps1

# The hosted practice site, capped (Decision 10), last: recorded for its time and requests per second (ruling 5).
[ "$DRY" != 1 ] && target practicesoftwaretesting https://practicesoftwaretesting.com "CAP:$ALL" 1

if [ "$DRY" != 1 ] && [ -s "$L/plane-stopped.txt" ]; then
    docker start $(cat "$L/plane-stopped.txt") >> "$L/plane.log" 2>&1
    docker ps --filter name=testforge-plane- --format '{{.Names}} {{.Status}}' > "$L/plane-restarted.txt"
fi
machine "at the end" > "$L/machine-at-end.txt" 2>&1
date +%s > "$L/all.end"
echo "all: $(date +%H:%M:%S) done"

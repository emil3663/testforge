#!/usr/bin/env bash
# Gate D's re-measurement ruling 4 (Emil, 2026-10-27): the local with-bugs Toolshop, W1 uncapped on loopback against
# the capped row through this machine's LAN address; Standard, security, accessibility; three rounds, interleaved
# (run.mts). One crawl, inspection and generation, on loopback; CAP runs the same suites with the page origin rewritten
# to the LAN address (the API stays at localhost:8091, as the app calls it; run.mts's CAP_DOMAIN says what the cap
# counts). Plane's testforge-plane-* containers are stopped at the start and restarted at the end.
# Usage (from the repo root, in Git Bash, Docker Desktop running, Ubuntu under WSL with Docker's integration on):
#   bash benchmarks/2026-10-27-ruling-4-capped/run-all.sh
#   DRY=1 bash ... : the dry run, one round, its own folder (dry/); Plane untouched.
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
B=benchmarks/2026-10-27-ruling-4-capped
DRY=${DRY:-0}
OUT=$B$([ "$DRY" = 1 ] && echo /dry)
R=$OUT/runs
L=$OUT/logs
mkdir -p "$R/shared" "$R/W1" "$R/CAP" "$L"
export MEASURE_COMMIT="$(git rev-parse --short HEAD)"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
ROUNDS=$([ "$DRY" = 1 ] && echo 1 || echo 3)
ALL="standard,security,accessibility"
LOOPBACK=http://localhost:4200
LAN=$(node -e "const o=require('os').networkInterfaces();const a=Object.values(o).flat().find(e=>e&&e.family==='IPv4'&&!e.internal);if(!a)process.exit(1);console.log(a.address)") || { echo "no LAN IPv4 address" >&2; exit 1; }
CAPSITE=http://$LAN:4200
printf 'W1 CAP %s (this repo)\nloopback %s\ncapped %s\ncap counts %s\nrounds %s\n' "$MEASURE_COMMIT" "$LOOPBACK" "$CAPSITE" "${CAP_DOMAIN:-every request}" "$ROUNDS" > "$L/commits.txt"
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
noise() {
    powershell -NoProfile -Command "\$p = Get-CimInstance Win32_Process; \$e = @(\$p | Where-Object Name -eq 'msedge.exe'); \$m = @(\$p | Where-Object { \$_.Name -in 'grep.exe','tail.exe' -or (\$_.Name -eq 'bash.exe' -and \$_.CommandLine -match 'watch|monitor') }); if (\$e.Count) { 'WARNING: {0} msedge processes running (turn off Startup boost and background apps)' -f \$e.Count }; if (\$m.Count) { 'WARNING: {0} grep/tail/monitor processes running (kill leftovers by PID before measuring):' -f \$m.Count; \$m | Sort-Object CreationDate | ForEach-Object { '  {0} {1} {2:yyyy-MM-dd HH:mm:ss} {3}' -f \$_.ProcessId, \$_.Name, \$_.CreationDate, \$_.CommandLine } }; if (-not (\$e.Count + \$m.Count)) { 'none' }"
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
machine "at start" > "$L/machine-at-start.txt" 2>&1
grep '^WARNING' "$L/machine-at-start.txt" >&2
if [ "$DRY" != 1 ]; then
    docker ps --filter name=testforge-plane- --format '{{.Names}}' > "$L/plane-stopped.txt"
    [ -s "$L/plane-stopped.txt" ] && docker stop $(cat "$L/plane-stopped.txt") >> "$L/plane.log" 2>&1
    machine "after stopping Plane" >> "$L/machine-at-start.txt" 2>&1
fi

step start-with-bugs powershell -NoProfile -File scripts/toolshop-local/start-toolshop.ps1 -Sprint sprint5-with-bugs
step crawl-with-bugs $TS benchmarks/2026-10-07-tfp175-selection/crawl-and-select.mts with-bugs "$LOOPBACK" "$R/shared"
step inspect-with-bugs $TS benchmarks/2026-10-20-gate-b/inspect.mts with-bugs "$LOOPBACK" "$R/shared"
step generate-with-bugs $TS benchmarks/2026-10-21-gate-d/generate.mts with-bugs "$LOOPBACK" "$R/shared" "$R/suites-with-bugs" "$ALL"
for kind in standard security accessibility; do
    cp "$R/suites-with-bugs/with-bugs-$kind-suite.spec.ts" "$R/W1/"
    sed "s#$LOOPBACK#$CAPSITE#g" "$R/suites-with-bugs/with-bugs-$kind-suite.spec.ts" > "$R/CAP/with-bugs-$kind-suite.spec.ts"
done
# The rewrite changes the page origin and nothing else (logged, line counts and remaining loopback references).
for kind in standard security accessibility; do
    echo "$kind: $(diff "$R/W1/with-bugs-$kind-suite.spec.ts" "$R/CAP/with-bugs-$kind-suite.spec.ts" | grep -c '^>') line(s) rewritten; loopback left in CAP: $(grep -c "$LOOPBACK" "$R/CAP/with-bugs-$kind-suite.spec.ts")"
done > "$L/rewrite.txt"
step run-with-bugs $TS "$B/run.mts" with-bugs "$LOOPBACK" "$CAPSITE" "$R" "$ROUNDS"
step stop-toolshop powershell -NoProfile -File scripts/toolshop-local/stop-toolshop.ps1

if [ "$DRY" != 1 ] && [ -s "$L/plane-stopped.txt" ]; then
    docker start $(cat "$L/plane-stopped.txt") >> "$L/plane.log" 2>&1
    docker ps --filter name=testforge-plane- --format '{{.Names}} {{.Status}}' > "$L/plane-restarted.txt"
fi
machine "at the end" > "$L/machine-at-end.txt" 2>&1
date +%s > "$L/all.end"
echo "all: $(date +%H:%M:%S) done"

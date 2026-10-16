#!/usr/bin/env bash
# TFP-208's acceptance runs, one after another so none loads another: three full unit runs, three regression
# attempts, then Standard on both local Toolshop copies (run-local.sh, R1's script). Each step's raw output goes
# to logs/<step>.log, with logs/<step>.start and .end in epoch seconds. Refuses to start on a working tree with
# changes to the code under test, so every run measures a commit (logs/commit.txt).
# Docker Desktop must be running. Usage (from the repo root): bash benchmarks/2026-10-16-tfp208/run-all.sh
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
B=benchmarks/2026-10-16-tfp208
L=$B/logs
mkdir -p "$L"
git rev-parse --short HEAD > "$L/commit.txt"
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
# The answer key, measured: page 1 of hand-tools, asked of the API ten times as the category page asks it.
window() { node -e "(async () => { for (let i = 1; i <= 10; i++) { const r = await fetch('http://localhost:8091/products?by_category_slug=hand-tools&page=1'); const j = await r.json(); console.log(i, j.data.map((p) => p.name).join(' | ')); } })()"; }
step start-with-bugs powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint sprint5-with-bugs
step window-with-bugs window
step bench-with-bugs bash "$B/run-local.sh" with-bugs
step start-clean powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/start-toolshop.ps1 -Sprint sprint5
step window-clean window
step bench-clean bash "$B/run-local.sh" clean
step stop powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/toolshop-local/stop-toolshop.ps1
echo "all: $(date +%H:%M:%S) done"

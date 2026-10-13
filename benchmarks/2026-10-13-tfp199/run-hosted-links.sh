#!/usr/bin/env bash
# TFP-199: the link-destination check (TFP-182), re-run alone on both hosted Toolshops after the
# guard learned to note site beacons. Inspects each site's start page (Phase 40 ranks home first),
# generates Standard's functional suite and runs only "navigation links land where their text
# says", read-only, one worker, Chromium. Refuses uncommitted code under test.
# Usage (from the repo root, in Git Bash): bash benchmarks/2026-10-13-tfp199/run-hosted-links.sh
set -u
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"
if [ -n "$(git status --porcelain --untracked-files=no -- src scripts package.json package-lock.json)" ]; then echo "uncommitted changes in the code under test: commit first" >&2; exit 1; fi
H=$(git rev-parse --short HEAD)
B=benchmarks/2026-10-13-tfp199
export SCRATCH="$B/runs"
TS="node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types"
for pair in "with-bugs https://with-bugs.practicesoftwaretesting.com /#/" "clean https://practicesoftwaretesting.com /"; do
    set -- $pair
    echo "$1: $(date +%H:%M:%S) ($H)"
    $TS benchmarks/2026-10-12-phase41-batch1/run-checks.ts - "$2" "navigation links land" functional "links-$1" "$3"
    node benchmarks/2026-10-12-phase41-batch1/slim.mjs "$B/runs/links-$1-report.json" "$B/runs/links-$1.json" "links-$1" "$2" "$H"
done

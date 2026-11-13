#!/usr/bin/env bash
# Phase 47 (TFP-248): the job summary, from the run's report.json and baseline.json. summary.mjs runs in the image's
# own Node, so the action needs nothing on the runner but Docker. If the image can't start, one line says so.
set -uo pipefail

workspace=${GITHUB_WORKSPACE:-$PWD}
summary=${GITHUB_STEP_SUMMARY:-/dev/stdout}
if ! docker run --rm --user "$(id -u):$(id -g)" \
    --mount "type=bind,src=$workspace,dst=/work" \
    --mount "type=bind,src=$(cd "$(dirname "$0")" && pwd),dst=/action,readonly" \
    --entrypoint node "$IMAGE" /action/summary.mjs "$OUT" "${EXIT_CODE:-2}" "$URL" >> "$summary"; then
    echo "**Mr Onion** on $URL: exit ${EXIT_CODE:-2}, and no summary could be written (the image $IMAGE didn't start)." >> "$summary"
fi

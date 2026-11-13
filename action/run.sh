#!/usr/bin/env bash
# Phase 47 (TFP-248): the action's run. `mr-onion run` in the image, with the workspace mounted where the image
# resolves paths (/work), on the host's network so a server the job started on localhost answers, and as the job's
# own user: what it writes into the workspace stays the job's to read, cache and delete (TFP-247's verification found
# a root-run image's files owned by root). Its exit code goes to the step's outputs; action.yml ends the step with it,
# after the summary and the upload.
#
# Inputs come as INPUT_* variables (action.yml); outside Actions, GITHUB_OUTPUT may be unset.
set -uo pipefail

workspace=${GITHUB_WORKSPACE:-$PWD}
out=${INPUT_OUT:-mr-onion-out}
data_dir=${INPUT_DATA_DIR:-.mr-onion}
output() { echo "$1" >> "${GITHUB_OUTPUT:-/dev/null}"; }

image=${INPUT_IMAGE:-}
if [ -z "$image" ]; then
    # The image this action's own version was released with: the version is package.json's, beside action/.
    version=$(sed -n 's/^  "version": "\([^"]*\)",$/\1/p' "$(dirname "$0")/../package.json")
    if [ -z "$version" ]; then
        echo "::error::mr-onion: couldn't read the action's version; give the image input"
        output "exit-code=2"
        exit 0
    fi
    image="ghcr.io/emil3663/mr-onion:$version"
fi
output "image=$image"
output "out=$out"

args=(run --url "${INPUT_URL:-}" --out "$out" --data-dir "$data_dir")
[ -n "${INPUT_MODE:-}" ] && args+=(--mode "$INPUT_MODE")
[ -n "${INPUT_AREA:-}" ] && args+=(--area "$INPUT_AREA")
[ -n "${INPUT_BASELINE:-}" ] && args+=(--baseline "$INPUT_BASELINE")
[ -n "${INPUT_CONFIG:-}" ] && args+=(--config "$INPUT_CONFIG")
[ "${INPUT_REPORT_ONLY:-false}" = true ] && args+=(--report-only)

# Only the variables named, by name: docker reads each value from this step's environment, so a secret never
# appears on a command line.
env_args=()
env_names=${INPUT_ENV:-}
for name in ${env_names//,/ }; do
    if ! [[ $name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo "::error::mr-onion: \"$name\" in env isn't a variable name"
        output "exit-code=3"
        exit 0
    fi
    env_args+=(-e "$name")
done

# Made here, so they're the job's user's before the run writes into them.
(cd "$workspace" && mkdir -p "$out" "$data_dir")

echo "mr-onion: $image, ${args[*]}"
docker run --rm --init --ipc=host --network host \
    --user "$(id -u):$(id -g)" \
    --mount "type=bind,src=$workspace,dst=/work" \
    "${env_args[@]}" "$image" "${args[@]}"
code=$?
# 125 to 127 are docker's own: the image couldn't be pulled or started, and the run never ran. Above 128 the run was
# killed by a signal (137 out of memory, 143 a cancel). Neither is a verdict: couldn't run.
if [ "$code" -ge 125 ] && [ "$code" -le 127 ]; then
    echo "::error::mr-onion: docker couldn't start $image (exit $code)"
    code=2
elif [ "$code" -gt 128 ]; then
    echo "::error::mr-onion: the run was killed by signal $((code - 128)) (exit $code)"
    code=2
fi
output "exit-code=$code"

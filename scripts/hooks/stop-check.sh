#!/usr/bin/env bash
# TFP-251: Claude Code's Stop hook for this repo (.claude/settings.json). Before an implementing session ends its turn,
# eslint on the changed code files and `tsc --noEmit` on the project; either failing blocks the turn from ending
# (exit 2: Claude Code shows the session stderr and it carries on), so "check before reporting" can't be skipped.
# Measured 2026-10-27 on this machine: tsc 7.2 to 9.4 s, eslint on 3 changed files 4.0 to 4.8 s, 11.8 to 14.2 s together
# (three runs), under the ticket's 30 s, so both run.
# A turn that changed no code file (docs, benchmarks' records) skips both and ends at once.
cd "$(git rev-parse --show-toplevel)" || exit 0
changed=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } \
    | grep -E '\.(ts|tsx|mts|cts|js|mjs|cjs)$' | grep -vE '^benchmarks/.*/(dry/)?runs/' | sort -u \
    | while read -r file; do [ -f "$file" ] && echo "$file"; done )
[ -z "$changed" ] && exit 0
failed=0
lint=$(echo "$changed" | tr '\n' '\0' | xargs -0 npx --no-install eslint --no-warn-ignored 2>&1) || { failed=1; echo "eslint failed on the changed files:" >&2; echo "$lint" >&2; }
types=$(node node_modules/typescript/bin/tsc --noEmit -p . 2>&1) || { failed=1; echo "tsc --noEmit failed:" >&2; echo "$types" >&2; }
if [ "$failed" = 1 ]; then
    echo "TFP-251's stop check: fix the errors above before ending the turn." >&2
    exit 2
fi
exit 0

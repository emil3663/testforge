# TFP-209: the one real gap-writer call (2026-11-02)

The owner's ruling on TFP-209: the gap writer once, gap limit 1, on the local
with-bugs Toolshop, with `--safe-mode`. Done when it returns a gap test and
Claude Code's log shows no CLAUDE.md, memory or hook loaded.

**Code under test:** `2036c1d`. Claude Code 2.1.311, signed in with a
subscription. The request went through `POST /api/generate` (`run.mts`), so
TestForge built the arguments. TFP-197's `claude-logger.mjs` sat in front of
`claude.exe` and added `--debug-file`.

| File | What it is |
| --- | --- |
| `run.mts` | The driver |
| `run/gap-writing.json` | The site suite's record of the gap written |
| `run/claude-calls.json` | Each `claude` process: arguments, usage, reply |
| `run/debug-excerpt.txt` | The log's safe-mode, memory and hook lines. The whole log isn't kept: it lists this machine's permission rules |

## Result

On `/#/` with all ten areas: 28 gaps, 1 asked, 1 saved, 0 rejected, 1 attempt,
$0.066. The saved test is "gap test: Bug Hunting Guide [button] on /#/". The
first try, `/#/contact` with Functional only, had 0 gaps and made no call.

Gap limit 1 made two `claude` processes, as one gap always does: the writing
call, and the generalising call that resumes it (`--resume`). So `--safe-mode`
works with `-p`, `--resume` and `--tools ""` on the real CLI.

## What the log shows

- `Registered 0 hooks from 3 plugins`, and `Skipping plugin hooks - safe mode
  disables installed plugins`. Nothing mentions the `rtk` hook in
  `~/.claude/settings.json`.
- `project memory is off`, each time it was asked.
- No line names a CLAUDE.md or MEMORY.md file.

**The control, without a new call.** Transcripts of two gap-writer sessions on
this machine, both Claude Code 2.1.311 and about the same size:

| Session folder | `--safe-mode` | Bytes | `CLAUDE.md` | `MEMORY.md` | `Emil` | `rtk` |
| --- | --- | --- | --- | --- | --- | --- |
| `testforge-claude-DWZlKJ` (2026-10-27) | no, before TFP-209 | 51,020 | 6 | 6 | 3 | 3 |
| `testforge-claude-ymyq0i` (this call) | yes | 49,649 | 0 | 0 | 0 | 0 |

So a transcript does record this content when it loads. The word "hook" occurs
3 times in this call's transcript, all in Claude Code's own system prompt.

## What still loads

- **Built-in hook modules.** `cc-plugin-agents-md`, `cc-plugin-telemetry` and
  `cc-plugin-plugin-authoring` load and run: "built-in plugins load regardless".
  They ship with Claude Code; `agents-md` found project memory off.
- **User settings are still read,** at least for permissions: "Adding 47 allow
  rule(s) to destination 'userSettings'", and `~/.claude/settings.json` is
  watched. The tools are off, so no rule applies. The file wasn't changed.
- **Managed policy,** none on this machine.

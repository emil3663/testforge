@AGENTS.md

Quality gates, evidence rules and the verification checklist: `docs/QUALITY_GATES.md`.

## Shell output: use RTK

RTK (Rust Token Killer, `github.com/rtk-ai/rtk`) compresses command output
before it reaches the model, so a session uses fewer tokens.

- Prefix shell commands with `rtk`: `rtk git status`, `rtk git log`,
  `rtk tsc`, `rtk eslint`, `rtk playwright test`. With the hook from
  `rtk init -g` installed, ordinary Bash commands are rewritten
  automatically.
- The hook only sees Bash calls. The built-in Read, Grep and Glob tools
  bypass it. For large reads and searches, `rtk read`, `rtk grep` and
  `rtk find` give compact output.
- **Evidence stays unfiltered.** Use `rtk proxy <command>` to get the raw
  output whenever it is evidence in a report:
  - passed, failed and skipped counts, and each skip's reason;
  - `npm run check:template-unchanged`;
  - `git show --stat` for a reported commit.

  A filtered summary is never quoted as a measurement.
- Check it is working with `rtk --version` and `rtk gain`. If `rtk gain`
  fails, the wrong package (crates.io "Rust Type Kit") is installed.
- Installing RTK or running `rtk init -g` changes this machine's
  user-level settings, so ask Emil first.

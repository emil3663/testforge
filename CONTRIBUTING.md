# Contributing to TestForge

Thanks for taking a look. TestForge is maintained by one person and built
in planned phases, so contributions work a little differently from a large
open-source project.

## Issues first, pull requests by invitation

- **Found a bug, a wrong result or a confusing report?** Open an
  [issue](../../issues). That is the most useful thing you can do.
- **Have an idea?** Open an issue describing the problem it solves, not only
  the feature.
- **Want to write code?** Open or comment on an issue first. If it fits the
  current phase, you'll be invited to send a pull request; unsolicited pull
  requests may be closed with a pointer back to the issue. This isn't a
  judgement on the code — every change is planned and measured against a
  phase's decision record, and an unplanned one usually can't be merged as
  it stands.
- **Found a security problem?** Don't open an issue. See
  [`SECURITY.md`](SECURITY.md).

### A good bug report

- the TestForge commit (`git rev-parse --short HEAD`), Node version and OS;
- the site or local target you ran against, the run type (Standard, or
  Comprehensive and its area) and the gate;
- what you expected and what the report said — the run's `run.json` or the
  HTML export helps most;
- whether it happens again on a second run.

**Remove credentials and private site details before you attach anything.**
TestForge redacts credentials in its own outputs, but check.

## Setting up

[`README.md`](README.md) covers prerequisites, installation, the local test
targets and starting TestForge. [`docs/README.md`](docs/README.md) indexes
the rest of the documentation; start with
[`docs/APPLICATION_OVERVIEW.md`](docs/APPLICATION_OVERVIEW.md).

## How work is done here

[`docs/WORKING_AGREEMENTS.md`](docs/WORKING_AGREEMENTS.md) is the full
version. In short:

- **Work is decided before it is built.** Each phase has a decision record
  in `docs/decisions/` with checkable acceptance criteria; tickets are
  numbered `TFP-NNN`. An issue that becomes planned work gets a `TFP-`
  number in its title.
- **Evidence, not assertions.** A change shows its measured result: test
  counts, timings, the template check's output.
  [`docs/QUALITY_GATES.md`](docs/QUALITY_GATES.md) says what counts.
- **The template generator's output doesn't change by accident.** Any
  change near generation runs `npm run check:template-unchanged`, and an
  intended change says so.

### Checks to run before a pull request

```bash
npm run lint
node node_modules/typescript/bin/tsc --noEmit -p .
npm run test:unit
npm run check:template-unchanged -- origin/main   # compares your working tree
npm run test:self            # needs Chromium: npx playwright install chromium
```

### Commits

[Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>): <subject>`, with a body that says why the change was made,
what was considered and rejected, and what it deliberately doesn't do. End
with `Closes #N` when it completes an issue, `Refs #N` for progress on one.

Documentation that describes the change — `TEST_PLAN.md`, the decision
record, the README — is updated in the same commit.

## Licence

TestForge is MIT-licensed ([`LICENSE`](LICENSE)). By contributing, you agree
that your contribution is licensed under the same terms.

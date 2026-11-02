# TFP-217: the nightly's email, sent once by hand (2026-11-02)

**Run:** nightly [41514922513](https://github.com/emil3663/testforge/actions/runs/41514922513),
manual dispatch, on `7671c6e`. All five jobs green; `notify` took 49 s.

| File | What it is |
| --- | --- |
| `rebuilt-message.txt` | The message, rebuilt with `summary.mjs` from the values the Build step logged. **It's not the received email** |

## What the run shows

The send step's log line, whole:

```text
sent: "TestForge nightly: PASS · 7671c6e · 2026-11-02"; accepted 1, rejected 0; 250 2.0.0 OK  1793650655 a92af1059eb24-1ac18458e07sm34549126c88.8 - gsmtp
```

So Gmail's SMTP server logged in with the app password and took the message
for one recipient. That's acceptance, not delivery.

The job outputs arrived: the Build step's logged `NEEDS` holds each job's
`result`, `unit`'s counts (687 tests, 686 passed, 0 failed, 1 skipped) and
`24c4449 -> 7671c6e: 166 inputs, 166 identical, 0 different`. They match the
unit log's own summary.

## The password in the log

The run's whole log, all five jobs, 2,462 lines (`gh run view --log`). The
value isn't known to this check, so it looks where the password would be and
for its shape:

| Check | Result |
| --- | --- |
| Lines naming `TESTFORGE_SMTP_PASSWORD` | 1, the send step's `env:` block, masked: `TESTFORGE_SMTP_PASSWORD: ***` |
| Every other `***` | 15: `token: ***` (10) and git credential commands (5), which are the checkout's token |
| Four groups of four lowercase letters | 3, all ordinary test titles in `unit` |
| 16 lowercase letters on their own | 0 |
| `AUTH PLAIN`, `AUTH LOGIN`, `pass:` or `smtp.gmail` in `notify` | 0 |

A partial value GitHub wouldn't mask, or one that isn't lowercase letters,
would pass the shape checks. Nothing in the code logs the password, and no
debug option is set on the transport.

## Not shown

- **Receipt, shown by the owner, not here.** That inbox can't be read from this
  session. The owner received it from `testforgeapp@gmail.com` to
  `testforgeapp+ci` at 22:17, the body as on the run page, and its link opened
  the run (the review plan's TFP-217 entry).
- **A FAIL email or a cancelled run.** This run passed. Those paths are unit
  tests; `if: always()` under a real cancellation hasn't run on GitHub.
- **The run page's summary,** by this session: GitHub's API doesn't return it.
  It was read in the owner's browser (the same entry).

# TFP-199: the hosted link check, re-run after the guard learned to note beacons

The link-destination check (TFP-182) alone, on both hosted Toolshops, on
`3a8f420` (`run-hosted-links.sh`: a fresh inspection of the start page, the
Standard functional suite generated, only "navigation links land where their
text says" run; read-only, one worker, Chromium). At Phase 41's Gate B it
failed on both sites as a guard breach on Cloudflare's beacon (T33).

| Site | File | Result |
| --- | --- | --- |
| with-bugs.practicesoftwaretesting.com | `runs/links-with-bugs.json` | **Failed, naming bug 29:** `"Home" on /#/ leads to /contact ("Contact"), not the start page` (and "Contakt", bug 31). Note: `aborted 9 site beacon(s), not a breach: POST .../cdn-cgi/rum? (xhr); POST .../cdn-cgi/rum? (ping)` |
| practicesoftwaretesting.com | `runs/links-clean.json` | **Passed.** Note: `aborted 19 site beacon(s), not a breach`, the same two kinds |

Each run's `-report.json` and `.spec.ts` are beside it. `slim.mjs` (batch 1's)
now keeps the `note` annotations the guard writes.

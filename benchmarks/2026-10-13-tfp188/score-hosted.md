# TFP-188: the hosted score, beside the local one

TFP-154's committed rule, Phase 40's selection unedited (`runs-hosted/*-selection.json`:
the same 8 Standard types as TFP-175 on both sites), code `f3fcf9a`, read-only gate,
one worker, Chromium. Raw evidence lines: `evidence-hosted.txt`; the control is the
hosted clean site's run.

**Every bug scores as it did locally (`score-local.md`), with the hosted
site's addresses in the evidence, except one:**

| ID | Local | **Hosted** | Why |
| --- | --- | --- | --- |
| 29 | found | **missed** | the link-destination check failed as a guard breach before it judged any link: `read-only guard breach, aborted: POST https://with-bugs.practicesoftwaretesting.com/cdn-cgi/rum?` - Cloudflare's beacon, sent as the page navigates (T33). Nothing names the Home link |

Bug 80 is found on the hosted API as it was locally:
`https://api-with-bugs.practicesoftwaretesting.com/logs/laravel.log answers 200`.
Bug 4 shows on this load too (category: `"Claw Hammer" has text-align left,
where the other 7 have right`).

**Counts:** found 32, hinted 0, missed 5 (22, 23, 29, 49, 54).
TFP-175's hosted score was 9 found, 4 hinted, 24 missed. Presence on the hosted
site was never checked by hand for most of these; the local copies' verdicts
(Gate A) are the ground truth.

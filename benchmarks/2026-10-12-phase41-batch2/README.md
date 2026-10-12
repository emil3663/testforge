# Phase 41 batch 2: the new checks on the local Toolshops (TFP-186, TFP-187)

Each check of batch 2, run alone on both local copies (TFP-179,
`scripts/toolshop-local/`; Testsmith's repository at `5a6ccc26`), at the
read-only gate, one worker, Chromium, **on committed code**: each file's
`commit` names it. The full re-score with Phase 40's selection is TFP-188's.

Made with batch 1's tools: `../2026-10-12-phase41-batch1/run-checks.ts`
(generates the suite, runs only the new checks) and
`../2026-10-12-phase41-batch1/slim.mjs` (reduces Playwright's report; fixed
here to read each annotation once, as batch 1's files list every finding
and probe note twice).

**Pages:** Standard's selected pages for each copy (Phase 40), inspected
afresh, plus rentals on with-bugs, where Standard's selection has
chainsaws instead (bug 49 is on rentals; see the TFP-186 entry in the Phase
41 record). Clean's product address is taken afresh: the clean copy
re-seeds its database on every start, so its ids change. The with-bugs copy
was started with `6897b1e`'s log fix (the start script confirmed
`/logs/laravel.log` answers with a line written since the start).

## TFP-186: layout, overlap and images (`9a9ac3b`, the same layout code as `085037f`)

| Run | File | Result |
| --- | --- | --- |
| with-bugs, 9 pages | `runs/tfp186-with-bugs.json` | findings: card titles right-aligned among left on home and category (4, random per load), "Slip Joint Pliers"' image hidden (26), the State list's Austria and Netherlands at 13.33 px (59), the Attachment label in Comic Sans and the Subject list's Return at 13.33 px (63, 67), login's e-mail field padding 0 px against 12 (19); across pages, `h5.card-title` centred on rentals (49) and `.btnSubmit` 10% of its container on register and contact against 50% (58, 66). Failures: Add to cart and Add to favourites overlap 50 x 38 px (45); `broken.png` on every page (28 and 30, already found) |
| clean, 8 pages | `runs/tfp186-clean.json` | no failure, no finding |
| clean, 8 pages, on `085037f` | (replaced) | the same: no failure, no finding |

## TFP-187: spelling (`9a9ac3b`)

| Run | File | Result |
| --- | --- | --- |
| with-bugs, 9 pages | `runs/tfp187-with-bugs.json` | "Contakt" on every page (31), "Sorth" (33), "Serch" (34), "Reltded" (42), "Massage" under the label "Message" (62); also "Unsplash" on the product page (T32) |
| clean, 8 pages | `runs/tfp187-clean.json` | one finding: "Unsplash" on the product page, labelled T32 (a brand in a photo credit; the footer's copy isn't read) |

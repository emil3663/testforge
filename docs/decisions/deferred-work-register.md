# Deferred Work Register

Date: 2026-10-19
Status: Living document. Every piece of work a decision record deferred,
parked or left open, in one place, with its source, its status and what it
waits on.
- **Emil's first answers** (2026-10-19) are recorded against each item.
- **Triage:** the items marked **To plan** are triaged with Emil during the
  skills relook (R6), alongside Phase 39.
- **Rule from now on:** a decision record's "Related, deferred" section
  adds a line here in the same commit.

Statuses:
- **To plan:** wanted, not yet in a decision record.
- **To discuss:** needs a conversation with Emil first.
- **Parked:** kept, not planned.
- **Closed:** done, or decided against, with the reason.

## Test suites not yet built

| # | Item | Source | Emil (2026-10-19) | Status | Waits on |
| --- | --- | --- | --- | --- | --- |
| D1 | SEO Standard set (the draft set in the Phase 38 proposal) | Phase 38, deferred | Include | To plan | Phase 39's measurement (no new Standard check until TFP-211 has measured) |
| D2 | Functional checks for the 30 WAI-ARIA APG patterns | Phase 38, deferred | Include | To plan | D1 |
| D3 | The rest of the accessibility and security Standard sets | Phase 38, deferred | Include | To plan | D1, D2 |
| D4 | Comprehensive SEO, then the highest-risk areas from run history | Phase 35, deferred | Include | To plan | D1 |
| D5 | All-areas Comprehensive runs, scheduling, per-area jobs | Phase 35, deferred | Include | To plan | Phase 39 (workers) |
| D6 | Model-written tests counting toward the verdict | Phase 35 Decision 5, deferred | "Depends on what these model-written tests find" | To plan, as a measurement first | Evidence of real finds; Phase 42's candidate gates are the closest rule today |
| D7 | Comprehensive's negative tests, by ISTQB technique, with a technique-coverage measure | Phase 38, deferred | No problems | To plan | Includes scenario #8 (`scenario-gap-candidates-2026-10-19.md`) |
| D8 | The ownership confirmation and the active gate (with the opt-in load-testing run and the script-payload test) | Phase 35 Decision 8; Phase 38 | Handle it so a tester confirms once, not repeatedly | To plan; design proposal below | Nothing; it unblocks D9, D10 and Phase 39's ownership row |
| D9 | INP measured through real interactions | Phase 38, deferred | Needs explaining (below) | To discuss | Phase 41's GET-only interactions, which it could reuse |
| D10 | Authenticated and active security | Phase 35, deferred; GitHub issue #3 | Not sure it should be parked entirely, with the suites being tackled | To plan, with the security sets (D3) | D8 |

## Phases or items not wrapped up

| # | Item | Source | Emil (2026-10-19) | Status |
| --- | --- | --- | --- | --- |
| D11 | Phase 28, OpenAI path: Gate A open, no live completion ever succeeded | Phase 28 | Park | **Parked** (2026-10-19). Revisit if a funded key is used |
| D12 | Phase 29, the crawl skill's drift from `dom-snapshot.ts`, and its live verification | Phase 29 (draft); Phase 22 | Needs to be addressed; discuss | **To discuss** in R6 (below) |
| D13 | Reliability's element-mapping (local model) | Phase 33, open | Needs explaining (below) | Proposed: **Parked** with the local-model path |
| D14 | The database test's skip on pages that save nothing (local model) | Phase 33, open | Needs explaining (below) | Proposed: **Parked** with the local-model path |
| D15 | Template-versus-local-model comparison | Phases 31–33, deferred | Check it | **Closed:** measured in Phase 34 (TFP-120, `phase-34-option-b-measurement-report.md`) and confirmed by Emil 2026-09-28. With page data the model was never called (0 gaps on both targets; 15 of 17 cases identical to the template's suite) |
| D16 | The hollow cookie/session test | Phase 34, deferred | Not a valid test | **Closed:** replaced in Phase 36 (TFP-125) by a check on the site's own session cookies (expiry and scope), skipped with a reason when there are none |
| D17 | Reliability gap-filling (local model) | Phase 34, deferred | Needs explaining (below) | Proposed: **Parked** with the local-model path |
| D18 | A UI control for gap-filling | Phase 34, deferred | Needs explaining (below) | **Closed:** decided against in Phase 34 Decision 9 (confirmed by Emil 2026-09-28). Revisit only if a site shows gaps with page data |
| D19 | The failure-triage gate (real defect, test bug, environment, or inconclusive) | Phase 34, deferred (Martin's review) | Needs explaining (below) | **To discuss** |
| D20 | Skills used as rules at run time, and proving the skills | Phase 36, deferred | Needs explaining (below) | **To discuss** in R6 |
| D21 | TFP-169, the occasional connection reset in a security test | Known-bug backlog | Can we force it? | Open, in TFP-208's scope (below) |
| D23 | `performance-bands.test.ts:69`, a timing test, failed once in TFP-208's check run on `02ed0ef` (the fixture page built for an LCP of about 3 s measured over 4 s, with the machine loaded); passed alone 2 of 2, and in the 6 full runs before | TFP-208's verification (2026-10-19) | — | Open: known flake. TFP-210's nightly run will show its rate; a ticket if it recurs |
| D22 | The real-site backlog's stale header (TFP-162 to 164 shown open) | Real-site backlog | Update it | **Closed** 2026-10-19: header and order list updated (`cefa24d`, `be688d3`, `f4ed183`, `837de4f`, verified 2026-10-07) |

## Explanations Emil asked for

**D8, confirming once.** Proposal for the design:
- Save the confirmation with the site, in TestForge's local data next to
  Phase 42's site suite, not with each run. It records:
  - the hosts it covers;
  - which gates it allows (interactive, active, load testing);
  - the typed statement and the name of the person who confirmed;
  - the date, and an expiry the tester picks.
- Every run on that site uses it without asking. The report names it.
- It asks again only when:
  - a run reaches a host the confirmation doesn't cover;
  - the expiry has passed;
  - a run asks for a gate the confirmation doesn't allow.
- Local hosts need no confirmation.
- A tester can withdraw it at any time.
- Phase 39 Decision 10 already keys its caps on this same confirmation, so
  one confirmation lifts both.

**D9, INP.** Interaction to Next Paint is the Core Web Vital for
responsiveness: the time from a click, tap or key press to the next frame
the browser draws.
- Phase 38 records its bands: 200 ms or less is good, up to 500 ms needs
  improvement, over 500 ms is poor.
- It only exists when someone interacts. So a page load alone can't
  measure it.
- Today Standard records Total Blocking Time as a stand-in, with no pass or
  fail.
- Measuring INP means timing real interactions in the browser. Phase 41
  already performs safe ones (sorts, filters, steppers, tabs), and they
  could be timed.

**D13, D14 and D17, the local-model items.** All three are weaknesses of
the optional local model (Ollama), not of the template:
- **D13:** asked for reliability tests (simulate a failing network request
  and check the page copes), the model aimed them at page elements instead
  of network addresses, for example `**/email-input/**`, or repeated one
  test under element names.
- **D14:** on a sign-in page, which saves nothing, the model ignored the
  rule to skip its database test and invented a sign-up flow.
- **D17:** because of D13, reliability is never handed to the model to
  fill.

The template covers reliability and database itself, and since Phase 34
the model is never called when page data exists. Parking all three with the
local model costs nothing today.

**D19, the failure-triage gate.** A step that judges each failure as a
real defect, a fault in the test, an environment problem or flake, or
inconclusive.
- Each judgement carries a confidence score and a written threshold. Below
  the threshold, a person decides.
- It was deferred because it needed a set of failures already labelled by
  hand. That set now exists: Toolshop's labelled failures from Phase 40 to
  Gate B (TFP-178), and R1's 5 false link failures.
- It's what would have flagged those 5 before a person had to.

**D20, skills at run time.** TestForge's own app reads none of the skills
under `skills/`. Phase 36 asked whether some should become rules the app
applies, for example:
- `honest-coverage`'s "what a green run leaves unknown" added to every
  report;
- `dont-stub-what-you-prove` run as a check on generated suites.

"Proving the skills" is Martin's idea: test each skill against cases with
known answers, as TestForge is tested.

**D12, for the R6 discussion.** The `crawl-and-classify-pages` skill is a
written copy of how `dom-snapshot.ts` classified a page on 2026-09-24:
- It never took in four later changes:
  - per-element visibility;
  - ARIA state;
  - drag-and-drop targets;
  - storage failure points.
- Phases 38 to 42 have changed introspection much more since then: label
  names, controls, `#/` routes, link inventories.
- It has never been run against a live browser.

Options:
1. Sync it, with a "last synced at commit X" marker and a check that warns
   when `dom-snapshot.ts` changes.
2. Make the skill describe the method and point to the code for the rules.
3. Retire it.

**D21, forcing TFP-169.** Probably, yes. TFP-208's fix (`decbfad`) found
that unit tests shared one folder that another run could change mid-start,
which is a likely cause of the same kind of start-up failure. A ticket
could try to reproduce it on purpose:
- start the case while another Playwright run starts on the same folder;
- delay the fixture's start-up;
- reset its first connection through a test-only switch.

If none of these reproduces it on the code after TFP-208, close it as
fixed by `decbfad`, and keep `3b44370`'s diagnostics in place.

## Also tracked elsewhere

- `scenario-gap-candidates-2026-10-19.md`: ten scenarios. #8 sits in D7, #9
  in D10.
- `practice-site-targets-2026-10-19.md`: the practice sites to run against.
- `post-phase-42-review-plan.md`: R5's three decision records (the Docker
  sandbox, app screens, scenario gaps) and TFP-206, TFP-209, TFP-210.
- `phase-39-run-concurrency-decision-record.md`: locked, next after TFP-208
  and TFP-210.

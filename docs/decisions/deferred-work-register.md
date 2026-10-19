# Deferred Work Register

Date: 2026-10-19
Status: Living document. Every piece of work a decision record deferred,
parked or left open, in one place, with its source, its status and what it
waits on.
- **Emil's first answers** (2026-10-19) are recorded against each item.
- **Triage:** done with Emil in Cowork, 2026-10-19. The result is directly
  below; each item's row records his call.
- **Rule from now on:** a decision record's "Related, deferred" section
  adds a line here in the same commit.

## Triage result (2026-10-19)

Each item below gets its own decision record, locked with Emil before Code
builds it. Phase numbers are given as each record is written.

**Build order after Phase 39.** Phase 39 runs as locked. R4's TFP-206 and
TFP-209 come after it, or fit between its gates.
1. **D8:** the ownership confirmation, saved once per site. It opens the
   active gate, and the script-payload test runs again. Its record is
   locked as **Phase 43** (2026-10-19), with tickets TFP-218 to TFP-221.
2. **D1:** the SEO Standard set.
3. **D2:** functional checks for the 30 APG patterns, with **D9** (INP,
   banded findings only).
4. **D3:** the rest of the accessibility and security Standard sets.
5. **D19:** the failure-triage gate.
6. **D10:** authenticated and active security (GitHub issue #3).
7. **D7:** Comprehensive's negative tests by ISTQB technique, with scenario
   #8.
8. **D4:** Comprehensive SEO, then the highest-risk areas from run history.
9. **D5:** all-areas Comprehensive runs, scheduling, per-area jobs.
10. **D24:** the opt-in load-testing run, split out of D8. It needs D8's
    load-testing tick. It is last for now (Emil, 2026-10-19) and moves up
    if it's needed sooner.

**Alongside, in Cowork:**
- R5's three decision records. The scenario-gaps record carries D6 as a
  measurement.
- R6 takes D12 and D20.

**Added after the triage:** D25, a summary email after a site run (below).
It isn't placed in the order yet.

**Every new Standard set (D1, D2 with D9, D3):** Phase 39's rule still
holds. Each record states the set's run-time cost against the margin
measured after Phase 39 (with-bugs at TFP-208: 1,306 s of 1,800 s).

**The rest:**
- Parked: D11, D13, D14, D17.
- Closed: D15, D16, D18, D22.
- Open and watched by TFP-210's nightly run: D21, D23.

Statuses:
- **Planned:** triaged into the build order above; its record isn't
  written yet.
- **To plan:** wanted, not yet in a decision record.
- **To discuss:** needs a conversation with Emil first.
- **Parked:** kept, not planned.
- **Closed:** done, or decided against, with the reason.

## Test suites not yet built

"Order" is the place in the triage result's build order.

| # | Item | Source | Emil (2026-10-19) | Status | Order | Waits on |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | SEO Standard set (the draft set in the Phase 38 proposal) | Phase 38, deferred | Include | **Planned** | 2 | D8, and Phase 39 complete, so its checks are written once on the shared visit (TFP-212). The record copies the draft SEO set from the coverage proposal (Claude Docs, 2026-10-05) into the repo, and states its run-time cost |
| D2 | Functional checks for the 30 WAI-ARIA APG patterns | Phase 38, deferred | Include | **Planned**, with D9 | 3 | D1; TFP-214 (the "in place" kind of control). The record decides whether it ships in batches |
| D3 | The rest of the accessibility and security Standard sets | Phase 38, deferred | Include | **Planned** | 4 | D2. The passive parts need nothing more. Attack-shaped checks sit at the active gate, which D8 opens |
| D4 | Comprehensive SEO, then the highest-risk areas from run history | Phase 35, deferred | Include. Triage: after D7 | **Planned** | 8 | D7; reuses D1's checks. The highest-risk areas are chosen from run history at that point |
| D5 | All-areas Comprehensive runs, scheduling, per-area jobs | Phase 35, deferred | Include | **Planned** | 9 | D4; Phase 39 Gate D (workers) |
| D6 | Model-written tests counting toward the verdict | Phase 35 Decision 5, deferred | "Depends on what these model-written tests find" | **Planned as a measurement** inside R5's scenario-gaps record (triage 2026-10-19). Whether they count is decided from its results | Cowork (R5) | R5's scenario-gaps record; Phase 42's candidate gates are the closest rule today |
| D7 | Comprehensive's negative tests, by ISTQB technique, with a technique-coverage measure | Phase 38, deferred | No problems. Triage: before D4 | **Planned** | 7 | D10. Includes scenario #8 (`scenario-gap-candidates-2026-10-19.md`) |
| D8 | The ownership confirmation and the active gate, with the script-payload test. The load-testing run is split out to D24 | Phase 35 Decision 8; Phase 38 | A tester confirms once, not repeatedly. Triage: see "D8, confirming once" below | **Planned** | 1 | Phase 39 and R4. **Locked** as Phase 43 (`phase-43-ownership-confirmation-decision-record.md`, Emil 2026-10-19; TFP-218 to TFP-221). It unblocks D3's active parts, D10, D24 and Phase 39's ownership row |
| D9 | INP measured through real interactions | Phase 38, deferred | Needs explaining (below). Triage: with D2, banded findings only | **Planned**, with D2 | 3 | D2; Phase 41's GET-only interactions |
| D10 | Authenticated and active security | Phase 35, deferred; GitHub issue #3 | Not sure it should be parked entirely. Triage: the first Comprehensive item | **Planned** (sequence only; no design yet) | 6 | D8, D3, D19. Overlaps scenarios #3, #4 and #9; R5's scenario-gaps record says which side owns each |
| D24 | The opt-in load-testing run, designed with the ISTQB Performance Testing syllabus | Phase 38, deferred; split from D8 (2026-10-19) | Split out of D8. Placed last for now; moves up if needed sooner | **Planned** | 10 | D8's load-testing tick |

## Features asked for, not yet planned

| # | Item | Source | Emil (2026-10-19) | Status | Order | Waits on |
| --- | --- | --- | --- | --- | --- | --- |
| D25 | A summary email after a run against a site, to the tester's inbox, with the way back to the full report | Emil, 2026-10-19, with TFP-217 (the same for TestForge's own nightly CI) | Wanted: a quick view for whoever is in charge of testing that site | **To plan** | Not set | A decision record of its own. It is most useful with D5's scheduled runs. The record decides the questions below |

## Phases or items not wrapped up

| # | Item | Source | Emil (2026-10-19) | Status |
| --- | --- | --- | --- | --- |
| D11 | Phase 28, OpenAI path: Gate A open, no live completion ever succeeded | Phase 28 | Park | **Parked** (2026-10-19). Revisit if a funded key is used |
| D12 | Phase 29, the crawl skill's drift from `dom-snapshot.ts`, and its live verification | Phase 29 (draft); Phase 22 | Needs to be addressed; discuss | **R6** (confirmed 2026-10-19; options below) |
| D13 | Reliability's element-mapping (local model) | Phase 33, open | Needs explaining (below) | **Parked** with the local-model path (2026-10-19) |
| D14 | The database test's skip on pages that save nothing (local model) | Phase 33, open | Needs explaining (below) | **Parked** with the local-model path (2026-10-19) |
| D15 | Template-versus-local-model comparison | Phases 31–33, deferred | Check it | **Closed:** measured in Phase 34 (TFP-120, `phase-34-option-b-measurement-report.md`) and confirmed by Emil 2026-09-28. With page data the model was never called (0 gaps on both targets; 15 of 17 cases identical to the template's suite) |
| D16 | The hollow cookie/session test | Phase 34, deferred | Not a valid test | **Closed:** replaced in Phase 36 (TFP-125) by a check on the site's own session cookies (expiry and scope), skipped with a reason when there are none |
| D17 | Reliability gap-filling (local model) | Phase 34, deferred | Needs explaining (below) | **Parked** with the local-model path (2026-10-19) |
| D18 | A UI control for gap-filling | Phase 34, deferred | Needs explaining (below) | **Closed:** decided against in Phase 34 Decision 9 (confirmed by Emil 2026-09-28). Revisit only if a site shows gaps with page data |
| D19 | The failure-triage gate (real defect, test bug, environment, or inconclusive) | Phase 34, deferred (Martin's review) | Needs explaining (below) | **Planned** (2026-10-19), order 5: after D3, before D10. It is calibrated on Toolshop's labelled failures (TFP-178), R1's 5 false link failures, and the new Standard sets' failures, so it is in place before Comprehensive and the practice sites multiply the failures |
| D20 | Skills used as rules at run time, and proving the skills | Phase 36, deferred | Needs explaining (below) | **R6** (confirmed 2026-10-19) |
| D21 | TFP-169, the occasional connection reset in a security test | Known-bug backlog | Can we force it? | Open. TFP-208 (verified) didn't see it in its 6 runs, nor R1 in its 3; `3b44370`'s diagnostics stay. TFP-210's nightly run watches it alongside D23. Forcing it (below) is a ticket if it recurs |
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

Triage (Emil, 2026-10-19): the proposal stands, with these calls:
- **What it unlocks:** the active gate; load testing, as its own tick; and
  lifting Phase 39's worker and request caps.
  - The interactive gate stays as it is, on `TESTFORGE_INTERACTIVE=1` with
    no confirmation (Phase 38 Decision 1).
- **Expiry:** 90 days by default. The tester may pick another expiry up to
  1 year, and can withdraw it at any time.
- **Load testing is split out** to its own record (D24). D8 covers:
  - the confirmation;
  - opening the active gate;
  - the script-payload test running again.
- **Two locked records get a wording change:** "saved with the run" becomes
  "saved with the site, named in each run's report":
  - Phase 35 Decision 8;
  - Phase 39 Decision 10.

  The behaviour doesn't change. The amendment lands in the same commit as
  D8's record.
- **Practice sites:** a hosted practice site counts as "written
  permission" only when its published terms explicitly allow attack-shaped
  or load testing. Otherwise it stays capped, with no active testing.
  - Local Docker copies need no confirmation, so the practice-site work
    isn't blocked.
- **When:** built straight after Phase 39 and R4, not inside Phase 39.
  - Gate D's remote measurement is on practicesoftwaretesting.com, which
    can't be confirmed.
  - So TFP-157 tests the ownership row with a stub either way, as Phase 39
    already plans.

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

Triage (Emil, 2026-10-19): built with D2. It adds no page visits: it times
Phase 41's interactions and D2's APG checks.
- Each interaction's INP is recorded and banded with Phase 38's bands.
- "Needs improvement" and "poor" are findings, not failures. A scripted lab
  interaction isn't the 75th-percentile field value the bands are defined
  for.
- A failure rule is considered only once measurement shows the numbers are
  stable.

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

**D25, what its decision record has to settle.** TFP-217 emails TestForge's
own CI result from GitHub. A site run is different: it runs in the app, on
the tester's machine.
- **Credentials:** TestForge is local-only (Phase 16). The SMTP sign-in
  lives on the tester's machine, as an environment variable, as Phase 20's
  login credentials do. It is never saved with a run.
- **Recipient:** an address set per site.
  - For Emil's own testing, the default is `testforgeapp+<site>@gmail.com`.
  - That is also the inbox the site's own emails go to (scenario #7), so the
    subject carries a fixed tag a filter can separate.
  - A tester elsewhere sets their own address.
- **"The link to the results":**
  - A local tool's report link (`localhost`) opens only on the tester's
    machine.
  - So the email carries the summary itself (verdict, counts per area, the
    failures by name), plus the saved run's id and the local link.
  - Attaching the HTML export is an option the record weighs against the
    email's size.
- **Redaction:** Phase 20's rules apply. No credential, cookie or
  storageState value appears in any email.
- **When it sends:** after every run, or only scheduled runs (D5), or only
  failures. Emil's call in the record.
- **The confirmer's email (Phase 43, added 2026-10-19):** D8's confirmation
  stores a contact email. D25 uses it three ways:
  - **Default recipient:** the report email goes there unless the site sets
    another recipient. The tester and the confirmer are often different
    people.
  - **Expiry reminder:** a note before the confirmation runs out, so the
    caps and the active gate don't return mid-project unannounced.
  - **Notice of change:** an email to the confirmer whenever a confirmation
    is created or withdrawn. Nobody can then confirm in someone else's name
    without them hearing of it.

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

- `scenario-gap-candidates-2026-10-19.md`: ten scenarios.
  - #8 sits in D7.
  - #9 sits in D10, and #3 and #4 overlap it.
  - R5's scenario-gaps record also carries D6's measurement.
- `practice-site-targets-2026-10-19.md`: the practice sites to run against.
- `post-phase-42-review-plan.md`: R5's three decision records (the Docker
  sandbox, app screens, scenario gaps) and TFP-206, TFP-209, TFP-210.
- `phase-39-run-concurrency-decision-record.md`: locked, next after TFP-208
  and TFP-210.

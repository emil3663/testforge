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

**Build order after Phase 39** (updated 2026-10-20, with R5's three
records placed). Phase 39 runs as locked. R4 comes after it, or fits
between its gates: TFP-206, TFP-209, TFP-216, TFP-217 Part A and TFP-222,
with TFP-222 before Phase 39's TFP-155.

1. **D26: the local copies move into WSL.**
   - Testsmith's checkout moves into WSL's Linux filesystem, so starts
     stop crossing the Windows mount.
   - The workarounds are re-checked.
   - The README's start timings are corrected.
   - Failure sets and score are proven unchanged, and the run times
     become the new baseline.
   - **Moved into Phase 39** by Gate D's ruling 3 (2026-10-26); **built
     and independently verified 2026-10-27**
     (`benchmarks/2026-10-27-d26-wsl/`). The run-time baseline comes from
     Gate D's re-measurement.
**Then, before item 2: Phase 47, TestForge in a target's CI pipeline**
(added 2026-10-27, Emil: after Phase 39, before Phase 43; numbered here
without renumbering the items below, which the tables' Order columns cite).
- Standard, read-only, against an app the CI job starts on `localhost`;
  deployed URLs capped until Phase 43.
- The crawl and generate logic moves into `src/lib/pipeline/` first
  (TFP-263); then the CLI, baselines, a Docker image and a GitHub Action.
- Tickets TFP-263, TFP-245 to TFP-248; TFP-249 after Phase 43 (D31).
- Versioning (TFP-257 steps 1–5) comes before its image.

2. **Phase 43 (D8): the ownership confirmation, once per site.**
   - Saved with the site: exact hosts, contact email, 90-day expiry,
     active and load ticks.
   - It lifts Phase 39's caps.
   - With a run's `TESTFORGE_ACTIVE` switch on, it opens the active gate
     and the script-payload test runs again.
   - Uncovered runs still run, with their active tests Not run.
   - Tickets TFP-218 to TFP-221.
3. **Phase 46: the app screens.**
   - A site lookup by URL, with exact match only, no list of sites and the
     email masked.
   - The confirmation form.
   - The candidate promotion screen: approve, then Claude Code commits.
   - The active switch in the run form.
   - Tickets TFP-232 to TFP-235.
4. **D29: a retention policy for saved runs and their evidence.**
   - How long saved runs and their videos, traces and screenshots are
     kept, and a "clear old runs" action on Phase 46's screens.
   - Its own short decision record with Emil's choices.
5. **D1: the SEO Standard set.** The draft set from the coverage proposal,
   brought into the repo and written once on Phase 39's shared visit.
6. **D2 with D9: the 30 WAI-ARIA APG patterns.**
   - Functional checks for each pattern, shipped in batches if its record
     says so.
   - INP timed on those interactions and Phase 41's, as banded findings
     only.
7. **D3: the rest of accessibility and security Standard.** With **D30**, the solo performance pass.
   - The passive checks need nothing more.
   - The attack-shaped ones sit behind Phase 43's active gate.
8. **D19: the failure-triage gate.**
   - Each failure judged as a real defect, test bug, environment, or
     inconclusive, with a confidence score and a threshold below which a
     person decides.
   - Calibrated on the labelled failures.
9. **D27: TestForge measured against QA My App.**
   - A comparison benchmark on the local Toolshop copies, run once
     Standard is complete (after D3 and D19).
   - Scored with TFP-154's rule against the answer key.
   - Every TestForge miss is tagged "planned in Dx" or "not planned".
     Only the unplanned ones become work, and they can reorder the
     Comprehensive and scenario steps that follow.
10. **D28: a security sweep of TestForge's model-code paths.**
   - Zone by zone, each finding proven by a failing test.
   - Covers the gap writer, candidates and bound candidates,
     TFP-202's code check and stripped environment.
   - Done before Phase 45 builds the sandbox.
11. **Phase 45: the Docker sandbox.**
   - Every model-written test runs in a container: gap tests, candidates
     and scenario tests.
   - Read-only mounts, no secrets, a non-root user.
   - Network only to the run's target hosts.
   - No Docker means they don't run.
   - At most 60 s per run.
   - Tickets TFP-228 to TFP-231.
12. **Phase 44: scenario gaps, slice 1.**
   - Double submit, back-and-resubmit, and retry after a timeout.
   - Built from a vetted harness, with Claude Code's judgement.
   - Each scenario type is proven able to fail on a planted-defect
     fixture.
   - Outside the verdict until measured (D6).
   - Interactive gate, plus the confirmation on remote hosts.
   - Tickets TFP-223 to TFP-227.
13. **D10: authenticated and active security (GitHub issue #3),** with
    Phase 44's slice 2 (two tabs on one account, session expiry mid-flow).
14. **D7: Comprehensive's negative tests.** By ISTQB technique, with a
    technique-coverage measure, including scenario #8 (valid but unusual
    data).
15. **D4: Comprehensive SEO, then the highest-risk areas** from run
    history.
16. **D5: all-areas Comprehensive runs, scheduling, per-area jobs.**
17. **D24: the opt-in load-testing run.** Designed with the ISTQB
    Performance Testing syllabus, and needs Phase 43's load tick. Last for
    now (Emil, 2026-10-19); moves up if needed sooner.

**Not placed yet:** D25, a summary email after a site run. Its record is
still to write.

**Alongside, in Cowork:**
- R5 is done: Phases 44, 45 and 46 locked 2026-10-20.
- R6 is done (2026-10-20): `r6-skills-relook-2026-10-20.md`, tickets
  TFP-236 to TFP-239, built with R4. D12 and D20 are settled there.

**Standing rule (Emil, 2026-10-19):** any site TestForge hosts locally
under Docker keeps its code in WSL's Linux filesystem, not in a Windows
folder mounted into Docker. See D26.

**While the Standard sets are built (D1, D2 with D9, D3): test the section,
not the whole app** (Emil, 2026-10-20).
- **Each set's verification runs only its own section,** a Standard run
  limited to that area, on the fixture and both local Toolshop copies.
  It is not a full Standard run.
- **What still guards everything else:**
  - the unit suite;
  - `check:template-unchanged`, which shows every other section's output
    is unchanged;
  - the nightly run.
- **If a set changes shared code** (the shared visit, the report, the
  selection), the template check shows which other sections' output moved.
  Those sections are run too, and nothing more.
- **Full Standard evidence comes once, after D3.** Either a single full run
  on both copies, or D27's TestForge side, which is a full Standard run on
  both copies anyway. The choice is made when D3 closes.
- **Run time:** each set's run-time cost is measured from its section run and
  added to the margin (below). The full run confirms the total.

**The same rule for the Comprehensive work (Emil, 2026-10-20).** It covers
Phase 44, D10, D7 and D4.
- **Each item is verified with a Comprehensive run of its own area only,**
  on the fixture and both local Toolshop copies. Comprehensive already runs
  one area at a time (Phase 35 Decision 7).
- **The same guards apply:**
  - the unit suite, the template check and the nightly run;
  - any other area whose output moved is run too.
- **Full Comprehensive evidence comes once, with D5.** D5 builds all-areas
  runs, and its first all-areas run on both copies is that evidence.

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
| D6 | Model-written tests counting toward the verdict | Phase 35 Decision 5, deferred | "Depends on what these model-written tests find". Decided 2026-10-20: outside the verdict until measured, per scenario type | **Decided** in Phase 44 Decision 6: a scenario type joins the verdict when every planted defect of its type is found on the fixture and there's no unlabelled failure on clean fixture, clean Toolshop or 3 real sites, with Emil's approval | 9 (with Phase 44) | Phase 44's measurement |
| D7 | Comprehensive's negative tests, by ISTQB technique, with a technique-coverage measure | Phase 38, deferred | No problems. Triage: before D4 | **Planned** | 7 | D10. Includes scenario #8 (`scenario-gap-candidates-2026-10-19.md`) |
| D8 | The ownership confirmation and the active gate, with the script-payload test. The load-testing run is split out to D24 | Phase 35 Decision 8; Phase 38 | A tester confirms once, not repeatedly. Triage: see "D8, confirming once" below | **Planned** | 1 | Phase 39 and R4. **Locked** as Phase 43 (`phase-43-ownership-confirmation-decision-record.md`, Emil 2026-10-19; TFP-218 to TFP-221). It unblocks D3's active parts, D10, D24 and Phase 39's ownership row |
| D9 | INP measured through real interactions | Phase 38, deferred | Needs explaining (below). Triage: with D2, banded findings only | **Planned**, with D2 | 3 | D2; Phase 41's GET-only interactions |
| D10 | Authenticated and active security | Phase 35, deferred; GitHub issue #3 | Not sure it should be parked entirely. Triage: the first Comprehensive item | **Planned** (sequence only; no design yet) | 6 | D8, D3, D19. Overlaps scenarios #3, #4 and #9; R5's scenario-gaps record says which side owns each |
| D24 | The opt-in load-testing run, designed with the ISTQB Performance Testing syllabus | Phase 38, deferred; split from D8 (2026-10-19) | Split out of D8. Placed last for now; moves up if needed sooner | **Planned** | 10 | D8's load-testing tick |

## Features asked for, not yet planned

| # | Item | Source | Emil (2026-10-19) | Status | Order | Waits on |
| --- | --- | --- | --- | --- | --- | --- |
| D26 | The local Toolshop copies move into WSL's Linux filesystem, with the README's start timings corrected | Emil, 2026-10-19, from TFP-211's slow with-bugs start (about 6 min, composer once 10.5 min) | Wanted, after Phase 39; and the rule for every locally hosted site | **Built 2026-10-27, awaiting verification** (`benchmarks/2026-10-27-d26-wsl/`) | Moved into Phase 39 by Gate D's ruling 3 (2026-10-26), before the re-measurement | Phase 39 complete: the move also speeds up the Toolshop's API, so mid-phase it would shift the run times Phase 39 compares. What it covers is below |
| D27 | A comparison benchmark: TestForge against the "QA My App" plugin (Anthropic Directory, community) on the local Toolshop copies | Emil, 2026-10-20 | Wanted: use outside testing tools as yardsticks, not inside TestForge | **Planned** | 8, after D3 and D19, once Standard is complete (Emil, 2026-10-20: earlier, it would mostly point at work already planned) | D26 (both tools run on the WSL setup), D1 to D3, D19. What it covers is below |
| D28 | A security sweep of TestForge's own model-code paths, with the "Verified Security Sweep" plugin (Anthropic Directory, community) or an equivalent review | Emil, 2026-10-20 | Wanted, before the sandbox is built | **Planned** | 9, after D19, before Phase 45 | Nothing; it informs Phase 45's design. What it covers is below |
| D29 | A retention policy for saved runs and their evidence | Emil, 2026-10-21, after 278 MB of leftover run folders were cleared | Wanted: stop cluttering with records and evidence nobody opens | **Planned** | 4, straight after Phase 46 | Phase 46 (the action belongs on its screens). What it covers is below |
| D30 | A solo performance pass, so real sites without the ownership confirmation still get performance judged | Emil, 2026-10-21, after TFP-157's ruling that timed checks are Not run under the request cap | Wanted | **Planned**, with D3 | 7, with D3 | TFP-157 (Phase 39). What it covers is below |
| D25 | A summary email after a run against a site, to the tester's inbox, with the way back to the full report | Emil, 2026-10-19, with TFP-217 (the same for TestForge's own nightly CI) | Wanted: a quick view for whoever is in charge of testing that site | **To plan** | Not set | A decision record of its own. It is most useful with D5's scheduled runs. The record decides the questions below |

| D31 | Active and interactive gates against deployed URLs in CI (TFP-249) | Phase 47, deferred (2026-10-27) | Wanted, after Phase 43 | **Planned** | After Phase 43 | Phase 43, TFP-248 |
| D32 | An npm package for the CI runner | Phase 47 Decision 8 (2026-10-27) | Deferred: the image pins Chromium, npm wouldn't | Open | - | TFP-247 |
| D33 | Models (gap writer, local model, OpenAI) in CI | Phase 47 Decision 9 (2026-10-27) | Off in CI for now | Open | - | Phase 45's sandbox |
| D34 | Comprehensive all-areas runs in CI | Phase 47, deferred (2026-10-27) | Wanted, with D5 | **Planned**, with D5 | With D5 | D5, TFP-248 |
| D35 | Native integrations for other CI systems (GitLab component, Azure DevOps task) and SARIF output for code scanning | Phase 47, deferred (2026-10-27) | Not before someone asks | Open | - | TFP-248 |
| D36 | Workers that back off when a site slows down (adaptive concurrency) | Phase 39 re-measurement ruling 1 (2026-10-27) | Deferred: a fixed limit of 3 holds for now | Open | - | Phase 39 complete |
| D37 | The stale re-check's re-runs judged for cap starvation (it has no timing reporter, so a reused test it re-runs on a capped host keeps its re-run result) | Phase 39 ruling 4 amended (2026-10-28) | Deferred: rare path, documented as a known limitation | Open | - | TFP-264 |

## Phases or items not wrapped up

| # | Item | Source | Emil (2026-10-19) | Status |
| --- | --- | --- | --- | --- |
| D11 | Phase 28, OpenAI path: Gate A open, no live completion ever succeeded | Phase 28 | Park | **Parked** (2026-10-19). Revisit if a funded key is used |
| D12 | Phase 29, the crawl skill's drift from `dom-snapshot.ts`, and its live verification | Phase 29 (draft); Phase 22 | Needs to be addressed; discuss | **Decided** in R6 (2026-10-20): the skill describes the method and points to the code for the rules (`r6-skills-relook-2026-10-20.md`); TFP-237 |
| D13 | Reliability's element-mapping (local model) | Phase 33, open | Needs explaining (below) | **Parked** with the local-model path (2026-10-19) |
| D14 | The database test's skip on pages that save nothing (local model) | Phase 33, open | Needs explaining (below) | **Parked** with the local-model path (2026-10-19) |
| D15 | Template-versus-local-model comparison | Phases 31–33, deferred | Check it | **Closed:** measured in Phase 34 (TFP-120, `phase-34-option-b-measurement-report.md`) and confirmed by Emil 2026-09-28. With page data the model was never called (0 gaps on both targets; 15 of 17 cases identical to the template's suite) |
| D16 | The hollow cookie/session test | Phase 34, deferred | Not a valid test | **Closed:** replaced in Phase 36 (TFP-125) by a check on the site's own session cookies (expiry and scope), skipped with a reason when there are none |
| D17 | Reliability gap-filling (local model) | Phase 34, deferred | Needs explaining (below) | **Parked** with the local-model path (2026-10-19) |
| D18 | A UI control for gap-filling | Phase 34, deferred | Needs explaining (below) | **Closed:** decided against in Phase 34 Decision 9 (confirmed by Emil 2026-09-28). Revisit only if a site shows gaps with page data |
| D19 | The failure-triage gate (real defect, test bug, environment, or inconclusive) | Phase 34, deferred (Martin's review) | Needs explaining (below) | **Planned** (2026-10-19), order 5: after D3, before D10. It is calibrated on Toolshop's labelled failures (TFP-178), R1's 5 false link failures, and the new Standard sets' failures, so it is in place before Comprehensive and the practice sites multiply the failures |
| D20 | Skills used as rules at run time, and proving the skills | Phase 36, deferred | Needs explaining (below) | **Decided** in R6 (2026-10-20): no new run-time rules; each plugin skill proven by known-answer cases through its real invocation (TFP-239) |
| D21 | TFP-169, the occasional connection reset in a security test | Known-bug backlog | Can we force it? | Open. TFP-208 (verified) didn't see it in its 6 runs, nor R1 in its 3; `3b44370`'s diagnostics stay. TFP-210's nightly run watches it alongside D23. Forcing it (below) is a ticket if it recurs |
| D23 | `performance-bands.test.ts:69`, a timing test, failed once in TFP-208's check run on `02ed0ef` (the fixture page built for an LCP of about 3 s measured over 4 s, with the machine loaded); passed alone 2 of 2, and in the 6 full runs before | TFP-208's verification (2026-10-19) | — | Open: known flake. TFP-210's nightly run will show its rate; a ticket if it recurs. **Second timing test, 2026-10-21:** `timing.test.ts`'s "/busy never goes quiet" settle cap (0 capped of 1) failed once in TFP-155's full unit run (`9efbd5f`); passed alone 3 of 3 and in that night's four earlier runs. Likely the same cause: under load the fixture's polling slows past the 500 ms quiet window. One data point each; a recurrence of either gets a ticket, and the fixture's /busy is to be made busy by a mechanism that load can't slow. **Third, not timing, 2026-10-21:** `route.inspect.test.ts`'s closed-port test failed once in a full unit run on `a969cbf` (600 of 601, 1,144 s): `closedPort()` frees a port, and before the browser tried it something else answered there (`ERR_INVALID_HTTP_RESPONSE`, not the `ERR_CONNECTION_REFUSED` it expects). Passed alone 8 of 8, and in that day's other full runs. A recurrence gets a ticket: a port that stays refused, not one freed and hoped for |
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

**D26, moving the local copies into WSL.**

*Why* (as it stood before D26 was built, 2026-10-27). Testsmith's checkout sits in a Windows folder
(`..\practice-software-testing`) mounted into Docker. Every file operation
crosses from Windows into Docker's Linux. The slow steps on each start are:
- Testsmith's `composer` service, with `composer install` and then
  `chown -R www-data /var/www` over all of `vendor/`;
- Angular's `npm install`.

with-bugs waits for composer to finish (bug 80's log folder; see
`scripts/toolshop-local/README.md`). One start took 10.5 minutes, and
TFP-211's took about 6. A first install took 20 to 25 minutes. Docker
recommends keeping bind-mounted code in the WSL filesystem on Windows.

*What the item covers:*
- **The checkout:** a WSL distribution (e.g. Ubuntu), with Testsmith
  cloned there at the pinned commit (`5a6ccc26`).
- **The scripts:** `start-toolshop.ps1` and `stop-toolshop.ps1` point at
  it, through a `\\wsl$\...` path or by calling `wsl docker compose`. A
  start is still one command from PowerShell.
- **The workarounds,** each re-checked and kept or removed with its reason:
  - `COMPOSER_PROCESS_TIMEOUT=0`;
  - the stderr log in `compose.local.yml`;
  - the bug-80 wait and `chown`. Composer's `chown` to uid 82 doesn't
    depend on Windows, so this one probably stays.
- **The proof that only speed changed:** on both copies, Standard's
  failure sets are the same as Phase 39's final runs, test by test. The
  score and every answer-key bug found are unchanged, bug 80 included.
- **Timings:** start times measured and recorded, first install and later
  starts. Run times are re-taken as the new baseline for Phase 43.
- **The README's start timings corrected.** "Later starts: about a minute"
  predates the bug-80 wait (2026-10-13); with-bugs now takes 3 to 10
  minutes. Corrected with the move, with the new numbers.

*The rule from now on* applies to every site TestForge hosts locally under
Docker, such as the-internet's local copy (Phase 39, TFP-158) and the
practice sites (`practice-site-targets-2026-10-19.md`). Its code lives in
WSL's Linux filesystem from the start.

**D27, the comparison benchmark.**

*Why:* TestForge's goal is to find every issue on a site. A comparable tool
run on the same target, with the same answer key, shows what TestForge
misses and what it finds that the other doesn't. That is measured, not
claimed.

*Not inside TestForge:* outside tools are yardsticks only. A third-party
plugin in a run would bring someone else's judgement into the verdict, an
update cycle Emil doesn't control, and licensing questions. Most of these
plugins also work from source code, while TestForge tests from the outside.

*When (Emil, 2026-10-20):* once Standard is complete, after D3 and D19. Run
at step 2 it would mostly point at Standard sets not yet written. Run at the
very end it could no longer change the order.

*What it covers:*
- **The tool:** "QA My App" on local with-bugs and clean. It reads the
  source, which the local copies have, and drives the pages in a browser.
- **The score:** with TFP-154's rule against
  `benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md`. Every
  difference between the two tools is listed, bug by bug.
- **Each TestForge miss is tagged** against this register: "planned in Dx
  (or Phase N)" or "not planned". Only the unplanned misses become tickets or
  register items. They can reorder the Comprehensive and scenario steps that
  follow (Phase 44, D10, D7, D4).
- **What else is recorded:** each tool's false failures on clean, its run
  time, and its cost.
- **Where it runs:** local copies only, never a hosted site (Phase 43's
  rule).
- **Before installing:** read its permissions. Its access is marked
  "privileged": its own agents and hooks run on Emil's machine, and it can
  file defects to GitHub, which is turned off for the benchmark.
- **The output:** a short report under `benchmarks/`, with what TestForge
  should take from it, ticketed or added here.
- **Later:** "E2E Test Generator" against `write-playwright-test`, and "A11y
  Enforcer" against D3's accessibility set, the same way, if D27 proves
  useful.

**D28, the security sweep of the model-code paths.**

*Why:* model-written tests turn text read from a site into code that runs on
Emil's machine (Phase 42, batch 2 ruling 5). TFP-202 hardened that path. A
review that proves each finding with a failing test checks the hardening
before Phase 45 contains it and Phase 44 puts it to real use.

*What it covers:*
- **The zones:**
  - `src/lib/gap-writer/` (the writer's call, `code-check.ts`, `gap-run.ts`);
  - `src/lib/candidates/` (binding and applying);
  - `src/lib/run/child-env.ts`;
  - the paths that read model output back into reports.
- **Each finding:**
  - verified on the cited lines;
  - reproduced by a failing test;
  - recorded in a short register of what was reviewed and what was found.
- **The tool:** the "Verified Security Sweep" plugin, after reading its
  permissions, or the same procedure by hand. Code runs it; nothing is
  fixed in the sweep itself.
- **The output:** fixes become tickets before or inside Phase 45, and
  anything that changes the sandbox's design goes to Emil first.

**D29, retention for saved runs.**

*Why (2026-10-21):*
- `runs/` holds 1,410 saved runs, 684 MB (652 MiB), kept forever.
- Half are under 46 KB and three quarters under 144 KB, but a run with
  failures carries videos and traces: two exceed 100 MB, the largest
  131 MB.
- Many are development and benchmark runs nobody reopens.
- A tester using TestForge daily meets the same growth.
- (The 278 MB cleared from `.playwright-runs` the same day was a different
  thing: the evidence folders of runs never saved, none of the 505 a saved
  run's id, and loose run files from before TFP-222's run folders. Its
  remaining leak is TFP-242, in R4.)

*What its decision record settles (Emil's choices):*
- **How long runs are kept:** for example, the last N runs per site, plus
  runs Emil pins.
- **Whether heavy evidence ages out sooner than the run:** for example,
  failure videos deleted after X days, traces and screenshots kept.
- **What is never removed:** runs a baseline, a benchmark or a candidate's
  evidence points to.
- **How it's done:** a "clear old runs" action on Phase 46's site lookup or
  run list, showing what it would remove before removing it. And whether it
  also runs automatically.
- **Where the record lives:** `runs/` sits in the repo folder (gitignored).
  Phase 42's data folder (`TESTFORGE_DATA_DIR`) is where it belongs for a
  tester's install.

**D30, the solo performance pass.**

*Why (2026-10-21):*
- TFP-157 (Emil's ruling) makes the timed checks Not run on a capped host:
  load time, LCP, CLS and TBT, "not judged under the request cap", because
  the cap slows the loads they measure.
- So on any real site without Phase 43's confirmation, which is most
  real-site runs, Standard judges no load timing. Page weight and failed
  same-origin requests still run, as they don't depend on load speed.

*What it covers:*
- **A pass of its own:** the timed checks run after the rest of the run.
- **One visitor's load:** one worker, one page load at a time.
- **Uncapped for that load only:** the load one real visitor makes, which
  the cap's purpose (politeness, not the load of an attack) allows.
- **Measured before use:** on the local Toolshop and the capped hosted
  practice site. The results must match an uncapped run of the same
  checks within their bands' spread.
- **Designed with D3,** the rest of the Standard sets. D24's load-testing
  record must not overlap it.

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

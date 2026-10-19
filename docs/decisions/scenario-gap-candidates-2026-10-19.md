# Scenario Gap Candidates (2026-10-19)

Date: 2026-10-19
Status: Emil's list, kept as input for R5's third decision record, *scenario
gaps* (`post-phase-42-review-plan.md`). Nothing here is decided or built.
Coverage was checked by Cowork against the code at `60c1fc4`, `TEST_PLAN.md`,
and the Phase 35 and 38 records.

## Coverage today

None of the ten is covered. TestForge's state-changing tests today are:
- the journey tests and the database round trip, at the interactive gate,
  each submitting once with plain values;
- dependency failure injection (Phase 18), which blocks a request the page
  makes and checks the page copes. It touches the user-visible side of 7.

Phase 35 deferred "authenticated security (logout, session changes, access
between two accounts)", which overlaps 3, 4 and 9.

| # | Scenario | Covered? | Gate | What a test needs |
| --- | --- | --- | --- | --- |
| 1 | Double submit ("Pay" twice on a slow network) | No | interactive or higher | Slow the response (`page.route`), click twice, count the create requests sent and the records that result |
| 2 | Back after submit, then resubmit | No | interactive or higher | Submit, `goBack()`, submit again; check for a duplicate or a clear refusal |
| 3 | Two tabs, one account (address changed in one, order placed in the other) | No | interactive, signed in | Two pages in one browser context; check which value the order used |
| 4 | Session expires mid-flow | No | interactive, signed in | Clear the session cookie or storage before submit, as a stand-in for a real timeout (record it as one); check data lost, kept or half saved |
| 5 | Time zones and midnight cut-offs | No | read-only (client side); owner facts (server side) | Playwright's clock and `timezoneId` for what the browser shows; the server's cut-off needs the owner to name the offer and its end time |
| 6 | Retry after a timeout: did the first request go through? | No | interactive or higher | Let the request reach the server, then drop its response (`route.fetch()` then abort); check for a duplicate after the app retries |
| 7 | Partial failure (order made, email service down) | Partly: dependency failure injection, UI side only | interactive or higher | Fail the email-side call where the browser can see it; "does it fix itself later" needs a later check, e.g. TestForge's own test inbox (`testforgeapp+<site>@gmail.com`) |
| 8 | Valid but unusual data (apostrophes, emoji, very long addresses, country codes) | No (Comprehensive's "bad data, special characters" is planned, not built) | interactive for the round trip; read-only for client-side validation | Deterministic: the database round trip and form tests with values such as `O'Brien`, an emoji, a 255-character address, `+27 82 …`; check they're accepted and come back intact |
| 9 | Permissions removed while signed in | No | interactive, two accounts | An admin account and a user account, a site-specific setup; the user's next save must fail |
| 10 | Old data meeting new code | No | interactive, across runs | A record created by an earlier run and edited by a later one after a release, which Phase 42's kept site suites make possible |

## Notes for the decision record

- **Most of these change data.** Placing orders or payments, even on a
  practice site, is beyond "submitting a form with valid data". The decision
  record must say whether they sit at the interactive gate or need the
  owner's sign-off (Phase 35 Decision 8, not built yet).
- **8 is the cheapest and most generic.** It's deterministic, works on any
  site with a form, and extends tests that exist. It could be a template
  set rather than a scenario gap.
- **1, 2 and 6 share one mechanism:** control the network, then count
  requests and resulting records. Built once, it covers all three.
- **3, 4 and 9 need signed-in state,** and 9 needs two accounts. They fit
  Phase 35's deferred authenticated security.
- **5, 7 (later) and 10 need facts or time** that a single black-box run
  doesn't have:
  - an offer's end time from the owner;
  - an inbox checked later;
  - a record kept from an earlier release.
- **Phase 39 shared pages:** all ten change state, so under Phase 39
  Decision 5 they keep their own fresh page.

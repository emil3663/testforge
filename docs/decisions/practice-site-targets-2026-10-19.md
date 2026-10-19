# Practice Site Targets (2026-10-19)

Date: 2026-10-19
Status: Emil's goal, kept for planning. Nothing is decided or built.
- **Goal (Emil):** TestForge can run against every site below and, in time,
  produce the tests that find all the issues each one contains.
- **Read with:** `scenario-gap-candidates-2026-10-19.md` (the same day's
  scenario list), and the Toolshop answer key
  (`benchmarks/2026-10-06-toolshop-known-bugs/answer-key.md`), which is the
  model for measuring any of these.

## The sites

| Site | What it offers | Kind | Sign-in | Notes for TestForge |
| --- | --- | --- | --- | --- |
| The Internet (herokuapp) | Isolated pages: dynamic loading, shadow DOM, iframes, file upload, broken images, basic auth | Mechanics, a few deliberate faults | Basic auth on one page | Used before: Phase 38's TFP-150 (hosted, couldn't be measured); Phase 39's TFP-158 plans a local Docker copy |
| SauceDemo (Swag Labs) | Shop: log in, sort, cart, checkout | Flows, with special users that behave wrongly on purpose | Published demo users | Checkout is a full end-to-end flow; the faulty users give it an answer key to build |
| UI Testing Playground | Timing: AJAX, client delays, progress bars, changing IDs, hidden layers | Mechanics | None | Each page is a challenge to a test's waits and locators, not a bug |
| DemoQA | Drag and drop, autocomplete, modals, nested menus, complex forms | Mechanics, plus a broken links and images page | Optional | Already in the repo as `src/lib/generate/mock/demoqa-suites.ts` |
| ParaBank (Parasoft) | Banking: register, accounts, transfers, loans | Business logic | Registration, which the site invites | Data-changing flows: interactive gate at least |
| OrangeHRM demo | HR: employees, recruitment, CRUD | Enterprise CRUD | Shared public demo account | Shared with every visitor, so CRUD changes data others see; prefer a local copy (it's open source) |
| ReqRes | REST API with user data | API only | API token for some calls | TestForge has no API-only mode today |
| Restful-Booker | Hotel booking API, stateful chaining | API only | Token from its auth call | Same; check whether it ships deliberate bugs before building an answer key |

## What "find all the issues" needs per site

1. **An answer key,** as TFP-153 made for Toolshop: each known issue, where it
   is and how it shows, from the site's own documentation or source.
   - Sites without deliberate bugs (UI Testing Playground, most of The
     Internet and DemoQA) get a different key: the mechanics a suite must
     handle without false failures or missed elements.
2. **A local copy where one exists.** That gives repeatable runs, no load on
   someone's public site, and data TestForge may change. Toolshop's
   `scripts/toolshop-local/` is the pattern.
3. **The gates.**
   - Practice sites use their published demo accounts.
   - Register only where the site invites it.
   - Hosted runs follow Phase 39's host caps.
4. **A score per site,** with TFP-154's rule, so progress is measured, not
   claimed.

## Capabilities it would take (not yet planned)

- **Signed-in flows end to end:** SauceDemo checkout, ParaBank transfers,
  OrangeHRM CRUD. These use Phase 20's login and the interactive gate.
- **Mechanics TestForge may not inspect today:** shadow DOM, iframes, file
  upload, basic auth, drag and drop. Each needs a check that its inspection
  and locators reach inside.
- **API testing,** for ReqRes and Restful-Booker. This is a new kind of
  target: endpoints instead of pages, and a decision of its own.
- **Several of the scenario gaps** (double submit, back and resubmit,
  sessions) apply directly to SauceDemo and ParaBank.

## Suggested order, for when it is planned

1. **The sites TestForge already half-reaches:** The Internet (local copy,
   with Phase 39), DemoQA, and UI Testing Playground. Read-only, no
   accounts; they test the inspection and the waits.
2. **SauceDemo,** with an answer key built from its special users.
3. **ParaBank and a local OrangeHRM,** with the interactive gate and the
   scenario gaps.
4. **ReqRes and Restful-Booker,** after an API-testing decision record.

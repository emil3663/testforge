# Phase 35 Measurement Report — Comprehensive Testing, First Slice

Date: 2026-10-01
Ticket: TFP-136 (Acceptance Criteria 2, real site, and 6)
Evidence: `benchmarks/2026-10-01-phase35-first-slice/` — every run's full
result as `/api/run` returned it, plus the generate answer for Comprehensive
runs.
Setup: my `next start` on `127.0.0.1:3100` (production build of `198dbec`),
no local model configured unless stated, Emil's machine (Windows), one run
per row.

## Bottom line

- **No false failure on the real site.** The first passive-security run on
  the-internet failed 5 of 20 pages. Read page by page, none was an exposure:
  all 5 were template errors. They are fixed in `198dbec` and recorded in the
  labelled failure set as T13 to T17. The run after the fix has no failure.
  Its 85 findings match the site's real response headers.
- **Accessibility on the real site: 20 failures, all real.** Each was
  confirmed by measuring or reading the page (labelled set R4 to R9). The
  Standard accessibility run on the same site passed all 42 of its tests.
- **A Comprehensive run is quick on a small site and slower on a large one.**
  On the 3-page fixture, every run took about 5 seconds. On the-internet at
  the 20-page cap, security took 224 s and accessibility 155 s. Most of that
  is page loads, one at a time.
- **The roadmap's open timing question is answered for one area**, below. An
  all-areas run was not measured: all-areas runs stay deferred.

## Durations (Acceptance Criteria 6)

"Run" is the Playwright run as `/api/run` timed it. "Total" adds page
inspection and generation, measured from the client.

| Target | Run | Pages | Tests | Run | Total | Per page |
| --- | --- | --- | --- | --- | --- | --- |
| Fixture | Standard security | 3 inspected | 3 | 3 s | 10 s | — |
| Fixture | Comprehensive security (passive) | 3 + probe | 13 | 5 s | 8 s | ~1.7 s |
| Fixture | Standard accessibility | 3 inspected | 7 | 4 s | 10 s | — |
| Fixture | Comprehensive accessibility | 3 | 6 | 5 s | 9 s | ~1.7 s |
| the-internet | Standard security | 2 inspected | 4 | 11 s | 21 s | — |
| the-internet | Comprehensive security (passive) | 20 (cap) + probe | 81 | 224 s | 231 s | ~11 s |
| the-internet | Standard accessibility | 2 inspected | 42 | 131 s | 140 s | — |
| the-internet | Comprehensive accessibility | 20 (cap) | 40 | 155 s | 160 s | ~7.8 s |

- A Comprehensive security page costs 4 page loads, one test at a time on
  one worker. On the-internet, which answers from Heroku, that is about 11 s
  a page. The accessibility scan costs one load plus axe, and TFP-121's
  check costs another load: about 7.8 s a page.
- At the default cap, a Comprehensive run on a real site takes about 3 to 4
  minutes per area. The roadmap's earlier figure was 70-80 s for ~30 Standard
  tests. A Comprehensive area run is about 3 times that, and covers 20 pages
  instead of 1 to 3.
- **With the local model configured** (`testforge-qwen7b`, C8), generation
  adds the model call. On the fixture it took 78 s (security; suite accepted)
  and 131 s (accessibility; rejected at the type check). See TEST_PLAN
  GEN-62, and `model-*.json` in the evidence folder.

## Passive security on the-internet (Acceptance Criteria 2, real site)

**Before the fix**, run `aeb33b15` (`before-fix-security-the-internet.json`):
5 failures, all from the "page responds" assertion, all filed under A02.

| Page | Answer | Read by hand | Verdict |
| --- | --- | --- | --- |
| `/basic_auth`, `/digest_auth`, `/download_secure` | HTTP 401 | Behind HTTP authentication. Refusing is the server working. | Template error (T13 to T15) |
| `/add_remove_elements` | HTTP 404 | The site graph normalises the path. The real page is `/add_remove_elements/` (200). | Template error (T16) |
| `/authenticate` | HTTP 404 | `/login`'s POST target, known only from a form-submit edge. Not a page. | Template error (T17) |

**Fix (`198dbec`):**
- A page known only from the crawl is now loaded by the href a link to it
  really uses.
- Form-only targets are not loaded.
- A page answering 400 or more is now "Not run", with the reason, never
  failed. Its version check still reads the response's headers.

**After the fix**, run `12e385fb` (`security-none-the-internet.herokuapp.com.json`):
- **0 failures** across 20 pages plus the missing-page probe.
- 72 passed and 9 not run: the 3 pages behind a login, 3 checks each.
- 85 findings, all A02. These are 5 on each of the 17 pages that load: no
  Content-Security-Policy, X-Frame-Options without `frame-ancestors`, no
  referrer policy, no HSTS, and `rack.session` without Secure.
- Checked against `curl -I` of `/`. The response sends `X-Frame-Options:
  SAMEORIGIN`, `X-Content-Type-Options: nosniff` (correctly no finding), and
  `Set-Cookie: rack.session=…; path=/; HttpOnly` (no Secure), with no CSP,
  Referrer-Policy or Strict-Transport-Security.
- The missing-page probe passed: the site's 404 shows no stack trace or file
  path.
- ASVS chapters tested in the run: V3, V12, V13, V14, V16.
- 25 known pages beyond the cap are named as not covered.

## Accessibility on the-internet

Run `84094801` (`accessibility-none-the-internet.herokuapp.com.json`):
- 20 failures on 17 of 20 pages.
- 3 pages not run, because they are behind a login.
- 0 findings, and 20 items listed for manual review.

Every failure was confirmed against the page:

| Failure | Pages | Evidence | Labelled |
| --- | --- | --- | --- |
| color-contrast (serious, WCAG 1.4.3) | 17 | Every flagged element is `rgb(43,166,203)` with white, at 2.83:1. That is under 4.5:1 for normal text, and under 3:1 even for the 32px "Login" heading. | R4 |
| image-alt (critical, 1.1.1) | `/broken_images`, `/dynamic_content` | `<img>` with no `alt` | R5 |
| label (critical, 4.1.2), and TFP-121's check | `/checkboxes` | Text beside the box, no label | R6 |
| select-name (critical, 4.1.2), and TFP-121's check | `/dropdown` | No `<label>` on the page | R7 |
| label (critical, 4.1.2), and TFP-121's check | `/dynamic_controls` | Checkbox and text input unlabelled | R8 |
| list (serious, 1.3.1) | `/disappearing_elements` | A `<ul>` directly inside a `<ul>` | R9 |

The Standard accessibility run on the same site (`98cfc51f`) passed all 42 of
its tests: its hand-written checks look at roles, names and focus of the
inspected elements. It is not a WCAG scan, and on this site it missed all of
the above.

## Fixture results (from TFP-133 and TFP-134)

- **Clean:** no failure in either area. Security has 12 header findings (the
  fixture sends no security headers). Accessibility has no findings and no
  items for review.
- **Security:** each passive defect fails or is a finding as Decision 3
  sets, naming the page and the element (TEST_PLAN GEN-59). A password on
  plain HTTP can't be injected on loopback; reached as
  `http://localtest.me:4410`, `/login` fails as designed.
- **Accessibility:** a missing alt, low contrast and an unlabelled field
  fail as critical, serious and critical, each under its WCAG criterion and
  naming the element (GEN-61).

## Caveats

- **One run per row.** Network time to the-internet varies, so these are
  single samples, not medians.
- **The cap shapes the numbers.** The-internet links to 45 pages. 20 were
  covered and 25 were named as not covered. The duration scales with the
  cap, at roughly 11 s (security) or 8 s (accessibility) per page there.
- **Measured without the local model**, so generation time is the
  template's. The model's time is reported separately above.
- **Not measured:** all-areas runs, which remain deferred.

## Roadmap

`product-roadmap.md`'s Phase 35 "Still open: timing" bullet is replaced with
these measurements.

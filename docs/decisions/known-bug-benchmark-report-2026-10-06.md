# Known-Bug Benchmark Report: the Toolshop (TFP-154)

Date: 2026-10-06
Ticket: TFP-154 (`known-bug-benchmark-backlog-2026-10-06.md`, Decisions 1 to 4)
Evidence: `benchmarks/2026-10-06-toolshop-known-bugs/runs/`, holding each
run's suite, Playwright report and records, plus `run-tfp154.ts`,
`diff-runs.mjs` and `which-run.mjs`. The scoring rule and page set
(`scoring-rule.md`) were committed before the first run (`91a7141`).
Setup: code at `26fed09`, Emil's machine, Chromium, read-only gate
(`TESTFORGE_INTERACTIVE=0`), one worker.

## Bottom line

- **Of the 37 bugs in reach (read-only, visible in Chromium), TestForge
  found 6, hinted at 3 and missed 28.**
  - **Found:** the missing Chainsaws route (3), the two broken images on
    home (28, 30), low link contrast (85), the login fields named only by
    placeholders (87) and the unlabelled home search field (93).
  - **Hinted:** the sort control (33), the contact subject list (60) and
    the product images' missing alt text (92).
- **The misses group cleanly:**
  - 13 are visual or layout, and there is no visual check;
  - 5 are typos, and there is no spelling check;
  - 4 are controls that load but do the wrong thing;
  - 3 are accessibility problems axe can't judge or a run didn't reach;
  - 3 are read-only security probes the passive checks don't make.
- **A measured gap of its own: the generated checks don't wait for a
  hash-routed page to draw.** TFP-165 added the wait to the crawl and
  inspection, not to the tests. At the load event the product page is only
  its header and footer. So the product page's own bugs (91, 92's images,
  46) weren't read. TFP-160's and TFP-151's form lookups also failed: on every
  clean-site form (7 checks) and on the with-bugs login form (T25). The same race made the clean
  control uneven, so shared failures were confirmed by hand.
- **Every with-bugs failure that matches no bug is labelled:**
  - 5 template errors (T25 to T29);
  - 3 real defects that aren't listed bugs (R13 to R15);
  - 1 unclear (U4);
  - plus the existing U2 and U3 patterns.

## Runs

| Site | Run | Pages | Tests | Passed | Failed | Not run | Run time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| with-bugs | Standard, all 10 areas | 5 | 288 | 235 | 47 | 6 | 766 s |
| with-bugs | Comprehensive security (passive) | 9 | 37 | 37 | 0 | 0 | 36 s |
| with-bugs | Comprehensive accessibility | 9 | 18 | 7 | 11 | 0 | 45 s |
| clean | Standard, all 10 areas | 5 | 277 | 234 | 39 | 4 | 590 s |
| clean | Comprehensive security (passive) | 8 | 33 | 33 | 0 | 0 | 29 s |
| clean | Comprehensive accessibility | 8 | 16 | 16 | 0 | 0 | 21 s |

The pages: home, a category (hand tools), a product (Combination Pliers),
contact, login, register, forgot-password and rentals, as hash routes on
with-bugs (`/#/...`) and paths on clean, plus `/#/chainsaws` on with-bugs.
Standard took the first 5. Comprehensive covered all.

## Scores (Decision 3)

"Present" is the hosted spot-check: yes (checked by hand) or ? (never
checked). A ? on a miss means the bug may not be on the hosted site.

| ID | Bug (TestForge's wording) | Area | Score | Evidence (run: check: message) | Present |
| --- | --- | --- | --- | --- | --- |
| 2 | Category sort order reversed | functional | missed | no check reads sort results | ? |
| 3 | "Chainsaw" link goes to a missing page | functional | **found** | Standard: "link health: linked routes draw a page, not the app's "not found" view": "/#/chainsaws (draws the same as /#/testforge-missing-..., a route that cannot exist)", on each of the 5 pages | yes |
| 4 | Product names right-aligned (category) | visual | missed | no layout check | ? |
| 19 | Login email padding | visual | missed | no layout check | ? |
| 22 | Forgot-password button font | visual | missed | no layout check | ? |
| 23 | Forgot-password email padding | visual | missed | no layout check | ? |
| 26 | Product images on home don't show | visual | missed | nothing says an image doesn't show; axe names `.img-fluid` (a different image) for alt text | yes |
| 27 | Price filter doesn't send its maximum | functional | missed | no check reads filter requests | ? |
| 28 | Header logo is a broken image | functional | **found** | Standard: "no same-origin request fails while the page loads": "HTTP 404 .../broken.png" on `/`; Standard and Comprehensive: axe `image-alt` on `.navbar-brand > img[src$="broken.png"]` | yes |
| 29 | "Home" link points to contact | functional | missed | link health checks the target draws, not that it's the right page | yes |
| 30 | Search icon is a broken image | functional | **found** | Standard and Comprehensive: axe `image-alt` on `.grid-title:nth-child(7) > img[src$="broken.png"]`, the second `broken.png` on `/` the spot-check read as this bug | likely |
| 31 | "Contact" misspelt | content | missed | no spelling check | yes |
| 33 | "Sort" label misspelt | content | hinted | Standard and Comprehensive: axe `select-name` and "every form field has an accessible name": the sort `<select>` has no name on `/#/` and the category (with-bugs dropped its `aria-label="sort"`); nothing names the misspelling | yes |
| 34 | "Search" button misspelt | content | missed | no spelling check | yes |
| 40 | Quantity +/- don't change the quantity | functional | missed | no check clicks +/- and reads the result | ? |
| 42 | "Related products" misspelt | content | missed | no spelling check | yes |
| 45 | Product buttons overlap | visual | missed | no layout check | ? |
| 46 | Product badge text black | visual | missed | axe flags `.text-reset` contrast only once the product page has drawn; the run read it before | ? |
| 49 | Rentals title centred | visual | missed | no layout check | ? |
| 53 | Registration tab order | accessibility | missed | no check follows form tab order | ? |
| 54 | Registration phone placeholder misspelt | content | missed | no spelling check; register is outside Standard's 5 | ? |
| 58 | Registration button width | visual | missed | no layout check | ? |
| 59 | Registration dropdown fonts | visual | missed | no layout check | ? |
| 60 | Contact subject list shows error entries | functional | hinted | Standard: the contact form's check (T27) quotes the options, "Error 101: Subject not found"; Comprehensive: axe lists `#subject` for manual contrast review; neither names the entries as the fault | yes |
| 62 | Contact message placeholder misspelt | content | missed | no spelling check | yes |
| 63 | Contact attachment label font | visual | missed | no layout check | ? |
| 66 | Contact button width | visual | missed | no layout check | ? |
| 67 | Contact dropdown fonts | visual | missed | no layout check | ? |
| 75 | Products API exposes stock internals | security | missed | the passive checks don't read API responses | ? |
| 80 | Log file reachable from the web | security | missed | the passive checks don't probe known paths | ? |
| 82 | Sequential, guessable IDs | security | missed | no ID-pattern check | ? |
| 85 | Link contrast below 4.5:1 | accessibility | **found** | Standard and Comprehensive: axe `color-contrast` (serious) on the footer links `p > a[target="_blank"]`, on every with-bugs page; the clean site passes | ? (found here) |
| 87 | Login fields have no labels | accessibility | **found** | Comprehensive: "every form field has an accessible name" on `/#/auth/login`: "form field named only by its placeholder ...: #email ("Your E-mail *")", and `#password` (axe accepts a placeholder as a name) | yes |
| 91 | Quantity field has no label | accessibility | missed | the field (`<input type="number" data-test="quantity">`, no label) wasn't drawn when the checks ran | yes |
| 92 | Product images have no alt | accessibility | hinted | axe `image-alt` on `/#/product/1` names only `img`, the header logo; the product images are flagged only on a settled page | yes |
| 93 | Home search form has no label | accessibility | **found** | Standard and Comprehensive: axe `label` on `.form-control` and "form fields on /#/ with no accessible name: ... input[type="text"]" | yes |
| 94 | Home filters not in a fieldset | accessibility | missed | axe has no rule for it | yes |

### Counts

| Area | Scored | Found | Hinted | Missed |
| --- | --- | --- | --- | --- |
| functional | 8 | 3 | 1 | 4 |
| visual | 13 | 0 | 0 | 13 |
| content | 6 | 0 | 1 | 5 |
| accessibility | 7 | 3 | 1 | 3 |
| security | 3 | 0 | 0 | 3 |
| **all (read-only gate)** | **37** | **6** | **3** | **28** |

**By run:**
- **Standard:** found 3, 28, 30, 85 and 93, and hinted 33, 60 and 92.
- **Comprehensive accessibility:** found 28, 30, 85, 87 and 93, and hinted
  33, 60 and 92.
- **Comprehensive security:** found nothing. Its only with-bugs-only items
  are the shared header findings on `/#/chainsaws`, a page the clean site
  doesn't have.
- Bug 3 is Standard's alone, through TFP-165's route check. Bug 87 is
  Comprehensive's alone: Standard's five pages include login, and the
  same check passed there with no finding, consistent with the form not
  yet drawn.

**Against the prediction:**
- **The 7 "likely":**
  - 5 found: 28, 30, 85, 87 and 93.
  - 92 only hinted, and 91 missed, both through the render timing.
- **The 3 read-only "maybe"** (26, 46, 53): all missed.
- **Unpredicted:**
  - 3 was found, which TFP-165 made possible;
  - 33 and 60 were hinted.

### Not scored (57)

- **Interactive gate, 37** (36 visible in Chromium): cart, checkout,
  invoices, profile, login flows and form submits. They wait for a local
  copy (Decision 4).
- **Active gate, 7:** API attacks.
- **Read-only but not visible in Chromium, 13** (Firefox or Edge only).

## What the misses point to

| Would catch them | Bugs | Standard area it points to |
| --- | --- | --- |
| A visual or layout check (alignment, padding, width, fonts, images that don't render) | 4, 19, 22, 23, 26, 45, 46, 49, 58, 59, 63, 66, 67 | none today: usability is the nearest |
| A spelling and wording check on visible text, placeholders and labels | 31, 34, 42, 54, 62 (and 33's cause) | seo/content |
| Checks that a control did the right thing: a sort's order, a filter's request, a link's destination, +/- | 2, 27, 29, 40 | functional |
| Generated checks that wait for a hash route to draw, as the crawl does since TFP-165 | 91, 92's images, 46 | every area (cross-cutting) |
| Keyboard order through a form, and grouping that axe doesn't judge | 53, 94 | accessibility |
| Read-only security probes: API response contents, known paths, ID patterns | 75, 80, 82 | security |

## Other with-bugs failures, read by hand

Each is in `docs/decisions/data/labelled-failures.md`.

| Failure | Count | Verdict |
| --- | --- | --- |
| Form lookups before the form is drawn ("no form on /#/auth/login") | 1 (clean: 7) | T25, template error |
| Quantity input located by its value, `getByText('1')` | 1 | T26, template error |
| Contact form classed `api`, located by its joined labels | 1 | T27, template error |
| "password field in the URL" on a form whose password has no name | 1 | T28, template error |
| `<a href="#" role="button">` "Categories" looked up as a link | 5 | T29, template error |
| Meta description, canonical, robots.txt, sitemap | 12 | R13, real (not a listed bug) |
| `#filters` link with no target | 2 | R14, real (not a listed bug) |
| Show-password toggle with no name (axe `button-name`, login and register) | 2 pages | R15, real: the same as R10 on the clean site |
| Password field check lands on a duplicate `id="password"` | 1 | U4, unclear |
| `:visited` styling (also on clean) | 5 | U2 |
| "Links are distinguishable from surrounding text" | 4 | U3 |

The axe failures on every with-bugs page (`color-contrast` on the footer
links, `image-alt` on the logo) are bugs 85 and 28. The `select-name` and
field-name failures on home and the category are bugs 33 and 93.

## Limits

- **The control is approximate and uneven.** The two sites' code has
  drifted, and the clean site routes by path. The render race also hit the
  clean runs: its login and product pages were checked before they drew,
  so R10's toggle and its forms didn't show there. Shared defects were
  confirmed on the settled pages by hand (R15, T28) rather than by the
  diff alone.
- **Presence:** 20 of the 28 misses were never checked on the hosted
  site. They may include bugs that aren't there.
- **One page of each kind:** a bug on another product or category is
  outside this set.
- **One run each, from this machine.** The route check's 14 s budget left
  3 to 7 product routes unchecked on each page (recorded as findings).

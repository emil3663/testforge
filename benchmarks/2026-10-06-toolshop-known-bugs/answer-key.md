# Toolshop Known-Bug Answer Key (TFP-153)

Status: classified 2026-10-06 (Cowork), before any TestForge run (Decision
2). The hosted spot-check (Decision 1) was done the same day: 15 of 15
checked bugs are present.

**Source.** `github.com/testsmith-io/practice-software-testing`, file
`sprint5-with-bugs/testSessions/listOfBugs.md`, at commit
`c752a7029176fd878dc8de00651722cac80e5216` (2026-10-04), which lists 94
bugs. Only the IDs are Testsmith's. Every description below is TestForge's
own one-line wording, as the licence requires (see the backlog's Licence
note). Read the source for the full text.

**Target.** `https://with-bugs.practicesoftwaretesting.com/`. The control is
`https://practicesoftwaretesting.com/`.

## Columns

- **Area:** the TestForge area the bug belongs to. "visual" (layout, fonts,
  alignment), "content" (typos, wording), "data" (values shown wrongly
  across pages) and "email" are labels for bugs no current area owns.
- **Gate:** the lowest Phase 38 gate at which TestForge could see it:
  - **R:** read-only (page loads, reading, client-side clicks that send
    nothing);
  - **I:** interactive (login with the published demo accounts, cart,
    forms);
  - **A:** active (attack-shaped requests).
- **Chromium:** whether the bug shows in Chromium. TestForge runs Chromium
  only.
- **Expected today:** the prediction, made before running, of what the
  current Standard and Comprehensive runs report. Every Standard run now
  includes the axe scan (TFP-148).
  - **Likely:** the named check should fail or record a finding.
  - **Maybe:** a check could touch it, but may not name the cause.
  - **No:** nothing today would see it. The reason is given.
- **Hosted:** present on the hosted with-bugs site. "?" means not yet
  checked.

## Key

| ID | TestForge's description | Area | Gate | Chromium | Expected today | Hosted |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Cart quantity +/- buttons don't change the amount | functional | I | yes | No: no cart flow modelled | ? |
| 2 | Category sort order is reversed | functional | R | yes | No: no check reads sort results | ? |
| 3 | The "Chainsaw" category link goes to a missing page | functional | R | yes | No: the site routes by `#/` hash, so the server answers 200 and the 404 is drawn client-side; link health and the anchor-target check (TFP-141) won't see it | yes |
| 4 | Some product names right-aligned on a category page | visual | R | yes | No: no layout check | ? |
| 5 | Category title centred in Edge | visual | R | no (Edge) | No: Chromium only | ? |
| 6 | Product names don't wrap in Firefox (category) | visual | R | no (Firefox) | No: Chromium only | ? |
| 7 | Cart delete button is disabled | functional | I | yes | No: no cart flow modelled | ? |
| 8 | Cart total shows zero | data | I | yes | No: no cart flow modelled | ? |
| 9 | Billing address step has a typo | content | I | yes | No: no spelling check | ? |
| 10 | Billing step shows a placeholder message instead of the postcode | data | I | yes | No: no checkout flow modelled | ? |
| 11 | Billing step's next button has no text | accessibility | I | yes | Maybe: axe `button-name`, only if a run reaches the step | ? |
| 12 | Payment method list shows an error entry | functional | I | yes | No: no checkout flow modelled | ? |
| 13 | Invoice list has no pagination past 15 invoices | functional | I | yes | No: needs an account with many invoices | ? |
| 14 | Invoice shows an error text instead of the payment method | data | I | yes | No: no invoice flow modelled | ? |
| 15 | Invoice swaps city and country | data | I | yes | No: no invoice flow modelled | ? |
| 16 | Invoice address fields show "undefined" | data | I | yes | No: no invoice flow modelled | ? |
| 17 | Login form doesn't validate email or password | functional | I | yes | Maybe: form-validation checks, if the form submits | ? |
| 18 | Login tab order wrong in Firefox | accessibility | R | no (Firefox) | No: Chromium only | ? |
| 19 | Login email field padding wrong in Chrome | visual | R | yes | No: no layout check | ? |
| 20 | Login button width wrong in Firefox | visual | R | no (Firefox) | No: Chromium only | ? |
| 21 | One failed login locks the account | functional | I | yes | No: lockout probing is not modelled | ? |
| 22 | Forgot-password button font differs in Edge and Chrome | visual | R | yes | No: no layout check | ? |
| 23 | Forgot-password email padding wrong in Chrome | visual | R | yes | No: no layout check | ? |
| 24 | Forgot-password button width wrong in Edge | visual | R | no (Edge) | No: Chromium only | ? |
| 25 | Forgot-password accepts a malformed email | functional | I | yes | Maybe: form-validation checks, if the form submits | ? |
| 26 | Some product images on home don't show in Chrome | visual | R | yes | Maybe: failed-request check, if the image request fails | yes |
| 27 | Price range filter doesn't send its maximum | functional | R | yes | No: no check reads filter requests | ? |
| 28 | Header logo is a broken image | functional | R | yes | Likely: failed-request check on `/`, if same-origin | yes |
| 29 | Header "Home" link points to the contact page | functional | R | yes | No: link health checks the target loads, not that it's the right one | yes |
| 30 | Search icon is a broken image | functional | R | yes | Likely: failed-request check on `/`, if same-origin | likely (a second `broken.png` on `/`) |
| 31 | "Contact" link text misspelt | content | R | yes | No: no spelling check | yes |
| 32 | Signed-in user name replaced by an error text | data | I | yes | No: needs login | ? |
| 33 | "Sort" label misspelt | content | R | yes | No: no spelling check | yes |
| 34 | "Search" button text misspelt | content | R | yes | No: no spelling check | yes |
| 35 | Product names don't wrap in Firefox (home) | visual | R | no (Firefox) | No: Chromium only | ? |
| 36 | Profile swaps first and last name | data | I | yes | No: needs login | ? |
| 37 | Profile city shows an error text | data | I | yes | No: needs login | ? |
| 38 | Saving profile address fields gives an error | functional | I | yes | No: needs login and a save | ? |
| 39 | Changed password isn't stored correctly, so it stops working | functional | I | yes | No: needs login and a password change | ? |
| 40 | Product quantity +/- buttons don't change the quantity | functional | R | yes | No: no check clicks +/- and reads the result | ? |
| 41 | "Add to favourites" shows an error | functional | I | yes | No: needs login | ? |
| 42 | "Related products" heading misspelt | content | R | yes | No: no spelling check | yes |
| 43 | "Add to cart" shows an error though the item is added | functional | I | yes | No: no cart flow modelled | ? |
| 44 | Product title right-aligned in Firefox and Edge | visual | R | no (Firefox, Edge) | No: Chromium only | ? |
| 45 | Product page buttons overlap in Chrome | visual | R | yes | No: no layout check | ? |
| 46 | Product badge text is black | visual | R | yes | Maybe: axe `color-contrast`, if the contrast is too low | ? |
| 47 | Cart quantity capped at 10 | functional | I | yes | No: no boundary check on quantity | ? |
| 48 | Rentals bulldozer images fail in Firefox and Edge | visual | R | no (Firefox, Edge) | No: Chromium only | ? |
| 49 | Rentals title centred in Chrome | visual | R | yes | No: no layout check | ? |
| 50 | Registering an existing email reveals account details in the error | security | I | yes | No: needs a registration submit | ? |
| 51 | Names with accented letters or quotes are rejected at registration | functional | I | yes | No: no equivalence-class input checks | ? |
| 52 | Registration swaps state and country | data | I | yes | No: needs a registration submit | ? |
| 53 | Registration tab order wrong in Chrome | accessibility | R | yes | Maybe: keyboard-navigation check covers links, not form order | ? |
| 54 | Registration phone placeholder misspelt | content | R | yes | No: no spelling check | ? |
| 55 | Registration error font differs in Edge and Chrome | visual | I | yes | No: no layout check | ? |
| 56 | Registration city label misaligned in Firefox | visual | R | no (Firefox) | No: Chromium only | ? |
| 57 | Registration phone padding wrong in Firefox | visual | R | no (Firefox) | No: Chromium only | ? |
| 58 | Registration button width wrong in Chrome | visual | R | yes | No: no layout check | ? |
| 59 | Some registration dropdown options use a smaller font | visual | R | yes | No: no layout check | ? |
| 60 | Contact subject list shows error entries | functional | R | yes | No: no check reads option text | yes |
| 61 | Contact tab order wrong in Firefox | accessibility | R | no (Firefox) | No: Chromium only | ? |
| 62 | Contact message placeholder misspelt | content | R | yes | No: no spelling check | yes |
| 63 | Contact attachment label font differs in Edge and Chrome | visual | R | yes | No: no layout check | ? |
| 64 | Contact email label misaligned in Firefox | visual | R | no (Firefox) | No: Chromium only | ? |
| 65 | Contact first-name padding wrong in Firefox | visual | R | no (Firefox) | No: Chromium only | ? |
| 66 | Contact button width wrong in Edge and Chrome | visual | R | yes | No: no layout check | ? |
| 67 | Some contact dropdown options use a smaller font | visual | R | yes | No: no layout check | ? |
| 68 | Contact form rejects a PDF attachment | functional | I | yes | No: no upload checks | ? |
| 69 | Contact form rejects a JPG attachment | functional | I | yes | No: no upload checks | ? |
| 70 | Contact form accepts an empty (0 KB) attachment | functional | I | yes | No: no upload checks | ? |
| 71 | API returns another user's details by changing the ID | security | A | yes | No: needs attack-shaped requests | ? |
| 72 | API access and refresh tokens live far too long | security | I | yes | No: needs login and token inspection | ? |
| 73 | Users API exposes internal account fields | security | I | yes | No: no API response checks | ? |
| 74 | Brands can be deleted without an admin token | security | A | yes | No: needs attack-shaped requests | ? |
| 75 | Products API exposes internal stock details | security | R | yes | No: no API response checks | ? |
| 76 | Products can be deleted without an admin token | security | A | yes | No: needs attack-shaped requests | ? |
| 77 | Reports API rate limit is too strict | security | A | yes | No: rate-limit probing is active and not modelled | ? |
| 78 | Invoices API returns every user's invoices | security | A | yes | No: needs attack-shaped requests | ? |
| 79 | Login API is open to SQL injection | security | A | yes | No: needs attack-shaped requests | ? |
| 80 | Application log file is reachable from the web | security | R | yes | No: passive checks don't probe known paths | ? |
| 81 | Invoice amount and price can be changed through the API | security | A | yes | No: needs attack-shaped requests | ? |
| 82 | IDs are sequential and guessable | security | R | yes | No: no ID-pattern check | ? |
| 83 | Expired token returns the wrong status code | security | I | yes | No: needs login and token expiry | ? |
| 84 | Emails use the logo inconsistently | email | I | n/a | No: TestForge doesn't read email | ? |
| 85 | Link colour contrast below 4.5:1 | accessibility | R | yes | Likely: axe `color-contrast` (1.4.3) | ? |
| 86 | Checkout wizard label contrast too low | accessibility | I | yes | Maybe: axe `color-contrast`, only if a run reaches checkout | ? |
| 87 | Login form fields have no labels | accessibility | R | yes | Likely: axe `label` and the field-name check, on `/auth/login` | yes |
| 88 | Checkout address fields have no labels | accessibility | I | yes | Maybe: axe `label`, only if a run reaches checkout | ? |
| 89 | Checkout payment fields have no labels | accessibility | I | yes | Maybe: axe `label`, only if a run reaches checkout | ? |
| 90 | Checkout login fields have no labels | accessibility | I | yes | Maybe: axe `label`, only if a run reaches checkout | ? |
| 91 | Product quantity field has no label | accessibility | R | yes | Likely: axe `label`, on a product page | yes |
| 92 | Product page images have no alt text | accessibility | R | yes | Likely: axe `image-alt` (1.1.1), on a product page | yes |
| 93 | Home search form has no label | accessibility | R | yes | Likely: axe `label` and the field-name check, on `/` | yes |
| 94 | Home filters aren't grouped in a fieldset | accessibility | R | yes | No: axe has no rule for it; it needs a person | yes |

## Summary of the prediction

Counts are from the table above.

- **94 bugs.** By area:
  - visual 25 (layout, fonts, alignment);
  - functional 24;
  - accessibility 14;
  - security 14;
  - data 9;
  - content 7 (typos);
  - email 1.
- **Chromium:** 80 show in Chromium, 13 don't (Firefox or Edge only), and 1
  is in email. 16 bugs name Firefox, Edge or Safari, but 3 of those also
  show in Chrome.
- **Gate needed:**
  - read-only 50;
  - interactive 37, mostly behind login, the cart or checkout;
  - active 7 (API attacks).
- **Expected today:**
  - **Likely, 7**, all read-only: 5 axe accessibility, plus 2 broken
    images through the failed-request check.
  - **Maybe, 10.**
  - **No, 77.** Bug 3 moved from Likely to No after the spot-check; see below.
- **What the misses point to**, as a prediction, before measuring:
  - **Visual and layout (25):** TestForge has no visual check. It is the
    biggest single gap. 10 of these show only outside Chromium.
  - **Flows behind login, cart and checkout (about 30):** the interactive
    gate exists, but no generated journey reaches these pages.
  - **Content (7 typos):** there is no spelling or wording check.
  - **Functional logic on read-only pages (sort, +/-, filters, wrong link
    target, option text):** checks load pages and links, but don't verify
    that a control did the right thing.
  - **Security (14):** 7 need the active gate. The read-only ones (an
    exposed log file, guessable IDs, API data exposure) aren't covered by
    the passive checks.

## Hosted spot-check (Decision 1), 2026-10-06

Done in Chrome on `https://with-bugs.practicesoftwaretesting.com/`. It was
read-only: page loads, reading the DOM, and changing the client-side route.
Nothing was submitted.

**Present (15):** 3, 26, 28, 29, 31, 33, 34, 42, 60, 62, 87, 91, 92, 93 and 94.
30 is likely: a second `broken.png` image is on `/`. The rest are checked
during TFP-154.

**Two findings for TFP-154, before any run:**
1. **The with-bugs site routes by hash** (`#/contact`, `#/product/1`,
   `#/chainsaws`). The clean site routes by path (`/auth/login`,
   `/category/power-tools`, as TFP-150 ran it). So:
   - TestForge's crawl, link health and anchor-target check may treat every
     `#/` link as an in-page anchor. A run could then inspect only `/` and
     miss most read-only bugs. TFP-154 must first check what the crawl
     finds. If it only finds `/`, that is itself a measured gap: TestForge
     can't crawl a hash-routed single-page app. It would need its own
     ticket before scoring means much.
   - The bug-free control routes differently, so it is a weaker control
     than Decision 3 assumed.
2. **The site shows a "Bug Hunting Mode" banner and guide.** These are
   extra buttons and links the clean site doesn't have, so they show up in
   generated tests. They aren't bugs, and they aren't scored.

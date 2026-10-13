# TFP-188: the local score, bug by bug

TFP-154's committed rule (`../2026-10-06-toolshop-known-bugs/scoring-rule.md`),
unchanged; Phase 40's selection, unedited (`runs/*-selection.json`); code under
test `f3fcf9a` (`src/` as at `9a9ac3b`); read-only gate, one worker, Chromium.
**found:** a failure or finding names the bug's page and cause. **Control:** an
item the clean copy has too, with the same check and cause, is not a find
(`evidence.mjs` marks them; none of the evidence below is on clean). Raw
lines: `evidence.txt`.

| ID | Bug | Gate A (local) | **TFP-188** | Evidence (run: check: message) |
| --- | --- | --- | --- | --- |
| 2 | Category sort order reversed | missed | **found** | Standard, home and category: "sort options order the items": `sorting by "Name (A - Z)" ... puts "Wood Saw" before "Thor Hammer"` |
| 3 | "Chainsaw" link goes to a missing page | found | **found** | Standard, every page: link health, `/#/chainsaws (draws the same as /#/testforge-missing-..., a route that cannot exist)` |
| 4 | Product names right-aligned (category) | missed | **found** (present-intermittent) | Standard, category: `the card titles ...: "Long Nose Pliers" has text-align left, where the other 6 have right` (and two more); across pages, `h5.card-title differs across pages in text-align`. Random per load: the within-page check read 6 titles right and 3 left on both home and category; the across-pages check, on its own loads, read home left and category right |
| 19 | Login email padding | missed | **found** | Standard, login: `the fields of a form on /#/auth/login differ in padding-left: "Your E-mail *" 0px, "Your password *" 12px` |
| 22 | Forgot-password button font | missed | missed | not visible in Chromium (Edge only, Gate A's presence verdict) |
| 23 | Forgot-password email padding | missed | missed | not visible in Chromium (Firefox only) |
| 26 | Home product images don't show | hinted | **found** | Standard, home: `the cards on /#/: "Slip Joint Pliers" has its image hidden, where the other 8 show theirs` |
| 27 | Price filter doesn't send its maximum | missed | **found** | Standard, home: `moving the "ngx-slider-max" slider on /#/ from 100 to 99 sent GET http://localhost:8091/products?between=price,0&page=0, which does not carry 99` |
| 28 | Header logo is a broken image | found | **found** | Standard, every page: `images on ... that loaded but can't be shown: broken.png`; axe `image-alt` on `img[src$="broken.png"]` |
| 29 | "Home" link points to contact | missed | **found** | Standard, home: `"Home" on /#/ leads to /contact ("Contact"), not the start page` |
| 30 | Search icon is a broken image | found | **found** | Standard, home: `images on /#/ ...: broken.png, broken.png` (the second is the search icon's) |
| 31 | "Contact" misspelt | missed | **found** | Standard, every page: `"Contakt" in the link "Contakt" ... did you mean "Contact"?` |
| 33 | "Sort" label misspelt | hinted | **found** | Standard, home: `"Sorth" in the heading "Sorth" ... did you mean "Sort" ...?` |
| 34 | "Search" button misspelt | missed | **found** | Standard, home: `"Serch" in the button "Serch" ... did you mean "Search" ...?` |
| 40 | Quantity +/- don't change the quantity | hinted | **found** | Standard, product: `"+" beside "quantity" left it at 1 (it was 1; expected 2)` |
| 42 | "Related products" misspelt | missed | **found** | Standard, product: `"Reltded" in the heading "Reltded products"` |
| 45 | Product buttons overlap | missed | **found** | Standard, product: `"Add to cart" and "Add to favourites" overlap by 50 x 38 px` (a failure) |
| 46 | Product badge text black | found | **found** | Standard and Comprehensive, product pages: axe `color-contrast` on `.text-reset` (clean: none) |
| 49 | Rentals title centred | missed | missed | the check finds it when rentals is inspected (batch 2's evidence), but Phase 40's with-bugs Standard selection has chainsaws, not rentals, and Comprehensive's rentals visit runs no layout check (Emil's ruling, 2026-10-13: scored as the runs fall) |
| 53 | Registration tab order | missed | **found** | Standard and Comprehensive, register: `positive tabindex on /#/auth/register ...`, and `Tab ... goes from "E-mail address" back to "Date of birth"` |
| 54 | Registration phone placeholder misspelt | missed | missed | absent in this version (Gate A) |
| 58 | Registration button width | missed | **found** | Standard, across pages: `submit .btnSubmit differs across pages in share of its container's width: 10% on /#/auth/register, /#/contact; 50% on /#/auth/login, /#/auth/forgot-password` |
| 59 | Registration dropdown fonts | missed | **found** | Standard, register: `"Austria" has font-size 13.3333px, where the other 247 have 16px` (and the Netherlands) |
| 60 | Contact subject list shows error entries | hinted | **found** | Standard, contact: `the "Subject" list on /#/contact offers "Error 101: Subject not found"` |
| 62 | Contact message placeholder misspelt | missed | **found** | Standard, contact: `"Massage" in the placeholder "Massage" ... looks like a misspelling of its label's "Message"` |
| 63 | Contact attachment label font | missed | **found** | Standard, contact: `"Attachment" has font-family "Comic Sans", where the other 5 have system-ui` |
| 66 | Contact button width | missed | **found** | as 58: `10% on /#/auth/register, /#/contact` |
| 67 | Contact dropdown fonts | missed | **found** | Standard, contact: `"Return" has font-size 13.3333px, where the other 8 have 16px` |
| 75 | Products API exposes stock | missed | **found** | Comprehensive security, home, category and every product page: `GET http://localhost:8091/products returns "stock" ...` |
| 80 | Log file reachable from the web | missed | **found** | Comprehensive security: `http://localhost:8091/logs/laravel.log answers 200 with its contents` (a failure) |
| 82 | Sequential, guessable ids | missed | **found** | Comprehensive security, 13 pages: `http://localhost:4200/#/product/:id ... uses sequential integer ids (1, 2, 3, 4, 5, ...)` |
| 85 | Link contrast below 4.5:1 | found | **found** | axe `color-contrast` (serious) on the footer links `a[target="_blank"]`, every page (clean: none) |
| 87 | Login fields have no labels | found | **found** | `form field named only by its placeholder on /#/auth/login ...: #email`, `#password` |
| 91 | Quantity field has no label | found | **found** | `form fields on /#/product/6 with no accessible name ...: input[type="number"]` |
| 92 | Product images have no alt | found | **found** | axe `image-alt` on the product cards' `.card-img-top` (clean: none) |
| 93 | Home search form has no label | found | **found** | `form fields on /#/ with no accessible name ...: select, input[type="text"]` |
| 94 | Home filters not in a fieldset | missed | **found** | Standard and Comprehensive, home: `10 checkboxes sharing the name "category_id" ... are not in a fieldset with a legend or a named group` |

**Counts:** found 33, hinted 0, missed 4 (Gate A, the same copies: 9, 4, 24).
The 4 missed: 22 and 23 aren't visible in Chromium, 54 isn't in this version,
and 49 isn't on a page Phase 40 selects. Of the 25 present targets Phase 41
aimed at, 24 are found; 49 is the one left, and only by page selection.

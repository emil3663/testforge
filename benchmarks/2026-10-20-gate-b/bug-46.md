# Bug 46's evidence, A against C

Bug 46, the product badge's contrast, is one of the 30 bugs found through Standard. At TFP-208 its evidence was a
manual-review item of the axe scan (`color-contrast`, incomplete). The session's with-bugs records kept no manual-review
items (the README says why), so the evidence script couldn't compare it.

`run-bug46.sh`, 2026-10-20 14:10 to 14:14:
- **The suites:** only the axe scans ("passes the WCAG 2.2 A and AA scan") of A's and C's with-bugs Standard suites,
  the session's own files unchanged;
- **The runs:** three rounds, interleaved, on a fresh start of the with-bugs copy, with each record's issues kept
  (`runs/bug46/`).

| Run | A: tests, failed, manual-review items | C: tests, failed, manual-review items |
| --- | --- | --- |
| 1 | 8, 8, 10 | 8, 8, 10 |
| 2 | 8, 8, 10 | 8, 8, 10 |
| 3 | 8, 8, 10 | 8, 8, 10 |

- **The same items:** across the three runs, the manual-review items are identical in A and C (page and item, with
  Angular's `_ngcontent` attributes and product ids set aside): 0 in A only, 0 in C only.
- **Bug 46's item:** the product page's `color-contrast` item is among them in every run of both.

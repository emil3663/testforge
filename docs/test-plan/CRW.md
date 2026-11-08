# Test cases: Crawl (CRW)

Section 3.3 of the [test plan](../../TEST_PLAN.md), which keeps the app overview, the feature status, the known limitations and the index of areas. Since TFP-253 each area's cases are in a file of their own; a ticket names the area it touches.

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| CRW-01 | Discovered-pages section, crawl lifecycle, and page selection (automated: "covers the discovered site pages section, crawl lifecycle, and page selection controls") | Crawl discovers same-origin pages, surfaces them for selection, and the UI reflects crawl-in-progress / crawl-complete states correctly. | ✅ |
| CRW-02 | Manual: crawl a multi-page site | All same-origin pages reachable within crawl depth are listed; off-origin links are not crawled. | ⬜ |
| CRW-03 | Crawl executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/crawl` starts a job that reaches `crawlStatus: "completed"`, with no environment variable set beyond `.env.development`. | ✅ |
| CRW-04 | A crawl whose browser can't start (automated: `src/app/api/crawl/route.test.ts` — "when the browser can't start, the crawl ends as failed with the cause in error") | The job ends as `crawlStatus: "failed"`, its `error` naming the cause's first line, never left `running`; no unhandled rejection. | ✅ |
| CRW-05 | Only web pages are queued (automated: `src/lib/pipeline/crawl.test.ts`) | Only `http:` and `https:` URLs on the crawl's origin are queued; `vbscript:`, `javascript:`, `mailto:`, `tel:`, `data:`, `file:` and an unknown scheme are not, by an allowlist (TFP-274, CodeQL #6133). | ✅ |

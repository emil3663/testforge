# Test cases: Save-suite (SAV)

Section 3.8 of the [test plan](../../TEST_PLAN.md), which keeps the app overview, the feature status, the known limitations and the index of areas. Since TFP-253 each area's cases are in a file of their own; a ticket names the area it touches.

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| SAV-01 | Generated suite section: editing and saving actions (automated: "covers the generated suite section actions for editing and saving") | Edits made to the generated suite in the in-browser editor are saved and reflected before Run uses the saved version. | ✅ |
| SAV-02 | Add a generated suite to Playwright discovery (automated smoke: "adds a generated suite to Playwright discovery") | Saving a generated suite makes it discoverable by Playwright (e.g. VS Code Test Explorer / `playwright test --list`). | ✅ |
| SAV-03 | Save-suite executes with no external backend configured (automated: `tests/regression/testforge.sections.spec.ts` — "executes generate, run, crawl, introspect, and save-suite without an external backend configured") | `POST /api/save-suite` writes the file locally and returns a `.spec.ts` filename, with no environment variable set beyond `.env.development`. | ✅ |

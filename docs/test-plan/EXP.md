# Test cases: Export (EXP)

Section 3.7 of the [test plan](../../TEST_PLAN.md), which keeps the app overview, the feature status, the known limitations and the index of areas. Since TFP-253 each area's cases are in a file of their own; a ticket names the area it touches.

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| EXP-01 | Export HTML report after a suite run (automated smoke: "exports HTML report after suite run") | Exporting after a run produces a downloadable HTML file containing the report content. | ✅ |
| EXP-02 | Manual: open an exported HTML report standalone (no dev server running) | Exported HTML renders correctly in a browser with the TestForge server stopped. | ⬜ |

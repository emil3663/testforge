// Phase 47 (TFP-248): the action's job summary says the verdict the exit code gave, the report's counts, and the
// failures that decided it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSummary } from "./summary.mjs";

const summary = { planned: 12, executed: 10, passed: 7, failed: 2, flaky: 1, blocked: 1, notRun: 2 };
const execution = [
    { title: "Home page loads", status: "Passed" },
    { title: "Contact | form is labelled", status: "Failed" },
    { title: "API answers", status: "Blocked" },
    { title: "Slow page", status: "Not run" },
];
const report = { report: { summary, execution }, producedBy: { version: "0.4.0", commit: "abc1234" } };
const url = "http://localhost:4200";

test("a run with failures and no baseline: the verdict, the counts and each failing test", () => {
    assert.equal(buildSummary({ report, comparison: null, exitCode: 1, url }), [
        "### Mr Onion: failed: tests failed (exit 1)",
        "",
        "Target: http://localhost:4200",
        "",
        "| Planned | Passed | Failed | Blocked | Flaky | Not run |",
        "| ---: | ---: | ---: | ---: | ---: | ---: |",
        "| 12 | 7 | 2 | 1 | 1 | 2 |",
        "",
        "**Failing tests** (2)",
        "",
        "- Contact \\| form is labelled",
        "- API answers",
        "",
        "Mr Onion 0.4.0 (abc1234). The full report is report.html in the attached artifact.",
        "",
    ].join("\n"));
});

test("with a baseline: only the new failures are listed, with the known and fixed counts", () => {
    const comparison = {
        baseline: { runId: "r1", finishedAt: "2026-11-13T06:00:00.000Z", from: "latest" },
        failures: { known: [{ title: "Contact | form is labelled" }], new: [], fixed: [{ title: "API answers" }] },
    };
    const text = buildSummary({ report, comparison, exitCode: 0, url });
    assert.match(text, /^### Mr Onion: passed: no new failures \(exit 0\)\n/);
    assert.match(text, /Compared with the run of 2026-11-13T06:00:00.000Z: 0 new, 1 known, 1 fixed\./);
    assert.match(text, /\*\*Fixed since the baseline\*\* \(1\)\n\n- API answers\n/);
    assert.doesNotMatch(text, /New failures|Failing tests/);
});

test("report-only: exit 0 with failing tests says they were reported, not that none failed", () => {
    assert.match(buildSummary({ report, comparison: null, exitCode: 0, url }), /^### Mr Onion: reported, not failing the build: tests failed \(exit 0\)\n/);
    const comparison = {
        baseline: { runId: "r1", finishedAt: "2026-11-13T06:00:00.000Z", from: "latest" },
        failures: { known: [], new: [{ title: "API answers" }], fixed: [] },
    };
    assert.match(buildSummary({ report, comparison, exitCode: 0, url }), /^### Mr Onion: reported, not failing the build: new failures \(exit 0\)\n/);
});

test("more than 20 failures: 20 are listed, and the rest counted", () => {
    const many = Array.from({ length: 23 }, (_, index) => ({ title: `Test ${index + 1}`, status: "Failed" }));
    const text = buildSummary({ report: { report: { summary, execution: many } }, comparison: null, exitCode: 1, url });
    assert.match(text, /- Test 20\n- \.\.\. and 3 more, in report\.html\n/);
    assert.doesNotMatch(text, /Test 21/);
});

test("no report: a run that couldn't run, or a configuration rejected, says so", () => {
    assert.equal(buildSummary({ report: null, comparison: null, exitCode: 2, url }), "### Mr Onion: couldn't run (exit 2)\n\nTarget: http://localhost:4200\n\nNo report was written: the step's log says why the run couldn't run.\n");
    assert.match(buildSummary({ report: null, comparison: null, exitCode: 3, url }), /invalid configuration \(exit 3\)[\s\S]*the configuration was rejected/);
});

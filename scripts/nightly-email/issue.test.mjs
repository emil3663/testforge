/**
 * TFP-252: the nightly's failure issue - what it says, when it's opened, updated and closed, and the email's line.
 *
 * Run via:
 * node --test scripts/nightly-email/issue.test.mjs
 */
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { failureReport, ISSUE_TITLE, issueTitle, MAX_RANGE_COMMITS, planIssue } from "./issue.mjs";
import { buildSummary, nightlyPassed } from "./summary.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const RUN = { url: "https://github.com/o/r/actions/runs/9", commit: "abcdef1234567890", date: "2026-11-04", branch: "main" };
const GREEN = { unit: "success", audit: "success", "dead-code": "success", "template-unchanged": "success" };
const RED = { ...GREEN, unit: "failure" };
const UNIT = { tests: 708, pass: 706, fail: 2, cancelled: 0, skipped: 0, failing: ["first failure", "mentions @someone and `code`"] };
const commit = (at) => ({ sha: `${String(at).padStart(7, "0")}${"f".repeat(33)}`, subject: `commit ${at}` });
const RANGE = { from: "1111111aaaaaaa", greenRunUrl: "https://github.com/o/r/actions/runs/8", compareUrl: "https://github.com/o/r/compare/1111111aaaaa...abcdef123456", commits: [commit(1), commit(2)] };

/** The text between the report's fence lines: everything a name or subject may appear in. */
const FENCE = /^(~{4,})text\n([\s\S]*?)\n\1$/gm;
const fencedText = (report) => [...report.matchAll(FENCE)].map((match) => match[2]).join("\n");

test("the plan: a red night opens the issue, or comments on the open one; a green one closes it, or does nothing", () => {
    const open = { number: 4, url: "https://github.com/o/r/issues/4" };
    assert.deepEqual(planIssue({ passed: false, open: null, report: "r", run: RUN }), { action: "open", body: "r" });
    assert.deepEqual(planIssue({ passed: false, open, report: "r", run: RUN }), { action: "comment", number: 4, url: open.url, body: "r" });
    const close = planIssue({ passed: true, open, report: null, run: RUN });
    assert.equal(close.action, "close");
    assert.equal(close.number, 4);
    assert.equal(close.body, "Green again: https://github.com/o/r/actions/runs/9 at `abcdef1` (2026-11-04).");
    assert.deepEqual(planIssue({ passed: true, open: null, report: null, run: RUN }), { action: "none" });
});

test("one issue per branch: the default branch's is 'Nightly failing', a branch's carries its name", () => {
    assert.equal(ISSUE_TITLE, "Nightly failing");
    assert.equal(issueTitle("main", "main"), "Nightly failing");
    assert.equal(issueTitle("tfp-252-check", "main"), "Nightly failing on tfp-252-check");
});

test("the report: the run, the commit, each job, the failing tests and the commits since the last green run", () => {
    const report = failureReport({ jobs: RED, unit: UNIT, run: RUN, range: RANGE });
    assert.ok(report.startsWith("Nightly run https://github.com/o/r/actions/runs/9 failed at `abcdef1` (2026-11-04)."), report);
    assert.ok(report.includes("**Jobs:** unit: failure, audit: success, dead-code: success, template-unchanged: success"), report);
    assert.ok(report.includes("**Failing tests** (2 of 708):"), report);
    assert.ok(report.includes(`**Since the last green run** (${RANGE.greenRunUrl}, at \`1111111\`): 2 commits, ${RANGE.compareUrl}`), report);
    assert.equal(fencedText(report), ["first failure", "mentions @someone and `code`", "0000001 commit 1", "0000002 commit 2"].join("\n"));
});

test("an @name in a test name or a commit subject is only ever inside a fence, so nobody is notified", () => {
    const range = { ...RANGE, commits: [{ sha: "2".repeat(40), subject: "fix: thanks @helper" }] };
    const report = failureReport({ jobs: RED, unit: UNIT, run: RUN, range });
    const outside = report.replace(FENCE, "");
    assert.ok(!outside.includes("@"), outside);
    assert.ok(fencedText(report).includes("@someone") && fencedText(report).includes("@helper"));
});

test("a name or subject holding a run of ~ can't close the fence early: the fence is longer", () => {
    const range = { ...RANGE, commits: [{ sha: "3".repeat(40), subject: "~~~~~~" }, { sha: "4".repeat(40), subject: "after it, @someone" }] };
    const report = failureReport({ jobs: RED, unit: { ...UNIT, fail: 1, failing: ["~~~~"] }, run: RUN, range });
    assert.ok(report.includes("\n~~~~~text\n~~~~\n~~~~~\n"), report);
    assert.ok(report.includes("\n~~~~~~~text\n3333333 ~~~~~~\n4444444 after it, @someone\n~~~~~~~"), report);
    assert.ok(!report.replace(FENCE, "").includes("@"), report.replace(FENCE, ""));
});

test("more failing tests than were named, and more commits than are shown, both say how many more", () => {
    const failing = Array.from({ length: 20 }, (_, at) => `failing ${at + 1}`);
    const commits = Array.from({ length: MAX_RANGE_COMMITS + 3 }, (_, at) => commit(at + 1));
    const report = failureReport({ jobs: RED, unit: { ...UNIT, fail: 25, failing }, run: RUN, range: { ...RANGE, commits } });
    assert.equal(MAX_RANGE_COMMITS, 20);
    assert.ok(report.includes("**Failing tests** (25 of 708):"), report);
    assert.ok(fencedText(report).includes("failing 20\nand 5 more"), report);
    assert.ok(report.includes("23 commits"), report);
    assert.ok(fencedText(report).includes("0000020 commit 20\nand 3 more"), report);
    assert.ok(!report.includes("commit 21"), report);
});

test("past the compare API's 250, the count is GitHub's total, not the commits it listed", () => {
    const commits = Array.from({ length: 250 }, (_, at) => commit(at + 1));
    const report = failureReport({ jobs: RED, unit: UNIT, run: RUN, range: { ...RANGE, commits, total: 300 } });
    assert.ok(report.includes("300 commits"), report);
    assert.ok(fencedText(report).includes("0000020 commit 20\nand 280 more"), report);
});

test("a red night with no failing test, unreadable counts, no green run, or a range that can't be listed, says which", () => {
    const noTests = failureReport({ jobs: { ...GREEN, audit: "failure" }, unit: { ...UNIT, fail: 0, failing: [] }, run: RUN, range: RANGE });
    assert.ok(noTests.includes("**Failing tests:** none (0 failed, 708 tests)."), noTests);
    const unreadable = failureReport({ jobs: { ...GREEN, unit: "cancelled" }, unit: null, run: RUN, range: RANGE });
    assert.ok(unreadable.includes("**Failing tests:** can't be read (the unit job's result: cancelled)."), unreadable);
    const never = failureReport({ jobs: RED, unit: UNIT, run: RUN, range: null });
    assert.ok(never.includes("**Since the last green run:** no run of this workflow on main has been green, so there is no range."), never);
    const lost = failureReport({ jobs: RED, unit: UNIT, run: RUN, range: { ...RANGE, commits: undefined, error: "HTTP 404" } });
    assert.ok(lost.includes(`(${RANGE.greenRunUrl}, at \`1111111\`): the commits couldn't be listed: HTTP 404`), lost);
    assert.equal(fencedText(lost), "first failure\nmentions @someone and `code`");
    const unknown = failureReport({ jobs: RED, unit: UNIT, run: RUN, range: { error: "gh api: HTTP 502" } });
    assert.ok(unknown.includes("**Since the last green run:** the last green run couldn't be found: gh api: HTTP 502"), unknown);
});

test("a failing template check puts its own line in the report, as the email does; a passing one adds nothing", () => {
    const line = "435d78f -> 369f0c7: 172 inputs, 170 identical, 2 different";
    const failed = failureReport({ jobs: { ...GREEN, "template-unchanged": "failure" }, unit: UNIT, run: RUN, range: RANGE, templateLine: line });
    assert.ok(failed.includes(`**Template check:** ${line}`), failed);
    const unreadable = failureReport({ jobs: { ...GREEN, "template-unchanged": "failure" }, unit: UNIT, run: RUN, range: RANGE, templateLine: null });
    assert.ok(unreadable.includes("**Template check:** its line can't be read: the job failed before its summary."), unreadable);
    const passed = failureReport({ jobs: RED, unit: UNIT, run: RUN, range: RANGE, templateLine: "6211ae7 -> x: 172 inputs, 172 identical, 0 different" });
    assert.ok(!passed.includes("Template check"), passed);
});

test("the issue job's own result doesn't change the night's verdict", () => {
    assert.equal(nightlyPassed({ ...GREEN, issue: "failure" }), true);
    assert.equal(nightlyPassed({ ...RED, issue: "success" }), false);
});

const SUMMARY_RUN = { url: RUN.url, trigger: "workflow_dispatch", commit: RUN.commit, base: "6211ae7", date: RUN.date };
const summary = (jobs, issue) => buildSummary({ jobs, unit: { ...UNIT, duration_ms: 60000 }, templateLine: "x", run: SUMMARY_RUN, issue }).body;

test("the email links the issue it opened, updated or closed, right under the run's link", () => {
    const url = "https://github.com/o/r/issues/4";
    assert.ok(summary({ ...RED, issue: "success" }, { action: "open", url }).startsWith(`${RUN.url}\n\nFailure issue: opened ${url}\n\n`));
    assert.ok(summary({ ...RED, issue: "success" }, { action: "comment", url }).includes(`Failure issue: updated ${url}`));
    assert.ok(summary({ ...GREEN, issue: "success" }, { action: "close", url }).includes(`Failure issue: closed ${url}`));
});

test("the email says so when the issue job couldn't do its part, and says nothing on a quiet green night", () => {
    assert.ok(summary({ ...RED, issue: "failure" }, null).includes("Failure issue: not opened or updated, as the issue job failed; see the run."));
    assert.ok(summary({ ...GREEN, issue: "cancelled" }, null).includes("Failure issue: the issue job was cancelled, so an open one may still need closing; see the run."));
    assert.ok(!summary({ ...GREEN, issue: "success" }, { action: "none", url: "" }).includes("Failure issue"));
    // A run from before the issue job (no such job in needs) has no line at all.
    assert.ok(!summary(GREEN, null).includes("Failure issue"));
});

/** Runs notify.mjs's issue command against fake-gh.mjs, with `state` as GitHub, and returns the new state and outputs. */
function runIssueCommand(folder, state, jobs) {
    const statePath = join(folder, "state.json");
    writeFileSync(statePath, JSON.stringify(state), "utf8");
    const outputs = { unit: { summary: JSON.stringify(UNIT) }, "template-unchanged": { line: "435d78f -> 369f0c7: 172 inputs, 170 identical, 2 different" } };
    const needs = Object.fromEntries(Object.entries(jobs).map(([job, result]) => [job, { result, outputs: outputs[job] ?? {} }]));
    const stdout = execFileSync(process.execPath, [join(here, "notify.mjs"), "issue"], {
        encoding: "utf8",
        env: { ...process.env, NIGHTLY_GH_SCRIPT: join(here, "fake-gh.mjs"), FAKE_GH_STATE: statePath, NEEDS: JSON.stringify(needs), GITHUB_REPOSITORY: "o/r", RUN_URL: RUN.url, COMMIT: RUN.commit, BRANCH: state.branch, WORKFLOW_FILE: "nightly.yml" },
        stdio: ["ignore", "pipe", "pipe"],
    });
    return { state: JSON.parse(readFileSync(statePath, "utf8")), outputs: stdout };
}

test("through notify.mjs and a stand-in gh: a red night opens the issue, a second comments on it, a green one closes it", () => {
    const folder = mkdtempSync(join(tmpdir(), "tfp252-"));
    try {
        let state = { repo: "o/r", defaultBranch: "main", branch: "main", green: { head_sha: RANGE.from, html_url: RANGE.greenRunUrl }, commits: [{ sha: commit(1).sha, commit: { message: "commit 1\n\nits body, not shown" } }], issues: [{ number: 1, title: "Something else", url: "u1", state: "open", comments: [] }], calls: [] };

        const first = runIssueCommand(folder, state, RED);
        state = first.state;
        assert.equal(first.outputs, "action=open\nurl=https://github.com/o/r/issues/2\n");
        assert.deepEqual(state.issues.map(({ title, state: open }) => [title, open]), [["Something else", "open"], ["Nightly failing", "open"]]);
        assert.ok(state.issues[1].body.includes("first failure") && state.issues[1].body.includes("0000001 commit 1\n"), state.issues[1].body);
        assert.ok(!state.issues[1].body.includes("its body"), "a commit is listed by its subject line only");
        assert.ok(!state.issues[1].body.includes("Template check"), "a passing template check adds no line");

        // As live run 2 was: only the template check red. Its line, from the job's output, reaches the comment.
        const templateRed = runIssueCommand(folder, { ...state, calls: [] }, { ...GREEN, "template-unchanged": "failure" });
        assert.ok(templateRed.state.issues[1].comments[0].includes("**Template check:** 435d78f -> 369f0c7: 172 inputs, 170 identical, 2 different"), templateRed.state.issues[1].comments[0]);
        state = { ...templateRed.state, issues: templateRed.state.issues.map((issue) => (issue.number === 2 ? { ...issue, comments: [] } : issue)) };

        const second = runIssueCommand(folder, { ...state, calls: [] }, RED);
        state = second.state;
        assert.equal(second.outputs, "action=comment\nurl=https://github.com/o/r/issues/2\n");
        assert.equal(state.issues.length, 2, "a second red night opens no second issue");
        assert.equal(state.issues[1].comments.length, 1);
        assert.ok(!state.calls.some((call) => call.startsWith("issue create")), state.calls.join("\n"));

        const green = runIssueCommand(folder, { ...state, calls: [] }, GREEN);
        state = green.state;
        assert.equal(green.outputs, "action=close\nurl=https://github.com/o/r/issues/2\n");
        assert.equal(state.issues[1].state, "closed");
        assert.ok(state.issues[1].comments[1].startsWith("Green again:"), state.issues[1].comments[1]);
        assert.equal(state.issues[0].state, "open", "an issue with another title is left alone");

        const quiet = runIssueCommand(folder, { ...state, calls: [] }, GREEN);
        assert.equal(quiet.outputs, "action=none\nurl=\n");
        assert.ok(quiet.state.calls.every((call) => call.startsWith("api ") || call.startsWith("issue list")), `a quiet green night only reads: ${quiet.state.calls.join("; ")}`);
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
});

test("through notify.mjs: a branch's red night opens that branch's issue, not main's, and a range it can't list is said", () => {
    const folder = mkdtempSync(join(tmpdir(), "tfp252-"));
    try {
        const state = { repo: "o/r", defaultBranch: "main", branch: "tfp-252-check", green: { head_sha: RANGE.from, html_url: RANGE.greenRunUrl }, compareFails: true, commits: [], issues: [{ number: 1, title: "Nightly failing", url: "u1", state: "open", comments: [] }], calls: [] };
        const { state: after, outputs } = runIssueCommand(folder, state, RED);
        assert.equal(outputs, "action=open\nurl=https://github.com/o/r/issues/2\n");
        assert.equal(after.issues[1].title, "Nightly failing on tfp-252-check");
        assert.equal(after.issues[0].comments.length, 0, "main's issue is untouched");
        // gh's own reason, not just "Command failed".
        assert.ok(after.issues[1].body.includes("the commits couldn't be listed: gh api repos/o/r/compare/1111111aaaaaaa...abcdef1234567890: gh: Not Found (HTTP 404)"), after.issues[1].body);
        assert.ok(after.calls.some((call) => call.includes("branch=tfp-252-check")), after.calls.join("\n"));
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
});

test("through notify.mjs: a red night whose green run can't be looked up still opens the issue, and says why", () => {
    const folder = mkdtempSync(join(tmpdir(), "tfp252-"));
    try {
        const state = { repo: "o/r", defaultBranch: "main", branch: "main", runsFail: true, commits: [], issues: [], calls: [] };
        const { state: after, outputs } = runIssueCommand(folder, state, RED);
        assert.equal(outputs, "action=open\nurl=https://github.com/o/r/issues/1\n");
        assert.ok(after.issues[0].body.includes("the last green run couldn't be found: gh api "), after.issues[0].body);
        assert.ok(after.issues[0].body.includes("gh: Server Error (HTTP 502)"), after.issues[0].body);
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
});

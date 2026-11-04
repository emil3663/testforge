// TFP-252: the nightly's failure issue. One open issue per branch says the night is red: opened by the first failing
// run, commented on by each one after, and closed by the next green run. Pure, so it can be unit-tested; notify.mjs
// asks GitHub (through `gh`) for what's open and the range, and carries out the plan.

import { unreadable } from "./summary.mjs";

export const ISSUE_TITLE = "Nightly failing";
export const MAX_RANGE_COMMITS = 20;

/** The default branch's issue is "Nightly failing"; a branch's own runs keep theirs apart, so its green can't close main's. */
export function issueTitle(branch, defaultBranch) {
    return branch === defaultBranch ? ISSUE_TITLE : `${ISSUE_TITLE} on ${branch}`;
}

// A fence keeps test names and commit subjects as text: an @name in one would otherwise notify that GitHub user. It is
// longer than any run of ~ inside, so a name holding one can't close it early.
function fenced(lines) {
    const longest = Math.max(0, ...lines.map((line) => Math.max(0, ...(line.match(/~+/g) ?? []).map((run) => run.length))));
    const fence = "~".repeat(Math.max(4, longest + 1));
    return [`${fence}text`, ...lines, fence];
}

function failingSection(unit, result) {
    if (!unit) return [`**Failing tests:** can't be read (the unit job's result: ${result ?? "not reported"}).`];
    if (unit.failing.length === 0) return [`**Failing tests:** none (${unit.fail} failed, ${unit.tests} tests).`];
    const more = unit.fail - unit.failing.length;
    return [`**Failing tests** (${unit.fail} of ${unit.tests}):`, "", ...fenced([...unit.failing, ...(more > 0 ? [`and ${more} more`] : [])])];
}

// A failure outside the unit job is otherwise named only by its result. The template check is the one other job with a
// line of its own, so a red one carries it, as the email does.
function templateSection(line, result) {
    if (result === "success" || result === undefined) return [];
    return [`**Template check:** ${line ?? unreadable("its line", result)}`, ""];
}

function rangeSection(range, branch) {
    if (!range) return [`**Since the last green run:** no run of this workflow on ${branch} has been green, so there is no range.`];
    if (!range.from) return [`**Since the last green run:** the last green run couldn't be found: ${range.error}`];
    if (range.error) return [`**Since the last green run** (${range.greenRunUrl}, at \`${range.from.slice(0, 7)}\`): the commits couldn't be listed: ${range.error}`];
    const shown = range.commits.slice(0, MAX_RANGE_COMMITS);
    // The compare API lists at most 250 commits; its total counts them all.
    const total = range.total ?? range.commits.length;
    const more = total - shown.length;
    const count = `${total} commit${total === 1 ? "" : "s"}`;
    return [
        `**Since the last green run** (${range.greenRunUrl}, at \`${range.from.slice(0, 7)}\`): ${count}, ${range.compareUrl}`,
        ...(shown.length ? ["", ...fenced([...shown.map(({ sha, subject }) => `${sha.slice(0, 7)} ${subject}`), ...(more > 0 ? [`and ${more} more`] : [])])] : []),
    ];
}

/**
 * The report for a red night. jobs: each job's result by name. unit: parseUnitLog's result, or null.
 * templateLine: the template check's line (parseTemplateLine's), or null.
 * run: { url, commit, date, branch }. range: { from, greenRunUrl, compareUrl, commits: [{ sha, subject }], total },
 * with `error` in place of the commits when they couldn't be listed (and in place of all but `error` when the green
 * run couldn't be looked up), or null when no run has been green.
 *
 * "Green" here is the workflow run's own conclusion, which counts the issue and notify jobs too, so a night whose
 * checks passed but whose email failed isn't a start: the range is then longer than it need be, never shorter.
 */
export function failureReport({ jobs, unit, run, range, templateLine = null }) {
    return [
        `Nightly run ${run.url} failed at \`${run.commit.slice(0, 7)}\` (${run.date}).`,
        "",
        `**Jobs:** ${Object.entries(jobs).map(([job, result]) => `${job}: ${result}`).join(", ")}`,
        "",
        ...failingSection(unit, jobs.unit),
        "",
        ...templateSection(templateLine, jobs["template-unchanged"]),
        ...rangeSection(range, run.branch),
    ].join("\n");
}

/**
 * What to do with the issue. passed: the night's verdict (summary.mjs's). open: the open issue with this title,
 * { number, url }, or null. report: failureReport's text, for a red night.
 */
export function planIssue({ passed, open, report, run }) {
    if (passed) {
        return open ? { action: "close", number: open.number, url: open.url, body: `Green again: ${run.url} at \`${run.commit.slice(0, 7)}\` (${run.date}).` } : { action: "none" };
    }
    return open ? { action: "comment", number: open.number, url: open.url, body: report } : { action: "open", body: report };
}

// TFP-217: the nightly's summary, built from the jobs' results. Pure, so it can be unit-tested; notify.mjs does the
// reading and writing. A job that didn't succeed, or didn't report, makes the night a FAIL.

/** Every job of nightly.yml the summary reports on. notify's `needs` lists the same four, and the issue job (TFP-252). */
const JOBS = ["unit", "audit", "dead-code", "template-unchanged"];
export const MAX_FAILING_NAMES = 20;
const COUNTS = ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo", "duration_ms"];
const SHOWN_COUNTS = ["tests", "pass", "fail", "cancelled", "skipped"];

const stripColour = (text) => text.replace(/\u001b\[[0-9;]*m/g, "");

/** node:test's closing summary and the names under "failing tests:", or null when the summary isn't all there. */
export function parseUnitLog(log) {
    const lines = stripColour(log).split(/\r?\n/);
    const summary = {};
    for (const name of COUNTS) {
        const line = lines.findLast((text) => new RegExp(`^ℹ ${name} [\\d.]+$`).test(text));
        if (!line) return null;
        summary[name] = Number(line.split(" ")[2]);
    }
    const heading = lines.indexOf("✖ failing tests:");
    // A failure's own detail is indented; only a test's name starts its line.
    const names = heading < 0 ? [] : lines.slice(heading + 1).filter((line) => line.startsWith("✖ ")).map((line) => line.slice(2).replace(/ \([\d.]+ms\)$/, ""));
    // Capped here too: the names travel as a job output and then an environment variable, which have limits.
    return { ...summary, failing: [...new Set(names)].slice(0, MAX_FAILING_NAMES) };
}

/** The template check's `<base> -> <head>: N inputs, N identical, N different`, or null. */
export function parseTemplateLine(log) {
    const line = stripColour(log).split(/\r?\n/).find((text) => /^template-unchanged: \S+ -> \S+: \d+ inputs, \d+ identical, \d+ different/.test(text));
    return line ? line.replace(/^template-unchanged: /, "") : null;
}

export function unreadable(what, result) {
    const ended = { failure: "failed", cancelled: "was cancelled", skipped: "was skipped" }[result] ?? "wasn't reported";
    const why = result === "success" ? "the job's summary wasn't found in its log" : `the job ${ended} before its summary`;
    return `${what} can't be read: ${why}.`;
}

/** The night's verdict: every job succeeded. The failure issue (TFP-252) opens and closes on the same one. */
export function nightlyPassed(jobs) {
    return JOBS.every((job) => jobs[job] === "success");
}

// TFP-252: what the issue job did, or that it couldn't. issue: { action, url } from its outputs; result: its job's.
function issueLines(issue, result, passed) {
    const done = { open: "opened", comment: "updated", close: "closed" }[issue?.action];
    if (done && issue.url) return [`Failure issue: ${done} ${issue.url}`, ""];
    if (result === undefined || (issue?.action === "none" && result === "success")) return [];
    const ended = { failure: "failed", cancelled: "was cancelled", skipped: "was skipped" }[result] ?? "didn't report";
    return [passed ? `Failure issue: the issue job ${ended}, so an open one may still need closing; see the run.` : `Failure issue: not opened or updated, as the issue job ${ended}; see the run.`, ""];
}

function failingLines({ failing, fail }) {
    if (failing.length === 0) return [];
    const shown = failing.slice(0, MAX_FAILING_NAMES);
    const more = fail - shown.length;
    return ["", "Failing tests:", ...shown, ...(more > 0 ? [`and ${more} more`] : [])];
}

/**
 * jobs: each job's result by name. unit: parseUnitLog's result, or null. templateLine: parseTemplateLine's, or null.
 * run: { url, trigger, commit, base, date }. issue: the issue job's { action, url }, or null (TFP-252).
 */
export function buildSummary({ jobs, unit, templateLine, run, issue = null }) {
    const passed = nightlyPassed(jobs);
    const commit = run.commit.slice(0, 7);
    const result = (job) => `${job}: ${jobs[job] ?? "not reported"}`;
    const body = [
        run.url,
        "",
        ...issueLines(issue, jobs.issue, passed),
        `Trigger: ${run.trigger}`,
        `Commit: ${commit}`,
        `Template base: ${run.base}`,
        "",
        result("unit"),
        unit ? [...SHOWN_COUNTS.map((name) => `${name} ${unit[name]}`), `duration ${(unit.duration_ms / 60_000).toFixed(1)} min`].join(", ") : unreadable("Counts", jobs.unit),
        ...(unit ? failingLines(unit) : []),
        "",
        result("template-unchanged"),
        templateLine ?? unreadable("Check line", jobs["template-unchanged"]),
        "",
        result("audit"),
        result("dead-code"),
    ].join("\n");
    return { subject: `TestForge nightly: ${passed ? "PASS" : "FAIL"} · ${commit} · ${run.date}`, body, passed };
}

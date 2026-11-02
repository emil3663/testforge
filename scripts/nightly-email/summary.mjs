// TFP-217: the nightly's summary, built from the jobs' results. Pure, so it can be unit-tested; notify.mjs does the
// reading and writing. A job that didn't succeed, or didn't report, makes the night a FAIL.

/** Every job of nightly.yml the summary reports on. notify's `needs` lists the same four. */
const JOBS = ["unit", "audit", "dead-code", "template-unchanged"];
export const MAX_FAILING_NAMES = 20;
const COUNTS = ["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo", "duration_ms"];
const SHOWN_COUNTS = ["tests", "pass", "fail", "cancelled", "skipped", "duration_ms"];

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

function unreadable(what, result) {
    const ended = { failure: "failed", cancelled: "was cancelled", skipped: "was skipped" }[result] ?? "wasn't reported";
    const why = result === "success" ? "the job's summary wasn't found in its log" : `the job ${ended} before its summary`;
    return `${what} can't be read: ${why}.`;
}

function failingLines({ failing, fail }) {
    if (failing.length === 0) return [];
    const shown = failing.slice(0, MAX_FAILING_NAMES);
    const more = fail - shown.length;
    return ["", "Failing tests:", ...shown, ...(more > 0 ? [`and ${more} more`] : [])];
}

/**
 * jobs: each job's result by name. unit: parseUnitLog's result, or null. templateLine: parseTemplateLine's, or null.
 * run: { url, trigger, commit, base, date }.
 */
export function buildSummary({ jobs, unit, templateLine, run }) {
    const passed = JOBS.every((job) => jobs[job] === "success");
    const commit = run.commit.slice(0, 7);
    const result = (job) => `${job}: ${jobs[job] ?? "not reported"}`;
    const body = [
        run.url,
        "",
        `Trigger: ${run.trigger}`,
        `Commit: ${commit}`,
        `Template base: ${run.base}`,
        "",
        result("unit"),
        unit ? SHOWN_COUNTS.map((name) => `${name} ${unit[name]}`).join(", ") : unreadable("Counts", jobs.unit),
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

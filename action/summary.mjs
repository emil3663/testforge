// Phase 47 (TFP-248): the action's job summary, in Markdown, from a run's report.json and baseline.json (Decision 7's
// outputs). What a reader of the job needs first: the verdict and why, the counts, and the failures that decided it -
// with a baseline, the new ones. Run by summary.sh in the image's own Node; the full report is the attached
// report.html.
//
//   node summary.mjs <out folder> <exit code> <url>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LISTED = 20;

const VERDICTS = {
    0: { plain: "passed: no test failed", compared: "passed: no new failures" },
    1: { plain: "failed: tests failed", compared: "failed: new failures" },
    2: { plain: "couldn't run", compared: "couldn't run" },
    3: { plain: "invalid configuration", compared: "invalid configuration" },
};

const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function list(heading, tests) {
    if (tests.length === 0) return [];
    const lines = [`**${heading}** (${tests.length})`, ""];
    for (const test of tests.slice(0, LISTED)) lines.push(`- ${cell(test.title)}`);
    if (tests.length > LISTED) lines.push(`- ... and ${tests.length - LISTED} more, in report.html`);
    return [...lines, ""];
}

/** The summary. `report` is report.json's content or null; `comparison` is baseline.json's or null. */
export function buildSummary({ report, comparison, exitCode, url }) {
    const summary = report?.report?.summary;
    // --report-only exits 0 whatever failed: then exit 0 isn't "passed".
    const failing = comparison ? comparison.failures.new.length : (summary?.failed ?? 0) + (summary?.blocked ?? 0);
    const verdict = exitCode === 0 && failing > 0
        ? { plain: "reported, not failing the build: tests failed", compared: "reported, not failing the build: new failures" }
        : VERDICTS[exitCode] ?? { plain: `exit ${exitCode}`, compared: `exit ${exitCode}` };
    const lines = [`### Mr Onion: ${verdict[comparison ? "compared" : "plain"]} (exit ${exitCode})`, "", `Target: ${url}`, ""];
    if (!summary) {
        lines.push(exitCode === 3 ? "No run: the configuration was rejected. The step's log names the field." : "No report was written: the step's log says why the run couldn't run.");
        return `${lines.join("\n")}\n`;
    }
    lines.push(
        "| Planned | Passed | Failed | Blocked | Flaky | Not run |",
        "| ---: | ---: | ---: | ---: | ---: | ---: |",
        `| ${summary.planned} | ${summary.passed} | ${summary.failed} | ${summary.blocked} | ${summary.flaky ?? 0} | ${summary.notRun} |`,
        ""
    );
    if (comparison) {
        const { known, new: added, fixed } = comparison.failures;
        lines.push(`Compared with the run of ${comparison.baseline.finishedAt}: ${added.length} new, ${known.length} known, ${fixed.length} fixed.`, "");
        lines.push(...list("New failures", added), ...list("Fixed since the baseline", fixed));
    } else {
        const failing = (report.report.execution ?? []).filter((record) => record.status === "Failed" || record.status === "Blocked");
        lines.push(...list("Failing tests", failing));
    }
    const by = report.producedBy;
    if (by) lines.push(`Mr Onion ${by.version}${by.commit ? ` (${by.commit})` : ""}. The full report is report.html in the attached artifact.`);
    return `${lines.join("\n")}\n`;
}

function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch {
        return null;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [out, exitCode, url] = process.argv.slice(2);
    process.stdout.write(buildSummary({ report: readJson(join(out, "report.json")), comparison: readJson(join(out, "baseline.json")), exitCode: Number(exitCode), url }));
}

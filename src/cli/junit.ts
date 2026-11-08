import type { ExecutionRecord, RunReport } from "@/lib/report/types";

/**
 * Phase 47 Decision 7 (TFP-245): the run's report as JUnit XML, for a pipeline's test view. Built from the report's
 * own execution records, so its counts are the report's: tests = planned, failures = Failed, errors = Blocked
 * (didn't execute, unexplained), skipped = Not run (skipped itself, with its reason). A Flaky test passed on retry.
 */

// XML 1.0 can't carry most control characters even escaped; a test's message can hold terminal colour codes.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

function escape(text: string) {
    return text
        .replace(ANSI, "")
        .replace(INVALID_XML, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const seconds = (ms: number) => (Math.max(0, ms) / 1000).toFixed(3);
const firstLine = (text: string) => text.replace(ANSI, "").split("\n").find((line) => line.trim())?.trim() ?? "";

function testcase(record: ExecutionRecord, suite: string) {
    const open = `    <testcase name="${escape(record.title)}" classname="${escape(suite)}" time="${seconds(record.duration)}"`;
    const body = (() => {
        switch (record.status) {
            case "Failed":
                return `      <failure message="${escape(firstLine(record.rawMessage) || "failed")}">${escape(record.rawMessage)}</failure>\n`;
            case "Blocked":
                return `      <error message="${escape(firstLine(record.remarks) || "blocked: did not execute")}">${escape(record.remarks)}</error>\n`;
            case "Not run":
                return `      <skipped message="${escape(record.skipReason ?? "skipped itself")}"/>\n`;
            case "Flaky":
                return "      <system-out>flaky: passed on retry</system-out>\n";
            default:
                return "";
        }
    })();
    return body ? `${open}>\n${body}    </testcase>\n` : `${open}/>\n`;
}

function counts(records: ExecutionRecord[]) {
    return {
        tests: records.length,
        failures: records.filter((record) => record.status === "Failed").length,
        errors: records.filter((record) => record.status === "Blocked").length,
        skipped: records.filter((record) => record.status === "Not run").length,
        time: seconds(records.reduce((sum, record) => sum + record.duration, 0)),
    };
}

const attributes = (values: ReturnType<typeof counts>) =>
    `tests="${values.tests}" failures="${values.failures}" errors="${values.errors}" skipped="${values.skipped}" time="${values.time}"`;

export function buildJUnit(report: Pick<RunReport, "execution">, name = "TestForge"): string {
    const records = [...report.execution].sort((left, right) => left.order - right.order);
    const suites = new Map<string, ExecutionRecord[]>();
    for (const record of records) {
        const suite = record.suite || record.area || name;
        suites.set(suite, [...(suites.get(suite) ?? []), record]);
    }
    const body = [...suites].map(([suite, members]) =>
        `  <testsuite name="${escape(suite)}" ${attributes(counts(members))}>\n${members.map((record) => testcase(record, suite)).join("")}  </testsuite>\n`
    ).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="${escape(name)}" ${attributes(counts(records))}>\n${body}</testsuites>\n`;
}

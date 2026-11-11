/**
 * Phase 47 (TFP-245): the JUnit file's counts are the report's (Acceptance Criteria 2), and its failing cases are
 * the report's failing tests, by name.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/junit.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSummary } from "../lib/report/summary.ts";
import type { ExecutionRecord, ExecutionStatus } from "../lib/report/types.ts";
import { buildJUnit } from "./junit.ts";

let order = 0;
function record(title: string, status: ExecutionStatus, extra: Partial<ExecutionRecord> = {}): ExecutionRecord {
    order += 1;
    return {
        id: `t${order}`, title, description: "", suite: "Functional", area: "functional", interactionType: null, browser: "chromium",
        status, duration: 1500, remarks: "", rawMessage: "", reproductionSteps: [], artifacts: [], order, ...extra,
    };
}

const EXECUTION = [
    record("home page loads", "Passed"),
    record("contact form submits", "Failed", { rawMessage: "\u001b[31mError: expect(received).toBe(expected)\u001b[39m\n\nExpected: 200\nReceived: 500 <html>" }),
    record("cart total & tax", "Failed", { suite: "Usability", rawMessage: "Error: total was \"0\"" }),
    record("search answers", "Flaky"),
    record("checkout journey", "Not run", { skipReason: "interactive tests are off" }),
    record("menu opens", "Blocked", { remarks: "Interrupted: the run stopped" }),
];

const attribute = (xml: string, element: string, name: string) => xml.match(new RegExp(`<${element} [^>]*${name}="([^"]*)"`))?.[1];

test("the JUnit totals are the report summary's: tests planned, failures Failed, errors Blocked, skipped Not run", () => {
    const summary = buildSummary(EXECUTION, [], 0);
    const xml = buildJUnit({ execution: EXECUTION });
    assert.equal(Number(attribute(xml, "testsuites", "tests")), summary.planned);
    assert.equal(Number(attribute(xml, "testsuites", "failures")), summary.failed);
    assert.equal(Number(attribute(xml, "testsuites", "errors")), summary.blocked);
    assert.equal(Number(attribute(xml, "testsuites", "skipped")), summary.notRun);
    assert.equal((xml.match(/<testcase /g) ?? []).length, summary.planned);
});

test("the failing cases are the report's failing tests, by name; the message is escaped and has no colour codes", () => {
    const xml = buildJUnit({ execution: EXECUTION });
    const failing = [...xml.matchAll(/<testcase name="([^"]*)"[^>]*>\s*<failure /g)].map((match) => match[1]);
    assert.deepEqual(failing, ["contact form submits", "cart total &amp; tax"]);
    assert.ok(xml.includes('<failure message="Error: expect(received).toBe(expected)">'), "the first line, without the colour codes");
    assert.ok(xml.includes("Received: 500 &lt;html&gt;"));
    assert.ok(!xml.includes("\u001b"));
    assert.ok(xml.includes('<skipped message="interactive tests are off"/>'));
    assert.ok(xml.includes('<error message="Interrupted: the run stopped">'));
});

test("each suite has its own counts, and tests are in the report's order", () => {
    const xml = buildJUnit({ execution: [...EXECUTION].reverse() });
    assert.match(xml, /<testsuite name="Functional" tests="5" failures="1" errors="1" skipped="1" time="7\.500">/);
    assert.match(xml, /<testsuite name="Usability" tests="1" failures="1" errors="0" skipped="0" time="1\.500">/);
    const titles = [...xml.matchAll(/<testcase name="([^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(titles, ["home page loads", "contact form submits", "search answers", "checkout journey", "menu opens", "cart total &amp; tax"]);
});

test("Phase 48 (TFP-279): the suites are named Mr Onion, and a record with no suite or area falls back to that name", () => {
    const xml = buildJUnit({ execution: [record("no suite of its own", "Passed", { suite: "", area: "" as never })] });
    assert.equal(attribute(xml, "testsuites", "name"), "Mr Onion");
    assert.equal(attribute(xml, "testsuite", "name"), "Mr Onion");
    assert.match(xml, /<testcase name="no suite of its own" classname="Mr Onion"/);
});

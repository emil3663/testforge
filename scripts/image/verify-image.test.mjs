// Phase 47 (TFP-247): the checks the release depends on. verify-image.mjs and check-pins.mjs decide whether an image
// is published, so each check is shown failing on the output it exists to catch.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pinFailures } from "./check-pins.mjs";
import { impliedExit, junitTotals, outputFailures, pinsFailures } from "./verify-image.mjs";

const summary = { planned: 12, executed: 10, passed: 7, failed: 2, flaky: 0, blocked: 1, notRun: 2 };
const result = { report: { summary }, producedBy: { version: "0.4.0", commit: "abc1234" } };
const junit = (tests, failures, errors, skipped) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="Mr Onion" tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="1.000">\n  <testsuite name="a" tests="1" failures="0" errors="0" skipped="0" time="0.1">\n  </testsuite>\n</testsuites>\n`;

test("junitTotals reads <testsuites>, not the first <testsuite>", () => {
    assert.deepEqual(junitTotals(junit(12, 2, 1, 2)), { tests: 12, failures: 2, errors: 1, skipped: 2 });
    assert.equal(junitTotals("<testsuite tests=\"1\"/>"), null);
});

test("outputFailures: JUnit totals equal to the report's, with the version and commit expected, pass", () => {
    assert.deepEqual(outputFailures(result, junit(12, 2, 1, 2), { version: "0.4.0", commit: "abc1234" }), []);
});

test("outputFailures names each total that differs from the report's", () => {
    assert.deepEqual(outputFailures(result, junit(11, 2, 0, 2)), [
        "junit.xml tests=11; the report's planned is 12",
        "junit.xml errors=0; the report's blocked is 1",
    ]);
});

test("outputFailures fails a run with no JUnit, no report, or nothing executed", () => {
    assert.deepEqual(outputFailures(result, null), ["junit.xml is missing or has no <testsuites>"]);
    assert.deepEqual(outputFailures({}, junit(12, 2, 1, 2)), ["report.json has no report summary"]);
    const none = { report: { summary: { ...summary, executed: 0 } } };
    assert.deepEqual(outputFailures(none, junit(12, 2, 1, 2)), ["no test executed (executed=0)"]);
});

test("outputFailures fails a report made by another version or commit", () => {
    assert.deepEqual(outputFailures(result, junit(12, 2, 1, 2), { version: "0.3.0", commit: "def5678" }), [
        "the report says version 0.4.0; expected 0.3.0",
        "the report says commit abc1234; expected def5678",
    ]);
});

test("impliedExit: 1 with a failed or blocked test, 0 with --report-only or none", () => {
    assert.equal(impliedExit(result, false), 1);
    assert.equal(impliedExit(result, true), 0);
    assert.equal(impliedExit({ report: { summary: { ...summary, failed: 0, blocked: 0 } } }, false), 0);
    assert.equal(impliedExit({ report: { summary: { ...summary, failed: 0, blocked: 1 } } }, false), 1);
});

const lock = { packages: { "node_modules/playwright-core": { version: "1.59.1" }, "node_modules/playwright": { version: "1.59.1" }, "node_modules/@playwright/test": { version: "1.59.1" } } };

test("pinsFailures: the image's Ubuntu and Playwright against CI's pin and the lockfile", () => {
    assert.deepEqual(pinsFailures({ os: "24.04", playwright: "1.59.1" }, lock), []);
    assert.deepEqual(pinsFailures({ os: "26.04", playwright: "1.60.0" }, lock), [
        "the image's Ubuntu is 26.04, not 24.04 (CI's runner pin)",
        "the image's Playwright is 1.60.0; the lockfile says 1.59.1",
    ]);
    assert.equal(pinsFailures(null, lock).length, 2);
});

const pins = {
    nodeVersion: "v24.14.1",
    nvmrc: "24\n",
    lock,
    installed: { "playwright-core": "1.59.1", playwright: "1.59.1", "@playwright/test": "1.59.1" },
    browsersJson: { browsers: [{ name: "chromium", revision: "1217" }, { name: "chromium-headless-shell", revision: "1217" }] },
    browsersPath: "/ms-playwright",
    browserInstalled: (path) => path.replace(/\\/g, "/") === "/ms-playwright/chromium_headless_shell-1217",
    buildVersion: "0.4.0",
    packageVersion: "0.4.0",
};

test("pinFailures: what the image installed agrees with the repo", () => {
    assert.deepEqual(pinFailures(pins), []);
    assert.deepEqual(pinFailures({ ...pins, buildVersion: "" }), []);
});

test("pinFailures names a Node major, a Playwright, a Chromium or a version that drifted", () => {
    assert.deepEqual(pinFailures({ ...pins, nodeVersion: "v26.0.0" }), ["Node v26.0.0 isn't .nvmrc's 24"]);
    assert.deepEqual(pinFailures({ ...pins, installed: { ...pins.installed, "@playwright/test": "1.60.0" } }), ["@playwright/test 1.60.0; the lockfile says 1.59.1"]);
    assert.deepEqual(pinFailures({ ...pins, browserInstalled: () => false }), ["Chromium's headless shell 1217 isn't installed in /ms-playwright"]);
    assert.deepEqual(pinFailures({ ...pins, browsersPath: undefined }), ["PLAYWRIGHT_BROWSERS_PATH isn't set"]);
    assert.deepEqual(pinFailures({ ...pins, buildVersion: "0.3.0" }), ["the build says version 0.3.0; package.json says 0.4.0"]);
    assert.deepEqual(pinFailures({ ...pins, browsersJson: { browsers: [{ name: "chromium", revision: "1217" }] } }), ["Playwright names no chromium-headless-shell"]);
    const packages = Object.fromEntries(Object.entries(lock.packages).filter(([name]) => name !== "node_modules/playwright"));
    assert.deepEqual(pinFailures({ ...pins, lock: { packages } }), ["playwright isn't in package-lock.json"]);
});

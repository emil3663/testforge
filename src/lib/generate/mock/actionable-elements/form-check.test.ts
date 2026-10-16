/**
 * TFP-160: the form check finds the <form> itself by its recorded action,
 * method and occurrence, and asserts each recorded field is inside it
 * (decided by Emil, 2026-10-06).
 *
 * ISTQB technique: error guessing, from the two failures recorded on
 * practicesoftwaretesting.com (TFP-150, T21 and T22): a lone <select> in a
 * form (matched by its options' joined text, so fields were counted inside
 * the <select>), and a form of several labelled fields (looked up by its
 * labels joined, which no element holds). Plus the field assertion's own
 * failure: a recorded field that is gone.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/actionable-elements/form-check.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord } from "../../../report/types.ts";
import type { ActionableElementDetail } from "../types.ts";

const { buildFormCheckTest } = await import("./form-check.ts");
const { buildActionableElementTests } = await import("./functional.ts");
const { inspectPages } = await import("../../../introspect/inspector.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { startRecordedFixture } = await import("../../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `form-check-unit-${label}`, []);
    return flattenSuites(report.suites);
}

const suite = (origin: string, tests: string[]) => `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${origin}' });\ntest.describe('Functional', () => {\n${tests.join("\n\n")}\n});\n`;

test("in a real browser: on /forms, the multi-field form and the lone-<select> form each find their own <form> and its recorded fields; a missing field fails, named", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const formChecks = async () => {
            const inspection = await inspectPages(fixture.origin, ["/forms"]);
            const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
            const forms = (inspection.pages[0].actionableElements ?? []).filter((element: ActionableElementDetail) => element.elementType === "form");
            const tests = buildActionableElementTests(profile as never, "/forms").filter((code: string) => /form element check: .*\[form\]'/.test(code));
            return { forms, tests };
        };

        await fixture.control("/__fixture/defect?set=none");
        const { forms, tests } = await formChecks();
        // What introspection records: action and method as written, the occurrence, and the fields.
        assert.deepEqual(forms.map((form: ActionableElementDetail) => form.form), [
            { action: "/notes", method: "get", occurrence: 0, fields: [{ tag: "input", type: "", name: "title", id: "f-title" }, { tag: "input", type: "", name: "tag", id: "f-tag" }, { tag: "textarea", type: "", name: "body", id: "f-body" }, { tag: "input", type: "submit", name: "", id: "" }] },
            { action: "", method: "", occurrence: 0, fields: [{ tag: "select", type: "", name: "", id: "" }] },
        ]);
        assert.equal(tests.length, 2, tests.join("\n"));
        const code = suite(fixture.origin, tests);
        assert.deepEqual(findTypeErrors(code), []);
        const clean = (await runSuite(code, "clean")).filter((record) => /form element check: .*\[form\]$/.test(record.title));
        assert.deepEqual(clean.map((record) => record.status), ["Passed", "Passed"], JSON.stringify(clean.map((record) => record.rawMessage.split("\n")[0])));

        // The same suite after the page loses the recorded "tag" field: the multi-field form fails, naming it.
        await fixture.control("/__fixture/defect?set=forms-missing-field");
        const missing = (await runSuite(code, "missing")).filter((record) => /form element check: .*\[form\]$/.test(record.title));
        assert.equal(missing[0].status, "Failed");
        assert.match(missing[0].rawMessage, /fields missing from the form on \/forms: input named "tag"/);
        assert.equal(missing[1].status, "Passed", "the <select> form is unaffected");
    } finally {
        await fixture.close();
    }
});

test("a profile from before TFP-160 (no form record): the check falls back to the nth <form> and 'at least one control'", () => {
    const element = { text: "Sort", url: null, category: "form", elementType: "form", containerLabel: "", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role: "form", name: "Sort", label: "", placeholder: "", id: "", inputType: "" } } as ActionableElementDetail;
    const code = buildFormCheckTest("form element check: Sort", "/", element, 1);
    assert.match(code, /page\.locator\('form'\)\.nth\(1\)/);
    assert.match(code, /expect\(controlCount\)\.toBeGreaterThan\(0\)/);
    assert.doesNotMatch(code, /getByText/);
});

/**
 * TFP-200 (Phase 42 Gate A ruling 2): a control inside its <label> is named
 * as the browser names it - the label's text without the control's own
 * content - so its generated check finds it. On the comparison fixture's
 * /wrapped page, inspected and then checked in a real browser.
 *
 * ISTQB technique: equivalence partitioning over what a wrapping label holds
 * besides its text: a list's options; a list's options and text after it; a
 * textarea's text. Before the fix the list was named "Subject OrderOther",
 * the second "Size ChooseM *" and the textarea "Message Hello" (measured
 * on the code before the fix), and the test failed there. Each
 * check would have found nothing. Gate: read-only.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/introspect/label-names.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../report/types.ts";

const { inspectPages } = await import("./inspector.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentProfile, normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `label-names-unit-${process.pid}-${Date.now()}`;
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(join(dir, `${name}.spec.ts`), code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--timeout=30000", "--workers=1", "--grep", "element check"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0", TESTFORGE_INTERACTIVE: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        return flattenSuites((JSON.parse(await readFile(jsonFile, "utf8")) as JsonReport).suites ?? []);
    } finally {
        await rm(join(dir, `${name}.spec.ts`), { force: true });
        await rm(jsonFile, { force: true });
    }
}

test("a control inside its label is named as the browser names it, and its check finds it (TFP-200)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/wrapped"]);
        const profile = normalizeContentProfile({ scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection });
        assert.ok(profile);
        const names = Object.fromEntries((profile.pages[0]?.actionableElements ?? [])
            .filter((element) => element.elementType === "select" || element.elementType === "textarea")
            .map((element) => [element.locator.label, element.locator.name]));
        assert.deepEqual(names, { Subject: "Subject", "Size *": "Size *", Message: "Message" });

        const code = mockGenerate(fixture.origin, "Check the wrapped labels.", ["functional"], profile, normalizeContentRules({ paths: ["/wrapped"] }), normalizeTestAuditMode("fast"));
        for (const name of ["Subject", "Size *", "Message"]) assert.ok(code.includes(`name: '${name}', exact: true`), `a check by the name ${name}`);
        const records = await runSuite(code);
        const checks = records.filter((record) => /\[(select|textarea)\]$/.test(record.title));
        assert.equal(checks.length, 3, records.map((record) => record.title).join(" | "));
        for (const check of checks) assert.equal(check.status, "Passed", `${check.title}: ${check.rawMessage}`);
    } finally {
        await fixture.close();
    }
});

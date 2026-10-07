/**
 * TFP-163: controls introspection missed or merged.
 * - Every <input> got the role textbox, so a labelled type="search" field
 *   (role searchbox) was never found by role.
 * - An icon-only button with no text, label or id wasn't recorded, so it got
 *   no name check (Toolshop's show-password toggle, R10).
 * - Same-text buttons under one heading were merged into one record, so only
 *   the first was checked.
 *
 * ISTQB technique: equivalence partitioning, by input type (the role ARIA in
 * HTML gives each); then the fixture's /controls page, inspected, with its
 * generated checks run in a real browser.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/introspect/controls.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../report/types.ts";

const { captureDomSnapshot } = await import("./dom-snapshot.ts");
const { inspectPages } = await import("./inspector.ts");
const { mockGenerate } = await import("../generate/mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../generate/normalize.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("../generate/validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `controls-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--workers=1"], {
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
        await rm(specFile, { force: true });
        await rm(jsonFile, { force: true });
    }
}

const summary = (record: ExecutionRecord) => JSON.stringify({ title: record.title, status: record.status, message: (record.rawMessage ?? "").slice(0, 300) });

test("in a real browser: each input type gets the role ARIA in HTML gives it (equivalence partitioning)", { skip: needsChromium }, async () => {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const types: Array<[string, string]> = [
            ["text", "textbox"], ["email", "textbox"], ["tel", "textbox"], ["url", "textbox"], ["password", "textbox"],
            ["search", "searchbox"], ["number", "spinbutton"], ["range", "slider"],
            ["checkbox", "checkbox"], ["radio", "radio"], ["submit", "button"], ["button", "button"], ["reset", "button"], ["image", "button"],
        ];
        await page.setContent(`<datalist id="d"><option value="a"></option></datalist>${types.map(([type]) => `<label>${type} field <input type="${type}" name="${type}"${type === "button" || type === "submit" || type === "reset" ? ` value="${type} it"` : ""}></label>`).join("")}<label>listed <input type="text" name="listed" list="d"></label>`);
        const snapshot = await page.evaluate(captureDomSnapshot, { requestedPath: "/", maxActionableItems: 40, maxLinkDetails: 10, maxEmbeddedLinkDetails: 10, maxDragDropTargets: 0 });
        const elements = snapshot.actionableElements as Array<{ text: string; locator: { inputType: string; role: string } }>;
        const roleOf = (name: string) => elements.find((element) => element.locator.inputType === name || element.text === name)?.locator.role;
        for (const [type, role] of types) assert.equal(roleOf(type), role, `type="${type}"`);
        // A text field with a list attribute is a combobox.
        assert.equal(elements.find((element) => element.text === "listed")?.locator.role, "combobox");
        // The page's search field is found by that role, as introspection records it.
        assert.equal(await page.getByRole("searchbox", { name: "search field", exact: true }).count(), 1);
        assert.equal(await page.getByRole("textbox", { name: "search field", exact: true }).count(), 0, "never by textbox");
    } finally {
        await browser.close();
    }
});

test("in a real browser: on /controls, the search field is checked by role, the unnamed icon button fails its name check, and each same-text button tests itself", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/controls"]);
        const elements = inspection.pages[0].actionableElements as Array<{ elementType: string; text: string; position?: number; occurrence?: number; locator: { role: string; name: string } }>;
        // Recorded: the search field as a searchbox; the icon button with its position; both "Delete" buttons, apart.
        assert.equal(elements.find((element) => element.locator.name === "Search notes")?.locator.role, "searchbox");
        const buttons = elements.filter((element) => element.elementType === "button").map((element) => `${element.text || "(no text)"} @${element.position} #${element.occurrence}`);
        assert.deepEqual(buttons, ["(no text) @0 #0", "Delete @1 #0", "Delete @2 #1"]);

        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        // The per-element accessibility checks are for the base URL's page, so the base URL is /controls.
        const code = mockGenerate(`${fixture.origin}/controls`, "Check the controls.", ["functional", "accessibility"], profile as never, normalizeContentRules({ paths: ["/controls"] }), normalizeTestAuditMode("fast"));
        assert.deepEqual(findTypeErrors(code), []);
        const records = await runSuite(code, "controls");
        const byTitle = (pattern: RegExp) => records.filter((record) => pattern.test(record.title));

        // The labelled search field, found by its role and name: its checks pass.
        const search = byTitle(/Search notes|: q \[/);
        assert.ok(search.length >= 2, records.map(summary).join("\n"));
        for (const record of search) assert.equal(record.status, "Passed", summary(record));
        // The icon-only button has no accessible name: its name check fails, naming that.
        const iconName = byTitle(/accessible name and role: Untitled button/);
        assert.equal(iconName.length, 1, records.map(summary).join("\n"));
        assert.equal(iconName[0].status, "Failed", summary(iconName[0]));
        assert.match(iconName[0].rawMessage ?? "", /has no accessible name/);
        // Two "Delete" buttons, two action checks, each on its own element: the enabled one passes, the disabled one fails.
        const deletes = byTitle(/action element check: Delete/);
        assert.deepEqual(deletes.map((record) => record.status), ["Passed", "Failed"], deletes.map(summary).join("\n"));
        assert.match(deletes[1].rawMessage ?? "", /toBeEnabled/);
    } finally {
        await fixture.close();
    }
});

/**
 * Phase 41 (TFP-187, Decision 2): the spelling of interface text, in a real
 * browser on the comparison fixture's /words, through the Playwright CLI.
 *
 * ISTQB technique: decision table. Conditions: the page's language (English;
 * another) and its interface text (spelt right; a misspelt heading; a
 * placeholder that is a real word, but not its label's). The clean page also
 * holds what the check must not read: a list of 24 place names, a footer
 * credit naming a brand, and a three-letter aria-label. One column each:
 *   clean                    -> no finding
 *   spelling-misspelt        -> a finding naming "Contakt", the heading and "Contact"
 *   spelling-placeholder     -> a finding naming "massage" and the label's "Message"
 *   spelling-other-language  -> Not run, naming the language
 * The check's own technique is error guessing, named in the generated test.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/spelling.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../../report/types.ts";

const { mockGenerate } = await import("./index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");
const { inspectPages } = await import("../../introspect/inspector.ts");
const { flattenSuites } = await import("../../report/execution.ts");
const { findTypeErrors } = await import("../validate.ts");
const { startRecordedFixture } = await import("../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `spelling-unit-${label}-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--timeout=30000", "--workers=1", "--grep", "spells its interface text"], {
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

test("one spelling check per inspected page in the SEO/content area, and the suite type-checks", () => {
    const code = mockGenerate("http://example.test", "Check the site.", ["seo/content"], null, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
    assert.deepEqual(findTypeErrors(code), []);
    assert.equal(code.match(/spells its interface text correctly/g)?.length, 1, "/ without page data");
    assert.match(code, /load\('nspell'\), load\('dictionary-en'\), load\('dictionary-en-gb'\)/, "both dictionaries, loaded by name");
});

test("in a real browser: a misspelt heading and a placeholder that isn't its label's word are findings; names, credits and another language are not checked (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/words"]);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const code = mockGenerate(fixture.origin, "Check the site.", ["seo/content"], profile as never, normalizeContentRules({ paths: ["/words"] }), normalizeTestAuditMode("fast"));
        const run = async (defect: string) => {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const found = (await runSuite(code, defect)).filter((record) => record.title.endsWith("/words spells its interface text correctly (recorded as findings)"));
            assert.equal(found.length, 1, defect);
            return found[0];
        };

        const clean = await run("none");
        assert.deepEqual([clean.status, clean.findings ?? []], ["Passed", []], "Saba, Sint, Faso (a list of 24 names), Unsplash (the footer) and nav (three letters) are not read");

        const misspelt = await run("spelling-misspelt");
        assert.equal(misspelt.status, "Passed", "a finding, not a failure");
        assert.deepEqual(misspelt.findings, ['"Contakt" in the heading "Contakt us" on /words is not in the dictionary (en-US, en-GB); did you mean "Contact"?']);

        const placeholder = await run("spelling-placeholder");
        assert.deepEqual(placeholder.findings, ['"massage" in the placeholder "Your massage" on /words looks like a misspelling of its label\'s "Message"']);

        const german = await run("spelling-other-language");
        assert.equal(german.status, "Not run");
        assert.equal(german.skipReason, "/words is in de: only English (en-US, en-GB) is checked");
    } finally {
        await fixture.close();
    }
});

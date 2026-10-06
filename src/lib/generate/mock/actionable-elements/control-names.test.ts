/**
 * TFP-151: the accessible-name check tests the button, field or form it was
 * generated for. Like links before TFP-145, a button without an id or label
 * was located with getByText(text).first(): the <span> holding its text,
 * which has no name, and always the first of same-text buttons. And on
 * practicesoftwaretesting.com (TFP-150, T23) a form's check landed on a
 * plain <div> and asked it for a name.
 *
 * ISTQB technique: equivalence partitioning over how an element gets (or
 * lacks) its name, one representative each: text in a child <span>; two
 * same-text buttons under different headings, the second unnamed (its text
 * is aria-hidden; with one container label, introspection keeps only the
 * first); an
 * icon-only button named by nothing (it has an id, so introspection records
 * it); a <form> with no accessible name (no role, so Not run); and a named
 * <form> (role form, so checked).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/actionable-elements/control-names.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../../../report/types.ts";

const { buildAccessibilityElementTests } = await import("./index.ts");
const { inspectPages } = await import("../../../introspect/inspector.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Controls</title></head><body>
<main><h1>Controls</h1>
<p><button type="button"><span>Save</span></button></p>
<h2>Reports</h2><div class="card"><button type="button">Open</button></div>
<h2>Archive</h2><div class="card"><button type="button"><span aria-hidden="true">Open</span></button></div>
<p><button type="button" id="show-password"><svg aria-hidden="true" width="16" height="16"><rect width="16" height="16"></rect></svg></button></p>
<form><input type="text" aria-label="Search terms"><button type="submit">Search</button></form>
<form aria-label="Newsletter" action="/subscribe"><input type="email" aria-label="Email"><button type="submit">Subscribe</button></form>
</main></body></html>`;

async function runSuite(code: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `control-names-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
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

test("in a real browser: a span-wrapped button passes; same-text buttons each test their own; an unnamed icon button fails, named; an unnamed <form> is Not run; a named one is checked", { skip: needsChromium }, async () => {
    const server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html" }).end(PAGE));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const inspection = await inspectPages(origin, ["/"]);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...inspection };
        // Numbered as the generator numbers them, so same-name checks have distinct titles.
        const tests = buildAccessibilityElementTests(profile as never, "/").map((testCode: string, index: number) => testCode.replace("test('", `test('TFAC-${String(index + 1).padStart(3, "0")}: `));
        const code = `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${origin}' });\ntest.describe('Accessibility', () => {\n${tests.join("\n\n")}\n});\n`;
        assert.deepEqual(findTypeErrors(code), []);
        for (const check of tests.filter((testCode: string) => /\[(button|form)\]'/.test(testCode))) {
            assert.doesNotMatch(check, /getByText/, "no button or form check finds its element by text");
        }

        const records = await runSuite(code);
        const outcome = (title: RegExp) => records.filter((record) => title.test(record.title)).map((record) => [record.status, record.skipReason || record.rawMessage.split("\n")[0]]);
        assert.deepEqual(outcome(/: Save \[button\]$/).map(([status]) => status), ["Passed"], JSON.stringify(outcome(/: Save \[button\]$/)));
        // Same text, two buttons: the first is named, the second's text is aria-hidden.
        const open = outcome(/: Open \[button\]$/);
        assert.deepEqual(open.map(([status]) => status), ["Passed", "Failed"], JSON.stringify(open));
        assert.match(String(open[1][1]), /Open has no accessible name/);
        // Icon only: no name from anything; fails, named by its id.
        const icon = outcome(/: show-password \[button\]$/);
        assert.deepEqual(icon.map(([status]) => status), ["Failed"], JSON.stringify(icon));
        assert.match(String(icon[0][1]), /show-password has no accessible name/);
        // Forms: the unnamed one has no role and is Not run, with the reason; the named one is checked and passes.
        const forms = outcome(/\[form\]$/);
        assert.equal(forms.length, 2, JSON.stringify(records.map((record) => record.title)));
        assert.deepEqual(forms[0], ["Not run", forms[0][1]]);
        assert.match(String(forms[0][1]), /is a <form> with no accessible name, so it has no role \(HTML-AAM\): there is no name to check/);
        assert.equal(forms[1][0], "Passed", JSON.stringify(forms[1]));
        // And every other check on the page passes: the fields, and the buttons inside the forms.
        const rest = records.filter((record) => !/: (Save|Open|show-password) \[button\]$|\[form\]$/.test(record.title));
        assert.deepEqual(rest.map((record) => [record.title.replace(/^TFAC-\d+: /, ""), record.status]), [
            ["accessible name and role: Search terms [input]", "Passed"],
            ["accessible name and role: Search [button]", "Passed"],
            ["accessible name and role: Email [input]", "Passed"],
            ["accessible name and role: Subscribe [button]", "Passed"],
        ]);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

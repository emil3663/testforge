/**
 * Phase 41 (TFP-181, Decision 3): the read-only gate's request guard, in a
 * real browser on the comparison fixture's /store, behind the recording
 * proxy, so what reached the server is measured, not assumed.
 *
 * ISTQB technique: decision table. Conditions: what the interaction sends
 * (GET requests only; a POST; a form submitted by its button; a form
 * submitted by form.submit(), which fires no submit event) and whether the
 * interaction itself then fails. One column each:
 *   GET-only sort                    -> passes; its GET reaches the server
 *   a QUERY (RFC 10008)              -> passes and reaches the server (a safe method, like GET: Emil, 2026-10-12)
 *   POST control (Add to cart)       -> fails as a guard breach naming POST and the URL; no POST reaches the server
 *   form submitted by its button     -> fails naming the form and its action; nothing is sent
 *   form.submit()                    -> fails naming the form; nothing is sent
 *   POST, then the interaction fails -> the breach is the failure reported, not the interaction's own error
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/read-only-guard.test.ts
 */
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import type { ExecutionRecord, JsonReport } from "../report/types.ts";

const { READ_ONLY_GUARD_HELPER } = await import("./read-only-guard.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string): Promise<ExecutionRecord[]> {
    const dir = join(process.cwd(), ".playwright-runs");
    await mkdir(dir, { recursive: true });
    const name = `read-only-guard-unit-${process.pid}-${Date.now()}`;
    const specFile = join(dir, `${name}.spec.ts`);
    const jsonFile = join(dir, `${name}.json`);
    await writeFile(specFile, code, "utf8");
    try {
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--timeout=30000", "--workers=1"], {
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

const suite = (origin: string) => `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${origin}' });

${READ_ONLY_GUARD_HELPER}

test('a GET-only sort', async ({ page }) => {
  await page.goto('/store');
  await expect(page.locator('.card-title').first()).toHaveText('Claw Hammer');
  await tfReadOnlyGuarded(page, async () => {
    await page.locator('#sort').selectOption('name,desc');
    await expect(page.locator('.card-title').first()).toHaveText('Wood Saw');
  });
});

test('a QUERY', async ({ page }) => {
  await page.goto('/store');
  await tfReadOnlyGuarded(page, async () => {
    await page.evaluate(() => fetch('/api/store/products', { method: 'QUERY', headers: { 'content-type': 'application/json' }, body: '{"sort":"name,asc"}' }));
  });
});

test('a control that POSTs', async ({ page }) => {
  await page.goto('/store/item/01J8Z3K4QWHAMMER');
  await tfReadOnlyGuarded(page, async () => {
    await page.getByRole('button', { name: 'Add to cart' }).click();
  });
});

test('a form submitted by its button', async ({ page }) => {
  await page.goto('/forms');
  await tfReadOnlyGuarded(page, async () => {
    await page.locator('#f-title').fill('hammer');
    await page.getByRole('button', { name: 'Search' }).click();
  });
});

test('a form submitted by form.submit()', async ({ page }) => {
  await page.goto('/forms');
  await tfReadOnlyGuarded(page, async () => {
    await page.evaluate(() => document.forms[0].submit());
  });
});

test('a POST, then the interaction fails', async ({ page }) => {
  await page.goto('/store/item/01J8Z3K4QWHAMMER');
  await tfReadOnlyGuarded(page, async () => {
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.locator('#cart-status')).toHaveText('Added', { timeout: 2000 });
  });
});
`;

const one = (records: ExecutionRecord[], title: string) => {
    const found = records.filter((record) => record.title.endsWith(title));
    assert.equal(found.length, 1, `${title}: ${found.length} matches in ${records.map((record) => record.title).join(" | ")}`);
    return found[0];
};

test("the guard's code type-checks", () => {
    assert.deepEqual(findTypeErrors(suite("http://127.0.0.1:1")), []);
});

test("in a real browser: the guard lets a GET-only sort through and aborts, and names, a POST and a form submission (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const records = await runSuite(suite(fixture.origin));
        const origin = fixture.origin.replace(/[.]/g, "\\.");

        const sort = one(records, "a GET-only sort");
        assert.equal(sort.status, "Passed", sort.rawMessage);

        const query = one(records, "a QUERY");
        assert.equal(query.status, "Passed", query.rawMessage);

        const post = one(records, "a control that POSTs");
        assert.equal(post.status, "Failed");
        assert.match(post.rawMessage, new RegExp(`read-only guard breach, aborted: POST ${origin}/api/store/cart \\(the read-only gate allows only GET, HEAD and QUERY requests and no form submission\\)`));

        const button = one(records, "a form submitted by its button");
        assert.equal(button.status, "Failed");
        assert.match(button.rawMessage, new RegExp(`read-only guard breach, aborted: form submission \\(GET ${origin}/notes\\)`));

        const submit = one(records, "a form submitted by form.submit()");
        assert.equal(submit.status, "Failed");
        assert.match(submit.rawMessage, new RegExp(`read-only guard breach, aborted: form submission \\(GET ${origin}/notes\\)`));

        const later = one(records, "a POST, then the interaction fails");
        assert.equal(later.status, "Failed");
        assert.match(later.rawMessage, /read-only guard breach, aborted: POST /);
        assert.doesNotMatch(later.rawMessage, /cart-status/);

        // Measured at the server: the sort's GET and the QUERY arrived; no POST and no form submission did.
        assert.ok(fixture.recorded.some((request) => request.method === "GET" && request.path.startsWith("/api/store/products?sort=name%2Cdesc")), "the sort's GET reached the server");
        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET").map((request) => `${request.method} ${request.path}`), ["QUERY /api/store/products"], "no request but GET and the one QUERY reached the server");
        assert.deepEqual(fixture.recorded.filter((request) => request.path.startsWith("/notes")), [], "no form submission reached the server");
    } finally {
        await fixture.close();
    }
});

/**
 * TFP-199 (Emil, 2026-10-13; Phase 41 Gate B's T33): a site's own beacons are aborted but noted,
 * not counted as a breach. ISTQB technique: equivalence partitioning - non-safe requests split into
 * beacons (Chromium's `ping` type; a named analytics path such as Cloudflare's /cdn-cgi/rum) and
 * everything else. The fixture's site-beacons case sends both kinds as a page is left, as the hosted
 * Toolshops do; following a link there passes with a note naming both, and neither reaches the
 * server. A control that POSTs still fails (the decision table above, run with the same guard).
 */
test("in a real browser: a page's beacons, sent as a link is followed, are aborted and noted, not a breach (TFP-199)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    const dir = join(process.cwd(), ".playwright-runs");
    const name = `read-only-guard-beacons-${process.pid}-${Date.now()}`;
    const jsonFile = join(dir, `${name}.json`);
    try {
        await fixture.control("/__fixture/defect?set=site-beacons");
        const code = `import { test, expect } from '@playwright/test';

test.use({ baseURL: '${fixture.origin}' });

${READ_ONLY_GUARD_HELPER}

test('following a link from a page that sends beacons', async ({ page }) => {
  await page.goto('/store');
  await tfReadOnlyGuarded(page, async () => {
    await page.getByRole('link', { name: 'Notes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  });
});
`;
        assert.deepEqual(findTypeErrors(code), []);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, `${name}.spec.ts`), code, "utf8");
        await new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [join(process.cwd(), "node_modules", "playwright", "cli.js"), "test", `.playwright-runs/${name}.spec.ts`, "--reporter=json", "--project=chromium", "--timeout=30000", "--workers=1"], {
                cwd: process.cwd(),
                env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, FORCE_COLOR: "0" },
                stdio: "ignore",
                windowsHide: true,
            });
            child.on("error", reject);
            child.on("close", () => resolve());
        });
        const raw = await readFile(jsonFile, "utf8");
        const [record] = flattenSuites((JSON.parse(raw) as JsonReport).suites ?? []);
        assert.equal(record.status, "Passed", record.rawMessage);
        const note = /read-only guard: aborted \d+ site beacon\(s\), not a breach: [^"]*/.exec(raw)?.[0] ?? "";
        assert.ok(note.includes(`POST ${fixture.origin}/cdn-cgi/rum?beacon (ping)`), `sendBeacon's POST, typed ping: ${note}`);
        assert.ok(note.includes(`POST ${fixture.origin}/cdn-cgi/rum? (fetch)`), `the fetch POST to the named path: ${note}`);
        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET"), [], "no beacon reached the server");
    } finally {
        await rm(join(dir, `${name}.spec.ts`), { force: true });
        await rm(jsonFile, { force: true });
        await fixture.close();
    }
});

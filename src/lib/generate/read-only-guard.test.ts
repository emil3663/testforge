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
 *   a QUERY (RFC 10008)              -> passes and reaches the server (a safe method, like GET: owner decision, 2026-10-12)
 *   POST control (Add to cart)       -> fails as a guard breach naming POST and the URL; no POST reaches the server
 *   form submitted by its button     -> fails naming the form and its action; nothing is sent
 *   form.submit()                    -> fails naming the form; nothing is sent
 *   POST, then the interaction fails -> the breach is the failure reported, not the interaction's own error
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/read-only-guard.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord, JsonSuite } from "../report/types.ts";

const { READ_ONLY_GUARD_HELPER } = await import("./read-only-guard.ts");
const { flattenSuites } = await import("../report/execution.ts");
const { findTypeErrors } = await import("./validate.ts");
const { startRecordedFixture } = await import("../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

async function runSuite(code: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, "read-only-guard-unit", ["--timeout=30000", "--workers=1"], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
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

/** Each test's notes from the guard, by title, from a Playwright JSON report. */
function guardNotes(suites: JsonSuite[]): Map<string, string[]> {
    const notes = new Map<string, string[]>();
    const walk = (list: JsonSuite[]) => list.forEach((suite) => {
        suite.specs.forEach((spec) => notes.set(spec.title, spec.tests.flatMap((t) => t.annotations ?? []).filter((a) => a.type === "note" && a.description?.startsWith("read-only guard: aborted")).map((a) => a.description ?? "")));
        walk(suite.suites ?? []);
    });
    walk(suites);
    return notes;
}

/**
 * TFP-199 (owner decision, 2026-10-13; Phase 41 Gate B's T33): a site's own beacons are aborted but noted,
 * not counted as a breach. ISTQB technique: equivalence partitioning - non-safe requests split into
 * beacons (Chromium's `ping` type; a named analytics path such as Cloudflare's /cdn-cgi/rum) and
 * everything else. A control that POSTs still fails (the decision table above, run with the same
 * guard).
 *
 * Two cases, one run:
 * - Following a link from a page that sends both kinds as it is left, as the hosted Toolshops do:
 *   it passes, and no beacon reaches the server.
 * - The same two beacons sent while the page stays: both are noted, with their types.
 *
 * TFP-208: the first case used to require both beacons in the note, and failed 1 time in R1's 3
 * full unit runs. Measured on 2026-10-16 under 10 to 14 parallel copies: 15 of 350 runs noted one
 * beacon or none. In every failure Chromium failed the beacons (net::ERR_ABORTED, the old page torn
 * down as the new one committed) within a millisecond of issuing them, before Playwright handed
 * them to the guard's route, so the guard never saw them. In all 320 timed runs the test passed,
 * nothing reached the server, and no beacon came after the guard returned. What the note holds as
 * a page is left is Chromium's timing, not the guard's, so that case checks only that whatever it
 * names is one of the two beacons; the classification is checked where nothing races it.
 */
test("in a real browser: a page's beacons are aborted and noted, not a breach, whether a link is followed or the page stays (TFP-199)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
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

test('beacons sent while the page stays', async ({ page }) => {
  await page.goto('/store');
  await tfReadOnlyGuarded(page, async () => {
    await page.evaluate(() => {
      navigator.sendBeacon('/cdn-cgi/rum?beacon', '{}');
      fetch('/cdn-cgi/rum?', { method: 'POST', body: '{}', keepalive: true }).catch(() => undefined);
    });
  });
});
`;
        assert.deepEqual(findTypeErrors(code), []);
        const { report } = await runPlaywrightSpec(code, "read-only-guard-beacons", ["--timeout=30000", "--workers=1"]);
        const records = flattenSuites(report.suites);
        const notes = guardNotes(report.suites);
        const ping = `POST ${fixture.origin}/cdn-cgi/rum?beacon (ping)`;
        const named = `POST ${fixture.origin}/cdn-cgi/rum? (fetch)`;

        const link = one(records, "following a link from a page that sends beacons");
        assert.equal(link.status, "Passed", link.rawMessage);
        const linkNoted = (notes.get("following a link from a page that sends beacons") ?? []).flatMap((note) => note.replace(/^read-only guard: aborted \d+ site beacon\(s\), not a breach: /, "").split("; "));
        assert.deepEqual(linkNoted.filter((beacon) => beacon !== ping && beacon !== named), [], `only the two beacons are named: ${linkNoted.join("; ")}`);

        const stays = one(records, "beacons sent while the page stays");
        assert.equal(stays.status, "Passed", stays.rawMessage);
        const staysNote = (notes.get("beacons sent while the page stays") ?? []).join(" | ");
        assert.ok(staysNote.includes(ping), `sendBeacon's POST, typed ping: ${staysNote}`);
        assert.ok(staysNote.includes(named), `the fetch POST to the named path: ${staysNote}`);

        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET"), [], "no beacon reached the server");
    } finally {
        await fixture.close();
    }
});

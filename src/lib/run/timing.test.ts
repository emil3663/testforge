/**
 * Phase 39 (TFP-211, Decision 1): where a run's time goes, recorded by a reporter beside the generated suite,
 * never inside it.
 *
 * ISTQB technique: decision table over what a test does (loads a page that settles; loads one that never goes
 * quiet; requests a link; clicks a link it can't load; fails an assertion) against what the record must count:
 *   a quiet page loaded            -> a page load, a settle wait, not capped
 *   a page that keeps polling      -> a settle wait that reaches its cap, counted as capped
 *   a link requested               -> a request, a target of link health
 *   a link test loading its target -> a page load, a target of the link tests (its own page excluded)
 *   a navigation-link test         -> its link's target, named by inspection, a target of navigation links
 *   a failing assertion            -> a failing test, with the time its failed step waited
 * Then: the run record keeps the summary (finalizeRunJob, with a real report and timing file), and the
 * inspection's controls are counted by Decision 3's kinds, boundary by boundary.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/timing.test.ts
 */
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { ContentProfile, LinkDetail } from "../generate/mock/types.ts";
import type { RawTiming, RunTiming } from "./timing.ts";

const scratch = mkdtempSync(join(tmpdir(), "testforge-timing-test-"));
process.env.TESTFORGE_RUNS_ROOT = join(scratch, "runs");

const { buildTimingReporterSource, countControlKinds, summarizeTiming, targetOf, TIMING_FILE_ENV_VAR } = await import("./timing.ts");
const { createEmptyProgress, finalizeRunJob } = await import("./jobs.ts");
const { routePageVisits } = await import("../generate/page-visits.ts");
const { chromiumSkipReason } = await import("../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

let site: Server;
let origin = "";
const html = (body: string, script = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Timing</title></head><body><main>${body}</main>${script}</body></html>`;

before(async () => {
    site = createServer((request, response) => {
        if (request.url === "/") return response.writeHead(200, { "content-type": "text/html" }).end(html(`<h1>Home</h1><a href="/a">A</a> <a href="/b">B</a>`));
        if (request.url === "/a" || request.url === "/b") return response.writeHead(200, { "content-type": "text/html" }).end(html(`<h1>${request.url}</h1>`));
        // Never quiet: a request every 200 ms, so the settle wait reaches its cap.
        if (request.url === "/busy") return response.writeHead(200, { "content-type": "text/html" }).end(html("<h1>Busy</h1>", "<script>setInterval(() => fetch('/ping'), 200);</script>"));
        if (request.url === "/ping") return response.writeHead(200, { "content-type": "text/plain" }).end("ok");
        response.writeHead(404, { "content-type": "text/plain" }).end("missing");
    });
    await new Promise<void>((resolve) => site.listen(0, "127.0.0.1", () => resolve()));
    origin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
});

after(async () => {
    await new Promise((resolve) => site?.close(resolve));
    rmSync(scratch, { recursive: true, force: true });
});

const link = (text: string, path: string, overrides: Partial<LinkDetail> = {}): LinkDetail => ({
    text, url: `${origin}${path}`, rawHref: path, category: "navigation", linkType: "internal", containerLabel: "", expectedStatus: 200, isVisible: true,
    target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: false, ...overrides,
});

const profile = () => ({
    scannedAt: new Date().toISOString(), baseUrl: origin,
    pages: [{ path: "/", url: `${origin}/`, title: "Home", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [], linkDetails: [link("A", "/a"), link("B", "/b")] }],
}) as ContentProfile;

// A suite shaped as the template writes one: area describes, page annotations, every visit through tfGoto.
const suite = () => routePageVisits(`import { test, expect } from '@playwright/test';

test.use({ baseURL: '${origin}' });

test.describe('Functional Coverage', () => {
  test('TFFU-001: link health: internal, external, and download links do not return broken responses', async ({ request }) => {
    for (const url of ['/a', '/b']) expect((await request.get(url)).status()).toBeLessThan(400);
  });
  test('TFFU-002: link "A" on /: on the page, named, with a valid href', { annotation: [{ type: 'page', description: '/' }] }, async ({ page }) => {
    await page.goto('/');
    await page.goto('/a');
  });
  test('TFFU-003: navigation link health: B', { annotation: [{ type: 'page', description: '/' }] }, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'B' }).click();
    await expect(page).toHaveURL(/\\/b$/);
  });
});

test.describe('Accessibility Coverage', () => {
  test('TFAC-001: the busy page has a banner', { annotation: [{ type: 'page', description: '/busy' }] }, async ({ page }) => {
    await page.goto('/busy');
    await expect(page.getByRole('banner'), 'a banner is on /busy').toBeVisible({ timeout: 1500 });
  });
});
`);

let real: { raw: RawTiming; report: string } | null = null;
async function realRun() {
    if (real) return real;
    const dir = join(scratch, "reporter");
    await mkdir(dir, { recursive: true });
    const reporter = join(dir, "timing-reporter.cjs");
    const file = join(dir, "timing.json");
    await writeFile(reporter, buildTimingReporterSource(), "utf8");
    const { raw: report } = await runPlaywrightSpec(suite(), "timing", [`--reporter=json,${reporter.replace(/\\/g, "/")}`, "--workers=1", "--timeout=30000"], { [TIMING_FILE_ENV_VAR]: file });
    real = { raw: JSON.parse(await readFile(file, "utf8")) as RawTiming, report };
    return real;
}

test("in a real browser: loads, settle waits (one capped), requests and the failing test's wait are counted, from the reporter alone (TFP-211)", { skip: needsChromium }, async () => {
    const { raw } = await realRun();
    assert.equal(raw.tests.length, 4);
    // The browser and request set-up isn't the tests' own: only their calls are kept, each once.
    const health = raw.tests.find((record) => record.title.includes("link health"))!;
    assert.deepEqual(health.steps.map((step) => `${step.kind} ${step.target}`), ["request /a", "expect ", "request /b", "expect "]);
    // TFP-264: a step that ran out of time says so (the capped settle wait); one that passed doesn't.
    const steps = raw.tests.flatMap((record) => record.steps);
    assert.equal(steps.filter((step) => step.kind === "settle" && step.timedOut).length, 1, "/busy's settle wait timed out");
    assert.ok(steps.filter((step) => !step.failed).every((step) => step.timedOut === false));
    const timing = summarizeTiming(raw, { baseUrl: origin, profile: profile() });
    assert.equal(timing.tests, 4);
    assert.equal(timing.pageLoads.count, 4, "/, /a, /, /busy");
    assert.equal(timing.settle.count, 4, "one settle wait per load");
    assert.equal(timing.settle.capped, 1, "/busy never goes quiet");
    assert.ok(timing.settle.cappedMs >= 4900, `the capped wait is the 5 s cap: ${timing.settle.cappedMs} ms`);
    assert.equal(timing.requests.count, 2, "link health's two requests");
    assert.equal(timing.failing.tests, 1);
    assert.ok(timing.failing.failedStepMs >= 1400 && timing.failing.failedStepMs < timing.failing.ms, `the failed assertion waited out its 1.5 s: ${timing.failing.failedStepMs} of ${timing.failing.ms} ms`);
    assert.ok(timing.testMs >= timing.failing.ms);
    assert.deepEqual(timing.visits, [
        { page: "/", area: "functional", count: 2 },
        { page: "/a", area: "functional", count: 1 },
        { page: "/busy", area: "accessibility", count: 1 },
    ]);
    // Link health requests /a and /b; the link test loads /a (its own page, /, left out); the navigation-link
    // test clicks B, named by inspection: /b.
    assert.deepEqual(timing.overlap.checks.map(({ check, tests, loads, requests, targets }) => ({ check, tests, loads, requests, targets })), [
        { check: "link health", tests: 1, loads: 0, requests: 2, targets: 2 },
        { check: "link tests", tests: 1, loads: 2, requests: 0, targets: 1 },
        { check: "navigation links", tests: 1, loads: 1, requests: 0, targets: 1 },
    ]);
    assert.ok(timing.overlap.checks.every((check) => check.ms > 0));
    assert.equal(timing.namedFromSuite, 0, "no routes check, so every load is named as Playwright names it");
    assert.deepEqual(timing.overlap.pairs, [
        { checks: ["link health", "link tests"], shared: 1 },
        { checks: ["link health", "navigation links"], shared: 1 },
        { checks: ["link tests", "navigation links"], shared: 0 },
    ]);
    assert.deepEqual(timing.overlap.sharedTargets, [
        { target: "/a", checks: ["link health", "link tests"] },
        { target: "/b", checks: ["link health", "navigation links"] },
    ]);
});

test("the run record keeps the summary, with the inspected pages' controls; the timing files are removed (TFP-211)", { skip: needsChromium }, async () => {
    const { raw, report } = await realRun();
    const id = randomUUID();
    const files = join(scratch, "job-files");
    await mkdir(files, { recursive: true });
    const job = {
        id, status: "running" as const, cancellationRequested: false, createdAt: Date.now() - 5000, finishedAt: null, pendingOutput: "", outputChunks: [], progress: createEmptyProgress(),
        activeExecutions: new Map(), process: null, testFile: join(files, `suite-${id}.spec.ts`), jsonReportFile: join(files, `report-${id}.json`), reporterFile: join(files, `reporter-${id}.cjs`),
        timingReporterFile: join(files, `timing-reporter-${id}.cjs`), timingFile: join(files, `timing-${id}.json`), artifactDir: join(files, `artifacts-${id}`),
        baseUrl: origin, description: "", auditMode: "fast", selectedPractices: ["functional", "accessibility"], contentProfile: profile(), enableInteractive: false, login: null, generation: null,
        redactions: [] as string[], artifactFiles: new Map(), result: null as { report?: { runTiming?: RunTiming } } | null,
    };
    await writeFile(job.testFile, suite(), "utf8");
    await writeFile(job.jsonReportFile, report, "utf8");
    await writeFile(job.timingReporterFile, buildTimingReporterSource(), "utf8");
    await writeFile(job.timingFile, JSON.stringify(raw), "utf8");
    await finalizeRunJob(job as never);
    const kept = job.result?.report?.runTiming;
    assert.ok(kept, "the report has runTiming");
    assert.deepEqual({ ...kept, controls: undefined }, { ...summarizeTiming(raw, { baseUrl: origin, profile: profile() }), controls: undefined });
    assert.deepEqual(kept.controls, [{ page: "/", counts: { "in place": 0, "in-app navigation": 0, "path navigation": 2, unclear: 0 } }]);
    for (const file of [job.timingFile, job.timingReporterFile]) await assert.rejects(readFile(file), `${file} is removed with the run's other files`);
    // A run without the timing files (one from before TFP-211) has no runTiming, and nothing else changes.
    const older = { ...job, id: randomUUID(), timingFile: undefined, timingReporterFile: undefined, result: null as typeof job.result };
    await writeFile(older.testFile, suite(), "utf8");
    await writeFile(older.jsonReportFile, report, "utf8");
    await finalizeRunJob(older as never);
    assert.equal(older.result?.report?.runTiming, undefined);
});

test("a retried test counts once, by its last attempt; targets on the site's origin are named by path (TFP-211)", () => {
    const attempt = (retry: number, status: "failed" | "passed", duration: number) => ({
        titlePath: ["", "chromium", "s.spec.ts", "SEO and Content Coverage", "t"], title: "t", page: "/", status, duration, retry,
        steps: [{ kind: "goto" as const, target: "/", duration: 10, failed: false }],
    });
    const timing = summarizeTiming({ version: 1, tests: [attempt(0, "failed", 900), attempt(1, "passed", 100)] }, { baseUrl: "http://site.test" });
    assert.equal(timing.tests, 1);
    assert.equal(timing.testMs, 100);
    assert.equal(timing.failing.tests, 0);
    assert.deepEqual(timing.visits, [{ page: "/", area: "seo/content", count: 1 }]);
    assert.equal(targetOf("http://site.test/#/contact", "http://site.test"), "/#/contact");
    assert.equal(targetOf("/product/1?x=1", "http://site.test/"), "/product/1?x=1");
    assert.equal(targetOf("https://other.test/a", "http://site.test"), "https://other.test/a");
});

test("the suite's own lists name what step names can't: a routes check's loads by its route list, the probe once per worker; link health's targets by its links (TFP-211)", () => {
    // Playwright names an absolute address by its path alone: every route load below is "/".
    const routes = [{ url: "http://site.test/#/contact", route: "/#/contact" }, { url: "http://site.test/#/about", route: "/#/about" }];
    const links = [
        { url: "http://site.test/#/contact", rawHref: "#/contact", linkType: "internal" },
        { url: "http://site.test/files/a.pdf", rawHref: "/files/a.pdf", linkType: "download" },
        { url: "https://other.test/", rawHref: "https://other.test/", linkType: "external" },
        { url: "http://site.test/#top", rawHref: "#top", linkType: "anchor" },
    ];
    const suiteCode = `import { test, expect } from '@playwright/test';
test.describe('Functional Coverage', () => {
  test('TFFU-001: link health: internal, external, and download links do not return broken responses', async ({ request }) => {
        const links = ${JSON.stringify(links)};
        for (const link of links) {
            // TFP-165: a hash route (#/contact) is checked by what the app draws there, below; the server answers every route the same.
            if (/^#!?\\//.test(link.rawHref)) {
                continue;
            }
        }
  });
  test('TFFU-002: link health: linked routes draw a page, not the app\\'s "not found" view', async ({ page }) => {
        const routes = ${JSON.stringify(routes)};
  });
  test('TFFU-003: link health: linked routes draw a page, not the app\\'s "not found" view', async ({ page }) => {
        const routes = ${JSON.stringify(routes)};
  });
  test('TFFU-004: link health: linked routes draw a page, not the app\\'s "not found" view', async ({ page }) => {
        const routes = ${JSON.stringify(routes)};
  });
});
`;
    const titlePath = (title: string) => ["", "chromium", "s.spec.ts", "Functional Coverage", title];
    const routeTest = (id: string, status: "passed" | "failed", loads: number) => {
        const title = `${id}: link health: linked routes draw a page, not the app's "not found" view`;
        return { titlePath: titlePath(title), title, page: null, status, duration: 100, retry: 0, steps: Array.from({ length: loads }, () => ({ kind: "goto" as const, target: "/", duration: 10, failed: false })) };
    };
    const healthTitle = "TFFU-001: link health: internal, external, and download links do not return broken responses";
    const raw = { version: 1 as const, tests: [
        { titlePath: titlePath(healthTitle), title: healthTitle, page: null, status: "passed" as const, duration: 50, retry: 0, steps: [{ kind: "request" as const, target: "/files/a.pdf", duration: 5, failed: false }, { kind: "request" as const, target: "/", duration: 5, failed: false }] },
        // A fresh worker: the probe, then both routes. The same worker: both routes, no probe. It fails, so the next
        // test has a fresh worker again: the probe, then the one route its 14 s left time for.
        routeTest("TFFU-002", "passed", 3),
        routeTest("TFFU-003", "failed", 2),
        routeTest("TFFU-004", "passed", 2),
    ] };
    const timing = summarizeTiming(raw, { baseUrl: "http://site.test", suiteCode });
    assert.equal(timing.namedFromSuite, 7);
    assert.deepEqual(timing.visits, [
        { page: "(missing-route probe)", area: "functional", count: 2 },
        { page: "/#/about", area: "functional", count: 2 },
        { page: "/#/contact", area: "functional", count: 3 },
    ]);
    const targets = (check: string) => timing.overlap.checks.find((entry) => entry.check === check);
    // The hash route is left to the routes check, and an anchor isn't requested; the external link keeps its origin.
    assert.equal(targets("link health")?.targets, 2);
    assert.equal(targets("linked routes")?.targets, 2);
    assert.deepEqual(timing.overlap.pairs, [{ checks: ["link health", "linked routes"], shared: 0 }]);
    // Without the suite, the step names are all there is: three routes checks' loads are all "/".
    assert.deepEqual(summarizeTiming(raw, { baseUrl: "http://site.test" }).visits, [{ page: "/", area: "functional", count: 7 }]);
});

test("controls by Decision 3's kinds: in place by role or aria state, hash routes in-app, other same-origin paths apart, the rest unclear (TFP-211)", () => {
    const element = (elementType: string, role: string | null, aria: Partial<Record<"ariaPressed" | "ariaSelected" | "ariaChecked" | "ariaExpanded", string>> = {}) => ({
        text: "", url: null, category: "action", elementType, containerLabel: "", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null,
        locator: { role, name: "", label: "", placeholder: "", id: "", inputType: "" }, ...aria,
    });
    const page = {
        path: "/p", url: "http://site.test/p", title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [],
        linkDetails: [
            link("Top", "#top", { linkType: "anchor" }),
            link("Contact", "#/contact"),
            link("About", "/about"),
            link("Docs", "https://other.test/", { linkType: "external" }),
        ],
        actionableElements: [
            element("input", "radio"), element("input", "checkbox"), element("button", "tab"), element("button", "button", { ariaPressed: "false" }),
            element("button", "button", { ariaExpanded: "false" }), element("button", "button"), element("input", "textbox"), element("link", "link"),
        ],
    };
    const otherPage = { ...page, path: "/q", linkDetails: [], actionableElements: [] };
    const counts = countControlKinds({ scannedAt: "", baseUrl: "http://site.test", pages: [page, otherPage] } as never, ["/p"]);
    assert.deepEqual(counts, [{ page: "/p", counts: { "in place": 6, "in-app navigation": 1, "path navigation": 1, unclear: 3 } }]);
    assert.deepEqual(countControlKinds(null), []);
});

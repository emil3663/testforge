/**
 * Phase 36 (TFP-124, Decision 2): a missing web-app manifest and missing
 * structured data are named findings and do not fail the test; a missing
 * meta description, canonical link or robots.txt sitemap reference still
 * fails.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/seo-findings.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { ContentProfile } from "./types.ts";

const { buildContentSuites } = await import("./content-suites.ts");
const { normalizeContentRules } = await import("../normalize.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("../validate.ts");

// Phase 36 (TFP-125): tests that need a real browser skip, with the reason,
// where Playwright's Chromium is not installed.
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const needsChromium = await chromiumSkipReason();

const PROFILE = { pages: [{ path: "/", url: "http://x/", title: "", metaDescription: "", headings: [], buttons: [], links: [], actionableElements: [], visibleTextSnippets: [] }] } as unknown as ContentProfile;

function seoTests() {
    const [suite] = buildContentSuites(PROFILE, normalizeContentRules(undefined), ["seo/content"]);
    const find = (fragment: string) => {
        const found = suite.tests.find((t) => t.includes(fragment));
        assert.ok(found, `no test containing "${fragment}"`);
        return found;
    };
    return {
        all: suite.tests,
        meta: find("keeps meta description stable"),
        canonical: find("keeps canonical metadata stable"),
        structured: find("exposes structured data"),
        robots: find("publishes robots.txt"),
        manifest: find("publishes manifest metadata"),
    };
}

test("the SEO suite type-checks and awaits every web-first assertion", () => {
    const suite = `import { test, expect } from '@playwright/test';\n${seoTests().all.join("\n")}\n`;
    assert.deepEqual(findTypeErrors(suite), []);
    assert.deepEqual(findUnawaitedAssertions(suite).filter((a) => a.returnsPromise), []);
});

test("the optional items say so in their titles; the baseline ones name what is missing and where", () => {
    const t = seoTests();
    assert.match(t.structured, /exposes structured data for \/ \(recorded as a finding when missing\)/);
    assert.match(t.manifest, /publishes manifest metadata for installable clients \(recorded as a finding when missing\)/);
    assert.match(t.meta, /'no meta description on \/'/);
    assert.match(t.canonical, /'no canonical link on \/'/);
    assert.match(t.robots, /'\/robots\.txt has no Sitemap: line'/);
});

/** Runs one generated test the way Playwright would, collecting findings. */
async function runGenerated(testCode: string, baseURL: string) {
    const ts = await import("typescript");
    const { chromium, expect } = await import("@playwright/test");
    const js = ts.transpileModule(testCode, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const annotations: Array<{ type: string; description?: string }> = [];
    let body: ((fixtures: { page: unknown; request: unknown }) => Promise<void>) | null = null;
    const fakeTest = Object.assign((_title: string, fn: typeof body) => { body = fn; }, { info: () => ({ annotations }) });
    new Function("test", "expect", js)(fakeTest, expect);
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({ baseURL });
        const page = await context.newPage();
        try {
            await body!({ page, request: context.request });
            return { passed: true, findings: annotations.filter((a) => a.type === "finding").map((a) => a.description) };
        } catch {
            return { passed: false, findings: annotations.filter((a) => a.type === "finding").map((a) => a.description) };
        }
    } finally {
        await browser.close();
    }
}

async function withSite(routes: Record<string, [number, string, string]>, run: (baseURL: string) => Promise<void>) {
    const server = createServer((req, res) => {
        const [status, type, body] = routes[req.url ?? ""] ?? [404, "text/plain", "not found"];
        res.writeHead(status, { "content-type": type }).end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

const BARE = { "/": [200, "text/html", "<!doctype html><title>Bare</title><h1>Bare</h1>"] } as Record<string, [number, string, string]>;

const COMPLETE_ASSETS: Record<string, [number, string, string]> = {
    "/robots.txt": [200, "text/plain", "User-agent: *\nSitemap: /sitemap.xml\n"],
    "/sitemap.xml": [200, "application/xml", "<urlset><url><loc>/</loc></url></urlset>"],
    "/manifest.webmanifest": [200, "application/manifest+json", JSON.stringify({ name: "Complete" })],
};

test("in a real browser: missing structured data and manifest are findings and pass; the baseline items fail", { skip: needsChromium }, async () => {
    const t = seoTests();
    await withSite(BARE, async (baseURL) => {
        assert.deepEqual(await runGenerated(t.structured, baseURL), { passed: true, findings: ["no structured data (JSON-LD) on /: search engines get no machine-readable description of the page"] });
        assert.deepEqual(await runGenerated(t.manifest, baseURL), { passed: true, findings: ["no web-app manifest linked from /: the site cannot be installed as an app"] });
        assert.equal((await runGenerated(t.meta, baseURL)).passed, false, "no meta description still fails");
        assert.equal((await runGenerated(t.canonical, baseURL)).passed, false, "no canonical link still fails");
        assert.equal((await runGenerated(t.robots, baseURL)).passed, false, "no robots.txt sitemap line still fails");
    });
});

test("in a real browser: a site with everything passes every SEO test with no findings; a linked manifest that 404s fails", { skip: needsChromium }, async () => {
    const t = seoTests();
    const page = (manifestHref: string) =>
        `<!doctype html><title>Complete</title><meta name="description" content="A complete page"><link rel="canonical" href="/"><link rel="manifest" href="${manifestHref}"><script type="application/ld+json">{"@type":"WebSite","name":"Complete"}</script><h1>Complete</h1>`;
    const routes: Record<string, [number, string, string]> = { ...COMPLETE_ASSETS, "/": [200, "text/html", page("/manifest.webmanifest")] };
    await withSite(routes, async (baseURL) => {
        for (const name of ["meta", "canonical", "structured", "robots", "manifest"] as const) {
            assert.deepEqual(await runGenerated(t[name], baseURL), { passed: true, findings: [] }, name);
        }
    });
    routes["/"] = [200, "text/html", page("/missing.webmanifest")];
    await withSite(routes, async (baseURL) => {
        assert.deepEqual(await runGenerated(t.manifest, baseURL), { passed: false, findings: [] }, "a broken manifest link is not a missing one");
    });
});

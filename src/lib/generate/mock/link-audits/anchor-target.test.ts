/**
 * TFP-141: the anchor-target check must not crash on href="#". It passed the
 * href to a CSS locator, so href="#" became the selector "#" and threw
 * ("Unexpected token "#" while parsing css selector") - on rizonetech.com,
 * 5 of 5 pages, a tool crash reported as a site failure.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/anchor-target.test.ts
 */
import assert from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { LinkDetail } from "../types.ts";

const { buildLinkExperienceTests } = await import("./experience-tests.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

function anchor(rawHref: string, text: string): LinkDetail {
    return { text, url: `http://x.test/${rawHref}`, rawHref, category: "navigation" as never, linkType: "anchor", containerLabel: "", expectedStatus: null, isVisible: true, target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: false };
}

function anchorTest(path: string, links: LinkDetail[]) {
    const found = buildLinkExperienceTests(path, false, false, [], "[]", [], links, []).filter((t) => t.includes("anchor links point to existing in-page targets"));
    assert.equal(found.length, 1);
    return found[0];
}

test("the generated anchor test type-checks and never builds a CSS selector from an href", () => {
    const code = anchorTest("/", [anchor("#", "Menu"), anchor("#section", "Section")]);
    assert.deepEqual(findTypeErrors(`import { test, expect } from '@playwright/test';\n${code}\n`), []);
    assert.doesNotMatch(code, /page\.locator\(selector\)|locator\(link\.rawHref\)/);
});

/** Runs one generated test through the Playwright CLI, as a real run does, returning its outcome, message and findings. */
async function runGenerated(code: string, baseURL: string) {
    const { report } = await runPlaywrightSpec(`import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\n${code}\n`, `anchor-unit`, ["--workers=1"]);
    const [record] = flattenSuites(report.suites);
    return { passed: record.status === "Passed", message: record.status === "Passed" ? "" : record.rawMessage, findings: record.findings ?? [] };
}

const PAGES: Record<string, string> = {
    "/anchors": `<!doctype html><title>t</title><a href="#">Menu</a> <a href="#section">Section</a> <a href="#top">Back to top</a> <a href="#caf%C3%A9">Café</a><h2 id="section">Section</h2><h2 id="café">Café</h2>`,
    "/broken": `<!doctype html><title>t</title><a href="#missing">Missing</a>`,
};

test("in a real browser: href=\"#\" is a named finding, not a crash; real, #top and encoded targets pass; a missing target fails by name", { skip: needsChromium }, async () => {
    const server = createServer((req, res) => {
        const body = PAGES[new URL(req.url ?? "/", "http://x").pathname];
        res.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" }).end(body ?? "");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const ok = await runGenerated(anchorTest("/anchors", [anchor("#", "Menu"), anchor("#section", "Section"), anchor("#top", "Back to top"), anchor("#caf%C3%A9", "Café")]), origin);
        assert.deepEqual(ok, { passed: true, message: "", findings: ['link "Menu" has href="#", which points at no in-page target (a placeholder link)'] });

        const broken = await runGenerated(anchorTest("/broken", [anchor("#missing", "Missing")]), origin);
        assert.equal(broken.passed, false);
        assert.match(broken.message, /Anchor target missing for #missing/);
        assert.doesNotMatch(broken.message, /Unexpected token/);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

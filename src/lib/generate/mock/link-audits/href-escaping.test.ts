/**
 * TFP-267: a link with no text is found by its href, in a CSS attribute selector built inside the generated suite.
 * Inside the generator's template literals `'\\"'` writes `'\"'` into the suite, which there is just `"`: the replace
 * did nothing, and CodeQL's "replacement of a substring with itself" was right. So an href holding `"` broke the
 * selector and its link check failed on TestForge's own error, not the site's, and an href holding `\` matched nothing.
 *
 * ISTQB technique: equivalence partitioning of the href (a double quote, a backslash, both, neither), in a real browser
 * through the generated test, so the selector is parsed by Playwright and matched against the real attribute.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/href-escaping.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { test } from "node:test";
import type { LinkDetail } from "../types.ts";

const { buildLinkDetailTests } = await import("./detail-tests.ts");
const { findTypeErrors } = await import("../../validate.ts");
const { flattenSuites } = await import("../../../report/execution.ts");
const { chromiumSkipReason } = await import("../../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

/** A link with no text, so the generated check has only its href to find it by. */
function mailto(rawHref: string): LinkDetail {
    return { text: "", url: rawHref, rawHref, category: "navigation" as never, linkType: "mailto", containerLabel: "", expectedStatus: null, isVisible: true, target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: false } as unknown as LinkDetail;
}

const htmlAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

async function checkOn(hrefs: string[]) {
    const page = `<!doctype html><title>t</title>${hrefs.map((href) => `<a href="${htmlAttribute(href)}" style="display:inline-block;width:20px;height:20px;background:#000"></a>`).join("")}`;
    const server = createServer((_req, res) => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(page));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        const [check] = buildLinkDetailTests("/", 5000, false, hrefs.map(mailto), [], [], []);
        const code = `import { test, expect } from '@playwright/test';\ntest.use({ baseURL: '${baseURL}' });\n${check}\n`;
        assert.deepEqual(findTypeErrors(code), []);
        const { report } = await runPlaywrightSpec(code, "href-escaping-unit", ["--workers=1", "--timeout=30000"], { TESTFORGE_INTERACTIVE: "0" });
        const [record] = flattenSuites(report.suites);
        return record.status === "Passed" ? "Passed" : `${record.status}: ${(record.rawMessage ?? "").slice(0, 200)}`;
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}

for (const [name, href] of [
    ["a double quote", 'mailto:a"b@x.test'],
    ["a backslash", "mailto:a\\b@x.test"],
    ["both, side by side", 'mailto:a\\"b@x.test'],
    ["a backslash at the end", "mailto:ab@x.test\\"],
    ["neither", "mailto:ab@x.test"],
]) {
    test(`in a real browser: a textless link whose href holds ${name} is found by its check`, { skip: needsChromium }, async () => {
        assert.equal(await checkOn([href]), "Passed");
    });
}

test("no generated selector in the link checks keeps the replacement that does nothing", () => {
    for (const file of ["coverage-tests.ts", "detail-tests.ts", "experience-tests.ts", "reveal.ts"]) {
        const source = readFileSync(join(import.meta.dirname, file), "utf8");
        assert.doesNotMatch(source, /\.replace\(\/"\/g, '\\\\"'\)/, file);
    }
});

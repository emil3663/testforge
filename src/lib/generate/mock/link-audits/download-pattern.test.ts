/**
 * TFP-164: the generated download checks' pattern kept its escaped dot.
 * Written as `\.` inside a template string, the backslash was dropped, so the
 * generated test got `/.(pdf|...)/`: any character before the extension, so
 * a link ending "getpdf" counted as a download. The hidden-link path TFP-159
 * added already escaped it.
 *
 * ISTQB technique: equivalence partitioning: a real extension after a dot, a
 * query or hash after it, and the same letters with no dot.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/link-audits/download-pattern.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { LinkDetail } from "../types.ts";

const { buildLinkCoverageTests } = await import("./coverage-tests.ts");
const { buildLinkDetailTests } = await import("./detail-tests.ts");

const download = { text: "Report", url: "http://x.test/files/report.pdf", rawHref: "/files/report.pdf", category: "navigation", linkType: "download", containerLabel: "", expectedStatus: null, isVisible: true, target: "", targetBehavior: "same-window", titleAttribute: "", downloadName: "", requiresAuth: false, isSecure: false } as unknown as LinkDetail;

/** The download pattern each generated check uses, as the generated test's regex literal reads it. */
function patternsIn(code: string) {
    return [...code.matchAll(/\/(\\?\.\(pdf\|doc\|docx\|xls\|xlsx\|csv\|zip\|ppt\|pptx\)\(\[\?#\]\.\*\)\?\$)\/i/g)].map((match) => match[1]);
}

test("both download checks emit \\.(pdf...): a link ending getpdf, with no dot, is not a download", () => {
    const linkTypes = buildLinkCoverageTests("/", 5000, JSON.stringify([download]), [download], true, "http://x.test/").join("\n");
    const detail = buildLinkDetailTests("/", 5000, false, [], [download], [], []).join("\n");
    for (const [name, code] of [["link types", linkTypes], ["download links", detail]]) {
        const patterns = patternsIn(code);
        assert.equal(patterns.length, 1, `${name}: one download pattern`);
        assert.ok(patterns[0].startsWith("\\.(pdf"), `${name}: the dot is escaped (${patterns[0]})`);
        const pattern = new RegExp(patterns[0], "i");
        for (const href of ["/files/report.pdf", "/files/report.PDF", "/files/sheet.xlsx?v=2", "/files/deck.pptx#page=3"]) assert.ok(pattern.test(href), `${name}: ${href} is a download`);
        for (const href of ["/files/getpdf", "/export/xpdf", "/files/reportzip"]) assert.ok(!pattern.test(href), `${name}: ${href} is not a download`);
    }
});

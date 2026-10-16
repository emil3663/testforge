/**
 * Phase 41 (TFP-186, Decision 1): layout consistency, overlap and images that
 * don't render. The comparison fixture's /gallery and /gallery/more - which
 * share their cards and their order form - are inspected, a Standard
 * usability suite is generated from them, and its four layout checks run in
 * a real browser through the Playwright CLI.
 *
 * ISTQB technique: decision table. Conditions: what is out of line (nothing;
 * a field's padding; a label's font; an option's font; one card title's
 * alignment; a card's hidden image; two buttons overlapping; an image that
 * doesn't load; the second page's card titles centred; its submit button's
 * width). One column each: the matching check reports it - a finding for a
 * consistency difference, a failure for overlap and a broken image - and
 * every other check stays clean. The checks name their own techniques in
 * the generated tests.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/layout.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord } from "../../report/types.ts";
import type { ContentProfile } from "./types.ts";

const { mockGenerate } = await import("./index.ts");
const { buildLayoutTests } = await import("./layout.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");
const { inspectPages } = await import("../../introspect/inspector.ts");
const { flattenSuites } = await import("../../report/execution.ts");
const { findTypeErrors } = await import("../validate.ts");
const { startRecordedFixture } = await import("../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

const CHECKS = "consistent|overlapping controls|every image|same components";

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `layout-unit-${label}`, ["--timeout=30000", "--workers=1", "--grep", CHECKS], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

test("three checks per inspected page and one across them, in the usability area; none without page data beyond /", () => {
    const page = (path: string) => ({ path, url: path, title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [], actionableElements: [] });
    const titles = (profile: ContentProfile | null) => buildLayoutTests(profile).tests.map((source) => /test\('([^']+)'/.exec(source)?.[1]);
    assert.deepEqual(titles({ scannedAt: "", baseUrl: "http://example.test", pages: [page("/"), page("/more")] } as unknown as ContentProfile), [
        "/ keeps its forms, lists and cards consistent (recorded as findings)",
        "/ has no overlapping controls",
        "/ shows every image it loads",
        "/more keeps its forms, lists and cards consistent (recorded as findings)",
        "/more has no overlapping controls",
        "/more shows every image it loads",
        "the same components look the same on every inspected page (recorded as findings)",
    ]);
    // Without page data: the landing page's three, and no comparison across pages.
    assert.equal(titles(null).length, 3);
    const code = mockGenerate("http://example.test", "Check the site.", ["usability"], null, normalizeContentRules(undefined), normalizeTestAuditMode("fast"));
    assert.deepEqual(findTypeErrors(code), []);
});

test("in a real browser: each layout defect on the fixture's gallery is reported by its own check, named, and the clean gallery is clean (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const paths = ["/gallery", "/gallery/more"];
        const inspection = await inspectPages(fixture.origin, paths);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const code = mockGenerate(fixture.origin, "Check the site.", ["usability"], profile as never, normalizeContentRules({ paths }), normalizeTestAuditMode("fast"));
        assert.deepEqual(findTypeErrors(code), []);

        const outcome = async (defect: string) => {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const records = await runSuite(code, defect);
            const get = (title: string) => {
                const found = records.filter((record) => record.title.endsWith(title));
                assert.equal(found.length, 1, `${defect}: ${title} in ${records.map((record) => record.title).join(" | ")}`);
                return found[0];
            };
            const all = [
                ...paths.flatMap((path) => [`${path} keeps its forms, lists and cards consistent (recorded as findings)`, `${path} has no overlapping controls`, `${path} shows every image it loads`]),
                "the same components look the same on every inspected page (recorded as findings)",
            ].map(get);
            return {
                failed: all.filter((record) => record.status === "Failed").map((record) => `${record.title.replace(/^TF[A-Z]+-\d+: /, "")}: ${record.rawMessage.split("\n")[0]}`),
                findings: all.flatMap((record) => record.findings ?? []),
                notPassed: all.filter((record) => record.status !== "Passed" && record.status !== "Failed").map((record) => record.title),
            };
        };

        const clean = await outcome("none");
        assert.deepEqual(clean, { failed: [], findings: [], notPassed: [] });

        const findingColumns: Array<[string, RegExp]> = [
            ["layout-field-padding", /^the fields of the "Order" form on \/gallery: "Email" has padding-left 0px, where the other 2 have 12px$/],
            ["layout-label-font", /^the labels of the "Order" form on \/gallery: "Email" has font-family "Comic Sans MS", where the other 2 have sans-serif$/],
            ["layout-option-font", /^the options of the "Size" list on \/gallery: "M" has font-size 13\.3333px, where the other 2 have 16px$/],
            ["layout-card-align", /^the card titles on \/gallery: "Wood Saw" has text-align right, where the other 3 have left$/],
            ["layout-hidden-image", /^the cards on \/gallery: "Bolt Cutters" has its image hidden, where the other 3 show theirs$/],
            ["layout-centred-titles", /^h2\.card-title differs across pages in text-align: left on \/gallery; center on \/gallery\/more$/],
            ["layout-submit-width", /^submit \.btn-submit differs across pages in share of its container's width: 50% on \/gallery; \d+% on \/gallery\/more$/],
        ];
        for (const [defect, finding] of findingColumns) {
            const result = await outcome(defect);
            assert.deepEqual(result.failed, [], `${defect}: a finding, not a failure`);
            assert.equal(result.findings.length, 1, `${defect}: ${JSON.stringify(result.findings)}`);
            assert.match(result.findings[0], finding, defect);
        }

        const overlap = await outcome("layout-overlap");
        assert.deepEqual(overlap.findings, []);
        assert.equal(overlap.failed.length, 1, JSON.stringify(overlap.failed));
        assert.match(overlap.failed[0], /^\/gallery has no overlapping controls: .*"Save" and "Share" overlap by \d+ x \d+ px on \/gallery/);

        const broken = await outcome("layout-broken-image");
        assert.deepEqual(broken.findings, []);
        assert.equal(broken.failed.length, 1, JSON.stringify(broken.failed));
        assert.match(broken.failed[0], /^\/gallery shows every image it loads: .*images on \/gallery that loaded but can't be shown: \/missing-logo\.png/);

        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET"), [], "read-only");
    } finally {
        await fixture.close();
    }
});

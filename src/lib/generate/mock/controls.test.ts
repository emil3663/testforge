/**
 * Phase 41 (TFP-182, Decision 3): controls on read-only pages do their job.
 * The comparison fixture's /store is inspected, a Standard functional suite
 * is generated from it, and the five checks run in a real browser through
 * the Playwright CLI, behind the recording proxy - on the clean store and
 * with each control defect switched on.
 *
 * ISTQB technique: decision table. Conditions: which control is broken
 * (none; the name sort reversed; the sorted list drawing 1.5 s late (TFP-240,
 * no defect: every check passes); the price range dropping its maximum; the
 * stepper doing nothing; Home leading elsewhere; an error entry in a list).
 * One column each; in every column the broken control's check fails, naming
 * the control, the page and the value at fault, and every other check
 * passes. Each check's own technique is named in the generated test (sort:
 * decision table; filter: boundary value analysis; stepper: state
 * transition; links: decision table; option lists: error guessing).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/controls.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import type { ExecutionRecord } from "../../report/types.ts";
import type { ContentProfile } from "./types.ts";

const { mockGenerate } = await import("./index.ts");
const { buildControlTests } = await import("./controls.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("../normalize.ts");
const { inspectPages } = await import("../../introspect/inspector.ts");
const { flattenSuites } = await import("../../report/execution.ts");
const { findTypeErrors } = await import("../validate.ts");
const { startRecordedFixture } = await import("../../../test-support/comparison-fixture.ts");
const { chromiumSkipReason } = await import("../../../test-support/chromium.ts");
const { runPlaywrightSpec } = await import("../../../test-support/playwright-cli.ts");
const needsChromium = await chromiumSkipReason();

const NEW_CHECKS = "sort options|filters send|quantity steppers|option lists show|navigation links land";
const ITEM = "/store/item/01J8Z3K4QWHAMMER";

async function runSuite(code: string, label: string): Promise<ExecutionRecord[]> {
    const { report } = await runPlaywrightSpec(code, `controls-unit-${label}`, ["--timeout=60000", "--workers=1", "--grep", NEW_CHECKS], { TESTFORGE_INTERACTIVE: "0" });
    return flattenSuites(report.suites);
}

const page = (path: string, actionableElements: unknown[]) => ({ path, url: path, title: "", metaDescription: "", headings: [], buttons: [], links: [], visibleTextSnippets: [], actionableElements });
const element = (elementType: string, text: string, inputType = "", role: string | null = null) => ({ text, url: null, category: "action", elementType, containerLabel: "", expectedStatus: null, isVisible: true, ariaPressed: null, ariaSelected: null, ariaChecked: null, ariaExpanded: null, groupId: null, locator: { role, name: "", label: "", placeholder: "", id: "", inputType } });

test("which pages get which check, from what inspection recorded (decision table)", () => {
    const profile = {
        scannedAt: "", baseUrl: "http://example.test",
        pages: [
            page("/", [element("select", "Name (A - Z)Name (Z - A)Price (Low - High)"), element("input", "", "checkbox", "checkbox")]),
            page("/item", [element("input", "1", "number", "spinbutton"), element("select", "SmallLarge")]),
            page("/about", [element("button", "Read more")]),
        ],
    } as unknown as ContentProfile;
    const titles = buildControlTests(profile).tests.map((source) => /test\('([^']+)'/.exec(source)?.[1]);
    assert.deepEqual(titles, [
        "sort options order the items on /",
        "filters send and respect the chosen values on /",
        "option lists show no error text on /",
        "quantity steppers change the value by one on /item",
        "option lists show no error text on /item",
        "navigation links land where their text says, from /",
    ]);
    assert.deepEqual(buildControlTests(null), { tests: [], helpers: "" });
    // A select that isn't a sort gets the option-list check only.
    const plain = buildControlTests({ ...profile, pages: [page("/x", [element("select", "Red Green Blue")])] } as unknown as ContentProfile);
    assert.equal(plain.tests.filter((source) => source.includes("sort options")).length, 0);
});

test("in a real browser: on the fixture's /store, each broken control fails its own check, named, and the clean store passes all five (decision table)", { skip: needsChromium }, async () => {
    const fixture = await startRecordedFixture();
    try {
        const inspection = await inspectPages(fixture.origin, ["/store", ITEM]);
        const profile = { scannedAt: new Date().toISOString(), baseUrl: fixture.origin, ...inspection };
        const code = mockGenerate(fixture.origin, "Check the site.", ["functional"], profile as never, normalizeContentRules({ paths: ["/store", ITEM] }), normalizeTestAuditMode("fast"));
        assert.deepEqual(findTypeErrors(code), []);

        const checks = {
            sort: "sort options order the items on /store",
            filter: "filters send and respect the chosen values on /store",
            stepper: `quantity steppers change the value by one on ${ITEM}`,
            options: `option lists show no error text on ${ITEM}`,
            links: "navigation links land where their text says, from /store",
        };
        const columns: Array<[string, keyof typeof checks | null, RegExp | null]> = [
            ["none", null, null],
            ["controls-sort-reversed", "sort", /sorting by "Name \(A - Z\)" on \/store puts "Wood Saw" before "Pliers"/],
            // TFP-240: a sorted list that draws late is no defect: the sort check waits for it.
            ["controls-sort-late", null, null],
            ["controls-filter-drops-max", "filter", /moving the "Highest price" slider on \/store from 50 to 49 sent GET http:\/\/127\.0\.0\.1:\d+\/api\/store\/products\?between=price%2C1, which does not carry 49/],
            ["controls-stepper-broken", "stepper", /on \/store\/item\/01J8Z3K4QWHAMMER, "\+" beside "Quantity" left it at 1 \(it was 1; expected 2\)/],
            ["controls-home-link-wrong", "links", /"Home" on \/store leads to \/notes \("Notes"\), not the start page/],
            ["controls-option-errors", "options", /the "Gift wrap" list on \/store\/item\/01J8Z3K4QWHAMMER offers "Error 101: Wrapping not found"/],
        ];
        for (const [defect, broken, message] of columns) {
            await fixture.control(`/__fixture/defect?set=${defect}`);
            const records = await runSuite(code, defect);
            for (const [check, title] of Object.entries(checks)) {
                const found = records.filter((record) => record.title.endsWith(title));
                assert.equal(found.length, 1, `${defect}: ${title}: ${found.length} in ${records.map((record) => record.title).join(" | ")}`);
                const [record] = found;
                if (check === broken) {
                    assert.equal(record.status, "Failed", `${defect}: ${title}`);
                    assert.match(record.rawMessage, message as RegExp, `${defect}: ${record.rawMessage.split("\n")[0]}`);
                } else {
                    assert.equal(record.status, "Passed", `${defect}: ${title}: ${record.rawMessage.split("\n")[0]}`);
                }
            }
        }
        // The guard held: the interactions sent only GETs.
        assert.deepEqual(fixture.recorded.filter((request) => request.method !== "GET"), []);
    } finally {
        await fixture.close();
    }
});

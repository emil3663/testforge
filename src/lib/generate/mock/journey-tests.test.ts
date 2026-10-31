/**
 * TFP-091: buildJourneyTests / buildJourneyTitle, and mockGenerate's wiring.
 *
 * Requires the "@/" alias resolution journey-tests.ts uses at runtime - run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/journey-tests.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { buildJourneyTests, buildJourneyTitle, JOURNEY_HELPERS } from "./journey-tests.ts";
import { mockGenerate } from "./index.ts";
import type { CandidateJourney, ContentProfile, ContentRules, SiteGraphEdge } from "./types";

function edge(overrides: Partial<SiteGraphEdge>): SiteGraphEdge {
    return {
        from: "/",
        to: "/login",
        kind: "link",
        text: "Sign in",
        rawValue: "/login",
        tagName: "a",
        attributeName: "href",
        containerLabel: "",
        ...overrides,
    };
}

const loginForm = edge({ from: "/login", to: "/authenticate", kind: "form-submit", text: "Username Password Login", rawValue: "/authenticate", tagName: "form", attributeName: "action" });

function journey(overrides: Partial<CandidateJourney> = {}): CandidateJourney {
    return {
        id: "automatic||/ > /login > /authenticate",
        source: "automatic",
        label: null,
        path: ["/", "/login", "/authenticate"],
        steps: [edge({}), loginForm],
        declaredExitPath: null,
        exitInGraph: false,
        rank: 1,
        ...overrides,
    };
}

function rules(selectedJourneyIds: string[]): ContentRules {
    return { paths: ["/"], requiredHeadings: [], requiredText: [], forbiddenText: [], selectedJourneyIds };
}

function profile(journeys: CandidateJourney[]): ContentProfile {
    return { scannedAt: "", baseUrl: "https://app.example.com", pages: [], journeys };
}

test("TFP-267: an attribute's name is escaped for CSS, whatever it holds, and an ordinary name is left alone", () => {
    const selectorFor = (attributeName: string) => {
        const step = { ...loginForm, attributeName, rawValue: "x" };
        const [code] = buildJourneyTests(profile([journey({ steps: [step] })]), rules([journey().id]));
        return code;
    };
    assert.ok(selectorFor("xlink:href").includes(String.raw`[xlink\\:href="x"]`), selectorFor("xlink:href"));
    assert.ok(selectorFor("data.id").includes(String.raw`[data\\.id="x"]`), selectorFor("data.id"));
    assert.ok(selectorFor("data-test_id").includes(`[data-test_id="x"]`), selectorFor("data-test_id"));
});

test("no selection generates no journey test - never every candidate", () => {
    assert.deepStrictEqual(buildJourneyTests(profile([journey()]), rules([])), []);
    assert.deepStrictEqual(buildJourneyTests(null, rules(["automatic||/ > /login > /authenticate"])), []);
});

test("exactly the selected journeys get a test, and an id the profile doesn't offer gets none", () => {
    const other = journey({ id: "automatic||/a > /b", path: ["/a", "/b"], steps: [loginForm] });
    const tests = buildJourneyTests(profile([journey(), other]), rules([other.id, "gone"]));

    assert.strictEqual(tests.length, 1);
    assert.ok(tests[0].includes(`test('${buildJourneyTitle(other)}'`));
});

test("the test is skipped unless interactive tests are enabled for the run", () => {
    const [body] = buildJourneyTests(profile([journey()]), rules([journey().id]));

    assert.ok(body.includes("test.skip(process.env.TESTFORGE_INTERACTIVE !== '1'"));
});

test("each hop is asserted in order, using the real element from the graph", () => {
    const [body] = buildJourneyTests(profile([journey()]), rules([journey().id]));

    assert.ok(body.indexOf("Step 1: open the entry page /") < body.indexOf("Step 2: follow"));
    assert.ok(body.indexOf("Step 2: follow") < body.indexOf("Step 3: fill and submit"));
    assert.ok(body.includes(`page.locator('a[href="/login"]:visible')`));
    assert.ok(body.includes(`page.locator('form[action="/authenticate"]:visible')`));
    assert.ok(body.includes("should reach ' + '/login'"));
    assert.ok(body.includes("should send a request to ' + '/authenticate'"));
});

test("a form-submit final hop asserts the submit reached its endpoint without failing, not that the browser ended on it", () => {
    const [body] = buildJourneyTests(profile([journey()]), rules([journey().id]));

    assert.ok(body.includes("toBeLessThan(500)"));
    // A post/redirect/get server leaves the browser elsewhere; only a mid-path submit asserts where the walk continues.
    assert.ok(!body.includes("the walk should continue from"));
});

test("a named flow with an unverified exit asserts the app actually reaches it after submitting", () => {
    const named = journey({
        id: "named|login|/login > /authenticate",
        source: "named",
        label: "login",
        path: ["/login", "/authenticate"],
        steps: [loginForm],
        declaredExitPath: "/secure",
        exitInGraph: false,
    });
    const [body] = buildJourneyTests(profile([named]), rules([named.id]));

    assert.ok(body.includes("expect(atPath(), 'the journey ' + 'login' + ' declares ' + '/secure'"));
    assert.ok(body.includes(".toBe('/secure')"));
    assert.ok(body.indexOf("Step 2: fill and submit") < body.indexOf("Declared exit"));
});

test("an exit the graph itself reaches is not asserted twice; an automatic journey has no exit assertion", () => {
    const viaGraph = journey({ source: "named", label: "signin", declaredExitPath: "/authenticate", exitInGraph: true });

    assert.ok(!buildJourneyTests(profile([viaGraph]), rules([viaGraph.id]))[0].includes("Declared exit"));
    assert.ok(!buildJourneyTests(profile([journey()]), rules([journey().id]))[0].includes("Declared exit"));
});

test("a formaction submit control is located by its own attribute and submits its enclosing form", () => {
    const formaction = edge({ from: "/cart", to: "/order", kind: "form-submit", text: "Place order", rawValue: "/order", tagName: "button", attributeName: "formaction" });
    const j = journey({ id: "automatic||/cart > /order", path: ["/cart", "/order"], steps: [formaction] });
    const [body] = buildJourneyTests(profile([j]), rules([j.id]));

    assert.ok(body.includes(`page.locator('button[formaction="/order"]:visible')`));
    assert.ok(body.includes("xpath=ancestor::form"));
});

test("quotes and backslashes in a label or raw value can't break out of the generated test", async () => {
    const ts = await import("typescript");
    const tricky = edge({ text: "It's \"quoted\" \\ back", rawValue: "/a'b\"c\\d" });
    const j = journey({ steps: [tricky, loginForm] });
    const tests = buildJourneyTests(profile([j]), rules([j.id]));
    const source = [
        "import { test, expect } from '@playwright/test';",
        JOURNEY_HELPERS,
        "test.describe('x', () => {",
        tests.join("\n"),
        "});",
    ].join("\n");
    const { diagnostics } = ts.default.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.default.ModuleKind.ESNext } });

    assert.deepStrictEqual((diagnostics ?? []).map((d) => ts.default.flattenDiagnosticMessageText(d.messageText, "\n")), []);
    // The label reaches the generated source escaped, not raw.
    assert.ok(tests[0].includes("It\\'s"));
});

test("mockGenerate emits the helpers and journey tests inside the functional suite only when functional is generated", () => {
    const j = journey();
    const withFunctional = mockGenerate("https://app.example.com", "functional flows", ["functional"], profile([j]), rules([j.id]), "fast");
    assert.ok(withFunctional.includes(JOURNEY_HELPERS));
    assert.ok(withFunctional.includes(buildJourneyTitle(j)));
    assert.ok(/test\('TFFU-\d{3}: journey \/ > \/login > \/authenticate'/.test(withFunctional));

    const withoutFunctional = mockGenerate("https://app.example.com", "seo checks", ["seo/content"], profile([j]), rules([j.id]), "fast");
    assert.ok(!withoutFunctional.includes("fillFormWithSampleValues"));

    const noSelection = mockGenerate("https://app.example.com", "functional flows", ["functional"], profile([j]), rules([]), "fast");
    assert.ok(!noSelection.includes("fillFormWithSampleValues"));
});

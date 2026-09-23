/**
 * TFP-089: identifyJourneys / normalizeNamedFlows.
 *
 * Deterministic coverage of Acceptance Criteria §2: a form-submit path is
 * surfaced and ranked, a named flow outranks an automatic one over the same
 * pages, a named flow's exit beyond the graph is carried as declared (Decision
 * 4's amendment), and nothing longer than the hop cap is surfaced - excluded,
 * not truncated into a shorter, wrong candidate. The live half (a real
 * target's real flow) is recorded in TEST_PLAN.md INT-09.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/introspect/journeys.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { identifyJourneys, MAX_JOURNEY_HOPS, MAX_JOURNEYS, normalizeNamedFlows, selectJourneys } from "./journeys.ts";
import { normalizeContentProfile, normalizeContentRules } from "../generate/normalize.ts";
import type { SiteGraph, SiteGraphEdge, SiteGraphEdgeKind } from "./types";

function graph(...edges: [string, string, SiteGraphEdgeKind][]): SiteGraph {
    const nodePaths = [...new Set(edges.flatMap(([from, to]) => [from, to]))];
    const built: SiteGraphEdge[] = edges.map(([from, to, kind]) => ({
        from,
        to,
        kind,
        text: `${kind} ${from}->${to}`,
        rawValue: to,
        tagName: kind === "form-submit" ? "form" : "a",
        attributeName: kind === "form-submit" ? "action" : "href",
        containerLabel: "",
    }));

    return {
        nodes: nodePaths.map((path) => ({ path, url: `http://site.test${path}`, title: path, inspected: true })),
        edges: built,
    };
}

function chain(length: number, last: SiteGraphEdgeKind = "form-submit") {
    return graph(
        ...Array.from({ length }, (_, index): [string, string, SiteGraphEdgeKind] => [
            `/p${index}`,
            `/p${index + 1}`,
            index === length - 1 ? last : "link",
        ])
    );
}

test("a path ending in a form submit is a candidate, naming each step's real element; a path ending in a link is not", () => {
    const { journeys } = identifyJourneys(graph(["/", "/login", "link"], ["/login", "/authenticate", "form-submit"], ["/", "/about", "link"]));

    assert.deepStrictEqual(journeys.map((journey) => journey.path), [["/login", "/authenticate"], ["/", "/login", "/authenticate"]]);
    assert.deepStrictEqual(
        journeys[1].steps.map((step) => [step.kind, step.tagName, step.text]),
        [["link", "a", "link /->/login"], ["form-submit", "form", "form-submit /login->/authenticate"]]
    );
    assert.ok(journeys.every((journey) => journey.source === "automatic" && journey.declaredExitPath === null));
});

test("automatic candidates rank shortest first and ranks are 1-based and contiguous", () => {
    const { journeys } = identifyJourneys(chain(3));

    assert.deepStrictEqual(journeys.map((journey) => journey.steps.length), [1, 2, 3]);
    assert.deepStrictEqual(journeys.map((journey) => journey.rank), [1, 2, 3]);
});

test("a form that posts back to its own page is a 1-hop journey; a cycle back to an earlier page is not walked", () => {
    const self = identifyJourneys(graph(["/contact", "/contact", "form-submit"]));
    assert.deepStrictEqual(self.journeys.map((journey) => journey.path), [["/contact", "/contact"]]);

    const cycle = identifyJourneys(graph(["/a", "/b", "link"], ["/b", "/a", "link"], ["/b", "/c", "form-submit"]));
    assert.deepStrictEqual(cycle.journeys.map((journey) => journey.path), [["/b", "/c"], ["/a", "/b", "/c"]]);
});

test("a named flow whose exit is beyond the graph matches as far as the form submit and carries the exit as declared", () => {
    const { journeys } = identifyJourneys(
        graph(["/", "/login", "link"], ["/login", "/authenticate", "form-submit"]),
        [{ label: "login", entryPath: "/login", exitPath: "/secure" }]
    );

    assert.deepStrictEqual(
        journeys.map((journey) => [journey.source, journey.label, journey.path, journey.declaredExitPath, journey.exitInGraph]),
        [
            ["named", "login", ["/login", "/authenticate"], "/secure", false],
            ["automatic", null, ["/", "/login", "/authenticate"], null, false],
        ]
    );
});

test("a named flow outranks an automatic candidate over the same pages, which is then surfaced once", () => {
    const { journeys } = identifyJourneys(
        graph(["/cart", "/checkout", "link"], ["/checkout", "/confirm", "form-submit"], ["/x", "/y", "form-submit"]),
        [{ label: "checkout", entryPath: "/cart", exitPath: "/confirm" }]
    );

    assert.deepStrictEqual(
        journeys.map((journey) => [journey.rank, journey.source, journey.path.join(">")]),
        [
            [1, "named", "/cart>/checkout>/confirm"],
            [2, "automatic", "/checkout>/confirm"],
            [3, "automatic", "/x>/y"],
        ]
    );
    assert.strictEqual(journeys[0].exitInGraph, true);
    assert.strictEqual(journeys.filter((journey) => journey.path.join(">") === "/cart>/checkout>/confirm").length, 1);
});

test("a named flow that matches an automatic journey's exact pages replaces it, keeping the named rank", () => {
    const { journeys } = identifyJourneys(
        graph(["/login", "/authenticate", "form-submit"]),
        [{ label: "login", entryPath: "/login", exitPath: "/authenticate" }]
    );

    assert.deepStrictEqual(journeys.map((journey) => [journey.source, journey.rank]), [["named", 1]]);
});

test("a journey of exactly the hop limit is surfaced; one hop over is excluded, not truncated", () => {
    assert.strictEqual(MAX_JOURNEY_HOPS, 6);

    const atLimit = identifyJourneys(chain(6));
    assert.ok(atLimit.journeys.some((journey) => journey.steps.length === 6 && journey.path[0] === "/p0"));

    const overLimit = identifyJourneys(chain(7));
    assert.ok(overLimit.journeys.every((journey) => journey.steps.length <= 6));
    assert.ok(!overLimit.journeys.some((journey) => journey.path[0] === "/p0"));
});

test("a named flow whose exit is reachable only past the hop limit is excluded with a warning, with no shorter fallback", () => {
    const { journeys, warnings } = identifyJourneys(
        chain(7, "link"),
        [{ label: "long", entryPath: "/p0", exitPath: "/p7" }]
    );

    assert.deepStrictEqual(journeys, []);
    assert.match(warnings.join("\n"), /"long".*7 hops.*over the 6-hop limit/);
});

test("a named flow with an unknown or uninspected entry is excluded with a warning", () => {
    const g = graph(["/a", "/b", "form-submit"]);
    const { journeys, warnings } = identifyJourneys(g, [
        { label: "ghost", entryPath: "/ghost", exitPath: "/z" },
        { label: "leaf", entryPath: "/b", exitPath: "/z" },
    ]);

    assert.deepStrictEqual(journeys.map((journey) => journey.source), ["automatic"]);
    assert.match(warnings[0], /"ghost".*not a page in the site graph/);
    assert.match(warnings[1], /"leaf".*not introspected/);
});

test("no more than the journey cap is surfaced, and the surplus is reported", () => {
    assert.strictEqual(MAX_JOURNEYS, 20);

    const fan = graph(...Array.from({ length: 30 }, (_, index): [string, string, SiteGraphEdgeKind] => [`/from${index}`, `/to${index}`, "form-submit"]));
    const { journeys, warnings } = identifyJourneys(fan);

    assert.strictEqual(journeys.length, 20);
    assert.strictEqual(journeys[19].rank, 20);
    assert.match(warnings.join("\n"), /30 candidate journeys found; showing the top 20/);
});

test("named flows are never displaced by the cap", () => {
    const fan = graph(
        ...Array.from({ length: 30 }, (_, index): [string, string, SiteGraphEdgeKind] => [`/from${index}`, `/to${index}`, "form-submit"]),
        ["/zz-entry", "/zz-submit", "form-submit"]
    );
    const { journeys } = identifyJourneys(fan, [{ label: "z", entryPath: "/zz-entry", exitPath: "/done" }]);

    assert.strictEqual(journeys[0].label, "z");
    assert.strictEqual(journeys.length, 20);
});

test("normalizeNamedFlows trims, normalizes paths, and drops incomplete entries", () => {
    assert.deepStrictEqual(
        normalizeNamedFlows([
            { label: " login ", entryPath: "login/", exitPath: "/secure?x=1#y" },
            { label: "", entryPath: "/a", exitPath: "/b" },
            { label: "no exit", entryPath: "/a" },
            "junk",
        ]),
        [{ label: "login", entryPath: "/login", exitPath: "/secure" }]
    );
    assert.deepStrictEqual(normalizeNamedFlows(undefined), []);
});

test("journeys survive normalizeContentProfile; a journey whose steps don't match the graph is dropped", () => {
    const g = graph(["/", "/login", "link"], ["/login", "/authenticate", "form-submit"]);
    const { journeys } = identifyJourneys(g, [{ label: "login", entryPath: "/login", exitPath: "/secure" }]);
    const forged = { ...journeys[0], id: "forged", steps: [{ ...journeys[0].steps[0], rawValue: "/not-in-graph" }] };

    const profile = normalizeContentProfile({ scannedAt: "", baseUrl: "http://site.test", pages: [], siteGraph: g, journeys: [...journeys, forged] });

    assert.deepStrictEqual(profile?.journeys, journeys);
});

// TFP-090: the selection carried in run config.
test("selectJourneys returns exactly the selected journeys in rank order, drops unknown ids, and empty selects nothing", () => {
    const { journeys } = identifyJourneys(chain(3));
    const [first, , third] = journeys;

    assert.deepStrictEqual(selectJourneys(journeys, [third.id, first.id, "gone"]).map((journey) => journey.id), [first.id, third.id]);
    assert.deepStrictEqual(selectJourneys(journeys, []), []);
});

test("normalizeContentRules carries selectedJourneyIds exactly, defaulting to none", () => {
    const id = "named|two  spaces|/a > /b";

    assert.deepStrictEqual(normalizeContentRules({ paths: ["/"], selectedJourneyIds: [id, id, "", 7, "automatic||/x > /y"] }).selectedJourneyIds, [id, "automatic||/x > /y"]);
    assert.deepStrictEqual(normalizeContentRules({ paths: ["/"] }).selectedJourneyIds, []);
    assert.deepStrictEqual(normalizeContentRules(undefined).selectedJourneyIds, []);
});

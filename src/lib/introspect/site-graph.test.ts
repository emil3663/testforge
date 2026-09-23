/**
 * TFP-088: buildSiteGraph.
 *
 * Deterministic coverage of the edge rules the decision record's acceptance
 * criterion depends on (an edge names the actual element that produces it,
 * never an assumed connection). The live half of that criterion - the graph
 * matching a real target's navigation - is recorded in TEST_PLAN.md INT-08.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/introspect/site-graph.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { buildSiteGraph } from "./site-graph.ts";
import { normalizeContentProfile } from "../generate/normalize.ts";
import type { EmbeddedLinkDetail, LinkDetail, PageSnapshot } from "./types";

const BASE = "http://site.test";

function link(overrides: Partial<LinkDetail>): LinkDetail {
    return {
        text: "",
        url: `${BASE}/`,
        rawHref: "/",
        category: "navigation",
        linkType: "internal",
        containerLabel: "",
        expectedStatus: null,
        isVisible: true,
        target: "",
        targetBehavior: "same-window",
        titleAttribute: "",
        downloadName: "",
        requiresAuth: false,
        isSecure: false,
        ...overrides,
    };
}

function embedded(overrides: Partial<EmbeddedLinkDetail>): EmbeddedLinkDetail {
    return {
        text: "",
        url: `${BASE}/`,
        rawValue: "/",
        tagName: "form",
        attributeName: "action",
        kind: "form",
        source: "dom",
        containerLabel: "",
        sameOrigin: true,
        isVisible: true,
        ...overrides,
    };
}

function page(path: string, overrides: Partial<PageSnapshot> = {}): PageSnapshot {
    return {
        path,
        url: `${BASE}${path}`,
        title: path,
        metaDescription: "",
        headings: [],
        buttons: [],
        links: [],
        actionableElements: [],
        linkDetails: [],
        embeddedLinkDetails: [],
        dragDropTargets: [],
        visibleTextSnippets: [],
        storageUsage: { localStorage: false, sessionStorage: false, indexedDB: false },
        ...overrides,
    };
}

test("an internal link is an edge naming the element that produces it", () => {
    const graph = buildSiteGraph(BASE, [
        page("/", { linkDetails: [link({ text: "Login", url: `${BASE}/login`, rawHref: "/login" })] }),
        page("/login"),
    ]);

    assert.deepStrictEqual(graph.edges, [{
        from: "/",
        to: "/login",
        kind: "link",
        text: "Login",
        rawValue: "/login",
        tagName: "a",
        containerLabel: "",
    }]);
});

test("a form action and a formaction button are form-submit edges", () => {
    const graph = buildSiteGraph(BASE, [
        page("/login", {
            embeddedLinkDetails: [
                embedded({ url: `${BASE}/authenticate`, rawValue: "/authenticate" }),
                embedded({ url: `${BASE}/other`, rawValue: "/other", tagName: "button", attributeName: "formaction", kind: "button", text: "Alt submit" }),
            ],
        }),
    ]);

    assert.deepStrictEqual(
        graph.edges.map((edge) => [edge.from, edge.to, edge.kind, edge.tagName, edge.rawValue]),
        [
            ["/login", "/authenticate", "form-submit", "form", "/authenticate"],
            ["/login", "/other", "form-submit", "button", "/other"],
        ]
    );
});

test("onclick/data-href navigation is an action edge; resource loads are not edges", () => {
    const graph = buildSiteGraph(BASE, [
        page("/", {
            embeddedLinkDetails: [
                embedded({ url: `${BASE}/go`, rawValue: "/go", tagName: "div", attributeName: "onclick", kind: "interactive", source: "heuristic" }),
                embedded({ url: `${BASE}/card`, rawValue: "/card", tagName: "div", attributeName: "data-href", kind: "data" }),
                embedded({ url: `${BASE}/app.js`, rawValue: "/app.js", tagName: "script", attributeName: "src", kind: "script" }),
                embedded({ url: `${BASE}/frame`, rawValue: "/frame", tagName: "iframe", attributeName: "src", kind: "iframe" }),
            ],
        }),
    ]);

    assert.deepStrictEqual(graph.edges.map((edge) => [edge.to, edge.kind]), [["/go", "action"], ["/card", "action"]]);
});

test("external, anchor, mailto, download and inert links are not edges", () => {
    const graph = buildSiteGraph(BASE, [
        page("/", {
            linkDetails: [
                link({ url: "https://other.test/x", linkType: "external" }),
                link({ url: `${BASE}/#top`, linkType: "anchor" }),
                link({ url: "mailto:a@b.c", linkType: "mailto" }),
                link({ url: `${BASE}/f.zip`, linkType: "download" }),
                link({ url: `${BASE}/`, linkType: "inert" }),
            ],
        }),
    ]);

    assert.deepStrictEqual(graph.edges, []);
});

test("a same-origin edge whose linkType says internal but whose host differs is dropped", () => {
    const graph = buildSiteGraph(BASE, [
        page("/", { linkDetails: [link({ url: "https://other.test/x", linkType: "internal" })] }),
    ]);

    assert.deepStrictEqual(graph.edges, []);
});

test("a link self-edge is dropped; a form-submit self-edge is kept", () => {
    const graph = buildSiteGraph(BASE, [
        page("/login", {
            linkDetails: [link({ text: "Login", url: `${BASE}/login`, rawHref: "/login" })],
            embeddedLinkDetails: [embedded({ url: `${BASE}/login`, rawValue: "/login" })],
        }),
    ]);

    assert.deepStrictEqual(graph.edges.map((edge) => [edge.from, edge.to, edge.kind]), [["/login", "/login", "form-submit"]]);
});

test("the same element repeated on one page is one edge; a differently-labeled link to the same page is another", () => {
    const nav = link({ text: "Docs", url: `${BASE}/docs`, rawHref: "/docs" });
    const graph = buildSiteGraph(BASE, [
        page("/", { linkDetails: [nav, { ...nav }, link({ text: "Read the docs", url: `${BASE}/docs`, rawHref: "/docs" })] }),
    ]);

    assert.strictEqual(graph.edges.length, 2);
});

test("query and hash never make a distinct page; a target only known from a link is an uninspected node", () => {
    const graph = buildSiteGraph(BASE, [
        page("/", { linkDetails: [link({ text: "Item", url: `${BASE}/items/?id=7#reviews`, rawHref: "/items/?id=7#reviews" })] }),
    ]);

    assert.deepStrictEqual(graph.edges.map((edge) => edge.to), ["/items"]);
    assert.deepStrictEqual(
        graph.nodes.map((node) => [node.path, node.inspected]),
        [["/", true], ["/items", false]]
    );
});

test("the graph survives normalizeContentProfile, and an edge to an unknown node is dropped", () => {
    const graph = buildSiteGraph(BASE, [
        page("/", { linkDetails: [link({ text: "Login", url: `${BASE}/login`, rawHref: "/login" })] }),
        page("/login"),
    ]);
    const profile = normalizeContentProfile({
        scannedAt: "",
        baseUrl: BASE,
        pages: [],
        siteGraph: { ...graph, edges: [...graph.edges, { from: "/", to: "/ghost", kind: "link" }] },
    });

    assert.deepStrictEqual(profile?.siteGraph, graph);
});

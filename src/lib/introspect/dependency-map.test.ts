/**
 * TFP-084: dependenciesFromEmbeddedLinks / aggregateDependencyMap.
 *
 * Covers the two acceptance criteria the decision record names for this
 * ticket deterministically (not only via live verification, which proves the
 * map is real but not every classification edge case on demand):
 * - a same-origin script is never recorded as a dependency, a third-party
 *   one always is, by host and kind (Decision 1 / AC bullet 1-2).
 * - a same-origin fetch/XHR is tagged sameOrigin: true, never misclassified
 *   as third-party (AC bullet 2).
 * - cookies dedupe per distinct name, not collapsed to one row per host (a
 *   real gap found and fixed live against the-internet.herokuapp.com/login,
 *   which sets 5 differently-named cookies on one host).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/introspect/dependency-map.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { aggregateDependencyMap, dependenciesFromEmbeddedLinks } from "./dependency-map.ts";
import type { DependencyDetail, EmbeddedLinkDetail } from "./types";

function embeddedLink(overrides: Partial<EmbeddedLinkDetail>): EmbeddedLinkDetail {
    return {
        text: "",
        url: "https://example.com/thing.js",
        rawValue: "/thing.js",
        tagName: "script",
        attributeName: "src",
        kind: "script",
        source: "dom",
        containerLabel: "",
        sameOrigin: false,
        isVisible: true,
        ...overrides,
    };
}

test("a same-origin script is not recorded as a dependency", () => {
    const dependencies = dependenciesFromEmbeddedLinks([
        embeddedLink({ kind: "script", url: "https://app.example.com/bundle.js", sameOrigin: true }),
    ]);

    assert.strictEqual(dependencies.length, 0);
});

test("a third-party script is recorded with its host and kind", () => {
    const dependencies = dependenciesFromEmbeddedLinks([
        embeddedLink({ kind: "script", url: "https://cdn.example.net/analytics.js", sameOrigin: false }),
    ]);

    assert.strictEqual(dependencies.length, 1);
    assert.strictEqual(dependencies[0].kind, "third-party-script");
    assert.strictEqual(dependencies[0].host, "cdn.example.net");
});

test("a form action host is recorded regardless of same-origin status", () => {
    const dependencies = dependenciesFromEmbeddedLinks([
        embeddedLink({ kind: "form", url: "https://app.example.com/submit", sameOrigin: true, tagName: "form", attributeName: "action" }),
    ]);

    assert.strictEqual(dependencies.length, 1);
    assert.strictEqual(dependencies[0].kind, "form-action");
    assert.strictEqual(dependencies[0].host, "app.example.com");
    assert.strictEqual(dependencies[0].sameOrigin, true);
});

test("an iframe src is recorded regardless of same-origin status", () => {
    const dependencies = dependenciesFromEmbeddedLinks([
        embeddedLink({ kind: "iframe", url: "https://widgets.example.org/embed", sameOrigin: false, tagName: "iframe", attributeName: "src" }),
    ]);

    assert.strictEqual(dependencies.length, 1);
    assert.strictEqual(dependencies[0].kind, "iframe");
    assert.strictEqual(dependencies[0].host, "widgets.example.org");
});

test("a stylesheet or image embedded link is not a recorded dependency kind", () => {
    const dependencies = dependenciesFromEmbeddedLinks([
        embeddedLink({ kind: "stylesheet", url: "https://cdn.example.net/site.css", sameOrigin: false }),
        embeddedLink({ kind: "image", url: "https://cdn.example.net/logo.png", sameOrigin: false }),
    ]);

    assert.strictEqual(dependencies.length, 0);
});

function dependency(overrides: Partial<DependencyDetail>): DependencyDetail {
    return {
        kind: "xhr-fetch",
        host: "api.example.com",
        url: "https://api.example.com/data",
        sameOrigin: false,
        method: "GET",
        ...overrides,
    };
}

test("a same-origin fetch is tagged sameOrigin: true, not misclassified as third-party", () => {
    const map = aggregateDependencyMap([
        { path: "/", dependencies: [dependency({ host: "app.example.com", url: "https://app.example.com/api/data", sameOrigin: true })] },
    ]);

    assert.strictEqual(map.length, 1);
    assert.strictEqual(map[0].sameOrigin, true);
    assert.strictEqual(map[0].kind, "xhr-fetch");
});

test("the same (host, kind) observed on multiple pages dedupes to one row with an accurate occurrence count and path list", () => {
    const map = aggregateDependencyMap([
        { path: "/", dependencies: [dependency({ host: "api.example.com" })] },
        { path: "/about", dependencies: [dependency({ host: "api.example.com" })] },
    ]);

    assert.strictEqual(map.length, 1);
    assert.strictEqual(map[0].occurrences, 2);
    assert.deepStrictEqual(map[0].paths, ["/", "/about"]);
});

test("distinctly-named cookies on the same host are separate rows, not collapsed to one", () => {
    const map = aggregateDependencyMap([
        {
            path: "/",
            dependencies: [
                dependency({ kind: "cookie", host: "example.com", url: "session_id", sameOrigin: true, method: null }),
                dependency({ kind: "cookie", host: "example.com", url: "analytics_id", sameOrigin: true, method: null }),
            ],
        },
    ]);

    assert.strictEqual(map.length, 2);
    assert.deepStrictEqual(
        map.map((entry) => entry.sampleUrl).sort(),
        ["analytics_id", "session_id"]
    );
});

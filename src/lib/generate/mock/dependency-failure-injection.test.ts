/**
 * TFP-085: buildDependencyFailureTests / buildDependencyFailureTitle.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/mock/dependency-failure-injection.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import {
    buildDependencyFailureTests,
    buildDependencyFailureTitle,
    isRoutableDependencyKind,
} from "./dependency-failure-injection.ts";
import type { ContentProfile, DependencyMapEntry } from "./types";

function entry(overrides: Partial<DependencyMapEntry>): DependencyMapEntry {
    return {
        host: "cdn.example.net",
        kind: "third-party-script",
        sampleUrl: "https://cdn.example.net/analytics.js",
        sameOrigin: false,
        method: null,
        rawValue: null,
        occurrences: 1,
        paths: ["/"],
        ...overrides,
    };
}

function profile(dependencyMap: DependencyMapEntry[]): ContentProfile {
    return { scannedAt: "", baseUrl: "https://app.example.com", pages: [], dependencyMap };
}

// Decision 4 (revised, phase-18-integration-mapping-decision-record.md):
// redirect is routable and gets a test by default like every other
// routable kind - there's no shared storageState across generated tests
// today (each runs in its own isolated Playwright context), so nothing
// about "auth-critical" applies yet. Only cookie is excluded, and for an
// unrelated, mechanical reason (not a routable request at all).
test("cookie is not a routable dependency kind; every other kind, including redirect, is", () => {
    assert.strictEqual(isRoutableDependencyKind("cookie"), false);
    for (const kind of ["xhr-fetch", "form-action", "third-party-script", "iframe", "redirect"] as const) {
        assert.strictEqual(isRoutableDependencyKind(kind), true);
    }
});

test("one test is generated per routable dependency, including redirect; none for cookies", () => {
    const tests = buildDependencyFailureTests(profile([
        entry({ kind: "third-party-script", host: "cdn.example.net" }),
        entry({ kind: "cookie", host: "app.example.com", sampleUrl: "session_id" }),
        entry({ kind: "xhr-fetch", host: "api.example.com", sampleUrl: "https://api.example.com/data?t=12345" }),
        entry({ kind: "redirect", host: "login.example.com", sampleUrl: "https://login.example.com/sso" }),
    ]));

    assert.strictEqual(tests.length, 3);
});

test("the generated test title exactly matches buildDependencyFailureTitle's output", () => {
    const dependency = entry({ host: "cdn.example.net", kind: "third-party-script" });
    const [testBody] = buildDependencyFailureTests(profile([dependency]));

    assert.ok(testBody.includes(`test('${buildDependencyFailureTitle(dependency)}'`));
});

test("routes by host + pathname, not the full sampleUrl (which may carry a per-request query string)", () => {
    const dependency = entry({
        host: "api.example.com",
        kind: "xhr-fetch",
        sampleUrl: "https://api.example.com/track?t=1790162993344&u=abc123",
    });
    const [testBody] = buildDependencyFailureTests(profile([dependency]));

    assert.ok(testBody.includes("url.host === 'api.example.com'"));
    assert.ok(testBody.includes("url.pathname === '/track'"));
    assert.ok(!testBody.includes("1790162993344"));
});

test("asserts graceful degradation generically: body visible, no uncaught page errors, no 5xx", () => {
    const [testBody] = buildDependencyFailureTests(profile([entry({})]));

    assert.ok(testBody.includes("page.locator('body')"));
    assert.ok(testBody.includes("pageErrors"));
    assert.ok(testBody.includes("toBeLessThan(500)"));
});

test("a form-action dependency with a known raw action attribute actually submits the form once blocked", () => {
    const dependency = entry({
        kind: "form-action",
        host: "app.example.com",
        sampleUrl: "https://app.example.com/authenticate",
        rawValue: "/authenticate",
    });
    const [testBody] = buildDependencyFailureTests(profile([dependency]));

    assert.ok(testBody.includes('form[action="/authenticate"]'));
    assert.ok(testBody.includes("requestSubmit()"));
});

test("a form-action dependency with no known raw action attribute is still generated, without a submit step", () => {
    const dependency = entry({ kind: "form-action", host: "app.example.com", rawValue: null });
    const [testBody] = buildDependencyFailureTests(profile([dependency]));

    assert.ok(!testBody.includes("requestSubmit()"));
});

test("a non-form dependency never gets a submit step, even if rawValue happens to be set", () => {
    const dependency = entry({ kind: "third-party-script", rawValue: "/bundle.js" });
    const [testBody] = buildDependencyFailureTests(profile([dependency]));

    assert.ok(!testBody.includes("requestSubmit()"));
});

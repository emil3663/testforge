/**
 * Tests for the local-model rules layer (Phase 31 TFP-106, Phase 32, Phase 33).
 *
 * The rules are only useful if every API they recommend is real and every API
 * they forbid is not - a rule naming a nonexistent matcher would teach the
 * model the very defect it exists to fix. Every worked example must also obey
 * Phase 32's lessons, because the model copies examples: it must compile,
 * await every assertion, and contain only placeholder URLs. All of it is
 * checked against the installed @playwright/test, so a Playwright upgrade that
 * renames a matcher fails here instead of silently.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/local-rules.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { ACCESSIBILITY_EXAMPLE, CATEGORY_GUIDES, RELIABILITY_EXAMPLE, SHARED_RULES, localRulesFor } = await import(
    "./local-rules.ts"
);
const { findTypeErrors, findUnawaitedAssertions } = await import("./validate.ts");
const { BEST_PRACTICE_OPTIONS } = await import("./mock/types.ts");

const GUIDES = Object.entries(CATEGORY_GUIDES) as Array<[string, { rules: string; example: string }]>;
const ACCESSIBILITY_RULES = CATEGORY_GUIDES.accessibility?.rules ?? "";

/** Type-checks a bare property access, so a matcher's existence is tested without guessing its arguments. */
function matcherExists(on: "Locator" | "Page", name: string): boolean {
    const target = on === "Locator" ? "locator" : "page";
    return (
        findTypeErrors(
            `import { expect } from '@playwright/test';\nimport type { ${on} } from '@playwright/test';\ndeclare const ${target}: ${on};\nexport const m = expect(${target}).${name};`
        ).length === 0
    );
}

function between(text: string, start: string, end: string): string {
    const from = text.indexOf(start);
    const to = text.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `rules text no longer has a "${start}" ... "${end}" section`);
    return text.slice(from, to);
}

// --- every worked example -----------------------------------------------------

for (const [area, guide] of GUIDES) {
    test(`local rules [${area}]: the worked example compiles against the installed Playwright`, () => {
        assert.deepEqual(findTypeErrors(guide.example), []);
    });

    test(`local rules [${area}]: the worked example awaits every assertion (TFP-108)`, () => {
        // Stricter than the route's gate: the example must not model even a
        // synchronous unawaited expect, because the model copies its style.
        assert.deepEqual(findUnawaitedAssertions(guide.example), []);
    });

    test(`local rules [${area}]: the worked example only uses placeholder URLs (TFP-109)`, () => {
        // Live: /login in the example -> 3/3 suites went to /login; placeholder -> 0/3.
        const urls = guide.example.match(/https?:\/\/[^\s'"`)]+/g) ?? [];
        assert.ok(urls.length > 0, "the example should navigate somewhere");
        for (const url of urls) assert.equal(new URL(url).hostname, "example.invalid", `example uses ${url}`);
    });
}

test("local rules: no guide or shared rule mentions localhost", () => {
    assert.doesNotMatch(localRulesFor(BEST_PRACTICE_OPTIONS), /localhost/);
});

// --- which guides are sent ----------------------------------------------------

test("localRulesFor: always the shared rules, plus only the guides in scope", () => {
    const none = localRulesFor(["functional"]);
    assert.equal(none, SHARED_RULES, "an area without a guide adds nothing");

    const reliabilityOnly = localRulesFor(["reliability"]);
    assert.ok(reliabilityOnly.startsWith(SHARED_RULES));
    assert.ok(reliabilityOnly.includes(RELIABILITY_EXAMPLE));
    assert.ok(!reliabilityOnly.includes(ACCESSIBILITY_EXAMPLE), "an out-of-scope example would be copied as unrelated tests");
});

test("localRulesFor: several areas come out in BEST_PRACTICE_OPTIONS order, whatever order they are passed in", () => {
    const text = localRulesFor(["reliability", "accessibility"]);
    assert.ok(text.indexOf(ACCESSIBILITY_EXAMPLE) < text.indexOf(RELIABILITY_EXAMPLE));
});

// --- shared rules -------------------------------------------------------------

test("local rules: the shared block requires await on every expect (TFP-108)", () => {
    assert.match(SHARED_RULES, /Always write await before every expect\(\.\.\.\) call/);
});

test("local rules: the shared block says placeholders are never copied (Phase 33)", () => {
    assert.match(SHARED_RULES, /example\.invalid/);
    assert.match(SHARED_RULES, /Never copy a placeholder/);
});

test("local rules: every matcher named as a page matcher really works on page", () => {
    const pageMatchers: string[] = between(SHARED_RULES, "page matchers:", ". Never").match(/\bto[A-Z]\w+/g) ?? [];
    assert.ok(pageMatchers.length >= 2, `expected the page matcher list, found ${pageMatchers.join(", ")}`);
    for (const name of pageMatchers) {
        assert.ok(matcherExists("Page", name), `rules call ${name} a page matcher, but expect(page) has no ${name}`);
    }
});

test("local rules: the page-vs-locator mistake the model made is really an error", () => {
    // Live run 2026-09-24: expect(page).toHaveRole(...) - the rules must keep saying not to.
    assert.ok(!matcherExists("Page", "toHaveRole"));
    assert.match(SHARED_RULES, /Never call an element matcher such as toHaveRole .* on page/);
});

// --- accessibility (TFP-106) --------------------------------------------------

test("local rules [accessibility]: every recommended matcher exists", () => {
    const recommended = [...between(ACCESSIBILITY_RULES, "real locator matchers instead", "heading structure").matchAll(/\b(to[A-Z]\w+)\(/g)].map(
        (m) => m[1]
    );
    assert.ok(recommended.length >= 5, `expected the recommended list, found ${recommended.join(", ")}`);
    for (const name of recommended) {
        assert.ok(matcherExists("Locator", name), `rules recommend ${name}, which @playwright/test does not have`);
    }
});

test("local rules [accessibility]: every forbidden matcher really does not exist", () => {
    const forbidden: string[] = between(ACCESSIBILITY_RULES, "do NOT exist", "\n").match(/\bto[A-Z]\w+/g) ?? [];
    assert.ok(forbidden.includes("toBeAccessible"), "the matcher that motivated Phase 31 must stay forbidden");
    for (const name of forbidden) {
        assert.ok(!matcherExists("Locator", name), `rules forbid ${name}, but Playwright now has it - update the rules`);
    }
});

// --- reliability (TFP-111) ----------------------------------------------------

test("local rules [reliability]: every example test simulates a failure before loading the page", () => {
    // The trait that defines the category here: something the page depends on
    // fails first, then the page must survive. A test that loads the page
    // before breaking anything checks nothing about degradation.
    const tests = RELIABILITY_EXAMPLE.split(/\n  test\(/).slice(1);
    assert.ok(tests.length >= 2, "expected several reliability tests");
    for (const body of tests) {
        const inject = body.search(/page\.route\(|page\.addInitScript\(/);
        const load = body.indexOf("page.goto(");
        assert.ok(inject >= 0, `no failure simulation in: ${body.slice(0, 60)}`);
        assert.ok(load > inject, `the page is loaded before the failure is set up in: ${body.slice(0, 60)}`);
        assert.match(body, /page\.on\('pageerror'/, "uncaught errors must be collected");
        assert.match(body, /toBeLessThan\(500\)/, "the page must still respond");
    }
});

test("local rules [reliability]: the rules say the example's failures are generic, not placeholders", () => {
    // Live 2026-09-24: told to replace placeholders with the request's elements,
    // the model wrote page.route('**/email-input/**') - a pattern that matches
    // no request, so nothing failed. The generic patterns must be reused as-is.
    const rules = CATEGORY_GUIDES.reliability?.rules ?? "";
    assert.match(rules, /are NOT placeholders/);
    assert.match(rules, /never write a route pattern named after a page element/);
    for (const pattern of ["'**/api/**'", "localStorage"]) {
        assert.ok(rules.includes(pattern), `rules should name ${pattern}`);
        assert.ok(RELIABILITY_EXAMPLE.includes(pattern), `example should use ${pattern}`);
    }
});

test("local rules [reliability]: every example test blocks something different", () => {
    // Live 2026-09-24: the model often wrote three identical '**/api/**' tests
    // titled after the request's inputs and button. A rule against it did not
    // help (attempt 3) and was reverted; the example must at least not model it.
    const titles = [...RELIABILITY_EXAMPLE.matchAll(/test\('([^']+)'/g)].map((m) => m[1]);
    assert.equal(new Set(titles).size, titles.length);
    const failures = RELIABILITY_EXAMPLE.match(/page\.route\([^,]+|page\.addInitScript\(/g) ?? [];
    assert.equal(new Set(failures).size, failures.length, "each test should simulate a different failure");
});

test("local rules: the shared block forbids passing a promise to expect (Phase 33)", () => {
    // Live 2026-09-24: expect(locator.textContent()).toBe('Sign in') - compiles, always fails.
    assert.match(SHARED_RULES, /Never pass a promise to expect/);
});

test("local rules [reliability]: the example never asserts a specific fallback message", () => {
    assert.doesNotMatch(RELIABILITY_EXAMPLE, /getByText\(|toHaveText\(|toContainText\(/);
});

// --- performance, SEO, database (TFP-112) and security (TFP-113) --------------

const { PERFORMANCE_EXAMPLE, SEO_EXAMPLE, DATABASE_EXAMPLE, SECURITY_EXAMPLE } = await import("./local-rules.ts");

function testBodies(example: string): string[] {
    return example.split(/\n  test\(/).slice(1);
}

test("local rules [performance/load]: every example test measures time against a budget", () => {
    // Baseline: asserted a 200 status, measured nothing.
    for (const body of testBodies(PERFORMANCE_EXAMPLE)) {
        assert.match(body, /Date\.now\(\)|getEntriesByType\('navigation'\)/, `no measurement in: ${body.slice(0, 50)}`);
        assert.match(body, /toBeLessThan\(\d+\)/, `no budget in: ${body.slice(0, 50)}`);
    }
});

test("local rules [seo/content]: the example checks title, meta description and heading structure", () => {
    assert.match(SEO_EXAMPLE, /toHaveTitle\(/);
    assert.match(SEO_EXAMPLE, /meta\[name="description"\]/);
    assert.match(SEO_EXAMPLE, /getByRole\('heading', \{ level: 1 \}\)\)\.toHaveCount\(1\)/);
    assert.doesNotMatch(SEO_EXAMPLE, /toBeVisible\(/, "visibility is what the baseline did instead of SEO");
});

test("local rules [database]: the example checks a unique value survives a reload", () => {
    const body = testBodies(DATABASE_EXAMPLE)[0];
    const created = body.indexOf(".click()");
    const reloaded = body.indexOf("page.reload()");
    assert.match(body, /Date\.now\(\)/, "the value must be unique per run");
    assert.ok(created >= 0 && reloaded > created, "save first, then reload");
    assert.match(body.slice(reloaded), /getByText\(value\)\)\.toBeVisible\(\)/, "the value must be checked after the reload");
});

test("local rules [database]: the rules say not to fake persistence on a page with no saving form", () => {
    assert.match(CATEGORY_GUIDES.database?.rules ?? "", /do not pretend: write test\.skip/);
});

test("local rules [security]: an https: assertion only ever runs behind a positive plain-HTTP skip (TFP-113)", () => {
    // Baseline: expect(page).toHaveURL('https://...') against an http:// base URL.
    // Live 2026-09-24: copying test.skip(!url.startsWith('https://')) the model
    // dropped the "!" (skip on HTTPS, assert https on HTTP). The condition is
    // now positive, so there is no negation to lose.
    for (const body of testBodies(SECURITY_EXAMPLE)) {
        const httpsCheck = body.search(/toHaveURL[(][/][\^]https:/);
        if (httpsCheck < 0) continue;
        const skip = body.indexOf("test.skip(pageUrl.startsWith('http://')");
        assert.ok(skip >= 0 && skip < httpsCheck, "the https check must be guarded by a plain-HTTP skip first");
    }
    assert.doesNotMatch(SECURITY_EXAMPLE, /test[.]skip[(]!/, "no negated skip condition to drop");
    assert.match(CATEGORY_GUIDES.security?.rules ?? "", /Copy the skip line exactly/);
});

test("local rules [database]: the unique value is copy-safe data, not a placeholder", () => {
    // Live 2026-09-24: EXAMPLE-VALUE came back as EXAMPLE-NAME / EXAMPLE-MESSAGE data.
    const value = DATABASE_EXAMPLE.match(/const value = `([^`]*)`/)?.[1] ?? "";
    assert.ok(value.includes("Date.now()"));
    assert.doesNotMatch(value, /EXAMPLE/);
});

test("local rules [security]: the example covers invalid input and script injection too", () => {
    assert.match(SECURITY_EXAMPLE, /not-an-email/);
    assert.match(SECURITY_EXAMPLE, /page\.on\('dialog'/);
    assert.match(SECURITY_EXAMPLE, /toEqual\(\[\]\)/);
});

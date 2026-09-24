/**
 * Tests for the local-model rules layer (Phase 31, TFP-106).
 *
 * The rules are only useful if every API they recommend is real and every API
 * they forbid is not - a rule naming a nonexistent matcher would teach the
 * model the very defect it exists to fix. Both are checked against the
 * installed @playwright/test with TFP-103's type check, so a Playwright
 * upgrade that renames a matcher fails here instead of silently.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/local-rules.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { ACCESSIBILITY_EXAMPLE, LOCAL_MODEL_RULES } = await import("./local-rules.ts");
const { findTypeErrors, findUnawaitedAssertions } = await import("./validate.ts");

/** Type-checks a bare property access, so a matcher's existence is tested without guessing its arguments. */
function locatorMatcherExists(name: string): boolean {
    return (
        findTypeErrors(
            `import { expect } from '@playwright/test';\nimport type { Locator } from '@playwright/test';\ndeclare const locator: Locator;\nexport const m = expect(locator).${name};`
        ).length === 0
    );
}

function section(start: string, end: string): string {
    const from = LOCAL_MODEL_RULES.indexOf(start);
    const to = LOCAL_MODEL_RULES.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `rules text no longer has a "${start}" ... "${end}" section`);
    return LOCAL_MODEL_RULES.slice(from, to);
}

test("local rules: the worked example compiles against the installed Playwright", () => {
    assert.deepEqual(findTypeErrors(ACCESSIBILITY_EXAMPLE), []);
});

test("local rules: the worked example awaits every assertion (TFP-108)", () => {
    // The model copies the example's style; an unawaited expect there would teach the defect.
    assert.deepEqual(findUnawaitedAssertions(ACCESSIBILITY_EXAMPLE), []);
});

test("local rules: the worked example only navigates to an unmistakable placeholder (TFP-109)", () => {
    // Live, same wording: /login in the example -> 3/3 suites went to /login; placeholder -> 0/3.
    // A realistic URL here gets copied into real suites.
    const targets = [...ACCESSIBILITY_EXAMPLE.matchAll(/goto\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(targets.length > 0);
    for (const url of targets) assert.equal(new URL(url).hostname, "example.invalid", `example navigates to ${url}`);
    assert.doesNotMatch(LOCAL_MODEL_RULES, /localhost/);
});

test("local rules: the shared block requires await on every expect (TFP-108)", () => {
    const shared = section("Playwright API rules", "There is NO accessibility matcher");
    assert.match(shared, /Always write await before every expect\(\.\.\.\) call/);
});

test("local rules: every recommended matcher exists", () => {
    const recommended = [...section("real locator matchers instead", "Find elements").matchAll(/\b(to[A-Z]\w+)\(/g)].map((m) => m[1]);
    assert.ok(recommended.length >= 5, `expected the recommended list, found ${recommended.join(", ")}`);
    for (const name of recommended) {
        assert.ok(locatorMatcherExists(name), `rules recommend ${name}, which @playwright/test does not have`);
    }
});

test("local rules: every matcher named as a page matcher really works on page", () => {
    const pageMatchers: string[] = section("page matchers:", ". Never").match(/\bto[A-Z]\w+/g) ?? [];
    assert.ok(pageMatchers.length >= 2, `expected the page matcher list, found ${pageMatchers.join(", ")}`);
    for (const name of pageMatchers) {
        const errors = findTypeErrors(
            `import { expect } from '@playwright/test';\nimport type { Page } from '@playwright/test';\ndeclare const page: Page;\nexport const m = expect(page).${name};`
        );
        assert.deepEqual(errors, [], `rules call ${name} a page matcher, but expect(page) has no ${name}`);
    }
});

test("local rules: the page-vs-locator mistake the model made is really an error", () => {
    // Live run 2026-09-24: expect(page).toHaveRole(...) - the rules must keep saying not to.
    const errors = findTypeErrors(
        "import { expect } from '@playwright/test';\nimport type { Page } from '@playwright/test';\ndeclare const page: Page;\nexport const m = expect(page).toHaveRole;"
    );
    assert.ok(errors.length > 0);
    assert.match(LOCAL_MODEL_RULES, /Never call an element matcher such as toHaveRole .* on page/);
});

test("local rules: every forbidden matcher really does not exist", () => {
    const forbidden: string[] = section("do NOT exist", "\n").match(/\bto[A-Z]\w+/g) ?? [];
    assert.ok(forbidden.includes("toBeAccessible"), "the matcher that motivated Phase 31 must stay forbidden");
    for (const name of forbidden) {
        assert.ok(!locatorMatcherExists(name), `rules forbid ${name}, but Playwright now has it - update the rules`);
    }
});

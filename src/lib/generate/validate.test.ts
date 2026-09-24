/**
 * Tests for the generated-suite type check (Phase 30, TFP-103 follow-up).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/generate/validate.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";

const { findTypeErrors } = await import("./validate.ts");
const { mockGenerate, BEST_PRACTICE_OPTIONS } = await import("./mock/index.ts");
const { normalizeContentRules, normalizeTestAuditMode } = await import("./normalize.ts");

// Reduced from the real testforge-qwen7b output of 2026-09-24 that motivated this check.
const INVENTED_MATCHER = `import { test, expect } from '@playwright/test';

test('Sign in button is visible and accessible', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const signInButton = page.getByRole('button', { name: 'Sign in' });
  await expect(signInButton).toBeVisible();
  await expect(signInButton).toBeAccessible();
});
`;

test("findTypeErrors: rejects the matcher the local model invented", () => {
    const errors = findTypeErrors(INVENTED_MATCHER);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /^7:\d+ TS2339 .*toBeAccessible/);
});

test("findTypeErrors: accepts the same suite using real matchers", () => {
    const fixed = INVENTED_MATCHER.replace("toBeAccessible()", "toHaveAccessibleName('Sign in')");
    assert.deepEqual(findTypeErrors(fixed), []);
});

test("findTypeErrors: rejects a syntax error", () => {
    assert.ok(findTypeErrors("import { test } from '@playwright/test';\ntest('x', async ({ page }) => {").length > 0);
});

test("findTypeErrors: rejects an import that is not installed", () => {
    const errors = findTypeErrors("import AxeBuilder from '@axe-core/playwright';\nconsole.log(AxeBuilder);");
    assert.ok(errors.some((e) => e.includes("TS2307")), errors.join("\n"));
});

test("findTypeErrors: is lenient about style - implicit any is not an error", () => {
    assert.deepEqual(findTypeErrors("export function f(x) { return x; }\nconsole.log(process.env.HOME, document.title);"), []);
});

test("findTypeErrors: the template generator's own suites pass, for every coverage area", () => {
    // Guards against false positives: TestForge's known-good output must never be rejected.
    for (const practice of BEST_PRACTICE_OPTIONS) {
        const code = mockGenerate(
            "http://localhost:3000",
            `check the ${practice} of the home page`,
            [practice],
            null,
            normalizeContentRules(undefined),
            normalizeTestAuditMode(undefined)
        );
        assert.deepEqual(findTypeErrors(code), [], `template suite for "${practice}" failed the check`);
    }
});

// --- TFP-108: unawaited assertions --------------------------------------------

const { findUnawaitedAssertions } = await import("./validate.ts");

function suite(body: string): string {
    return `import { test, expect } from '@playwright/test';\ntest('t', async ({ page }) => {\n${body}\n});\n`;
}

test("findUnawaitedAssertions: finds the unawaited page assertion from the Phase 31 security sample", () => {
    const hits = findUnawaitedAssertions(suite("  expect(page).toHaveURL('https://localhost:3000/login');"));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 3);
    assert.equal(hits[0].returnsPromise, true, "a web-first matcher returns a promise: unawaited, it never checks");
});

test("findUnawaitedAssertions: a synchronous value matcher is reported, but not as a silent no-op", () => {
    const hits = findUnawaitedAssertions(suite("  const status = 200;\n  expect(status).toBe(200);"));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].returnsPromise, false);
});

test("findUnawaitedAssertions: sees through .not, expect.soft and parentheses", () => {
    const hits = findUnawaitedAssertions(
        suite("  expect(page.getByText('x')).not.toBeVisible();\n  expect.soft(page).toHaveTitle('t');\n  (expect(page).toHaveURL('u'));")
    );
    assert.deepEqual(hits.map((h) => h.returnsPromise), [true, true, true]);
});

test("findUnawaitedAssertions: awaited and returned assertions are clean", () => {
    assert.deepEqual(
        findUnawaitedAssertions(
            suite(
                "  await expect(page).toHaveURL('u');\n  await expect(page.getByText('x')).not.toBeVisible();\n  await expect(1).toBe(1);\n  const f = () => expect(page).toHaveTitle('t');\n  await f();"
            )
        ),
        []
    );
});

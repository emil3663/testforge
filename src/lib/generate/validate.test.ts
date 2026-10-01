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
    // @axe-core/playwright was this example until Phase 35 (TFP-134) installed it.
    const errors = findTypeErrors("import Missing from '@testforge/never-installed';\nconsole.log(Missing);");
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

// --- Phase 37 TFP-129: a Promise handed to a plain matcher ---------------------

const { findPromisesToPlainMatchers } = await import("./validate.ts");
const { readFileSync } = await import("node:fs");

test("findPromisesToPlainMatchers: rejects reliability-3 from the 2026-09-30 C8 run, every isDisabled() line", () => {
    const code = readFileSync("benchmarks/2026-09-30-phase33-c8/reliability-3.spec.ts", "utf8");
    assert.deepEqual(findTypeErrors(code), [], "precondition: it type-checks");
    assert.deepEqual(findUnawaitedAssertions(code).filter((a) => a.returnsPromise), [], "precondition: the await gate keeps it");
    const hits = findPromisesToPlainMatchers(code);
    assert.deepEqual(hits.map((h) => h.split(":")[0]), ["line 9", "line 10", "line 11", "line 21", "line 22", "line 23", "line 33", "line 34", "line 35"]);
    assert.match(hits[0], /^line 9: expect\(page\.locator\('input\[name="email"\]'\)\.isDisabled\(\)\)\.toBe\(true\)$/);
});

test("findPromisesToPlainMatchers: sees .not, expect.soft, toBeTruthy and an unawaited plain matcher", () => {
    const hits = findPromisesToPlainMatchers(
        suite(
            "  await expect(page.getByText('x').isVisible()).not.toBe(false);\n  expect.soft(page.title()).toEqual('t');\n  expect(page.getByRole('button').count()).toBeTruthy();\n  const p = page.getByText('x').textContent();\n  expect(p).toBe('x');"
        )
    );
    assert.deepEqual(hits.map((h) => h.split(":")[0]), ["line 3", "line 4", "line 5", "line 7"]);
});

test("findPromisesToPlainMatchers: web-first matchers, resolves/rejects, awaited values and expect.poll are clean", () => {
    assert.deepEqual(
        findPromisesToPlainMatchers(
            suite(
                [
                    "  await expect(page.getByText('x')).toBeVisible();",
                    "  await expect(page).toHaveURL('u');",
                    "  await expect(page.getByText('x').isVisible()).resolves.toBe(true);",
                    "  await expect(page.goto('u')).rejects.toThrow();",
                    "  expect(await page.getByText('x').isDisabled()).toBe(false);",
                    "  await expect.poll(() => page.getByRole('button').count()).toBe(1);",
                    "  const response = await page.goto('u');",
                    "  expect(response?.status() ?? 0).toBeLessThan(500);",
                ].join("\n")
            )
        ),
        []
    );
});

// --- Phase 37 TFP-130: duplicate test bodies ----------------------------------

const { findDuplicateTests } = await import("./validate.ts");

test("findDuplicateTests: rejects reliability-2 from the 2026-09-30 C8 run - three titles, one body", () => {
    const code = readFileSync("benchmarks/2026-09-30-phase33-c8/reliability-2.spec.ts", "utf8");
    assert.deepEqual(findTypeErrors(code), [], "precondition: it type-checks");
    assert.deepEqual(findDuplicateTests(code), [
        "lines 4, 14, 24: 3 tests share one body ('page still works when email input is disabled', 'page still works when password input is disabled', 'page still works when Sign in button is disabled')",
    ]);
});

test("findDuplicateTests: whitespace and comments don't make a body different; titles don't matter", () => {
    const code = [
        "import { test, expect } from '@playwright/test';",
        "test('a', async ({ page }) => {",
        "  await page.goto('/');",
        "  await expect(page.locator('body')).toBeVisible();",
        "});",
        "test('b', async ({ page }) => {",
        "  // the same check, reworded only in its title",
        "  await page.goto( '/' );",
        "",
        "  await expect(page.locator('body'))",
        "    .toBeVisible();",
        "});",
    ].join("\n");
    assert.deepEqual(findDuplicateTests(code), ["lines 2, 6: 2 tests share one body ('a', 'b')"]);
});

test("findDuplicateTests: the same body under different setup is not a duplicate; different bodies are clean", () => {
    const body = "async ({ page }) => {\n    await page.goto('/');\n    await expect(page.locator('body')).toBeVisible();\n  }";
    const code = [
        "import { test, expect } from '@playwright/test';",
        "test.describe('desktop', () => {",
        "  test.use({ viewport: { width: 1280, height: 800 } });",
        `  test('home renders', ${body});`,
        "});",
        "test.describe('mobile', () => {",
        "  test.use({ viewport: { width: 375, height: 667 } });",
        `  test('home renders', ${body});`,
        "});",
        "test.describe('blocked API', () => {",
        "  test.beforeEach(async ({ page }) => { await page.route('**/api/**', (route) => route.abort('failed')); });",
        `  test('home renders', ${body});`,
        "});",
        "test('another page renders', async ({ page }) => {",
        "  await page.goto('/about');",
        "  await expect(page.locator('body')).toBeVisible();",
        "});",
    ].join("\n");
    assert.deepEqual(findTypeErrors(code), []);
    assert.deepEqual(findDuplicateTests(code), []);
});

test("findDuplicateTests: the full-request reliability suites from the diagnostic, with three different failures, are clean", () => {
    for (const name of ["reliability-full-1", "reliability-full-2"]) {
        assert.deepEqual(findDuplicateTests(readFileSync(`benchmarks/2026-09-30-phase33-c8/${name}.spec.ts`, "utf8")), [], name);
    }
});

test("findPromisesToPlainMatchers: the template generator's own suites are clean, for every coverage area", () => {
    for (const practice of BEST_PRACTICE_OPTIONS) {
        const code = mockGenerate("https://example.com", "Check the page.", [practice], null, normalizeContentRules(undefined), normalizeTestAuditMode("deep"));
        assert.deepEqual(findPromisesToPlainMatchers(code), [], practice);
    }
});

import {
    buildAccessibilityElementTests,
    buildActionableElementTests,
    buildToggleGroupTests,
    buildUsabilityElementTests,
} from "./actionable-elements";
import { escapeForSingleQuotedString, includesAny } from "./format";
import { buildTestMyLinksAuditTests } from "./link-audits";
import {
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
    resolveLinkAuditPath,
    resolveLinkAuditPaths,
} from "./locators";
import { createSuite } from "./suite";
import type { BestPracticeArea, ContentProfile, GeneratedSuite, TestAuditMode } from "./types";

export function buildSharedBestPracticeSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[],
    contentProfile: ContentProfile | null = null
) {
    const lowerDescription = description.toLowerCase();
    const suites: GeneratedSuite[] = [];

    if (areas.includes("responsive/mobile")) {
        // TFP-058: the viewport loop previously only checked `body` and the
        // first heading, which stays true even when real interactive
        // elements have collapsed off-screen at a given breakpoint. Sample
        // a handful of actually-discovered, visible-at-introspection
        // elements and assert each one individually at every viewport.
        const matchingPage = findMatchingProfilePage(contentProfile, "/");
        const sampledElements = (matchingPage?.actionableElements ?? [])
            .filter((element) => element.isVisible)
            .slice(0, 5);
        const elementChecks = sampledElements
            .map((element) => {
                const name = escapeForSingleQuotedString(getActionableElementDisplayName(element));
                const locatorExpression = buildLocatorExpression(element);
                return `      await expect(${locatorExpression}, '${name} should stay visible at ' + viewport.name + ' viewport').toBeVisible();`;
            })
            .join("\n");

        const responsiveTests = [
            `  test('keeps the core journey visible across common viewport sizes', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByRole('heading').first()).toBeVisible();
${elementChecks}
    }
  });`,
        ];

        if (sampledElements.length > 0) {
            const touchTarget = sampledElements[0];
            const touchName = escapeForSingleQuotedString(getActionableElementDisplayName(touchTarget));
            const touchLocatorExpression = buildLocatorExpression(touchTarget);

            responsiveTests.push(`  test('responds to a touch tap at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Static introspection can't see touch-specific JS handlers, so this is
    // a smoke check that ${touchName} accepts a tap without erroring - not a
    // claim about what it does in response.
    const locator = ${touchLocatorExpression};
    await locator.scrollIntoViewIfNeeded();
    await locator.dispatchEvent('touchstart');
    await locator.dispatchEvent('touchend');
    await expect(page.locator('body')).toBeVisible();
  });`);
        }

        const suite = createSuite("responsive/mobile", responsiveTests);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("accessibility")) {
        // TFP-057: toggle/selection groups TFP-055 detected get a real
        // assertion here, not just a data point - every group member must
        // expose at least one ARIA state attribute, and where one already
        // does, that it actually toggles on click. Appended alongside the
        // existing structural check below, which TFP-056 replaces with
        // real per-element coverage separately.
        const accessibilityPath = resolveLinkAuditPath(baseUrl);
        const toggleGroupTests = buildToggleGroupTests(contentProfile, accessibilityPath);
        // TFP-056: the interactive-element count check below never inspected
        // what introspection actually found, so it passed even when real
        // elements had no accessible name or role. Add one assertion per
        // discovered element (existing heading check kept as-is).
        const accessibilityElementTests = buildAccessibilityElementTests(contentProfile, accessibilityPath);

        const suite = createSuite("accessibility", [
            `  test('exposes basic accessible structure for assistive technologies', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible();
    const interactiveCount = await page.locator('a, button, input, textarea, select, [role="button"]').count();
    expect(interactiveCount).toBeGreaterThan(0);
  });`,
            ...accessibilityElementTests,
            ...toggleGroupTests,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("seo/content")) {
        const suite = createSuite("seo/content", [
            `  test('exposes core SEO and content signals on the landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/.+/);
    await expect(page.getByRole('heading').first()).toBeVisible();
    const metaDescription = page.locator('meta[name="description"]');
    if (await metaDescription.count()) {
      await expect(metaDescription.first()).toHaveAttribute('content', /.+/);
    }
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (
        areas.includes("performance/load") &&
        !includesAny(lowerDescription, [
            "response time",
            "performance",
            "load time",
            "speed",
        ])
    ) {
        const suite = createSuite("performance/load", [
            `  test('captures a simple load-time budget for the landing page', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(response).not.toBeNull();
    expect(response?.status()).toBeLessThan(400);

    const navigationDuration = await page.evaluate(() => {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return navigationEntry?.duration ?? 0;
    });

    expect(navigationDuration).toBeLessThan(5000);
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("security")) {
        const securityTests: string[] = [];
        const securityNotes: string[] = [];

        if (new URL(baseUrl).protocol === "https:") {
            securityTests.push(`  test('uses HTTPS for the requested public test target', async ({ page }) => {
    await page.goto('/');
    expect(new URL(page.url()).protocol).toBe('https:');
  });`);
        } else {
            securityNotes.push(
                "This target is not HTTPS by default, so deeper transport-security validation should be handled outside this browser suite."
            );
        }

        const suite = createSuite("security", securityTests, securityNotes);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("cookie/session")) {
        const suite = createSuite("cookie/session", [
            `  test('can inspect browser cookies for the session flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const cookies = await page.context().cookies();
    expect(Array.isArray(cookies)).toBeTruthy();
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    return suites;
}

export function buildGenericSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[],
    contentProfile: ContentProfile | null,
    auditMode: TestAuditMode
) {
    const lowerDescription = description.toLowerCase();
    const linkAuditPaths = resolveLinkAuditPaths(contentProfile, baseUrl);
    const discoveredLinkCount = linkAuditPaths.reduce(
        (count, path) => count + (findMatchingProfilePage(contentProfile, path)?.linkDetails?.length ?? 0),
        0
    );
    const suites: GeneratedSuite[] = [];
    const functionalTests: string[] = [];
    const usabilityTests: string[] = [];

    if (areas.includes("functional")) {
        functionalTests.push(`  test('loads the target page and shows visible content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).toContainText(/\S+/);
  });`);

        if (
            includesAny(lowerDescription, [
                "login",
                "sign in",
                "sign-in",
                "password",
                "username",
            ])
        ) {
            functionalTests.push(`  test('surfaces a sign-in related control for the described flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const authControls = page.locator('input[type="password"], input[name*="user" i], input[name*="email" i], button:has-text("Login"), button:has-text("Sign in"), a:has-text("Login"), a:has-text("Sign in")');
    await expect(authControls.first()).toBeVisible();
  });`);
        } else if (includesAny(lowerDescription, ["search", "find", "lookup"])) {
            functionalTests.push(`  test('shows at least one search or filter style control', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const searchControls = page.locator('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i], button:has-text("Search")');
    await expect(searchControls.first()).toBeVisible();
  });`);
        } else {
            functionalTests.push(`  test('shows at least one interactive element related to the scenario', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const interactive = page.locator('a, button, input, textarea, select, [role="button"]');
    await expect(interactive.first()).toBeVisible();
  });`);
        }

        if (contentProfile?.pages.length) {
            functionalTests.push(
                ...linkAuditPaths.flatMap((path) => buildActionableElementTests(contentProfile, path))
            );
        }

        if (
            discoveredLinkCount > 0 ||
            includesAny(lowerDescription, ["link", "links", "href", "anchor", "anchors", "broken link"])
        ) {
            functionalTests.push(
                ...linkAuditPaths.flatMap((path) => buildTestMyLinksAuditTests(contentProfile, path, { auditMode, areas }))
            );
        }
    }

    if (areas.includes("usability")) {
        // TFP-059: "visible interactive count > 0" restated Functional's own
        // "shows at least one interactive element" claim under a different
        // suite name. Keep the heading-visibility check (that one is
        // usability-specific) and replace the count check with assertions
        // that are actually about usability: real guidance text instead of
        // generic labels, and primary actions reachable without scrolling.
        usabilityTests.push(`  test('keeps navigation and guidance visible for a first-time user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible();
  });`);
        usabilityTests.push(...buildUsabilityElementTests(contentProfile, "/"));
    }

    const functionalSuite = createSuite("functional", functionalTests);
    if (functionalSuite) {
        suites.push(functionalSuite);
    }

    const usabilitySuite = createSuite("usability", usabilityTests);
    if (usabilitySuite) {
        suites.push(usabilitySuite);
    }

    return [...suites, ...buildSharedBestPracticeSuites(baseUrl, description, areas, contentProfile)];
}

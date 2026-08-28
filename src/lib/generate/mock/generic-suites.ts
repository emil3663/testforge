import { buildActionableElementTests } from "./actionable-elements";
import { includesAny } from "./format";
import { buildTestMyLinksAuditTests } from "./link-audits";
import { findMatchingProfilePage, resolveLinkAuditPaths } from "./locators";
import { createSuite } from "./suite";
import type { BestPracticeArea, ContentProfile, GeneratedSuite, TestAuditMode } from "./types";

export function buildSharedBestPracticeSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[]
) {
    const lowerDescription = description.toLowerCase();
    const suites: GeneratedSuite[] = [];

    if (areas.includes("responsive/mobile")) {
        const suite = createSuite("responsive/mobile", [
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
    }
  });`,
        ]);

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("accessibility")) {
        const suite = createSuite("accessibility", [
            `  test('exposes basic accessible structure for assistive technologies', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible();
    const interactiveCount = await page.locator('a, button, input, textarea, select, [role="button"]').count();
    expect(interactiveCount).toBeGreaterThan(0);
  });`,
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
        usabilityTests.push(`  test('keeps navigation and guidance visible for a first-time user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible();
    const visibleInteractive = page.locator('a:visible, button:visible');
    expect(await visibleInteractive.count()).toBeGreaterThan(0);
  });`);
    }

    const functionalSuite = createSuite("functional", functionalTests);
    if (functionalSuite) {
        suites.push(functionalSuite);
    }

    const usabilitySuite = createSuite("usability", usabilityTests);
    if (usabilitySuite) {
        suites.push(usabilitySuite);
    }

    return [...suites, ...buildSharedBestPracticeSuites(baseUrl, description, areas)];
}

import { escapeForRegExpLiteral, escapeForSingleQuotedString } from "./format";
import { createSuite } from "./suite";
import type { BestPracticeArea, ContentProfile, ContentRules, GeneratedSuite } from "./types";

export function buildContentProfileComment(profile: ContentProfile | null, rules: ContentRules) {
    const lines = ["// Content-aware inputs:"];

    if (profile?.pages.length) {
        lines.push(`// - Inspected ${profile.pages.length} page(s) before generation.`);
        for (const page of profile.pages.slice(0, 3)) {
            const headingPreview = page.headings.slice(0, 2).join(", ");
            const actionableCount = page.actionableElements?.length ?? 0;
            lines.push(
                `// - ${page.path}: ${page.title || "No title"}${headingPreview ? ` | headings: ${headingPreview}` : ""}${actionableCount ? ` | interactive elements: ${actionableCount}` : ""}`
            );
        }
    } else {
        lines.push("// - No page inspection data was available.");
    }

    if (rules.requiredHeadings.length > 0) {
        lines.push(`// - Required headings: ${rules.requiredHeadings.join(", ")}`);
    }

    if (rules.requiredText.length > 0) {
        lines.push(`// - Required text: ${rules.requiredText.join(", ")}`);
    }

    if (rules.forbiddenText.length > 0) {
        lines.push(`// - Forbidden text: ${rules.forbiddenText.join(", ")}`);
    }

    return lines.join("\n");
}

export function buildContentSuites(
    contentProfile: ContentProfile | null,
    contentRules: ContentRules,
    areas: BestPracticeArea[]
) {
    if (!contentProfile?.pages.length) {
        return [] as GeneratedSuite[];
    }

    const seoTests: string[] = [];
    const functionalTests: string[] = [];

    for (const page of contentProfile.pages) {
        const escapedPath = escapeForSingleQuotedString(page.path || "/");
        const keyHeadings = page.headings.slice(0, 3)
            .map(
                (heading) =>
                    `    await expect(page.getByRole('heading', { name: '${escapeForSingleQuotedString(heading)}', exact: true }).first()).toBeVisible();`
            )
            .join("\n");

        seoTests.push(`  test('keeps page title stable for ${escapedPath}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

${page.title
                ? `    await expect(page).toHaveTitle('${escapeForSingleQuotedString(page.title)}');`
                : "    await expect(page).toHaveTitle(/.+/);"}
    });`);

        seoTests.push(`  test('keeps meta description stable for ${escapedPath}', async ({ page }) => {
    await page.goto('${escapedPath}');
    await page.waitForLoadState('domcontentloaded');

${page.metaDescription
                ? `    await expect(page.locator('meta[name="description"]').first()).toHaveAttribute('content', /${escapeForRegExpLiteral(page.metaDescription.slice(0, 60))}/i);`
                : "    await expect(page.locator('meta[name=\"description\"]').first()).toHaveAttribute('content', /.+/);"}
    });`);

        seoTests.push(`  test('keeps heading structure stable for ${escapedPath}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

${keyHeadings || "    await expect(page.getByRole('heading').first()).toBeVisible();"}
    });`);

        seoTests.push(`  test('keeps canonical metadata stable for ${escapedPath}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const canonical = page.locator('link[rel="canonical"]').first();
        await expect(canonical).toHaveAttribute('href', /.+/);

        const href = await canonical.getAttribute('href');
        expect(href).not.toBeNull();

        const canonicalUrl = new URL(href ?? '', page.url());
        const currentUrl = new URL(page.url());
        const canonicalPath = canonicalUrl.pathname.replace(/\\/$/, '') || '/';
        const currentPath = currentUrl.pathname.replace(/\\/$/, '') || '/';

        expect(canonicalPath).toBe(currentPath);
    });`);

        seoTests.push(`  test('exposes structured data for ${escapedPath}', async ({ page }) => {
        await page.goto('${escapedPath}');
        await page.waitForLoadState('domcontentloaded');

        const scripts = page.locator('script[type="application/ld+json"]');
        expect(await scripts.count()).toBeGreaterThan(0);

        const structuredData = await scripts.first().textContent();
        expect(structuredData?.trim().length ?? 0).toBeGreaterThan(0);
  });`);
    }

    seoTests.push(`  test('publishes robots.txt with a sitemap reference', async ({ request }) => {
        const response = await request.get('/robots.txt', { failOnStatusCode: false, timeout: 15000 });
        expect(response.status()).toBeLessThan(400);

        const body = await response.text();
        expect(body).toContain('Sitemap:');
    });`);

    seoTests.push(`  test('publishes sitemap.xml with at least one URL', async ({ request }) => {
        const response = await request.get('/sitemap.xml', { failOnStatusCode: false, timeout: 15000 });
        expect(response.status()).toBeLessThan(400);

        const body = await response.text();
        expect(body).toContain('<loc>');
    });`);

    seoTests.push(`  test('publishes manifest metadata for installable clients', async ({ page, request }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const manifestLink = page.locator('link[rel="manifest"]').first();
        await expect(manifestLink).toHaveAttribute('href', /.+/);

        const manifestHref = await manifestLink.getAttribute('href');
        expect(manifestHref).not.toBeNull();

        const response = await request.get(manifestHref ?? '/manifest.webmanifest', { failOnStatusCode: false, timeout: 15000 });
        expect(response.status()).toBeLessThan(400);
        expect(await response.text()).toContain('name');
    });`);

    for (const heading of contentRules.requiredHeadings) {
        functionalTests.push(`  test('shows the required heading ${escapeForSingleQuotedString(heading)}', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: '${escapeForSingleQuotedString(heading)}', exact: true }).first()).toBeVisible();
  });`);
    }

    for (const snippet of contentRules.requiredText) {
        functionalTests.push(`  test('shows the required content snippet ${escapeForSingleQuotedString(snippet)}', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).toContainText('${escapeForSingleQuotedString(snippet)}');
  });`);
    }

    for (const snippet of contentRules.forbiddenText) {
        functionalTests.push(`  test('does not show the forbidden content snippet ${escapeForSingleQuotedString(snippet)}', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).not.toContainText('${escapeForSingleQuotedString(snippet)}');
  });`);
    }

    const suites: GeneratedSuite[] = [];
    if (areas.includes("seo/content")) {
        const seoSuite = createSuite("seo/content", seoTests);
        if (seoSuite) {
            suites.push(seoSuite);
        }
    }

    if (areas.includes("functional")) {
        const functionalSuite = createSuite("functional", functionalTests);
        if (functionalSuite) {
            suites.push(functionalSuite);
        }
    }

    return suites;
}

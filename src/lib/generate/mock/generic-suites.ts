import {
    buildAccessibilityElementTests,
    buildActionableElementTests,
    buildActionPairTests,
    buildToggleGroupTests,
    buildUsabilityElementTests,
} from "./actionable-elements";
import { buildDependencyFailureTests, DEPENDENCY_FAILURE_INJECTION_NOTE } from "./dependency-failure-injection";
import { buildStorageFailureTests } from "./storage-failure-injection";
import { buildDatabaseRoundTripTests } from "./database-round-trip";
import { buildPerformanceChecks } from "./performance-checks";
import { buildSecurityChecks } from "./security-checks";
import { buildDragDropTests } from "./drag-drop";
import { buildFormFieldNameTests } from "./form-field-names";
import { buildCookieSessionTests } from "./cookie-session-checks";
import { escapeForSingleQuotedString, includesAny } from "./format";
import { buildTestMyLinksAuditTests } from "./link-audits";
import { buildRevealHelper } from "./link-audits/reveal";
import {
    buildLocatorExpression,
    findMatchingProfilePage,
    getActionableElementDisplayName,
    resolveLinkAuditPath,
    resolveLinkAuditPaths,
} from "./locators";
import { createSuite, inspectedPagePaths } from "./suite";
import { ACCESSIBILITY_HELPERS, axeScanTest } from "../comprehensive-accessibility";
import { checkDetails } from "../comprehensive-security";
import type { ActionableElementDetail, BestPracticeArea, ContentProfile, GeneratedSuite, TestAuditMode } from "./types";

export function buildSharedBestPracticeSuites(
    baseUrl: string,
    description: string,
    areas: BestPracticeArea[],
    contentProfile: ContentProfile | null = null,
    /** Areas the calling target-specific builder already wrote a suite for. */
    coveredAreas: BestPracticeArea[] = []
) {
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
                // TFP-159: behind a collapsed navbar's toggle at a narrow viewport, it is revealed
                // first by clicking the toggle; still hidden, it fails, naming the menu.
                return `      {
        const item = ${locatorExpression};
        const reach = await tfReveal(item, 'click');
        await expect(item, '${name} should stay visible at ' + viewport.name + ' viewport' + (reach.reason ? ': ' + reach.reason : '')).toBeVisible();
      }`;
            })
            .join("\n");

        const responsiveTests = [
            `  test('keeps the core journey visible across common viewport sizes', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 },
    ];

${sampledElements.length > 0 ? `${buildRevealHelper("    ")}

` : ""}    for (const viewport of viewports) {
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
            // TFP-121: every inspected page with form fields, not only the landing page.
            ...buildFormFieldNameTests(contentProfile),
            // Phase 38 (TFP-148, Decision 4): Comprehensive's axe-core WCAG 2.2 A
            // and AA scan, the same builder, on every inspected page.
            ...inspectedPagePaths(contentProfile).map((path) => {
                const escapedPath = escapeForSingleQuotedString(path);
                return axeScanTest({ path, escapedPath, details: (category) => checkDetails(escapedPath)({ category, asvs: [], why: "" }) });
            }),
        ]);

        if (suite) {
            suites.push({ ...suite, preamble: ACCESSIBILITY_HELPERS });
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

    // TFP-114: this used to be gated on the description NOT naming
    // performance - a stand-in for "the DemoQA builder already wrote a
    // performance test", since that builder writes its own only when the
    // description does. On every other target nothing else writes one, so
    // asking for performance by name produced no performance test at all.
    // The target-specific builder now says which areas it already covered.
    if (areas.includes("performance/load") && !coveredAreas.includes("performance/load")) {
        // TFP-115: Decision 2's read-only checks, the navigation budget included.
        const suite = createSuite("performance/load", buildPerformanceChecks());

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("security") && !coveredAreas.includes("security")) {
        // TFP-116: HTTPS (https targets only), header and cookie-flag
        // findings, and a script-payload check per discovered form.
        const { tests, notes, preamble } = buildSecurityChecks(baseUrl, contentProfile);
        const suite = createSuite("security", tests, notes);

        if (suite) {
            suites.push({ ...suite, preamble });
        }
    }

    if (areas.includes("reliability")) {
        const failureInjectionTests = buildDependencyFailureTests(contentProfile);
        const storageFailureTests = buildStorageFailureTests(contentProfile);
        const reliabilityTests = [...failureInjectionTests, ...storageFailureTests];
        const suite = createSuite(
            "reliability",
            reliabilityTests,
            failureInjectionTests.length > 0 ? [DEPENDENCY_FAILURE_INJECTION_NOTE] : undefined
        );

        if (suite) {
            suites.push(suite);
        }
    }

    if (areas.includes("cookie/session")) {
        // TFP-125: a check that can fail, replacing one that asserted the
        // cookie list is an array.
        const suite = createSuite("cookie/session", buildCookieSessionTests());

        if (suite) {
            suites.push(suite);
        }
    }

    // TFP-117: a user-visible persistence round trip per discovered form -
    // or a note saying why there is none, so the area is visibly empty.
    if (areas.includes("database") && !coveredAreas.includes("database")) {
        const { tests, notes, notApplicable } = buildDatabaseRoundTripTests(contentProfile);
        const suite = createSuite("database", tests, notes);

        if (suite) {
            if (notApplicable) suite.notApplicable = notApplicable;
            suites.push(suite);
        }
    }

    return suites;
}

/** The first inspected page with a sign-in control: a password field, or a Log in / Sign in button or link. */
export function findSignInPath(contentProfile: ContentProfile | null): string | null {
    const isSignIn = (element: ActionableElementDetail) =>
        (element.elementType === "input" && element.locator.inputType === "password") ||
        ((element.elementType === "button" || element.elementType === "link") &&
            /\b(log ?in|sign ?in)\b/i.test(`${element.text} ${element.locator.name}`));
    return contentProfile?.pages.find((page) => (page.actionableElements ?? []).some(isSignIn))?.path ?? null;
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
            // TFP-123: on a site whose sign-in lives on its own page (the-internet:
            // /login, while / is a list of examples) the root has no sign-in
            // control, so this failed on a healthy site. It visits the first
            // inspected page that has one, and / only when none does.
            const signInPath = escapeForSingleQuotedString(findSignInPath(contentProfile) ?? "/");
            functionalTests.push(`  test('surfaces a sign-in related control for the described flow', async ({ page }) => {
    await page.goto('${signInPath}');
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
            // TFP-060: Undo/Redo and similar detected action pairs get a
            // regression guard that an unrelated interaction doesn't leak
            // into their state.
            functionalTests.push(
                ...linkAuditPaths.flatMap((path) => buildActionPairTests(contentProfile, path))
            );
            // TFP-061: same treatment for detected drag-and-drop targets.
            functionalTests.push(
                ...linkAuditPaths.flatMap((path) => buildDragDropTests(contentProfile, path))
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

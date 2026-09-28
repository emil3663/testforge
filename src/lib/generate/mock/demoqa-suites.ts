import { buildActionableElementTests, buildActionPairTests } from "./actionable-elements";
import { buildDragDropTests } from "./drag-drop";
import { includesAny } from "./format";
import { buildSharedBestPracticeSuites } from "./generic-suites";
import { buildPerformanceChecks } from "./performance-checks";
import { buildTestMyLinksAuditTests } from "./link-audits";
import { findMatchingProfilePage, resolveLinkAuditPaths } from "./locators";
import { createSuite } from "./suite";
import type { BestPracticeArea, ContentProfile, GeneratedSuite, TestAuditMode } from "./types";

export function buildDemoQaSuites(
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
        functionalTests.push(`  test('opens DemoQA and shows the main practice categories', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/demosite|DEMOQA|ToolsQA/i);
    await expect(page.getByText('Elements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Forms', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Book Store Application', { exact: true }).first()).toBeVisible();
  });`);

        if (
            includesAny(lowerDescription, [
                "login",
                "sign in",
                "sign-in",
                "book store",
                "bookstore",
                "profile",
                "password",
                "username",
            ])
        ) {
            functionalTests.push(`  test('shows the DemoQA book store login form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
    await expect(page.getByText('Login in Book Store', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('UserName')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New User' })).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "elements",
                "text box",
                "check box",
                "checkbox",
                "radio",
                "buttons",
                "links",
                "upload",
                "download",
                "dynamic properties",
                "web tables",
            ])
        ) {
            functionalTests.push(`  test('shows the expected options in the Elements section', async ({ page }) => {
    await page.goto('/elements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\\/elements$/);
    await expect(page.getByText('Elements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Please select an item from left to start practice.')).toBeVisible();
    await expect(page.getByText('Text Box', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Buttons', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Web Tables', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "form",
                "forms",
                "practice form",
                "submit",
                "registration",
            ])
        ) {
            functionalTests.push(`  test('shows the DemoQA forms section for form-based scenarios', async ({ page }) => {
    await page.goto('/forms');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Forms', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Practice Form', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (includesAny(lowerDescription, ["alert", "window", "frame", "modal"])) {
            functionalTests.push(`  test('shows the alerts and windows section navigation', async ({ page }) => {
    await page.goto('/alertsWindows');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Alerts, Frame & Windows', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Browser Windows', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Alerts', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "widget",
                "widgets",
                "accordion",
                "autocomplete",
                "slider",
                "progress",
                "tabs",
                "tooltip",
                "menu",
            ])
        ) {
            functionalTests.push(`  test('shows the widgets section for interactive component checks', async ({ page }) => {
    await page.goto('/widgets');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Widgets', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Accordian', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Slider', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (
            includesAny(lowerDescription, [
                "interaction",
                "interactions",
                "drag",
                "drop",
                "selectable",
                "sortable",
                "droppable",
                "resizable",
            ])
        ) {
            functionalTests.push(`  test('shows the interactions section for drag and drop style flows', async ({ page }) => {
    await page.goto('/interaction');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Interactions', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Sortable', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Droppable', { exact: true }).first()).toBeVisible();
  });`);
        }

        if (includesAny(lowerDescription, ["book", "books", "store", "search book"])) {
            functionalTests.push(`  test('shows the DemoQA book store catalog', async ({ page }) => {
    await page.goto('/books');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Book Store', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /search/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
  });`);
        }

        if (functionalTests.length === 1) {
            functionalTests.push(`  test('lets a tester drill into a common practice area', async ({ page }) => {
    await page.goto('/elements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Elements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Please select an item from left to start practice.')).toBeVisible();
  });`);
        }

        if (contentProfile?.pages.length) {
            functionalTests.push(
                ...linkAuditPaths.flatMap((path) => buildActionableElementTests(contentProfile, path))
            );
            functionalTests.push(
                ...linkAuditPaths.flatMap((path) => buildActionPairTests(contentProfile, path))
            );
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

    if (
        areas.includes("performance/load") &&
        includesAny(lowerDescription, [
            "response time",
            "performance",
            "load time",
            "speed",
        ])
    ) {
        // TFP-115: the shared read-only checks on the DemoQA page. The old
        // navigation test here loaded with "domcontentloaded" and read the
        // navigation duration, which is 0 until the load event ends.
        const performanceSuite = createSuite("performance/load", buildPerformanceChecks({ path: "/elements" }));

        if (performanceSuite) {
            suites.push(performanceSuite);
        }
    }

    if (areas.includes("usability")) {
        usabilityTests.push(`  test('shows clear practice navigation and guidance for testers', async ({ page }) => {
    await page.goto('/elements');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Please select an item from left to start practice.')).toBeVisible();
    await expect(page.getByText('Text Box', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Buttons', { exact: true }).first()).toBeVisible();
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

    // TFP-114: tell the shared builder which areas already have a DemoQA
    // suite, so it doesn't add a second one (it used to infer this from the
    // description's wording, which broke every non-DemoQA target).
    const coveredAreas = suites.filter((suite) => suite.tests.length > 0).map((suite) => suite.area);
    return [...suites, ...buildSharedBestPracticeSuites(baseUrl, description, areas, contentProfile, coveredAreas)];
}

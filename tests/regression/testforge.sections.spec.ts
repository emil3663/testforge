import { expect, type Locator, type Page, test } from "@playwright/test";

const demoQaUrl = "https://demoqa.com/";
const demoQaDescription = "Create a functional smoke test for the DemoQA homepage and verify visible navigation links are present and usable.";
const localAppUrl = "http://127.0.0.1:3001";

function getSection(page: Page, title: RegExp): Locator {
    return page.locator("section").filter({
        has: page.getByRole("button", { name: title }),
    }).first();
}

async function openHome(page: Page) {
    await page.goto("/");
    await expect(page.locator("header").getByText("TestForge", { exact: true })).toBeVisible();
}

async function fillCreationInputs(page: Page, baseUrl: string, description: string) {
    await page.getByLabel("Base URL").fill(baseUrl);
    await page.getByLabel("What do you want to test?").fill(description);
}

async function generateSuite(page: Page) {
    const generateButton = page.getByRole("button", { name: "Generate test suite" });
    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    const generatedSuitePanel = getSection(page, /Generated Suite Review the generated Playwright code/i);
    await expect(generatedSuitePanel.getByText("generated_test.spec.ts")).toBeVisible({ timeout: 60_000 });
    await expect(generatedSuitePanel.locator("pre")).toContainText("import { test, expect } from '@playwright/test';", {
        timeout: 60_000,
    });
    return generatedSuitePanel;
}

async function runSuite(page: Page) {
    const generatedSuitePanel = getSection(page, /Generated Suite Review the generated Playwright code/i);
    await generatedSuitePanel.getByRole("button", { name: "Run suite" }).first().click();
    await expect(page.getByText("Test Reports")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Release readiness at a glance")).toBeVisible({ timeout: 120_000 });
}

test.describe("TestForge regression coverage", () => {
    test("covers the creation inputs, generation mode, and inferred best-practice state", async ({ page }) => {
        await openHome(page);

        const creationSection = getSection(page, /Test Suite Creation Define the target/i);
        await expect(creationSection.getByText("Base URL")).toBeVisible();
        await expect(creationSection.getByText("What do you want to test?")).toBeVisible();
        await expect(creationSection.getByText("Generation Mode")).toBeVisible();
        await expect(creationSection.getByText("Best-Practice Coverage")).toBeVisible();

        await fillCreationInputs(page, demoQaUrl, demoQaDescription);

        await expect(creationSection.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("button", { name: /^Functional Forms, links, navigation, and core flows$/ })).toHaveAttribute("aria-pressed", "true");

        await page.getByRole("button", { name: /^Deep Keeps the broader per-link navigation coverage for slower, more exhaustive suites\.$/ }).click();
        await expect(creationSection.getByText("Expanded")).toBeVisible();

        await page.getByRole("button", { name: /^Fast Caps per-page link-click checks and keeps generation focused on the highest-value audits\.$/ }).click();
        await expect(creationSection.getByText("Default")).toBeVisible();
    });

    test("covers the discovered site pages section, crawl lifecycle, and page selection controls", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, localAppUrl, "Create link coverage for the TestForge interface.");

        const crawlSection = page.getByText("Discovered Site Pages").locator("..").locator("..");
        await page.getByRole("button", { name: "Crawl site" }).click();

        await expect(
            page.getByText(/Crawl in progress|Run the crawler to discover same-origin pages and choose what should be tested\./)
        ).toBeVisible({ timeout: 10_000 });

        const firstPageCheckbox = page.locator('input[type="checkbox"]').first();
        await expect(firstPageCheckbox).toBeVisible({ timeout: 40_000 });
        await expect(firstPageCheckbox).toBeChecked();

        await page.getByRole("button", { name: "Clear selection" }).click();
        await expect(firstPageCheckbox).not.toBeChecked();

        await page.getByRole("button", { name: "Select all" }).click();
        await expect(firstPageCheckbox).toBeChecked();
        await expect(crawlSection).toContainText(/\d+\/\d+ selected/);
    });

    test("covers the content rules section and content-aware generation state", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, demoQaUrl, demoQaDescription);

        await page.getByRole("button", { name: /Content Rules Inspect the page before generation/i }).click();
        await expect(page.getByText("Paths to inspect")).toBeVisible();
        await expect(page.getByText("Required headings")).toBeVisible();

        await page.getByLabel("Required headings").fill("Elements");
        await page.getByLabel("Required text snippets").fill("Forms");

        await generateSuite(page);

        await expect(page.getByText("Content-aware inputs are synced with the generated suite.")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Inspection Summary")).toBeVisible({ timeout: 60_000 });
    });

    test("covers the generated suite section actions for editing and saving", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, demoQaUrl, demoQaDescription);

        const generatedSuitePanel = await generateSuite(page);

        await generatedSuitePanel.getByRole("button", { name: "Edit" }).click();
        const codeEditor = generatedSuitePanel.locator("textarea");
        await expect(codeEditor).toBeVisible();
        await codeEditor.press("End");
        await codeEditor.type("\n// Regression edit check");

        await generatedSuitePanel.getByRole("button", { name: "View", exact: true }).click();
        await expect(generatedSuitePanel.locator("pre")).toContainText("// Regression edit check");

        await generatedSuitePanel.getByRole("button", { name: "Add to Test Explorer" }).click();
        await expect(page.getByText(/Added .* to Playwright discovery\./)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/File:/)).toBeVisible();
    });

    test("covers the report tabs after running a generated suite", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, demoQaUrl, demoQaDescription);

        await generateSuite(page);
        await runSuite(page);

        await page.getByRole("button", { name: "Execution", exact: true }).click();
        await expect(page.getByText("Detailed case-by-case results")).toBeVisible();

        await page.getByRole("button", { name: "Defects", exact: true }).click();
        await expect(page.getByText("Issue tracking and hot spots")).toBeVisible();

        await page.getByRole("button", { name: "Coverage", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Traceability", exact: true })).toBeVisible();

        await page.getByRole("button", { name: "Performance", exact: true }).click();
        await expect(page.getByText("Timing and scalability view")).toBeVisible();

        await page.getByRole("button", { name: "Usability", exact: true }).click();
        await expect(page.getByText("User-centric findings")).toBeVisible();
    });
});
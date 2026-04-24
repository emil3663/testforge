import { expect, type Page, test } from "@playwright/test";

const localAppUrl = "http://127.0.0.1:3001";
const localSeoDescription =
    "Create SEO and usability coverage for the TestForge landing page including metadata, heading structure, canonical signals, and report export behavior.";

async function openHome(page: Page) {
    await page.goto("/");

    await expect(page.locator("header").getByText("TestForge", { exact: true })).toBeVisible();
    await expect(page.getByText("Test Suite Creation")).toBeVisible();
    await expect(
        page.getByRole("button", { name: /Generated Suite Review the generated Playwright code/i })
    ).toBeVisible();
}

function getCreationControls(page: Page) {
    const baseUrlInput = page.getByLabel("Base URL");
    const descriptionInput = page.getByLabel("What do you want to test?");
    const generateButton = page.getByRole("button", { name: "Generate test suite" });
    return { baseUrlInput, descriptionInput, generateButton };
}

async function ensureFunctionalPracticeActive(page: Page) {
    const functionalToggle = page.getByRole("button", {
        name: /^Functional Forms, links, navigation, and core flows$/,
    });

    const isPressed = await functionalToggle.getAttribute("aria-pressed");
    if (isPressed !== "true") {
        await functionalToggle.click();
    }

    await expect(functionalToggle).toHaveAttribute("aria-pressed", "true");
}

function getGeneratedSuitePanel(page: Page) {
    return page.locator("section").filter({
        has: page.getByText("Generated Suite").nth(1),
    });
}

async function generateSuite(page: Page) {
    const { baseUrlInput, descriptionInput, generateButton } = getCreationControls(page);

    await expect(baseUrlInput).toBeEnabled();
    await expect(descriptionInput).toBeEnabled();
    await expect(baseUrlInput).toHaveValue("http://localhost:3000");

    await baseUrlInput.fill(localAppUrl);
    await descriptionInput.fill(localSeoDescription);
    await ensureFunctionalPracticeActive(page);

    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    const generatedSuitePanel = getGeneratedSuitePanel(page);
    await expect(generatedSuitePanel.getByText("generated_test.spec.ts")).toBeVisible({ timeout: 60_000 });
    await expect(generatedSuitePanel.locator("pre")).toContainText("import { test, expect } from '@playwright/test';", {
        timeout: 60_000,
    });

    return generatedSuitePanel;
}

async function runSuiteAndWaitForReport(page: Page) {
    const generatedSuitePanel = getGeneratedSuitePanel(page);
    await generatedSuitePanel.getByRole("button", { name: "Run suite" }).first().click();

    await expect(page.getByText("Test Reports")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Release readiness at a glance")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole("button", { name: "Save report as HTML" })).toBeVisible({ timeout: 120_000 });
}

test("smoke: renders critical suite creation UI", async ({ page }) => {
    await openHome(page);

    const { baseUrlInput, descriptionInput, generateButton } = getCreationControls(page);

    await expect(baseUrlInput).toBeEnabled();
    await expect(descriptionInput).toBeEnabled();
    await expect(baseUrlInput).toHaveValue("http://localhost:3000");
    await expect(generateButton).toBeDisabled();

    await baseUrlInput.fill(localAppUrl);
    await descriptionInput.fill(localSeoDescription);
    await ensureFunctionalPracticeActive(page);

    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await expect(generateButton).toBeEnabled();
});

test("smoke: generates a Playwright suite from prompt input", async ({ page }) => {
    await openHome(page);
    await generateSuite(page);
});

test("smoke: adds a generated suite to Playwright discovery", async ({ page }) => {
    await openHome(page);
    const generatedSuitePanel = await generateSuite(page);

    await generatedSuitePanel.getByRole("button", { name: "Add to Test Explorer" }).click();
    await expect(page.getByText(/Added .* to Playwright discovery\./)).toBeVisible({ timeout: 30_000 });
});

test("smoke: runs a generated suite and opens report popup", async ({ page }) => {
    await openHome(page);
    await generateSuite(page);

    const openReportSwitch = page.getByRole("switch", { name: /Open completed report in a new page/i });
    await expect(openReportSwitch).toBeVisible();
    await openReportSwitch.check({ force: true });

    const popupPromise = page.waitForEvent("popup", { timeout: 120_000 });
    await runSuiteAndWaitForReport(page);

    const reportPopup = await popupPromise;
    await expect(reportPopup.getByRole("heading", { name: "TestForge Report" })).toBeVisible({ timeout: 120_000 });
});

test("smoke: exports HTML report after suite run", async ({ page }) => {
    await openHome(page);
    await generateSuite(page);
    await runSuiteAndWaitForReport(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("button", { name: "Save report as HTML" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/testforge-report-.*\.html$/i);
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
});

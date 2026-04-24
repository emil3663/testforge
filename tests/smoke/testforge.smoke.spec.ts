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

async function getRunSuiteButton(page: Page) {
    let runButton = getGeneratedSuitePanel(page).getByRole("button", { name: "Run suite" }).first();
    if (await runButton.count()) {
        return runButton;
    }

    // Re-open the Generated Suite section after transient errors.
    await page
        .getByRole("button", {
            name: /Generated Suite Review the generated Playwright code and run only the active highlighted best-practice sections\./i,
        })
        .click();

    runButton = getGeneratedSuitePanel(page).getByRole("button", { name: "Run suite" }).first();
    await expect(runButton).toBeVisible({ timeout: 30_000 });
    return runButton;
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

async function runSuiteAndWaitForCompletion(page: Page) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const runButton = await getRunSuiteButton(page);
        await expect(runButton).toBeEnabled({ timeout: 30_000 });
        await runButton.click();

        const outcome = await Promise.any([
            page.getByRole("button", { name: "Save report as HTML" }).waitFor({ state: "visible", timeout: 120_000 }).then(() => "structured" as const),
            page.getByText("Structured report data was not available for this run, so only the raw console output is shown.").waitFor({ state: "visible", timeout: 120_000 }).then(() => "fallback" as const),
            page.getByText(/^Error:/).waitFor({ state: "visible", timeout: 120_000 }).then(() => "error" as const),
        ]);

        if (outcome === "structured") {
            await expect(page.getByText("Test Reports")).toBeVisible({ timeout: 120_000 });
            await expect(page.getByText("Release readiness at a glance")).toBeVisible({ timeout: 120_000 });
            await expect(page.getByRole("button", { name: "Save report as HTML" })).toBeVisible({ timeout: 120_000 });
            return outcome;
        }

        if (outcome === "fallback") {
            await expect(
                page.getByText("Structured report data was not available for this run, so only the raw console output is shown.")
            ).toBeVisible({ timeout: 120_000 });
            return outcome;
        }

        if (attempt === 3) {
            throw new Error("Suite run failed in the UI before any report was rendered.");
        }

        await page.waitForTimeout(1500);
    }

    throw new Error("Suite run did not complete.");
}

async function runSuiteAndWaitForReport(page: Page) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const outcome = await runSuiteAndWaitForCompletion(page);
        if (outcome === "structured") {
            return outcome;
        }

        if (attempt < 3) {
            await page.waitForTimeout(1500);
        }
    }

    throw new Error("Expected a structured report for HTML export coverage.");
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

    const popupPromise = page.waitForEvent("popup", { timeout: 120_000 }).catch(() => null);
    const outcome = await runSuiteAndWaitForCompletion(page);

    const reportPopup = await popupPromise;

    if (reportPopup) {
        await expect(
            reportPopup.getByRole("heading", {
                name: outcome === "structured" ? "TestForge Report" : "TestForge Execution Output",
            })
        ).toBeVisible({ timeout: 120_000 });

        if (outcome === "fallback") {
            await expect(
                reportPopup.getByText("Structured report data was not available for this run, so only the raw console output is shown.")
            ).toBeVisible({ timeout: 120_000 });
        }

        return;
    }

    await expect(page.getByText(/Report page notice:/)).toBeVisible({ timeout: 30_000 });
    if (outcome === "fallback") {
        await expect(page.getByText("Execution Output")).toBeVisible();
    }
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

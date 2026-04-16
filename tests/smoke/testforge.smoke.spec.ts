import { expect, test } from "@playwright/test";

test("TestForge can generate, save, and run a smoke suite through its UI", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/");

    await expect(page.locator("header").getByText("TestForge", { exact: true })).toBeVisible();
    await expect(page.getByText("Test Suite Creation")).toBeVisible();
    await expect(
        page.getByRole("button", { name: /Generated Suite Review the generated Playwright code/i })
    ).toBeVisible();

    const baseUrlInput = page.getByLabel("Base URL");
    const descriptionInput = page.getByLabel("What do you want to test?");
    const generateButton = page.getByRole("button", { name: "Generate test suite" });

    await expect(baseUrlInput).toBeEnabled();
    await expect(descriptionInput).toBeEnabled();
    await expect(baseUrlInput).toHaveValue("http://localhost:3000");

    await baseUrlInput.fill("https://demoqa.com/");
    await descriptionInput.fill(
        "Create a functional smoke test for the DemoQA homepage and verify visible navigation links are present and usable."
    );

    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    const generatedSuitePanel = page.locator("section").filter({
        has: page.getByText("Generated Suite").nth(1),
    });
    await expect(generatedSuitePanel.getByText("generated_test.spec.ts")).toBeVisible({ timeout: 60_000 });
    await expect(generatedSuitePanel.locator("pre")).toContainText("import { test, expect } from '@playwright/test';", {
        timeout: 60_000,
    });

    await generatedSuitePanel.getByRole("button", { name: "Add to Test Explorer" }).click();
    await expect(page.getByText(/Added .* to Playwright discovery\./)).toBeVisible({ timeout: 30_000 });

    await generatedSuitePanel.getByRole("button", { name: "Run suite" }).first().click();

    await expect(page.getByText("Test Reports")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Release readiness at a glance")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
});
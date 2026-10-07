import { expect, test, type Page } from "@playwright/test";
import { startRecordedFixture } from "../../src/test-support/comparison-fixture";

// Phase 40 (TFP-172, TFP-173): through the real UI. A crawl of the fixture's
// /types shop (15 pages, 11 types) selects Standard's 8 pages by type; the
// run carries the page types into its report, which shows them last with
// the copyable lists; a selection made by hand is recorded as an override.

let fixture: Awaited<ReturnType<typeof startRecordedFixture>>;

test.beforeAll(async () => {
    fixture = await startRecordedFixture();
});

test.afterAll(async () => {
    await fixture.close();
});

interface RunBody {
    generation?: { pageTypes?: { selectedBy: string; found: number; cap: number; covered: { url: string }[]; skipped: { pattern: string; reason?: string }[]; override?: { added: string[]; removed: string[] } } };
}

async function crawlTypesShop(page: Page) {
    await page.goto("/");
    await page.getByLabel("Base URL").fill(`${fixture.origin}/types`);
    await page.getByLabel("What do you want to test?").fill("Check the security headers of every page.");
    await page.getByRole("button", { name: "Crawl site" }).click();
    const crawlSection = page.getByText("Discovered Site Pages").locator("..").locator("..");
    await expect(crawlSection).toContainText("8/15 selected", { timeout: 60_000 });
    return crawlSection;
}

async function generateAndRun(page: Page) {
    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Generate test suite" }).click();
    await expect(page.getByRole("button", { name: "Run suite" }).first()).toBeEnabled({ timeout: 120_000 });
    await page.getByRole("button", { name: "Run suite" }).first().click();
}

test.describe("Page types in the run report (TFP-173)", () => {
    test("a crawl selects one page per type up to 8; the report names the types found, covered and skipped, and ends with the covered and skipped lists", async ({ page }) => {
        const runBodies: RunBody[] = [];
        page.on("request", (request) => {
            if (request.url().endsWith("/api/run") && request.method() === "POST") runBodies.push(request.postDataJSON() as RunBody);
        });
        await crawlTypesShop(page);
        await generateAndRun(page);

        await expect.poll(() => runBodies.length, { timeout: 30_000 }).toBe(1);
        const sent = runBodies[0].generation?.pageTypes;
        expect(sent?.selectedBy).toBe("type");
        expect(sent?.found).toBe(11);
        expect(sent?.covered).toHaveLength(8);
        expect(sent?.skipped.map((type) => type.pattern)).toEqual(["/types/product/:id", "/types/legal/privacy", "/types/help/terms"]);
        expect(sent?.skipped.every((type) => type.reason?.startsWith("over the cap of 8 types"))).toBe(true);

        const headline = page.getByTestId("page-types-headline");
        await expect(headline).toContainText("Found 11 page types. Covered 8: home", { timeout: 200_000 });
        await expect(headline).toContainText("Not covered: detail (103), content (privacy, terms).");
        const covered = (await page.getByTestId("covered-urls").innerText()).split("\n");
        expect(covered).toHaveLength(8);
        expect(covered.every((url) => url.startsWith(`${fixture.origin}/`))).toBe(true);
        expect((await page.getByTestId("skipped-urls").innerText()).split("\n")).toEqual([
            `${fixture.origin}/types/product/103`,
            `${fixture.origin}/types/legal/privacy`,
            `${fixture.origin}/types/help/terms`,
        ]);
    });

    test("pages chosen by hand are recorded as an override, and 'Select by page type' returns to the type selection", async ({ page }) => {
        const runBodies: RunBody[] = [];
        // Only the request is checked here, so the run itself is stopped before it starts.
        await page.route("**/api/run", async (route) => {
            if (route.request().method() === "POST") {
                runBodies.push(route.request().postDataJSON() as RunBody);
                await route.abort();
                return;
            }
            await route.continue();
        });
        const crawlSection = await crawlTypesShop(page);
        await expect(page.getByRole("button", { name: "Select by page type" })).toBeDisabled();

        await page.getByRole("button", { name: "Select all" }).click();
        await expect(crawlSection).toContainText("15/15 selected");
        await expect(page.getByRole("button", { name: "Select by page type" })).toBeEnabled();
        // Back to the type selection, then by hand again (a run collapses this section, so before it).
        await page.getByRole("button", { name: "Select by page type" }).click();
        await expect(crawlSection).toContainText("8/15 selected");
        await expect(page.getByRole("button", { name: "Select by page type" })).toBeDisabled();
        await page.getByRole("button", { name: "Select all" }).click();
        await expect(crawlSection).toContainText("15/15 selected");
        await generateAndRun(page);

        await expect.poll(() => runBodies.length, { timeout: 30_000 }).toBe(1);
        const sent = runBodies[0].generation?.pageTypes;
        expect(sent?.selectedBy).toBe("user");
        expect(sent?.covered).toHaveLength(11);
        expect(sent?.skipped).toHaveLength(0);
        expect(sent?.override?.removed).toEqual([]);
        expect(sent?.override?.added).toHaveLength(7);
    });
});

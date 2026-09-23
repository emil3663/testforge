import { createServer, type Server } from "node:http";
import { expect, type Page, type Request, test } from "@playwright/test";

// TFP-090: the candidate-journey review screen. Runs the real app against a
// small real site served from this file (no API stubbing): the real crawl-free
// introspect produces real journeys, the real screen lists them, and the
// request the real "Generate selected" button sends is the run config under
// test.
const fixturePort = 4399;
const fixtureUrl = `http://127.0.0.1:${fixturePort}`;

const pages: Record<string, string> = {
    "/": `<!doctype html><html><head><title>Fixture home</title></head><body>
        <h1>Fixture home</h1><a href="/login">Sign in</a></body></html>`,
    "/login": `<!doctype html><html><head><title>Fixture login</title></head><body>
        <h1>Sign in</h1>
        <form action="/authenticate" method="post">
            <label>Username <input name="username" type="text"></label>
            <button type="submit">Log in</button>
        </form></body></html>`,
    "/authenticate": `<!doctype html><html><head><title>Fixture secure</title></head><body><h1>Secure</h1></body></html>`,
};

let fixture: Server;

test.beforeAll(async () => {
    fixture = createServer((req, res) => {
        const path = new URL(req.url ?? "/", fixtureUrl).pathname;
        const html = pages[path];
        res.writeHead(html ? 200 : 404, { "Content-Type": "text/html" });
        res.end(html ?? "not found");
    });
    await new Promise<void>((resolve) => fixture.listen(fixturePort, "127.0.0.1", resolve));
});

test.afterAll(async () => {
    await new Promise<void>((resolve) => fixture.close(() => resolve()));
});

interface GenerateBody {
    contentRules: { selectedJourneyIds: string[] };
    contentProfile: { journeys: { id: string; path: string[] }[] };
}

function generateRequests(page: Page) {
    const seen: Request[] = [];
    page.on("request", (request) => {
        if (request.url().endsWith("/api/generate") && request.method() === "POST") {
            seen.push(request);
        }
    });
    return seen;
}

async function generateAgainstFixture(page: Page) {
    await page.goto("/");
    await page.getByLabel("Base URL").fill(fixtureUrl);
    await page.getByLabel("What do you want to test?").fill("Create functional flow coverage for the sign-in journey.");
    await page.getByRole("button", { name: /Content Rules Inspect the page before generation/i }).click();
    await page.getByLabel("Paths to inspect").fill("/\n/login");
    await expect(page.getByText(/\d+ active/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Generate test suite" }).click();
    await expect(page.getByRole("button", { name: /Candidate Journeys/i })).toBeVisible({ timeout: 90_000 });
}

test.describe("Candidate journey review (TFP-090)", () => {
    test("lists real candidates unselected, and 'Generate selected' carries exactly the selection into run config", async ({ page }) => {
        const generates = generateRequests(page);
        let introspectCalls = 0;
        page.on("request", (request) => {
            if (request.url().endsWith("/api/introspect")) {
                introspectCalls += 1;
            }
        });

        await generateAgainstFixture(page);

        // Both real journeys through the fixture, shortest first, nothing pre-selected.
        const items = page.locator("[data-journey-id]");
        await expect(items).toHaveCount(2);
        await expect(items.nth(0)).toContainText("/login → /authenticate");
        await expect(items.nth(1)).toContainText("/ → /login → /authenticate");
        await expect(items.nth(1)).toContainText("Sign in (link)");
        await expect(items.nth(1)).toContainText("(form submit)");
        await expect(items.nth(0)).toHaveAttribute("aria-pressed", "false");
        await expect(items.nth(1)).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByTestId("journey-selection-count")).toContainText("No journeys selected (2 candidates)");
        await expect(page.getByRole("button", { name: "Generate selected" })).toBeDisabled();

        // The initial generation sent no journeys: default-off, never "all".
        expect(generates).toHaveLength(1);
        const initial = generates[0].postDataJSON() as GenerateBody;
        expect(initial.contentRules.selectedJourneyIds).toEqual([]);

        // Select only the longer journey.
        const longerId = await items.nth(1).getAttribute("data-journey-id");
        expect(longerId).toBeTruthy();
        await items.nth(1).click();
        await expect(items.nth(1)).toHaveAttribute("aria-pressed", "true");
        await expect(items.nth(0)).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByTestId("journey-selection-count")).toContainText("1 of 2 selected");

        await page.getByRole("button", { name: "Generate selected" }).click();
        await expect(page.getByRole("button", { name: "Generate selected" })).toBeEnabled({ timeout: 60_000 });
        await expect.poll(() => generates.length, { timeout: 60_000 }).toBe(2);

        const sent = generates[1].postDataJSON() as GenerateBody;
        expect(sent.contentRules.selectedJourneyIds).toEqual([longerId]);
        expect(sent.contentProfile.journeys.map((journey) => journey.id)).toContain(longerId);

        // Reused the reviewed scan rather than re-inspecting the site.
        expect(introspectCalls).toBe(1);
    });

    test("changing the selection after generating blocks running until regenerated", async ({ page }) => {
        await generateAgainstFixture(page);

        await page.locator("[data-journey-id]").first().click();
        await expect(page.getByText("Generate the suite again after changing the selected journeys before running it.")).toBeVisible();

        await page.getByRole("button", { name: "Generate selected" }).click();
        await expect(page.getByText("Generate the suite again after changing the selected journeys before running it.")).toBeHidden({ timeout: 60_000 });
    });
});

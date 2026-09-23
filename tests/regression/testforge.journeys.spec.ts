import { createServer, type Server } from "node:http";
import { expect, type APIRequestContext, type Page, type Request, test } from "@playwright/test";

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
    "/secure": `<!doctype html><html><head><title>Fixture secure</title></head><body><h1>Secure area</h1></body></html>`,
};

// Like a demo app that accepts any credentials: the form posts to
// /authenticate, which redirects (post/redirect/get) to /secure.
const redirectingPaths: Record<string, string> = { "/authenticate": "/secure" };

let fixture: Server;

test.beforeAll(async () => {
    fixture = createServer((req, res) => {
        const path = new URL(req.url ?? "/", fixtureUrl).pathname;
        req.resume();
        if (redirectingPaths[path]) {
            res.writeHead(302, { Location: redirectingPaths[path] });
            res.end();
            return;
        }
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

interface Journey { id: string }
interface RunRecord { title: string; status: string; rawMessage: string }
interface RunReportShape {
    execution: RunRecord[];
    notTested: { reason: string; elementName: string; elementType: string }[];
    coverage: { matrix: { requirement: string; status: string; uncoveredElements?: string[] }[] };
}

// The real chain, through the built app's own routes: introspect the fixture
// (with two named flows), generate a suite for the selected journeys, and
// run only the journey tests, with interactive tests on or off.
async function generateJourneySuite(request: APIRequestContext) {
    const namedFlows = [
        { label: "signin", entryPath: "/login", exitPath: "/secure" },
        { label: "broken", entryPath: "/login", exitPath: "/nowhere" },
    ];
    const introspected = await (await request.post("/api/introspect", { data: { baseUrl: fixtureUrl, paths: ["/", "/login"], namedFlows } })).json();
    const journeys = introspected.journeys as Journey[];
    const selectedJourneyIds = journeys.map((journey) => journey.id);
    const generated = await (await request.post("/api/generate", {
        data: {
            baseUrl: fixtureUrl,
            description: "Create functional journey coverage for sign-in.",
            selectedPractices: ["functional"],
            contentRules: { paths: ["/", "/login"], requiredHeadings: [], requiredText: [], forbiddenText: [], selectedJourneyIds },
            contentProfile: introspected,
        },
    })).json();
    const code = generated.code as string;
    const journeyTitles = [...code.matchAll(/test\('(TFFU-\d+: journey [^']*)'/g)].map((match) => match[1]);

    return { journeys, code, journeyTitles, introspected };
}

async function runJourneys(request: APIRequestContext, suite: Awaited<ReturnType<typeof generateJourneySuite>>, enableInteractive: boolean) {
    const started = await (await request.post("/api/run", {
        data: {
            code: suite.code,
            selectedPractices: ["functional"],
            auditMode: "fast",
            baseUrl: fixtureUrl,
            description: "journeys",
            includeTestTitles: suite.journeyTitles,
            contentProfile: suite.introspected,
            enableInteractive,
        },
    })).json();
    let report: RunReportShape | undefined;
    await expect.poll(async () => {
        const snapshot = await (await request.get(`/api/run?runId=${started.runId}`)).json();
        report = snapshot.result?.report;
        return Boolean(report);
    }, { timeout: 180_000, intervals: [2_000] }).toBe(true);
    return report as RunReportShape;
}

test.describe("Journey tests (TFP-091)", () => {
    test("journey tests are skipped by default and reported as not covered, with their own reason", async ({ request }) => {
        const suite = await generateJourneySuite(request);
        expect(suite.journeyTitles).toHaveLength(3);

        const report = await runJourneys(request, suite, false);
        const journeyRecords = report.execution.filter((record) => record.title.includes(": journey "));

        expect(journeyRecords).toHaveLength(3);
        expect(journeyRecords.every((record) => record.status === "Blocked")).toBe(true);
        expect(report.notTested.filter((entry) => entry.elementType === "journey").map((entry) => entry.reason)).toEqual(["interactive-skipped", "interactive-skipped", "interactive-skipped"]);
        const functional = report.coverage.matrix.find((row) => row.requirement === "Functional");
        expect(functional?.status).toBe("uncovered");
        // Only the journeys were run here, so the page's own element checks are uncovered too; the three journeys are named among them.
        expect((functional?.uncoveredElements ?? []).filter((name) => name.startsWith("journey "))).toHaveLength(3);
    });

    test("with interactive tests enabled a real journey walks every step and a named flow's exit is verified for real", async ({ request }) => {
        const suite = await generateJourneySuite(request);
        const report = await runJourneys(request, suite, true);
        const byTitle = (needle: string) => report.execution.find((record) => record.title.includes(needle));

        // Automatic: link, then form submit (post/redirect/get through /authenticate).
        expect(byTitle(": journey / > /login > /authenticate")?.status).toBe("Passed");
        // Named, exit /secure: the redirect after the real submit does reach it.
        expect(byTitle(": journey signin: /login > /authenticate")?.status).toBe("Passed");
        // Named, exit /nowhere: a specific, named failure - not a bare pass.
        const broken = byTitle(": journey broken: /login > /authenticate");
        expect(broken?.status).toBe("Failed");
        expect(broken?.rawMessage).toContain("the journey broken declares /nowhere as its exit, but after submitting the app ended on /secure");

        // Executed journeys count toward discovered-surface coverage.
        expect(report.notTested.filter((entry) => entry.elementType === "journey")).toEqual([]);
    });

    test("the run option appears only for a suite with journey tests, and its state reaches /api/run", async ({ page }) => {
        const runBodies: { enableInteractive: boolean }[] = [];
        // Only the run start is answered here (with a refusal), so this test
        // observes exactly what the real button sends without launching a
        // real run; the run itself is covered by the two API tests above.
        await page.route("**/api/run", async (route) => {
            if (route.request().method() === "POST") {
                runBodies.push(route.request().postDataJSON());
                await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "stubbed: run not started" }) });
                return;
            }
            await route.continue();
        });

        await generateAgainstFixture(page);
        await expect(page.getByLabel("Run interactive tests")).toHaveCount(0);

        await page.locator("[data-journey-id]").first().click();
        await page.getByRole("button", { name: "Generate selected" }).click();
        const option = page.getByLabel("Run interactive tests");
        await expect(option).toBeVisible({ timeout: 60_000 });
        await expect(option).not.toBeChecked();

        await option.check();
        await page.getByRole("button", { name: "Run suite" }).first().click();
        await expect.poll(() => runBodies.length, { timeout: 30_000 }).toBe(1);
        expect(runBodies[0].enableInteractive).toBe(true);
    });
});

test.describe("Coverage matching against a real run", () => {
    // Found while building TFP-091: real titles carry a "TFFU-003: " id prefix
    // that coverage matching didn't strip, so every element of every real run
    // was reported untested. Driven through the real routes, not synthetic records.
    test("a real run's passing element checks are matched to their discovered elements", async ({ request }) => {
        const profile = await (await request.post("/api/introspect", { data: { baseUrl: fixtureUrl, paths: ["/login"] } })).json();
        const generated = await (await request.post("/api/generate", {
            data: {
                baseUrl: fixtureUrl,
                description: "Create functional coverage for the sign-in form.",
                selectedPractices: ["functional"],
                contentRules: { paths: ["/login"], requiredHeadings: [], requiredText: [], forbiddenText: [] },
                contentProfile: profile,
            },
        })).json();
        const elementTitles = [...(generated.code as string).matchAll(/test\('(TFFU-\d+: (?:form|action) element check: [^']*)'/g)].map((match) => match[1]);
        expect(elementTitles.length).toBeGreaterThan(0);

        const started = await (await request.post("/api/run", {
            data: {
                code: generated.code,
                selectedPractices: ["functional"],
                auditMode: "fast",
                baseUrl: fixtureUrl,
                description: "elements",
                includeTestTitles: elementTitles,
                contentProfile: profile,
            },
        })).json();
        let report: RunReportShape | undefined;
        await expect.poll(async () => {
            const snapshot = await (await request.get(`/api/run?runId=${started.runId}`)).json();
            report = snapshot.result?.report;
            return Boolean(report);
        }, { timeout: 120_000, intervals: [2_000] }).toBe(true);

        const executed = report!.execution.filter((record) => elementTitles.includes(record.title));
        expect(executed.length).toBe(elementTitles.length);
        expect(executed.every((record) => record.status === "Passed")).toBe(true);

        const functional = report!.coverage.matrix.find((row) => row.requirement === "Functional");
        expect(functional?.uncoveredElements ?? []).toEqual([]);
        expect(functional?.status).toBe("covered");
    });
});

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

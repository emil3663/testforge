import { readFile } from "node:fs/promises";
import { expect, type Locator, type Page, test } from "@playwright/test";

const demoQaUrl = "https://demoqa.com/";
const demoQaLinksUrl = "https://demoqa.com/links";
const demoQaDescription = "Create a functional smoke test for the DemoQA homepage and verify visible navigation links are present and usable.";
const demoQaLinksDescription = "Create link coverage for the DemoQA links page and verify new-tab links and API response links are classified correctly.";
const localAppUrl = "http://127.0.0.1:3001";
const localSeoDescription = "Create SEO and usability coverage for the TestForge landing page including metadata, heading structure, canonical signals, and crawler files.";

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
    test("reports health and observability metadata", async ({ request }) => {
        const response = await request.get("/api/health");

        expect(response.ok()).toBeTruthy();

        const payload = (await response.json()) as {
            status: string;
            service: string;
            environment: string;
            siteUrl: string;
            timestamp: string;
        };

        expect(payload.status).toBe("ok");
        expect(payload.service).toBe("testforge-next");
        expect(typeof payload.environment).toBe("string");
        expect(payload.siteUrl).toContain("http");
        expect(payload.timestamp).toContain("T");
        expect(response.headers()["x-frame-options"]).toBe("DENY");
        expect(response.headers()["x-content-type-options"]).toBe("nosniff");
        expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
        expect(response.headers()["permissions-policy"]).toContain("camera=()");
        expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    });

    test("formats defect backlog and usability findings in plain language", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('Usability Coverage', () => {",
                    "  test('keeps the call to action visible', async () => {",
                    "    expect(1).toBe(2);",
                    "  });",
                    "});",
                    "",
                    "test.describe('SEO and Content Coverage', () => {",
                    "  test('keeps meta description stable for /', async () => {",
                    "    expect(1).toBe(2);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["usability", "seo/content"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                defects?: {
                    issues: Array<{ title: string; summary: string; description: string }>;
                };
                usability?: {
                    findings: Array<{ summary: string }>;
                };
            };
        };

        expect(result.report?.defects?.issues?.length).toBeGreaterThan(0);
        expect(result.report?.defects?.issues?.[0]?.title).toContain(":");
        expect(result.report?.defects?.issues?.[0]?.title).not.toContain("expect(");
        expect(result.report?.defects?.issues?.[0]?.summary).not.toContain("expect(");
        expect(result.report?.defects?.issues?.[0]?.description).not.toContain("\u001b");
        expect(result.report?.usability?.findings?.length).toBeGreaterThan(0);
        expect(result.report?.usability?.findings?.[0]?.summary).toContain("Usability issue:");
        expect(result.report?.usability?.findings?.[0]?.summary).not.toContain("expect(");
    });

    test("captures session evidence artifacts for failed generated runs", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('Usability Coverage', () => {",
                    "  test('keeps the call to action visible', async ({ page }) => {",
                    "    await page.goto('http://127.0.0.1:3001/');",
                    "    expect(1).toBe(2);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["usability"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 120; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                usability?: {
                    sessionEvidence: Array<{ downloadPath?: string }>;
                };
            };
        };
        expect(result.report?.usability?.sessionEvidence?.length).toBeGreaterThan(0);
        const evidencePath = result.report?.usability?.sessionEvidence?.[0]?.downloadPath;
        expect(evidencePath).toBeTruthy();

        const artifactResponse = await request.get(evidencePath ?? "");
        expect(artifactResponse.ok()).toBeTruthy();
    });

    test("links defects, usability findings, and captured artifacts to the same failed test", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('Usability Coverage', () => {",
                    "  test('keeps the primary call to action visible', async ({ page }) => {",
                    "    await page.goto('http://127.0.0.1:3001/');",
                    "    expect(1).toBe(2);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["usability"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 120; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                defects?: {
                    issues: Array<{
                        id: string;
                        testTitle: string;
                        browser: string;
                        artifacts: Array<{ artifactId: string; testTitle: string; defectId?: string; downloadPath?: string }>;
                    }>;
                };
                usability?: {
                    findings: Array<{
                        testTitle: string;
                        defectId?: string;
                        artifacts: Array<{ artifactId: string; testTitle: string; defectId?: string; downloadPath?: string }>;
                    }>;
                    sessionEvidence: Array<{ artifactId: string; testTitle: string; defectId?: string; downloadPath?: string }>;
                };
            };
        };

        const defect = result.report?.defects?.issues?.[0];
        const finding = result.report?.usability?.findings?.[0];
        const evidence = result.report?.usability?.sessionEvidence ?? [];

        expect(defect).toBeTruthy();
        expect(defect?.testTitle).toBe("keeps the primary call to action visible");
        expect(defect?.artifacts.length).toBeGreaterThan(0);
        expect(defect?.artifacts[0]?.testTitle).toBe(defect?.testTitle);
        expect(defect?.artifacts[0]?.defectId).toBe(defect?.id);
        expect(defect?.artifacts[0]?.downloadPath).toBeTruthy();

        expect(finding).toBeTruthy();
        expect(finding?.testTitle).toBe(defect?.testTitle);
        expect(finding?.defectId).toBe(defect?.id);
        expect(finding?.artifacts.length).toBeGreaterThan(0);
        expect(finding?.artifacts[0]?.artifactId).toBe(defect?.artifacts[0]?.artifactId);
        expect(finding?.artifacts[0]?.downloadPath).toBeTruthy();

        expect(evidence.length).toBeGreaterThan(0);
        expect(evidence[0]?.testTitle).toBe(defect?.testTitle);
        expect(evidence[0]?.defectId).toBe(defect?.id);
        expect(evidence[0]?.artifactId).toBe(defect?.artifacts[0]?.artifactId);
    });

    test("groups SEO checks by page when multiple pages are under test", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('SEO and Content Coverage', () => {",
                    "  test('keeps meta description stable for /', async ({ page }) => {",
                    "    await page.goto('https://demoqa.com/');",
                    "    await expect(page).toHaveTitle(/DEMOQA/i);",
                    "  });",
                    "",
                    "  test('keeps heading structure stable for /links', async ({ page }) => {",
                    "    await page.goto('https://demoqa.com/links');",
                    "    await expect(page.getByRole('heading', { name: 'Links', exact: true })).toBeVisible();",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["seo/content"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 120; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                seo?: {
                    pageGroups: Array<{ pageLabel: string; checks: Array<{ label: string }> }>;
                };
            };
        };
        const pageLabels = result.report?.seo?.pageGroups?.map((group) => group.pageLabel) ?? [];
        expect(pageLabels).toContain("/");
        expect(pageLabels).toContain("/links");
    });

    test("summarizes SEO findings in plain language instead of raw matcher errors", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('SEO and Content Coverage', () => {",
                    "  test('keeps meta description stable for /', async () => {",
                    "    expect(1).toBe(2);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["seo/content"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                seo?: {
                    findings: string[];
                };
            };
        };
        expect(result.report?.seo?.findings?.length).toBeGreaterThan(0);
        expect(result.report?.seo?.findings?.[0]).toContain("Meta descriptions failed");
        expect(result.report?.seo?.findings?.[0]).not.toContain("expect(");
        expect(result.report?.seo?.findings?.[0]).not.toContain("locator");
    });

    test("lists the specific broken links in observed outcomes for broken-link failures", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('Functional Coverage', () => {",
                    "  test('link health: internal, external, and download links do not return broken responses', async () => {",
                    "    expect(500, 'Broken link detected for Pricing').toBeLessThan(400);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["functional"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                execution: Array<{ remarks: string }>;
            };
        };

        expect(result.report?.execution?.[0]?.remarks).toContain("Broken links were detected for: Pricing");
    });

    test("does not show a structured report when Playwright executes zero tests", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.use({ baseURL: 'http://127.0.0.1:3001' });",
                ].join("\n"),
                selectedPractices: ["seo/content"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        expect(finalSnapshot?.runStatus).toBe("failed");
        expect(finalSnapshot?.result).toBeTruthy();

        const result = finalSnapshot?.result as { output: string; report?: unknown };
        expect(result.report).toBeUndefined();
        expect(result.output).toContain("without executing any tests");
    });

    test("preserves planned, interrupted, and not-run test states when a run is stopped", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('Functional Coverage', () => {",
                    "  test('first completes before stop', async () => {",
                    "    expect(1).toBe(1);",
                    "  });",
                    "",
                    "  test('second is interrupted by stop', async () => {",
                    "    await new Promise((resolve) => setTimeout(resolve, 10000));",
                    "    expect(1).toBe(1);",
                    "  });",
                    "",
                    "  test('third never starts', async () => {",
                    "    expect(1).toBe(1);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["functional"],
                auditMode: "fast",
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let sawSecondTestRunning = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.progress?.currentTestTitle === "second is interrupted by stop") {
                sawSecondTestRunning = true;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 125));
        }

        expect(sawSecondTestRunning).toBeTruthy();

        const cancelResponse = await request.delete("/api/run", {
            data: { runId: startedRun.runId },
        });
        expect(cancelResponse.ok()).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 80; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 125));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            runStatus: string;
            progress: {
                plannedExecutions: Array<{ title: string; status: string }>;
            };
        };

        expect(result.runStatus).toBe("cancelled");
        expect(result.progress.plannedExecutions).toHaveLength(3);
        expect(result.progress.plannedExecutions).toEqual([
            expect.objectContaining({ title: "first completes before stop", status: "passed" }),
            expect.objectContaining({ title: "second is interrupted by stop", status: "interrupted" }),
            expect.objectContaining({ title: "third never starts", status: "not-run" }),
        ]);
    });

    test("runs only the selected failed test titles when includeTestTitles is provided", async ({ request }) => {
        const response = await request.post("/api/run", {
            data: {
                code: [
                    "import { test, expect } from '@playwright/test';",
                    "",
                    "test.describe('Functional Coverage', () => {",
                    "  test('control test passes', async () => {",
                    "    expect(1).toBe(1);",
                    "  });",
                    "",
                    "  test('first failed test is rerunnable', async () => {",
                    "    expect(1).toBe(2);",
                    "  });",
                    "",
                    "  test('second failed test stays excluded', async () => {",
                    "    expect(1).toBe(2);",
                    "  });",
                    "});",
                ].join("\n"),
                selectedPractices: ["functional"],
                auditMode: "fast",
                includeTestTitles: ["first failed test is rerunnable"],
            },
        });

        expect(response.ok()).toBeTruthy();
        const startedRun = await response.json();
        expect(startedRun.runId).toBeTruthy();

        let finalSnapshot: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const statusResponse = await request.get(`/api/run?runId=${startedRun.runId}`);
            expect(statusResponse.ok()).toBeTruthy();
            const snapshot = await statusResponse.json();

            if (snapshot.runStatus !== "running" && snapshot.runStatus !== "queued") {
                finalSnapshot = snapshot;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        expect(finalSnapshot).not.toBeNull();
        const result = finalSnapshot?.result as {
            report?: {
                summary: { planned: number; executed: number };
                execution: Array<{ title: string }>;
            };
        };

        expect(result.report?.summary.planned).toBe(1);
        expect(result.report?.summary.executed).toBe(1);
        expect(result.report?.execution).toEqual([
            expect.objectContaining({ title: "first failed test is rerunnable" }),
        ]);
    });

    test("covers SEO metadata and crawler-facing files", async ({ page, request }) => {
        await openHome(page);

        await expect(page).toHaveTitle(/TestForge/i);
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Generate Playwright test suites");
        await expect(page.locator('meta[name="description"]').first()).toHaveAttribute("content", /Playwright test suites|plain-English/i);
        const canonicalHref = await page.locator('link[rel="canonical"]').first().getAttribute("href");
        expect(canonicalHref).not.toBeNull();
        expect(new URL(canonicalHref ?? "http://localhost:3000").pathname).toBe("/");
        const structuredData = await page.locator('script[type="application/ld+json"]').first().textContent();
        expect(structuredData).toContain("WebApplication");

        const robotsResponse = await request.get("/robots.txt");
        expect(robotsResponse.ok()).toBeTruthy();
        expect(await robotsResponse.text()).toContain("Sitemap:");

        const sitemapResponse = await request.get("/sitemap.xml");
        expect(sitemapResponse.ok()).toBeTruthy();
        expect(await sitemapResponse.text()).toContain("<loc>");

        const manifestResponse = await request.get("/manifest.webmanifest");
        expect(manifestResponse.ok()).toBeTruthy();
        expect(await manifestResponse.text()).toContain("TestForge");
    });

    test("covers the creation inputs, generation mode, and inferred best-practice state", async ({ page }) => {
        await openHome(page);

        const creationSection = getSection(page, /Test Suite Creation Define the target/i);
        await expect(creationSection.getByText("Base URL")).toBeVisible();
        await expect(creationSection.getByText("What do you want to test?")).toBeVisible();
        await expect(creationSection.getByText("Generation Mode")).toBeVisible();
        await expect(creationSection.getByText("Best-Practice Coverage")).toBeVisible();
        await expect(page.getByLabel("Base URL")).toHaveValue("http://localhost:3000");

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

        await Promise.race([
            page.getByText("Crawl in progress", { exact: true }).waitFor({ state: "visible", timeout: 10_000 }),
            page
                .getByText("Run the crawler to discover same-origin pages and choose what should be tested.", {
                    exact: true,
                })
                .waitFor({ state: "visible", timeout: 10_000 }),
        ]);

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
        await fillCreationInputs(page, demoQaLinksUrl, demoQaLinksDescription);

        await page.getByRole("button", { name: /Content Rules Inspect the page before generation/i }).click();
        await expect(page.getByText("Paths to inspect")).toBeVisible();
        await expect(page.getByText("Required headings")).toBeVisible();

        await page.getByLabel("Required headings").fill("Links");
        await page.getByLabel("Required text snippets").fill("Following links will send an api call");

        await generateSuite(page);

        await expect(page.getByText("Content-aware inputs are synced with the generated suite.")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Inspection Summary")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Visible Links For Fast Testing")).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Opens New Tab", { exact: true })).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Sends API Call", { exact: true })).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(/visible links? discovered and shown for fast testing\./i)).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Home", { exact: true })).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText("Created", { exact: true })).toBeVisible({ timeout: 60_000 });
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

    test("does not generate SEO coverage when Functional is explicitly selected", async ({ request }) => {
        const response = await request.post("/api/generate", {
            data: {
                baseUrl: localAppUrl,
                description: localSeoDescription,
                selectedPractices: ["functional"],
                auditMode: "fast",
                contentRules: {
                    paths: ["/"],
                    requiredHeadings: [],
                    requiredText: [],
                    forbiddenText: [],
                },
                contentProfile: null,
            },
        });

        expect(response.ok()).toBeTruthy();
        const payload = await response.json();

        expect(payload.code).toContain("Functional Coverage");
        expect(payload.code).not.toContain("SEO and Content Coverage");
        expect(payload.code).not.toContain("publishes robots.txt");
        expect(payload.code).not.toContain("publishes sitemap.xml");
    });

    test("does not generate content-profile SEO checks when Functional is explicitly selected", async ({ request }) => {
        const response = await request.post("/api/generate", {
            data: {
                baseUrl: localAppUrl,
                description: localSeoDescription,
                selectedPractices: ["functional"],
                auditMode: "fast",
                contentRules: {
                    paths: ["/links"],
                    requiredHeadings: [],
                    requiredText: [],
                    forbiddenText: [],
                },
                contentProfile: {
                    scannedAt: new Date().toISOString(),
                    baseUrl: localAppUrl,
                    pages: [
                        {
                            path: "/links",
                            url: `${localAppUrl}/links`,
                            title: "Links",
                            metaDescription: "Demo links page",
                            headings: ["Links"],
                            buttons: [],
                            links: [],
                            actionableElements: [],
                            linkDetails: [],
                            visibleTextSnippets: ["Following links will send an api call"],
                        },
                    ],
                },
            },
        });

        expect(response.ok()).toBeTruthy();
        const payload = await response.json();

        expect(payload.code).toContain("Functional Coverage");
        expect(payload.code).not.toContain("SEO and Content Coverage");
        expect(payload.code).not.toContain("keeps page title stable for /links");
        expect(payload.code).not.toContain("keeps meta description stable for /links");
        expect(payload.code).not.toContain("publishes robots.txt");
    });

    test("requires regeneration before running when selected best-practice areas change", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, localAppUrl, localSeoDescription);

        const generatedSuitePanel = await generateSuite(page);
        await expect(generatedSuitePanel.locator("pre")).toContainText("SEO and Content Coverage");

        await page.getByRole("button", { name: /^Functional Forms, links, navigation, and core flows$/ }).click();

        const runButtons = generatedSuitePanel.getByRole("button", { name: "Run suite" });
        await expect(runButtons.first()).toBeDisabled();
        await expect(page.getByText("Generate the suite again after changing the selected best-practice areas before running it.")).toBeVisible();
    });

    test("covers the report tabs, HTML export, and page-scoped SEO drilldown after running a generated suite", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, localAppUrl, localSeoDescription);

        const reportSwitch = page.getByRole("switch", { name: /Open completed report in a new page/i });
        await expect(reportSwitch).toBeVisible();
        await reportSwitch.check({ force: true });

        await generateSuite(page);

        const popupPromise = page.waitForEvent("popup", { timeout: 120_000 });
        await runSuite(page);
        const reportPopup = await popupPromise;

        await expect(reportPopup.getByRole("heading", { name: "TestForge Report" })).toBeVisible({ timeout: 120_000 });

        const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
        await page.getByRole("button", { name: "Save report as HTML" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/testforge-report-.*\.html$/i);
        const downloadedHtmlPath = await download.path();
        expect(downloadedHtmlPath).toBeTruthy();
        const downloadedHtml = await readFile(downloadedHtmlPath ?? "", "utf8");
        expect(downloadedHtml).toContain("Detailed case-by-case results");
        expect(downloadedHtml).toContain("Issue tracking and hot spots");
        expect(downloadedHtml).toContain("Traceability");
        expect(downloadedHtml).toContain("Timing and scalability view");
        expect(downloadedHtml).toContain("User-centric findings");
        expect(downloadedHtml).toContain("Rule-backed search readiness");

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
        await expect(page.getByText("Session Evidence", { exact: true })).toBeVisible();

        await page.getByRole("button", { name: /seo/i }).click();
        await expect(page.getByText(`What happened on ${localAppUrl}`)).toBeVisible();
        await expect(page.getByText("Prioritized recommendations")).toBeVisible();
        await expect(page.getByText(`Page: ${localAppUrl}`)).toBeVisible();
        await expect(page.getByText("Results For /", { exact: false })).toHaveCount(0);
    });

    test("opens a fallback report page for runs without structured report data", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, localAppUrl, localSeoDescription);

        const reportSwitch = page.getByRole("switch", { name: /Open completed report in a new page/i });
        await expect(reportSwitch).toBeVisible();
        await reportSwitch.check({ force: true });

        const generatedSuitePanel = await generateSuite(page);
        await generatedSuitePanel.getByRole("button", { name: "Edit" }).click();
        const codeEditor = generatedSuitePanel.locator("textarea");
        await expect(codeEditor).toBeVisible();
        await codeEditor.fill([
            "import { test, expect } from '@playwright/test';",
            "",
            "test.use({ baseURL: 'http://127.0.0.1:3001' });",
        ].join("\n"));

        const popupPromise = page.waitForEvent("popup", { timeout: 120_000 });
        await generatedSuitePanel.getByRole("button", { name: "Run suite" }).first().click();
        const reportPopup = await popupPromise;

        await expect(page.getByText("Execution Output")).toBeVisible({ timeout: 120_000 });
        await expect(reportPopup.getByRole("heading", { name: "TestForge Execution Output" })).toBeVisible({ timeout: 120_000 });
        await expect(reportPopup.getByText("Structured report data was not available for this run, so only the raw console output is shown.")).toBeVisible({ timeout: 120_000 });
        await expect(reportPopup.getByText(/without executing any tests/i)).toBeVisible({ timeout: 120_000 });
    });

    test("reruns the selected failed test from the execution report", async ({ page }) => {
        await openHome(page);
        await fillCreationInputs(page, localAppUrl, demoQaDescription);

        const generatedSuitePanel = await generateSuite(page);
        await generatedSuitePanel.getByRole("button", { name: "Edit" }).click();
        const codeEditor = generatedSuitePanel.locator("textarea");
        await expect(codeEditor).toBeVisible();
        await codeEditor.fill([
            "import { test, expect } from '@playwright/test';",
            "",
            "test.describe('Functional Coverage', () => {",
            "  test('control test passes', async () => {",
            "    expect(1).toBe(1);",
            "  });",
            "",
            "  test('first failed test is rerunnable', async () => {",
            "    expect(1).toBe(2);",
            "  });",
            "",
            "  test('second failed test stays excluded', async () => {",
            "    expect(1).toBe(2);",
            "  });",
            "});",
        ].join("\n"));

        await generatedSuitePanel.getByRole("button", { name: "Run suite" }).first().click();
        await expect(page.getByText("Test Reports")).toBeVisible({ timeout: 120_000 });

        await page.getByRole("button", { name: "Execution", exact: true }).click();
        await expect(page.getByRole("button", { name: "Rerun selected failed tests" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Rerun this failed test" }).first()).toBeVisible();

        await page.getByLabel("Select first failed test is rerunnable for rerun").check();
        await page.getByRole("button", { name: "Rerun selected failed tests" }).click();

        await expect(page.getByText("Test Reports")).toBeVisible({ timeout: 120_000 });
        await page.getByRole("button", { name: "Execution", exact: true }).click();
        await page.getByRole("button", { name: "All", exact: true }).click();

        const executionSection = page.locator("section").filter({
            has: page.getByText("Detailed case-by-case results"),
        }).first();

        await expect(executionSection.getByText("first failed test is rerunnable", { exact: true })).toBeVisible();
        await expect(executionSection.getByText("second failed test stays excluded", { exact: true })).toHaveCount(0);
        await expect(executionSection.getByText("control test passes", { exact: true })).toHaveCount(0);
    });
});
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
            mode: string;
            siteUrl: string;
            timestamp: string;
        };

        expect(payload.status).toBe("ok");
        expect(payload.service).toBe("testforge-next");
        expect(typeof payload.environment).toBe("string");
        // TFP-031: after TFP-010/011 removed the FastAPI proxy layer, every
        // route always runs in-process - there is no other mode to report.
        expect(payload.mode).toBe("local-in-process");
        expect(payload.siteUrl).toContain("http");
        expect(payload.timestamp).toContain("T");
        expect(response.headers()["x-frame-options"]).toBe("DENY");
        expect(response.headers()["x-content-type-options"]).toBe("nosniff");
        expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
        expect(response.headers()["permissions-policy"]).toContain("camera=()");
        expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
    });

    test("executes generate, run, crawl, introspect, and save-suite without an external backend configured", async ({ request }) => {
        // TFP-031: TFP-010/011 deleted the FastAPI proxy layer and its
        // TESTFORGE_BACKEND_BASE_URL toggle entirely - every route now has a
        // single in-process code path, with nothing external to fall back to
        // or proxy through. This asserts that directly against each of the
        // five routes the proxy removal touched, rather than relying on the
        // UI-flow tests elsewhere in this file to prove it only incidentally.
        // No environment variable beyond .env.development is set for this run.

        const crawlResponse = await request.post("/api/crawl", {
            data: { baseUrl: localAppUrl },
        });
        expect(crawlResponse.status()).toBe(202);
        const crawlJob = (await crawlResponse.json()) as { crawlId: string };
        expect(crawlJob.crawlId).toBeTruthy();

        await expect
            .poll(
                async () => {
                    const response = await request.get(`/api/crawl?crawlId=${crawlJob.crawlId}`);
                    return ((await response.json()) as { crawlStatus: string }).crawlStatus;
                },
                { timeout: 30_000 }
            )
            .toBe("completed");

        const introspectResponse = await request.post("/api/introspect", {
            data: { baseUrl: localAppUrl, paths: ["/"] },
        });
        expect(introspectResponse.ok()).toBeTruthy();
        const introspectPayload = (await introspectResponse.json()) as { pages: unknown[] };
        expect(introspectPayload.pages.length).toBeGreaterThan(0);

        const generateResponse = await request.post("/api/generate", {
            data: {
                baseUrl: localAppUrl,
                description: "Create a functional smoke test for the TestForge landing page.",
                selectedPractices: ["functional"],
                auditMode: "fast",
            },
        });
        expect(generateResponse.ok()).toBeTruthy();
        const generatePayload = (await generateResponse.json()) as { code: string };
        expect(generatePayload.code).toContain("import { test, expect } from '@playwright/test';");

        const runResponse = await request.post("/api/run", {
            data: {
                code: "import { test, expect } from '@playwright/test';\ntest.describe('TFP-031 probe', () => {\n  test('trivial pass', async () => {\n    expect(true).toBe(true);\n  });\n});\n",
                selectedPractices: ["functional"],
                auditMode: "fast",
            },
        });
        expect(runResponse.status()).toBe(202);
        const runJob = (await runResponse.json()) as { runId: string };
        expect(runJob.runId).toBeTruthy();

        await expect
            .poll(
                async () => {
                    const response = await request.get(`/api/run?runId=${runJob.runId}`);
                    return ((await response.json()) as { runStatus: string }).runStatus;
                },
                { timeout: 60_000 }
            )
            .toBe("passed");

        const saveSuiteResponse = await request.post("/api/save-suite", {
            data: {
                code: generatePayload.code,
                description: "TFP-031 no-external-backend probe",
            },
        });
        expect(saveSuiteResponse.ok()).toBeTruthy();
        const saveSuitePayload = (await saveSuiteResponse.json()) as { fileName: string };
        expect(saveSuitePayload.fileName).toMatch(/\.spec\.ts$/);
    });

    test("introspect reports isVisible on every discovered actionable element", async ({ request }) => {
        // TFP-053: ActionableElementDetail had no isVisible field, so every
        // downstream consumer had to assume every discovered element was
        // unconditionally visible - the exact assumption behind TFP-040's 7
        // confirmed false positives. This is a type-shape regression check,
        // not a specific true/false case: testforge's own landing page has
        // no naturally-hidden actionable element to assert against inside
        // this self-contained suite. The specific false case (#btnRecord,
        // #btnClearSession, #uploadImage, #btnStopRecord, #textInput,
        // #btnTextOk, #btnTextCancel all reporting isVisible: false) was
        // verified live against test-assist and is recorded in this
        // commit's message, not reproducible here without that external
        // target.
        const response = await request.post("/api/introspect", {
            data: { baseUrl: localAppUrl, paths: ["/"] },
        });
        expect(response.ok()).toBeTruthy();
        const payload = (await response.json()) as {
            pages: { actionableElements: { isVisible: unknown }[] }[];
        };
        const elements = payload.pages[0]?.actionableElements ?? [];
        expect(elements.length).toBeGreaterThan(0);
        for (const element of elements) {
            expect(typeof element.isVisible).toBe("boolean");
        }
    });

    test("introspect reports ARIA state and toggle-group membership on actionable elements", async ({ request }) => {
        // TFP-055: introspection captured role (getRole()) but no ARIA state
        // and no signal that several elements form a toggle/selection group -
        // precisely TA-252's shape (a .tool-btn list with only a CSS .active
        // class, no ARIA state), which the generator's own Accessibility
        // Coverage test (TFAC-001) had no data to catch. Shape check here,
        // same reasoning as the isVisible test above: testforge's own
        // landing page has no real toggle group. Verified live against
        // test-assist and recorded in this commit's message: the seven
        // .tool-btn elements are detected as one group (role "button",
        // containerLabel "Tools", 3+ member threshold), and - since TA-252
        // already shipped by the time this ran - each now reports a real
        // ariaChecked value rather than null, which is the correct current
        // state, not a stale expectation. Also verified the heuristic does
        // NOT over-group: strokeColor/strokeSize/fillOpacity all resolve to
        // role "textbox" and are correctly excluded (grouping requires role
        // button/radio), and Undo/Redo/Clear share the same containerLabel
        // as the real group but are excluded as one-shot action verbs.
        const response = await request.post("/api/introspect", {
            data: { baseUrl: localAppUrl, paths: ["/"] },
        });
        expect(response.ok()).toBeTruthy();
        const payload = (await response.json()) as {
            pages: {
                actionableElements: {
                    ariaPressed: unknown;
                    ariaSelected: unknown;
                    ariaChecked: unknown;
                    ariaExpanded: unknown;
                    groupId: unknown;
                }[];
            }[];
        };
        const elements = payload.pages[0]?.actionableElements ?? [];
        expect(elements.length).toBeGreaterThan(0);
        for (const element of elements) {
            expect(element.ariaPressed === null || typeof element.ariaPressed === "string").toBe(true);
            expect(element.ariaSelected === null || typeof element.ariaSelected === "string").toBe(true);
            expect(element.ariaChecked === null || typeof element.ariaChecked === "string").toBe(true);
            expect(element.ariaExpanded === null || typeof element.ariaExpanded === "string").toBe(true);
            expect(element.groupId === null || typeof element.groupId === "string").toBe(true);
        }
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

    test("does not assert unconditional visibility for an element hidden at introspection time", async ({ request }) => {
        // TFP-054: the actual root cause of TFP-040's 7 confirmed false
        // positives - every per-element test defaulted to
        // `await expect(locator).toBeVisible();` regardless of whether the
        // element was actually visible when introspected. A synthetic
        // contentProfile here (rather than a live target) makes this
        // deterministic and independent of test-assist being reachable -
        // the live verification against test-assist itself is recorded in
        // this commit's message: regenerating TFP-040's exact suite there
        // now produces 0 of the 7 original failures, 41 of 42 passing (the
        // 42nd, TFFU-036, is a separate, pre-existing finding unrelated to
        // visibility).
        const response = await request.post("/api/generate", {
            data: {
                baseUrl: localAppUrl,
                description: "Regression probe for a conditionally-hidden button.",
                selectedPractices: ["functional"],
                auditMode: "fast",
                contentRules: { paths: ["/"], requiredHeadings: [], requiredText: [], forbiddenText: [] },
                contentProfile: {
                    scannedAt: new Date().toISOString(),
                    baseUrl: localAppUrl,
                    pages: [{
                        path: "/",
                        url: `${localAppUrl}/`,
                        title: "Regression probe",
                        metaDescription: "",
                        headings: [],
                        buttons: [],
                        links: [],
                        actionableElements: [{
                            text: "Hidden Probe Button",
                            url: null,
                            category: "action",
                            elementType: "button",
                            containerLabel: "",
                            expectedStatus: null,
                            isVisible: false,
                            locator: { role: "button", name: "Hidden Probe Button", label: "", placeholder: "", id: "hiddenProbeButton", inputType: "" },
                        }],
                        linkDetails: [],
                        visibleTextSnippets: [],
                    }],
                    warnings: [],
                },
            },
        });

        expect(response.ok()).toBeTruthy();
        const payload = await response.json();

        expect(payload.code).toContain("Hidden Probe Button");
        expect(payload.code).toContain("await expect(locator).toBeAttached();");
        expect(payload.code).toContain("Hidden at introspection time");
        // The specific generated test for this element must not claim
        // unconditional visibility - a broader "no toBeVisible anywhere in
        // the file" assertion would be too strong, since other generic
        // template tests (e.g. the page-load check) legitimately use it.
        const hiddenButtonTest = payload.code.split("Hidden Probe Button")[1]?.split("});")[0] ?? "";
        expect(hiddenButtonTest).not.toContain("toBeVisible()");
    });

    test("generates a toggle-group ARIA assertion for a detected selection group", async ({ request }) => {
        // TFP-057: turns TFP-055's captured group data into an actual
        // failing assertion - the shape TA-252 was filed from. Synthetic
        // payload for the same determinism reason as the test above. Live
        // verification against test-assist (recorded in this commit's
        // message): a generated accessibility suite there produces
        // TFAC-002 (presence) and TFAC-003 (toggle behavior), both passing
        // now that TA-252 has shipped and every .tool-btn member reports a
        // real aria-checked value.
        const groupMember = (name: string, id: string, checked: string) => ({
            text: name,
            url: null,
            category: "action" as const,
            elementType: "button" as const,
            containerLabel: "Tools",
            expectedStatus: null,
            isVisible: true,
            ariaPressed: null,
            ariaSelected: null,
            ariaChecked: checked,
            ariaExpanded: null,
            groupId: "group-1",
            locator: { role: "button", name, label: "", placeholder: "", id, inputType: "" },
        });

        const response = await request.post("/api/generate", {
            data: {
                baseUrl: localAppUrl,
                description: "Regression probe for a detected toggle group.",
                selectedPractices: ["accessibility"],
                auditMode: "fast",
                contentRules: { paths: ["/"], requiredHeadings: [], requiredText: [], forbiddenText: [] },
                contentProfile: {
                    scannedAt: new Date().toISOString(),
                    baseUrl: localAppUrl,
                    pages: [{
                        path: "/",
                        url: `${localAppUrl}/`,
                        title: "Regression probe",
                        metaDescription: "",
                        headings: [],
                        buttons: [],
                        links: [],
                        actionableElements: [
                            groupMember("Select", "toolSelect", "true"),
                            groupMember("Highlight", "toolHighlight", "false"),
                            groupMember("Circle", "toolCircle", "false"),
                        ],
                        linkDetails: [],
                        visibleTextSnippets: [],
                    }],
                    warnings: [],
                },
            },
        });

        expect(response.ok()).toBeTruthy();
        const payload = await response.json();

        expect(payload.code).toContain('toggle group "Tools"');
        expect(payload.code).toContain("exposes ARIA state on every member");
        expect(payload.code).toContain("clicking a member flips its aria-checked");
    });

    test("generates per-element accessible-name and role checks, skipping hidden elements", async ({ request }) => {
        // TFP-056: the accessibility suite previously only counted
        // interactive elements, never checking any of them actually had a
        // name or role. Live verification against test-assist (recorded in
        // this commit's message): 24 of 31 discovered elements got a real
        // accessible-name/role test, all passing including the one that
        // exposed a genuine gap (an unlabeled file input) on a first
        // attempt before the test itself was corrected to use Playwright's
        // own accname computation instead of a hand-rolled heuristic.
        const response = await request.post("/api/generate", {
            data: {
                baseUrl: localAppUrl,
                description: "Regression probe for per-element accessibility checks.",
                selectedPractices: ["accessibility"],
                auditMode: "fast",
                contentRules: { paths: ["/"], requiredHeadings: [], requiredText: [], forbiddenText: [] },
                contentProfile: {
                    scannedAt: new Date().toISOString(),
                    baseUrl: localAppUrl,
                    pages: [{
                        path: "/",
                        url: `${localAppUrl}/`,
                        title: "Regression probe",
                        metaDescription: "",
                        headings: [],
                        buttons: [],
                        links: [],
                        actionableElements: [
                            {
                                text: "Visible Probe Button",
                                url: null,
                                category: "action",
                                elementType: "button",
                                containerLabel: "",
                                expectedStatus: null,
                                isVisible: true,
                                locator: { role: "button", name: "Visible Probe Button", label: "", placeholder: "", id: "visibleProbeButton", inputType: "" },
                            },
                            {
                                text: "Hidden Probe Button",
                                url: null,
                                category: "action",
                                elementType: "button",
                                containerLabel: "",
                                expectedStatus: null,
                                isVisible: false,
                                locator: { role: "button", name: "Hidden Probe Button", label: "", placeholder: "", id: "hiddenProbeButton", inputType: "" },
                            },
                        ],
                        linkDetails: [],
                        visibleTextSnippets: [],
                    }],
                    warnings: [],
                },
            },
        });

        expect(response.ok()).toBeTruthy();
        const payload = await response.json();

        // Split on Playwright test-block boundaries rather than on the
        // element name: the accessible-name assertion's own failure
        // message repeats the element name, so a naive
        // `.split(elementName)[1]` only captures up to that repeat rather
        // than the whole test body.
        const testBlocks: string[] = payload.code
            .split("\n  test(")
            .slice(1)
            .map((block: string) => `  test(${block}`);
        // Generated titles are prefixed with a case ID (e.g. "TFAC-002: "),
        // so match on the stable suffix rather than the block start.
        const findBlock = (titleFragment: string) =>
            testBlocks.find((block) => block.startsWith("  test('") && block.includes(titleFragment)) ?? "";

        const visibleTest = findBlock("accessible name and role: Visible Probe Button");
        expect(visibleTest).toContain("toHaveAccessibleName(/.+/)");
        expect(visibleTest).toContain("ariaSnapshot");

        const hiddenTest = findBlock("accessible name and role: Hidden Probe Button");
        expect(hiddenTest).toContain("Hidden at introspection time");
        expect(hiddenTest).toContain("toBeAttached()");
        expect(hiddenTest).not.toContain("toHaveAccessibleName");
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
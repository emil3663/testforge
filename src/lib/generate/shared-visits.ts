/**
 * Phase 39 (TFP-212 and TFP-213; Decisions 2, 4, 5 and 7, locked 2026-10-16): a page's read-only checks, every
 * area's, run on one shared visit of the page instead of a load each. TFP-211 measured a visit at about 1.45 s
 * on the local Toolshop, and Standard loaded each selected page 37 to 55 times.
 *
 * A pass over a finished suite, as routePageVisits is (TFP-167):
 * - **Which tests share (Decisions 2 and 5).** A test whose first statement loads one page
 *   (`[const x =] await tfGoto(page, '/x')`), that asks for nothing but `page`, `context` and `request`, and that
 *   afterwards only reads: it doesn't load again, interact, scroll, route, listen, add scripts or styles, change
 *   storage, or open pages. Decision 5's fresh-page list keeps its own page whatever the test does: performance,
 *   responsive, cookie and session, the interactive and active gates, and the gap-writer and candidate tests.
 *   A test inside a describe that holds anything but tests, describes and declarations (a hook, `test.use`, a
 *   describe-level `test.skip`) stays where it is too.
 * - **Where they go.** Each page's sharing tests move into one `Page /x` group, in the order pages first appear,
 *   each inside its own area describe (and any describe it was in), so the report files it by area and page as
 *   before. The group's `test` is the extended one (`const test = tfSharedTest`), so its tests are still `test(...)`
 *   calls to everything that finds tests in a suite. The declarations of the describes they leave (helpers like tfNotAPage) move to the top of the file,
 *   once each; two different declarations of one name keep both describes, and their tests, where they are.
 * - **How they share (Decision 4).** `tfShared.visit('/x')` hands each test the page, its context and the load's
 *   response (the passive security checks read its headers and redirect chain), kept per worker. The page is
 *   loaded again, in a new context, when a test asks for another page or the last one left the page, and after a
 *   failure, since Playwright starts a fresh worker after one. A test that changes the page calls
 *   `tfShared.changed()`, and one that types names its field with `tfShared.typed(field)`, which is cleared when the
 *   test ends, pass or fail; a failure after such a test on the same visit is re-run on a fresh page when its group
 *   allows a retry, both results recorded (`shared-visit-rerun`), and one on an untouched page stands without a
 *   re-run (`shared-visit`). The template shares no test that changes the page yet (Decision 3 is TFP-214's), so
 *   it configures no retries; the rule is there, and proven, for when it does.
 * - **Assertions (TFP-215).** In a page's group, `expect` waits 2 s, not Playwright's 5 s: every check there is
 *   read-only, on a page that has settled. TFP-211 measured no passing assertion over 229 ms in 10,500, and about 27
 *   failing ones a run on with-bugs waiting out the full 5 s. An assertion's own timeout still wins; tests outside the
 *   groups keep 5 s.
 * - **Evidence (TFP-241).** Playwright's own `retain-on-failure` capture reaches every context made from its browser in a
 *   test, the shared one too: a failing shared check gets Playwright's trace (its own steps, one chunk per test) and its
 *   failure screenshot, as any check does. Playwright's video is its page fixture's alone, so the shared visit records
 *   its own: a failure ends the visit (Playwright starts a fresh worker), so the failing check finishes the video and
 *   keeps it, with where in it the check starts. A visit no check failed on loses its video when it ends, at a page change or at its group's end (an afterAll hook: a worker-scoped fixture would put the shared checks in workers of their own). Everything is
 *   in the run's output, which the run's credential scan covers.
 *
 * The suite's text changes (Decision 7): its results must not. Proven on the fixture by running each suite
 * shared and one-page-per-test (`src/lib/generate/shared-visits.test.ts`).
 */
import ts from "typescript";
import { PAGE_VISIT_HELPER } from "./page-visits";

/** Decision 5: areas whose tests keep their own fresh page. */
const FRESH_DESCRIBES = new Set(["Performance Coverage", "Responsive Coverage", "Cookie and Session Coverage", "Gap tests", "Candidate tests"]);
const SHARED_FIXTURES = new Set(["page", "context", "request"]);

// Anything after the load that changes the page, its context or what a later check would see.
const CHANGES_THE_PAGE = new RegExp(
    [
        String.raw`\btfGoto\(`,
        String.raw`\b(page|context)\.(goto|reload|goBack|goForward|route|unroute|routeFromHAR|on|once|addInitScript|setViewportSize|emulateMedia|setExtraHTTPHeaders|close|waitForEvent|exposeFunction|exposeBinding|bringToFront|pause|newPage|addCookies|clearCookies|clearPermissions|grantPermissions|setGeolocation|setOffline|addScriptTag|addStyleTag|setContent|dragAndDrop|requestGC)\(`,
        String.raw`\bpage\.context\(\)`,
        String.raw`\.(click|dblclick|fill|type|press|pressSequentially|check|uncheck|setChecked|selectOption|selectText|hover|tap|focus|blur|dragTo|setInputFiles|dispatchEvent|scrollIntoViewIfNeeded|clear)\(`,
        String.raw`\b(keyboard|mouse|touchscreen)\.`,
        String.raw`\btfReadOnlyGuarded\(|\btfCheck[A-Z]\w*\(|\btfSettle\(`,
        String.raw`scroll`,
        String.raw`(localStorage|sessionStorage)\.(setItem|removeItem|clear)|document\.cookie\s*=|\.innerHTML\s*=|\.textContent\s*=|\.value\s*=|\.(remove|append|appendChild|insertAdjacentHTML|setAttribute|removeAttribute)\(`,
    ].join("|")
);

export const SHARED_VISIT_HELPER = `// Phase 39 (TFP-212, TFP-213; Decisions 2 and 4): a page's read-only checks, every area's, on one shared visit.
// The visit (page, context, load response) is kept per worker and handed to each check. It is loaded again, in a
// new context, for another page or after a check left the page, and after a failure (a fresh worker). A check that
// changes the page calls changed(); a failure after one is re-run on a fresh page where its group allows a retry,
// both results recorded, and one on an untouched page stands. A field a check typed into is cleared when it ends.
type TfSharedVisit = { path: string; context: import('@playwright/test').BrowserContext; page: import('@playwright/test').Page; response: import('@playwright/test').Response | null; url: string; touched: boolean; startedAt: number };
let tfSharedVisit: TfSharedVisit | null = null;
// TFP-241: a visit ends by closing its context; a visit no check failed on keeps no video.
async function tfEndSharedVisit(visit: TfSharedVisit | null) {
  if (!visit) return;
  const video = visit.page.video();
  await visit.context.close().catch(() => {});
  await video?.delete().catch(() => {});
}
// TFP-215 (narrowed at Gate A to the read-only assertion timeouts): a shared check reads a page that has settled, so
// its assertions wait 2 s, not Playwright's 5 s. TFP-211: no passing assertion took over 229 ms (10,500 of them).
const tfSharedExpect = expect.configure({ timeout: 2000 });
const tfSharedTest = test.extend<{ tfShared: { visit: (path: string) => Promise<{ page: import('@playwright/test').Page; context: import('@playwright/test').BrowserContext; response: import('@playwright/test').Response | null }>; changed: () => void; typed: (field: import('@playwright/test').Locator) => void } }>({
  tfShared: async ({ browser, baseURL, storageState, viewport, userAgent, locale, deviceScaleFactor, isMobile, hasTouch, colorScheme, ignoreHTTPSErrors, javaScriptEnabled, extraHTTPHeaders, timezoneId, contextOptions }, use, testInfo) => {
    const { mkdirSync, readFileSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const markers = join(testInfo.project.outputDir, 'tf-shared-visits');
    const marker = join(markers, testInfo.testId + '.json');
    // What the failed attempt's visit was, written when it took the visit: a retry can start in a fresh worker before
    // the failed one has finished, so nothing is left to its end. No record: the page was untouched.
    if (testInfo.retry > 0) {
      let touched = false;
      try { touched = JSON.parse(readFileSync(marker, 'utf8')).touched === true; } catch { touched = false; }
      if (!touched) {
        testInfo.annotations.push({ type: 'shared-visit', description: 'not re-run: the failure was on a page no check had changed, so it stands' });
        throw new Error('not re-run on a fresh page: the first failure stands');
      }
      testInfo.annotations.push({ type: 'shared-visit-rerun', description: 'failed after a check that changed the shared page, then re-run on a fresh page' });
      await tfEndSharedVisit(tfSharedVisit);
      tfSharedVisit = null;
    }
    let touchedBefore = false;
    // TFP-241: when this check started, to find it in the visit's video.
    const checkStartedAt = Date.now();
    const videos = join(testInfo.project.outputDir, 'tf-shared-videos');
    const typedFields: import('@playwright/test').Locator[] = [];
    const options = Object.fromEntries(Object.entries({ ...contextOptions, baseURL, storageState, viewport, userAgent, locale, deviceScaleFactor, isMobile, hasTouch, colorScheme, ignoreHTTPSErrors, javaScriptEnabled, extraHTTPHeaders, timezoneId }).filter(([, value]) => value !== undefined));
    await use({
      visit: async (path: string) => {
        const current = tfSharedVisit;
        if (current && current.path === path && !current.page.isClosed() && current.page.url() === current.url) {
          touchedBefore = current.touched;
          if (touchedBefore) { mkdirSync(markers, { recursive: true }); writeFileSync(marker, JSON.stringify({ touched: true })); }
          testInfo.annotations.push({ type: 'visit', description: 'shared ' + path });
          return { page: current.page, context: current.context, response: current.response };
        }
        await tfEndSharedVisit(current);
        // TFP-241: the visit records its video, kept only if a check fails on it.
        const context = await browser.newContext({ ...options, recordVideo: { dir: videos } });
        const startedAt = Date.now();
        const page = await context.newPage();
        const response = await tfGoto(page, path);
        tfSharedVisit = { path, context, page, response, url: page.url(), touched: false, startedAt };
        touchedBefore = false;
        testInfo.annotations.push({ type: 'visit', description: 'loaded ' + path });
        return { page, context, response };
      },
      changed: () => { if (tfSharedVisit) tfSharedVisit.touched = true; },
      // A field the test typed into: cleared when the test ends, pass or fail (a failure also starts a fresh worker).
      typed: (field) => { typedFields.push(field); if (tfSharedVisit) tfSharedVisit.touched = true; },
    });
    for (const field of typedFields) await field.clear({ timeout: 2000 }).catch(() => {});
    if (testInfo.status !== testInfo.expectedStatus) {
      const visit = tfSharedVisit;
      const page = visit?.page;
      if (visit && page && !page.isClosed()) {
        // A failure ends the visit (Playwright starts a fresh worker), so its video is finished here and kept.
        const video = page.video();
        await visit.context.close().catch(() => {});
        tfSharedVisit = null;
        if (video) {
          const path = testInfo.outputPath('video.webm');
          await video.saveAs(path).then(() => testInfo.attach('video', { path, contentType: 'video/webm' })).catch(() => {});
          await video.delete().catch(() => {});
          testInfo.annotations.push({ type: 'shared-visit-video', description: 'this check starts ' + ((checkStartedAt - visit.startedAt) / 1000).toFixed(1) + ' s into the video of the shared visit' });
        }
      }
    }
  },
});`;

type Frame = { title: string; statement: ts.ExpressionStatement; pinned: boolean };
type TestEntry = { statement: ts.ExpressionStatement; lineage: Frame[]; call: ts.CallExpression };
type Declaration = { statement: ts.Statement; frame: Frame; names: string[]; text: string };

const stringLiteral = (node: ts.Node | undefined) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null);
const calleeText = (call: ts.CallExpression, file: ts.SourceFile) => call.expression.getText(file);

function declarationNames(statement: ts.Statement): string[] | null {
    if (ts.isFunctionDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isClassDeclaration(statement)) return statement.name ? [statement.name.text] : null;
    if (ts.isVariableStatement(statement)) {
        const names = statement.declarationList.declarations.map((declaration) => (ts.isIdentifier(declaration.name) ? declaration.name.text : null));
        return names.every((name) => name !== null) ? (names as string[]) : null;
    }
    return null;
}

/** The test's one page, and how it is loaded, when it may share a visit; null when it keeps its own page. */
function sharing(entry: TestEntry, file: ts.SourceFile) {
    if (calleeText(entry.call, file) !== "test") return null;
    if (entry.lineage.some((frame) => frame.pinned || FRESH_DESCRIBES.has(frame.title))) return null;
    const options = entry.call.arguments.length === 3 ? entry.call.arguments[1].getText(file) : "";
    const gate = /type:\s*'gate',\s*description:\s*'([^']+)'/.exec(options)?.[1];
    if (gate && gate !== "read-only") return null;
    const fn = entry.call.arguments.at(-1);
    if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) || !ts.isBlock(fn.body) || fn.parameters.length !== 1) return null;
    const binding = fn.parameters[0].name;
    if (!ts.isObjectBindingPattern(binding)) return null;
    const fixtures = binding.elements.map((element) => (element.propertyName || element.dotDotDotToken || !ts.isIdentifier(element.name) ? null : element.name.text));
    if (fixtures.some((name) => name === null || !SHARED_FIXTURES.has(name)) || !fixtures.includes("page")) return null;
    const [first, ...rest] = fn.body.statements;
    if (!first) return null;
    let load: ts.Expression | undefined;
    let responseName: string | null = null;
    if (ts.isExpressionStatement(first)) {
        load = first.expression;
    } else if (ts.isVariableStatement(first) && first.declarationList.declarations.length === 1) {
        const declaration = first.declarationList.declarations[0];
        if (!ts.isIdentifier(declaration.name)) return null;
        responseName = declaration.name.text;
        load = declaration.initializer;
    }
    if (!load || !ts.isAwaitExpression(load) || !ts.isCallExpression(load.expression)) return null;
    const visit = load.expression;
    if (visit.expression.getText(file) !== "tfGoto" || visit.arguments.length !== 2 || visit.arguments[0].getText(file) !== "page") return null;
    const path = stringLiteral(visit.arguments[1]);
    if (!path || !path.startsWith("/")) return null;
    const after = rest.map((statement) => statement.getText(file)).join("\n");
    if (CHANGES_THE_PAGE.test(after)) return null;
    return { path, fn, first, binding, responseName, usesContext: fixtures.includes("context"), usesRequest: fixtures.includes("request") };
}

const indentOf = (line: string) => /^\s*/.exec(line)![0].length;
function reindent(text: string, indent: string) {
    const lines = text.replace(/^\s*\n/, "").replace(/\s+$/, "").split("\n");
    const depth = Math.min(...lines.filter((line) => line.trim()).map(indentOf));
    return lines.map((line) => (line.trim() ? indent + line.slice(depth) : "")).join("\n");
}

/**
 * Moves the suite's read-only checks onto one shared visit per page (see the top of this file). A suite with no
 * test that can share is returned as it is.
 */
export function shareReadOnlyVisits(code: string): string {
    // Once only: a suite already sharing its visits is returned as it is.
    if (code.includes(SHARED_VISIT_HELPER)) return code;
    const file = ts.createSourceFile("suite.spec.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const tests: TestEntry[] = [];
    const declarations: Declaration[] = [];
    const describes: Array<{ frame: Frame; statements: readonly ts.Statement[] }> = [];

    const walk = (statements: readonly ts.Statement[], lineage: Frame[]) => {
        for (const statement of statements) {
            const call = ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : null;
            const callee = call ? calleeText(call, file) : "";
            if (call && /^test\.describe(\.(serial|parallel|only|skip|fixme))?$/.test(callee)) {
                const fn = call.arguments.find((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) as ts.ArrowFunction | undefined;
                const frame: Frame = { title: stringLiteral(call.arguments[0]) ?? "", statement: statement as ts.ExpressionStatement, pinned: callee !== "test.describe" || call.arguments.length !== 2 };
                if (fn && ts.isBlock(fn.body)) {
                    describes.push({ frame, statements: fn.body.statements });
                    walk(fn.body.statements, [...lineage, frame]);
                } else frame.pinned = true;
                continue;
            }
            if (lineage.length === 0) continue;
            const frame = lineage[lineage.length - 1];
            if (call && /^test(\.(skip|fixme|only|fail))?$/.test(callee) && call.arguments.length >= 2) {
                tests.push({ statement: statement as ts.ExpressionStatement, lineage, call });
                continue;
            }
            const names = declarationNames(statement);
            if (names) declarations.push({ statement, frame, names, text: statement.getText(file) });
            else frame.pinned = true;
        }
    };
    walk(file.statements, []);

    // Declarations move to the top once each; a name declared two different ways keeps its describes where they are.
    const topLevel = new Map<string, string>();
    for (const statement of file.statements) for (const name of declarationNames(statement) ?? []) topLevel.set(name, statement.getText(file));
    const byName = new Map<string, Set<string>>();
    for (const declaration of declarations) for (const name of declaration.names) byName.set(name, new Set([...(byName.get(name) ?? []), declaration.text]));
    for (const declaration of declarations) {
        const conflicting = declaration.names.some((name) => (byName.get(name)?.size ?? 0) > 1 || (topLevel.has(name) && topLevel.get(name) !== declaration.text));
        if (conflicting) declaration.frame.pinned = true;
    }

    const shared = tests.map((entry) => ({ entry, plan: sharing(entry, file) })).filter((item): item is { entry: TestEntry; plan: NonNullable<ReturnType<typeof sharing>> } => item.plan !== null);
    if (shared.length === 0) return code;

    // What leaves its place: the shared tests, and the declarations of the describes they leave. A describe left empty
    // stays, with the comments before it: an area's note on what it couldn't test is read back from there.
    const moved = new Set<ts.Statement>(shared.map((item) => item.entry.statement));
    const leftFrames = new Set(shared.flatMap((item) => item.entry.lineage));
    const hoisted = declarations.filter((declaration) => leftFrames.has(declaration.frame) && !declaration.frame.pinned);
    const removals: Array<[number, number]> = [...moved, ...hoisted.map((declaration) => declaration.statement)].map((statement) => [statement.getFullStart(), statement.getEnd()]);

    // Each shared test, rewritten to take the shared visit.
    const rewrite = ({ entry, plan }: (typeof shared)[number]) => {
        const start = entry.statement.getFullStart();
        let text = code.slice(start, entry.statement.getEnd());
        const edits: Array<[number, number, string]> = [
            [plan.binding.getStart(file), plan.binding.getEnd(), `{ tfShared${plan.usesRequest ? ", request" : ""} }`],
            [plan.first.getStart(file), plan.first.getEnd(), `const { page${plan.usesContext ? ", context" : ""}${plan.responseName ? `, response${plan.responseName === "response" ? "" : `: ${plan.responseName}`}` : ""} } = await tfShared.visit('${plan.path.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}');`],
        ];
        for (const [from, to, replacement] of edits.sort((a, b) => b[0] - a[0])) text = text.slice(0, from - start) + replacement + text.slice(to - start);
        return text;
    };

    // The groups: one per page, in the order pages first appear; inside, the tests' own describes, in order.
    const pages = new Map<string, Map<string, { titles: string[]; texts: string[] }>>();
    for (const item of shared) {
        const titles = item.entry.lineage.map((frame) => frame.title).filter((title) => title !== `Page ${item.plan.path}`);
        const group = pages.get(item.plan.path) ?? new Map();
        const key = JSON.stringify(titles);
        const holder = group.get(key) ?? { titles, texts: [] };
        holder.texts.push(rewrite(item));
        group.set(key, holder);
        pages.set(item.plan.path, group);
    }
    const quote = (title: string) => `'${title.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    const sections = [...pages].map(([path, group]) => {
        const blocks = [...group.values()].map(({ titles, texts }) => {
            const depth = titles.length;
            const open = titles.map((title, index) => `${"  ".repeat(index + 1)}test.describe(${quote(title)}, () => {`).join("\n");
            const close = titles.map((_, index) => `${"  ".repeat(depth - index)}});`).join("\n");
            const body = texts.map((text) => reindent(text, "  ".repeat(depth + 1))).join("\n\n");
            return [open, body, close].filter(Boolean).join("\n");
        });
        // The group's `test` is tfSharedTest, so its tests read as every other test(...) to the tools that find them.
        return `test.describe(${quote(`Page ${path}`)}, () => {\n  const test = tfSharedTest;\n  const expect = tfSharedExpect;\n  // TFP-241: the visit ends with its group, so a visit no check failed on keeps no video.\n  test.afterAll(async () => { await tfEndSharedVisit(tfSharedVisit); tfSharedVisit = null; });\n\n${blocks.join("\n\n")}\n});`;
    });

    let result = code;
    for (const [from, to] of removals.sort((a, b) => b[0] - a[0])) result = result.slice(0, from) + result.slice(to);
    const helpers = [SHARED_VISIT_HELPER, ...[...new Map(hoisted.map((declaration) => [declaration.text, declaration.text])).values()].map((text) => reindent(text, ""))].join("\n\n");
    const at = result.indexOf(PAGE_VISIT_HELPER);
    result = at >= 0
        ? `${result.slice(0, at + PAGE_VISIT_HELPER.length)}\n\n${helpers}${result.slice(at + PAGE_VISIT_HELPER.length)}`
        : result.replace(/^(test\.use\(\{ baseURL: [^\n]*\);\n)/m, `$1\n${helpers}\n`);
    return `${result.replace(/\s+$/, "")}\n\n// Phase 39 (TFP-212): each page's read-only checks, every area's, on one shared visit.\n${sections.join("\n\n")}\n`;
}

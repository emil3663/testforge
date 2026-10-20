/**
 * Phase 39 (TFP-212 and TFP-213; Decisions 2, 4, 5 and 7, locked 2026-10-16): a page's read-only checks, every
 * area's, run on one shared visit of the page instead of a load each. TFP-211 measured a visit at about 1.45 s
 * on the local Toolshop, and Standard loaded each selected page 37 to 55 times.
 *
 * A pass over a finished suite, as routePageVisits is (TFP-167):
 * - **Which tests share (Decisions 2, 3 and 5).** A test whose first statement, after any declarations that only
 *   hold data, loads one page (`[const x =] await tfGoto(page, '/x')`), that asks for nothing but `page`, `context`
 *   and `request`, and that afterwards doesn't load again, route, listen, add scripts or styles, set up its context,
 *   use a form field or a guarded control, or write storage. Since TFP-214 a test that changes the page in place
 *   (clicks, hovers, presses keys, scrolls, changes the DOM, opens a route view, goes back) shares too: it calls
 *   `tfShared.changed()` and runs inside `tfShared.rerun()`, after its page's reads and the axe scan. Decision 5's
 *   fresh-page list keeps its own page whatever the test does: performance, responsive, cookie and session, the
 *   interactive and active gates, and the gap-writer and candidate tests.
 *   A test inside a describe that holds anything but tests, describes and declarations (a hook, `test.use`, a
 *   describe-level `test.skip`) stays where it is too.
 * - **Where they go.** Each page's sharing tests move into one `Page /x` group, in the order pages first appear,
 *   each inside its own area describe (and any describe it was in), so the report files it by area and page as
 *   before. The group's `test` is the extended one (`const test = tfSharedTest`), so its tests are still `test(...)`
 *   calls to everything that finds tests in a suite. The declarations of the describes they leave (helpers like tfNotAPage) move to the top of the file,
 *   once each; two different declarations of one name keep both describes, and their tests, where they are.
 * - **How they share (Decision 4).** `tfShared.visit('/x')` hands each test the page, its context and the load's
 *   response (the passive security checks read its headers and redirect chain), kept per worker. The page is
 *   loaded again, in a new context, when a test asks for another page, and after a failure, since Playwright starts a
 *   fresh worker after one. A test that left the page brings it back with Back for the next (TFP-214), and the page
 *   is loaded again only when Back doesn't return to it. A test that types names its field with
 *   `tfShared.typed(field)`, which is cleared when the test ends, pass or fail. A changing test's failure on a page an
 *   earlier test changed (or left) is run again on a fresh page in the same attempt (TFP-214; before, a Playwright
 *   retry), the first failure kept in a `shared-visit-rerun` annotation and what it found dropped; one on an untouched
 *   page stands.
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

// What keeps a check on a page of its own, whatever else it does (Decisions 3 and 5): it loads a page itself, sets up
// the page or its context (routes, listeners, scripts, viewport, cookies, permissions), uses a form field or a guarded
// control, opens a menu to reveal a link (tfReveal), or writes the page's storage. Emil's look at the control counts
// (2026-10-20): "unclear" controls, mostly form fields and plain buttons, keep a fresh page. A menu is one: what an
// earlier check left open changes what the reveal reports (the fixture's menus: "no control was found that reveals
// it" on a shared page against "the 'Categories' menu opened, but it stays hidden" on a fresh one).
const KEEPS_ITS_OWN_PAGE = new RegExp(
    [
        String.raw`\btfGoto\(`,
        String.raw`\b(page|context)\.(goto|reload|route|unroute|routeFromHAR|on|once|addInitScript|setViewportSize|emulateMedia|setExtraHTTPHeaders|close|waitForEvent|exposeFunction|exposeBinding|bringToFront|pause|addCookies|clearCookies|clearPermissions|grantPermissions|setGeolocation|setOffline|addScriptTag|addStyleTag|setContent|requestGC)\(`,
        String.raw`\bpage\.context\(\)(?!\.newPage\()`,
        String.raw`\.(fill|type|pressSequentially|check|uncheck|setChecked|selectOption|selectText|setInputFiles|clear)\(`,
        String.raw`\btfReadOnlyGuarded\(|\btfCheck[A-Z]\w*\(|\btfSettle\(|\btfReveal\(`,
        String.raw`(localStorage|sessionStorage)\.(setItem|removeItem|clear)|document\.cookie\s*=`,
    ].join("|")
);

// What changes the shared page without keeping a check off it (TFP-214; Decision 3's "in place" controls, and
// navigation, which comes back with Back): it clicks, hovers, focuses, presses keys, scrolls, goes back or forward,
// opens a view in a page of its own, or changes the page's DOM. Such a check marks the visit changed, runs after the
// page's checks that only read, and a failure of it on a page an earlier check changed is re-run on a fresh page
// (Decision 4).
const CHANGES_THE_PAGE = new RegExp(
    [
        String.raw`\.(click|dblclick|press|hover|tap|focus|blur|dragTo|dragAndDrop|dispatchEvent|scrollIntoViewIfNeeded|goBack|goForward|newPage)\(`,
        String.raw`\b(keyboard|mouse|touchscreen)\.`,
        String.raw`scroll`,
        String.raw`\.innerHTML\s*=|\.textContent\s*=|\.value\s*=|\.(remove|append|appendChild|insertAdjacentHTML|setAttribute|removeAttribute)\(`,
    ].join("|")
);

// TFP-214: a declaration before the visit that only holds data (the links a check walks): it doesn't touch the page,
// so the visit can come after it.
const holdsData = (statement: ts.Statement, file: ts.SourceFile) =>
    ts.isVariableStatement(statement) && !/\b(page|context|request|await|tfGoto)\b|=>|\bfunction\b/.test(statement.getText(file));

// Gate B (Emil, 2026-10-20): in a page's group the checks that only read run first, then the axe scan, then the
// checks that change the page, so a failing scan's fresh worker reloads the page for the changing checks alone.
const AXE_SCAN = /passes the WCAG 2\.2 A and AA scan/;

export const SHARED_VISIT_HELPER = `// Phase 39 (TFP-212, TFP-213; Decisions 2 and 4): a page's read-only checks, every area's, on one shared visit.
// The visit (page, context, load response) is kept per worker and handed to each check. It is loaded again, in a
// new context, for another page and after a failure (a fresh worker); a check that left the page is brought back with
// Back (TFP-214), and the page loaded again only if Back doesn't return to it. A check that changes the page calls
// changed() and runs inside rerun(): its failure on a page an earlier check changed is run again on a fresh page, both
// results recorded, and one on an untouched page stands. A field a check typed into is cleared when it ends.
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
const tfSharedTest = test.extend<{ tfShared: { visit: (path: string) => Promise<{ page: import('@playwright/test').Page; context: import('@playwright/test').BrowserContext; response: import('@playwright/test').Response | null }>; changed: () => void; typed: (field: import('@playwright/test').Locator) => void; rerun: (body: () => Promise<void>) => Promise<void> } }>({
  tfShared: async ({ browser, baseURL, storageState, viewport, userAgent, locale, deviceScaleFactor, isMobile, hasTouch, colorScheme, ignoreHTTPSErrors, javaScriptEnabled, extraHTTPHeaders, timezoneId, contextOptions }, use, testInfo) => {
    const { join } = await import('node:path');
    let touchedBefore = false;
    // TFP-241: when this check started, to find it in the visit's video.
    const checkStartedAt = Date.now();
    const videos = join(testInfo.project.outputDir, 'tf-shared-videos');
    const typedFields: import('@playwright/test').Locator[] = [];
    const options = Object.fromEntries(Object.entries({ ...contextOptions, baseURL, storageState, viewport, userAgent, locale, deviceScaleFactor, isMobile, hasTouch, colorScheme, ignoreHTTPSErrors, javaScriptEnabled, extraHTTPHeaders, timezoneId }).filter(([, value]) => value !== undefined));
    await use({
      visit: async (path: string) => {
        const current = tfSharedVisit;
        let back = false;
        // TFP-214 (Decision 3's full navigation): a check that left the page is brought back with Back.
        if (current && current.path === path && !current.page.isClosed() && current.page.url() !== current.url) {
          await current.page.goBack({ timeout: 5000 }).catch(() => null);
          await current.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          back = true;
        }
        if (current && current.path === path && !current.page.isClosed() && current.page.url() === current.url) {
          // A page come back to may be restored as it was left: it counts as changed.
          if (back) current.touched = true;
          touchedBefore = current.touched;
          testInfo.annotations.push({ type: 'visit', description: 'shared ' + path + (back ? ' (back)' : '') });
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
      // TFP-214 (Decision 4): a failure on a page an earlier check changed is run again on a fresh page, in the same
      // attempt; the first failure is recorded on the check, and what it found is dropped with it. A failure on a page
      // no check had changed stands.
      rerun: async (body) => {
        const annotations = testInfo.annotations.length;
        try {
          await body();
        } catch (error) {
          if (!touchedBefore || testInfo.expectedStatus === 'skipped') throw error;
          const first = String((error as Error)?.message ?? error).replace(/\\u001b\\[[0-9;]*m/g, '').split('\\n').find((line) => line.trim()) ?? 'it failed';
          const kept = testInfo.annotations.splice(annotations).filter((annotation) => annotation.type === 'visit');
          testInfo.annotations.push(...kept, { type: 'shared-visit-rerun', description: 'failed on a page an earlier check had changed, then re-run on a fresh page. The first attempt: ' + first.trim() });
          await tfEndSharedVisit(tfSharedVisit);
          tfSharedVisit = null;
          await body();
        }
      },
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
    const statements = [...fn.body.statements];
    const at = statements.findIndex((statement) => !holdsData(statement, file));
    if (at < 0) return null;
    const first = statements[at];
    const rest = statements.slice(at + 1);
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
    if (KEEPS_ITS_OWN_PAGE.test(after)) return null;
    const changes = CHANGES_THE_PAGE.test(after);
    const rank = changes ? 2 : AXE_SCAN.test(entry.call.arguments[0].getText(file)) ? 1 : 0;
    return { path, fn, first, binding, responseName, changes, rank, usesContext: fixtures.includes("context"), usesRequest: fixtures.includes("request") };
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
        const visit = `const { page${plan.usesContext ? ", context" : ""}${plan.responseName ? `, response${plan.responseName === "response" ? "" : `: ${plan.responseName}`}` : ""} } = await tfShared.visit('${plan.path.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}');`;
        const lineIndent = (position: number) => /^[ \t]*/.exec(code.slice(code.lastIndexOf("\n", position - 1) + 1))![0];
        const edits: Array<[number, number, string]> = [[plan.binding.getStart(file), plan.binding.getEnd(), `{ tfShared${plan.usesRequest ? ", request" : ""} }`]];
        if (!plan.changes) edits.push([plan.first.getStart(file), plan.first.getEnd(), visit]);
        else {
            // TFP-214: a check that changes the page says so, and runs inside rerun(): a failure of it on a page an
            // earlier check changed is run again on a fresh page, both results recorded (Decision 4).
            const body = plan.fn.body as ts.Block;
            const open = body.getStart(file) + 1;
            const close = body.getEnd() - 1;
            const indent = lineIndent(plan.first.getStart(file));
            const inner = code.slice(open, plan.first.getStart(file)) + `${visit}\n${indent}tfShared.changed();` + code.slice(plan.first.getEnd(), close).replace(/\s+$/, "");
            const wrapped = inner.split("\n").map((line) => (line.trim() ? `  ${line}` : line)).join("\n");
            edits.push([open, close, `\n${indent}await tfShared.rerun(async () => {${wrapped}\n${indent}});\n${lineIndent(close)}`]);
        }
        for (const [from, to, replacement] of edits.sort((a, b) => b[0] - a[0])) text = text.slice(0, from - start) + replacement + text.slice(to - start);
        return text;
    };

    // The groups: one per page, in the order pages first appear; inside, the tests' own describes, in order: the
    // checks that only read, then the axe scan, then the checks that change the page (TFP-214).
    const pages = new Map<string, Map<string, { titles: string[]; texts: string[] }>>();
    for (const item of shared) if (!pages.has(item.plan.path)) pages.set(item.plan.path, new Map());
    const ordered = shared.map((item, index) => ({ item, index })).sort((a, b) => a.item.plan.rank - b.item.plan.rank || a.index - b.index).map(({ item }) => item);
    for (const item of ordered) {
        const titles = item.entry.lineage.map((frame) => frame.title).filter((title) => title !== `Page ${item.plan.path}`);
        const group = pages.get(item.plan.path)!;
        const key = `${item.plan.rank} ${JSON.stringify(titles)}`;
        const holder = group.get(key) ?? { titles, texts: [] };
        holder.texts.push(rewrite(item));
        group.set(key, holder);
        pages.set(item.plan.path, group);
    }
    const quote = (title: string) => `'${title.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    const sections = [...pages].map(([path, group]) => {
        // Neighbouring holders in the same describes (a read, the scan and a change in one area) share one describe.
        const holders: Array<{ titles: string[]; texts: string[] }> = [];
        for (const holder of group.values()) {
            const last = holders.at(-1);
            if (last && JSON.stringify(last.titles) === JSON.stringify(holder.titles)) last.texts.push(...holder.texts);
            else holders.push({ titles: holder.titles, texts: [...holder.texts] });
        }
        const blocks = holders.map(({ titles, texts }) => {
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

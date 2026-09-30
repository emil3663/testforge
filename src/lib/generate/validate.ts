/**
 * Type-checks a generated suite against the installed `@playwright/test`
 * before it is returned as model output (Phase 30, TFP-103 follow-up).
 *
 * The local model's suites invented `expect(locator).toBeAccessible()`, which
 * Playwright doesn't have. Playwright's own loader strips types without
 * checking them, so nothing downstream would catch it until the run fails.
 * The TypeScript compiler API run in-process against the real type
 * definitions catches exactly that class (an API that does not exist, a
 * module that is not installed, a syntax error) without a temp file or a
 * child process.
 *
 * Deliberately lenient (`strict: false`): the question is "would this suite
 * load and call real APIs", not "is it tidy". Only error diagnostics in the
 * generated file itself count - never ones from the library typings.
 */
import path from "node:path";
import ts from "typescript";

const COMPILER_OPTIONS: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: ["node"],
    strict: false,
    skipLibCheck: true,
    noEmit: true,
};

// Library typings don't change while the server runs; parsing them is most of
// the cost of a check, so parse each once. The generated file never enters it.
const libraryFiles = new Map<string, ts.SourceFile | undefined>();

/** Parses `code` as a spec file inside `projectDir`, next to the real node_modules. */
function loadGenerated(code: string, projectDir: string) {
    const fileName = path.join(projectDir, "__testforge_generated__.spec.ts").replace(/\\/g, "/");
    const host = ts.createCompilerHost(COMPILER_OPTIONS, true);
    const { getSourceFile, fileExists, readFile } = host;

    host.fileExists = (f) => f === fileName || fileExists.call(host, f);
    host.readFile = (f) => (f === fileName ? code : readFile.call(host, f));
    host.getSourceFile = (f, languageVersion, onError, shouldCreate) => {
        if (f === fileName) return ts.createSourceFile(f, code, languageVersion, true);
        if (!libraryFiles.has(f)) libraryFiles.set(f, getSourceFile.call(host, f, languageVersion, onError, shouldCreate));
        return libraryFiles.get(f);
    };

    const program = ts.createProgram([fileName], COMPILER_OPTIONS, host);
    const source = program.getSourceFile(fileName);
    return source ? { program, source } : null;
}

/**
 * Type errors in `code`, as `line:col TSnnnn message` strings; empty means it
 * type-checks. Module resolution starts from `projectDir`, so it sees the same
 * node_modules the run step will.
 */
export function findTypeErrors(code: string, projectDir: string = process.cwd()): string[] {
    const loaded = loadGenerated(code, projectDir);
    if (!loaded) return ["generated suite could not be loaded for checking"];
    const { program, source } = loaded;

    return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => {
            const { line, character } = source.getLineAndCharacterOfPosition(d.start ?? 0);
            return `${line + 1}:${character + 1} TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
        });
}

export interface UnawaitedAssertion {
    line: number;
    text: string;
    /**
     * True when the matcher returns a promise (web-first matchers like
     * toHaveURL, toBeVisible): unawaited, it never checks anything. False for
     * a synchronous matcher on a plain value (toBe, toEqual), which runs
     * anyway - still against the house rule, but not a silent no-op.
     */
    returnsPromise: boolean;
}

/** Modifiers that can sit between expect(...) and the matcher: expect(x).not.toBe(...). */
const MATCHER_MODIFIERS = new Set(["not", "resolves", "rejects"]);

function isExpectCall(node: ts.Expression): boolean {
    if (!ts.isCallExpression(node)) return false;
    const callee = node.expression;
    // expect(...), expect.soft(...), expect.poll(...)
    return (
        (ts.isIdentifier(callee) && callee.text === "expect") ||
        (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "expect")
    );
}

/** A matcher call: expect(...)[.not|.resolves|.rejects].toSomething(...). */
function isAssertion(node: ts.Node): node is ts.CallExpression {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
    let target = node.expression.expression;
    while (ts.isPropertyAccessExpression(target) && MATCHER_MODIFIERS.has(target.name.text)) target = target.expression;
    return isExpectCall(target);
}

/** Awaited, or handed to the caller (returned / an arrow's expression body). */
function isHandled(node: ts.Node): boolean {
    let parent = node.parent;
    while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent;
    return (
        !!parent &&
        (ts.isAwaitExpression(parent) || ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node))
    );
}

/**
 * Every `expect(...)` assertion in `code` that is not awaited (TFP-108). An
 * unawaited web-first assertion is not a type error, so findTypeErrors can't
 * see it - the test still passes while checking nothing.
 */
export function findUnawaitedAssertions(code: string, projectDir: string = process.cwd()): UnawaitedAssertion[] {
    const loaded = loadGenerated(code, projectDir);
    if (!loaded) return [];
    const { program, source } = loaded;
    const checker = program.getTypeChecker();
    const found: UnawaitedAssertion[] = [];

    const visit = (node: ts.Node) => {
        if (isAssertion(node) && !isHandled(node)) {
            const type = checker.getTypeAtLocation(node);
            found.push({
                line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
                text: node.getText(source).replace(/\s+/g, " ").slice(0, 120),
                returnsPromise: checker.getPropertyOfType(type, "then") !== undefined,
            });
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

const TEST_MODIFIERS = new Set(["only", "skip", "fixme", "fail", "slow"]);
const SETUP_CALLS = new Set(["use", "beforeEach", "beforeAll"]);

/** `test(title, fn)` or `test.only/skip/fixme/fail/slow(title, fn)`: the test's function, else null. */
function testFunction(node: ts.Node): ts.FunctionLikeDeclaration | null {
    if (!ts.isCallExpression(node)) return null;
    const callee = node.expression;
    const isTest =
        (ts.isIdentifier(callee) && callee.text === "test") ||
        (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "test" && TEST_MODIFIERS.has(callee.name.text));
    const fn = node.arguments[node.arguments.length - 1];
    return isTest && node.arguments.length >= 2 && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) ? fn : null;
}

/** `test.use(...)`, `test.beforeEach(...)`, `test.beforeAll(...)` as a statement. */
function isSetupStatement(statement: ts.Statement): boolean {
    if (!ts.isExpressionStatement(statement)) return false;
    const call = statement.expression;
    return (
        ts.isCallExpression(call) &&
        ts.isPropertyAccessExpression(call.expression) &&
        ts.isIdentifier(call.expression.expression) &&
        call.expression.expression.text === "test" &&
        SETUP_CALLS.has(call.expression.name.text)
    );
}

/**
 * Phase 37 (TFP-130, Decision 3; GEN-32's duplication half): tests in one
 * suite whose bodies are identical once whitespace and comments are
 * normalised, whatever their titles, as `lines A, B: N tests share one body
 * (titles)`. GEN-54's reliability-2 had three tests with one body under
 * titles naming three different fields, so the suite claimed three checks and
 * made one. Bodies are compared with the setup that applies to them (test.use,
 * beforeEach and beforeAll in the enclosing blocks), so the same body under
 * different setup is not a duplicate. Syntax only; no type information.
 */
export function findDuplicateTests(code: string): string[] {
    const source = ts.createSourceFile("__testforge_generated__.spec.ts", code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    // The node's tokens, trivia (whitespace, comments) skipped: layout never
    // makes two bodies differ. (ts.Printer keeps line breaks in call chains.)
    const print = (node: ts.Node) => {
        const scanner = ts.createScanner(ts.ScriptTarget.ES2022, true, ts.LanguageVariant.Standard, node.getText(source));
        const tokens: string[] = [];
        while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) tokens.push(scanner.getTokenText());
        return tokens.join(" ");
    };
    const groups = new Map<string, { line: number; title: string }[]>();

    const visit = (node: ts.Node) => {
        const fn = testFunction(node);
        if (fn?.body) {
            const setup: string[] = [];
            for (let block: ts.Node | undefined = node.parent; block; block = block.parent) {
                if (ts.isBlock(block) || ts.isSourceFile(block)) {
                    setup.unshift(...block.statements.filter(isSetupStatement).map(print));
                }
            }
            const key = `${setup.join("\n")}\n---\n${print(fn.body)}`;
            const call = node as ts.CallExpression;
            const title = call.arguments[0];
            const entry = {
                line: source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1,
                title: ts.isStringLiteralLike(title) ? title.text : title.getText(source),
            };
            groups.set(key, [...(groups.get(key) ?? []), entry]);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return [...groups.values()]
        .filter((tests) => tests.length > 1)
        .map((tests) => `lines ${tests.map((t) => t.line).join(", ")}: ${tests.length} tests share one body (${tests.map((t) => `'${t.title}'`).join(", ")})`);
}

function isThenable(checker: ts.TypeChecker, type: ts.Type): boolean {
    return checker.getPropertyOfType(type, "then") !== undefined;
}

/**
 * Phase 37 (TFP-129, Decision 2): every assertion that hands a Promise to a
 * plain matcher, as `line N: text`. `expect(locator.isDisabled()).toBe(true)`
 * compares the Promise object itself, not the value it resolves to, so the
 * test can never pass (or, with toBeTruthy, can never fail). It type-checks
 * and is awaited, so neither earlier gate sees it (Phase 36, GEN-54's
 * reliability-3). A plain matcher is one that returns no promise; web-first
 * (auto-retrying) matchers return one and are never flagged, nor is
 * `expect(promise).resolves` / `.rejects`, which unwrap the Promise first.
 */
export function findPromisesToPlainMatchers(code: string, projectDir: string = process.cwd()): string[] {
    const loaded = loadGenerated(code, projectDir);
    if (!loaded) return [];
    const { program, source } = loaded;
    const checker = program.getTypeChecker();
    const found: string[] = [];

    const visit = (node: ts.Node) => {
        if (isAssertion(node)) {
            const modifiers: string[] = [];
            let target = (node.expression as ts.PropertyAccessExpression).expression;
            while (ts.isPropertyAccessExpression(target) && MATCHER_MODIFIERS.has(target.name.text)) {
                modifiers.push(target.name.text);
                target = target.expression;
            }
            const actual = (target as ts.CallExpression).arguments[0];
            if (
                actual &&
                !modifiers.includes("resolves") &&
                !modifiers.includes("rejects") &&
                isThenable(checker, checker.getTypeAtLocation(actual)) &&
                !isThenable(checker, checker.getTypeAtLocation(node))
            ) {
                const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
                found.push(`line ${line}: ${node.getText(source).replace(/\s+/g, " ").slice(0, 120)}`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

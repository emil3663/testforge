import ts from "typescript";

/**
 * Phase 42 (TFP-190): a generated suite read as test units, so each test can
 * be saved, matched and reused on its own. Parsed with the TypeScript
 * compiler, not by indentation: the templates close tests at differing
 * indents, so a `});` at some depth doesn't mark a test's end.
 *
 * A unit is one `test(...)` statement: its describe chain (the titles of the
 * `test.describe` blocks around it), its title without the `TFxx-NNN: ` id,
 * its exact text, and the pages it visits. Its key - the chain, the title,
 * the pages and an occurrence number for repeats - stays the same across runs
 * while ids are renumbered. The pages are in the key because the per-page
 * checks repeat one title for every page: by position alone, removing a page
 * would match the next page's test to the removed page's saved one.
 */
export interface TestUnit {
    key: string;
    describe: string[];
    title: string;
    /** The `TFxx-NNN` id the suite gave it, or "" when it has none. */
    id: string;
    /** The statement's text, from the start of its line to its end. */
    source: string;
    start: number;
    end: number;
    /** The pages it visits: string literals given to tfGoto / page.goto, and its `page` annotation; or the describe's "Page /x". */
    paths: string[];
}

const ID = /^(TF[A-Z]+-\d+): /;

function literal(node: ts.Node | undefined): string | null {
    return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}

function isTestCall(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "test";
}

function isDescribeCall(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node)
        && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)
        && node.expression.expression.text === "test"
        && node.expression.name.text === "describe";
}

function pathsIn(node: ts.Node, describe: string[]): string[] {
    const found = new Set<string>();
    const visit = (child: ts.Node) => {
        if (ts.isCallExpression(child)) {
            const callee = child.expression;
            const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
            // tfGoto(page, '/x') after TFP-167's routing; page.goto('/x') before it; tfShared.visit('/x') since TFP-212.
            const target = name === "tfGoto" ? literal(child.arguments[1]) : name === "goto" || name === "visit" ? literal(child.arguments[0]) : null;
            if (target !== null && (target.startsWith("/") || /^https?:\/\//.test(target))) found.add(target);
        }
        // The `page` annotation the shared and Comprehensive checks carry: { type: 'page', description: '/x' }.
        if (ts.isObjectLiteralExpression(child)) {
            const property = (name: string) => child.properties.find((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name) as ts.PropertyAssignment | undefined;
            if (literal(property("type")?.initializer) === "page") {
                const page = literal(property("description")?.initializer);
                if (page && page.startsWith("/")) found.add(page);
            }
        }
        ts.forEachChild(child, visit);
    };
    visit(node);
    // Comprehensive's per-page describes: "Page /x".
    for (const title of describe) {
        const page = /^Page (\/.*)$/.exec(title)?.[1];
        if (page) found.add(page);
    }
    return [...found];
}

/** Every test unit in a suite, in source order. */
export function parseTestUnits(code: string): TestUnit[] {
    const file = ts.createSourceFile("suite.spec.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const units: TestUnit[] = [];
    const seen = new Map<string, number>();

    const walk = (statements: ts.NodeArray<ts.Statement>, describe: string[]) => {
        for (const statement of statements) {
            if (!ts.isExpressionStatement(statement)) continue;
            const call = statement.expression;
            if (isDescribeCall(call)) {
                const title = literal(call.arguments[0]) ?? "";
                const body = call.arguments.find((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) as ts.ArrowFunction | ts.FunctionExpression | undefined;
                if (body && ts.isBlock(body.body)) walk(body.body.statements, [...describe, title]);
                continue;
            }
            if (!isTestCall(call)) continue;
            const fullTitle = literal(call.arguments[0]) ?? "";
            const id = ID.exec(fullTitle)?.[1] ?? "";
            const title = fullTitle.replace(ID, "");
            const paths = pathsIn(statement, describe);
            const base = JSON.stringify([...describe, title, [...paths].sort()]);
            const occurrence = seen.get(base) ?? 0;
            seen.set(base, occurrence + 1);
            const start = code.lastIndexOf("\n", statement.getStart(file)) + 1;
            const end = statement.getEnd();
            units.push({ key: `${base}#${occurrence}`, describe, title, id, source: code.slice(start, end), start, end, paths });
        }
    };
    walk(file.statements, []);
    return units;
}

/** A unit's source with its id replaced by another (or left as it is when either has none). */
export function withId(source: string, id: string): string {
    if (!id) return source;
    return source.replace(/(test\(\s*['"`])TF[A-Z]+-\d+: /, `$1${id}: `);
}

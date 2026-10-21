import ts from "typescript";

/**
 * Phase 39 (TFP-155, Decision 8 as amended 2026-10-16): a suite is split into units, one file each, and Playwright hands
 * the files out to its workers from its own queue as each comes free. Before this a run was one file, and Playwright runs
 * one file's tests in order in one worker, so a run used one worker whatever it asked for.
 *
 * The units:
 * - **a page:** its shared visit with every area's read-only checks (a `Page /x` group, TFP-212);
 * - **each other top-level describe:** an area's tests that keep their own page or reach past one page (Decision 5's
 *   fresh-page list, site-wide checks, the gated tests), as the suite holds them;
 * - **the top-level tests,** if a suite has any, together.
 *
 * Every unit file starts with everything at the suite's top level that isn't one of these (imports, `test.use`, the
 * helpers), in order, so each unit's tests see exactly what they saw in the one file, and their bodies are unchanged
 * (Decision 12). Files are numbered in the suite's order, so one worker runs them in the order the one file had. A suite
 * with fewer than two units is left as one file.
 */
export type SuiteUnit = { name: string; kind: "page" | "describe" | "tests"; code: string };

const DESCRIBE = /^test\.describe(\.(serial|parallel|only|skip|fixme))?$/;
const TEST = /^test(\.(skip|fixme|only|fail))?$/;

export function splitSuite(code: string): SuiteUnit[] {
    const file = ts.createSourceFile("suite.spec.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const header: string[] = [];
    const units: Array<{ title: string; kind: SuiteUnit["kind"]; texts: string[] }> = [];
    let tests: { title: string; kind: SuiteUnit["kind"]; texts: string[] } | null = null;
    for (const statement of file.statements) {
        const text = code.slice(statement.getFullStart(), statement.getEnd());
        const call = ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? statement.expression : null;
        const callee = call ? call.expression.getText(file) : "";
        const title = call && call.arguments[0] && (ts.isStringLiteral(call.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(call.arguments[0])) ? call.arguments[0].text : null;
        if (call && DESCRIBE.test(callee) && title !== null) {
            // A describe with no test (an area whose tests all moved to their pages' groups) runs nothing: no file.
            if (holdsATest(call, file)) units.push({ title, kind: title.startsWith("Page /") ? "page" : "describe", texts: [text] });
        } else if (call && TEST.test(callee) && title !== null && call.arguments.length >= 2) {
            if (!tests) units.push((tests = { title: "tests", kind: "tests", texts: [] }));
            tests.texts.push(text);
        } else {
            header.push(text);
        }
    }
    if (units.length < 2) return [{ name: "001-suite.spec.ts", kind: units[0]?.kind ?? "tests", code }];
    const head = header.join("").replace(/^\s+/, "");
    const width = Math.max(3, String(units.length).length);
    return units.map((unit, index) => ({
        name: `${String(index + 1).padStart(width, "0")}-${slug(unit.title)}.spec.ts`,
        kind: unit.kind,
        code: `${head}\n${unit.texts.join("")}\n`,
    }));
}

function holdsATest(node: ts.Node, file: ts.SourceFile): boolean {
    if (ts.isCallExpression(node) && TEST.test(node.expression.getText(file)) && node.arguments.length >= 2 && node.arguments[0] && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) return true;
    return ts.forEachChild(node, (child) => (holdsATest(child, file) ? true : undefined)) ?? false;
}

function slug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "") || "unit";
}

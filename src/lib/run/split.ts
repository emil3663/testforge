import ts from "typescript";

/**
 * Phase 39 (TFP-155, Decision 8 as amended 2026-10-16): a suite is split into units, one file each, and Playwright hands
 * the files out to its workers from its own queue as each comes free. Before this a run was one file, and Playwright runs
 * one file's tests in order in one worker, so a run used one worker whatever it asked for.
 *
 * The units:
 * - **a page:** its shared visit with every area's read-only checks (a `Page /x` group, TFP-212);
 * - **each other top-level describe:** an area's tests that keep their own page or reach past one page (Decision 5's
 *   fresh-page list, site-wide checks), as the suite holds them;
 * - **the top-level tests,** if a suite has any, together;
 * - **the serial group (TFP-156, Decision 9):** every test that changes data - its gate, its own or a describe's, is
 *   interactive or active (journeys, the database round trip, form submissions, attack-shaped input) - and every
 *   model-written block (gap tests, candidates, a model's appended tests), in the suite's order, in one file the run
 *   executes after the others, on one worker. A describe holding both kinds is in both files, each copy with only its
 *   own kind's tests and all of the describe's other statements (its helpers and hooks).
 *
 * Every unit file starts with everything at the suite's top level that isn't one of these (imports, `test.use`, the
 * helpers), in order, so each unit's tests see exactly what they saw in the one file, and their bodies are unchanged
 * (Decision 12). Files are numbered in the suite's order, so one worker runs them in the order the one file had. A suite
 * with fewer than two units and no serial group is left as one file.
 */
export type SuiteUnit = { name: string; kind: "page" | "describe" | "tests" | "serial"; code: string };

/** The serial group's file: kept apart from the other units, run after them (TFP-156). */
export const SERIAL_UNIT = "serial.spec.ts";

const DESCRIBE = /^test\.describe(\.(serial|parallel|only|skip|fixme))?$/;
const TEST = /^test(\.(skip|fixme|only|fail))?$/;
const GATE = /type:\s*'gate',\s*description:\s*'([a-z-]+)'/;
const SERIAL_GATES = new Set(["interactive", "active"]);
/** Decision 9's model-written blocks, by their describes' titles. */
const MODEL_WRITTEN = [/^Gap tests$/, /^Candidate tests$/, /^Local model \(/, /^OpenAI \(/];

type Call = { call: ts.CallExpression; statement: ts.Statement };

export function splitSuite(code: string): SuiteUnit[] {
    const file = ts.createSourceFile("suite.spec.ts", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const titleOf = (call: ts.CallExpression) => {
        const first = call.arguments[0];
        return first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) ? first.text : null;
    };
    const asCall = (statement: ts.Statement): Call | null =>
        ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) ? { call: statement.expression, statement } : null;
    const isDescribe = (call: ts.CallExpression) => DESCRIBE.test(call.expression.getText(file)) && titleOf(call) !== null;
    const isTest = (call: ts.CallExpression) => TEST.test(call.expression.getText(file)) && titleOf(call) !== null && call.arguments.length >= 2;
    const gateOf = (call: ts.CallExpression) => (call.arguments.length >= 3 ? GATE.exec(call.arguments[1].getText(file))?.[1] ?? null : null);
    const bodyOf = (call: ts.CallExpression) => {
        const fn = call.arguments.find((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) as ts.ArrowFunction | ts.FunctionExpression | undefined;
        return fn && ts.isBlock(fn.body) ? fn.body.statements : [];
    };

    /** Every test under a describe (or the test itself), with whether it belongs to the serial group. */
    const testsUnder = (entry: Call, inherited: { gate: string | null; modelWritten: boolean }): Array<{ statement: ts.Statement; serial: boolean }> => {
        const gate = gateOf(entry.call) ?? inherited.gate;
        if (isTest(entry.call)) return [{ statement: entry.statement, serial: (gate !== null && SERIAL_GATES.has(gate)) || inherited.modelWritten }];
        const modelWritten = inherited.modelWritten || MODEL_WRITTEN.some((pattern) => pattern.test(titleOf(entry.call) ?? ""));
        return bodyOf(entry.call).flatMap((statement) => {
            const inner = asCall(statement);
            return inner && (isDescribe(inner.call) || isTest(inner.call)) ? testsUnder(inner, { gate, modelWritten }) : [];
        });
    };
    /** The statement's text without the given tests (each removed with the comments before it). */
    const without = (statement: ts.Statement, removed: ts.Statement[]) => {
        let text = code.slice(statement.getFullStart(), statement.getEnd());
        for (const test of [...removed].sort((a, b) => b.getFullStart() - a.getFullStart())) {
            text = text.slice(0, test.getFullStart() - statement.getFullStart()) + text.slice(test.getEnd() - statement.getFullStart());
        }
        return text;
    };

    const header: string[] = [];
    const units: Array<{ title: string; kind: SuiteUnit["kind"]; texts: string[] }> = [];
    const serial: string[] = [];
    let topTests: { title: string; kind: SuiteUnit["kind"]; texts: string[] } | null = null;
    for (const statement of file.statements) {
        const entry = asCall(statement);
        if (!entry || !(isDescribe(entry.call) || isTest(entry.call))) {
            header.push(code.slice(statement.getFullStart(), statement.getEnd()));
            continue;
        }
        const tests = testsUnder(entry, { gate: null, modelWritten: false });
        const serialTests = tests.filter((test) => test.serial).map((test) => test.statement);
        const readOnlyTests = tests.filter((test) => !test.serial).map((test) => test.statement);
        if (serialTests.length > 0) serial.push(without(statement, readOnlyTests));
        // A describe with no read-only test (none, or all serial) makes no read-only file.
        if (readOnlyTests.length === 0) continue;
        const text = without(statement, serialTests);
        if (isTest(entry.call)) {
            if (!topTests) units.push((topTests = { title: "tests", kind: "tests", texts: [] }));
            topTests.texts.push(text);
        } else {
            const title = titleOf(entry.call)!;
            units.push({ title, kind: title.startsWith("Page /") ? "page" : "describe", texts: [text] });
        }
    }
    if (units.length < 2 && serial.length === 0) return [{ name: "001-suite.spec.ts", kind: units[0]?.kind ?? "tests", code }];
    const head = header.join("").replace(/^\s+/, "");
    const width = Math.max(3, String(units.length).length);
    return [
        ...units.map((unit, index) => ({
            name: `${String(index + 1).padStart(width, "0")}-${slug(unit.title)}.spec.ts`,
            kind: unit.kind,
            code: `${head}\n${unit.texts.join("")}\n`,
        })),
        ...(serial.length > 0 ? [{ name: SERIAL_UNIT, kind: "serial" as const, code: `${head}\n${serial.join("")}\n` }] : []),
    ];
}

function slug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/, "") || "unit";
}

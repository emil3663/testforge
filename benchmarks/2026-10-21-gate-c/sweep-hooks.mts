// TFP-156 follow-up (Cowork, 2026-10-21): a describe holding both read-only and serial tests is in both unit files,
// each copy with all its hooks, so a hook runs once per file. For check:template-unchanged's 166 fixed inputs (its
// head.json), list every such describe and its hooks (beforeAll, afterAll, beforeEach, afterEach), at any depth, with
// each hook's text, so any that changes data can be read.
// Usage (from the repo root, after `npm run check:template-unchanged -- <base>`):
//   node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types benchmarks/2026-10-21-gate-c/sweep-hooks.mts <comparisonDir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const { splitSuite } = await import(pathToFileURL(join(process.cwd(), "src/lib/run/split.ts")).href);
const head = JSON.parse(readFileSync(join(process.argv[2], "head.json"), "utf8")) as Record<string, string>;
const HOOK = /^test\.(beforeAll|afterAll|beforeEach|afterEach)$/;

let inputs = 0, both = 0;
const hooks = new Map<string, { count: number; inputs: number; example: string }>();
for (const [key, code] of Object.entries(head)) {
    const units = splitSuite(code) as Array<{ kind: string; code: string }>;
    const serial = units.find((unit) => unit.kind === "serial");
    if (!serial) continue;
    inputs++;
    // The top-level describes in the serial file that a read-only file also holds: in both.
    const titles = (unitCode: string) => {
        const file = ts.createSourceFile("u.ts", unitCode, ts.ScriptTarget.Latest, true);
        return file.statements.flatMap((statement) => (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && /^test\.describe/.test(statement.expression.expression.getText(file)) && ts.isStringLiteral(statement.expression.arguments[0]) ? [{ title: statement.expression.arguments[0].text, statement, file }] : []));
    };
    const readOnlyTitles = new Set(units.filter((unit) => unit.kind !== "serial").flatMap((unit) => titles(unit.code).map((entry) => entry.title)));
    for (const entry of titles(serial.code)) {
        if (!readOnlyTitles.has(entry.title)) continue;
        both++;
        const found: string[] = [];
        const walk = (node: ts.Node) => {
            if (ts.isCallExpression(node) && HOOK.test(node.expression.getText(entry.file))) found.push(node.getText(entry.file));
            ts.forEachChild(node, walk);
        };
        walk(entry.statement);
        console.log(`${key} | describe "${entry.title}" in both files | hooks: ${found.length}`);
        for (const hook of found) {
            const name = `${entry.title} :: ${hook.split("(")[0]}`;
            const seen = hooks.get(name) ?? { count: 0, inputs: 0, example: hook };
            seen.count++;
            seen.inputs++;
            hooks.set(name, seen);
        }
    }
}
console.log(`\n${inputs} inputs with a serial group; ${both} describes in both files; ${[...hooks.values()].reduce((sum, hook) => sum + hook.count, 0)} hooks in them`);
for (const [name, hook] of hooks) console.log(`\n== ${name} (${hook.count}x)\n${hook.example}`);

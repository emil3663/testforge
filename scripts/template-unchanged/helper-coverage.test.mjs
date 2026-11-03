/**
 * TFP-258: every helper the generator can write into a suite is reached by a
 * fixed input of the template-unchanged check, so a change inside a helper
 * can't pass the check unseen (TFP-250's reworded comment did).
 *
 * A helper is any `export const *_HELPER(S)` or `export function build*Helper(s)`
 * under src/lib/generate. Each is parsed into its top-level declarations, and
 * each declaration, comments inside it included, must appear in at least one
 * fixed output. Indentation is ignored (the shared-visit pass moves helpers
 * out of their describes), and a declaration may appear with its visits
 * routed through tfGoto, as every suite's are (TFP-167).
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test scripts/template-unchanged/helper-coverage.test.mjs
 */
import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { CONTENT_PROFILE_PATH } from "./inputs.mjs";
import { generateOutputs } from "./outputs.mjs";

const root = join(import.meta.dirname, "..", "..");
const load = (path) => import(pathToFileURL(join(root, path)).href);
const { routeAddedVisits } = await load("src/lib/generate/page-visits.ts");

function sourceFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
    });
}

/** { name: text } for every helper source, a builder called at no indent. */
async function helperSources() {
    const sources = {};
    for (const file of sourceFiles(join(root, "src/lib/generate"))) {
        const names = [...readFileSync(file, "utf8").matchAll(/^export (?:const ([A-Z_]+_HELPERS?)\b|function (build\w*Helpers?)\()/gm)].map((match) => match[1] ?? match[2]);
        if (names.length === 0) continue;
        const exported = await import(pathToFileURL(file).href);
        for (const name of names) sources[name] = typeof exported[name] === "function" ? exported[name]("") : exported[name];
    }
    return sources;
}

const flat = (text) => text.split("\n").map((line) => line.trim()).filter(Boolean).join("\n");

const modules = {
    mock: await load("src/lib/generate/mock/index.ts"),
    normalize: await load("src/lib/generate/normalize.ts"),
    comprehensive: await load("src/lib/generate/comprehensive.ts"),
    pages: await load("src/lib/comprehensive/pages.ts"),
    runMode: await load("src/lib/comprehensive/run-mode.ts"),
};
const outputs = Object.values(generateOutputs(modules, JSON.parse(readFileSync(join(root, CONTENT_PROFILE_PATH), "utf8")))).map(flat);

test("TFP-258: every declaration in every helper the generator can write is in at least one fixed output", async () => {
    const sources = await helperSources();
    // The convention is how helpers are found: a renamed one must fail here, not drop out of the check unseen.
    for (const name of ["PAGE_VISIT_HELPER", "SHARED_VISIT_HELPER", "READ_ONLY_GUARD_HELPER", "CONTROL_HELPERS", "PROBE_HELPERS", "buildRouteHelpers", "buildRevealHelper"]) {
        assert.ok(name in sources, `${name} is found as a helper`);
    }

    const unreached = [];
    for (const [name, source] of Object.entries(sources)) {
        const file = ts.createSourceFile("helper.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        for (const statement of file.statements) {
            const text = statement.getText(file);
            const forms = [flat(text), flat(routeAddedVisits("async function tfGoto(", text).code)];
            if (!outputs.some((output) => forms.some((form) => output.includes(form)))) unreached.push(`${name}: ${text.split("\n")[0]}`);
        }
    }
    assert.deepStrictEqual(unreached, [], `reached by no fixed input:\n${unreached.join("\n")}`);
});

// A tf* helper the generator writes from outside the convention (tfLeakSignature, inline in a test body's
// template) is still caught by name: whatever string it lives in, some fixed output must declare it.
test("TFP-258: every tf* helper the generator's source declares is declared in at least one fixed output", () => {
    const declared = new Set();
    for (const file of sourceFiles(join(root, "src/lib/generate"))) {
        for (const match of readFileSync(file, "utf8").matchAll(/(?:function\s+|(?:const|let)\s+)(tf[A-Z]\w*)\s*[(=:<]/g)) declared.add(match[1]);
    }
    assert.ok(declared.has("tfLeakSignature") && declared.has("tfGoto"), [...declared].join(", "));
    const declares = (name) => new RegExp(`(?:function\\s+|(?:const|let)\\s+)${name}\\s*[(=:<]`);
    const missing = [...declared].filter((name) => !outputs.some((output) => declares(name).test(output)));
    assert.deepStrictEqual(missing, [], `declared in no fixed output:\n${missing.join("\n")}`);
});

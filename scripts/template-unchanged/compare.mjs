// Phase 35 TFP-137: the pure parts of the template-unchanged check, kept
// apart from git and child processes so they can be unit-tested.

export class CheckError extends Error {}

/** The named exports a ref must have; a missing one stops the check by name, never adapted around. */
export function requireExports(moduleName, module, names) {
    const missing = names.filter((name) => typeof module[name] !== "function");
    if (missing.length > 0) throw new CheckError(`${moduleName} does not export ${missing.join(", ")}`);
}

/** mockGenerate(baseUrl, description, selectedPractices, contentProfile, contentRules, auditMode). */
export const MOCK_GENERATE_ARITY = 6;
/** TFP-258: buildComprehensiveSuite(baseUrl, mode, scope), its options defaulted; selectComprehensivePages(profile, baseUrl, pageCap). */
export const COMPREHENSIVE_SUITE_ARITY = 3;
export const SELECT_PAGES_ARITY = 3;

export function requireArity(name, fn, arity) {
    if (fn.length !== arity) throw new CheckError(`${name} takes ${fn.length} parameters, not the ${arity} this check calls it with`);
}

function firstDifference(base, head) {
    const a = base.split("\n");
    const b = head.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) return { line: i + 1, base: a[i] ?? "(no line)", head: b[i] ?? "(no line)" };
    }
    return null;
}

/**
 * Compares two { key: output } maps for the same inputs. Returns the counts
 * and, for each input that differs, its key and the first differing line.
 */
export function compareOutputs(base, head) {
    const baseKeys = Object.keys(base);
    const headKeys = Object.keys(head);
    if (baseKeys.length !== headKeys.length || baseKeys.some((key) => !(key in head))) {
        throw new CheckError("the two sides did not run the same inputs");
    }
    const different = [];
    for (const key of baseKeys) {
        if (base[key] !== head[key]) different.push({ key, ...firstDifference(base[key], head[key]) });
    }
    return { inputs: baseKeys.length, identical: baseKeys.length - different.length, different };
}

/**
 * Phase 48 (TFP-278, Decision 11): a rename map's replacements, from its JSON text. Each is a literal { from, to },
 * applied in the file's order; anything else stops the check by name.
 */
export function parseRenameMap(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new CheckError(`the rename map isn't JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const replacements = parsed?.replacements;
    if (!Array.isArray(replacements) || replacements.length === 0) throw new CheckError("the rename map has no replacements");
    replacements.forEach((entry, index) => {
        if (typeof entry?.from !== "string" || entry.from === "" || typeof entry?.to !== "string") {
            throw new CheckError(`the rename map's replacement ${index + 1} needs a non-empty "from" and a "to"`);
        }
    });
    return replacements.map(({ from, to }) => ({ from, to }));
}

/** The base side's outputs with every replacement applied, in order, and how many times each matched. */
export function applyRenameMap(outputs, replacements) {
    const counts = replacements.map(() => 0);
    const mapped = {};
    for (const [key, text] of Object.entries(outputs)) {
        let next = text;
        replacements.forEach(({ from, to }, index) => {
            const parts = next.split(from);
            counts[index] += parts.length - 1;
            next = parts.join(to);
        });
        mapped[key] = next;
    }
    return { outputs: mapped, counts };
}

export function formatResult(result, baseName, headName) {
    const lines = [`template-unchanged: ${baseName} -> ${headName}: ${result.inputs} inputs, ${result.identical} identical, ${result.different.length} different`];
    for (const diff of result.different) {
        lines.push(`  ${diff.key}`, `    line ${diff.line}`, `    base: ${diff.base}`, `    head: ${diff.head}`);
    }
    return lines.join("\n");
}

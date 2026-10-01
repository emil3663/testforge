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

export function formatResult(result, baseName, headName) {
    const lines = [`template-unchanged: ${baseName} -> ${headName}: ${result.inputs} inputs, ${result.identical} identical, ${result.different.length} different`];
    for (const diff of result.different) {
        lines.push(`  ${diff.key}`, `    line ${diff.line}`, `    base: ${diff.base}`, `    head: ${diff.head}`);
    }
    return lines.join("\n");
}

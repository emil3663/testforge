// Node's ESM resolver requires explicit extensions and doesn't understand
// the "@/*" tsconfig path alias; this repo's source (correctly, for a
// Next.js app under moduleResolution "bundler") omits both. Without this,
// `node --test` can only run files with a trivial import graph (as
// persistence.test.ts's did, via type-only "@/..." imports that
// --experimental-strip-types erases). This hook adds just enough of
// bundler-style resolution - extensionless relative imports and the "@/"
// alias - to run real source files under plain `node --test`, so
// finalizeRunJob and the API route handlers can be exercised directly
// instead of only through a live dev server.
import { statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const SRC_ROOT = fileURLToPath(new URL("../src/", import.meta.url));
const SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function isFile(path) {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
}

function resolveTsPath(basePath) {
    if (isFile(basePath)) return basePath;
    for (const suffix of SUFFIXES) {
        const candidate = basePath + suffix;
        if (isFile(candidate)) return candidate;
    }
    return null;
}

export async function resolve(specifier, context, nextResolve) {
    // Next's package.json "exports" map requires the explicit ".js" - Next
    // itself only gets away without it via bundler-style resolution too.
    if (specifier === "next/server") {
        return nextResolve("next/server.js", context);
    }

    let basePath = null;
    if (specifier.startsWith("@/")) {
        basePath = join(SRC_ROOT, specifier.slice(2));
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
        basePath = join(dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (basePath) {
        const resolved = resolveTsPath(basePath);
        if (resolved) {
            return nextResolve(pathToFileURL(resolved).href, context);
        }
    }

    return nextResolve(specifier, context);
}

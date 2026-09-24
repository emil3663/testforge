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

/**
 * Type errors in `code`, as `line:col TSnnnn message` strings; empty means it
 * type-checks. Module resolution starts from `projectDir`, so it sees the same
 * node_modules the run step will.
 */
export function findTypeErrors(code: string, projectDir: string = process.cwd()): string[] {
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
    if (!source) return ["generated suite could not be loaded for checking"];

    return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => {
            const { line, character } = source.getLineAndCharacterOfPosition(d.start ?? 0);
            return `${line + 1}:${character + 1} TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
        });
}

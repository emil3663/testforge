import ts from "typescript";

/**
 * Phase 42 (TFP-202, batch 2 ruling 5): what model-written test code may not
 * use. A gap test, a pool candidate or a promoted library entry is a test
 * body a writer produced from text read from a site, and it runs in Node on
 * Emil's machine. TFP-194's check was a regular expression over the text
 * (`require(`, `process.`, `fs.`...): spacing, a line break or a computed
 * name got past it, and it said nothing about the network.
 *
 * The body is now parsed (TypeScript's parser, as a function body) and its
 * syntax tree walked, so a comment doesn't count and spacing doesn't hide
 * anything. It is refused when it:
 * - imports anything, or reaches for Node: `require`, `import(...)`,
 *   `import.meta`, `process`, `child_process`, `module`, `Buffer`,
 *   `global`/`globalThis`;
 * - runs code built at run time: `eval`, `Function`, a `constructor`
 *   (`[].constructor.constructor` is Function), `Reflect`, `Proxy`;
 * - talks to the network other than through the page: `fetch`,
 *   `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, and any
 *   `request` call other than `.request.get(...)` (Playwright's API client
 *   runs in Node, outside the request guard);
 * - steps around the guard: `route`/`unroute` (and their kin), which would
 *   take over or remove the guard's own route, `exposeBinding`/
 *   `exposeFunction` (a door from the page into Node), and `context()`,
 *   `newPage`, `newContext`, `browser` (a page the guard isn't armed on);
 * - reaches the scope around it: `arguments` (the module wrapper's, whose
 *   second is `require`) and `this`;
 * - reaches a prototype or a property by a name it builds: the
 *   `Object.getPrototypeOf`/`getOwnPropertyDescriptor` family and
 *   `__proto__`, a computed name (`page[name]`, `{ [name]: x }`: only a
 *   number may go in brackets), or one of the names on this list quoted as
 *   a property name (`const { 'constructor': c } = x`), so none of them can
 *   be spelled in parts or quoted. A string elsewhere is text: a link may be
 *   called "browser".
 *
 * Inside `page.evaluate` the code runs in the browser, under the guard; it is
 * held to the same list, as the writer is told, so one rule covers both.
 * This narrows what a test can do; it is not a sandbox (that is the Docker
 * follow-up for the post-Phase 42 review).
 */

const FORBIDDEN_NAMES = new Set([
    "require", "process", "child_process", "module", "exports", "Buffer", "global", "globalThis", "__dirname", "__filename",
    "eval", "Function", "constructor", "Reflect", "Proxy", "WebAssembly", "Worker", "SharedWorker",
    "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon",
    "route", "unroute", "unrouteAll", "routeFromHAR", "routeWebSocket", "exposeBinding", "exposeFunction",
    "context", "newPage", "newContext", "browser",
    "arguments", "__proto__", "getPrototypeOf", "setPrototypeOf", "getOwnPropertyDescriptor", "getOwnPropertyDescriptors", "getOwnPropertyNames",
    "defineProperty", "defineProperties", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
]);

/** A string standing for a property's name: `{ 'a': x }`, or `const { 'a': x } = y`. */
function namesProperty(node: ts.Node): boolean {
    const parent = node.parent;
    return (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isBindingElement(parent) && parent.propertyName === node);
}

/** Why the body is refused, naming the construct, or null when it uses none of the above. */
export function forbiddenConstruct(body: string): string | null {
    const source = ts.createSourceFile("__testforge_body__.ts", `async function __body__() {\n${body}\n}`, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    let found: string | null = null;
    const visit = (node: ts.Node): void => {
        if (found) return;
        if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node)) found = "an import";
        else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) found = "import(...)";
        else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) found = "import.meta";
        else if (ts.isIdentifier(node) && FORBIDDEN_NAMES.has(node.text)) found = node.text;
        else if (ts.isStringLiteralLike(node) && FORBIDDEN_NAMES.has(node.text) && namesProperty(node)) found = `'${node.text}'`;
        else if (node.kind === ts.SyntaxKind.ThisKeyword) found = "this";
        else if (ts.isElementAccessExpression(node) && !ts.isNumericLiteral(node.argumentExpression)) found = "a computed property name (only a number may go in brackets)";
        else if (ts.isComputedPropertyName(node) && !ts.isNumericLiteral(node.expression)) found = "a computed property name (only a number may go in brackets)";
        else if (ts.isPropertyAccessExpression(node) && node.name.text === "request") {
            // `x.request.get(...)` is a GET through Playwright's API client; any other use of it is not.
            const parent = node.parent;
            const isGet = ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === "get" && ts.isCallExpression(parent.parent) && parent.parent.expression === parent;
            if (!isGet) found = "a request other than GET (request.get only)";
        } else if (ts.isIdentifier(node) && node.text === "request" && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
            // `const { request } = page` would take the client out of `.request.get`'s reach.
            found = "request, other than as page.request.get(...)";
        }
        if (!found) ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

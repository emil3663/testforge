/**
 * TFP-096: parseNamedFlowLines - the "Named flows" input's parser.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/app/_lib/derive.test.ts
 */
import assert from "node:assert";
import { test } from "node:test";
import { normalizeNamedFlows } from "../../lib/introspect/journeys.ts";
import { parseNamedFlowLines } from "./derive.ts";

test("one flow per line, label: /entry -> /exit", () => {
    assert.deepStrictEqual(parseNamedFlowLines("checkout: /cart -> /confirmation").flows, [
        { label: "checkout", entryPath: "/cart", exitPath: "/confirmation" },
    ]);
});

test("accepts => and the arrow character, tolerates spacing, and adds a missing leading slash", () => {
    const { flows, invalidLines } = parseNamedFlowLines("a:/x=>/y\nb :  z   \u2192   w  \n  c: /p ->/q");

    assert.deepStrictEqual(flows, [
        { label: "a", entryPath: "/x", exitPath: "/y" },
        { label: "b", entryPath: "/z", exitPath: "/w" },
        { label: "c", entryPath: "/p", exitPath: "/q" },
    ]);
    assert.deepStrictEqual(invalidLines, []);
});

test("a label may contain a comma (lists are split on newlines only)", () => {
    assert.deepStrictEqual(parseNamedFlowLines("sign up, then verify: /signup -> /welcome").flows[0].label, "sign up, then verify");
});

test("a line that is not understood is reported, not silently dropped; blank lines are ignored", () => {
    const { flows, invalidLines } = parseNamedFlowLines("ok: /a -> /b\n\nno arrow here\n: /a -> /b\nmissing: /a ->\n");

    assert.strictEqual(flows.length, 1);
    assert.deepStrictEqual(invalidLines, ["no arrow here", ": /a -> /b", "missing: /a ->"]);
});

test("empty input is no flows and no errors", () => {
    assert.deepStrictEqual(parseNamedFlowLines(""), { flows: [], invalidLines: [] });
});

// The UI parses first and the server re-validates: a parsed flow must survive
// the server's normalization unchanged, or the UI would show one thing and
// send another.
test("a parsed flow is unchanged by the server-side normalizeNamedFlows", () => {
    const { flows } = parseNamedFlowLines("login: /login -> /secure\ncheckout: cart -> confirmation");

    assert.deepStrictEqual(normalizeNamedFlows(flows), flows);
});

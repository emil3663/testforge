/**
 * TFP-274 (CodeQL #6133): the crawl queues only http and https pages on its own origin, by an allowlist of schemes.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/pipeline/crawl.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldQueueUrl } from "./crawl.ts";

const ORIGIN = "http://localhost:4200";
const queued = (href: string, origin = ORIGIN) => shouldQueueUrl(new URL(href, `${ORIGIN}/`), origin);

test("only http and https pages on the crawl's origin are queued", () => {
    assert.equal(queued("/contact"), true);
    assert.equal(queued("/#/contact"), true);
    assert.equal(shouldQueueUrl(new URL("https://localhost:4443/a"), "https://localhost:4443"), true);

    for (const href of ["vbscript:msgbox(1)", "javascript:void(0)", "mailto:a@b.c", "tel:123", "data:text/html,x", "file:///etc/passwd", "foo:bar", "http://elsewhere.test/"]) {
        assert.equal(queued(href), false, href);
    }
    assert.equal(queued("/manual.pdf"), false, "a file, not a page");
});

// The origin check refuses every non-http(s) URL first on a real crawl (its origin is always http or https), so this
// holds the scheme check to the allowlist on its own: a URL whose origin is "null" gets past the origin comparison.
test("the scheme check alone refuses anything but http and https", () => {
    for (const href of ["vbscript:msgbox(1)", "foo:bar", "file:///etc/passwd", "javascript:void(0)"]) {
        assert.equal(new URL(href).origin, "null");
        assert.equal(queued(href, "null"), false, href);
    }
});

/**
 * TFP-094: the run redactor - value-based scrubbing of text and trace zips,
 * the structural storageState drop, and failing closed.
 *
 * The end-to-end proof (a real authenticated run whose report, persisted
 * evidence and trace are grepped for the secrets) is
 * tests/regression/testforge.auth.spec.ts; these pin the redactor's own
 * properties, including the ones that would otherwise only show up as a leak.
 *
 * Run via:
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/lib/run/redact.test.ts
 */
import assert from "node:assert";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildRedactor, readZipEntries, redactDeep, REDACTED, scrubArtifactDirectory, scrubZipBuffer, secretsFromStorageState } from "./redact.ts";

const SESSION = "s3ss10n-Token+with/odd=chars-9f8e7d";
const PASSWORD = 'p@ss"word\\with-quote';

function makeZip(entries: Record<string, Buffer | string>): Promise<Buffer> {
    const require = createRequire(import.meta.url);
    const { yazl } = require("playwright-core/lib/zipBundle");

    return new Promise((resolve, reject) => {
        const zip = new yazl.ZipFile();
        const chunks: Buffer[] = [];
        zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        zip.outputStream.on("error", reject);
        zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
        for (const [name, data] of Object.entries(entries)) {
            zip.addBuffer(Buffer.isBuffer(data) ? data : Buffer.from(data), name, { mtime: new Date("2026-01-01T00:00:00Z") });
        }
        zip.end();
    });
}

test("a secret is redacted in every form it can be captured in: raw, JSON-escaped, and percent-encoded", () => {
    const { redact } = buildRedactor([SESSION, PASSWORD]);

    for (const text of [
        `token=${SESSION}`,
        `{"value":"${JSON.stringify(SESSION).slice(1, -1)}"}`,
        `Cookie: sid=${encodeURIComponent(SESSION)}`,
        `password is ${PASSWORD}`,
        `{"password":"${JSON.stringify(PASSWORD).slice(1, -1)}"}`,
    ]) {
        const out = redact(text);
        assert.ok(out.includes(REDACTED), text);
        for (const secret of [SESSION, PASSWORD, encodeURIComponent(SESSION), JSON.stringify(PASSWORD).slice(1, -1)]) {
            assert.ok(!out.includes(secret), `${secret} survived in: ${out}`);
        }
    }
});

test("a value too short to redact meaningfully is left alone, and nothing else is disturbed", () => {
    const { redact, isEmpty } = buildRedactor(["abc", ""]);

    assert.strictEqual(isEmpty, true);
    assert.strictEqual(redact("abc and everything else"), "abc and everything else");
});

test("a secret containing another is replaced whole, not left half-redacted", () => {
    const { redact } = buildRedactor(["session-1234", "session-1234-extended-value"]);

    assert.strictEqual(redact("x session-1234-extended-value y"), `x ${REDACTED} y`);
});

test("secretsFromStorageState collects cookie and web-storage values, never names", () => {
    const secrets = secretsFromStorageState({
        cookies: [{ name: "sid", value: "cookie-value-1" }],
        origins: [{ origin: "https://a.example", localStorage: [{ name: "jwt", value: "local-value-2" }] }],
    });

    assert.deepStrictEqual(secrets, ["cookie-value-1", "local-value-2"]);
    assert.deepStrictEqual(secretsFromStorageState(null), []);
    assert.deepStrictEqual(secretsFromStorageState({ cookies: "nope" }), []);
});

test("redactDeep scrubs nested strings and drops any storageState key outright, even one whose values were never registered", () => {
    const redactor = buildRedactor([SESSION]);
    const out = redactDeep(
        {
            message: `failed with ${SESSION}`,
            nested: [{ deep: `x${SESSION}y`, storageState: { cookies: [{ value: "never-registered-value" }] } }],
            storageState: { cookies: [] },
            number: 7,
        },
        redactor
    );

    assert.deepStrictEqual(out, { message: `failed with ${REDACTED}`, nested: [{ deep: `x${REDACTED}y` }], number: 7 });
});

test("a trace zip is rewritten with every text entry scrubbed, entries kept, and binary entries untouched", async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from(SESSION), Buffer.from([0, 1, 2])]);
    const zip = await makeZip({
        "0-trace.trace": `{"type":"context-options","options":{"storageState":{"cookies":[{"value":"${SESSION}"}]}}}\n{"type":"input","params":{"value":"${JSON.stringify(PASSWORD).slice(1, -1)}"}}`,
        "0-trace.network": `{"headers":[{"name":"cookie","value":"sid=${encodeURIComponent(SESSION)}"}]}`,
        "resources/page.html": `<input value="${SESSION}">`,
        "resources/shot.png": png,
        "resources/clean.txt": "nothing secret here",
    });

    const { changed, buffer } = await scrubZipBuffer(zip, buildRedactor([SESSION, PASSWORD]));
    const entries = await readZipEntries(buffer);
    const byName = Object.fromEntries(entries.map((entry) => [entry.name, entry.data]));

    assert.strictEqual(changed, true);
    assert.deepStrictEqual(entries.map((entry) => entry.name).sort(), ["0-trace.network", "0-trace.trace", "resources/clean.txt", "resources/page.html", "resources/shot.png"]);
    for (const name of ["0-trace.trace", "0-trace.network", "resources/page.html"]) {
        const text = byName[name].toString("utf8");
        assert.ok(text.includes(REDACTED), name);
        assert.ok(!text.includes(SESSION) && !text.includes(encodeURIComponent(SESSION)) && !text.includes(JSON.stringify(PASSWORD).slice(1, -1)), `${name} still holds a secret`);
    }
    assert.strictEqual(byName["resources/clean.txt"].toString(), "nothing secret here");
    assert.ok(byName["resources/shot.png"].equals(png), "a binary entry must be left byte-for-byte alone");
});

test("a zip with nothing to scrub is returned unchanged", async () => {
    const zip = await makeZip({ "a.trace": "clean" });
    const result = await scrubZipBuffer(zip, buildRedactor([SESSION]));

    assert.strictEqual(result.changed, false);
    assert.ok(result.buffer.equals(zip));
});

test("scrubArtifactDirectory scrubs text in place, rewrites zips, removes what it cannot scrub, and fails closed on a corrupt zip", async () => {
    const dir = mkdtempSync(join(tmpdir(), "testforge-redact-"));

    try {
        const evidence = join(dir, "test-1");
        mkdirSync(evidence);
        writeFileSync(join(evidence, "error-context.md"), `snapshot ${SESSION} end`);
        writeFileSync(join(evidence, "trace.zip"), await makeZip({ "0-trace.trace": `{"v":"${SESSION}"}` }));
        writeFileSync(join(evidence, "shot.png"), Buffer.concat([Buffer.from(SESSION), Buffer.from([1, 2])]));
        writeFileSync(join(evidence, "data.bin"), Buffer.from(`xx${SESSION}xx`));
        writeFileSync(join(evidence, "clean.bin"), Buffer.from("no secret"));
        writeFileSync(join(evidence, "broken.zip"), Buffer.from("this is not a zip file"));

        const notes = await scrubArtifactDirectory(dir, buildRedactor([SESSION]));
        const byFile = Object.fromEntries(notes.map((note) => [note.file.split(/[\\/]/).pop(), note.action]));

        assert.deepStrictEqual(byFile, { "error-context.md": "scrubbed", "trace.zip": "scrubbed", "data.bin": "removed", "broken.zip": "removed" });
        assert.ok(!readFileSync(join(evidence, "error-context.md"), "utf8").includes(SESSION));
        assert.ok(!existsSync(join(evidence, "data.bin")), "an unscrubbable file holding a secret must not be kept");
        assert.ok(!existsSync(join(evidence, "broken.zip")), "a zip that cannot be read must not be kept unscrubbed");
        assert.ok(existsSync(join(evidence, "clean.bin")), "a clean file is left alone");
        assert.ok(existsSync(join(evidence, "shot.png")), "a screenshot is not text and is left alone");
        assert.ok(!(await readZipEntries(readFileSync(join(evidence, "trace.zip")))).some((entry) => entry.data.toString().includes(SESSION)));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("with nothing to redact, scrubArtifactDirectory touches nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "testforge-redact-"));

    try {
        writeFileSync(join(dir, "note.md"), "whatever");
        assert.deepStrictEqual(await scrubArtifactDirectory(dir, buildRedactor([])), []);
        assert.strictEqual(readFileSync(join(dir, "note.md"), "utf8"), "whatever");
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

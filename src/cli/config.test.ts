/**
 * Phase 47 (TFP-245): `testforge run`'s configuration. A malformed one is exit 3 with a message naming the field
 * (Decision 5); a valid one is what was asked, with the UI's defaults where nothing was.
 *
 * node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types --test src/cli/config.test.ts
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { buildConfig, ConfigError, loadConfig, parseFlags } from "./config.ts";

const CWD = resolve("/work");

test("flags alone: the URL normalised, Standard, all ten areas, fast, nothing interactive, ./mr-onion-out", () => {
    const config = buildConfig({}, parseFlags(["--url", "localhost:4200/"]).raw, CWD);
    assert.equal(config.url, "http://localhost:4200");
    assert.deepEqual(config.runMode, { kind: "standard" });
    assert.equal(config.practices.length, 10);
    assert.equal(config.auditMode, "fast");
    assert.equal(config.interactive, false);
    assert.equal(config.reportOnly, false);
    assert.equal(config.out, resolve(CWD, "mr-onion-out"));
    assert.equal(config.dataDir, null);
    assert.deepEqual(config.servers, []);
});

test("--server and --port pair up in order, and a flag wins over the config file", () => {
    const { raw } = parseFlags(["--url", "http://localhost:3000", "--server", "npm run api", "--port", "8091", "--server", "npm start", "--port", "4200", "--practices", "functional, security", "--report-only"]);
    const config = buildConfig({ practices: ["database"], auditMode: "deep", url: "http://elsewhere.test" }, raw, CWD);
    assert.deepEqual(config.servers, [{ command: "npm run api", port: 8091 }, { command: "npm start", port: 4200 }]);
    assert.deepEqual(config.practices, ["functional", "security"]);
    assert.equal(config.auditMode, "deep", "the file's field stands where no flag was given");
    assert.equal(config.url, "http://localhost:3000");
    assert.equal(config.reportOnly, true);
});

test("Comprehensive takes its area and page cap; its practices are that area's", () => {
    const config = buildConfig({}, parseFlags(["--url", "http://localhost:4200", "--mode", "comprehensive", "--area", "accessibility", "--page-cap", "5"]).raw, CWD);
    assert.deepEqual(config.runMode, { kind: "comprehensive", area: "accessibility", level: null, pageCap: 5 });
});

// Each malformed input, and the field its message must name.
const MALFORMED: Array<[string, () => unknown, string]> = [
    ["no URL", () => buildConfig({}, {}, CWD), "url"],
    ["an unknown area", () => buildConfig({}, { url: "http://a.test", practices: ["functional", "speed"] }, CWD), "practices[1]"],
    ["an unknown mode", () => buildConfig({}, { url: "http://a.test", mode: "quick" }, CWD), "mode"],
    ["an area on a Standard run", () => buildConfig({}, { url: "http://a.test", area: "security" }, CWD), "area"],
    ["an unknown Comprehensive area", () => buildConfig({}, { url: "http://a.test", mode: "comprehensive", area: "seo" }, CWD), "area"],
    ["a page cap out of range", () => buildConfig({}, { url: "http://a.test", mode: "comprehensive", area: "security", pageCap: 500 }, CWD), "pageCap"],
    ["an unknown audit mode", () => buildConfig({}, { url: "http://a.test", auditMode: "slow" }, CWD), "auditMode"],
    ["interactive as a string", () => buildConfig({}, { url: "http://a.test", interactive: "yes" }, CWD), "interactive"],
    ["a password inline in login", () => buildConfig({}, { url: "http://a.test", login: { loginUrl: "/login", usernameEnv: "U", passwordEnv: "P", password: "hunter2" } }, CWD), "login"],
    ["a server with no port", () => buildConfig({}, { url: "http://a.test", servers: [{ command: "npm start" }] }, CWD), "servers[0].port"],
    ["a server with an extra field", () => buildConfig({}, { url: "http://a.test", servers: [{ command: "npm start", port: 3000, cwd: "app" }] }, CWD), "servers[0].cwd"],
    ["a page that isn't a string", () => buildConfig({}, { url: "http://a.test", pages: ["/", 7] }, CWD), "pages[1]"],
    ["--port before any --server", () => parseFlags(["--port", "80"]), "--port"],
    ["an unknown flag", () => parseFlags(["--url", "http://a.test", "--headed"]), "--headed"],
    ["a flag with no value", () => parseFlags(["--url"]), "--url"],
    ["a port that isn't a number", () => parseFlags(["--server", "npm start", "--port", "eighty"]), "--port"],
];

for (const [name, attempt, field] of MALFORMED) {
    test(`malformed: ${name} is a ConfigError naming ${field}`, () => {
        assert.throws(attempt, (error: unknown) => error instanceof ConfigError && error.field === field && error.message.startsWith(`${field}: `));
    });
}

test("the config file: an unknown field, bad JSON and a missing file are each named", async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "tfp245-config-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    await writeFile(join(dir, "extra.json"), JSON.stringify({ url: "http://a.test", workers: 8 }));
    await writeFile(join(dir, "broken.json"), "{ \"url\": ");
    await writeFile(join(dir, "good.json"), JSON.stringify({ url: "http://a.test", out: "reports", dataDir: "state" }));

    await assert.rejects(loadConfig(["--config", "extra.json"], dir), (error: unknown) => error instanceof ConfigError && error.field === "workers");
    await assert.rejects(loadConfig(["--config", "broken.json"], dir), (error: unknown) => error instanceof ConfigError && error.field === "--config" && /not valid JSON/.test(error.message));
    await assert.rejects(loadConfig(["--config", "missing.json"], dir), (error: unknown) => error instanceof ConfigError && error.field === "--config" && /could not read/.test(error.message));

    const good = await loadConfig(["--config", "good.json"], dir);
    assert.equal(good.out, join(dir, "reports"), "paths in the file resolve against the folder the command ran in");
    assert.equal(good.dataDir, join(dir, "state"));
});

test("TFP-246: --baseline is a run.json, resolved like --out, or \"latest\"", () => {
    const flags = (...rest: string[]) => buildConfig({}, parseFlags(["--url", "http://localhost:3000", ...rest]).raw, CWD);
    assert.equal(flags().baseline, null);
    assert.equal(flags("--baseline", "latest").baseline, "latest");
    assert.equal(flags("--baseline", "previous/run.json").baseline, resolve(CWD, "previous/run.json"));
    assert.equal(buildConfig({ url: "http://localhost:3000", baseline: "latest" }, {}, CWD).baseline, "latest", "a config file field too");
    assert.throws(() => flags("--baseline", " "), (error: unknown) => error instanceof ConfigError && error.field === "baseline");
    assert.throws(() => buildConfig({ url: "http://localhost:3000", baseline: 3 }, {}, CWD), (error: unknown) => error instanceof ConfigError && error.field === "baseline");
});

// Phase 39 Gate B: Standard's inspection, made once per copy and given to every variant (generate.mts), so the
// variants differ only in their generator. Inspection is not changed by TFP-212, TFP-213 or TFP-215.
// Usage (from the repo root): node --import ./scripts/register-node-test-ts-resolver.mjs --experimental-strip-types <this> <label> <site> <dir>
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { inspectPages } = await import(pathToFileURL(join(process.cwd(), "src/lib/introspect/inspector.ts")).href);
const [label, site, dir] = process.argv.slice(2);
const origin = site.replace(/\/$/, "");
const selection = JSON.parse(await readFile(join(dir, `${label}-selection.json`), "utf8"));
const profile = { scannedAt: new Date().toISOString(), baseUrl: origin, ...(await inspectPages(origin, selection.standard.pages)) };
await writeFile(join(dir, `${label}-standard-profile.json`), JSON.stringify(profile, null, 2), "utf8");
console.log(`${label}: inspected ${selection.standard.pages.length} pages`);

// Live check for TFP-083: what does the real OpenAI account actually offer,
// and which entry of OPENAI_MODEL_CANDIDATES would /api/generate pick today?
//
//   $env:OPENAI_API_KEY = "sk-..."; npm run check:openai-models
//
// Step 1 lists the catalog (free). Step 2 sends one tiny completion to the
// chosen candidate using the SAME request shape as the route (temperature
// 0.2 included - some newer model families reject it, and that would make
// the route fall back every time), costing a fraction of a cent.
// The key is read from the environment and never printed.
import OpenAI from "openai";
import { OPENAI_MODEL_CANDIDATES, pickModel } from "../src/lib/generate/models.ts";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error("OPENAI_API_KEY is not set.");
    process.exit(2);
}

const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 30_000 });

const catalog = (await client.models.list()).data.map((m) => m.id).sort();
console.log(`Live catalog: ${catalog.length} models`);
console.log(catalog.map((id) => `  ${id}`).join("\n"));

console.log("\nCandidates (in priority order):");
for (const id of OPENAI_MODEL_CANDIDATES) {
    console.log(`  ${catalog.includes(id) ? "PRESENT" : "absent "}  ${id}`);
}

const picked = pickModel(catalog);
if (!picked) {
    console.log("\nNo candidate is in the live catalog: /api/generate would fall back to the template.");
    console.log("Edit src/lib/generate/models.ts using the catalog above, then re-run.");
    process.exit(1);
}

console.log(`\nRoute would pick: ${picked}. Sending one minimal completion...`);
try {
    const started = Date.now();
    const chat = await client.chat.completions.create({
        model: picked,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        temperature: 0.2,
    });
    console.log(`OK in ${Date.now() - started}ms; resolved model: ${chat.model}; reply: ${JSON.stringify(chat.choices[0]?.message?.content)}`);
} catch (error) {
    console.log(`FAILED: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
}

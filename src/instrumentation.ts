/**
 * Runs once when the Next.js server starts. The only thing wired here is
 * napi, Lighthouse's optional record of TestForge's runs (docs/NAPI.md), and
 * only on the Node runtime; unconfigured, it logs one line and does nothing.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { bootNapi } = await import("./lib/napi/boot.ts");
        bootNapi();
    }
}

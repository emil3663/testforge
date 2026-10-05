// TFP-152 evidence: the rizonetech.com logo link (TFAC-007) - its markup,
// Playwright's computed name and role, and Chromium's own AX tree (CDP).
// One page load, read-only. Optional argv[2]: a local URL to inspect instead.
// The link: the first <a> whose resolved href is the site's home and which
// holds an <img> - the logo, as TFP-145's lookup finds it by href. (The
// page's first a[href] is a skip link.)
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://rizonetech.com/";
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const index = await page.locator("a").evaluateAll((links, home) => links.findIndex((a) => a.href === home && a.querySelector("img")), new URL("/", url).href);
    if (index < 0) throw new Error("no home link holding an image");
    const link = page.locator("a").nth(index);
    console.log("link index among <a>:", index);
    console.log("url:", url, "| playwright", createRequire(import.meta.url)("@playwright/test/package.json").version, "| chromium", browser.version());
    console.log("outerHTML:", (await link.evaluate((a) => a.outerHTML)).replace(/\s+/g, " ").slice(0, 600));
    console.log("ariaSnapshot:", JSON.stringify((await link.ariaSnapshot()).trim()));
    let name = "";
    try { await (await import("@playwright/test")).expect(link).toHaveAccessibleName(/.+/, { timeout: 2000 }); name = "(has a name)"; } catch { name = "(no name)"; }
    console.log("toHaveAccessibleName(/.+/):", name);

    const cdp = await page.context().newCDPSession(page);
    const { node } = await cdp.send("DOM.describeNode", { objectId: (await cdp.send("Runtime.evaluate", { expression: `document.querySelectorAll('a')[${index}]` })).result.objectId });
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { backendNodeId: node.backendNodeId, fetchRelatives: false });
    for (const ax of nodes) {
        console.log("CDP AX:", JSON.stringify({ role: ax.role?.value, name: ax.name?.value, nameSources: (ax.name?.sources ?? []).filter((s) => s.value || s.attributeValue).map((s) => ({ type: s.type, attribute: s.attribute, value: s.value?.value ?? s.attributeValue?.value, superseded: s.superseded })), ignored: ax.ignored }));
    }
    const imgs = await link.locator("img").evaluateAll((list) => list.map((img) => ({ alt: img.getAttribute("alt"), title: img.getAttribute("title"), hasAlt: img.hasAttribute("alt") })));
    console.log("images in the link:", JSON.stringify(imgs), "| link title:", JSON.stringify(await link.getAttribute("title")), "| aria-label:", JSON.stringify(await link.getAttribute("aria-label")));
} finally {
    await browser.close();
}

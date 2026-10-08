// Phase 41 (TFP-180, Decision 0): is each target bug on the running local copy, in Chromium?
// One read-only check per bug: page loads in Chromium (the browser TestForge runs) and GETs to
// the API. The one interaction is clicking the product page's "+", which changes nothing on the
// server. Run against both copies: with-bugs to see each bug, clean as the control.
// Usage (from the repo root, with one local copy running - scripts/toolshop-local/start-toolshop.ps1):
//   node --experimental-strip-types benchmarks/2026-10-07-phase41-local/presence-probe.mts <with-bugs|clean> <out.json>
import { writeFile } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";

const [version, out] = process.argv.slice(2);
if (version !== "with-bugs" && version !== "clean") throw new Error("usage: presence-probe.mts <with-bugs|clean> <out.json>");
const APP = "http://localhost:4200";
const API = "http://localhost:8091";
// with-bugs routes by hash, clean by path, as their hosted sites do.
const route = (path: string) => (version === "with-bugs" ? `${APP}/#${path}` : `${APP}${path}`);

const browser = await chromium.launch();
const context = await browser.newContext();
const results: Record<string, { shows: boolean; reading: string }> = {};

async function open(path: string) {
    const page = await context.newPage();
    await page.goto(route(path), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    return page;
}
async function check(id: string, path: string | null, probe: (page: Page) => Promise<{ shows: boolean; reading: string }>) {
    const page = path === null ? null : await open(path);
    try {
        results[id] = await probe(page as Page);
    } catch (error) {
        results[id] = { shows: false, reading: `probe failed: ${error instanceof Error ? error.message.split("\n")[0] : error}` };
    } finally {
        await page?.close();
    }
}
const style = (page: Page, selector: string, property: string) => page.locator(selector).first().evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);

// Home and its product request (27 sends the minimum price only).
const homeRequests: string[] = [];
context.on("request", (request) => {
    if (request.url().startsWith(API) && /products/.test(request.url())) homeRequests.push(request.url());
});
await check("26 home product images hidden", "/", async (page) => {
    const hidden = await page.locator(".card-img-top.d-none").count();
    return { shows: hidden > 0, reading: `${hidden} product images with d-none` };
});
await check("27 price filter sends no maximum", null, async () => {
    const between = homeRequests.map((url) => new URL(url).searchParams.get("between")).filter(Boolean);
    return { shows: between.length > 0 && between.every((value) => !/,\d+,\d+$/.test(value!)), reading: `between=${between.join(" | ") || "(none)"}` };
});
await check("29 Home link leads to contact", "/", async (page) => {
    const href = await page.locator('[data-test="nav-home"]').getAttribute("href");
    return { shows: /contact/.test(href ?? ""), reading: `nav-home href=${href}` };
});
await check("31 Contakt", "/", async (page) => {
    const text = (await page.locator('[data-test="nav-contact"]').textContent())?.trim();
    return { shows: text === "Contakt", reading: `nav-contact "${text}"` };
});
await check("33 Sorth", "/", async (page) => {
    const n = await page.getByText("Sorth", { exact: true }).count();
    return { shows: n > 0, reading: `"Sorth" ${n}x` };
});
await check("34 Serch", "/", async (page) => {
    const text = (await page.locator('[data-test="search-submit"]').textContent())?.trim();
    return { shows: text === "Serch", reading: `search-submit "${text}"` };
});
await check("94 no fieldset for filters", "/", async (page) => {
    const n = await page.locator("fieldset").count();
    return { shows: n === 0, reading: `${n} fieldsets` };
});

// Category.
await check("2 sort reversed", "/category/hand-tools", async (page) => {
    const value = await page.locator("select option", { hasText: "Name (A - Z)" }).first().getAttribute("value").catch(() => null);
    return { shows: value === "name,desc", reading: `"Name (A - Z)" value=${value}` };
});
await check("4 product names right-aligned", "/category/hand-tools", async (page) => {
    const n = await page.locator(".card-title.text-end, [data-test=product-name].text-end").count();
    return { shows: n > 0, reading: `${n} names with text-end (random per draw)` };
});

// Product detail.
const product = version === "with-bugs" ? "/product/1" : null;
let cleanProduct = product;
if (!cleanProduct) {
    const listing = await (await fetch(`${API}/products?page=1`)).json() as { data: Array<{ id: string }> };
    cleanProduct = `/product/${listing.data[0].id}`;
}
await check("40 +/- don't change the quantity", cleanProduct, async (page) => {
    const before = await page.locator('[data-test="quantity"]').inputValue();
    await page.locator("#btn-increase-quantity").click();
    const after = await page.locator('[data-test="quantity"]').inputValue();
    return { shows: before === after, reading: `quantity ${before} -> ${after} after "+"` };
});
await check("42 Reltded products", cleanProduct, async (page) => {
    const n = await page.getByText("Reltded products").count();
    return { shows: n > 0, reading: `"Reltded products" ${n}x` };
});
await check("45 buttons overlap", cleanProduct, async (page) => {
    const cart = await page.locator("#btn-add-to-cart").boundingBox();
    const favourite = await page.locator("#btn-add-to-favorites").boundingBox();
    // More than 8 px, not a touch: on the clean copy the two buttons share a 1 px edge.
    const across = cart && favourite ? Math.min(cart.x + cart.width, favourite.x + favourite.width) - Math.max(cart.x, favourite.x) : 0;
    const down = cart && favourite ? Math.min(cart.y + cart.height, favourite.y + favourite.height) - Math.max(cart.y, favourite.y) : 0;
    return { shows: across > 8 && down > 8, reading: `the buttons overlap ${Math.max(0, Math.round(across))} px across, ${Math.max(0, Math.round(down))} px down` };
});

// Rentals.
await check("49 rentals titles centred", "/rentals", async (page) => {
    const n = await page.locator(".card-title.text-center").count();
    return { shows: n > 0, reading: `${n} card titles with text-center` };
});

// Login and forgot-password.
await check("19 login email padding", "/auth/login", async (page) => {
    const padding = await style(page, "#email", "padding-left");
    return { shows: padding === "0px", reading: `#email padding-left ${padding}` };
});
await check("22 forgot-password button font", "/auth/forgot-password", async (page) => {
    const font = await style(page, 'input[type="submit"], [data-test="forgot-password-submit"]', "font-family");
    return { shows: /comic/i.test(font), reading: `submit font-family ${font}` };
});
await check("23 forgot-password email padding", "/auth/forgot-password", async (page) => {
    const padding = await style(page, "#email", "padding-left");
    return { shows: padding === "0px", reading: `#email padding-left ${padding}` };
});

// Register.
await check("53 register tab order", "/auth/register", async (page) => {
    const order = await page.locator("[tabindex]").evaluateAll((nodes) => nodes.map((node) => `${node.id || node.getAttribute("data-test")}:${node.getAttribute("tabindex")}`));
    const values = order.map((entry) => Number(entry.split(":").pop())).filter((n) => n > 0);
    const sequential = values.every((value, index) => index === 0 || value > values[index - 1]);
    const gaps = values.some((value, index) => index > 0 && value - values[index - 1] > 1);
    return { shows: !sequential || gaps, reading: order.join(" ") };
});
await check("54 phone placeholder typo", "/auth/register", async (page) => {
    const placeholder = await page.locator("#phone").getAttribute("placeholder");
    return { shows: !/^Your phone \*?$/.test(placeholder ?? ""), reading: `#phone placeholder "${placeholder}"` };
});
await check("58 register button width", "/auth/register", async (page) => {
    const width = await page.locator('[data-test="register-submit"]').evaluate((node) => (node as HTMLElement).style.width);
    return { shows: width === "unset", reading: `register-submit style.width "${width}"` };
});
await check("59 smaller font for some country options", "/auth/register", async (page) => {
    const smaller = await page.locator("#country option").evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).style.fontSize === "smaller").map((node) => node.textContent?.trim()));
    return { shows: smaller.length > 0, reading: `smaller: ${smaller.join(", ") || "none"}` };
});

// Contact.
await check("60 subject list shows error entries", "/contact", async (page) => {
    const errors = await page.locator("#subject option").evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? "").filter((text) => /^Error \d+/.test(text)));
    return { shows: errors.length > 0, reading: errors.join(" | ") || "none" };
});
await check("62 message placeholder typo", "/contact", async (page) => {
    const placeholder = await page.locator("#message").getAttribute("placeholder");
    return { shows: placeholder === "Massage", reading: `#message placeholder "${placeholder}"` };
});
await check("63 attachment label font", "/contact", async (page) => {
    const font = await style(page, 'label[for="attachment"]', "font-family");
    return { shows: /comic/i.test(font), reading: `attachment label font-family ${font}` };
});
await check("66 contact button width", "/contact", async (page) => {
    const width = await page.locator('[data-test="contact-submit"]').evaluate((node) => (node as HTMLElement).style.width);
    return { shows: width === "unset", reading: `contact-submit style.width "${width}"` };
});
await check("67 smaller font for some subject options", "/contact", async (page) => {
    const smaller = await page.locator("#subject option").evaluateAll((nodes) => nodes.filter((node) => (node as HTMLElement).style.fontSize === "smaller").map((node) => node.textContent?.trim()));
    return { shows: smaller.length > 0, reading: `smaller: ${smaller.join(", ") || "none"}` };
});

// API (GET only).
await check("75 products API exposes stock", null, async () => {
    const listing = await (await fetch(`${API}/products?page=1`)).json() as { data: Array<Record<string, unknown>> };
    const keys = Object.keys(listing.data[0] ?? {});
    return { shows: keys.includes("stock"), reading: `product fields: ${keys.join(", ")}` };
});
await check("80 log file reachable", null, async () => {
    const response = await fetch(`${API}/logs/laravel.log`);
    return { shows: response.status === 200, reading: `GET /logs/laravel.log -> ${response.status}` };
});
await check("82 sequential ids", null, async () => {
    const listing = await (await fetch(`${API}/products?page=1`)).json() as { data: Array<{ id: unknown }> };
    const ids = listing.data.slice(0, 5).map((item) => String(item.id));
    return { shows: ids.every((id) => /^\d+$/.test(id)), reading: `ids: ${ids.join(", ")}` };
});

await browser.close();
await writeFile(out, JSON.stringify({ version, app: APP, api: API, probedAt: new Date().toISOString(), results }, null, 2) + "\n");
for (const [id, result] of Object.entries(results)) console.log(`${result.shows ? "SHOWS " : "absent"}  ${id.padEnd(42)} ${result.reading.slice(0, 120)}`);

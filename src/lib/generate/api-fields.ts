import type { CheckStandard } from "@/lib/comprehensive/standards";
import { TOP10_2025 } from "@/lib/comprehensive/standards";

// Phase 41 (TFP-185, Decision 5, bug 75): API responses that expose fields
// the page never shows. Read-only: it reads the JSON the page's own requests
// already bring back (same-site XHR and fetch), and sends nothing.
//
// A field is reported, as a finding, when all of these hold:
// - its name suggests an internal detail: one of its words (split at _, -
//   and camelCase) is stock, inventory, cost, wholesale, margin, profit,
//   supplier, internal, secret, password, passwd, hash, salt, token,
//   private or debug, or it is an API key;
// - its value is a number or a string - a yes/no flag (in_stock,
//   is_rental) says whether, and is usually shown as a label, so it is
//   never judged;
// - the page never shows it: for a string, its value isn't in the page's
//   visible text; for a number, the page doesn't show it beside the field's
//   name ("Stock: 12", "12 in stock").
// Only each item's own fields are read (a response's array, its `data`
// array, or the object itself), not nested objects: nested objects hold
// related records, and a translation file's nested keys (fields.password)
// are labels, not data.
//
// ISTQB: error guessing. Measured on the local Toolshops (Decision 5): the
// with-bugs /products items carry `stock`, which the clean ones hide.

/**
 * Copied from the published sources (see standards.ts for their commits):
 * Top 10:2025 A01's "List of Mapped CWEs" includes CWE-200 (Exposure of
 * Sensitive Information to an Unauthorized Actor). ASVS 5.0.0 15.3.1:
 * "Verify that the application only returns the required subset of fields
 * from a data object", 5.0/en/0x24-V15-Secure-Coding-and-Architecture.md.
 */
export const API_FIELDS_STANDARD: CheckStandard = { category: TOP10_2025.A01, asvs: ["15.3.1"], why: "CWE-200 is mapped to A01" };

const API_FIELDS = String.raw`    test('__PATH__ fetches no internal fields it never shows (recorded as a finding)', __DETAILS__, async ({ page }) => {
      // ISTQB: error guessing (field names that suggest internal details).
      const internal = (name: string) => {
        const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s_-]+/);
        return words.some((word) => ['stock', 'inventory', 'cost', 'wholesale', 'margin', 'profit', 'supplier', 'internal', 'secret', 'password', 'passwd', 'hash', 'salt', 'token', 'private', 'debug', 'apikey'].includes(word))
          || words.some((word, index) => word === 'api' && words[index + 1] === 'key');
      };
      const bodies: Array<Promise<{ where: string; json: unknown } | null>> = [];
      page.on('response', (answer) => {
        if (!['xhr', 'fetch'].includes(answer.request().resourceType()) || !/json/i.test(answer.headers()['content-type'] ?? '')) return;
        bodies.push(answer.json().then((json) => ({ where: answer.request().method() + ' ' + answer.url().split('?')[0], json }), () => null));
      });
      const response = await page.goto('__PATH__');
      const notAPage = response ? tfNotAPage(response.status()) : null;
      test.skip(notAPage !== null, '__PATH__ ' + notAPage);
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const shownBeside = (name: string, value: number) => {
        const label = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[_-]+/g, ' ').trim().split(' ').map((word) => word.replace(/[.*+?^()|[\]\\{}$]/g, '\\$&')).join('\\W+');
        const number = String(value).replace('.', '\\.');
        return new RegExp('\\b' + label + '\\b\\W{0,20}' + number + '(?![\\d.])|(?<![\\d.])' + number + '\\W{0,20}(\\w+\\W+){0,2}' + label + '\\b', 'i').test(text);
      };
      const reported = new Set<string>();
      for (const body of await Promise.all(bodies)) {
        if (!body || !tfSameSite(body.where.split(' ')[1], page.url())) continue;
        const json = body.json as { data?: unknown } | unknown[] | null;
        const items = (Array.isArray(json) ? json : Array.isArray((json as { data?: unknown })?.data) ? (json as { data: unknown[] }).data : [json])
          .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item)).slice(0, 50);
        const names = [...new Set(items.flatMap((item) => Object.keys(item)))].filter(internal);
        for (const name of names) {
          const values = items.map((item) => item[name]).filter((value): value is string | number => typeof value === 'number' || (typeof value === 'string' && value !== ''));
          if (values.length === 0 || reported.has(body.where + ' ' + name)) continue;
          const shown = values.some((value) => (typeof value === 'number' ? shownBeside(name, value) : value.length >= 3 && text.includes(value)));
          if (shown) continue;
          reported.add(body.where + ' ' + name);
          const sample = [...new Set(values.map(String))].slice(0, 3).join(', ');
          test.info().annotations.push({ type: 'finding', description: body.where + ' returns "' + name + '" (' + sample + (values.length > 3 ? ', ...' : '') + ') on its items, which __PATH__ never shows; the name suggests an internal detail (ASVS 15.3.1: return only the fields the page needs)' });
        }
      }
    });`;

/** TFP-185's per-page check, as a finding. Needs PROBE_HELPERS (tfSameSite) and NOT_A_PAGE_HELPER in scope. */
export function apiFieldsTest(page: { escapedPath: string; details: (standard: CheckStandard) => string }): string {
    return API_FIELDS.split("__PATH__").join(page.escapedPath).split("__DETAILS__").join(page.details(API_FIELDS_STANDARD));
}

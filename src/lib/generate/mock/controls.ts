import { entryApplies } from "@/lib/library/entries";
import { checkDetails } from "../comprehensive-security";
import { READ_ONLY_GUARD_HELPER } from "../read-only-guard";
import { escapeForSingleQuotedString } from "./format";
import type { ContentProfile } from "./types";

/**
 * Phase 41 (TFP-182, Decision 3): controls on read-only pages do their job.
 * Every check that interacts runs under TFP-181's request guard, so a
 * control that would send anything but a GET fails as a guard breach
 * instead of changing data. Each is a failure when it fails: a control not
 * doing its job.
 *
 * - **Sort** (bug 2; ISTQB: decision table, each option's label setting the
 *   expected order): choosing each sort option orders the listed items by
 *   it - names for "Name (A - Z)" and the like, prices for "Price (Low -
 *   High)". An option whose key isn't a name or a price isn't judged.
 * - **Filter** (bug 27; boundary value analysis, one step in from a handle's
 *   current value): moving a range slider one step must send a request
 *   carrying the new value, when the filter sends one at all; with a
 *   two-handled range, the listed prices must fall inside it. An option
 *   checkbox's request must carry its value.
 * - **Stepper** (bug 40; state transition, n -> n + 1 -> n, within the
 *   field's bounds): "+" and "-" beside a number field change it by one.
 * - **Link destination** (bug 29; decision table, a "Home" link against any
 *   other): a header or nav link's text matches where it lands - "Home"
 *   reaches the start page; any other link's words meet the destination's
 *   title or first heading, with a small synonym table (owner decision, 2026-10-12:
 *   sign in = log in = login; sign up = register = create account; cart =
 *   basket = checkout).
 * - **Option lists** (bug 60; error guessing): no option of a select reads
 *   as an error ("Error 101", "undefined", "not found" and the like). Reads
 *   only, no interaction.
 *
 * The controls are found on the page at run time; inspection decides only
 * which pages get which check, from what it recorded (a select, a checkbox
 * or range field, a number field). Inspection doesn't record a slider built
 * from spans (the Toolshop's), so the filter check runs where it recorded a
 * checkbox or a range field and looks for both kinds.
 *
 * Phase 42 (TFP-193): which pages get which check is the library's
 * (src/lib/library/entries.ts, `controls.*`): each check is an entry, and
 * its pattern decides the pages it binds to.
 */

export const CONTROL_HELPERS = READ_ONLY_GUARD_HELPER + "\n\n" + String.raw`// TFP-182 (Phase 41 Decision 3): controls on read-only pages do their job.
type TfItem = { name: string; price: number | null };
type TfOrder = { key: 'text' | 'number'; direction: 'asc' | 'desc' };

// The order a sort option's label asks for, or null when it isn't a name or price order.
function tfSortOrder(label: string): TfOrder | null {
  const text = label.toLowerCase();
  const direction = /\ba\s*(-|–|to)\s*z\b|\blow(est)?\s*(-|–|to)\s*high|\bascending\b|\blowest first\b|\bcheapest first\b/.test(text) ? 'asc'
    : /\bz\s*(-|–|to)\s*a\b|\bhigh(est)?\s*(-|–|to)\s*low|\bdescending\b|\bhighest first\b/.test(text) ? 'desc' : null;
  if (!direction) return null;
  if (/\bprice\b|\bcost\b|\blow(est)?\s*(-|–|to)\s*high|\bhigh(est)?\s*(-|–|to)\s*low|\bcheapest\b/.test(text)) return { key: 'number', direction };
  if (/\bname\b|\btitle\b|\balphabetical|\ba\s*(-|–|to)\s*z\b|\bz\s*(-|–|to)\s*a\b/.test(text)) return { key: 'text', direction };
  return null;
}

// The listed items: headings inside repeated containers (cards, list items, rows, links), the largest such group, with each one's price.
async function tfReadItems(page: import('@playwright/test').Page): Promise<TfItem[]> {
  return page.evaluate(() => {
    const groups = new Map<string, Array<{ name: string; price: number | null }>>();
    for (const heading of Array.from(document.querySelectorAll('h2, h3, h4, h5, h6'))) {
      const box = heading.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || heading.closest('header, nav, footer, aside')) continue;
      // The item: the largest container around the heading that holds no other heading like it.
      let item: Element | null = null;
      for (let scope = heading.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
        if (scope.querySelectorAll(heading.tagName).length > 1) break;
        if (scope.matches('a[href], li, article, tr, [class*="card" i], [class*="product" i], [class*="item" i]')) item = scope;
      }
      if (!item) continue;
      const text = (item as HTMLElement).innerText || '';
      const money = /[$€£¥]\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/.exec(text);
      const name = (heading.textContent || '').replace(/\s+/g, ' ').trim();
      if (!name) continue;
      const key = item.tagName + '>' + heading.tagName;
      groups.set(key, [...(groups.get(key) ?? []), { name, price: money ? Number(money[1].replace(/,/g, '')) : null }]);
    }
    const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    return largest.length >= 2 ? largest : [];
  });
}

// What is out of order in items for the given order, or null when they are in order (or it can't be told).
function tfOrderProblem(items: TfItem[], order: TfOrder): string | null {
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  if (order.key === 'number' && items.some((item) => item.price === null)) return null;
  for (let index = 1; index < items.length; index++) {
    const [a, b] = [items[index - 1], items[index]];
    const compared = order.key === 'text' ? collator.compare(a.name, b.name) : (a.price as number) - (b.price as number);
    if (order.direction === 'asc' ? compared > 0 : compared < 0) {
      const show = (item: TfItem) => '"' + item.name + '"' + (order.key === 'number' ? ' (' + item.price + ')' : '');
      return 'puts ' + show(a) + ' before ' + show(b);
    }
  }
  return null;
}

async function tfCheckSorts(page: import('@playwright/test').Page, path: string) {
  const problems: string[] = [];
  let checked = 0;
  const selects = page.locator('select');
  for (let index = 0; index < await selects.count(); index++) {
    const select = selects.nth(index);
    if (!(await select.isVisible())) continue;
    const options = await select.locator('option').evaluateAll((list) => list.map((option) => (option.textContent || '').replace(/\s+/g, ' ').trim()));
    const sorts = options.map((label, position) => ({ label, position, order: tfSortOrder(label) })).filter((option) => option.order !== null);
    if (sorts.length < 2) continue;
    for (const option of sorts) {
      await select.selectOption({ index: option.position });
      await tfSettle(page);
      // TFP-240: the sort's own request can start inside selectOption, before tfSettle listens, so tfSettle may
      // return before its response and the list read here be the previous order's. The list is read until it
      // shows the order asked for, for up to 5 s; one still out of order then fails, as a wrong sort always did.
      let items = await tfReadItems(page);
      for (const until = Date.now() + 5000; items.length >= 2 && tfOrderProblem(items, option.order as TfOrder) && Date.now() < until;) {
        await page.waitForTimeout(250);
        items = await tfReadItems(page);
      }
      if (items.length < 2) continue;
      checked++;
      const problem = tfOrderProblem(items, option.order as TfOrder);
      if (problem) problems.push('sorting by "' + option.label + '" on ' + path + ' ' + problem);
    }
  }
  return { problems, checked };
}

// Whether a request's URL carries a value as a whole number, not inside another.
function tfCarries(url: string, value: string) {
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch { /* keep it as it is */ }
  const escaped = value.replace(/[.*+?^()|[\]\\{}$]/g, '\\$&');
  return new RegExp('(^|[^0-9A-Za-z.])' + escaped + '($|[^0-9A-Za-z.])').test(decoded);
}

async function tfCheckFilters(page: import('@playwright/test').Page, path: string) {
  const problems: string[] = [];
  let checked = 0;
  const requests: string[] = [];
  // A QUERY (RFC 10008) carries its criteria in its body, so both are read.
  page.on('request', (request) => {
    if (['GET', 'QUERY'].includes(request.method()) && ['xhr', 'fetch', 'document'].includes(request.resourceType())) requests.push(request.method() + ' ' + request.url() + (request.postData() ? ' ' + request.postData() : ''));
  });
  const sliders = page.locator('[role="slider"], input[type="range"]');
  const sliderCount = Math.min(await sliders.count(), 4);
  const values: number[] = [];
  for (let index = 0; index < sliderCount; index++) {
    const slider = sliders.nth(index);
    if (!(await slider.isVisible())) continue;
    const read = () => slider.evaluate((element) => ({
      value: Number(element.getAttribute('aria-valuenow') ?? (element as HTMLInputElement).value),
      min: Number(element.getAttribute('aria-valuemin') ?? element.getAttribute('min') ?? 0),
      label: element.getAttribute('aria-label') || element.getAttribute('name') || element.id || 'range',
    }));
    const before = await read();
    requests.length = 0;
    await slider.focus();
    await page.keyboard.press(before.value > before.min ? 'ArrowLeft' : 'ArrowRight');
    await tfSettle(page);
    const after = await read();
    if (after.value === before.value) continue;
    checked++;
    values.push(after.value);
    if (requests.length > 0 && !requests.some((url) => tfCarries(url, String(after.value)))) {
      problems.push('moving the "' + after.label + '" slider on ' + path + ' from ' + before.value + ' to ' + after.value + ' sent ' + requests[requests.length - 1] + ', which does not carry ' + after.value);
    }
  }
  if (values.length === 2) {
    const [low, high] = [Math.min(...values), Math.max(...values)];
    const outside = (await tfReadItems(page)).filter((item) => item.price !== null && ((item.price as number) < low || (item.price as number) > high));
    if (outside.length > 0) problems.push('with the range on ' + path + ' set to ' + low + ' to ' + high + ', it still lists ' + outside.slice(0, 3).map((item) => '"' + item.name + '" (' + item.price + ')').join(', '));
  }
  const boxes = page.locator('input[type="checkbox"]');
  for (let index = 0; index < await boxes.count(); index++) {
    const box = boxes.nth(index);
    const value = await box.getAttribute('value');
    if (!value || /^(on|true|yes)$/i.test(value) || !(await box.isVisible()) || (await box.isChecked())) continue;
    const label = await box.evaluate((element) => ((element as HTMLInputElement).labels?.[0]?.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim());
    requests.length = 0;
    await box.check();
    await tfSettle(page);
    checked++;
    if (requests.length > 0 && !requests.some((url) => tfCarries(url, value))) {
      problems.push('choosing the "' + (label || value) + '" filter on ' + path + ' sent ' + requests[requests.length - 1] + ', which does not carry its value ' + value);
    }
    await box.uncheck();
    await tfSettle(page);
    break;
  }
  return { problems, checked };
}

async function tfCheckSteppers(page: import('@playwright/test').Page, path: string) {
  const problems: string[] = [];
  let checked = 0;
  const fields = page.locator('input[type="number"], [role="spinbutton"]');
  for (let index = 0; index < Math.min(await fields.count(), 3); index++) {
    const field = fields.nth(index);
    if (!(await field.isVisible()) || !(await field.isEnabled())) continue;
    const found = await field.evaluate((element, mark) => {
      const describe = (button: Element) => [button.textContent, button.getAttribute('aria-label'), button.id, button.getAttribute('data-test'), button.getAttribute('title'), button.getAttribute('name')].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
      let scope = element.parentElement;
      for (let depth = 0; scope && depth < 3; depth++, scope = scope.parentElement) {
        const buttons = Array.from(scope.querySelectorAll('button, [role="button"]'));
        const up = buttons.find((button) => describe(button) === '+' || /(^|[\s_-])(plus|increase|increment|up)([\s_-]|$)/.test(describe(button)));
        const down = buttons.find((button) => describe(button) === '-' || describe(button) === '−' || /(^|[\s_-])(minus|decrease|decrement|down)([\s_-]|$)/.test(describe(button)));
        if (up && down && up !== down) {
          up.setAttribute('data-tf-step', 'up-' + mark);
          down.setAttribute('data-tf-step', 'down-' + mark);
          const label = element.getAttribute('aria-label') || (element as HTMLInputElement).labels?.[0]?.textContent || element.getAttribute('name') || element.getAttribute('data-test') || element.id || element.getAttribute('placeholder') || 'number field';
          return { label: label.replace(/\s+/g, ' ').trim(), min: Number(element.getAttribute('min') ?? element.getAttribute('aria-valuemin') ?? -Infinity), max: Number(element.getAttribute('max') ?? element.getAttribute('aria-valuemax') ?? Infinity) };
        }
      }
      return null;
    }, String(index));
    if (!found) continue;
    const read = async () => Number((await field.inputValue().catch(() => null)) ?? await field.getAttribute('aria-valuenow'));
    const step = async (direction: 'up' | 'down', from: number) => {
      const expected = direction === 'up' ? (from + 1 <= found.max ? from + 1 : from) : (from - 1 >= found.min ? from - 1 : from);
      await page.locator('[data-tf-step="' + direction + '-' + index + '"]').click();
      await tfSettle(page);
      const now = await read();
      if (now !== expected) problems.push('on ' + path + ', "' + (direction === 'up' ? '+' : '-') + '" beside "' + found.label + '" left it at ' + now + ' (it was ' + from + '; expected ' + expected + ')');
      return now;
    };
    checked++;
    const start = await read();
    const raised = await step('up', start);
    await step('down', raised);
  }
  return { problems, checked };
}

// A page's place in the site: its hash route (#/..., #!/...) when it has one, else its path.
function tfRoute(url: string) {
  const parsed = new URL(url);
  const route = /^#!?\//.test(parsed.hash) ? parsed.hash.replace(/^#!?/, '') : parsed.pathname;
  return route.replace(/\/+$/, '') || '/';
}

// A text's words, with the synonym table applied (owner decision, 2026-10-12).
function tfWords(text: string) {
  const canonical = text.toLowerCase()
    .replace(/\bsign[\s-]?in\b|\blog[\s-]?in\b|\blog[\s-]?on\b/g, ' login ')
    .replace(/\bsign[\s-]?up\b|\bregistration\b|\bregister\b|\bcreate (an )?account\b/g, ' register ')
    .replace(/\bbasket\b|\bcheckout\b|\bshopping bag\b/g, ' cart ');
  const skip = new Set(['the', 'a', 'an', 'of', 'to', 'my', 'your', 'our', 'and', 'for', 'in', 'on', 'at', 'page', 'us']);
  return new Set(canonical.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !skip.has(word)).map((word) => word.replace(/s$/, '')));
}

async function tfCheckNavLinks(page: import('@playwright/test').Page, startPath: string) {
  const problems: string[] = [];
  const mark = () => page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('header a[href], nav a[href], [role="navigation"] a[href]')) as HTMLAnchorElement[];
    const seen = new Set<string>();
    const kept: Array<{ text: string; href: string }> = [];
    for (const link of links) {
      const box = link.getBoundingClientRect();
      const text = (link.textContent || '').replace(/\s+/g, ' ').trim();
      const raw = link.getAttribute('href') || '';
      if (box.width === 0 || box.height === 0 || !text || raw === '#' || /^(javascript|mailto|tel):/i.test(raw)) continue;
      if (link.target === '_blank' || link.matches('[aria-haspopup], [data-bs-toggle], [data-toggle], .dropdown-toggle') || new URL(link.href).origin !== location.origin) continue;
      if (seen.has(text + ' ' + link.href)) continue;
      seen.add(text + ' ' + link.href);
      link.setAttribute('data-tf-link', String(kept.length));
      kept.push({ text, href: link.href });
    }
    return kept.slice(0, 10);
  });
  const shown = () => page.evaluate(() => document.body.innerText);
  await page.goto(startPath);
  const start = tfRoute(page.url());
  const startShown = await shown();
  const links = await mark();
  let moved = false;
  for (let index = 0; index < links.length; index++) {
    if (index > 0) {
      // TFP-214 (owner decision, 2026-10-20): back to the start page by Back, as full navigation,
      // when the last link moved; loaded again only when Back doesn't reach it.
      if (moved) {
        await page.goBack({ timeout: 5000 }).catch(() => null);
        await tfSettle(page);
      }
      if (tfRoute(page.url()) !== start) await page.goto(startPath);
      await mark();
    }
    const link = links[index];
    const from = page.url();
    await page.locator('[data-tf-link="' + index + '"]').first().click();
    await tfSettle(page);
    moved = page.url() !== from;
    const route = tfRoute(page.url());
    // The address and the content: a link that moves the address but leaves the start page's content (a pane that
    // didn't change) hasn't landed anywhere (Phase 39 Acceptance Criteria 3). A view that draws late is waited for, up
    // to 5 s, as the sort check waits for its order (TFP-240).
    let now = await shown();
    for (const deadline = Date.now() + 5000; route !== start && now === startShown && Date.now() < deadline; now = await shown()) await page.waitForTimeout(100);
    if (route !== start && now === startShown) {
      problems.push('"' + link.text + '" on ' + startPath + ' changes the address to ' + route + ' but the page still shows what ' + start + ' showed');
      continue;
    }
    const title = await page.title();
    const heading = ((await page.locator('h1, h2, h3').first().textContent({ timeout: 2000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    const where = route + ' ("' + (heading || title) + '")';
    if (/^(home|home ?page|start|start page|front page)$/i.test(link.text)) {
      if (route !== start && route !== '/') problems.push('"' + link.text + '" on ' + startPath + ' leads to ' + where + ', not the start page');
      continue;
    }
    const words = tfWords(link.text);
    const there = tfWords(title + ' ' + heading);
    if (words.size > 0 && ![...words].some((word) => there.has(word))) problems.push('"' + link.text + '" on ' + startPath + ' leads to ' + where + ', whose title and heading share no word with it');
  }
  return { problems, checked: links.length };
}

// What an option list must not offer: error text in place of a choice.
const TF_OPTION_ERROR = /^error\b|\berror\s*[:#]?\s*\d+|\bundefined\b|\bnull\b|\bNaN\b|\bnot found\b|\[object object\]|\bexception\b/i;`;

function controlTest(title: string, escapedPath: string, technique: string, body: string) {
    return `  test('${title}', ${checkDetails(escapedPath)()}, async ({ page }) => {
    // ISTQB: ${technique}.
${body}
  });`;
}

function guardedCheck(check: string, escapedPath: string, nothing: string) {
    return `    await page.goto('${escapedPath}');
    let result = { problems: [] as string[], checked: 0 };
    await tfReadOnlyGuarded(page, async () => { result = await ${check}(page, '${escapedPath}'); });
    test.skip(result.checked === 0, '${nothing} on ${escapedPath}');
    expect(result.problems, result.problems.join('; ')).toEqual([]);`;
}

/** TFP-182's tests for the inspected pages, and the helpers they share (empty when there are none). */
export function buildControlTests(contentProfile: ContentProfile | null): { tests: string[]; helpers: string } {
    const pages = contentProfile?.pages ?? [];
    const tests: string[] = [];
    const seen = new Set<string>();
    for (const page of pages) {
        if (seen.has(page.path)) continue;
        seen.add(page.path);
        const escapedPath = escapeForSingleQuotedString(page.path);
        if (entryApplies("controls.sort", page)) {
            tests.push(controlTest(`sort options order the items on ${escapedPath}`, escapedPath, "decision table (each sort option's label sets the expected order)",
                guardedCheck("tfCheckSorts", escapedPath, "no sort option with items to compare")));
        }
        if (entryApplies("controls.filters", page)) {
            tests.push(controlTest(`filters send and respect the chosen values on ${escapedPath}`, escapedPath, "boundary value analysis (one step in from each handle's value)",
                guardedCheck("tfCheckFilters", escapedPath, "no range slider or option filter that changes")));
        }
        if (entryApplies("controls.steppers", page)) {
            tests.push(controlTest(`quantity steppers change the value by one on ${escapedPath}`, escapedPath, "state transition (n, n + 1, n, within the field's bounds)",
                guardedCheck("tfCheckSteppers", escapedPath, "no number field with + and - buttons")));
        }
        if (entryApplies("controls.option-lists", page)) {
            tests.push(controlTest(`option lists show no error text on ${escapedPath}`, escapedPath, "error guessing", `    await page.goto('${escapedPath}');
    const lists = await page.locator('select').evaluateAll((selects) => selects.map((select) => ({
      name: (select.getAttribute('aria-label') || (select as HTMLSelectElement).labels?.[0]?.textContent || select.getAttribute('name') || select.id || 'a list').replace(/\\s+/g, ' ').trim(),
      options: Array.from((select as HTMLSelectElement).options).map((option) => (option.textContent || '').replace(/\\s+/g, ' ').trim()),
    })));
    const problems = lists.flatMap((list) => list.options.filter((option) => TF_OPTION_ERROR.test(option)).map((option) => 'the "' + list.name + '" list on ${escapedPath} offers "' + option + '"'));
    expect(problems, problems.join('; ')).toEqual([]);`));
        }
    }
    if (pages.length > 0 && entryApplies("controls.link-destination", pages[0])) {
        const escapedStart = escapeForSingleQuotedString(pages[0].path);
        tests.push(controlTest(`navigation links land where their text says, from ${escapedStart}`, escapedStart, "decision table (a \"Home\" link must reach the start page; any other must share a word with where it lands)",
            guardedCheck("tfCheckNavLinks", escapedStart, "no header or nav link to follow")));
    }
    return { tests, helpers: tests.length > 0 ? CONTROL_HELPERS : "" };
}

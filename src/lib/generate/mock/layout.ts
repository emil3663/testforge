import { checkDetails } from "../comprehensive-security";
import { escapeForSingleQuotedString } from "./format";
import { inspectedPagePaths } from "./suite";
import type { ContentProfile } from "./types";

/**
 * Phase 41 (TFP-186, Decision 1): layout and visual consistency, in Standard's
 * usability area, on the selected pages. TestForge can't know a site's
 * intended design on a first run, but it can find elements that should look
 * alike and don't.
 *
 * - **Consistency within a page** (a finding; ISTQB: equivalence
 *   partitioning, each group one partition whose members should look alike):
 *   the fields of one form (font family and size, padding), its labels (font
 *   family and size), the options of one list (font family and size),
 *   repeated cards (their titles' alignment and font; an image hidden while
 *   the other cards show theirs: bug 26). Buttons in one row are not compared
 *   by width (Emil, 2026-10-12: text-sized buttons differ by design; a
 *   button's width is compared across pages instead). The odd one out is named with the value the others share; with
 *   no majority, every value is named.
 * - **Consistency across pages** (a finding, once per run; equivalence
 *   partitioning): the same component - a tag and its classes, layout
 *   utilities (text-end, mb-3, ...) left out - on different pages: headings'
 *   and card titles' alignment and font (page titles, h1, and headings with
 *   a component class; a bare h3 is not one component), and a form's submit button's share
 *   of its container's width. Each page's usual value is compared; a page
 *   that differs from the most common one is named (bugs 4, 49, 58, 66).
 * - **Overlap** (a failure; boundary value analysis: boxes that touch, or
 *   share a border's pixel, against boxes that overlap): two visible controls
 *   whose boxes share more than 3 px both ways, neither inside the other
 *   (bug 45).
 * - **Images that don't render** (a failure; error guessing): a visible image
 *   that finished loading and can't be decoded (bugs 28 and 30, already
 *   found by the failed-request check).
 * Overlap and an unrendered image are failures (a user can't use or see the
 * thing); a consistency difference is a finding, since some are intended
 * (Emil, 2026-10-07). Bug 4 is random per load: the checks report it when it
 * shows; its absence is not a pass on it (TFP-188's scoring).
 */

export const LAYOUT_HELPERS = String.raw`// TFP-186 (Phase 41 Decision 1): what is out of line in a page's groups, read in the browser.
type TfLayout = { findings: string[]; groups: number };

async function tfLayoutFindings(page: import('@playwright/test').Page, path: string): Promise<TfLayout> {
  return page.evaluate((path) => {
    const visible = (element: Element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
    const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const name = (element: Element) => clean((element as HTMLInputElement).labels?.[0]?.textContent) || clean(element.getAttribute('aria-label')) || clean(element.getAttribute('placeholder')) || clean(element.textContent) || clean(element.getAttribute('name')) || clean(element.id) || element.tagName.toLowerCase();
    const findings: string[] = [];
    let groups = 0;
    // The odd ones out of a group on one property: each named with the value the others share, or every value when none is shared by most.
    const compare = (what: string, members: Element[], property: string, read: (element: Element) => string) => {
      if (members.length < 2) return;
      const values = members.map(read);
      const counts = new Map<string, number>();
      for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
      if (counts.size < 2) return;
      const [common, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (count * 2 > members.length) {
        members.forEach((member, index) => {
          if (values[index] !== common) findings.push(what + ' on ' + path + ': "' + name(member) + '" has ' + property + ' ' + shown(values[index]) + ', where the other ' + count + ' have ' + shown(common));
        });
      } else {
        findings.push(what + ' on ' + path + ' differ in ' + property + ': ' + members.map((member, index) => '"' + name(member) + '" ' + shown(values[index])).join(', '));
      }
    };
    // A font stack is compared whole, and named by its first family.
    const style = (property: string) => (element: Element) => getComputedStyle(element).getPropertyValue(property);
    const shown = (value: string) => value.split(',')[0].trim();
    const align = (element: Element) => ({ start: 'left', end: 'right' } as Record<string, string>)[getComputedStyle(element).textAlign] ?? getComputedStyle(element).textAlign;

    for (const form of Array.from(document.querySelectorAll('form'))) {
      const label = clean(form.getAttribute('aria-label')) || clean(form.id) || clean(form.getAttribute('name'));
      const formName = label ? 'the "' + label + '" form' : 'a form';
      const fields = Array.from(form.querySelectorAll('input, select, textarea')).filter((field) => visible(field) && !/^(hidden|checkbox|radio|submit|button|reset|image|range|color)$/.test((field as HTMLInputElement).type));
      if (fields.length >= 2) groups++;
      for (const property of ['font-family', 'font-size', 'padding-left', 'padding-top']) compare('the fields of ' + formName, fields, property, style(property));
      const labels = Array.from(form.querySelectorAll('label')).filter(visible);
      if (labels.length >= 2) groups++;
      for (const property of ['font-family', 'font-size']) compare('the labels of ' + formName, labels, property, style(property));
    }
    for (const list of Array.from(document.querySelectorAll('select')).filter(visible)) {
      const options = Array.from((list as HTMLSelectElement).options);
      if (options.length >= 2) groups++;
      for (const property of ['font-family', 'font-size']) compare('the options of the "' + name(list) + '" list', options, property, style(property));
    }
    // Repeated cards: the largest container around each heading that holds no other heading like it, grouped by tag and class.
    const cards = new Map<string, Array<{ card: Element; title: Element }>>();
    for (const title of Array.from(document.querySelectorAll('h2, h3, h4, h5, h6')).filter(visible)) {
      if (title.closest('header, nav, footer')) continue;
      let card: Element | null = null;
      for (let scope = title.parentElement; scope && scope !== document.body; scope = scope.parentElement) {
        if (scope.querySelectorAll(title.tagName).length > 1) break;
        if (scope.matches('a[href], li, article, [class*="card" i], [class*="product" i], [class*="item" i]')) card = scope;
      }
      if (!card) continue;
      const key = card.tagName + '.' + Array.from(card.classList).sort().join('.') + '>' + title.tagName;
      cards.set(key, [...(cards.get(key) ?? []), { card, title }]);
    }
    for (const members of cards.values()) {
      if (members.length < 3) continue;
      groups++;
      const titles = members.map((member) => member.title);
      compare('the card titles', titles, 'text-align', align);
      for (const property of ['font-family', 'font-size']) compare('the card titles', titles, property, style(property));
      const withImages = members.filter((member) => member.card.querySelector('img'));
      const showing = withImages.filter((member) => Array.from(member.card.querySelectorAll('img')).some(visible));
      if (withImages.length >= 3 && showing.length >= 2) {
        for (const member of withImages) {
          if (!showing.includes(member)) findings.push('the cards on ' + path + ': "' + name(member.title) + '" has its image hidden, where the other ' + showing.length + ' show theirs');
        }
      }
    }
    return { findings, groups };
  }, path);
}

// TFP-186: the components a page shows, for comparing across pages: a tag and its classes, layout utilities left out.
type TfComponentSample = { key: string; values: Record<string, string> };

async function tfComponentSamples(page: import('@playwright/test').Page): Promise<TfComponentSample[]> {
  return page.evaluate(() => {
    const visible = (element: Element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
    const utility = /^(text-|m[trblxyse]?-|p[trblxyse]?-|d-|float-|align-|justify-|fw-|fs-|col-|w-|h-|order-|flex-|gap-|position-|top-|bottom-|start-|end-|border-|rounded|shadow|bg-|active$|show$|disabled$)/;
    const key = (element: Element) => element.tagName.toLowerCase() + Array.from(element.classList).filter((name) => !utility.test(name)).sort().map((name) => '.' + name).join('');
    const align = (element: Element) => ({ start: 'left', end: 'right' } as Record<string, string>)[getComputedStyle(element).textAlign] ?? getComputedStyle(element).textAlign;
    const samples: TfComponentSample[] = [];
    for (const heading of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(visible)) {
      if (heading.closest('header, nav, footer')) continue;
      // A page's title (h1), or a heading with a class that names its component (card-title): a bare h3 is
      // a form's title on one page and a section's on another, not one component (found on the clean Toolshop).
      if (heading.tagName !== 'H1' && key(heading) === heading.tagName.toLowerCase()) continue;
      const css = getComputedStyle(heading);
      samples.push({ key: key(heading), values: { 'text-align': align(heading), 'font-family': css.fontFamily, 'font-size': css.fontSize } });
    }
    for (const button of Array.from(document.querySelectorAll('form button[type="submit"], form input[type="submit"]')).filter(visible)) {
      if (!button.parentElement) continue;
      const share = Math.round((button.getBoundingClientRect().width / button.parentElement.getBoundingClientRect().width) * 10) * 10;
      // A submit is a <button> on one page and an <input> on another (the Toolshop's are): its classes name the component.
      samples.push({ key: 'submit ' + (key(button).replace(/^[a-z]+/, '') || '(no class)'), values: { 'share of its container\'s width': share + '%', 'font-size': getComputedStyle(button).fontSize } });
    }
    return samples;
  });
}`;

function layoutTest(title: string, escapedPath: string, technique: string, body: string) {
    return `  test('${title}', ${checkDetails(escapedPath)()}, async ({ page }) => {
    // ISTQB: ${technique}.
${body}
  });`;
}

/** TFP-186's tests for the inspected pages, and the helpers they share. */
export function buildLayoutTests(contentProfile: ContentProfile | null): { tests: string[]; helpers: string } {
    const paths = inspectedPagePaths(contentProfile);
    const tests: string[] = [];
    for (const path of paths) {
        const escapedPath = escapeForSingleQuotedString(path);
        tests.push(layoutTest(`${escapedPath} keeps its forms, lists and cards consistent (recorded as findings)`, escapedPath, "equivalence partitioning (each group's members should look alike)", `    await page.goto('${escapedPath}');
    const layout = await tfLayoutFindings(page, '${escapedPath}');
    test.skip(layout.groups === 0, 'no form, list or set of cards on ${escapedPath}');
    for (const description of layout.findings) test.info().annotations.push({ type: 'finding', description });`));
        tests.push(layoutTest(`${escapedPath} has no overlapping controls`, escapedPath, "boundary value analysis (boxes that touch or share a border against boxes that overlap)", `    await page.goto('${escapedPath}');
    const overlaps = await page.evaluate((path) => {
      const controls = Array.from(document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]')).filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      });
      const name = (element: Element) => ((element as HTMLInputElement).labels?.[0]?.textContent || element.getAttribute('aria-label') || element.textContent || element.getAttribute('name') || element.id || element.tagName.toLowerCase()).replace(/\\s+/g, ' ').trim().slice(0, 40);
      const found: string[] = [];
      for (let first = 0; first < controls.length; first++) {
        for (let second = first + 1; second < controls.length; second++) {
          const [a, b] = [controls[first], controls[second]];
          if (a.contains(b) || b.contains(a)) continue;
          const [boxA, boxB] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
          const width = Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left);
          const height = Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top);
          if (width > 3 && height > 3) found.push('"' + name(a) + '" and "' + name(b) + '" overlap by ' + Math.round(width) + ' x ' + Math.round(height) + ' px on ' + path);
        }
      }
      return found;
    }, '${escapedPath}');
    expect(overlaps, overlaps.join('; ')).toEqual([]);`));
        tests.push(layoutTest(`${escapedPath} shows every image it loads`, escapedPath, "error guessing (an image that loaded but can't be shown)", `    await page.goto('${escapedPath}');
    const broken = await page.evaluate(async () => {
      const images = Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0 && image.getBoundingClientRect().width > 0 && getComputedStyle(image).visibility !== 'hidden');
      const failed = await Promise.all(images.map((image) => image.decode().then(() => null, () => image.getAttribute('src') ?? image.currentSrc)));
      return failed.filter((source): source is string => source !== null);
    });
    expect(broken, 'images on ${escapedPath} that loaded but can\\'t be shown: ' + broken.join(', ')).toEqual([]);`));
    }
    if (paths.length >= 2) {
        const list = paths.map((path) => `'${escapeForSingleQuotedString(path)}'`).join(", ");
        tests.push(layoutTest("the same components look the same on every inspected page (recorded as findings)", escapeForSingleQuotedString(paths[0]), "equivalence partitioning (one component on different pages is one partition)", `    const pages = [${list}];
    const seen = new Map<string, Map<string, Map<string, number>>>();
    for (const path of pages) {
      await page.goto(path);
      for (const sample of await tfComponentSamples(page)) {
        for (const [property, value] of Object.entries(sample.values)) {
          const byProperty = seen.get(sample.key + ' | ' + property) ?? new Map<string, Map<string, number>>();
          const counts = byProperty.get(path) ?? new Map<string, number>();
          counts.set(value, (counts.get(value) ?? 0) + 1);
          byProperty.set(path, counts);
          seen.set(sample.key + ' | ' + property, byProperty);
        }
      }
    }
    for (const [key, byPage] of seen) {
      if (byPage.size < 2) continue;
      const usual = new Map([...byPage].map(([path, counts]) => [path, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]]));
      const tally = new Map<string, string[]>();
      for (const [path, value] of usual) tally.set(value, [...(tally.get(value) ?? []), path]);
      if (tally.size < 2) continue;
      const [component, property] = key.split(' | ');
      const ranked = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
      const described = ranked.map(([value, where]) => value + ' on ' + where.join(', ')).join('; ');
      test.info().annotations.push({ type: 'finding', description: component + ' differs across pages in ' + property + ': ' + described });
    }`));
    }
    return { tests, helpers: tests.length > 0 ? LAYOUT_HELPERS : "" };
}

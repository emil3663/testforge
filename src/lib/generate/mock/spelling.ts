import { boundPaths } from "@/lib/library/entries";
import { checkDetails } from "../comprehensive-security";
import { escapeForSingleQuotedString } from "./format";
import type { ContentProfile } from "./types";

/**
 * Phase 41 (TFP-187, Decision 2): the spelling of the text people read in an
 * interface - buttons, labels, placeholders, headings, link text,
 * aria-labels and option text - on every inspected page, in Standard's
 * SEO/content area. Body copy is out of scope. Each misspelling is a
 * finding naming the word, the element and the suggested spelling.
 *
 * The dictionaries (decided by Emil, 2026-10-12, after the licence check):
 * `dictionary-en` (en_US) and `dictionary-en-gb` (en_GB-ise), Hunspell files
 * from SCOWL size 60 (SCOWL's permissive notices: THIRD_PARTY_NOTICES.md),
 * read with `nspell` (MIT). They are two spellers - a word is known if
 * either knows it - because adding the GB list to the US speller left it
 * accepting every word (measured). Accents are stripped before a word is
 * looked up, as SCOWL stores it ("Curaçao" is "Curacao").
 *
 * The rule, calibrated on the local Toolshops (Emil, 2026-10-12), where
 * Decision 2's wording reported some 40 words on the clean copy:
 * - words of four or more letters, none with a capital after the first
 *   (acronyms, product codes, camelCase), hyphens joined ("E-mail" is
 *   "Email"); a word known in another case is known ("eco", "Eco");
 * - lists of 20 or more options are not read: they are names (countries,
 *   states); text in a `<footer>` is not read (credits, legal lines);
 * - an unknown word is reported only when a dictionary suggestion is
 *   within edit distance 2 - a name the dictionary has nothing near is the
 *   site's own vocabulary ("Toolshop", a brand) and isn't reported;
 * - a real-word slip no dictionary sees (bug 62's "Massage" for "Message"):
 *   a field's placeholder word within edit distance 2 of a word of its
 *   label, with the same first letter, but not equal to it.
 * A page whose `lang` is not English (en, en-US, en-GB) is Not run, named as
 * not checked; a page with no `lang` is checked as English.
 *
 * ISTQB: error guessing (the slips that reach an interface).
 */

export const SPELLING_HELPERS = String.raw`// TFP-187 (Phase 41 Decision 2): the en-US and en-GB spellers, loaded once per worker.
type TfSpeller = { known: (word: string) => boolean; suggest: (word: string) => string[]; distance: (a: string, b: string) => number };
let tfSpellers: Promise<TfSpeller> | null = null;

function tfSpeller(): Promise<TfSpeller> {
  tfSpellers ??= (async () => {
    // Loaded by name, not imported at the top of the file, like the axe scan: the dictionaries are TestForge's own packages.
    const load = (name: string) => import(name) as Promise<{ default: unknown }>;
    const [spellerModule, usModule, gbModule] = await Promise.all([load('nspell'), load('dictionary-en'), load('dictionary-en-gb')]);
    type Speller = { correct: (word: string) => boolean; suggest: (word: string) => string[] };
    const nspell = spellerModule.default as (dictionary: { aff: string; dic: string }) => Speller;
    const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
    const open = (dictionary: unknown) => { const { aff, dic } = dictionary as { aff: Uint8Array; dic: Uint8Array }; return nspell({ aff: text(aff), dic: text(dic) }); };
    const spellers = [open(usModule.default), open(gbModule.default)];
    const plain = (word: string) => word.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const cases = (word: string) => [word, word.toLowerCase(), word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()];
    const distance = (a: string, b: string) => {
      const [x, y] = [a.toLowerCase(), b.toLowerCase()];
      let row = Array.from({ length: y.length + 1 }, (_, index) => index);
      for (let i = 1; i <= x.length; i++) {
        const next = [i];
        for (let j = 1; j <= y.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
        row = next;
      }
      return row[y.length];
    };
    const known = (word: string) => cases(plain(word)).some((form) => spellers.some((speller) => speller.correct(form)));
    // Up to three suggestions within edit distance 2: the nearest first, then those that share more of the word's start.
    const shared = (a: string, b: string) => { let n = 0; while (n < a.length && n < b.length && a[n].toLowerCase() === b[n].toLowerCase()) n++; return n; };
    const suggest = (word: string) => [...new Set(spellers.flatMap((speller) => speller.suggest(plain(word))))]
      .map((candidate) => ({ candidate, away: distance(plain(word), candidate), start: shared(plain(word), candidate) }))
      .filter((entry) => entry.away <= 2)
      .sort((a, b) => a.away - b.away || b.start - a.start)
      .slice(0, 3)
      .map((entry) => entry.candidate);
    return { known, suggest, distance };
  })();
  return tfSpellers;
}

// The interface text a page shows, with the element each piece is in, and its fields' placeholders beside their labels.
async function tfInterfaceText(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
    const pieces: Array<{ where: string; text: string }> = [];
    const add = (kind: string, element: Element, text: string | null | undefined) => {
      if (element.closest('footer, [role="contentinfo"]')) return;
      const value = clean(text);
      if (value) pieces.push({ where: 'the ' + kind + ' "' + value.slice(0, 40) + '"', text: value });
    };
    for (const element of Array.from(document.querySelectorAll('button, [role="button"]'))) add('button', element, element.textContent);
    for (const element of Array.from(document.querySelectorAll('input[type="submit"], input[type="button"]'))) add('button', element, (element as HTMLInputElement).value);
    for (const element of Array.from(document.querySelectorAll('label'))) add('label', element, element.textContent);
    for (const element of Array.from(document.querySelectorAll('[placeholder]'))) add('placeholder', element, element.getAttribute('placeholder'));
    for (const element of Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))) add('heading', element, element.textContent);
    for (const element of Array.from(document.querySelectorAll('a'))) add('link', element, element.textContent);
    for (const element of Array.from(document.querySelectorAll('[aria-label]'))) add('aria-label', element, element.getAttribute('aria-label'));
    for (const list of Array.from(document.querySelectorAll('select'))) {
      const options = Array.from((list as HTMLSelectElement).options);
      if (options.length < 20) for (const option of options) add('option', option, option.textContent);
    }
    const fields = Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]'))
      .map((field) => ({ placeholder: clean(field.getAttribute('placeholder')), label: clean((field as HTMLInputElement).labels?.[0]?.textContent) }))
      .filter((field) => field.placeholder && field.label);
    return { lang: document.documentElement.lang, pieces, fields };
  });
}

// A text's words of four letters or more, hyphens joined, with no capital after the first letter.
function tfWordsOf(text: string): string[] {
  return (text.replace(/(\p{L})-(\p{L})/gu, '$1$2').match(/\p{L}[\p{L}']*\p{L}/gu) ?? []).filter((word) => word.length >= 4 && !/\p{Lu}/u.test(word.slice(1)));
}`;

/** TFP-187's test for each inspected page, and the helpers they share. */
export function buildSpellingTests(contentProfile: ContentProfile | null): { tests: string[]; helpers: string } {
    // Phase 42 (TFP-193): the library's `spelling` entry binds the check to its pages.
    const tests = boundPaths("spelling", contentProfile).map((path) => {
        const escapedPath = escapeForSingleQuotedString(path);
        return `  test('${escapedPath} spells its interface text correctly (recorded as findings)', ${checkDetails(escapedPath)()}, async ({ page }) => {
    // ISTQB: error guessing (the slips that reach an interface).
    await page.goto('${escapedPath}');
    const read = await tfInterfaceText(page);
    test.skip(read.lang !== '' && !/^en(-(us|gb))?$/i.test(read.lang), '${escapedPath} is in ' + read.lang + ': only English (en-US, en-GB) is checked');
    test.skip(read.pieces.length === 0, 'no interface text on ${escapedPath}');
    const speller = await tfSpeller();
    const reported = new Set<string>();
    for (const piece of read.pieces) {
      for (const word of tfWordsOf(piece.text)) {
        if (reported.has(word) || speller.known(word)) continue;
        const suggestions = speller.suggest(word);
        if (suggestions.length === 0) continue;
        reported.add(word);
        test.info().annotations.push({ type: 'finding', description: '"' + word + '" in ' + piece.where + ' on ${escapedPath} is not in the dictionary (en-US, en-GB); did you mean ' + suggestions.map((suggestion) => '"' + suggestion + '"').join(' or ') + '?' });
      }
    }
    for (const field of read.fields) {
      const labelWords = tfWordsOf(field.label);
      for (const word of tfWordsOf(field.placeholder)) {
        const near = labelWords.find((labelWord) => labelWord.toLowerCase() !== word.toLowerCase() && labelWord[0].toLowerCase() === word[0].toLowerCase() && speller.distance(word, labelWord) <= 2);
        if (!near || labelWords.some((labelWord) => labelWord.toLowerCase() === word.toLowerCase()) || reported.has(word)) continue;
        reported.add(word);
        test.info().annotations.push({ type: 'finding', description: '"' + word + '" in the placeholder "' + field.placeholder + '" on ${escapedPath} looks like a misspelling of its label\\'s "' + near + '"' });
      }
    }
  });`;
    });
    return { tests, helpers: tests.length > 0 ? SPELLING_HELPERS : "" };
}

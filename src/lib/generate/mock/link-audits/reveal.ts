import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString, quoteSelector } from "../format";
import type { LinkDetail } from "../types";

/**
 * TFP-159: a link that introspection found hidden - in a closed dropdown, or
 * behind a collapsed navbar's toggle - is located whether or not it is
 * visible, so its health is checked by its own address and its presence in
 * the page, never by whether a menu opened.
 */
export function buildHiddenLinkLocatorExpression(link: LinkDetail) {
    if (link.text) {
        return `page.getByRole('link', { name: '${escapeForSingleQuotedString(link.text)}', exact: true, includeHidden: true }).first()`;
    }
    return `page.locator(${quoteSelector(`a[href="${escapeForDoubleQuotedSelector(link.rawHref || link.url)}"]`)}).first()`;
}

/** The same choice, made at run time inside a generated loop over a link payload. */
export const RUNTIME_HIDDEN_LINK_LOCATOR = `link.text
                    ? page.getByRole('link', { name: link.text, exact: true, includeHidden: true }).first()
                    : page.locator('a[href="' + (link.rawHref || link.url).replace(/["\\\\]/g, '\\\\$&') + '"]').first()`;

/**
 * TFP-159 (approach: owner decision, 2026-10-06): reveals what a closed menu
 * or a collapsed navbar hides, in the page, at run time. The control is an
 * element with aria-expanded whose aria-controls (or data-bs-target,
 * data-target, href="#id") names one of the target's ancestors; failing
 * that, an aria-expanded element just before a hidden ancestor (Bootstrap's
 * dropdown pattern). A control that is itself hidden is revealed first, up
 * to 3 levels (a dropdown inside a collapsed navbar). Opened by keyboard
 * (focus, Enter) or by click; both are read-only (Phase 38 Decision 1).
 * Returns why the target is still hidden, naming the menu, if it is.
 */
export function buildRevealHelper(indent: string) {
    const lines = [
        "// TFP-159: reveal what a closed menu or a collapsed navbar hides. The control is an element with",
        "// aria-expanded whose aria-controls (or data-bs-target, data-target, href=\"#id\") names a hidden ancestor of the",
        "// target; failing that, one just before it - nearest ancestor first. A hidden control is revealed first, up to 3 levels.",
        "const tfReveal = async (target: ReturnType<typeof page.locator>, how: 'keyboard' | 'click'): Promise<{ visible: boolean; reason: string }> => {",
        "  if (await target.isVisible()) return { visible: true, reason: '' };",
        "  const start = await target.elementHandle({ timeout: 2000 }).catch(() => null);",
        "  if (!start) return { visible: false, reason: 'it is not on the page' };",
        "  const chain: Array<NonNullable<Awaited<ReturnType<typeof start.asElement>>>> = [];",
        "  let current = start;",
        "  for (let level = 0; level < 3; level += 1) {",
        "    const toggle = (await current.evaluateHandle((node) => {",
        "      const element = node as Element;",
        "      const shown = (e: Element) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };",
        "      const toggles = Array.from(document.querySelectorAll('[aria-expanded]'));",
        "      // Nearest hidden ancestor first; at each, a control naming it, then one just before it.",
        "      for (let up = element.parentElement; up && up !== document.body; up = up.parentElement) {",
        "        if (shown(up)) continue;",
        "        const id = up.id;",
        "        const named = id ? toggles.find((t) => t !== element && ((t.getAttribute('aria-controls') ?? '').split(/\\s+/).includes(id) || [t.getAttribute('data-bs-target'), t.getAttribute('data-target'), t.getAttribute('href')].includes('#' + id))) : undefined;",
        "        if (named) return named;",
        "        const before = up.previousElementSibling;",
        "        if (before && before.hasAttribute('aria-expanded')) return before;",
        "      }",
        "      return null;",
        "    })).asElement();",
        "    if (!toggle) break;",
        "    chain.unshift(toggle);",
        "    if (await toggle.isVisible()) break;",
        "    current = toggle;",
        "  }",
        "  if (chain.length === 0) return { visible: false, reason: 'no control was found that reveals it' };",
        "  for (const toggle of chain) {",
        "    if (how === 'keyboard') {",
        "      await toggle.focus({ timeout: 2000 }).catch(() => {});",
        "      await page.keyboard.press('Enter');",
        "    } else {",
        "      await toggle.click({ timeout: 2000 }).catch(() => {});",
        "    }",
        "  }",
        "  await target.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});",
        "  if (await target.isVisible()) return { visible: true, reason: '' };",
        "  const nearest = chain[chain.length - 1];",
        "  const menu = await nearest.evaluate((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\\s+/g, ' ')) || 'unnamed';",
        "  const opened = (await nearest.getAttribute('aria-expanded')) === 'true';",
        "  return { visible: false, reason: opened ? \"the '\" + menu + \"' menu opened, but it stays hidden\" : \"the '\" + menu + \"' menu didn't open\" };",
        "};",
    ];
    return lines.map((line) => indent + line).join("\n");
}

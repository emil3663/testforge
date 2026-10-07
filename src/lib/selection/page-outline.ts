/**
 * Phase 40 Decision 2 (TFP-171): a cheap outline of each page, read from the
 * page the crawl already has open (read-only). Its structural signature
 * refines TFP-170's address types: pages with equal signatures merge, and
 * pages of one address pattern with different signatures split. There is no
 * threshold (Emil, 2026-10-07): signatures are equal or they aren't.
 *
 * The signature is three things:
 * - the set of landmark regions (banner, navigation, main, complementary,
 *   contentinfo, search);
 * - the forms: how many, and each form's field types - every field's type
 *   (`email`, `password`, `text`, `number`, `select`, `textarea`, `search`,
 *   ...). Decision 2 names password, email, textarea and search; reading
 *   those as examples rather than the whole list is what lets a
 *   registration form differ from a sign-in form, which have both;
 * - whether repeated card-like items are present: 3 or more siblings of one
 *   tag and class, each a link (or holding one) with an image or a heading.
 *
 * Heading structure and the interactive-element count are recorded but
 * never decide grouping; the ranking (TFP-172) uses them.
 */
export interface PageOutline {
    landmarks: string[];
    /** Each form's field types, sorted and unique. */
    forms: string[][];
    cards: boolean;
    headings: string[];
    interactive: number;
}

/** Runs in the page (passed to page.evaluate), so it uses nothing from outside itself. */
export function capturePageOutline(): PageOutline {
    const outside = (element: Element) => !element.parentElement?.closest("article, aside, main, nav, section");
    const landmarks = new Set<string>();
    for (const element of Array.from(document.querySelectorAll("header, footer, nav, main, aside, search, [role]"))) {
        const role = element.getAttribute("role");
        const tag = element.tagName.toLowerCase();
        if (role === "banner" || (tag === "header" && !role && outside(element))) landmarks.add("banner");
        if (role === "contentinfo" || (tag === "footer" && !role && outside(element))) landmarks.add("contentinfo");
        if (role === "navigation" || (tag === "nav" && !role)) landmarks.add("navigation");
        if (role === "main" || (tag === "main" && !role)) landmarks.add("main");
        if (role === "complementary" || (tag === "aside" && !role)) landmarks.add("complementary");
        if (role === "search" || tag === "search") landmarks.add("search");
    }

    const fieldType = (field: Element) => {
        const tag = field.tagName.toLowerCase();
        if (tag !== "input") return tag;
        return (field.getAttribute("type") || "text").toLowerCase();
    };
    const forms = Array.from(document.querySelectorAll("form")).map((form) => [...new Set(Array.from(form.querySelectorAll("input, select, textarea"))
        .map(fieldType)
        .filter((type) => !["hidden", "submit", "button", "reset", "image"].includes(type)))].sort());

    let cards = false;
    for (const parent of Array.from(document.querySelectorAll("body *"))) {
        const groups = new Map<string, number>();
        for (const child of Array.from(parent.children)) {
            const linked = child.matches("a[href]") || child.querySelector("a[href]") !== null;
            const rich = child.querySelector("img, h1, h2, h3, h4, h5, h6") !== null;
            if (!linked || !rich) continue;
            const key = `${child.tagName}.${child.className}`;
            groups.set(key, (groups.get(key) ?? 0) + 1);
        }
        if ([...groups.values()].some((count) => count >= 3)) {
            cards = true;
            break;
        }
    }

    return {
        landmarks: [...landmarks].sort(),
        forms,
        cards,
        headings: Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) => heading.tagName.toLowerCase()),
        interactive: document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]').length,
    };
}

/** The structural signature: landmarks, forms (count and each form's field types), cards. Counts are left out. */
export function signatureOf(outline: PageOutline) {
    const forms = outline.forms.map((types) => `[${types.join(",")}]`).sort();
    return `landmarks:${outline.landmarks.join(",")}|forms:${forms.length}${forms.join("")}|cards:${outline.cards ? "yes" : "no"}`;
}

/** The form signature alone (Gate A revision, TFP-176): how many forms, and each one's field types. It is what splits an address type. */
export function formSignatureOf(outline: PageOutline) {
    const forms = outline.forms.map((types) => `[${types.join(",")}]`).sort();
    return `forms:${forms.length}${forms.join("")}`;
}

/** Decision 2's narrow reading, for the measurement only: field types limited to password, email, textarea and search. */
export function narrowSignatureOf(outline: PageOutline) {
    const keep = new Set(["password", "email", "textarea", "search"]);
    return signatureOf({ ...outline, forms: outline.forms.map((types) => types.filter((type) => keep.has(type))) });
}

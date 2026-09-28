import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import { escapeForSingleQuotedString } from "./format";
import { discoverForms, fieldLocator, fieldName, submitButton, type DiscoveredForm } from "./forms";
import type { ActionableElementDetail, ContentProfile } from "./types";

// TFP-116 (Phase 34, Decision 3). The template's only security check was "the
// URL is HTTPS", written only for HTTPS targets - on http:// targets it wrote
// a note and nothing else, so nothing checked input handling at all.
//
// Two kinds of result, deliberately different (Emil, 2026-09-28):
// - an executed script payload FAILS the test: it is an exploitable defect;
// - a missing security header or cookie flag is recorded as a named FINDING
//   (a Playwright annotation, shown in the run report) and does not fail the
//   test. Many real sites have no CSP, and TestForge cannot tell a session
//   cookie from an analytics one, so failing would turn most runs red on
//   hardening gaps rather than defects.
//
// Generated code avoids template literals so it needs no second escaping.

const MAX_FORMS = 3;

/**
 * A script-shaped value. If a page renders it as HTML, the image fails to
 * load and its handler runs - which the test detects without relying on a
 * dialog. The leading `">` breaks out of an attribute, the common reflection.
 */
export const SCRIPT_PAYLOAD = `"><img src=x onerror="window.__testforgeXss=(window.__testforgeXss||0)+1">`;

const PAYLOAD_SKIP_REASON = `script-payload check: submits a form on the live site, so it only runs when ${INTERACTIVE_ENV_VAR}=1 is set for the run`;

// Only free-text fields take the payload. An email, url or tel field would
// fail the browser's own validation with it, block the submit, and let the
// test "pass" having tested nothing - so those get a valid dummy value instead.
const PAYLOAD_INPUT_TYPES = new Set(["", "text", "search"]);

/** Valid values for typed fields that would otherwise block the submit. */
export const DUMMY_VALUES: Record<string, string> = {
    email: "testforge-check@example.com",
    url: "https://example.com/",
    tel: "5550100",
};

function isVisibleNamed(element: ActionableElementDetail) {
    return element.isVisible && Boolean(fieldName(element));
}

/** Fields a script payload is typed into: visible free-text fields, never passwords. */
function isPayloadField(element: ActionableElementDetail) {
    if (!isVisibleNamed(element)) return false;
    if (element.elementType === "textarea") return true;
    return element.elementType === "input" && PAYLOAD_INPUT_TYPES.has(element.locator.inputType);
}

function isDummyField(element: ActionableElementDetail) {
    return isVisibleNamed(element) && element.elementType === "input" && element.locator.inputType in DUMMY_VALUES;
}

export interface PayloadForm extends DiscoveredForm {
    fields: ActionableElementDetail[];
    dummyFields: ActionableElementDetail[];
}

export function findPayloadForms(contentProfile: ContentProfile | null): PayloadForm[] {
    return discoverForms(contentProfile)
        .map((form) => ({ ...form, fields: form.elements.filter(isPayloadField), dummyFields: form.elements.filter(isDummyField) }))
        .filter((form) => form.fields.length > 0)
        .slice(0, MAX_FORMS);
}

function httpsTest() {
    // Unchanged from before TFP-116, and still only for https:// targets.
    return `  test('uses HTTPS for the requested public test target', async ({ page }) => {
    await page.goto('/');
    expect(new URL(page.url()).protocol).toBe('https:');
  });`;
}

function securityHeadersTest() {
    return `  test('landing page security headers (recorded as findings)', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'no response for /').not.toBeNull();
    const headers = await response!.allHeaders();
    const csp = headers['content-security-policy'] ?? '';
    const findings: string[] = [];
    if (!csp) findings.push('no Content-Security-Policy header: nothing limits what an injected script could do');
    if ((headers['x-content-type-options'] ?? '').toLowerCase() !== 'nosniff') findings.push('X-Content-Type-Options is not "nosniff": browsers may guess content types');
    if (!headers['x-frame-options'] && !/frame-ancestors/i.test(csp)) findings.push('no X-Frame-Options or CSP frame-ancestors: the page can be framed by another site (clickjacking)');
    // Hardening gaps, not defects: recorded without failing the test.
    for (const description of findings) test.info().annotations.push({ type: 'finding', description });
  });`;
}

function cookieFlagsTest() {
    return `  test('cookies set by the site carry protective flags (recorded as findings)', async ({ page, context }) => {
    await page.goto('/', { waitUntil: 'load' });
    const url = new URL(page.url());
    const isHttps = url.protocol === 'https:';
    const own = (await context.cookies()).filter((cookie) => {
      const domain = cookie.domain.replace(/^\\./, '');
      return url.hostname === domain || url.hostname.endsWith('.' + domain);
    });
    for (const cookie of own) {
      const missing: string[] = [];
      if (!cookie.httpOnly) missing.push('HttpOnly (scripts can read it)');
      if (isHttps && !cookie.secure) missing.push('Secure (it can be sent over plain HTTP)');
      if (cookie.sameSite === 'None') missing.push('a restrictive SameSite (it is sent on cross-site requests)');
      if (missing.length > 0) {
        test.info().annotations.push({ type: 'finding', description: 'cookie "' + cookie.name + '" has no ' + missing.join(', no ') });
      }
    }
  });`;
}

function payloadTest(form: PayloadForm) {
    const path = escapeForSingleQuotedString(form.path);
    const names = form.fields.map((field) => escapeForSingleQuotedString(fieldName(field)));
    const title = escapeForSingleQuotedString(`script-shaped input is not executed: ${form.fields.map(fieldName).join(", ")} on ${form.path}`);
    const submit = submitButton(form);
    const fill = [
        ...form.fields.map((field) => `    await ${fieldLocator(field)}.fill(payload);`),
        ...form.dummyFields.map((field) => `    await ${fieldLocator(field)}.fill('${escapeForSingleQuotedString(DUMMY_VALUES[field.locator.inputType])}');`),
    ].join("\n");
    const submitStep = submit
        ? `await form.getByRole('button', { name: '${escapeForSingleQuotedString(submit.text || submit.locator.name)}' }).first().click();`
        : `await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());`;

    return `  test('${title}', async ({ page }) => {
    test.skip(process.env.${INTERACTIVE_ENV_VAR} !== '1', '${escapeForSingleQuotedString(PAYLOAD_SKIP_REASON)}');

    const payload = '${escapeForSingleQuotedString(SCRIPT_PAYLOAD)}';
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.goto('${path}', { waitUntil: 'domcontentloaded' });
${fill}
    const form = ${fieldLocator(form.fields[0])}.locator('xpath=ancestor::form').first();

    // If the browser's own validation would block the submit, nothing gets
    // tested - say so and skip, rather than pass having checked nothing.
    const invalid = await form.evaluate((el) =>
      Array.from((el as HTMLFormElement).elements)
        .filter((field) => 'checkValidity' in field && !(field as HTMLInputElement).checkValidity())
        .map((field) => (field as HTMLInputElement).name || (field as HTMLInputElement).id || field.tagName.toLowerCase())
    );
    test.skip(invalid.length > 0, 'the form on ${path} would not submit (browser validation rejects: ' + invalid.join(', ') + '), so the payload could not be tested');

    const submitted = page
      .waitForRequest((request) => request.isNavigationRequest() || request.method() !== 'GET', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    ${submitStep}
    test.skip(!(await submitted), 'submitting the form on ${path} sent no request, so the payload never reached the site');
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const executed = await page.evaluate(() => (window as unknown as { __testforgeXss?: number }).__testforgeXss ?? 0);
    expect(
      executed + dialogs.length,
      'script-shaped input typed into ${names.join(", ")} on ${path} ran on ' + page.url() + ' after submitting: the page renders user input as HTML (cross-site scripting)'
    ).toBe(0);
  });`;
}

/** Decision 3's security suite: tests plus the notes that explain them. */
export function buildSecurityChecks(baseUrl: string, contentProfile: ContentProfile | null): { tests: string[]; notes: string[] } {
    const isHttps = new URL(baseUrl).protocol === "https:";
    const forms = findPayloadForms(contentProfile);
    const tests = [...(isHttps ? [httpsTest()] : []), securityHeadersTest(), cookieFlagsTest(), ...forms.map(payloadTest)];
    const notes = [
        ...(isHttps ? [] : ["This target is not HTTPS by default, so deeper transport-security validation should be handled outside this browser suite."]),
        "Security: missing headers and cookie flags are recorded as findings in the run report and do not fail a test; an executed script payload does.",
        forms.length > 0
            ? `Security: the script-payload tests submit real forms, so they are skipped unless ${INTERACTIVE_ENV_VAR}=1 is set for the run (the "Run interactive tests" option).`
            : contentProfile
              ? "Security: no form with a text field was found on the inspected pages, so no script-payload test was generated."
              : "Security: no page inspection data, so no form was found for a script-payload test. Run introspection first.",
    ];
    return { tests, notes };
}

import { selectJourneys } from "@/lib/introspect/journeys";
import { INTERACTIVE_ENV_VAR } from "@/lib/run/interactive";
import { gateDetails } from "@/lib/run/test-gates";
import { escapeForDoubleQuotedSelector, escapeForSingleQuotedString } from "./format";
import type { CandidateJourney, ContentProfile, ContentRules, SiteGraphEdge } from "./types";

// Journey tests submit real forms on the live site, so they're skipped
// unless the run explicitly enables interactive tests (see interactive.ts).

export const JOURNEY_TESTS_NOTE =
    `Journey tests (Phase 19, TFP-091): one end-to-end test per journey selected on the review screen, walking its real pages and elements in order. They submit real forms with generic sample values, so they are skipped unless ${INTERACTIVE_ENV_VAR}=1 is set for the run (the "Run interactive tests" option). A named flow's declared exit is asserted for real after the last submit.`;

// The exact, unescaped title the generated test carries - reused by
// discovered-coverage.ts to match a journey against the run's executed
// tests, the same title-matching pattern the dependency tests use.
export function buildJourneyTitle(journey: CandidateJourney) {
    const flow = journey.label ? `${journey.label}: ` : "";
    return `journey ${flow}${journey.path.join(" > ")}`;
}

function quote(value: string) {
    return `'${escapeForSingleQuotedString(value)}'`;
}

function attributeSelector(attributeName: string, rawValue: string) {
    // TFP-267: anything a CSS name can't hold, not just the `:` of an attribute like xlink:href.
    const name = attributeName.replace(/[^\w-]/g, "\\$&");
    // onclick is matched by substring: the raw value is the URL a script
    // assigns to location, not the whole attribute.
    const operator = attributeName === "onclick" ? "*=" : "=";
    return `[${name}${operator}"${escapeForDoubleQuotedSelector(rawValue)}"]`;
}

function elementSelector(step: SiteGraphEdge) {
    return `${step.tagName || "*"}${attributeSelector(step.attributeName, step.rawValue)}:visible`;
}

function stepLabel(step: SiteGraphEdge) {
    return step.text || step.rawValue || step.tagName;
}

// Generic, side-effect-agnostic sample input: enough for a form's own
// client-side validation to let the submit through. TestForge has no way to
// know a real credential or business value, so a flow that needs one (a
// login) will fail its declared-exit assertion with a specific message
// rather than pass on a guess.
export const JOURNEY_HELPERS = `const normalizePath = (pathname: string) => pathname.replace(/\\/$/, '') || '/';

async function fillFormWithSampleValues(form: import('@playwright/test').Locator) {
  const sampleByType: Record<string, string> = {
    email: 'testforge@example.com', password: 'TestForge-Sample-1', number: '1', tel: '5550100',
    url: 'https://example.com', date: '2026-01-15', time: '10:00', search: 'test',
  };
  const fields = form.locator('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea');
  for (let index = 0; index < await fields.count(); index++) {
    const field = fields.nth(index);
    if (!(await field.isVisible()) || !(await field.isEditable())) continue;
    const type = ((await field.getAttribute('type')) ?? 'text').toLowerCase();
    await field.fill(sampleByType[type] ?? 'TestForge sample');
  }
  const selects = form.locator('select');
  for (let index = 0; index < await selects.count(); index++) {
    const select = selects.nth(index);
    if (!(await select.isVisible()) || !(await select.isEnabled())) continue;
    const optionCount = await select.locator('option').count();
    if (optionCount > 0) await select.selectOption({ index: optionCount > 1 ? 1 : 0 });
  }
  const required = form.locator('input[type=checkbox][required], input[type=radio][required]');
  for (let index = 0; index < await required.count(); index++) {
    if (await required.nth(index).isVisible()) await required.nth(index).check();
  }
}`;

function stepCode(journey: CandidateJourney, index: number) {
    const step = journey.steps[index];
    const number = index + 2;
    const isLast = index === journey.steps.length - 1;
    const label = quote(stepLabel(step));
    const to = quote(step.to);
    const selector = quote(elementSelector(step));

    if (step.kind !== "form-submit") {
        return `
    // Step ${number}: follow "${stepLabel(step).replace(/[\r\n]+/g, " ")}" (${step.kind}) to ${step.to}
    const step${number} = page.locator(${selector}).first();
    await expect(step${number}, 'step ${number}: the ${escapeForSingleQuotedString(step.kind)} ' + ${label} + ' should be visible on ' + atPath()).toBeVisible();
    await step${number}.click();
    await page.waitForURL((url) => normalizePath(url.pathname) === ${to}, { timeout: 15000 }).catch(() => {});
    expect(atPath(), 'step ${number}: following ' + ${label} + ' should reach ' + ${to}).toBe(${to});`;
    }

    // form-submit: the destination named on the edge is the form's declared
    // action, which a server may redirect away from (post/redirect/get), so
    // the step asserts the submit reached that endpoint and it didn't fail -
    // not that the browser ended on it. Only a mid-path submit also asserts
    // where the walk continues from.
    const submitter = step.tagName === "form"
        ? `form${number}.locator('button[type=submit], input[type=submit], button:not([type])').first()`
        : `submitter${number}`;
    const formLookup = step.tagName === "form"
        ? `const form${number} = page.locator(${selector}).first();
    await expect(form${number}, 'step ${number}: the form ' + ${label} + ' should be visible on ' + atPath()).toBeVisible();`
        : `const submitter${number} = page.locator(${selector}).first();
    await expect(submitter${number}, 'step ${number}: the submit control ' + ${label} + ' should be visible on ' + atPath()).toBeVisible();
    const form${number} = submitter${number}.locator('xpath=ancestor::form').first();`;

    return `
    // Step ${number}: fill and submit "${stepLabel(step).replace(/[\r\n]+/g, " ")}" (form submit) to ${step.to}
    ${formLookup}
    await fillFormWithSampleValues(form${number});
    const submitted${number} = page.waitForResponse((response) => normalizePath(new URL(response.url()).pathname) === ${to}, { timeout: 15000 });
    if (await ${submitter}.count() > 0) {
      await ${submitter}.click();
    } else {
      await form${number}.evaluate((el) => (el as HTMLFormElement).requestSubmit());
    }
    const submitResponse${number} = await submitted${number}.catch(() => null);
    expect(submitResponse${number}, 'step ${number}: submitting ' + ${label} + ' should send a request to ' + ${to}).not.toBeNull();
    expect(submitResponse${number}!.status(), 'step ${number}: the submit to ' + ${to} + ' should not fail').toBeLessThan(500);
    await page.waitForLoadState('domcontentloaded').catch(() => {});${isLast ? "" : `
    await page.waitForURL((url) => normalizePath(url.pathname) === ${to}, { timeout: 15000 }).catch(() => {});
    expect(atPath(), 'step ${number}: after submitting ' + ${label} + ' the walk should continue from ' + ${to}).toBe(${to});`}`;
}

function exitCode(journey: CandidateJourney) {
    // Decision 4's amendment: a named flow's exit beyond the graph was only
    // ever declared, never observed, because introspect never submits a
    // form. This is where it is verified for real.
    if (!journey.declaredExitPath || journey.exitInGraph) {
        return "";
    }

    const exit = quote(journey.declaredExitPath);
    return `

    // Declared exit: the journey names ${journey.declaredExitPath} as where this flow ends, which introspect could not observe.
    await page.waitForURL((url) => normalizePath(url.pathname) === ${exit}, { timeout: 15000 }).catch(() => {});
    expect(atPath(), 'the journey ' + ${quote(journey.label ?? "")} + ' declares ' + ${exit} + ' as its exit, but after submitting the app ended on ' + atPath()).toBe(${exit});`;
}

function journeyTest(journey: CandidateJourney) {
    const title = escapeForSingleQuotedString(buildJourneyTitle(journey));
    const entry = quote(journey.path[0]);
    const skipReason = escapeForSingleQuotedString(
        `interactive journey test: submits forms on the live site, so it only runs when ${INTERACTIVE_ENV_VAR}=1 is set for the run`
    );

    return `  test('${title}', ${gateDetails("interactive")}, async ({ page }) => {
    test.skip(process.env.${INTERACTIVE_ENV_VAR} !== '1', '${skipReason}');

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const atPath = () => normalizePath(new URL(page.url()).pathname);

    // Step 1: open the entry page ${journey.path[0]}
    const entryResponse = await page.goto(${entry}, { waitUntil: 'domcontentloaded' });
    expect(entryResponse?.status() ?? 0, 'step 1: ' + ${entry} + ' should respond without an error').toBeLessThan(400);
    expect(atPath(), 'step 1: the entry page should be ' + ${entry}).toBe(${entry});${journey.steps.map((_, index) => stepCode(journey, index)).join("")}${exitCode(journey)}

    await expect(page.locator('body'), 'the page the journey ended on should still render').toBeVisible();
    expect(pageErrors, 'no uncaught page errors along the journey: ' + pageErrors.join('; ')).toEqual([]);
  });`;
}

// Module-level helpers the journey tests share, emitted once ahead of the
// suites (an array entry inside a suite would consume a test id).

// One test per journey selected on the review screen (TFP-090), in rank
// order. No selection means no test - never "every candidate".
export function buildJourneyTests(contentProfile: ContentProfile | null, contentRules: ContentRules): string[] {
    return selectJourneys(contentProfile?.journeys ?? [], contentRules.selectedJourneyIds).map(journeyTest);
}

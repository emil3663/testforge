# Real-Site Run Findings — TestForge Backlog (2026-10-01)

**Version:** 1.0
**Date:** 2026-10-01
**Status:** Draft — for review, not yet started

## Context

Running TestForge three times against a real WordPress site
(https://rizonetech.com/, read-only, build `899bdd9`) surfaced four issues
in TestForge itself, separate from the site's own defects. Evidence is in
`benchmarks/2026-10-01-rizonetech/` (run ids: Standard `5ce88c9c`, passive
security `4134252c`, accessibility `a3eb621d`).

These are TestForge template/consistency faults, not rizonetech.com's
problems. They are logged here rather than fixed in place because they were
found in an exploratory run, not while building a ticket; the standing
execution policy's "fix defects in-ticket" applies once each is picked up.

TFP-140 was the last issued ticket.

## Backlog

### TFP-141 — The anchor-target check must not crash on `href="#"`

- **Phase:** 35 (follow-up) · **Priority:** P1
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** the "anchor links point to existing in-page
  targets" check (TFFU-019 and siblings) crashed on 5 of 5 pages with
  `locator.count: Unexpected token "#" while parsing css selector "#"`. It
  reads a link's `href="#"` and passes `#` straight to a CSS locator, which
  is invalid. `href="#"` placeholder links are common, so this fails against
  ordinary sites and reports a tool crash as a site failure.
- **Scope:**
  - In the anchor-target check, treat `href="#"` and `href=""` as "no
    in-page target to resolve", not as a selector.
  - Escape or reject any fragment that is not a valid id before building the
    locator.
- **Deliverables:**
  - The fix in the Standard functional template.
  - A fixture page with an `href="#"` link and an empty-fragment link.
  - `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - On a page with an `href="#"` link, the check completes and reports the
    link as having no in-page target, with no thrown error.
  - The fixture case passes; the template's output on fixed inputs is
    measured unchanged except for this check.
- **Dependencies:** None.

### TFP-142 — The hover and HTTPS/SSL checks must not hang for 30 s per page

- **Phase:** 35 (follow-up) · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `functional`
- **Problem it solves:** the hover-state check (TFFU-014 and siblings) timed
  out at 30 s on 5 of 5 pages, and the HTTPS/SSL check on 3 pages. A per-page
  check timing out on every page is almost certainly a wait that never
  settles, not a slow site — and these timeouts pushed the Standard run to
  1,766 s against its 1,800 s budget.
- **Scope:**
  - Find what each check waits on and why it never settles on a normal page.
  - Give each an explicit, shorter timeout with a stated reason, so a hang is
    reported as a check fault, not a site failure.
- **Deliverables:**
  - The fix, and a `TEST_PLAN.md` case covering the timeout-reason path.
- **Acceptance criteria:**
  - On a healthy page, both checks complete well under the per-test timeout.
  - A deliberately stalled dependency is reported as the check's own timeout
    with its reason, not as a plain 30 s failure.
- **Dependencies:** None.

### TFP-143 — Resolve the double-reporting between the Standard accessible-name checks and the axe scan

- **Phase:** 35 (follow-up) · **Priority:** P3
- **Suggested labels:** `enhancement`, `generate`, `accessibility`
- **Problem it solves:** the Standard run's hand-written accessible-name
  checks (TFAC-008/009/018/038, located by `getByText`) and the Comprehensive
  axe scan's `link-name` rule report the same missing-name links, and the
  `getByText` version is the noisier of the two. On a Comprehensive run the
  two overlap.
- **Scope:**
  - Decide one source of truth for accessible-name coverage when a
    Comprehensive accessibility run is available (likely the axe scan).
  - Either defer the Standard checks there, or de-duplicate the report so one
    issue isn't counted twice.
- **Deliverables:**
  - The decision recorded, the change, and a `TEST_PLAN.md` case.
- **Acceptance criteria:**
  - A single missing-name link produces one reported issue, not two, on a
    Comprehensive accessibility run.
- **Dependencies:** None. Judgement call for Emil and Martin before building.

### TFP-144 — One cookie-scope rule across the Standard and passive-security checks

- **Phase:** 35 (follow-up) · **Priority:** P2
- **Suggested labels:** `bug`, `generate`, `security`
- **Problem it solves:** the two runs disagree on the same site. The Standard
  security check flagged all 6 cookies for missing HttpOnly/Secure; the
  passive-security check flagged none, because it only inspects
  session-named cookies. A reader comparing the two reports sees a
  contradiction.
- **Scope:**
  - Choose one rule for which cookies are in scope for the HttpOnly/Secure
    check (all cookies, or session-named only), with the reason.
  - Apply it in both the Standard and the passive-security paths.
- **Deliverables:**
  - The shared rule, applied in both paths, and a `TEST_PLAN.md` case that
    asserts the two paths agree on the same fixture cookies.
- **Acceptance criteria:**
  - On a fixture with a mix of session and non-session cookies lacking the
    flags, the Standard and passive-security runs report the same set.
- **Dependencies:** None.

## Recommended Execution Order

1. TFP-141 (a crash; highest value).
2. TFP-142.
3. TFP-144.
4. TFP-143 (needs a design decision first).

## Suggested Milestone Gate

### Gate — Real-site noise removed
- TFP-141, TFP-142 and TFP-144 landed and independently verified, with the
  template's output on fixed inputs measured unchanged apart from the named
  checks. TFP-143 either done or explicitly deferred with its reason.

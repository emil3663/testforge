---
name: regression-safety-net
description: >
  After a fix, separately confirm two different things: that the originally
  reported failure is actually gone (confirmation testing), and that nothing
  outside the intended change broke (regression testing). Use this skill
  after a bug fix or behavior change, before calling the change done, when
  "the fix works" needs to be more than a feeling.
---

# Confirm the fix, then check for damage — two separate jobs

## The gap this closes

"I fixed it and the tests pass" conflates two different claims. ISTQB's
change-related testing splits them on purpose: **confirmation testing** asks
whether the specific, originally-reported failure is actually gone.
**Regression testing** asks whether anything else, outside the intended
change, now behaves differently. A fix can pass one and fail the other — a
patch that makes the reported bug disappear while breaking an unrelated path
is a real, common shape, and blending the two checks into one "does it work
now" pass is how that shape gets missed.

## Inputs you need from the user

1. **The original failure** — a reproduction, or a description specific
   enough to reproduce: what was done, what happened, what should have
   happened instead.
2. **The fix** — the diff, or the commit(s).
3. **What the fix was not supposed to touch** — if not stated, infer it from
   the diff's actual scope and say so, so the regression check has a
   boundary to check against rather than "everything."

## Output format

Two named sections, always both, never blended:

```
## Confirmation
Reproduction: <the exact steps from Inputs>
Before the fix: <what happened — cite the report, or reproduce it>
After the fix:  <what happens now, checked directly, not assumed from the diff>
Verdict: <confirmed gone | still reproduces | partially — state what changed>

## Regression
Scope checked: <what was exercised beyond the fixed path, and why that's the
                 right boundary>
Findings: <anything that now behaves differently and wasn't the point of the
           fix — or "none found, within the scope checked">
Not checked: <what's outside the scope above, named explicitly, not implied>
```

## Rules

**Confirmation requires actually reproducing the before-state, not trusting
the bug report.** If the original failure can't be reproduced against the
pre-fix code, the confirmation is "the described symptom no longer occurs,"
which is weaker than "the actual defect is fixed" — say which one this is.

**A confirmation test should fail against the old code and pass against the
fix.** Written the other way — passing against both — it isn't testing the
fix, it was already going to pass. Run it against the pre-fix code (revert
locally, run, restore) whenever that's cheap enough to do; when it isn't,
say explicitly that this step was skipped and why.

**Regression scope is a judgment call, not "run everything."** State what
was actually exercised and why that's the right boundary for this change —
a one-line CSS fix and a shared-state refactor warrant very different scope,
and the difference should be argued, not defaulted.

**"No regressions found" is a scope-bounded claim, not a guarantee.** Name
what wasn't checked as plainly as what was. A regression outside the checked
scope isn't a failure of this skill — an unstated scope that later turns out
to have missed something is.

**These are two separately-testable claims — never merge them into one
verdict.** "It works now" can be true of confirmation and false of
regression, or the reverse. Reporting one combined pass/fail hides which one
actually failed.

## Worked example

**Fix:** `test-assist`'s `_close_launcher()` change (desktop stability
matrix, defect 11) — changed from calling `QApplication.instance().quit()`
to hiding the launcher, so closing the floating widget no longer takes the
tray icon down with it.

```
## Confirmation
Reproduction: activate the floating launcher, click its close (X) button.
Before the fix: the entire application quit — tray icon gone, "Show
                Launcher" unreachable, only relaunching the exe recovered it.
After the fix:  clicking close hides the launcher; the tray icon and "Show
                Launcher" remain, and reactivating restores it via the new
                restore() path.
Verdict: confirmed gone.
test_INS_02_close_button_hides_instead_of_quitting monkeypatches
QApplication.quit at the class level (this suite shares one real
QApplication) and asserts it is never called on this path — verified to fail
against the pre-fix code before being trusted.

## Regression
Scope checked: every other route that used to call quit() or show()/raise_()
directly — the tray menu's "Exit" (still calls quit, now the only route
that does), "Show Launcher", and a tray-icon click (both changed to go
through the new restore() instead of show()/raise_() directly, since
restore() also repositions the launcher if its screen is gone).
Findings: restore()'s repositioning behavior (DSP-15, INS-06) needed its own
regression check, since it's now reached from two additional call sites that
didn't go through it before — confirmed both still reposition correctly when
the launcher's prior screen is unplugged.
Not checked: behavior when the OS itself force-kills the process (not
reachable through any UI path this fix touches).
```

## How Emil invokes this skill

> "Run regression-safety-net on this fix before I call it done."

Or split, when only one half is in question: "just the confirmation side —
did this actually fix what was reported?"

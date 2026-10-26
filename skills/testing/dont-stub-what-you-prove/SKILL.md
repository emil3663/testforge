---
name: dont-stub-what-you-prove
description: >
  Review a test and check whether the thing being mocked or stubbed is the
  same thing the assertion claims to verify — flag it when the mock stands
  between the code and the thing the test exists to prove. Use this skill
  when reviewing a test file, especially one using a stub, spy, or
  monkeypatch, before trusting that a green run means what it claims.
---

# Don't stub what you're trying to prove

## The gap this closes

A test can be green and prove nothing. `test-assist`'s TA-227 is the concrete
case: two dispatch tests replaced the exact function they were supposed to be
testing with a call-recording lambda, then asserted the lambda was called —
which proves the code *reached* the call, not that the thing the call was
supposed to do actually happened.

```python
calls: list[str] = []
launcher._start_capture = lambda: calls.append("start_capture")
...
assert calls == ["start_capture"]
```

`test_TA217_global_hotkey_closes_an_open_about_dialog_before_capturing` and
its button-click sibling both did this. Neither could ever detect a real
capture-overlay regression — the overlay itself was stubbed out of the test
entirely, and the assertion checks that a lambda ran, which it always will.

## Inputs you need from the user

1. **The test file(s)** to review, or a diff introducing new stubs.
2. **What the test's name or docstring claims to verify** — read this
   before reading the body, so the mismatch is checked against the actual
   claim, not against what seems reasonable in isolation.

## Output format

For each test using a stub, mock, spy, or monkeypatch:

```
Test:      <name>
Mocks:     <what is replaced>
Asserts:   <what the assertion actually checks>
Verdict:   <clean | stubs what it proves>
```

For anything flagged `stubs what it proves`, name the retrofit: what should
run for real, and what real end-state the assertion should check instead.

## Rules

**Ask what the test's name claims, then what its assertion actually checks.**
A mismatch between those two is the defect.
`test_..._closes_an_open_about_dialog_before_capturing` claims a capture
happens; asserting a lambda ran does not check that.

**The forbidden case is narrow: don't stub the action's own immediate,
in-process effect.** A dispatch/wiring test may legitimately stub what's
*downstream* of the action under test — file I/O, the network, an OS API, or
another method whose own correctness is independently verified elsewhere
unstubbed. It may never stub the one thing the test exists to check. TA-227's
own follow-up rule: if a downstream method's correctness is proven by a
*different*, unstubbed test, a dispatch test stubbing that method to check
routing is fine — the claim and the proof live in different tests, not
nowhere.

**A signal-spy is not the same shape as a mock-equals-assertion-target.**
Connecting to a real signal a real operation actually emits and recording
that it fired is observation, not substitution — the operation still ran for
real. The tell: did the code path the test claims to verify actually execute,
or was it replaced by the thing doing the recording?

**Grep for the shape, don't stop at the first instance.** TA-227's own fix
checked every other stub-and-assert-called shape in both affected test files
before calling the fix done, and found none beyond the two originally named
— but that check is part of the fix, not optional once one instance is
found.

**Retrofit to the real end state, not a bigger mock.** The fix is not a more
detailed lambda — it's letting the real function run and asserting something
that can only be true if it actually happened (e.g. `launcher._overlay`
visible and interactive, not `calls == [...]`).

## Worked example

**Test:** `test_TA217_global_hotkey_closes_an_open_about_dialog_before_capturing`

```
Mocks:     launcher._start_capture replaced with a lambda that appends to
           a list.
Asserts:   calls == ["start_capture"]
Verdict:   stubs what it proves. The test's name claims a capture happens;
           the assertion only checks that a function reference was called,
           which is true whether or not _start_capture's real body does
           anything at all — including if it were deleted and replaced with
           `pass`.
Retrofit:  let the real _start_capture() run, then assert launcher._overlay
           is visible and interactive — the actual thing "before capturing"
           claims happened.
```

## How to invoke this skill

> "Run dont-stub-what-you-prove over this test file before I trust it."

Or narrower, on a single suspicious test: "does this test's mock match what
it's asserting?"

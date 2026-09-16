# TFP-039 calibration and trial findings

Full, unsummarized output from the review required before promoting
`code-structure` and `refactor-audit` out of `skills/proposed/`. Two checks:
`code-structure`'s thresholds applied to one already-reviewed file
(`src/app/page.tsx`), and `refactor-audit` run for real against one directory
(`src/app/_hooks/`), printed rather than filed, per the skills' own
suggested first run.

## 1. `code-structure` calibration: `src/app/page.tsx`

**File:** `src/app/page.tsx`, 353 lines. Already reviewed and trusted —
decomposed from 4,739 lines down to this in TFP-023 (Phase 16).

**Threshold applied, as written before this calibration:**
> Page or route over ~300 lines — it is implementing, not assembling.

353 > 300, so the rule fires. Applying `code-structure`'s own worked-example
format (Files / Placement / Seams) as if this were a real finding:

**Reading the file (line ranges as of this audit):**
- Lines 1-39 (39 lines): imports and a static `websiteSchema` object. Not
  implementation — pure boilerplate.
- Lines 41-201 (~160 lines): component body. Roughly 75 lines are handler
  functions (`togglePractice`, `handleGenerate`, three `boundHandle*`
  wrappers) and hook wiring (`useCrawl`, `useGeneration`, `useRun`); roughly
  85 lines are inline derived-state computation — `isContentAwareReady`,
  `runBlockedMessage`, `selectedPracticeSignature`, `busyTarget`,
  `busyBaseUrl`, `busyInspectionPaths`, `busyLabel`, `canGenerateOrRun`, and
  the `runParams` object — composed from the three hooks' outputs plus local
  UI state. Some of this composition already delegates to pure functions in
  `_lib/derive.ts` (`deriveContentInsights`, `deriveBusyInspectionTargets`,
  `deriveRunProgressDisplay`, `normalizeBaseUrl`, `parseContentLines`,
  `normalizeInspectionPaths`); the ~85-line block itself does not.
- Lines 203-353 (~150 lines): the JSX return. This is genuinely
  assembly-shaped — it composes `RunProgressOverlay`, header markup, a hero
  section, `CreationSection`, `GeneratedSuiteSection`, an error banner, a
  report-popup notice, and `ReportSection`, mostly via prop-spreading from
  the three hooks. Reading it requires scanning what's present, not
  understanding how something works — exactly what `code-structure`'s "pages
  assemble, they do not implement" rule asks for.

```
Files:     src/app/_lib/derive.ts  (existing file, +~25 lines)
Placement: pull the ~85-line derived-view-readiness block (isContentAwareReady,
           runBlockedMessage, selectedPracticeSignature, busyTarget,
           busyBaseUrl, busyInspectionPaths, busyLabel, canGenerateOrRun,
           runParams) into one pure function taking the three hooks' output
           shapes plus local UI state as plain values, returning a view-model
           object. page.tsx calls it once and destructures.
Seams:     the extracted function is unit-testable directly with plain object
           inputs, no DOM or rendering required — same shape as the five
           derive.ts functions already used in this file.
```

**Verdict: partial miscalibration, not a clean catch.** The threshold fired
correctly in the mechanical sense (353 > 300), and there is a real,
extractable seam (~85 lines, the derived-view-readiness block). But the
rule's specific claim — "it is implementing, not assembling" — overclaims:
roughly 55% of the file (the 150-line JSX return plus 39 lines of imports/
boilerplate) is legitimate assembly of already-extracted pieces, exactly
what the file is supposed to do after TFP-023's decomposition. A flat
line-count threshold can't distinguish "long because it composes many
extracted pieces" from "long because it still implements inline" — it
conflated the two here. The genuine finding is real but modest, not the
"implementing, not assembling" framing the rule asserted.

**Action taken:** reworded the threshold's action from an assertion to a
check (`skills/engineering/code-structure.md`, thresholds table) — "check
the split between composition and inline derived-state logic before calling
it implementation" — plus this writeup, linked from that file. Not sent back
for more work: the underlying signal (long page/route files are worth a
look) is still sound, only the auto-generated conclusion was too strong.

## 2. `refactor-audit` trial: `src/app/_hooks/`

**Scope:** `src/app/_hooks/` only — `useCrawl.ts` (286 lines), `useGeneration.ts`
(230 lines), `useRun.ts` (442 lines). Printed here, not filed anywhere, per
the skill's own suggested first run.

**Already known, not re-filed, but corrected:** `refactor-audit.md`'s own
worked example already documents a set-then-revert button-label pattern in
`useRun.ts`, claiming "18 `useState` calls" in "four unrelated groups," with
the label pattern "written six times." Rereading the actual file: it has 17
`useState` calls, and the four listed groups (run execution: 6, report
viewing: 5, labels: 3, rerun selection: 1) sum to 15 — `reportPopupNotice`
and `isBusyTargetListExpanded` are uncategorized. Per "do not file what is
already known," this isn't re-filed as a new issue — but the correction, and
a wider version of the same finding, is filed below as Finding A, and a note
was added to `refactor-audit.md` itself pointing here.

### Finding B — fetch/parse/apply-snapshot pattern duplicated across two files

```markdown
## Context
The status-polling pattern — fetch, parse `{result} | {error}`, throw a
typed fallback message if `!response.ok`, then apply four to five snapshot
fields via individual setState calls — is written six times across two
files: three times in src/app/_hooks/useCrawl.ts (pollCrawlStatus lines
28-58, handleCrawlPages lines 107-122, handleStopCrawl lines 139-153) and
three times in src/app/_hooks/useRun.ts (pollRunStatus lines 52-79, startRun
lines 184-204, handleStopRun lines 258-273).

Each occurrence repeats the same five-step shape: fetch -> await
response.json() typed as Snapshot | {error?: string} -> if (!response.ok)
throw new Error(...) -> cast to Snapshot -> 4-5 setState calls copying named
fields (progress/duration/runStatus-or-crawlStatus[/cancellationRequested])
out of the snapshot.

Consequence: CrawlStatusSnapshot and RunStatusSnapshot (src/app/_lib/types)
each have their field-to-state mapping duplicated three times in their own
file; a field rename or an added progress metric needs six coordinated
edits across two files, and nothing enforces that they happen together.

## Change
Extract two small helpers per file (or one generic pair parameterized by
snapshot shape): a fetchJobStatus<T>(url, init, fallbackMessage) that does
the fetch/parse/throw step, and an applyStatusSnapshot per hook that does
the field-copying setState block. Six call sites collapse onto two helper
calls each.

## Acceptance
- All six call sites behave identically, including their distinct fallback
  error strings ("Site crawl failed" / "Run status check failed" / "Run
  failed" / "Unable to stop crawl" / "Unable to stop run").
- The fetch/parse/throw helper is unit-testable with a stubbed fetch,
  without rendering a component.
- useCrawl.ts and useRun.ts lose the repeated blocks; polling intervals
  (500ms crawl / 800ms run) and per-call-site behavior after applying the
  snapshot (e.g. pollRunStatus's early-return-on-result, handleCrawlPages's
  extra reset calls) are untouched.

## Not in this issue
Unifying useCrawl and useRun into one generic "poll a job" hook — a larger
seam than this ticket, and their post-snapshot behavior (result handling,
SEO page selection, auto-opening a report window) diverges enough that
forcing one hook would fight the actual difference between the two
features.

## Provenance
Refactor audit (trial run, TFP-039), 16 September 2026, scope
src/app/_hooks/. Found by the repeated-pattern signal, generalized from a
single-file match to a cross-file one. Not measured: how often crawl/run
status polling actually races or fails in practice.
```

### Finding A — transient-label pattern, corrected and widened

```markdown
## Context
refactor-audit.md's own worked example documents a set-then-revert
transient-label pattern in useRun.ts ("18 useState calls," "written six
times") and proposes a useTransientLabel hook. Rereading the actual file:
useRun.ts has 17 useState calls, and only 3 are the button-label pattern
(rawOutputCopyLabel, rawOutputExportLabel, htmlReportExportLabel) — the
worked example's four groups (15 total) leave reportPopupNotice and
isBusyTargetListExpanded uncategorized.

More importantly, the same set-then-revert pattern (setX("done label");
setTimeout(() => setX("idle label"), 2000); with a matching catch-branch
setX("failed label") variant) also exists in src/app/_hooks/useGeneration.ts:
copyLabel (handleCopy, lines 54-63) and saveLabel (handleSaveToExplorer,
lines 65-93). That's 5 occurrences across 2 files, not 3 in 1.

## Change
Extract useTransientLabel(initial) (as already proposed) into a shared
location (e.g. src/app/_hooks/useTransientLabel.ts) rather than inline in
useRun.ts, so both useRun.ts (3 call sites) and useGeneration.ts (2 call
sites) can use it.

## Acceptance
- All five labels behave identically, including their distinct
  failure-variant text ("Copy failed" / "Save failed" / "Copy failed" for
  raw output / "Export failed" / "Save failed" for the HTML report).
- useTransientLabel is unit-tested with fake timers and no DOM.
- useRun.ts and useGeneration.ts each lose their setTimeout blocks; nothing
  else in either file changes.

## Not in this issue
Splitting useRun.ts's other three state groups (run execution, report
viewing, rerun selection) apart — that's the worked example's own larger,
separately-filed concern, not reopened here.

## Provenance
Refactor audit (trial run, TFP-039), 16 September 2026, scope
src/app/_hooks/. Amends refactor-audit.md's own worked example: same
signal, corrected useState count (17, not 18) and widened scope (2 files, 5
call sites, not 1 file, 3 call sites). Not re-filed as new per "do not file
what is already known" — recorded as a correction to the existing worked
example instead.
```

### Summary table

| Finding | Consequence | Files | Call sites |
|---|---|---|---|
| B — fetch/parse/apply-snapshot duplication | High — silent drift risk on every snapshot field change, spans 2 files | `useCrawl.ts`, `useRun.ts` | 6 |
| A — transient-label pattern (corrects/widens the skill's own worked example) | Low — cosmetic UI feedback, but the same shape recurs beyond the file the worked example names | `useRun.ts`, `useGeneration.ts` | 5 |

**Noticed but not filed** (rank-by-consequence, one-seam-per-issue
discipline): `useRun.ts` lines 341-390 hold a ~50-line block of derived
report/rerun view-model values (`defectSeverityMax`, `hasPendingRunWork`,
`hasSingleBrowserRun`, `canContinueCancelledRun`,
`continueRunUnavailableMessage`, `seoPageGroups`,
`selectedSeoPageGroup`, `selectedSeoRecommendations`,
`rerunnableFailedTitles`, `selectedRerunnableFailedTitles`, `reportTabs`,
`filteredExecution`) computed inline rather than as named, independently
testable functions the way `getContinuationExcludedTitles` already is.
Lower consequence than A or B — it's read-only derivation, not duplicated
logic — so it wasn't written up as a full issue in this trial. Not
measured: whether `useCrawl.ts`'s own three state groups (crawl execution,
result selection, search/filter UI — 286 lines, 11 `useState` calls, also
over `code-structure`'s hook threshold) hide a similar seam; out of scope
for a `_hooks/`-only trial focused on `refactor-audit`, not `code-structure`.

## 3. Promotion decision

**`refactor-audit`: promote as-is.** The trial produced two real, measurable
findings using the skill's actual mechanics (signal table, brief template),
including one that caught and corrected an inaccuracy in the skill's own
worked example — evidence the process works, not just that nothing went
wrong. The `WORKING_AGREEMENTS.md` reference is fixed
(`docs/WORKING_AGREEMENTS.md`, copied from `test-assist`).

**`code-structure`: promote with one threshold adjustment.** The
"Page or route over ~300 lines" row's wording changed from asserting "it is
implementing, not assembling" to asking for a composition-vs-implementation
check first — see the calibration above for why. No other threshold was
exercised by this calibration (only one file, one rule), so the other three
rows are promoted unchanged pending their own evidence.

Both moved into `skills/engineering/` (`git mv`, history preserved).

# Phase 42 (TFP-193): the library leaves the generated suites unchanged

TFP-193 moved Phase 41's checks into library entries
(`src/lib/library/`). Its acceptance asks that the generated Comprehensive
suite be unchanged in what it checks. `check:template-unchanged` replays
only the Standard template on a 2026-09-29 page profile, which has none of
Phase 41's components, so it can't show that alone. This compares the
generators' whole output before and after, byte for byte, on page data
that has those components.

| File | What |
| --- | --- |
| `outputs.mts` | `inspect`: inspects the comparison fixture's pages that Phase 41's checks need, once. `write <file>`: generates Standard (all ten areas, fast and deep) and Comprehensive (security and accessibility, each with its page selection) on two inputs |
| `fixture-profile.json` | The fixture's page data, read by both sides (also `library.test.ts`'s input) |
| `outputs-16bbef7.sha256.json` | Each output's sha256 and length before the move (`16bbef7`) |

The inputs are this file's `fixture-profile.json` and the clean local
Toolshop's page data, `../2026-10-14-tfp201-two-tiers/runs/clean-profile.json`.
The outputs themselves (4.7 MB) are kept under `comparisons/tfp193/`, which
is gitignored.

## Result

**8 of 8 outputs identical** after the move: Toolshop and fixture, each with
Standard fast and deep, and Comprehensive security and accessibility. All
match the hashes recorded before the move.

| Output | Length |
| --- | --- |
| toolshop standard fast | 882,389 |
| toolshop standard deep | 1,263,573 |
| toolshop comprehensive security | 325,333 |
| toolshop comprehensive accessibility | 266,807 |
| fixture standard fast | 615,930 |
| fixture standard deep | 689,948 |
| fixture comprehensive security | 270,887 |
| fixture comprehensive accessibility | 223,197 |

The local score isn't run again: the generated suites are identical byte
for byte, so they run the same tests as TFP-188's.

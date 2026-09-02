# Maccabist v0.9.6.3 — Final Micro Hotfix

Two corrections and an accurate release record. No features, no redesign, no rebalancing, no
simulation change.

## Baseline

| | |
|---|---|
| Starting commit | `c261755` |
| Ending commit | `5bc842b` (last code/version commit; this report follows it) |
| Starting version | 0.9.6.2 |
| Ending version | **0.9.6.3** |
| Starting tests | 1349 passing, 79 files |
| Ending tests | **1351 passing, 79 files** |

| Hash | Phase |
|---|---|
| `f20f15e` | 1 — a settled season is settled however it ended |
| `b97af02` | 2 — `לטוב ולרע`, not `לטוב ולחובה` |
| `7263453` | 3 — correct the v0.9.6.2 release record |
| `5bc842b` | version and README |


## Fixes

### 1. Season-end Europe chronology for an eliminated club

`europeContext` checked `eliminated` before the reveal stage, so a club knocked out in qualifying
kept the midseason wording all the way to season end:

```
הקיץ האירופי נגמר מוקדם. הליגה היא הכול עכשיו.
אירופה נסגרה השנה. נתמקד בליגה.
```

Both are true in midseason and false in June — by then the league is over too, so there is nothing
left to focus on.

The reveal stage is the outer question: once a season is settled every campaign is described in the
past tense, however it ended, and elimination only decides the wording while the season is still
running. Two lines swapped, no new state model.

`europe_settled` already reads correctly for a knocked-out club, because the competition on the
campaign is the one it went out of — so `המסע האירופי בליגת האלופות הסתיים` is exactly what
happened, and the club is still named rather than forgotten.

Two new tests, **both failing against the v0.9.6.2 order**. The existing cases for active
qualifying, active league phase, midseason elimination, a settled league-phase campaign and the
no-future-leak guard all still pass — an eliminated club at midseason may still say Europe ended
early, which is the point.

### 2. `לטוב ולחובה` → `לטוב ולרע`

A legacy event read `משפטים כאלה זוכרים - לטוב ולחובה`. The idiom is `לטוב ולרע`, and the game
already uses the correct form in three other places, which makes this a typo rather than a house
style.

Wording only. Event id, tone, outcome and effects untouched — `git diff --word-diff` is a single
word, and the file's quote and brace counts are unchanged from the base.

### 3. Hebrew regression guard

`לטוב ולחובה` added to the curated forbidden list in `tests/hebrewCopy.test.ts` as an exact
**phrase**. `חובה` alone is an ordinary word and is not blacklisted. Verified non-vacuous:
reintroducing the bad form fails with the correct file and line.

`HEBREW_COPY_AUDIT.md` gains the row; totals move to 15 files and 26 corrections.

### 4. Release-report / CI accuracy

`V0962_REPORT.md` was wrong in two ways and is corrected in place rather than rewritten:

- **Ending commit.** It recorded `63e7c52`. The v0.9.6.2 line needed `c261755` afterwards to
  restore CI. Both are now in its commit table with what each did.
- **Stability claim.** It said "3 consecutive full runs, 3/3 green". Those runs were
  `npx vitest run`, not `npm test`. Vitest does not typecheck, so `tsc -p tsconfig.test.json` — the
  step CI runs first — was never run during that release. The runs were genuinely green; they
  simply did not cover that step, and that is exactly where CI failed. Two fixtures passed
  `reason: { kind: 'league_position', position: 2 }` where `EuropeanStep` takes a plain
  `UefaEntryReasonKind` string; the `as EuropeanStep` cast could not bridge it, so `tsc` rejected
  what the tests never noticed. `c261755` corrected the fixtures and CI has been green since.

Its Phase 1 section, which described the precedence this patch has just superseded, now carries a
note pointing at the correction.

## CI / Stability

Every command below was run on the release tree.

| Command | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | **79 files, 1351 tests, exit 0** (950s) |
| `npm run build` | passes |
| `npm run regress` | unchanged |
| `npm run rc:audit -- 240` | 0 violations |
| `npm run fixture:audit -- 800` | 0 self-opponent violations |
| `npm run viewport:audit` | ALL CLEAR |
| `npm run touch:audit` | 0 undersized targets |
| `npm run contrast:audit` | 0 unaccepted failing text nodes |
| `npm run crop:audit` | NO CROP JUMP — 120 art elements |

### Three consecutive `npm test`

The real gate this time — `npm test` is `tsc -p tsconfig.test.json && vitest run`, so each run
includes the TypeScript test compile.

| Run | Result |
|---|---|
| 1/3 | exit 0 — 79 files, **1351 tests**, 0 TypeScript errors (607s) |
| 2/3 | exit 0 — 79 files, **1351 tests**, 0 TypeScript errors (578s) |
| 3/3 | exit 0 — 79 files, **1351 tests**, 0 TypeScript errors (600s) |

Identical counts, no flaky reruns, no test skipped or marked todo in any run (checked, not
assumed), and no hidden TypeScript error — each run's output was scanned for `error TS`.

## Determinism

**The seed regression baseline did not change.** Identical to v0.9.6, v0.9.6.1 and v0.9.6.2:

```
european seasons 11    europe history 26    last journey uefa_europa_league/league_phase/12
uefa trophies 0        domestic cups 4      championships 4
ability 82 (peak 86)   legend 77            retired 35 after 17 senior seasons
appearances 702        goals 450            assists 120
```

This patch is copy, presentation, test and docs only. The single `src/data/**` change is one word
inside a `text:` string; no id, effect, probability or graph value was touched.

## Beta readiness

**Safe for friend beta testing: YES**

One thing this report cannot assert: I have no way to observe the GitHub Actions run from this
environment — `gh` is not installed here. Every step that workflow performs was run locally on the
release tree and passed (`npm ci` compatibility verified separately against a scratch copy of both
manifests, `npm test`, `npm run build`), and the previous deploy failure has a known cause and a
landed fix in `c261755`. But green CI on the final commit is something to confirm in the Actions
tab, not something I have seen.

# Maccabist v0.9.6.5 — Analytics Truth Hotfix

Four corrections to v0.9.6.4. No gameplay change.

## Baseline

| | |
|---|---|
| Starting commit | `af007b2` |
| Ending commit | `a8fea8e` (code and version; this report follows it) |
| Starting version | 0.9.6.4 |
| Ending version | **0.9.6.5** |
| Starting tests | 1386 passing, 80 files |
| Ending tests | **1402 passing, 80 files** |

| Hash | Change |
|---|---|
| `c257822` | the four analytics fixes, tests and docs |
| `a8fea8e` | version and README |

## Fixes

### 1. `career_started` held until the consent decision

The consent bar does not block the game, so a player could create a career, be turned away by
`emit` because consent was still `unset`, and only then press accept — and that career was never
reported. The one number the beta exists to produce was losing exactly the players who engage
fastest.

`emitOrHold` now holds the event locally under `maccabist.analytics.pending`.

### 2. `senior_debut` follows canonical engine truth

It used `!isInAcademy(career) && career.stats.appearances > 0`. `career.stats` is the **cumulative**
career total including academy and youth football, so the condition was satisfied the instant a
player entered the senior stage carrying years of youth games.

**Reproduced before the fix:** across 30 simulated careers it fired early in **30 of 30**, with
64–182 cumulative appearances and **zero** senior appearances. The event was reporting "reached the
senior stage", not "debuted".

### 3. `?analyticsDebug=1` now really enables GA4 debug mode

It bypassed the environment block but never set `debug_mode`, and GA4 does not route events to
DebugView without it — so the flag did not do the thing it documented. The gtag config is now built
by `gtagConfigParams`, which adds `debug_mode: true` only when the flag is present.

`environmentAllowsAnalytics` now treats an explicitly supplied location as authoritative instead of
returning early on a missing `window`, which is what made the override decidable in a test at all.
Production still calls it with no argument, where an absent `window` still means no.

### 4. Truthful consent-decline wording

The decline button said `לא עכשיו` ("not now") while storing a permanent `denied`. It now reads
**`לא, תודה`**. Consent semantics are unchanged; no settings screen was added.

## Career count semantics

> **`career_started` Event count is the number of newly-created careers among players who granted
> analytics consent**, tracked from v0.9.6.4 onward.

It is **not** a count of all careers played by everyone. A player who declines is not measured.
Treat the number as a floor on real activity, not a census. It also counts careers, not people, and
cannot reconstruct careers created before analytics existed.

## Consent race

| The player | Result |
|---|---|
| starts a career while consent is `unset` | held locally, nothing sent |
| then **grants** | flushed and sent **exactly once**, then deduped like any other event |
| then **declines** | discarded, never sent — and a later grant does not resurrect it |
| refreshes before answering | pending state survives; still exactly one on grant |
| refreshes after granting | no duplicate |
| is in dev / gallery / an audit | nothing held and nothing sent |
| has a pre-v0.9.6.4 save | never backfilled — structurally unreachable |

Malformed or hand-edited pending storage is dropped rather than trusted into a send: entries are
validated for shape and for scalar-only params before anything is emitted.

## Senior debut

**Canonical source:** the `senior_debut` milestone stamped by `src/game/seasonEngine.ts` when it
writes a season record. The engine's condition is:

```ts
career.academyStage === 'senior' &&
full.appearances > 0 &&
!career.seasonHistory.some((s) => s.academyStage === 'senior' && s.stats.appearances > 0)
```

Analytics watches for that milestone rather than re-deriving the rule, so there is exactly one
definition of a debut in the codebase and the event cannot disagree with the ceremony the player is
shown.

Tested with a youth veteran on **143 cumulative appearances**, at `senior` stage, with no senior
season in history: **zero** events. Then one milestone: **one** event. Later appearances: still one.
A career that had already debuted when it loaded: zero.

## Privacy

Confirmed for the new pending mechanism as well as the emitted payloads:

- Pending storage holds **only** the event name, the dedupe key, and the already-whitelisted scalar
  payload — the same object that would have gone to Google.
- **No player-entered name.** A test writes a career with a distinctive marker name, then reads the
  serialised pending storage back and asserts the marker and `playerName` are both absent, and that
  every held parameter value is a string, number or boolean.
- **No raw `Career`, no save JSON, no free text, no nested objects.**

## Determinism

**Unchanged.** Identical to v0.9.6 through v0.9.6.4:

```
european seasons 11    europe history 26    last journey uefa_europa_league/league_phase/12
uefa trophies 0        domestic cups 4      championships 4
ability 82 (peak 86)   legend 77            retired 35 after 17 senior seasons
appearances 702        goals 450            assists 120
```

Analytics still never mutates a `Career` and never consumes game RNG; ids come from
`crypto.randomUUID()`.

## QA

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | 80 files, **1402 tests**, exit 0 |
| `npm run build` | passes |
| `npm run regress` | unchanged |
| `npm run rc:audit -- 240` | 0 violations |
| `npm run fixture:audit -- 800` | 0 self-opponent violations |
| `npm run viewport:audit` | ALL CLEAR |
| `npm run touch:audit` | 0 undersized targets |
| `npm run contrast:audit` | 0 unaccepted failing text nodes |
| `npm run crop:audit` | NO CROP JUMP — 120 art elements |

### Three consecutive `npm test`

| Run | Result |
|---|---|
| 1/3 | exit 0 — 80 files, **1402 tests**, 0 TypeScript errors, 0 skipped (605s) |
| 2/3 | exit 0 — 80 files, **1402 tests**, 0 TypeScript errors, 0 skipped (646s) |
| 3/3 | exit 0 — 80 files, **1402 tests**, 0 TypeScript errors, 0 skipped (614s) |

Two failures occurred during development and were fixed rather than re-run, both caught by the
TypeScript step that `npm test` runs first: a fixture cast that did not overlap `Career`, and an
invented `'youth'` academy stage (the real values are `youth_c`, `youth_b`, `youth_a`, `u19`).

## Deployment

**Not observed.** `gh` is not installed in this environment, so I have not seen Test → Build →
Deploy go green on the final commit. Every step that workflow performs was run locally on the
release tree and passed. Confirm in the Actions tab.

Analytics itself still cannot be verified end to end until the build is live, because it is
disabled on localhost by design. With `?analyticsDebug=1` the events now carry `debug_mode`, so
GA4 DebugView should show them within seconds of a real session.

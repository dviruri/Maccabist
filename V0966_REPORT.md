# Maccabist v0.9.6.6 — Matchday Substitute Truth Hotfix

Presentation only. No gameplay, statistics, simulation or RNG change.

## Baseline

| | |
|---|---|
| Starting commit | `8a545e2` |
| Ending commit | `a53a60e` (code and version; this report follows it) |
| Starting version | 0.9.6.5 |
| Ending version | **0.9.6.6** |
| Starting tests | 1402 passing, 80 files |
| Ending tests | **1415 passing, 80 files** |

## The bug

Beta testing saw the player shown as starting on the bench and then **scoring in the 24th minute**,
with no substitution anywhere in the timeline.

Reproduced before the fix across 60 careers and 2,548 presented matchdays:

```
matchdays presented:  2548
bench matchdays:      229
CONTRADICTIONS:       222      (a player-owned moment with no substitution at all)
earliest:             minute 8

seed 7001 2044 CM played=true started=false -> player_assist at 19' with no substitution moment
seed 7001 2045 CM played=true started=false -> player_assist at 12' with no substitution moment
seed 7003 2040 GK played=true started=false -> save          at 12' with no substitution moment
```

## Root cause

The presenter modelled `played` and `started`, but nothing modelled **the moment a substitute
actually walked on**. Player-owned minutes were drawn from the whole ninety and assigned by index:

```ts
const goalMinutes = minuteRun(rng, scoreFor, 8, 88);
if (showPlayerGoal && index === 0) { /* his goal, whatever minute that is */ }
```

so a `played && !started` player could be given a goal, assist, chance or save at any minute from
the 8th onwards.

## The fix

- **New moment kind `sub_on`** — `58' 🔄 אתה נכנס מהספסל`. No partner and no shirt number: the game
  does not know who came off, so it does not say.
- **Entry minute 46–75**, drawn from the isolated matchday RNG. Narrow on purpose — earlier would
  invent an injury or a tactical collapse the aggregate stats say nothing about; later leaves no
  room for the substitute to then do what his real half-stats say he did.
- **One source of truth.** `PlayerMatchAvailability` carries `played`, `started`, `enteredAt` and
  `firstMomentMinute`; every generator reads it instead of asking `if (!started)` for itself. For a
  substitute `firstMomentMinute` is `enteredAt + 1`, so the entry is strictly before anything he
  does.
- **Goal minutes are generated coherently, not relabelled.** `scoringMinutes` moves the earliest
  minutes into the post-entry window when the player needs one, keeping the **count** identical —
  moving a label alone would have left the scoreline and the timeline telling different stories. An
  early team goal stays a `team_goal`; his goal lands after he came on. Minute selection scans
  forward from a random point rather than retrying, so it is deterministic and always terminates.
- **Chances and keeper saves** are clamped to the post-entry window.
- **Score reconciliation preserved.** `scoringSide('sub_on')` returns `null`; player-club scoring
  moments still equal `scoreFor` and opponent moments `scoreAgainst`.
- **Same-minute ordering** ranks kickoff, then `sub_on`, then everything else, so a team goal drawn
  on the entry minute cannot print above the substitution.

Post-fix, the same probe over the same 229 bench matchdays reports **0 contradictions**.

## Tests

13 new assertions in `tests/matchday.test.ts`, swept over six positions and up to 120 seeds:

- exactly one `sub_on` per bench matchday, inside 46–75, matching `enteredAt`
- no player-owned moment (goal, assist, chance, save, big save) at or before the entry
- goals and assists specifically, with a non-vacuity counter
- substitute **keepers** — swept separately at 120 seeds because they are rare, and asserted to
  have saves only after entry
- substitute chances only after entry
- pre-entry team goals remain `team_goal`
- starters get no `sub_on` and a null `enteredAt`
- a did-not-play player gets no `sub_on` and no player-owned moments — built from an explicit
  zero-appearance fixture, because the pre-existing bench test filtered for a case the sweep never
  produces and had been passing vacuously
- score reconciliation, sorted timeline, and same-minute ordering
- determinism: identical presentation twice, unchanged `rngState`, unchanged career

**Verified non-vacuous:** restoring the pre-fix minute generation fails 5 of them.

## QA

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | 80 files, **1415 tests**, exit 0 |
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
| 1/3 | exit 0 — 80 files, **1415 tests**, 0 TypeScript errors, 0 skipped (595s) |
| 2/3 | exit 0 — 80 files, **1415 tests**, 0 TypeScript errors, 0 skipped (686s) |
| 3/3 | exit 0 — 80 files, **1415 tests**, 0 TypeScript errors, 0 skipped (640s) |

One failure during development was fixed rather than re-run: a fixture used a `minutes` field that
does not exist on `SeasonStats`, caught by the TypeScript step `npm test` runs first.

**Determinism unchanged:**

```
ability 82 (peak 86)   legend 77   retired 35 after 17 senior seasons
appearances 702        goals 450   assists 120
```

Matchday remains a deterministic projection of already-simulated aggregate facts: it consumes only
its own isolated RNG (`seed ^ season ^ fixture id`), mutates no career, and leaves `rngState`
untouched.

## Deployment

**Not observed.** `gh` is not installed in this environment, so I have not seen Test → Build →
Deploy go green on the final commit. Every step that workflow performs was run locally on the
release tree and passed. Confirm in the Actions tab.

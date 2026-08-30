# MACCABIST v0.6.5.3 — Historical Season Truth Hotfix

**Scope:** make historical season data immutable and correct. No new systems, no balance work.

---

## Build

```
typecheck (src)     clean
typecheck (tests)   clean
production build    clean
```

## Test Count

```
964 passed / 964    (50 files)
```

933 were already green before this version; the 31 new ones are all in
`tests/seasonTruth.test.ts`.

## Baseline v0.6.5.2

`00d6e8f` → `0b62249` → `c85822f`. **933** tests, 49 files. 50,000 balanced careers:
Maccabi seniors 63.9%, abroad 33.2%, loans 31.8%, Legend 41.8, peak 80.9, retirement 34.9.

*Correction to V0652_REPORT.md, which states 927.* That count came from a full-suite run started
before the last six Checkpoint D crest tests were added to the file, so it undercounted by six.
The v0.6.5.2 tree really holds 933. Nothing else in that report is affected — the suite was green
at both counts — but 933 is the correct baseline to measure this version against.

## Root Cause

v0.6.5.2 separated static club identity from current league truth from historical league truth,
and that separation held. What it did not do is stop the fixture *count* being *reconstructed*.

`seasonFixtures(record)` resolved a historical league and then recomputed the schedule from the
league's current size, the club's current quality, and the schedule rules as they exist right
now. Every one of those inputs is a live value. Reshape a division, add a playoff round, restate
a club's quality, change the schedule formula — as v0.6.5.2 itself did, when it gated European
fixtures on `europePlaces` — and a season that finished years ago silently returns a different
number than it did in the previous version.

That is a query. A query answers with today's data.

Two concrete consequences:

**Academy seasons were all scored against one number.** No academy record carried a `leagueId`,
so every one fell through to the legacy branch and divided by
`getClub('maccabi_academy').seasonGames` — a flat 24. A טרום ב׳ season is 16 matches and a נוער
season is 32. Both were being measured against 24, so a boy who played every one of his 16
טרום ב׳ games showed as a 67% season, and a נוער player with 24 of 32 showed as ever-present.

**Senior history moved with the schedule rules.** v0.6.5.2's own European-fixture fix changed
the derived count for clubs in non-qualifying divisions. Any career whose history was read after
that change got different numbers for seasons that had already been played.

## SeasonRecord Change

```ts
teamGames?: number;
```

Optional, because saves written before this version have none. Written on every newly completed
season from this version forward. Once written it is never recomputed.

Also added to `Career`:

```ts
firstHalfGames: number | null;
```

Not persisted history — the in-flight companion to the existing `firstHalfStats`, so settlement
can sum the halves actually played rather than re-derive them. Null outside a season.

## Write Path

`SeasonRecord` has exactly **one** construction site and **one** append site
(`seasonEngine.ts:524`), which made this a small change.

```ts
const teamGames = (career.firstHalfGames ?? Math.round(level.seasonGames / 2)) + games;
```

The value is the sum of the two halves the player actually lived through — the *same* numbers
`simulateHalfStats` was called with to generate his appearances, starts and minutes. It is not a
second formula, so the stored fact cannot drift from the stats stored beside it.

Academy correctness falls out of this rather than being special-cased: `levelContext` already
returns `stageConfig(stage).seasonGames` for a player in the academy, so summing the halves
gives the stage's own schedule with no separate academy branch on the write path.

## Academy Truth

| stage | | configured `seasonGames` | stored `teamGames` |
| --- | --- | --- | --- |
| `pre_b` | טרום ב׳ | 16 | **16** |
| `pre_a` | טרום א׳ | 18 | **18** |
| `children_c` | ילדים ג׳ | 20 | **20** |
| `children_b` | ילדים ב׳ | 22 | **22** |
| `children_a` | ילדים א׳ | 24 | **24** |
| `youth_c` | נערים ג׳ | 26 | **26** |
| `youth_b` | נערים ב׳ | 28 | **28** |
| `youth_a` | נערים א׳ | 30 | **30** |
| `u19` | נוער | 32 | **32** |

Nine stages, nine distinct schedules, all previously collapsing to 24.

## Historical Fixture Resolution Order

`seasonFixtures(record, world?)`:

1. **`record.teamGames`** — stored at settlement. Nothing overrides it, including a later change
   to the schedule rules. This is the whole point.
2. **Academy stage** — `stageConfig(record.academyStage).seasonGames` when the stage is not
   `senior`. The schedule of an age group belongs to the age group, not to the club.
3. **Historical league** — via `historicalLeagueId`, below.
4. **Legacy fallback** — the club's static `seasonGames`, for a record whose league cannot be
   established at all. Wrong in the ways documented here, but it loads rather than crashing.

`historicalLeagueId(record, world?)`:

1. **`record.leagueId`** — stored fact.
2. **`world.clubSeasons`** — the world engine's own record of that club in that season. Also a
   stored fact, and an *id*, so it outranks display text.
3. **`record.league`** display name — last resort for a pre-v0.6.5.2 save.

The current league of the club is consulted at **no point**. When evidence runs out the function
returns `null`; it does not fall back to where the club plays today.

## Old Save Migration

`hydrateCareer` backfills once, on load, writing the resolved `leagueId` and `teamGames` into
the history so they become stored facts rather than values re-derived on every read. It uses the
shared resolver, so migration and runtime cannot disagree, and the career's **own** world.

Records that already carry both fields are returned untouched. `lastSeasonRecord` is kept
pointing at the same object as the final history entry, which is the invariant the write path
maintains (`seasonEngine.ts:524-525`).

## Promotion / Relegation Immutability

Scenarios D, E and F. A season stored in Liga Alef keeps its league id and its fixture count
through promotion to Leumit, through five successive moves up and down, and through any
subsequent world state. `playerImpact` for that season returns an identical number whatever the
club has done since.

## Repository-Wide `seasonGames` Audit

72 occurrences of `seasonGames` in `src/`. Classified:

| category | count | where | verdict |
| --- | --- | --- | --- |
| Dataset literals | 53 | `clubs.ts` (37), `academy.ts` (11), `youthClubs.ts` (5) | **STATIC QUALITY ONLY** — the dataset's own source values |
| Type/interface declarations | 3 | `types/index.ts`, `academy.ts` | declarations, not reads |
| Current-season generation | 8 | `rules.ts:62,85`, `seasonEngine.ts:236,333,371,383`, `participation.ts:60`, `progressionEngine.ts:1174` | **CURRENT-SEASON SAFE** — generating or projecting the season now in progress |
| Current-season UI | 1 | `SeasonCards.tsx:146` mid-season box | **CURRENT-SEASON SAFE** |
| Build-time derivation | 2 | `clubs.ts:635,673` | **STATIC QUALITY ONLY** |
| Historical resolver | 2 | `leagueTruth.ts:186` (stage), `:195` (legacy) | **LEGACY COMPATIBILITY** — documented, last in precedence |
| Comments | 3 | `rules.ts:74`, `worldEngine.ts:75`, `leagueSchedule.ts:6`, `maccabiHistory.ts:11` | prose |

**Direct `getClub(...).seasonGames` reads outside the resolver: zero.** The single remaining one
is `leagueTruth.ts:195`, the documented last-resort branch.

## Historical Consumers Fixed

Every historical consumer now goes through `seasonFixtures(record, world)`:

| consumer | change |
| --- | --- |
| `worldEngine.playerImpact` | passes `career.world`; prefers stored `teamGames` |
| `marketEngine` valuation minutes | passes `career.world` |
| `marketEngine.isStagnating` | passes `career.world` |
| `integrity.plausibleFixtures` | takes and passes `world` |
| `integrity` minutes-share check | passes `career.world` |
| `SeasonCards` historical minutes box | passes `career.world` |

## Remaining Static `seasonGames` Uses

- **Dataset literals** — the source of truth for club and stage configuration. Not reads.
- **Current-season generation** — `levelContext` resolves the *current* league (v0.6.5.2), and a
  season in progress is precisely the case where current state is correct.
- **`leagueTruth.ts:195`** — reached only when a record has no `teamGames`, is not an academy
  season, and has no resolvable league from any of three sources. It loads rather than crashing.

## Partial Season / Transfer Semantics

Investigated before enforcing anything, because the answer changes what `teamGames` should mean.

**One `SeasonRecord` = one whole season of player totals.** There is a single construction site
and a single `seasonHistory.push`. `stats` is `firstHalf` merged with the second half, and
`clubId` is the club at season *end*. Records are not per-club segments.

**A club change mid-season is possible**, through `effects.transferTo` on an event. Two academy
events carry it: `kids_travel` → `external_youth` and `youth_guaranteed_spot` →
`maccabi_netanya`. And it genuinely changes the level between halves, because `moveToClub` sets
`academyStage = 'senior'` when the destination `isSenior`:

> a boy can play the first half of a season on a 30-game נערים א׳ schedule and the second half
> on a senior one.

So re-deriving the count from the closing state would give the senior schedule for the whole
year — football he did not play. This is why `teamGames` is the **sum of the halves**, and why
the write path stores it rather than recomputing. Pinned by a test that drives exactly this
sequence.

Because the record holds whole-season totals, no segment interpretation is forced anywhere, and
`appearances <= teamGames` is a valid bound: `teamGames` is the total fixtures available across
both halves at whatever levels he played them.

**Observed, not fixed (out of scope):** `youth_guaranteed_spot` sends the player to
`maccabi_netanya`, which is the **senior** club (`clubs.ts:134`), while a youth side
`youth_maccabi_netanya` exists in `youthClubs.ts`. This is the same class of defect a comment at
`progressionEngine.ts:375` records having fixed for Hapoel Afula — "a fourteen year old who chose
'move to the local club' was made a senior professional on the spot". It does not affect fixture
truth now that halves are summed, but it looks like a real content bug and is left documented for
a version with the scope to change career outcomes.

## Controlled Scenarios A–J

`tests/seasonTruth.test.ts` — 31 tests.

| # | scenario | result |
| --- | --- | --- |
| A | טרום ב׳ season stores 16 | ✅ |
| B | נוער season stores 32 | ✅ |
| C | every stage stores its configured count | ✅ |
| C2 | nine stages give nine distinct counts | ✅ |
| C3 | old academy record resolves by stage, not by club | ✅ |
| D | Alef season survives promotion to Leumit | ✅ |
| E | Leumit season survives relegation to Alef | ✅ |
| F | two divisions give two immutable values | ✅ |
| F2 | holds through five successive moves | ✅ |
| F3 | `playerImpact` unchanged by later world movement | ✅ |
| G | old save resolves through `world.clubSeasons` | ✅ |
| H | historical world truth beats stale display text | ✅ |
| H2 | display name used only when the world is silent | ✅ |
| H3 | ambiguous `clubSeasons` match counts as no evidence | ✅ |
| I | no `teamGames`, no `leagueId`, no world evidence → loads | ✅ |
| I2 | record whose club no longer exists → loads | ✅ |
| — | never infers history from the current world | ✅ |
| J | stored value beats what the league would now compute | ✅ |
| J2 | stored value beats the academy stage schedule | ✅ |
| J3 | a zero/corrupt stored value falls through safely | ✅ |
| — | mid-season level change sums the halves | ✅ |
| — | write path stores `teamGames` on every season | ✅ |
| — | `appearances <= teamGames` across 25 seeds | ✅ |
| — | hydration backfills an old save from its own world | ✅ |
| — | hydration leaves complete records untouched | ✅ |
| — | integrity catches impossible/invalid stored counts | ✅ |
| — | integrity does not flag a pre-v0.6.5.3 record | ✅ |

## Save Compatibility

`SCHEMA_VERSION` stays at **4**. The change is purely additive: one optional field on
`SeasonRecord`, one nullable in-flight field on `Career`. No field is removed, renamed or
retyped, so no breaking migration is created and old saves need no version bump to load.

Old saves are backfilled once by `hydrateCareer` on load and then persist in the new shape
through the existing save path. A save that is loaded but never written back still resolves
correctly at runtime, because the resolver applies the same precedence without mutating storage.

## Integrity Validator

Two new codes, both checked **only when the field is present**, so a pre-v0.6.5.3 record is not
reported as a contradiction:

- `invalid_team_games` — stored value is not a positive integer.
- `appearances_exceed_team_games` — more appearances than the team played matches.

The second uses `teamGames` with no headroom, unlike the older `appearances_exceed_fixtures`
ceiling which pads by 12 for cup football. It can afford to: `teamGames` already includes that
season's cup and European allowance, because it is the exact figure the season was simulated
over.

## 50k Simulation

50,000 balanced careers, positions rotated — the same basis as the v0.6.5.2 baseline.

```
same seed reproduces career       PASS
different seeds diverge           PASS
distinct Legend Scores / 400        90
distinct endings reached            13
INVALID natural-stage repeats        0
registered behind own cohort         0
identical event sequences         0.0%
```

The four zero-targets are not measured by the standard simulation, so `scripts/seasonTruthAudit.ts`
(`npm run truth:audit`) reports them directly over full careers:

```
HISTORICAL SEASON TRUTH AUDIT  (6,000 careers, 155,099 seasons)

  critical integrity violations                  0
  historical fixture resolution failures         0
  academy fixture mismatches                     0
  save migration failures                        0
  seasons missing teamGames                      0
```

The migration line is the one worth explaining: it hydrates each finished career a *second* time
and asserts that no `teamGames` or `leagueId` moves. A backfill that were not idempotent would
mean a career's history depended on how many times the save had been loaded, which would be the
same defect in a new costume.

## Regression Metrics

```
                              v0.6.5.2   v0.6.5.3
reached Maccabi senior team     63.9%      63.9%
played abroad                   33.2%      33.2%
returned to Maccabi             21.3%      21.3%
had a loan spell                31.8%      31.8%
avg Legend Score                 41.8       41.8
median Legend Score              34.0       34.0
avg peak ability                 80.9       80.9
avg Maccabi appearances         132.5      132.6
mean retirement age              34.9       34.9
seasons below the top flight     6.48       6.48
moved up a level                64.7%      64.7%
moved down a level              32.3%      32.2%
```

No balance change, which is the requirement. Every figure is identical or within run noise, and
the two that moved by 0.1 are the last digit of an average over 50,000 careers.

This is the expected result and worth stating why: storing the denominator the engine already
used cannot change what the engine does. The academy fix corrects how a season is *reported and
scored*, not how it is played — which is why season-shape metrics hold while the underlying
academy percentages are now right for the first time.

## Known Limitation

**The Israeli Premier League playoff schedule remains simplified.** Ligat Ha'Al is modelled as a
double round-robin plus a flat 7-match playoff allowance, rather than the real split into
championship and relegation rounds with their differing fixture counts. Not fixed here, and
deliberately so — this version's job is to store whatever fixture model was actually used, which
it now does. When the playoff model is made realistic, seasons already played will keep their
stored numbers, which is exactly the protection this version exists to provide.

Also carried forward from v0.6.5.2: Liga Alef crest coverage is 27/36, and hand-authored club
`seasonGames` values disagree with their own divisions in places (`maccabiHistory.ts:11` notes
the same thing independently). Neither affects stored history from here on.

## Deferred to v0.7

Explicitly not started, per the brief:

- CompetitionStats
- league-only goal/assist statistics
- Individual Honors (top scorer, assists leader, Player of the Season, Goalkeeper of the Season)
- Career Archive
- Trophy Cabinet
- Achievements presentation
- Club Album
- Retirement v2
- Share Poster

## v0.6 Closure

v0.6.x truth work is complete. Static identity, current world state and historical season state
are three separate things with one authority each, and a completed season is now a stored fact
that no future version can recalculate.

Next: **v0.7 — Collection / Meta / Visual Career Experience.**

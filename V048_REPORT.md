# Maccabist v0.4.8 — Data Integrity, Reconciliation & Truth Pass

> **If the game says something happened, every system must agree that it happened.**
> **One authoritative source of truth for every fact.**

Five bugs were reported from playtesting. They looked unrelated. They were the same bug five
times: **two systems each holding an opinion about one fact, and no rule about which one wins.**

That is the finding of this pass, and it is why the fixes are not five patches. Each fact now has
one owner, the owner is named in code, and a validator asserts that nobody disagrees with it —
over 50,000 simulated careers.

---

## 1. Build status

```
npm run build     ✓ built in 879ms
npx tsc --noEmit  clean (app and test projects)
```

Bundle unchanged in kind; no new runtime dependencies. `SCHEMA_VERSION` deliberately **still 4** —
see §11.

## 2. Tests

```
Test Files  30 passed (30)
Tests      626 passed (626)
```

v0.4.7 ended at 619. The 7 new tests are the reconciliation suite's additions: the Maccabism taper
shape, the taper's population effect, the Maccabism trace, the trace bound, and the three
regressions from §8.

`tests/reconciliation.test.ts` is the v0.4.8 suite proper — 46 tests covering static event
validation, the Maccabism guard, controlled scenarios A and C–I, the reveal contract, and save
migration.

---

## 3. The five reported bugs

### Bug 1 — a Maccabi senior with live on-field match events and 0 appearances

**Root cause.** `match_moment` events were gated on `roleValue` — the player's *standing* in the
squad — and not on whether he had played. Of 21 on-field events, **0 were gated on appearances at
all.** A squad player with good standing and no minutes received match narration all season.

**Fix.** A participation ledger (`SeasonParticipation`) is now the authoritative record of
appearances and starts, written by `playFirstHalf`/`playSecondHalf`. Events declaring
`requiresAppearance` / `requiresStart` pass through a hard gate in `loadSlotEvents`
(`mayDeliverOnField`).

Before the season's football has happened the ledger is empty for everyone, so the gate consults a
**noise-free projection** of expected appearances (`projectedAppearances`, floor 3) — it mirrors
`computeMinutesShare` without its `rng.range(0.88, 1.12)` and never consumes a draw, so asking the
question does not change the answer. From settlement onward the ledger answers.

**Reconciliation.** If the gate said "he will play" and the noisy roll then produced zero, the
*statistics* are what is wrong: the player has already been told he was on the pitch. The season is
credited with the one appearance the event described rather than settling into a summary that
contradicts what he just read.

### Bug 2 — a league-championship celebration at a club that finished 5th

**Root cause.** `rollTrophies` drew the championship from `club.titleChance`, a fixed per-club
probability with no connection to the league table the game had just shown the player. Maccabi
Herzliya finished 5th in Liga Leumit and won the league, because those were two separate rolls.

**Fix.** The league title is **no longer rolled**. It is read from the settled projection:

```ts
function wonLeagueThisSeason(career: Career): boolean {
  const projection = career.world.projection;
  if (!projection || projection.season !== career.currentSeason) return false;
  if (projection.clubId !== career.currentClubId) return false;
  return projection.finalOutcome === 'champion';
}
```

A fifth-placed club cannot be champions **structurally**, not because a check downstream catches
it. Cups remain rolled — a cup run genuinely is a separate competition — but are typed separately
so "אליפות" can never print for a cup.

Related fix in the same function: `isIsraeli` was decided by `level.league.includes('ליג')`, which
is true of several foreign league names. It now reads `getClub(club).country`.

### Bug 3 — appearances abroad for a career that never left Israel

**Root cause.** The retirement screen decided "abroad" by comparing the league's **Hebrew display
name** against two hard-coded strings:

```ts
s.league !== 'ליגת העל' && s.league !== 'ליגה לאומית'
```

Every academy season failed that comparison. So did every Liga Leumit season — the filter says
`'ליגה לאומית'` and the league is called `'הליגה הלאומית'`. A career spent entirely in Israel
reported European appearances.

**Fix.** `isForeignSeason` reads the club's `country`, which is data:

```ts
export function isForeignSeason(record: SeasonRecord): boolean {
  const club = safeClub(record.clubId);
  return club !== null && club.country !== 'ישראל';
}
```

`appearanceBreakdown` derives every career total from season records, with the identity

```
total === maccabi + otherIsraeli + foreign
```

holding by construction — the three categories are exhaustive and disjoint. Youth appearances are
counted **separately and never folded in**; adding a boy's נערים ב׳ games to a professional total
would be the same category error in the other direction.

### Bug 4 — Maccabism moving because of decisions at other clubs

**Root cause, in two parts.**

`applyHalfProgression` changed Maccabism **every half-season** from nothing but which club the
player was at. And of the events that moved it, **27 carried no Maccabi scope whatsoever** — a
national-team call-up, a cup final at another club, a dressing-room speech, a contract negotiation.

**Fix.** The passive drift is deleted. Nothing moves Maccabism on its own any more.

Every remaining path goes through one guard, and no delta reaches the career unless the thing that
caused it declares *what about Maccabi happened*:

```ts
export function guardedMaccabismDelta(
  requested: number | undefined,
  relevance: MaccabiRelevance | undefined,
  current?: number,
): number
```

`MaccabiRelevance` is one of `identity | fans | people | leaving | return | opponent`, and both
`'none'` and `undefined` return zero. **Deliberately a guard, not a convention** — event authors
remembering a rule is not a mechanism. It is the one door events, transfer offers, and anything
added later all pass through.

Each of the 94 surviving Maccabism outcomes was judged on its **content**, not on where the player
happens to be: training hard at Maccabi is training hard. What moves the number is a decision about
the club — its identity, its supporters, its people, leaving it, coming back, or facing it.

Also removed: the `maccabism: 2` on the retirement effect, and the transfer-engine delta when the
club being left is not Maccabi's.

**Audit.** 0 choice-level Maccabism effects exist (those are applied without a relevance and would
be silently zeroed), and all 94 outcome-level ones carry a label. Nothing is being dropped by
accident. See §7 for the regression this fix caused and how it was measured.

### Bug 5 — the selected result disappears too quickly in Decision Reveal

**Root cause.** The reveal cycled through candidate outcomes on a fixed timer and then ended.
Nothing locked onto the outcome that had actually been resolved, and nothing held it on screen.
The player saw the roulette and not the result.

**Fix.** `OutcomeReveal` now takes `resolvedOutcomeId`, decelerates (`TICK_MIN_MS` 90 →
`TICK_MAX_MS` 260 over `CYCLE_MS` 1100), **locks** onto the resolved outcome, then holds for
`HOLD_MS` 1000 showing "נבחר", the outcome label and its percentage before calling `onDone()`.

Reduced motion skips the cycling but still locks and still holds — the point of the hold is
legibility, which is exactly what a reduced-motion user needs.

---

## 4. `truth.ts` — where the answers live

One module, all pure reads over a plain `Career`, nothing mutates.

| Fact | Owner | Rule |
|---|---|---|
| League position, champion, promoted, relegated | the settled league projection | nothing rolls a league title separately, ever |
| Appearances and starts this season | the participation ledger | gates every on-field event |
| What happened in a past season | the settled `SeasonRecord` | immutable |
| Every career total | derived from season records | no independent career counters for football history |
| Maccabism | only an explicitly Maccabi-relevant outcome | fail closed |

## 5. `integrity.ts` — asserting nobody disagrees

`validateCareerIntegrity(career)` returns structured violations — a code, a season, a human
sentence — so the debug panel can list them and the simulation can count them by category.

Twelve codes: `starts_exceed_appearances`, `appearances_exceed_fixtures`,
`appearance_breakdown_mismatch`, `foreign_without_foreign_club`, `maccabi_without_maccabi_season`,
`league_title_without_first_place`, `first_place_without_league_title`, `promotion_contradiction`,
`relegation_contradiction`, `on_field_without_appearance`, `trophy_kind_confusion`,
`counter_disagrees_with_trophies`.

**Read-only by design.** A validator that quietly repaired what it found would hide the bug it was
written to expose. Repairs belong in settlement and in save migration, where they can be reasoned
about.

### 5.1 A validator that encoded a different rule from the engine

The first version of `first_place_without_league_title` demanded a medal whenever the club finished
first and the player had 5+ appearances. It flagged **2.5% of careers** — every one of them a squad
player with six or seven games in a forty-two match season. `rollTrophies` also requires
`minutesShare >= 0.15`, and those players were correctly given no medal.

Fixed by mirroring the engine's rule exactly, both conditions. A validator that encodes a different
rule from the engine is just a second opinion, which is the thing this pass exists to remove.

## 6. Debug tooling (Phases 22–24)

The debug panel now opens with an integrity block:

- **integrity** — green, or every violation by code with its detail line
- **the appearance equation, shown rather than asserted** — `total = maccabi + ישראל + חו״ל`, so if
  it ever fails to add up the number on the left will not equal the sum on the right, in front of
  whoever is looking
- **participation trace** — the ledger: season, appearances, starts, whether an on-field event fired
- **trophy trace** — league titles and cups listed separately, by season and club
- **Maccabism trace** — the last 12 changes, each naming its cause, its relevance in Hebrew, what
  was requested, what was applied, and the value afterwards

The Maccabism trace exists because the guard is easy to state and impossible to see. `requested`
and `applied` are recorded separately so the headroom taper (§7) is visible as itself rather than
looking like a rounding error. A **blocked** delta leaves no entry — nothing happened, and an audit
trail of non-events would bury the real ones. Bounded at 12; a trace that grows without limit is a
save-size bug.

---

## 7. A regression this pass caused, and the measurement that found it

Removing the passive Maccabism drift was correct — it was the reported bug. It also had a
consequence I did not anticipate: the event deltas are **net positive**, and with nothing pulling
back, the number ratcheted.

Measured immediately after the removal:

```
final maccabism   p10 82   p25 93   median 100   p75 100   p90 100   mean 94.7
```

A stat pinned at its ceiling carries no information. It also inflated the Legend Score with it —
43.8 in v0.4.7 → 47.7 — compounded by trophies becoming genuinely *rarer* once they had to
correspond to a club that actually finished first.

This is the same class of defect as the v0.4.6 `roleValue` saturation, and it was found by
measuring the distribution, not by a test.

**Fix.** Positive deltas taper with the remaining headroom:

```ts
const headroom = Math.max(0, (MACCABISM_CEILING - current) / MACCABISM_CEILING);
return requested * headroom ** MACCABISM_TAPER;   // MACCABISM_TAPER = 0.55
```

This is deliberately **not** the old decay returning. Nothing moves the number on its own; an event
still has to happen, and it still has to be about Maccabi. What changed is that the hundredth point
of devotion is harder to earn than the fiftieth — a better model as well as a fix. Negative deltas
are never softened; losing devotion is the half a player actually feels.

After:

```
final maccabism   p10 69   p25 76   median 86   p75 94   p90 98    mean 84.7
```

Still high, because this is a career raised in green — and the top of the scale means something
again. Pinned by two tests: the taper's shape, and that the distribution stays off the ceiling
across real careers.

---

## 8. Phase 37 — the integrity simulation

**50,000 careers**, balanced policy, positions cycled by seed.

The 20,000-career scan was **100% clean**. At 50,000 it was **99.98%**, and both violations were
real bugs. This is the section that justifies the brief's insistence on the larger number.

### 8.1 `counter_disagrees_with_trophies` — 8 careers

`maccabi.championships` was incremented inside the `countsForMaccabiLegacy` branch, which requires
`parentClubId === null`. A title won **on loan at Maccabi** therefore awarded a trophy with
`clubId: maccabi_haifa` and incremented nothing.

Seed 3119 spends 2045 at Maccabi between two Benfica seasons, wins the league, and retired with the
counter at 0 while the trophy list held 1 — and the counters are what the retirement poster and two
achievements read.

**Fix.** The counters are **recomputed from the trophy list** rather than incremented. That removes
the class rather than the instance: a counter recalculated from the authoritative record cannot
drift from it, whereas one that is incremented can drift in any branch anyone adds later.

Whether a loan spell counts toward `maccabi.seasons` is a **separate judgement and is left alone**.
A medal is a fact; "a season of his Maccabi career" is a design decision, and changing it would be
a gameplay change smuggled into an integrity fix.

### 8.2 `on_field_without_appearance` — 1 career

An ordering bug, the same shape as v0.4.6's headline finding.

`playSecondHalf` settles the season at the end of the **mid** slot, and `loadSlotEvents(..., 'late')`
runs *after* it. Settlement clears `firstHalfStats`, so for the whole late slot the participation
gate concluded the season had not been played yet and fell back to the **projection** — letting an
on-field event fire into a season already recorded with zero appearances, with reconciliation long
past.

**Fix.** The gate now also treats a season with a written record as played, so after settlement it
reads the ledger instead of the forecast.

### 8.3 After both fixes

```
v0.4.8 INTEGRITY SCAN — 50,000 careers, balanced policy

clean careers   50,000 / 50,000   100.00%

No violations in any category.
```

Both bugs are pinned by their own seed, because a population test sampling 150 careers is exactly
what missed them.

---

## 9. Phase 38 — no accidental rebalance

```
3,000 careers, balanced policy — the same strategy v0.4.7's baseline was measured with.

  reached Maccabi senior team            66.4%
  played abroad                          38.3%
  avg Legend Score                        45.7      (v0.4.7: 43.8)
  median Legend Score                     41.0
  avg Maccabi appearances                135.5
  mean retirement age                     34.9
  median retirement age                   35.0
  distinct events used                     126
  identical event sequences               0.0%
  INVALID natural-stage repeats              0

  LUCK VALIDATION
  same seed reproduces career             PASS
  different seeds diverge                 PASS
  distinct Legend Scores / 400 seeds        91
  Legend Score range                     7-100
  Legend Score std dev                   24.92
  distinct endings reached                  12

The only movement against v0.4.7 is the Legend Score, +1.9, and it is accounted for in §7: it is
the residual of removing the passive Maccabism drift, after the headroom taper pulled back the
+3.9 that removal alone produced. Nothing else drifted.

Measured before and after the two §8 fixes and identical to one decimal in both — those bugs
affected roughly 9 careers in 50,000, so a rebalance was never plausible and the run confirms it.

Position spread is intact: peak ability 80.2–82.5, Legend Score 44.2–47.6, Maccabi senior
64.2–69.0%, and goalkeepers still retire around 37 against 34.4 for outfielders.
```

## 10. Coherence — every gated event still reachable

Gating an event into oblivion is not a fix, so reachability was checked in **both** directions.

```
3,000 careers, 51,965 senior seasons, 51,965 club seasons.

  MUST BE ZERO
    club season with no table position          0
    final position outside the division         0
    outcome the final position does not produce 0

  GATED EVENTS — must still be reachable        v0.4.7      v0.4.8
    youth_derby_youth                           16.90%      16.90%
    rare_derby_legend                            0.63%       0.63%
    sen_derby_moment                            25.53%      26.40%
    vt_final_derby                               3.97%       3.40%
    sen_title_penalty                            1.47%       1.23%
    sen_title_run_in                             5.57%       5.53%
    wrl_title_race                              22.33%      21.97%
    wrl_relegation_battle                       17.90%      18.27%
    wrl_promotion_race                          13.13%      13.60%
    spon_last_minute                            16.07%      16.27%

  Every gated event is still reachable.

This column pair is the check that matters for §8.2. That fix makes the participation gate stricter
in the late slot, and a stricter gate is only a fix if the events still arrive — `spon_last_minute`
and the late-slot match moments are the ones at risk, and they held (16.07% → 16.27%, 25.53% →
26.40%). Nothing collapsed, so the gate is refusing the contradiction and not the content.
```

## 10.5 The reveal, verified at three mobile widths

Bug 5's fix is a timing change, so it was verified from the **DOM** rather than from a screenshot —
a lesson from v0.4.5.1, where I read a bidi bug off a picture that the DOM showed was not there.

The `reveal-locked` gallery scene renders `OutcomeReveal` with `resolvedOutcomeId` set. Its locked
frame contains, in order:

```
נבחר / 🔴 / מעל המשקוף, והחזרה לחדר ההלבשה ארוכה מאוד / 37%
```

The marker, the resolved outcome's own label, and its probability — held on screen, not a frame the
reel happens to be passing through.

Overflow probe, `decision` and `reveal-locked` at the three target widths:

```
360  probe-canary   over=1 canary+256      <- the probe can still fail
360  decision       over=0
360  reveal-locked  over=0
390  probe-canary   over=1 canary+226
390  decision       over=0
390  reveal-locked  over=0
412  probe-canary   over=1 canary+204
412  decision       over=0
412  reveal-locked  over=0
```

The canary line is the point. It is a deliberately 600px-wide element, and a clean sweep only means
something if the probe can still detect one — in v0.4.5.1 the probe reported all 25 scenes clean at
every width while silently skipping every element on the page. It fails here, so the zeros are real.

## 11. Save compatibility

`SCHEMA_VERSION` is **deliberately unchanged at 4**. Everything v0.4.8 added is either derived on
read or an optional field, so a v0.4.7 save loads and plays.

`hydrateCareer` performs four migrations:

1. **Projection** for a pre-v0.4.6 save, seeded from `rngState` and deliberately *not* advancing it
2. **Participation ledger** rebuilt from `lastSeasonRecord` when it belongs to the current season,
   opened empty otherwise — without one, `canBeOnField` falls back to the projection for a whole
   season and a loaded save could still receive an on-field event it is not entitled to
3. **Contradicted league titles removed** — a v0.4.7 save can contain a championship rolled from
   `club.titleChance` in a season the club finished fifth. Conservative on purpose: only a title
   whose season has a recorded position that is *not* first is removed. A title with no matching
   world record is left alone, because there is nothing to check it against and destroying history
   on a guess is worse than an inconsistency. `youth_championship` is never touched.
4. **Maccabi trophy counters recomputed** from the trophy list — and deliberately *after* step 3,
   because a save that loses a phantom championship must lose the count with it

`hydrateCareer` remains the identity function on a fresh career; `createCareer` opens its own ledger
so that stays true.

## 12. Product invariant

> **The player may leave Maccabi. Maccabi never leaves the player's story.**

Preserved. Bug 4's fix narrows *what may move Maccabism*, not what the game remembers. The ambient
Maccabi world, the return routes, and the Maccabi-first framing are untouched — and `appearanceBreakdown`
now reports Maccabi appearances as their own category rather than inferring them from a league name.

## 13. Out of scope, and stayed out

No agents, personal coaches, manager personalities, recurring character relationships, historical
Maccabi legends, backend, Base44, leaderboards, multiplayer, match engine, full fixtures, full
squads, or salaries. No new gameplay content. The Player Hub was not redesigned, mobile density was
not changed, and no real club logos were added.

**v0.5 was not started.**

## 14. Known issues and deferred work

- The Maccabism distribution is still high in absolute terms (median 86). That is intended — a
  career raised in Maccabi's academy *should* skew devoted — but it means the low end of the scale
  is rare, and only reachable by a career that leaves and stays away.
- `maccabi.seasons` still excludes loan spells while the trophy counters no longer do. Both are
  defensible and they are now *deliberately* different; if that asymmetry ever reads wrong in the
  retirement poster it is a design decision to revisit, not a bug.
- Cup wins remain rolled rather than derived. A cup is genuinely a separate competition and the
  game does not model cup fixtures, so there is no table to derive from. If v0.5 ever models cup
  rounds, this becomes derivable and should be derived.
- `first_place_without_league_title` mirrors `rollTrophies`'s minutes floor by duplicating it.
  Extracting the shared predicate would be better than two copies that must be kept in step.

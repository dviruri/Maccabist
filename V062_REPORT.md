# Maccabist v0.6.2 — Derby, Cup & Legacy Cleanup

> Four things the game was still saying that were not true.

v0.6.1 closed the derby hole it could see: no event's *text* may use the word דרבי without derby
gating. Playtesting then produced a Hapoel Kfar Saba player who won a State Cup final against
Umm al-Fahm and collected an achievement called **הרגע בדרבי**.

The word never appeared. The event handed out an achievement id.

That is the shape of all four targets in this version: a claim carried by something other than
prose — an achievement id, a leftover noun, a third score, a competition nobody modelled — with
nothing joining it to the fact it was named after.

Three checkpoints, each committed stable.

---

## 1. Build and tests

```
npm run build                    ✓ built in ~1.0s
tsc -b                           clean
tsc -p tsconfig.test.json        clean

Test Files   39 passed (39)
Tests       794 passed (794)
```

**`npm run test` was red before this version and is green now**, which was not on the brief and is
worth stating plainly. The script runs `tsc -p tsconfig.test.json && vitest run`, and the test
project had five `noUncheckedIndexedAccess` errors in `cupAndDerbyTruth` and `managerTruth` — files
v0.6.2 did not otherwise touch. `vitest` transpiles without typechecking, so every green test run
this version and the last hid them. Fixed here rather than left, because a checkpoint that says
"tests pass" should mean the command the repo defines for that.

v0.6.1 ended at 754 across 36 files. New in v0.6.2: `derbySemantics` (13), `cupTruth` (16) and
`scenariosV062` (12).

## 2. v0.6.1 baseline

```
commit 98f8079          754 tests, build clean
reached Maccabi senior team   63.3%
played abroad                 31.8%
returned to Maccabi           22.0%
avg / median Legend Score     41.4 / 33.0
avg Maccabi appearances       129.1
integrity                     50,000/50,000 clean
```

---

# Checkpoint 1 — Derby leakage, terminology, two axes

## 3. The leak was not textual

`sen_cup_final` contained no derby word anywhere. Its winning outcome carried:

```ts
effects: { ..., achievement: 'derby_moment' }
```

and `derby_moment` is named **הרגע בדרבי**, described **שער שהשתיק אצטדיון שלם**. The event's
conditions were `requiresAppearance`, `bands: ['senior']`, `minRoleValue: 45`, `minAge: 20`. No
opponent condition of any kind. Any senior with a decent role could receive a derby honour for a
cup final against anybody.

v0.6.1's guard could not have caught it. It scanned prose, and the prose was clean.

## 4. Widening the audit found a second one

Auditing by **effect** rather than by text — achievements, memories and milestone ids — turned up
`cb_penalty_again` in `arcEvents.ts`: a redemption penalty, no opponent condition, recording the
`derby_hero` **memory**. Memories feed later event callbacks, so this one propagated forward.

| leak | carrier | gating | fix |
|---|---|---|---|
| `sen_cup_final` | `achievement: 'derby_moment'` | none | new `cup_final_hero` |
| `cb_penalty_again` | `remember: 'derby_hero'` | none | new `clutch_moment` memory kind |

Both were found by the same query. Neither was reachable through a rule — they were reachable
because nothing joined an honour to the fact it was named after.

## 5. Typed metadata instead of a wider string scan

The tempting fix was to add `derby_moment` to a list of forbidden ids. That is the same guard
that just failed, one layer down: a list somebody has to remember to update.

Achievements now declare the context they claim:

```ts
export type AchievementCategory = 'derby' | 'cup' | 'maccabi' | 'career';
```

and `tests/derbySemantics.test.ts` walks the pool asserting every event granting a `derby`
achievement is derby-gated. It reads effects, not text.

## 6. Part 5 — the same guard, generalised

An achievement with a `check` predicate verifies itself against the career and cannot lie:
`hundred_maccabi` is true exactly when `maccabi.appearances >= 100`. The ones granted by an event
have no such backstop.

There are four of them, and **the two that went wrong were two of the four.**

| achievement | category | requirement |
|---|---|---|
| `derby_moment` | derby | `requiresDerby` or `rivalryTypes: ['localDerby']` |
| `cup_final_hero` | cup | `cupFinal` |
| `tournament_star` | career | none |
| `brought_them_back` | career | none |

The validator asserts every event-granted achievement declares a category, and that every grant is
gated on that category's condition.

## 7. Terminology

v0.6.1 rescoped the historical dataset from league-only to all competitions and left the word
ליגה on the surfaces that read from it.

| surface | before | after |
|---|---|---|
| legacy milestones | `250 הופעות ליגה במכבי` | `250 הופעות רשמיות במכבי חיפה` |
| legacy component detail | `${apps} הופעות ליגה` | `${apps} הופעות רשמיות` |
| `LegacyCard` label | הופעות ליגה | הופעות |
| `LegacyCard` scope note | — | כל המשחקים הרשמיים בבוגרים, נכון לסוף עונת 2025/26 |
| stale comments | `495 league apps` | genericised |

## 8. Retirement: two greatness axes

The poster carried three overlapping numbers — מדד אגדה, קריירה עולמית, and מורשת מכבי below it.
A player should not have to work out the difference between a legend score and a legacy score when
both are on the same card.

```
before:  מדד אגדה 61   |  קריירה עולמית 80  |  מורשת מכבי 95
after:                    קריירה עולמית 80  |  מורשת מכבי 95
```

The breakdown section under it now explains **ממה מורכבת מורשת מכבי** rather than the retired
legend score. `legend.score` stays on the career for save compatibility and for the endings prose;
it simply has no user-facing surface on that screen. `RetirementPage.tsx` no longer reads it.

A career written mostly outside the green used to get an empty card. It now gets a sentence:
**הקריירה שלך נכתבה בעיקר מחוץ לירוק.** Low Maccabi Legacy is a true fact about a career that may
have been excellent, and the screen says so instead of leaving a blank.

---

# Checkpoint 2 — The cup

## 9. What was actually there

```
sen_cup_final          kicker "גמר גביע המדינה", outcomes narrate the result
                       conditions: requiresAppearance, senior, roleValue>=45, age>=20

rollTrophies()         rng.chance(level.cupChance * contribution) → 'cup'
                       at SEASON END, with no reference to the event
```

Two systems, no join. The reachable contradictions:

- told he decided the final and was carried off the pitch → **no cup trophy**
- handed a cup → **no final was ever mentioned**
- told he watched the opposition lift it → **a cup trophy in the same season**

The comment in `seasonEngine.ts` said the roll was deliberate, "no cup competition is modelled, so
there is no authoritative table to read it from". That was true when it was written and stopped
being true the moment an event started narrating cup finals.

## 10. `CupSeasonState`

```ts
export type CupRun = 'early_exit' | 'quarter_final' | 'semi_final' | 'runner_up' | 'winners';

export interface CupSeasonState {
  season: number;
  clubId: string;
  trophyId: 'cup' | 'foreign_cup' | 'youth_cup';
  run: CupRun;
  finalOpponentId: string | null;
}
```

Committed at **preseason**, in `openWorldSeason`, beside the league projection and for the same
reason: `planSeason` picks the whole year's events in August, so anything an event gates on has to
be true by then. A cup run decided in May cannot gate an event chosen in August — that is exactly
the mismatch v0.4.6 moved the league projection to remove.

**Not a bracket.** No draw, no rounds, no fixtures, no schedule. The only questions the game asks
are whether there was a final, against whom, and who won it. Explicitly out of scope, and nothing
here needs it.

## 11. One truth, three readers

| reader | asks | was |
|---|---|---|
| `rollTrophies` | `run === 'winners'`, trophy id from the state | an independent roll |
| `sen_cup_final_won` | `cupFinal: 'won'` | role value and age |
| `sen_cup_final_lost` | `cupFinal: 'lost'` | (did not exist) |
| `SeasonResultCard` | reports a run that ended without a trophy | nothing |
| `validateCareerIntegrity` | trophy and state agree | nothing |
| `CLAIM_RULES` | text saying גמר גביע needs `cupFinal` | nothing |

## 12. Why two events rather than one

The result is a known fact by the time the event is planned, so the alternative was one event that
stays silent about who won. That is a strange way to cover a cup final.

Two events, each gated on the real result, and every outcome inside them about the player's own
evening — the only thing still open. It also produces the outcome the old event structurally could
not: **a great personal night on the wrong side of the score.**

```
sen_cup_final_lost / step_up / best_on_the_pitch
  "היית הטוב בדשא ואף אחד לא יזכור את זה.
   אתה עומד בשורה ומקבל מדליית כסף שלא רצית."
```

`cup_final_hero` is awarded only by the final that was won.

## 13. A cup final may be a derby

`isCupFinalDerby` asks `rivalryBetween` about the two clubs actually in the final. It is not a
synonym for "big final" and no event can assert it. If the draw produces Hapoel Haifa against
Maccabi Haifa, the final genuinely is a derby, from rivalry data, without any event saying so.

Neither cup event is derby-gated and neither says דרבי.

## 14. Calibration is unchanged by construction

Winning is decomposed into reaching a final and then winning it:

```
P(win) = P(final) × P(win | final)
       = (w × M) × (w / (w × M))
       = w
```

`M = REACH_FINAL_MULTIPLE = 2.4` cancels. It sets only how often a player *sees* a final he does
not win — at Maccabi (`cupChance` 0.24) that is a final in roughly half of seasons.

The algebra is not trusted. `tests/cupTruth.test.ts` measures it over 30,000 draws:

```
expected  cupChance × strength
measured  within ±0.015
finals    > 1.8 × wins
```

One honest drift: the strength term is read at **preseason** rather than at season end, so a player
who gains two points of ability across a year is now credited at the lower figure. Measured in §22.

## 15. Old saves

A pre-v0.6.2 save has no `world.cup`. Every consumer reads that as "no cup claim is supported",
which is the fail-closed answer: the save loses cup-final events for the season in progress rather
than being handed a final it never played. It costs at most one season of a competition the player
was never shown.

The league projection *is* back-filled for old saves, because a blank table is visible and wrong.
A back-filled cup would be the opposite — inventing a competition the player was never told about.

---

# Checkpoint 3 — Validation

## 16. Integrity codes added

| code | catches |
|---|---|
| `derby_claim_without_rival` | a derby honour on a career whose clubs never had a modelled local rival |
| `cup_trophy_without_cup_win` | a cup trophy this season that the cup state did not produce |
| `cup_trophy_kind_mismatch` | the state won a `youth_cup`, the trophy list holds a `cup` |
| `cup_state_out_of_scope` | cup state carried for another season or another club |

The derby check deliberately looks at **every club the career has played for**, not the current
one. A derby memory from four clubs ago is legitimate; only a career that never once played
somewhere with a rival can be certain the honour is false. That is the reported case exactly.

## 17. Part 6 — generic outcomes

Already enforced, and re-verified rather than re-implemented. `tests/eventAudit.test.ts` D6 asserts
no outcome of a multi-outcome choice falls through to a valence label, and that its preview names
a consequence rather than restating the valence. The two new cup events' contested choices carry
concrete previews:

```
תכריע את הגמר ולא תיגע בדשא בכלל
תיעלם בגמר ותרים גביע שאחרים הכריעו
תהיה הטוב בדשא ותפסיד בכל זאת
תיעלם בגמר ותסתכל עליהם מרימים גביע
```

## 18. Scenarios

| | scenario | result |
|---|---|---|
| A | Kfar Saba win a cup final vs Umm al-Fahm | ✅ reaches the final, wins it, zero derby content |
| B | a cup final that IS a derby | ✅ true from rivalry data; event still cup-gated, not derby-gated |
| C | a final won | ✅ only the won variant eligible; trophy agrees with state |
| D | a final lost | ✅ only the lost variant eligible; a cup trophy is a violation |
| E | a run that ended at the semi-final | ✅ no cup event, no cup trophy |
| F | pre-v0.6.2 save, no cup state | ✅ no cup event, no crash, old cups not retroactively invalid |
| G | stale cup state (wrong season / club) | ✅ a violation in its own right, not quietly ignored |
| H | derby honour with no rival, and with one | ✅ caught; not raised for a legitimate past-club derby |
| I | terminology | ✅ no `הופעות ליגה` in any legacy milestone or component |
| J | two greatness axes | ✅ exactly two poster labels; `legend.score` unread |

## 19. Integrity scan

```
v0.6.2 INTEGRITY SCAN — 50,000 careers, balanced policy, positions rotated

clean careers   50,000 / 50,000   100.00%

No violations in any category.
```

Including the four codes added this version. The scan is the reason `cup_state_out_of_scope`
excludes retired careers: a retired career's `currentSeason` has already advanced one past the last
season it played, so its cup state is legitimately stale. Without that guard every one of the
50,000 would have "violated".

## 20. Regression vs v0.6.1

30,000 careers, balanced policy, positions rotated.

```
                              v0.6.1    v0.6.2
reached Maccabi senior team    63.3%     64.1%
played abroad                  31.8%     33.0%
returned to Maccabi            22.0%     22.0%
avg Legend Score                41.4      41.8
median Legend Score             33.0      34.0
avg Maccabi appearances        129.1     131.0
INVALID natural-stage repeats      0         0
same seed reproduces career     PASS      PASS
```

**Every seeded trajectory in the game moved**, and that is expected rather than alarming:
`projectCup` draws at preseason, so every draw after it lands differently. What matters is that
the *distributions* did not move — the largest shift is 1.2pp on playing abroad, and the shape of
the Legend Score histogram, the academy ladder, the recovery curve and the position table are all
within ordinary sampling noise of v0.6.1.

The visible cost of that shift was one pinned seed, re-pinned in §21.

Nothing here is a balance change, and none was intended: §14 shows the cup decomposition cancels,
and the league title, promotion, relegation and European rolls were not touched.

## 21. The re-pinned seed, and what it turned up

`tests/reconciliation.test.ts` pinned seed 722 for the loan-title reconciliation case. The RNG
shift broke it, which is routine — v0.5 re-pinned the same test from 3119 to 722 when the manager
minutes factor moved every trajectory.

Checking 722 before replacing it turned up something else: its Maccabi title season had
`onLoan: false`. **The pin had been named for a loan for two versions without being one.** The
assertion it actually makes — counter equals trophy list for a Maccabi title won during a spell
the career did not treat as "his" — was still being exercised, but not by the case its name
claimed.

Re-pinned to seed 11: one Maccabi championship in 2044, between a Hapoel Nof HaGalil season and a
Maccabi Herzliya one. The test name and comment now describe what it does.

## 22. Cup calibration in the running game

§14 proves the decomposition cancels, and `tests/cupTruth.test.ts` measures `projectCup` in
isolation. Neither answers the question that matters to a player: **do you win the same number of
cups?** That needs the whole engine, where the participation gate, the clubs he actually plays for
and the seasons he actually plays all get a say.

Measured on both versions, 4,000 careers each, balanced policy, positions rotated. The v0.6.1
figure comes from a throwaway worktree at `98f8079` running the same counting loop.

| | v0.6.1 | v0.6.2 | Δ |
|---|---|---|---|
| State Cups per career | 1.256 | 1.208 | −3.8% |
| foreign cups per career | 0.278 | 0.305 | +9.7% |
| **senior cups per career** | **1.534** | **1.513** | **−1.4%** |
| youth cups per career | 0.820 | 0.829 | +1.1% |
| careers winning any cup | 84.08% | 85.10% | +1.0pp |

The two populations are not paired — every seed produces a different career now — so these are
distribution comparisons, and the split between State and foreign cups moving in opposite
directions by a few percent is what that looks like. The aggregate senior cup rate moved **1.4%**,
which is the number the decomposition promised would not move and the honest size of the one drift
it does carry: the strength term is read at preseason, so a player is credited at the ability he
started the season with rather than the ability he finished it with.

New in v0.6.2, and previously unmeasurable because no such thing existed:

```
final in his last season   20.72%   (829 / 4,000)
of which a real derby      23
cup integrity violations   0
false derby honours        0
```

A cup final is now something a fifth of careers are sitting in when they retire, and 23 of those
829 were genuine derbies — arrived at by `rivalryBetween` on the two clubs actually in the final,
never asserted.

## 23. Mobile audit

```
width  probe-canary      retirement  retirement-modest  sheet-legacy  decision  season  season-cup
320    over=1 (+296)     over=0      over=0             over=0        over=0    over=0  over=0
360    over=1 (+256)     over=0      over=0             over=0        over=0    over=0  over=0
390    over=1 (+226)     over=0      over=0             over=0        over=0    over=0  over=0
412    over=1 (+204)     over=0      over=0             over=0        over=0    over=0  over=0
430    over=1 (+186)     over=0      over=0             over=0        over=0    over=0  over=0
```

The canary fails at every width, so the zeros are measurements rather than a silently broken
probe. Two surfaces changed and both were checked by reading the DOM rather than by looking at a
screenshot:

```
poster-scores      80 / קריירה עולמית · 95 / מורשת מכבי       (exactly two labels)
מדד אגדה           absent
season-cup-final   🥈 הפסד בגמר הגביע.
```

`season-cup-final-lost` is a new gallery fixture, and deliberately built by setting `world.cup`
rather than by faking the line — if `CupRunLine` ever stops reading the authoritative state, the
fixture goes blank and says so.

No red prestige identity. No new cards in the primary gameplay loop: the cup line is one faint
row inside the existing season summary, and the two cup events reuse the existing `final` variant.

---

## 24. Scope held

Not built, as required: full cup bracket, cup schedule or draw, Collection, Trophy Cabinet, Career
Album, saved career gallery, Share Card, meta progression, broad UI redesign, achievement
collection screen, Base44, leaderboards, cloud profile, player attributes, real stadium database.

No player photographs or likenesses. No red prestige shields. `SCHEMA_VERSION` unchanged at 4 —
`world.cup` is optional and absent means absent.

v0.7 not begun.

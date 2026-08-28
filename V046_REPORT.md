# Maccabist v0.4.6 — World State, Event Logic & Narrative Depth

**Scope:** make the game know what is happening in the football world right now, and make every
event earn what it claims about it.

**Result:** build passes, **543 tests** pass (from 455 at the end of v0.4.5.1). No schema break;
v0.4.5.1 saves load and are given a league table.

The headline is not a feature. It is an **ordering fix**: `planSeason` chooses every event for a
season at *preseason*, and the club's league finish was drawn at *season end*. A late-slot "title
decider" was therefore selected months before anyone knew the club would finish eleventh, and no
per-event condition could have prevented it — the information did not exist yet.

---

## 1. Build and test status

```
npm run build                           PASSES
npx tsc -p tsconfig.test.json --noEmit  PASSES
npm test                                543 passed   (455 at the end of v0.4.5.1)
```

| new test file | tests | what it pins |
|---|---|---|
| `tests/leagueTable.test.ts` | 24 | the table cannot contradict the season it describes |
| `tests/leagueSave.test.ts` | 13 | a round trip redraws the identical table; old saves get one |
| `tests/eventClaims.test.ts` | 16 | no event says דרבי without requiring one |
| `tests/roleBalance.test.ts` | 9 | `star` discriminates, and roles fall as well as rise |
| `tests/outcomePreviews.test.ts` | 9 | previews are concrete, and belong to the drawn outcome |
| `tests/scenariosV046.test.ts` | 17 | the brief's ten bug scenarios, reproduced deliberately |

## 2. Baseline (v0.4.5.1, measured not assumed)

```
build PASSES   455 tests   128 events   21 test files
star per senior season                64.8%   (97.8% at clubs below quality 50)
outcome previews, as players see them  0% written   100% generic
```

---

## 3. Live League State

### 3.1 The ordering fix

```
preseason   projectSeason draws a final position, and a path that reaches it
any phase   buildTable derives a full table from that path
events      gate on leagueContext, which reads the path
season end  the recorded outcome IS the projected position's outcome
```

`src/game/leagueEngine.ts`. The table is **never stored** — it is a pure function of the
projection plus a seed, so a save holds a dozen numbers instead of a table per phase and a
reloaded season redraws the same table to the point. There is a test for exactly that.

**The invariant:** the table cannot contradict the outcome, because the outcome is *derived from*
the final position rather than drawn alongside it. And by the late phase the club is already
inside the band its outcome describes, so "a club that finishes eleventh cannot get an April
title-decider" is true by construction rather than by a check somewhere.

The player still moves his club — `settleProjection` applies his actual season — but only within
the band the projection committed to at preseason. He can be why they finished second instead of
fourth; he cannot turn a planned title race into mid-table after the events for it were chosen.

### 3.2 Table generation

`src/data/leagueShape.ts` gives every league a real size, European, promotion and relegation
places, and enough opponent names to fill a table. The club dataset models nine clubs in ליגת העל
and one or two per European league, which is the right amount of *club* to model and is not a
league table.

Club **names** are facts and are used as such. No crest, badge or other club artwork is reproduced
anywhere in this project.

### 3.3 Calibration

Rescaling the old rung-based `seasonVariance` onto a table produced a league far too orderly:
promotion fell to **5.4%** of second-division seasons against 17.7% in v0.4.5.1 and roughly
12–15% in real football, because reaching the top two from a mid-table projection needed a
2.3-sigma season. Real tables are less obedient than squad strength implies. `WORLD.tableVariance`
at 0.2 of division size puts the standard deviation near three places:

| | v0.4.5.1 | v0.4.6 |
|---|---|---|
| promoted, per second-division season | 17.7% | 11.2% |
| promotion_challenge | — | 13.9% |
| champion, per top-flight season | — | 16.4% |
| relegated | — | 6.1% |

One bug found by its own test: points were drawn per row from a curve plus noise, which let 12th
finish a point above 11th — a table contradicting its own ordering. They are now generated as a
descending sequence.

### 3.4 Maccabi's parallel season

Maccabi is projected independently so it has a season wherever the player is. When he is in their
division that was two answers to one question, and the panel said Maccabi were 1st above a table
showing them 3rd. `buildTable` now pins both projections into one table — and then the *same bug
one level down*: `leagueContextFrom` was still building its own **unpinned** table, so the gap line
read "4 points off Europe" above a table where it was 3. The pin is threaded through the context
and the match engine as well. One table, one answer, for the UI and the gating both.

---

## 4. Club crests

Drawn, never loaded. An SVG shield built from the club's colours and initials, so there is no such
thing as a broken or missing badge — nothing is fetched and no external URL is depended on. Clubs
with no declared colours get a deterministic palette from their id; a filler club whose badge
changed between screens would be worse than no badge. `ClubVisual` carries an unused `asset` field
so licensed artwork could later be a data edit rather than a component rewrite.

---

## 5. Event eligibility

### 5.1 The rule, stated once

`src/game/eventClaims.ts` scans each event's **presented** text — kicker, title, description — for
claims and requires the matching condition. Outcome text is deliberately excluded: "you won the
title" inside a winning branch is a result, not a premise.

The audit found six, all fixed:

| event | what was wrong |
|---|---|
| `rare_derby_legend` | asserted a derby with **no club condition at all** — any academy in the game |
| `youth_derby_youth` | its comment said "the other Haifa club", its text said מכבי תל אביב |
| `sen_derby_moment` | named a derby with no opponent |
| `vt_final_derby` | same |
| `sen_title_run_in` | "five rounds to go, one point apart" required only a senior role |
| `sen_title_penalty` | a title-deciding penalty with no title race |

### 5.2 The systems behind them

- **`src/data/rivalries.ts`** — a rivalry is a fact about a *pair* of clubs. `localDerby` is the
  only type that earns the word דרבי; Maccabi Haifa vs Maccabi Tel Aviv is a `majorRivalry` and is
  not a derby. **Hapoel Haifa is now a modelled club**, because the game's most-used match label
  was played against a club that was not in the dataset.
- **`src/game/matchEngine.ts`** — a real opponent, in a real table position, drawn
  deterministically. A title decider needs both clubs in it: "we are third, they are eleventh" is a
  big match and not a decider.
- **`src/game/worldPredicates.ts`** — one answer to "is this club in a title race". Every predicate
  **fails closed**: no table means *not* in a title race, not "unknown, so allow it". That default
  is what kept letting these events through.

### 5.3 Two bugs found by measuring reachability

A condition that makes an event impossible is not a fix; it is a deletion with extra steps. So
`scripts/coherenceMetrics.ts` reports both directions.

1. Conditions were evaluated against the **current** phase, but `planSeason` picks the whole season
   at preseason — so late-slot title events were judged against the August table.
   `conditionContext` now carries the slot.
2. Worse: the senior stage budgets 1–2 events, so `planSeason`'s three-slot branch never ran there
   and **the late slot was never allocated to a senior season**. Every senior event declaring
   `slots: ['late']` was unreachable — `spon_last_minute` since the day it was written. The title
   events were eligible in **131 of 481** senior preseasons and planned in **zero**. A two-event
   season can now place its second event late instead of mid, which fixes the class and leaves the
   number of events per season unchanged.

`tests/eventClaims.test.ts` now fails the build for an event whose declared slot no stage can
allocate.

---

## 6. Outcome previews

A decision used to read "תוצאה טובה 30% / תוצאה רעה 30% / בלי דרמה 40%". Showing odds is only
worth something if the odds are on something *specific*.

`EventOutcome.preview` is what could happen, in the present or future, shown before the roll —
deliberately separate from `text`, which is the resolution and is past tense.

Coverage is measured against what players **see**, weighted by firing frequency, because half the
catalogue is rare and writing previews in id order would move a number without changing what
anyone reads. The first measurement counted shared labels like 'הצלחה גדולה' as concrete and
reported 92.3%; looking at the reveal screenshot showed why that flatters, so it is now three
tiers and the test counts only written previews.

```
AS SEEN        written preview  88.0%     shared label 5.0%     bare valence 6.9%
CATALOGUE      written preview  171/313   54.6%
                                          (0% written before this version)
```

**Phase 13** is now tested as object identity, not just equal probabilities: the label a player was
shown must belong to the outcome that can actually be drawn. Also pinned — percentages sum to
exactly 100, no duplicate outcome ids in a choice, no choice with zero total weight.

**Phases 14 and 35 were verified rather than rebuilt.** The reveal already leads with the narrative
and shows the stat change second; `diffCareer` already emits only fields that changed; `TRACKED`
already excludes hidden potential.

---

## 7. Role and star rebalance

v0.4.5.1 removed `icon` from the squad ladder and the inflation moved down a rung. Measuring by
club level showed the real shape, and it was not what the previous report assumed:

```
v0.4.5.1   strong clubs 41.7% star   mid 79.9%   weak 97.8%
```

Two causes, and the obvious one was not the binding constraint.

1. **The ladder was purely relative.** Against a bad club a good player is its best by a mile, so
   the model called him a star. Nobody calls the best player at a struggling side a star; he is
   their key player.
2. **The ability-vs-level edge was counted twice** — as an upward push each half-season *and* as
   the ceiling. The push nearly cancelled the ceiling's gravity: a player at 100 with a ceiling of
   71 drifted down under a point per half-season and would have needed eighteen seasons. That is
   why making the ceiling concave and bounded, a real fix for the pinning, moved the distribution
   by 0.1 points on its own.

### 7.1 A regression this created, and how it was found

The large simulation — not a test — caught that the new model had been applied to the academy as
well, where two other systems read `roleValue` as an absolute quantity:

```
early academy promotion      16.9%  ->   7.1% of careers
rejected boys invited back    39.0%  ->  12.7% of that group
and later joining Maccabi     32.5%  ->  11.3%
```

The second is the road back for a boy Maccabi turned away — the question this whole version of the
game is built around. Two corrections failed and are worth recording: exempting the academy from
the club cap alone did almost nothing, and rescaling `earlyThreshold` / `retrialThreshold` did
almost nothing either, because retrial eligibility is a **gate** on role being `starter` or better,
not a score, so moving a threshold could not reach it.

The answer was to scope the change to where the defect was. An age group is not a club in a
professional pyramid. The academy keeps the v0.4.5 model calibrated for it; the new model applies
to senior football.

---

## 8. Coherence metrics

*(filled from the run in §9)*

---

## 9. Simulation

*(filled from the run)*

---

## 10. Mobile and RTL

26 gallery scenes × 6 widths (320 / 360 / 375 / 390 / 412 / 430): **zero overflow**, with the
probe re-validated against its 600px canary immediately afterwards — a clean sweep from an
unverified tool is worth nothing.

Table zones are marked by **label as well as colour** (אליפות / אירופה / עלייה / ירידה), because a
red row means nothing to someone who cannot see red.

---

## 11. Known issues

*(filled at the end)*

---

## 12. Deferred to v0.5

Not started, per the brief: agents, personal trainers, manager personalities, relationship
characters, historical legend comparisons, leaderboards, backend, Base44, full squads, full
fixtures, a match engine, salary economy, contract negotiation.

**Phase 43** — the event architecture is ready for a speaker without a rewrite: `MatchContext`
already carries a real opponent club id, `ClubVisual` already resolves any club to an identity, and
`eventClaims` already scopes a rule to an event's declared conditions. A `speakerId` on an outcome
would slot into the same pattern.

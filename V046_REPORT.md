# Maccabist v0.4.6 — World State, Event Logic & Narrative Depth

**Scope:** make the game know what is happening in the football world right now, and make every
event earn what it claims about it.

**Result:** build passes, **554 tests** pass (from 455 at the end of v0.4.5.1). No schema break —
`SCHEMA_VERSION` is still 4, so v0.4.5.1 saves are migrated rather than discarded.

The headline is not a feature. It is an **ordering fix**: `planSeason` chooses every event for a
season at *preseason*, and the club's league finish was drawn at *season end*. A late-slot "title
decider" was therefore selected months before anyone knew the club would finish eleventh, and no
per-event condition could have prevented it — the information did not exist yet.

---

## 1. Build and test status

```
npm run build                           PASSES
npx tsc -p tsconfig.test.json --noEmit  PASSES
npm test                                554 passed   (455 at the end of v0.4.5.1)
```

| new test file | tests | what it pins |
|---|---|---|
| `tests/leagueTable.test.ts` | 28 | the table cannot contradict the season it describes |
| `tests/leagueSave.test.ts` | 15 | a round trip redraws the identical table; old saves get one |
| `tests/eventClaims.test.ts` | 16 | no event says דרבי without requiring one |
| `tests/roleBalance.test.ts` | 9 | `star` discriminates, and roles fall as well as rise |
| `tests/outcomePreviews.test.ts` | 9 | previews are concrete, and belong to the drawn outcome |
| `tests/scenariosV046.test.ts` | 22 | the brief's bug scenarios, reproduced deliberately |

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

### 5.0 Position coherence, and why the first test missed it

`sen_derby_moment` had **no position condition at all**, so a goalkeeper could be told
"הכדור מגיע אליך בקצה הרחב" and offered "לבעוט". Three more did the same — `spon_last_minute`,
`rare_derby_legend`, and `spon_form_slump`, the last being a scoring drought, which goalkeepers do
not have.

The scenario test could not see this: it checked events that *declare* `positions`, and these
declared none. So it became a rule rather than four edits — an event whose text or choice labels
say לבעוט / הכדור מגיע אליך / לנגח / לכבוש must exclude GK. The patterns are narrow on purpose:
`שער` is left out because it also means a gate, and "שער צפוני" is a stand. A rule that fires on a
stand name is a rule people learn to ignore.

Excluding him was necessary and not sufficient, so keepers now have **`gk_derby_save`**. A derby
is a derby for a goalkeeper too; it is a different moment, and the memory it leaves is a save
rather than a goal.

### 5.1 The rule, stated once

`src/game/eventClaims.ts` scans each event's **presented** text — kicker, title, description — for
claims and requires the matching condition. Outcome text is deliberately excluded: "you won the
title" inside a winning branch is a result, not a premise.

Five rules over 129 events, **zero unsupported claims**. The audit found six on the first pass:

| event | what was wrong |
|---|---|
| `rare_derby_legend` | asserted a derby with **no club condition at all** — any academy in the game |
| `youth_derby_youth` | its comment said "the other Haifa club", its text said מכבי תל אביב |
| `sen_derby_moment` | named a derby with no opponent |
| `vt_final_derby` | same |
| `sen_title_run_in` | "five rounds to go, one point apart" required only a senior role |
| `sen_title_penalty` | a title-deciding penalty with no title race |

…and three more once the patterns were widened, because the first version listed five ways of
saying "title race" and none of them was "אליפות באוויר":

| event | what was wrong |
|---|---|
| `wrl_title_race` | "one point apart at the top" gated on **squad strength decided in August** |
| `wrl_relegation_battle` | "bottom of the table" for any weak squad, including one having a great season |
| `wrl_promotion_race` | "top of the league" for any strong second-division squad, up there or not |

`wrl_title_race` is the brief's headline bug verbatim: a championship event in a season the club
finished low. The patterns are now deliberately generous — a false positive costs one explicit
condition on an event, a false negative costs a player being told his mid-table club is one point
off the top. One pattern was then *removed* again: `בצמרת` flagged `wrl_promotion_race` as an
unsupported title claim, and it was right to be ambiguous — "top of the league" in a second
division is a promotion race, and the bare phrase cannot tell them apart.

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

## 10. Acceptance criteria

| # | criterion | where |
|---|---|---|
| 1 | player can see where his club stands | `LeagueTableCard`, in `GamePage` under the hub |
| 2 | and where Maccabi stands | `MaccabiStatus` footer; separate league shown when different |
| 3 | the table evolves across the season | `path` per phase, §3.1, tested |
| 4 | deterministic, survives saves | `tests/leagueSave.test.ts` |
| 5 | final table never contradicts the outcome | derived, not drawn — §3.1 |
| 6 | lower-table club gets no late title-decider | scenario A, 60 seeds |
| 7 | top club gets no relegation-decider | scenario A2, 60 seeds |
| 8 | promotion events only in promotion context | scenario A2 |
| 9 | דרבי only for modelled rivalries | scenarios B and C |
| 10 | at Maccabi, live events are Maccabi events | scenario D |
| 11 | elsewhere, they belong to the current club | scenario E |
| 12 | Maccabi still appears as a side thread | scenario F |
| 13 | side events never imply current membership | `clubScope`, unchanged from v0.4 |
| 14 | external careers feel like club careers | table, match strip, crests |
| 15 | crests make the world richer | §4 |
| 16–17 | events know *why* they are eligible, and debug can say so | §5, Phase 29 |
| 18–19 | concrete consequences, not good/bad/neutral | §6 — 88.0% written |
| 20 | displayed odds are the resolver's odds | `tests/outcomePreviews.test.ts`, object identity |
| 21–22 | narrative first, numbers second | verified, not rebuilt — §6 |
| 23–24 | star inflation reduced, star still meaningful | §7 — 64.8% → 25.9% |
| 25 | goalkeeper events position-coherent | §5.0, scenario J |
| 26–28 | academy rules, Maccabi relationship, visual identity intact | 0 invalid repeats; suite green |
| 29–31 | tests, build, large simulation | §1, §9 |

---

## 10.1 Mobile and RTL

26 gallery scenes × 6 widths (320 / 360 / 375 / 390 / 412 / 430): **zero overflow**, with the
probe re-validated against its 600px canary immediately afterwards — a clean sweep from an
unverified tool is worth nothing.

Table zones are marked by **label as well as colour** (אליפות / אירופה / עלייה / ירידה), because a
red row means nothing to someone who cannot see red.

---

## 11. Known issues

**`spon_form_slump` no longer reaches goalkeepers, and nothing replaced it.** Excluding them was
right — "לא נכנס לך כלום" is a scoring drought — but a keeper's bad run is a real thing and there
is now no event for it. `gk_derby_save` covers the derby gap; this one is open.

**Rivalries are Israeli only.** Six pairs, all in ליגת העל. A player abroad has no derby, which is
honest rather than wrong — the dataset models one or two clubs per European league, so there is
nobody to have a rivalry *with* — but it does mean an external career is missing one of the things
that makes a club career feel like one.

**37% of the catalogue still has no written preview.** Weighted by what players see it is 12%
(§6), and the remainder is the long tail of rare and narrow events. The tail is genuinely less
valuable, but it is not zero.

**The second division has no modelled derby.** Same cause as above.

**`europe` is a declared event variant that no event currently resolves to** for a home-based
career. Carried over from v0.4.5.1 and still true.

**Filler clubs are names and a quality number.** They fill a table and never appear in a transfer,
which is correct for now and would be wrong if the table ever became something a player interacts
with.

---

## 12. Deferred to v0.5

Not started, per the brief: agents, personal trainers, manager personalities, relationship
characters, historical legend comparisons, leaderboards, backend, Base44, full squads, full
fixtures, a match engine, salary economy, contract negotiation.

**Phase 43** — the event architecture is ready for a speaker without a rewrite: `MatchContext`
already carries a real opponent club id, `ClubVisual` already resolves any club to an identity, and
`eventClaims` already scopes a rule to an event's declared conditions. A `speakerId` on an outcome
would slot into the same pattern.

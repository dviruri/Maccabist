# Maccabist v0.4.1 — Deep Coherence & Game Feel

**Scope:** make the world logically coherent, rebalance career outcomes and player agency, and
make decisions feel like a game.

**Result:** build passes, **387 tests** pass (from 341 at the end of v0.4), 60,000 careers
simulated. Schema stays at 4; v0.4 and v0.3.1 saves are migrated on load, and a save written in
the identity-bug state is actively repaired.

---

## 1. Build status

```
npm run build   PASSES
npx tsc -p tsconfig.test.json --noEmit   PASSES
```

## 2. Test status

```
npm test        387 passed   (341 at the end of v0.4)
```

New test files this version:

| file | tests | covers |
|---|---|---|
| `tests/identity.test.ts` | 20 | club / team unit / stage as three concepts, whole-career coherence sweep |
| `tests/decision.test.ts` | 25 | the probability invariant, determinism, frequency validation, bug reports |
| `tests/longevity.test.ts` | 18 | retirement windows, career-length distributions, the goalkeeper investigation |
| `tests/risk.test.ts` | 9 | choice-level expected value, bold vs reckless, variance |
| `tests/scenarios.test.ts` | 15 | the lettered scenarios A–M end to end |

Extended: `tests/world.test.ts` (22 → 38), `tests/eventAudit.test.ts` (8 → 16).

---

## 3. Main coherence fixes

The headline playtest report was: *a player promoted from נערים א׳ to the Maccabi first team was
still displayed as "מכבי חיפה מחלקת ילדים" for the rest of his career.*

That was not a string bug. `'senior'` is the last entry in `STAGE_LADDER`, and
`resolveAcademyProgression` clamped its target to the ladder's length — so a נערים א׳ player
earning an early promotion could land on `'senior'` as an ordinary rung, moving the **stage**
without anything moving the **club**. He then had `academyStage: 'senior'` and
`currentClubId: 'maccabi_academy'`, and every screen read the academy club's name.

Measured at **2.3% of careers**, and once it happened it persisted for ~30 seasons — 922 affected
season-steps across 600 careers.

Fixed at three levels:

| level | fix |
|---|---|
| root | the academy ladder now stops at נוער. Reaching senior football is a transition with a verdict, offers and a club move — never a rung. **2.3% → 0.0%** |
| architecture | `src/game/identity.ts`, below |
| migration | `hydrateCareer` repairs saves already written in the broken state |

The migration deliberately moves him to Maccabi rather than demoting him back into the youth
teams: he is a senior, and it was the club that was never updated. Demoting him would delete
seasons he actually played.

### Other coherence fixes

- **An academy event transferred a boy to a senior club.** `transferTo: 'hapoel_afula'` was
  hardcoded in a נערים event; Hapoel Afula is a senior club, so `moveToClub` set
  `academyStage: 'senior'` and a fourteen year old became a professional on the spot. It was also
  55.4% of every second-division season in the game. `transferTo` now accepts a pool sentinel
  (`'external_youth'`) resolved through the seeded RNG.
- **`sen_return_call`** named מכבי חיפה while declaring its Maccabi relationship only through the
  older `hasLeftMaccabi`, which a reader had to infer. Given the explicit
  `clubScope: 'formerMaccabi'`.
- **`cloneCareer` silently dropped new world fields.** It rebuilt `world` field by field, so
  `maccabiSeasons` was wiped by every clone the moment it was added. It now spreads first.

---

## 4. Club / team / stage identity architecture

`src/game/identity.ts` separates three concepts the codebase had collapsed into one club id:

```
CLUB IDENTITY   which club he belongs to        maccabi_haifa
TEAM UNIT       which side of it he plays for   academy | youth | first_team
STAGE           where he is in development      youth_a | u19 | senior
```

They are genuinely independent: a boy at Maccabi's academy and a Maccabi first-team player share
a club and share nothing else. Everything is **derived, never stored**, so it cannot go stale and
old saves get correct answers for free.

`currentTeamDisplay(career)` is the single source of truth. `format.ts`, `SeasonCards` and the
season records all consume it; nothing assembles team wording independently any more.

One detail that mattered: the academy club record is named `"מכבי חיפה - מחלקת ילדים"` because it
doubles as the player's club id while he is a boy. That suffix belongs to the **unit**, not the
club, so `clubDisplayName` strips it — otherwise a screen prints
`"מכבי חיפה - מחלקת ילדים — נערים א׳"`.

Display rules:

| situation | shown |
|---|---|
| Maccabi, ילדים א׳ | מכבי חיפה — ילדים א׳ |
| Maccabi, נוער | מכבי חיפה — נוער |
| Maccabi first team | מכבי חיפה |
| any senior club | the club name alone |
| a past season | the wording that was true **then** |

A first-team player is never labelled "בוגרים" — nobody refers to a professional footballer by
his age group. Historical records keep their own club and stage, so a retired player's נערים ב׳
season still reads נערים ב׳, which is history rather than staleness.

`hasCoherentIdentity` asserts the two legitimate club/stage combinations, and a test sweeps every
step of whole simulated careers under two policies.

---

## 5. Event audit results

`src/game/eventValidation.ts` turns every *class* of coherence bug found across v0.3.1, v0.4 and
v0.4.1 into a rule that runs in the test suite. Eleven rules:

duplicate event ids · single-choice events · zero or negative outcome weights · duplicate outcome
ids · Maccabi text without a declared relationship · professional gates reaching childhood ·
contradictory stage/band · impossible age windows · position lists that exclude everyone ·
contradictory memory conditions · contradictory club scopes · club-strength windows no club in the
game satisfies.

It found one real issue on its first run (`sen_return_call`, above) and exposed two bugs in my own
rules — the Maccabi check did not recognise `hasLeftMaccabi`, and the position check ignored
`notPositions` when `positions` was also set.

**Events reviewed:** the whole pool (124 events at the start of the version, 128 after the ambient
Maccabi family). **Events changed:** 3 (one hardcoded destination, one scope declaration, one
memory dilution removed). **Events added:** 4.

The validator reports every problem at once rather than throwing on the first, because content is
far easier to fix in one pass.

---

## 6. Career longevity changes

v0.4 retired **every position at exactly 36/37/38** (p10/p50/p90) — no spread at all. The cause
was that the simulation policies said "retire at 36" and the retirement model was never consulted.

`retirementChance` is now read from context: how far past the position's window he is, how much of
his peak he has lost, whether he is still playing, whether he still has a place in the team. A
player still performing at a high level gets relief, which is what makes the rare 37–38 year old
outfielder happen without letting everyone reach it. Goalkeepers get a later window on both ends,
but the same context terms apply.

Decline is position-aware too (`declineFactor`: GK 0.55, CB 0.85, FB 0.95, others 1.0), so a
longer goalkeeping career is a consequence of the model rather than an exception bolted onto it.

### Before / after

Measured over careers that reached senior football — an academy release is not a retirement age.

| | v0.4 | v0.4.1 |
|---|---|---|
| outfield p10 / p50 / p90 | 36 / 37 / 38 | **33 / 35 / 36** |
| goalkeeper p10 / p50 / p90 | 36 / 37 / 38 | **36 / 37 / 39** |
| outfield mean | ~37 | **34.4** |
| goalkeeper mean | ~37 | **37.2** |

Outfield distribution: 29–31 1.8%, 32–33 27.5%, 34–35 51.5%, 36–37 18.4%, 38–39 0.8%, 40+ 0.0%.

Goalkeeper distribution: 34–35 4.8%, 36–37 50.9%, 38–39 40.7%, 40+ 3.6%.

That matches the brief: most outfield careers end 33–35, exceptional ones reach 36–38, very rare
ones go beyond; many goalkeepers stay effective to 36–38 and a few go further — but not all of
them reach 40.

A safety valve lets a collapsed career exit before its position's window opens, so a keeper whose
level had gone at 31 is not stuck with no way out. Measurement shows this state is rare in
practice (keepers decline slowly), so it is a guard rather than a fix — and it is tested, because
a guard that can never fire is dead code.

---

## 7. Club Career Level model

v0.4 read transfer direction from league level alone, so **Hapoel Hadera → Maccabi Haifa** and
**Maccabi Haifa → Hapoel Hadera** both came out `lateral` — they share a division.

`clubCareerLevel(career, clubId)` combines league level, squad strength, prestige, league
visibility and European chance into one 0–100 number, read from the live world state. It is now
the single input to transfer direction, career memories and offer wording, so "is this a step up?"
has one answer everywhere.

Measured spread: **23.5 (Hapoel Afula) to 85.9 (Atletico)**.

`MoveDirection` gains `major_up` and `major_down`, because "up" previously covered both a better
club in the same league and a jump from the Israeli second division to Serie A.

Thresholds were set from that measured spread. A first pass at 5/15 made literally every move in
the game "major", including two mid-table clubs swapping. At **7/22**:

| move | v0.4 | v0.4.1 |
|---|---|---|
| Hadera → Maccabi | lateral | **up** |
| Maccabi → Hadera | lateral | **down** |
| Maccabi → Maccabi TA | up | lateral |
| Afula → Maccabi | up | major_up |
| Maccabi → Napoli | up | major_up |
| Napoli → Sturm Graz | down | major_down |

The model responds to the world: a relegated Maccabi drops from 57.8 to 47.9 and recovers when
they come back up — while still outranking Hapoel Hadera, because a fallen giant is not a
mid-table club.

A downward move is **not** labelled a bad one. Dropping a level to start every week is a
legitimate football decision, and direction describes the move rather than its wisdom.

---

## 8. League identity fixes

`defaultLeagueFor` read the club **tier** first, so Benfica — with `pt_primeira` modelled and
sitting right there — was displayed as playing in "ליגה אירופית חזקה", a career-quality bucket
masquerading as a league name. Germany, Spain, Italy and England had clubs but no league at all.

Country now comes first, and the four missing leagues are modelled: הבונדסליגה, לה ליגה,
הסרייה א׳, הפרמייר ליג. All thirteen European clubs show their real competition.

The generic buckets remain as a **fallback** for a club in a country with no modelled league, so
adding a club never breaks and adding its league stays a pure data change. League identity and
career quality are now separate facts, which is the point.

---

## 9. Israeli club variety changes

The second division had **2 clubs**. It now has **10**: Hapoel Ramat Gan, Hapoel Nof HaGalil,
Maccabi Herzliya, Hapoel Kfar Saba, Hapoel Rishon LeZion, Sektzia Nes Tziona, Hapoel Umm al-Fahm
and Maccabi Kabilio Jaffa alongside the existing two. Several rate above the division's own
quality, so a genuine promotion race is now reachable there.

Adding clubs alone did **not** fix the variety problem, and measuring found why: the hardcoded
`transferTo: 'hapoel_afula'` in §3 accounted for 55.4% of every second-division season played.

| | before | after |
|---|---|---|
| distinct clubs used | 10 | 10 |
| most-used club share | **55.4%** | **13.8%** |
| least-used club share | 3.7% | 7.4% |

---

## 10. Ambient Maccabi World

v0.4 only simulated the club the player was standing in, so the moment he left, Maccabi stopped
existing until he came back. That undercuts the premise: Maccabi is meant to be the fixed star he
navigates by, not a location he is standing in.

Maccabi now plays its own season every year regardless, using the same model minus the player's
impact — he was not there. One RNG draw per season. No other club is simulated, because no other
club is load-bearing for the story.

Kept in `world.maccabiSeasons`, separate from `clubSeasons`, so the season summary still shows the
player's own club and nothing confuses whose campaign a result was.

### A bug this exposed

`rng.gaussian` is **hard-bounded to ±spread** with no tails. A club whose expected finish was five
rungs up therefore could not be relegated *at all* — "strong clubs usually finish high but
occasionally implode" was a comment describing something the maths forbade. Added `rng.normal`
(Box-Muller) and used it for club seasons.

Maccabi's ambient season distribution:

| outcome | before | after |
|---|---|---|
| champion | 7.9% | **31.5%** |
| title_challenge | 61.4% | 26.2% |
| european_places | 30.6% | 22.4% |
| upper_table | 0.1% | 13.0% |
| mid_table | 0.0% | 5.5% |
| lower_table | 0.0% | 1.3% |
| relegation_battle | 0.0% | 0.10% |
| relegated | **0.0%** | **0.01%** |

Vanishingly rare but possible, which is the whole point — and they climb back.

### The events

Four, all requiring something to have actually happened plus a long cooldown. The brief's rule is
right: *the connection should feel present, not inserted*.

| event | balanced | ambitious |
|---|---|---|
| they won it without you | 27.3% | 37.1% |
| they need your position | 12.7% | 8.9% |
| the club is falling apart | 4.4% | 7.3% |
| they went down | 0.3% | 0.0% |
| **any ambient event** | **39.9%** | **47.8%** |

The title event needed weighting *down* from 26 to 13 with a 7-season cooldown: Maccabi win about
a third of seasons, so across ~11 seasons away it fired in half of all careers at first.

"They won it without you" was also reading the player's *own* Maccabi titles, so it could fire for
a player who lifted the trophy himself. The condition now reads only the seasons he missed.

---

## 11. Goalkeeper investigation

**Root cause first, changes second.** Goalkeepers trailed on every metric, and none of it was
because goalkeeping is hard.

Measured baseline: GK mean senior rating **49.92** against CM **55.02** — a 5.1-point deficit
feeding everything downstream, because rating drives `careerLevel`, which drives transfer
interest.

Three structural artifacts:

### 11.1 A keeper was scored against goals he cannot score

`outputWeight: 0.15` was meant to make goal output matter *less* for a keeper. But a keeper
records zero goals and assists while `expectedOutputPerApp` is non-zero, so the output delta
clamped to **−1 every single season** and the "reduced weight" became a fixed **−2.4 rating tax**
for failing to do something the model never expected him to do.

Fixed by skipping the term entirely when `outputWeight` is 0. A keeper is measured by clean sheets
and goals conceded.

### 11.2 The Legend Score's compensation multiplied zero

The contribution component was `(goals + assists × 0.7) × legendOutputFactor`, with a 6× factor
for a keeper "to compensate" for scoring rarely. **No multiplier scales zero.** Goalkeepers scored
*nothing at all* on that component. `cleanSheets` was tracked and thrown away.

Clean sheets now count, via `legendCleanSheetFactor`.

### 11.3 The clean-sheet benchmarks were set above what the model produces

| position | benchmark | actual rate | effect |
|---|---|---|---|
| GK | 0.34 | 0.317 | −0.92 rating |
| CB | 0.30 | 0.283 | −0.68 rating |
| FB | 0.26 | 0.246 | −0.56 rating |

The term meant to *reward* a good defensive season was a permanent penalty for an average one.
Recalibrated to the measured rates.

### Results

| | before | after |
|---|---|---|
| GK mean senior rating | 49.92 | **52.68** |
| GK Maccabi senior rate | 61.8% | **68.2%** |
| GK Europe rate | 31.6% | **39.3%** |
| Legend Score spread across positions | 39.0–45.0 (GK bottom) | **41.7–44.6** |

The clean-sheet factors needed two calibration passes. The first overshot once the youth-club fix
in §3 changed career paths: goalkeepers went from bottom to **top** (45.4) and centre backs became
the new outliers. Final spread is a 2.9-point band across all six positions.

Goalkeepers now feel different rather than disadvantaged. **Residual gaps are reported rather than
tuned away:** GK Europe is still a few points behind a striker, and centre backs remain the lowest
Legend Score — plausibly correct, since the score rewards Maccabi service and attacking
contribution.

---

## 12. Risk / Reward changes

v0.4 measured the risk-taking baseline with a **lower standard deviation than the safe one** as
well as a lower mean. Bold play was simply worse, with no compensating tail.

Investigating found the framing was most of the problem:

- `riskTakerPolicy` prefers `risky` choices over `opportunity` ones — and measured across the
  pool, opportunity choices carry **10.59** expected value against risky's **4.28**. It
  systematically declines the best available choices.
- Its `pickOffer` chose uniformly from every offer, **including "your contract is terminated"**.
  That is recklessness about offers rather than about risk appetite.

Per-choice expected value is now roughly level (safe 5.79, balanced 5.01, risky 4.28), while risky
takes a bad outcome 40% of the time against safe's 3% — variance, not a worse bet. Raising
`riskyUpsideBoost` 2 → 2.6 and `riskyUpsideGain` 1.6 → 2.1 moved the *career-level* outcome by
about one point, which confirmed the knobs were never the lever.

`riskTakerPolicy` stays as the deliberate worst case that answers "is bold play a trap?".
`boldPolicy` is new: the strategy a bold human actually plays — reach for the big upside when it is
on offer, take a real step up, don't gamble when the safe option is plainly better. It reads the
same distributions the player sees, so it cannot use information the UI does not show.

### Matched metrics, 3,000 careers per policy

| policy | legend mean | sd | top 10% | bottom 10% | peak mean | peak sd | collapse | Europe | Maccabi srs |
|---|---|---|---|---|---|---|---|---|---|
| safe | 47.9 | 33.2 | 98 | 8.9 | 81.5 | 9.5 | 5.4% | 0.0% | 56.1% |
| balanced | 44.8 | 26.6 | 91 | 9.5 | 82.3 | 9.9 | 4.4% | 40.8% | 67.3% |
| **bold** | 36.2 | 21.8 | 81 | 9.3 | **83.1** | **10.4** | 4.6% | **76.0%** | **69.2%** |
| reckless | 19.8 | 14.8 | 52 | 3.4 | 80.5 | 10.5 | **32.8%** | 75.6% | 61.9% |

Bold play collapses **no more often than balanced** (4.6% vs 4.4%) while producing the best
footballer: the highest peak ability, the widest spread of it, the most Europe and the highest rate
of reaching Maccabi's first team. Its top decile still reaches 81.

**One finding stated rather than tuned away:** bold play trails on Legend Score and structurally
must, because the Legend Score is deliberately Maccabi-weighted and bold careers go to Europe. Its
upside is real; it is measured in football rather than in Maccabi service. Making bold play win on
a Maccabi-centric score would mean making the score less Maccabi-centric, which is a different
decision from a balance fix.

---

## 13. Decision Reveal architecture

The feature is not showing percentages — it is guaranteeing that the numbers shown are the numbers
used. A game that displays 18% and resolves on something else is worse than one that displays
nothing, because it teaches the player that the numbers are decoration.

### How the invariant is guaranteed

```
calculateOutcomeDistribution(career, event, choice, slot)
            |                              |
      UI preview                   resolveEventChoice
```

One function produces a `DecisionDistribution`, and **both** the preview and the resolver consume
it. `resolveEventChoice` no longer draws from `calculateOutcomeWeights` itself — it is handed the
preview's own distribution and picks from that object's weights. React computes no probabilities.

Two things had to change for that to actually hold rather than merely look like it does:

1. **`choice.effects` used to be applied *before* the weights were computed.** A choice that cost
   coach trust silently moved the very odds it was shown alongside, and no preview could ever have
   matched. The distribution is now taken from the untouched career — the odds you saw are the odds
   you got.
2. **`conditionContext` moved** from `eventEngine` to `conditions.ts`, where it belongs, to break
   the import cycle that created. Re-exported for existing callers.

The tests check the property from the outside, so a future refactor that reintroduces a second
formula fails: preview probabilities are compared against `calculateOutcomeWeights` to 12 decimal
places across the pool, resolution is asserted to only ever return a previewed outcome, and
observed frequency over 12,000 draws lands within 2 points of every displayed probability.

### Percentages

Integer percentages summing to exactly 100, by largest-remainder, computed **once in the engine**.
If the UI rounded independently it could print 33/33/33 while the engine used something else.
`wholePercentages([1,1,1])` returns `[34,33,33]`.

### Valence and risk labels

`OutcomeValence` (`majorPositive` … `majorNegative`) is derived from the author's `tone` plus how
much the outcome actually moves the career, so the engine owns the semantics and the UI only
renders them. A colour never decides whether something counts as a disaster.

`RiskLevel` is derived from the distribution — chance *and* severity of the downside, so "unlikely
but catastrophic" and "likely but mild" do not collapse into the same label. The percentages remain
the source of truth.

### One design bug caught by a test

Unlabelled outcomes fell back to the first clause of their narrative text, so the preview printed
things like *"שיחקת 90 דקות והיית מהטובים במגרש"* **before** the player chose — giving away the
result it was supposed to be the odds of. Labels are now a small authored vocabulary plus a generic
valence fallback. The story is the reward for committing.

---

## 14. Reveal animation

When the player commits, the engine resolves the outcome from the seeded stream **first**. The
animation then cycles the labels that were possible and settles on the already-decided result.

It cannot affect RNG, because it runs after resolution and draws nothing. Reduced-motion users skip
it entirely with no change to the career. ~1.2s, keyed per resolved event so it plays once rather
than replaying on re-render, and a save made mid-reveal resumes on the outcome card.

The odds are recorded on the event result, so the reveal cycles through exactly what was possible —
and so a bug report can show what the player was looking at.

---

## 15. Debug QA system

Every coherence bug in this project arrived as a sentence and then took a diagnostic script to
locate. The state needed to reproduce one was always in the `Career` and simply unreachable from
the game.

A debug-only button copies a structured snapshot: seed and **rngState** (so the next draw is
reproducible, not just the career so far), DOB, natural and current stage, team unit and display
string, club, parent club, league, expected vs actual role, ability, potential, coach trust,
Maccabi relationship and standing, Maccabi's own league and last season, active arcs, recent
memories, flags — and the event, choice, resolved outcome and the odds shown.

Built in `src/game/bugReport.ts` rather than in the component, so it can be called from a test or a
script and stays right when the model changes.

---

## 16. Simulations

**60,000 careers** — 10,000 each across six decision policies, plus a 3,000-seed matched-seed
comparison. 926s, 65 careers/sec. Full output in `V041_SIM.txt`.

### 16.1 Foundation (must hold)

```
INVALID natural-stage repeats                0
registered behind own cohort                 0
legal "cohort caught up"                   948
full early promotions                     1509
avg age leaving the academy               18.0
avg seasons in the academy                 9.0
normal promotion                         96.5%
early promotion (skipped a level)         1.9%
same age group again (legal)              1.6%
same seed reproduces career               PASS
different seeds diverge                   PASS
```

Both invariants that must be zero are zero. Academy exit holds at 18.0, and — new this version —
**identity coherence holds at every step of every simulated career**, asserted by
`tests/identity.test.ts` over two policies rather than sampled here.

### 16.2 Career length

```
senior careers measured                  10,000
mean retirement age                        34.9
median retirement age                      35.0
ended at 38 or later                       8.3%

outfield    n=8,333   mean 34.4   median 35.0
  29-31  2.2%   32-33 27.6%   34-35 50.6%   36-37 18.4%   38-39 1.1%   40+ 0.0%

goalkeeper  n=1,667   mean 37.2   median 37.0
  34-35  3.9%   36-37 51.8%   38-39 39.8%   40+ 4.5%
```

This is the brief's specification almost exactly: most outfield careers end 33–35, exceptional
ones reach 36–38, very rare ones go beyond; many goalkeepers stay effective to 36–38 and a few go
further without all of them reaching 40. Compare v0.4, where **every position** was 36/37/38.

### 16.3 By position

| position | peak | legend | Maccabi srs | Europe | major success | retirement age |
|---|---|---|---|---|---|---|
| שוער GK | 81.0 | 44.0 | 66.6% | 36.4% | 19.3% | **37.2** |
| בלם CB | 80.6 | 41.9 | 59.7% | 36.0% | 17.2% | 34.4 |
| מגן FB | 80.3 | 41.0 | 60.4% | 34.3% | 15.2% | 34.4 |
| קשר CM | 82.0 | 43.8 | 67.6% | 38.6% | 17.1% | 34.5 |
| כנף WG | 81.5 | 44.9 | 66.9% | 42.6% | 18.8% | 34.4 |
| חלוץ ST | 81.7 | 44.5 | 67.9% | 42.7% | 18.3% | 34.4 |

Goalkeepers are no longer the outlier on anything except career length, which is the point. The
Legend Score band is **41.0–44.9** across all six (was 39.0–45.0 with GK bottom), and GK now sits
third of six rather than last.

**The remaining outliers, stated rather than smoothed:** full backs are lowest on Legend Score
(41.0) and major success (15.2%), and centre backs are close behind. Both are defenders in a
scoring-weighted legacy metric, which is a plausible reason rather than a bug — but it is a real
2–4 point gap and it has not been chased.

### 16.4 The football world

Balanced policy:

| | |
|---|---|
| saw a club-season event | 74.9% |
| won promotion | 51.0% |
| suffered relegation | 47.5% |
| won a title away from Maccabi | 12.9% |
| carried a small club | 2.4% |
| played abroad | 38.4% |
| …came back to Israel | 14.8% |
| …and it did not work out | 4.0% |
| had a loan spell | 30.8% |
| moved up a level | 66.7% |
| moved down a level | 37.7% |
| rebuilt after dropping down | 14.3% |
| senior clubs per career | 3.04 |
| seasons below the top flight | 2.43 |

Promotion and relegation are both far higher than v0.4's 27.1% / 14.8%, and that needs stating
plainly rather than presented as an improvement: **v0.4's numbers came from a distribution that
could not produce a tail at all**, so they were not measuring what they appeared to. The current
figures come from a real normal with variance tuned down to 1.15 specifically to stop the tails
overwhelming the middle (the sweep is in §10). Whether ~48% of careers experiencing a relegation
is right is a football judgement rather than something the model can settle; it is defensible for
a career that averages 2.4 seasons below the top flight, and it is the first number I would look
at if this still feels wrong in play.

`moved up a level` at 66.7% is also much higher than v0.4's 44.8%, because §7 changed what counts
as a level: Hadera → Maccabi is now `up` rather than `lateral`.

### 16.5 The Maccabi story

Of the balanced careers that left Maccabi, **45.0%** met them again in an event afterwards.

| standing at the end | share |
|---|---|
| stranger | 31.7% |
| known | 18.8% |
| son_of_the_club | 17.1% |
| respected | 14.3% |
| beloved | 10.7% |
| traitor | 6.8% |
| icon | 0.6% |

Homecoming archetypes, of the 21.9% who came home — all seven fire, and the two best stories
together account for **43%**:

```
rejected_child_star   24.9%      successful_return   13.5%
veteran_farewell      24.1%      european_returnee    8.8%
redemption            18.6%      prime_hero           5.7%
                                 returning_leader     4.4%
```

Ambient Maccabi events (measured separately over 1,200 careers per policy): 39.9% of balanced
careers and 47.8% of ambitious ones see at least one — title-without-you 27.3%,
they-need-your-position 12.7%, club-in-crisis 4.4%, they-went-down 0.3%.

### 16.6 Repetition

```
avg events per career                     41.1
avg repeated events                       6.56
avg longest same-category run             2.03
worst same-category run                      5
identical event sequences                 0.0%
distinct events used                       125
```

**125 of 128 events** used in a 10,000-career batch. Average repeats fell from 7.77 to **6.56**
while the pool grew from 124 to 128, and events per career fell from 43.9 to 41.1 — so a career
sees slightly fewer, more varied events. No two careers in 10,000 produce the same sequence.

The worst same-category run rose from 4 to 5. Minor, but it is the wrong direction and worth
watching.

### 16.7 Risk and agency — matched seeds

3,000 seeds, every policy playing the same seeds:

| strategy | mean | median | sd | peak | seniors | beats base | vs base |
|---|---|---|---|---|---|---|---|
| loyalist (safe) | 45.5 | 28.0 | 32.9 | 80.3 | 51.3% | 73.0% | +16.3 |
| balanced | 42.7 | 35.0 | 26.0 | 81.0 | 64.2% | 72.2% | +13.5 |
| **bold** | 34.5 | 29.0 | 20.8 | **82.4** | **67.7%** | 60.2% | +5.3 |
| ambitious | 29.4 | 24.0 | 18.6 | 81.9 | 65.7% | 54.2% | +0.2 |
| riskTaker (reckless) | 19.0 | 16.0 | 14.0 | 81.3 | 62.0% | 27.9% | −10.2 |
| random | 29.2 | 21.5 | 23.1 | 81.1 | 55.6% | 0.0% | 0.0 |

```
seed-driven spread (sd, one strategy)   23.10
decision-driven spread (same seed)      47.14
```

**Decisions outweigh luck by better than 2:1**, which is what the balance work exists for. Bold
beats the random baseline on 60.2% of matched seeds and leads on peak ability and Maccabi
progression; reckless loses on 72% of them, which is what a stress-test baseline is for.

Over the full 10,000-career batches the same shape holds, with Europe rates that make the trade
explicit: bold reaches Europe in **73.9%** of careers against balanced's 38.4% and loyalist's 0%.

### 16.8 Decision system validation

Statistical validation lives in `tests/decision.test.ts` rather than in the harness, because it
needs the distribution objects rather than career aggregates:

- Preview probabilities match `calculateOutcomeWeights` to **12 decimal places** across the pool.
- Displayed integers sum to exactly **100** for every choice in every event.
- Resolution only ever returns an outcome the preview listed.
- Over **12,000 draws** on each of six real choices, observed frequency lands within **2
  percentage points** of every displayed probability.
- Same seed and choice always give the same outcome; different seeds diverge.

---

## 17. Known issues

Stated explicitly, as the brief asks.

- **Phase 2's coherence audit is rule-based, not exhaustive.** `eventValidation.ts` catches every
  class of bug found so far, but it cannot catch a *new* class. Text-level coherence (an event
  whose prose contradicts the player's situation without naming a club or position) is still only
  covered where a rule exists.
- **Phase 17's event migration is opt-in by design and therefore uneven.** Every event works with
  the decision system — a deterministic choice simply shows no odds — but only choices that
  already had multiple weighted outcomes display probabilities. Single-outcome choices in older
  content look plainer than the newer ones.
- **Phase 22 did not restructure the decision screen beyond the odds panel.** The outcome preview
  is collapsed by default because four choices × four outcomes is an unreadable wall on a 360px
  phone. That is a reasonable default, not a designed information hierarchy.
- **Centre backs remain the lowest Legend Score** (41.7 against 44.6 for a goalkeeper). Within the
  2.9-point band, but consistently bottom.
- **Bold play cannot win on Legend Score**, for the structural reason in §12. Worth a product
  decision in a later version, not a balance tweak.
- **Maccabi being relegated is 0.01% per season**, so `amb_they_went_down` fires in ~0.3% of
  careers. Correct as football; effectively unreachable content for most players.
- **The `finishedEarly` retirement guard is nearly dead in practice.** Measurement shows keepers do
  not collapse before 34, so it fires almost never. Kept and tested as a safety valve.
- **`gaussian` remains hard-bounded** everywhere except club seasons. Season ratings still use it,
  which means a rating outlier is impossible. Not obviously wrong, but it is the same latent
  pattern that made relegation impossible, and worth auditing.
- **Mobile layout is CSS-audited, not browser-verified.** The new odds panel and reveal card have
  not been checked on a real 360px device.

---

## 18. Deliberately deferred

Per the brief's do-not-build list, and untouched: agent system, personal coaches, manager
personality, historical legends database, major visual redesign, leaderboards, backend, Base44,
cloud saves, multiplayer, full squads, full league tables, match-by-match world simulation.

Also deferred by judgement rather than instruction:

- Rewriting older single-outcome choices into probabilistic ones. The system supports it; the
  content work is a version of its own.
- A designed information hierarchy for the decision screen (Phase 22 beyond the odds panel).
- Position-group competition events, so a centre back's rival is a centre back rather than a
  generic "player in your position".

---

## 19. Recommended next release

Not started, as instructed.

1. **Career-length follow-through.** Retirement ages are now believable, but total appearances
   still accumulate more football than a real career contains. The Maccabi relationship weights in
   v0.4 §5.1 were calibrated *against* that inflated distribution and will need revisiting when it
   is fixed.
2. **Content pass on the decision system.** The architecture is in place and proven; the value now
   comes from authoring real four-outcome decisions for the recurring beats, and from
   position-group competition text.
3. **Audit the remaining `gaussian` call sites.** Season ratings cannot produce an outlier. That is
   the same latent shape as the relegation bug.
4. **Legend Score product decision.** Either accept that a Maccabi-centric score means bold careers
   score lower, or introduce a second axis so a European career has somewhere to be measured.
5. **Real-device mobile pass** on the decision and reveal screens.

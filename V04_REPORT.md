# Maccabist v0.4 — Football World

**Scope:** the v0.3.1.1 foundation hotfix, a season-level football world (leagues, club seasons,
promotion and relegation), career mobility and a real transfer market, loans, expected roles, the
Maccabi Relationship system, contextual homecoming, and the events that make all of it visible.

**Result:** build passes, **276 tests** pass (from 225), **50,000 careers** simulated. Schema
stays at 4 and v0.3.1 saves are migrated on load rather than dropped — see §10.6, which is a bug
this version shipped to `main` and then fixed. Every v0.3 and v0.3.1 system is preserved: cohort
ladder, memory, arcs, traits, recovery, senior phases, origin/trials, Legend Score.

---

## 1. What v0.4 was for

Before this version a Maccabist career happened in a vacuum. The player had a club, but the club
had no season: it could not win promotion, could not be relegated, could not fall apart around
him. He could move, but only ever upward, and only ever by a coin flip that did not read what he
had actually done. And once he left Maccabi, Maccabi simply stopped existing — which quietly
broke the one product invariant the game has:

> **THE PLAYER MAY LEAVE MACCABI. MACCABI NEVER LEAVES THE PLAYER'S STORY.**

v0.4 is the version where the world around the career starts to exist, and where leaving Maccabi
becomes a thing that happens *in* a story rather than the end of one.

---

## 2. Phase 0 — foundation hotfix

Three real bugs, all of them the kind that make a football game stop reading as football.

### 2.1 Dates of birth were not real dates

Every date of birth was clamped to a 28-day month, so nobody in the game was born on 30 January
and 31 December did not exist. `src/game/calendar.ts` is now the single definition of a real
date, shared by engine and UI: leap years, correct month lengths, and a `resolveDateOfBirth` that
leaves valid dates untouched and moves an invalid one to the last real day of the month it asked
for.

The old test asserted the clamp, so it had to be rewritten rather than fixed — a test that
encodes a bug will defend it.

### 2.2 Children were being offered professional contracts

`seniorPhases` is derived from age and appearances, which means it is *defined* for a nine year
old. Any event that used it as a gate leaked into childhood, and playtesting found first-team
training, senior bench call-ups and professional contracts reaching טרום ב׳.

`src/game/eligibility.ts` is now one reusable predicate instead of scattered age checks, and
`conditions.ts` treats `seniorPhases` as *implying* a professional-football gate:

```ts
const needsProfessionalFootball =
  c.requiresProfessionalFootball === true || c.seniorPhases !== undefined;
```

A נערים א׳ player can still be looked at by the first team — `allowsExceptionalYouth` — but that
requires being clear of his age group on five axes at once, so it is a story rather than a stage
of development. Contracts are never available to him.

### 2.3 The youth exit could strand a player

`evaluateSeniorTransition` could offer "another year in the youth team" to a player whose cohort
had already left it. The gate now reads the cohort, not the player:

```ts
const cohortStillYouth = stageOrder(nextNaturalStage(career)) <= stageOrder('u19');
const mustDecide = !cohortStillYouth || career.age >= YOUTH_TO_SENIOR.decisionAge || career.seasonsAtStage >= 2;
```

15 tests in `tests/eligibility.test.ts` cover all three, including a full-career simulation
proving nobody is left stranded in the academy.

---

## 3. Phase 1 — the football world

`src/data/leagues.ts` defines 11 leagues; `src/game/worldEngine.ts` simulates a club season in a
handful of RNG calls rather than a fixture list. The club's strength relative to *its own
division* sets the centre of a distribution over finishing outcomes, the player's impact nudges
it, and season variance does the rest.

That relative-strength idea is what makes promotion and relegation matter: the same club is a
title contender in the second division and a relegation candidate in the first.

**Two tuning bugs, both caught by measuring rather than assuming:**

- `smallClubPrestige: 42` included ליגת העל itself (prestige 40), so carrying Maccabi to a title
  counted as a small-club breakout and the memory fired in **68%** of careers. Set to 32 → 2.0%.
- `impactScale: 1.2` gave the average player an impact of 0.51 on his club's season, which is not
  what an average player does. Set to 0.62 → 0.268.

---

## 4. Phases 2–3 — the career ladder, and loans that actually happen

`src/game/marketEngine.ts` replaces the old coin flip. Where a player can move next now follows
from what he has visibly done — ability, reputation, the level he plays at, his standing in the
squad, last season's form and minutes — with hidden potential leaking in only while he is young
enough for clubs to be buying a projection rather than a record.

Everything is a weighted draw over clubs near his level. Nothing is a threshold, so a good season
improves the odds without ever guaranteeing a club, and a bad run genuinely opens doors *downward*
— which is what stops a career from silently dying on a bench it cannot leave.

Offers now carry the league, the expected role, the direction of the move and a few qualitative
hints. Never a percentage: joining a bigger club as a backup should be a decision the player
weighs, not one he reads the odds off.

### 4.1 Loans were impossible

Loans measured **0.0%** of careers. The offer builder worked perfectly in isolation, so the fault
was upstream. Instrumenting the real loop showed loans were being *generated* (449 across 400
careers) and *accepted* (189) the whole time — and then silently undone.

`applyAutomaticMoves` runs at the top of the new season, before a ball is kicked, and decremented
the loan counter unconditionally. A one-season loan therefore expired the instant it was signed,
and the player went home having never appeared for the loan club. A loan season now only counts
down once it has actually been played:

```ts
if (parentClubId !== null && next.lastSeasonRecord?.clubId === next.currentClubId) {
```

**Loan spells: 0.0% → 31.6% of careers.**

---

## 5. Phase 5 — the Maccabi Relationship

This is the centrepiece, and it is deliberately **not** Maccabism.

Maccabism is what the player feels about the club, and it is his to spend. Standing is what the
club and the stand remember, and he can only ever earn it. The two come apart constantly, and
that gap is most of the drama: a boy released at fifteen can stay a Maccabist his whole life and
still be a stranger at Sami Ofer, and a captain who walks out for a rival keeps every appearance
he ever made and is booed anyway.

`src/game/maccabiEngine.ts` derives it — nothing is stored — from service (games, seasons,
trophies, the armband, academy years) minus grievance. Grievance is only ever about *how* he
left, never about leaving: the ideal Maccabist career genuinely includes Europe.

Seven bands, from `stranger` to `son_of_the_club`, plus `traitor`, which overrides service
entirely. Joining a domestic rival straight from Maccabi is not something a crowd nets off
against 200 appearances.

### 5.1 Set from the measured distribution, not guessed

Among players who make Maccabi's senior side the median career there is **~217 appearances over 7
seasons**, and the top 1% reach ~760. A first pass at 0.28 per appearance capped at 220 put more
than half of them at a saturated 100 and made `son_of_the_club` a **40%** outcome.

Retuned against that distribution, the bands now track how the career was actually played:

| policy | son_of_the_club |
|---|---|
| one-club man | 30.2% |
| balanced | 19.5% |
| ambitious | 5.9% |

Every band is reachable; there is no dead content.

### 5.2 The event families

Six events for players who are no longer at Maccabi, all gated on the derived relationship or
crowd response — so the same fixture reads completely differently depending on the career. A
defector walks out to whistles, a graduate who left for Portugal walks out to applause, and a
player who spent two anonymous seasons there walks out to nothing at all, which is its own kind
of answer.

One structural finding worth recording: the **warm** homecoming needed roughly double the weight
of the hostile one to come out even, because a beloved ex-player tends to leave for Europe where
he cannot meet them, while a defector stays in the league and faces them twice a season.

---

## 6. Phase 6 — contextual homecoming

Homecoming was one event with four skins. It is now **seven archetypes** chosen from what
actually happened, including `rejected_child_star` — the boy they released coming back a genuine
star, which is the best story this game can tell, so it is checked first.

The relationship system finally makes the real question answerable: **a player who left Maccabi
for a domestic rival does not get the call, however good he is.** That is not a balance decision,
it is the same rule the crowd applies. Measured over 1,200 careers per policy: **zero** homecoming
offers to a traitor.

### 6.1 The memories a career leaves

Seven v0.4 career-direction memories were declared in the types and written by *nothing*, which
is why `european_returnee` fired 0% — it reads a memory that never existed. They are now recorded
in `moveToClub`, the one place every move goes through, so no route into a club can skip them.

---

## 7. Phase 7 — the club's own season, in events

Five events that make the table matter. They key off club strength relative to the division
rather than the finishing position, because the table is only resolved at season end and an
in-season event cannot honestly know it — but everyone at a club knows in August whether they are
expected to go up, stay up, or fight.

**Two more bugs found by measuring:**

- `planSeason` runs at preseason, when `firstHalfStats` is null. So every mid/late event carrying
  a `minLastAppearances` floor was evaluated against **zero** appearances and could never be
  planned at all. That silently disabled a whole class of events, not just the new ones.
- הליגה הלאומית had quality 42 while both its clubs rate 40 and 36, so nobody in the second
  division was ever a promotion contender and the promotion-race events were unreachable. A
  division's quality should be the level its clubs play at, not an aspiration.

Firing rates for the three dead events went **0.7% / 0.0% / 0.0% → 4.5% / 24.2% / 27.7%**.
`tests/world.test.ts` now asserts that every world event's club-strength window matches at least
one real club, because that is exactly how three of them shipped firing zero percent.

---

## 8. Phase 8 — story arcs on the football world

v0.4 gave careers a shape. Phase 8 is the part that refers back to it.

The **fall_and_rise** arc is deliberately built on a bad outcome, because relegation is where a
career forks hardest: stay and rebuild, or get out while someone still wants you. Both are
legitimate football decisions and the game should not imply otherwise. Two callbacks hang off the
new memories — being asked about the year abroad, and having gone down a level and climbed back.

The opening beat needed weight **55** rather than 20. At 20 only one relegated player in five ever
saw it, which left the whole arc effectively unreachable — the same failure mode as the world
events in §7, found the same way. 12.6% of careers now hit at least one of these, with the full
fall-and-rise payoff at 0.6%, about as rare as winning a title away from Maccabi.

The event-integrity test caught the promotion payoff shipping with a single choice. That rule is
correct — a celebration with one button is not a decision — so it now has a real fork: enjoy it,
or use the promotion as a shop window after paying two years of your prime for it.

---

## 9. Phases 9–10 — making it visible

The world had been simulated since Phase 1 and the expected role since Phase 2, and neither was
ever shown. A player could win promotion or be relegated without being told.

- **Season summary** now shows the club's own season — league, finish, promotion or relegation —
  looked up *by season* rather than taking the latest entry, so an academy season shows nothing
  instead of last year's finish.
- **Offer cards** show the expected role, the direction of the move and the qualitative hints.
- **Player card** shows standing with Maccabi once he is somewhere else, deliberately beside
  מכביסטיות: the gap between what he feels and what they remember is the point, and seeing both
  at once is what makes it land.

---

## 10. Simulation

**50,000 careers** — 10,000 each across five decision policies, plus a 3,000-seed matched-seed
comparison. Full output in `V04_SIM.txt`.

### 10.1 Foundation (must hold)

```
INVALID natural-stage repeats                0
registered behind own cohort                 0
legal "cohort caught up"                   895
avg age leaving the academy               18.0
avg seasons in the academy                 8.9
normal promotion                         96.7%
early promotion (skipped a level)         1.8%
same age group again (legal)              1.5%
```

The two invariants that must be zero are zero. Average academy exit is **18.0**, which is the
first time this has landed inside the intended 18–19 window (it was 19.6 at v0.3.1).

### 10.2 The football world

Balanced policy, 10,000 careers:

| | |
|---|---|
| saw a club-season event | 70.6% |
| won promotion | 27.1% |
| suffered relegation | 14.8% |
| won a title away from Maccabi | 1.9% |
| carried a small club | 1.5% |
| played abroad | 36.0% |
| …came back to Israel | 14.9% |
| …and it did not work out | 5.0% |
| had a loan spell | 31.5% |
| moved up a level | 44.8% |
| moved down a level | 39.2% |
| rebuilt after dropping down | 9.0% |
| senior clubs per career | 3.01 |
| seasons below the top flight | 1.26 |

Two things worth reading here. **Careers move in both directions** — 44.8% up and 39.2% down —
which is what stops the ladder being a one-way escalator, and 9.0% climb back after dropping,
which is the shape a real career has. And the world responds to how the career is played:
`riskTaker` averages **4.45 senior clubs** and a 46.9% loan rate against balanced's 3.01 and
31.5%, because a career that keeps gambling keeps needing somewhere new to go.

### 10.3 The Maccabi story

The product invariant, measured. Of the balanced careers that left Maccabi, **45.9%** met them
again in an event afterwards — booed or applauded at Sami Ofer, asked about them in a press
conference, or phoned by an old youth coach.

Standing at the end of the career:

| band | balanced | riskTaker |
|---|---|---|
| stranger | 34.5% | 82.1% |
| son_of_the_club | 17.4% | 0.3% |
| known | 17.3% | 9.6% |
| respected | 12.4% | 3.5% |
| beloved | 9.8% | 1.0% |
| traitor | 7.1% | 3.2% |
| icon | 1.5% | 0.3% |

Every band is reachable, and the distribution moves hard with how the career was played. A player
who gambles his way through football mostly ends up a stranger to the club that raised him, which
is exactly what the system is for.

Homecoming archetypes, of the 22.3% who came home:

```
veteran_farewell      28.4%
rejected_child_star   26.9%
redemption            22.1%
successful_return      9.5%
european_returnee      6.3%
prime_hero             4.1%
returning_leader       2.7%
```

All seven fire, and the two best stories — the boy they released coming back a star, and the
ordinary redemption — together account for **49%** of homecomings.

### 10.4 Repetition

```
avg events per career                     43.9
avg repeated events                       7.77
avg longest same-category run             2.04
worst same-category run                      4
identical event sequences                 0.0%
distinct events used                       122
```

Distinct events used is up from 113 to **122** and average repeats down from ~10 to **7.77**,
purely because v0.4 added content in the thinnest part of the pool (senior football). No two
careers in 10,000 produce the same event sequence.

### 10.6 A bug this version shipped, and then fixed

v0.4 added `Career.world` **without bumping the schema**, on the reasoning that every other
v0.3.1 field is still valid and dropping a career in progress is worse than migrating it. That
reasoning is fine; the execution was not. The version check then *accepts* those saves, and the
first thing the season loop does is read `world.clubLeagues` — so loading a v0.3.1 save threw
immediately.

This is precisely the failure the checkpoint policy exists to prevent (*"old saves crash"*), and
it sat on `main` across four commits before being caught. It was found by deliberately
constructing a v0.3.1-shaped save and playing on it, which is a check that should have run at
Phase 1 rather than at the end.

`hydrateCareer` now fills in anything a save from an earlier build of the same schema version is
missing, and `storage.loadCareer` calls it. One place to add to, and the engine stays free to
assume a well-formed `Career`. Three tests cover it.

### 10.5 One honest asymmetry

`refused to celebrate` reads exactly equal to `scored against them` (10.1% each) because the
balanced policy always takes the safe option at that fork. A human player has both, and the
riskTaker column — 5.0% scoring, 0.0% refusing — shows the other side of it.


---

## 11. What is not in v0.4

Held back deliberately, per the brief's do-not-build list: agent system, personal trainers,
historical legends database, leaderboards, any backend or cloud saves, full transfer-market
simulation, per-match league simulation, full club squads, visual redesign, decision-reveal
roulette.

**Known gaps, honestly stated:**

- **Playtest scenarios A–J were not run by hand.** Their content is covered by automated
  equivalents (the loan round trip, the traitor gate, the professional-football gate, the youth
  exit, save/load), but nobody sat and played ten careers through the UI.
- `wrl_promotion_race` fires in 4.5% of careers. That is reachable rather than generous, and it
  is limited by there being only two clubs in the second division — a data gap, not a logic one.
- The warm return to Sami Ofer (2.8%) is still slightly rarer than the hostile one (3.9%) for the
  structural reason in §5.2. Both are reachable; the asymmetry is real football, not a bug.
- Average Maccabi appearances reach ~760 at the 99th percentile, which is more football than a
  real career contains. Career length was not in v0.4's scope and was left alone, but it is the
  obvious next balance target.

---

## 12. Test and build status

```
npm run build   PASSES
npm test        276 passed  (from 225 at the start of v0.4)
```

New test files this version:

| file | tests | covers |
|---|---|---|
| `tests/eligibility.test.ts` | 15 | professional-football gating, the youth exit |
| `tests/world.test.ts` | 22 | promotion/relegation, loans, expected roles, position need, event reachability, v0.3.1 save migration |
| `tests/maccabi.test.ts` | 29 | service, grievance, the relationship bands, the event family, homecoming |

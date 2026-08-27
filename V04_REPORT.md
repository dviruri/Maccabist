# Maccabist v0.4 — Football World

**Scope:** the v0.3.1.1 foundation hotfix, a season-level football world (leagues, club seasons,
promotion and relegation), career mobility and a real transfer market, loans, expected roles, the
Maccabi Relationship system, contextual homecoming, and the events that make all of it visible.

**Result:** build passes, **273 tests** pass (from 225), **50,000 careers** simulated, schema
still 4 (the one new field is optional, so v0.3.1 saves load unchanged). Every v0.3 and v0.3.1
system is preserved: cohort ladder, memory, arcs, traits, recovery, senior phases, origin/trials,
Legend Score.

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

## 8. Phases 9–10 — making it visible

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

## 9. Simulation

<!--SIM-->

---

## 10. What is not in v0.4

Held back deliberately, per the brief's do-not-build list: agent system, personal trainers,
historical legends database, leaderboards, any backend or cloud saves, full transfer-market
simulation, per-match league simulation, full club squads, visual redesign, decision-reveal
roulette.

**Known gaps, honestly stated:**

- **Phase 8 (story arcs spanning seasons off the new world memories) was not built.** The
  memories it needs now exist and are recorded, so the arcs are unblocked, but no arc content
  keys off them yet.
- `wrl_promotion_race` fires in 4.5% of careers. That is reachable rather than generous, and it
  is limited by there being only two clubs in the second division — a data gap, not a logic one.
- The warm return to Sami Ofer (2.8%) is still slightly rarer than the hostile one (3.9%) for the
  structural reason in §5.2. Both are reachable; the asymmetry is real football, not a bug.
- Average Maccabi appearances reach ~760 at the 99th percentile, which is more football than a
  real career contains. Career length was not in v0.4's scope and was left alone, but it is the
  obvious next balance target.

---

## 11. Test and build status

```
npm run build   PASSES
npm test        273 passed  (from 225 at the start of v0.4)
```

New test files this version:

| file | tests | covers |
|---|---|---|
| `tests/eligibility.test.ts` | 15 | professional-football gating, the youth exit |
| `tests/world.test.ts` | 19 | promotion/relegation, loans, expected roles, position need, event reachability |
| `tests/maccabi.test.ts` | 29 | service, grievance, the relationship bands, the event family, homecoming |

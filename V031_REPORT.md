# Maccabist v0.3.1 — football reality pass

**Scope:** birth-cohort academy logic, fixed world timeline and real date of birth, the
Maccabi origin/trials system, club- and position-context audits, youth season realism, and the
visual pitch position selector.

**Result:** build passes, **207 tests** pass (from 159), **100,000 careers** simulated,
schema bumped to 4. All v0.3 systems (memory, arcs, traits, recovery, senior phases, Legend
Score) preserved.

---

## 1. Baseline

Recorded before touching anything, as instructed:

```
npm run build   PASSES
npm test        159 passed
```

---

## 2. The world timeline and date of birth

Every career now starts in season **2030/31** with the **2021 birth cohort**. The start season
is no longer randomised.

The player chooses a **day and month**; the year is locked to the cohort and shown as locked in
the UI. Stored as plain numbers:

```ts
dateOfBirth: { day: 17, month: 12, year: 2021 }
```

Deliberately **not** a `Date` or timestamp: football-age maths must be exact and
timezone-independent, and a UTC timestamp for 17 December can render as the 16th or the 18th
depending on where the browser is.

**Age is derived, never incremented** — from `(dateOfBirth, currentSeason, seasonPoint)` — with
three checkpoints a season (mid-August, mid-January, June). A January-born and a December-born
player in the same cohort therefore show different ages at the same moment while belonging to
exactly the same age group.

One modelling fix during the work: the checkpoints originally landed on the 1st of the month,
so a boy born on 5 January had "not yet had his birthday" in January. They are now mid-month,
which sits sensibly either side of a birthday in the same month.

---

## 3. Academy progression — the core correction

`src/game/cohort.ts` introduces the distinction the version turns on:

```ts
naturalStage(career)   // the age group this player's cohort plays this season
career.academyStage    // the team he is actually registered with
```

`resolveAcademyProgression` now **floors** next season's stage at the cohort's next stage. A
player registered with his own year moves up every season regardless of how it went; the
promotion roll only decides whether he goes up *faster*.

The old `'stay'` progression kind is gone. It is replaced by `'cohort_caught_up'`, which means
the **opposite**: a player pushed up early keeps the same shirt while his own year arrives in
that group. The copy makes that explicit — *«השנתון שלך הגיע ל...»*, never *«נשארת»* — and a test
asserts the wording, because this is precisely the case a player would otherwise misread as
being held back. He also *gains* standing there, going from youngest in the room to one of the
older boys.

### Verified over 20,000 careers, per strategy

| Invariant | balanced | loyalist | ambitious | riskTaker | random |
| --- | --- | --- | --- | --- | --- |
| **Invalid natural-stage repeats** | **0** | **0** | **0** | **0** | **0** |
| **Registered behind own cohort** | **0** | **0** | **0** | **0** | **0** |

Legal cases still reachable (balanced, 20,000 careers): 2,891 `cohort_caught_up` transitions
and 4,233 full early promotions — so the zeroes above are a real constraint, not an artefact of
nothing happening.

| Ladder metric | v0.3 | v0.3.1 |
| --- | --- | --- |
| Normal promotion | 88.5% | 91.1% |
| Early promotion (per transition) | 0.7% | 2.6% |
| Same age group again | 10.7% (invalid repeats) | 6.3% (all legal) |
| Avg age leaving the academy | 18.9 | **18.3** |

---

## 4. Origin and the Maccabi trials

Maccabist always begins with Maccabi, and never guarantees Maccabi.

| Origin | Share |
| --- | --- |
| Scouted straight in | **9.6%** |
| Passed the trials | **68.3%** |
| Rejected at the trials | **22.1%** |

Two new phases (`origin`, `retrial`) render this as the first chapter. No screen ever shows a
number — being scouted says "a scout saw you", not "potential 94" — and a rejection is framed
as a longer road.

### Among the 22.1% rejected at nine

| Outcome | Share |
| --- | --- |
| Later invited back to trials | 31.8% |
| Later joined Maccabi's academy | 25.4% |
| Never joined Maccabi's academy | 74.6% |
| **Still reached senior football** | **98.8%** |
| Eventually played for Maccabi's first team | 48.5% |
| Played abroad | 16.9% |

Being rejected is not a dead end and not a guaranteed comeback. `eligibleForRetrial` judges the
season he actually played rather than one afternoon, and requires him to be clearly better than
his level *and* a regular; the invitation itself is then a roll, and the trial after it is
another.

Rejected players join one of five curated external youth academies
(`src/data/youthClubs.ts`) — a small believable set, not a database.

---

## 5. Three engine bugs found by measuring

None of these were in the brief. All were found by instrumenting rather than assuming, and each
made a system in the brief unreachable.

**1. The club was ignored for academy players.** `levelContext` used only the stage quality, so
נערים ב׳ at a small northern academy was identical in standard to נערים ב׳ at Maccabi. A rejected
boy could therefore never stand out where he landed — which is the entire premise of the road
back. The stage now sets the age group and the club sets the standard.

**2. `roleValue` collapsed to the floor for every academy player.** The −9 "you are the
youngest again" knock-down made sense when promotion was an achievement, but under cohort rules
promotion happens *every season*, so it fired every year and drove every player to the floor
within three seasons. Only an early promotion resets standing now: when a whole cohort moves up
together, nobody becomes the young one.

**3. Performance was measured against a fixed rating pivot of 57.** The season rating is built
from absolute ability, so a good nine year old rates ~37 and read as failing. Pivoting on the
level's expected rating reproduces ~57 at senior level and treats the academy sanely.

A fourth, smaller one: `eligibleForRetrial` ran *after* the ladder had advanced the stage, so it
compared last season's ability against next season's tougher level and no scout ever came back.

Fixing (2) and (3) lifted the promotion-score distribution (median 14 → 29, p95 30 → 67), which
in turn made the early-promotion threshold far too low — 49% of careers were getting a
fast-track. Re-measured and reset near p98 (40 → 78): now **20.5% of careers, 2.6% of
transitions**.

---

## 6. Club context audit

New `conditions.clubScope`: `maccabi` | `currentClub` | `nonMaccabi` | `abroad` |
`formerMaccabi` | `any`, resolved in `conditions.ts`.

Audited all 108 events. **Three** named Maccabi with no Maccabi-aware scope and could fire at
another club: the youth derby, the homesick-abroad event, and the first senior squad call. All
scoped.

Two more hard-coded Maccabi references were in the **UI**, not the events: the season summary
built its subtitle as `"מכבי חיפה — {team}"`, and `headlineSubtitle` returned the literal string.
Both wrong for a player who has been at another academy since he was nine; both now read the
actual club.

Coach trust is now rebuilt on transfer from what new staff can actually see — level fit, market
reputation, homecoming goodwill — with only a trace of the old relationship carried across.
Career memory still remembers a past coach conflict; the new coach does not inherit it.

---

## 7. Position context audit

`spon_striker_injured` said *«החלוץ הפותח נפצע... אתה מתחיל»* — the exact bug reported, a
goalkeeper told the starting striker's injury opens a place for him. Rewritten generically
(*«מי שפותח בעמדה שלך»*), which serves all six roles without six copies of the event.

`tests/eventAudit.test.ts` is the regression guard, and **it took three iterations to get
right**:

- Word-based matching produced only false positives: `קשר` also means "contact" and `מגן` also
  means "shield".
- Naming *another* position is frequently correct — the striker you are marking, the keeper you
  are trying to beat.
- The rule that actually catches the bug is **phrase-based**: `"החלוץ הפותח"` describes the
  player's own slot, so an event using it must be scoped to that position.

It also deliberately does not require an explicit `clubScope` on all 108 events: an event with
no club-specific text reads correctly anywhere, so blanket annotation would be 100+ additions
that cannot catch a bug.

---

## 8. Youth season realism

Season lengths were already believable (16 → 30+ up the ladder) and are unchanged.

The presentation was the problem: `משחקים: 5` reads as though the whole season was five
matches. Appearances now carry a denominator — **`הופעות מתוך 22`** — so five appearances reads
as a squad player's season.

Minimum playing time for young academy players is materially better as a side effect of bug (3)
above: with performance measured against the level, young players are no longer rated as
failing, so their standing and minutes do not decay.

---

## 9. New career creation

```
Name → Date of birth (day/month, year locked) → Position on a pitch → Start
     → Origin reveal (scouted or trials) → Accepted / Rejected → Career begins
```

The position selector is a football pitch with six interactive markers — not eleven, because
the game models six roles and a full XI would imply tactical depth that does not exist.
Percentage positioning keeps it responsive to 360px with no media queries; it is a `radiogroup`
so it works by keyboard; and the pitch is positioned LTR with RTL labels so the formation reads
correctly either way. Selecting a marker scales it, fills it Maccabi green, and shows the
Hebrew name with a one-line role description.

---

## 10. Simulation results

**100,000 careers** (20,000 per strategy × 5) + 15,000 matched-seed careers, 671.5s,
149 careers/sec.

### Balanced (20,000 careers)

| Metric | v0.3 | v0.3.1 |
| --- | --- | --- |
| Reached Maccabi senior team | 51.5% | 66.6% |
| Academy graduate | 45.4% | 72.8% |
| Not kept at end of נוער | 49.0% | 23.3% |
| Early academy promotion | 6.2% | 20.5% |
| Became captain | 12.7% | 18.3% |
| Played abroad | 20.8% | 29.4% |
| Returned to Maccabi | 22.8% | 24.3% |
| Avg peak ability | 79.3 | 81.1 |
| Avg Legend Score | 37.9 | 43.7 |
| Median Legend Score | 25.0 | 36.0 |
| Legend 95+ | 1.2% | 2.0% |
| Avg age leaving academy | 18.9 | 18.3 |
| Recovery rate | 50.4% | 50.5% |

Outcomes are broadly **more generous** than v0.3, and that is a direct consequence of the two
engine fixes: a player whose standing no longer collapses, and who is no longer rated as
failing for being nine, develops better and reaches more. See §12 — this is the main thing I
would want a second look at.

### Matched-seed comparison (3,000 seeds × 5 strategies)

```
strategy        mean  median     sd   peak  seniors  beats base  vs base
balanced        42.8    34.0   26.3   80.9    64.8%       81.8%     19.9
loyalist        46.4    28.0   32.0   80.4    57.1%       83.4%     23.4
ambitious       34.3    26.0   22.3   80.9    64.0%       71.2%     11.4
riskTaker       11.9     7.0   12.7   73.9    28.1%       19.2%    -11.0
random          22.9    16.0   21.1   78.1    36.9%        0.0%      0.0
```

Decision-driven spread **49.29** against seed-driven spread **21.09** — decisions still move
outcomes well over twice as much as luck. The v0.3 strategy tension holds: loyalist scores
highest on a Maccabi-centric Legend Score, ambitious sees the most Europe.

### Luck validation

| Check | Result |
| --- | --- |
| Same seed reproduces the career | **PASS** |
| Distinct Legend Scores / 400 seeds | 92 |
| Legend Score range | 2–98 |
| Distinct archetypes reached | 13 |
| Different seeds diverge | **PASS** |

### Story systems (unchanged, still working)

100.0% of careers carry a memory, 98.6% run a story arc, 10.3 milestones and 1.37 traits
revealed per career.

---

## 11. Tests

**159 → 207, all passing.** Both TypeScript projects typecheck clean.

- `tests/cohort.test.ts` (39 new): fixed start season, locked cohort, day/month with impossible
  dates rejected, football age through the season, January vs December in the same cohort, the
  natural stage map for every season, the **no-repeat invariant** across every ladder stage ×40
  seeds and over 400 fully simulated careers, the cohort-catching-up case *with its wording
  checked*, the cohort-lead cap, relative age being small/fading/never touching potential, all
  three origins, the external-academy landing, and the road back.
- `tests/eventAudit.test.ts` (7 new): club-scope resolution, no Maccabi text without a Maccabi
  scope, no Maccabi-scoped event reachable elsewhere, no event describing the player's own slot
  by an unscoped position, no outfield-signing event reaching a goalkeeper, and goalkeepers
  having their own competition storyline.
- Migrated the v0.3 academy tests: the old "held back" tests encoded a rule that does not exist
  in youth football, and the coach-trust test now measures *early* promotion, since ordinary
  promotion is no longer a roll.

Two of my own assertions were wrong before they were right, and both taught me something:
`cohortLead()` reads the current season, but progression sets the stage while `advanceYear`
moves the season; and several fixtures moved `currentSeason` without moving `academyStage`,
which by definition makes the player playing up or behind and changes what the rule under test
does.

---

## 12. Known limitations

1. **Outcomes are more generous than v0.3 and I did not fully re-balance them.** Reached-seniors
   66.6% (from 51.5%), academy graduate 72.8% (from 45.4%), Legend 95+ 2.0% (from 1.2%). This
   follows directly from the two correct engine fixes in §5 — but "not kept at end of נוער" at
   23.3% means the released-at-18 branch is now much rarer than the 49% it was, which weakens a
   story the last two versions worked to build. **This is the first thing I would revisit.**
2. **Early promotion at 20.5% of careers** is defensible as "uncommon" but is at the top of that
   range; 10–15% would feel more special.
3. **`riskTaker` is still weak and low-variance** (mean 11.9, sd 12.7 vs balanced 26.3) —
   unchanged from v0.3, where three levers were tried and measured. Still a content pass over
   the ~60 risky choices.
4. **Mobile is CSS-audited, not browser-verified.** No browser automation is installed. The
   pitch selector uses `aspect-ratio` and percentage positioning with 56px touch targets, the
   DOB row is flex with `min-width: 0`, and the layout is mobile-first with `overflow-x: hidden`
   — but 360/390/412px has not been checked for real.
5. **`נוער` can still hold a player an extra season**, so a 19 year old there is technically
   "behind" the cohort. This is the club's explicit youth-to-senior decision (bounded by
   `YOUTH_TO_SENIOR.decisionAge`), not an academy repeat, and it is excluded from the invariant
   by design — but it is worth a deliberate decision rather than inheritance.
6. **The relative-age effect is implemented but its gameplay impact is unmeasured.** I verified
   it is small, fades, and never touches potential; I did not measure whether January-born
   players actually end up with measurably different careers.
7. **No promotion/relegation world** — correctly out of scope for this version.

---

## 13. Recommended v0.4

1. **Re-balance the senior/graduation funnel** against the corrected engine (§12.1). The
   released-at-18 branch in particular should be brought back toward v0.3 frequency, since the
   whole "make them regret it" premise leans on it.
2. **Browser-test mobile** at 360/390/412px — the pitch selector and DOB row are the new risk.
3. **Rebalance the risky-choice payloads** (§12.3), still the oldest outstanding item.
4. Then the Football World expansion (league tables, promotion/relegation), which is what this
   version was explicitly clearing the ground for.

Do not start the Football World before 1 — it would build on a funnel that is currently
mis-tuned.

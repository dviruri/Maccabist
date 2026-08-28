# Maccabist v0.4.5.1 — Finish, Polish & Visual Coherence Pass

**Scope:** complete the visual identity, fix the remaining balance and engine edge cases, and make
the whole game feel like one product.

**Result:** build passes, **455 tests** pass (from 442 at the end of v0.4.5), an 84,000-career
simulation run (14,000 × 6 strategies) plus an 18,000-career matched-seed comparison — 102,000
careers in total. No schema change; old saves load unchanged.

This report is written to be useful rather than flattering. Section 9 is the list of things this
version did **not** finish, and §7.2 is a balance defect that v0.4.5.1 discovered, measured, and
deliberately did not patch.

---

## 1. Build and test status

```
npm run build                           PASSES
npx tsc -p tsconfig.test.json --noEmit  PASSES
npm test                                455 passed   (442 at the end of v0.4.5)
```

New test files this version:

| file | tests | what it pins |
|---|---|---|
| `tests/legacy.test.ts` | 14 | legacy is derived from tenure and contains no ability term |
| `tests/rating.test.ts` | 6 | season ratings have real tails, not a bounded sum-of-uniforms |
| `tests/samiOfer.test.ts` | 14 | the rejected child is never framed as a returning hero |
| `tests/timeline.test.ts` | 7 | a milestone is never backdated to today's club |
| `tests/stageLadder.test.ts` | 7 | an early promotion lights two rungs, not one |
| `tests/eventVisuals.test.ts` | 6 | all 128 events resolve to a variant with an icon and label |

---

## 2. Phases 9–12 — engine and balance

Measured before and after, on committed code rather than on a prior report's claims.

| metric | v0.4.5 | v0.4.5.1 |
|---|---|---|
| careers ever reaching `icon` | 91.0% | 33.2% |
| senior seasons played at `icon` | 55.3% | 8.0% |
| `carriedSmallClub` | 0.33% | 1.9% |
| promotion per second-division season | 51.0% | 17.7% |
| rating noise, actual sd | 2.33 (capped ±6.9) | 3.4 (real tails) |

**Legacy is not a squad role (Phase 9).** `icon` used to be the top rung of the squad ladder, so
it was reached by nine careers in ten — a word that describes nine careers in ten describes
nothing. `src/game/legacyEngine.ts` derives legacy from tenure alone: seasons, appearances,
captaincy, trophies. It contains no ability term at all, which is the point. A player can be his
club's best footballer in his first season; he cannot be its symbol in his first season.

**The second division was a division of four rungs (Phase 12).** Promotion looked plausible over a
career lifetime and was catastrophic per season: with a four-rung outcome ladder, promotion was
1-in-4 by construction. Only visible by measuring per season rather than per career. Widened to
six rungs, which brings it to 17.7%.

**Ratings got real tails (Phase 11).** `rng.gaussian` is a sum of three uniforms — bounded, and
about a third of its nominal sd. Season ratings used it, so they could not surprise. Now
`rng.normal`, with `ratingNoise` re-derived against the *old effective* spread rather than the old
nominal one. That distinction matters: the same mistake in v0.4.5 tripled goal variance and
produced 103-goal seasons.

---

## 3. Phases 2–4 — the Maccabi family

Three presentations sharing one visual language, for the three ways Maccabi appears in the life of
a player who is somewhere else: `MaccabiBanner` (מהבית), `SamiOferHeader`, `AmbientNewsHeader`.

The distinction the brief was most explicit about is now enforced in code. A boy Maccabi released
at nine who never wore the shirt is **not** a former hero returning, and the relationship model
cannot tell those two apart — both come out as `stranger`. `samiOferContext` separates them, and
`SAMI_OFER_TITLES` gives every other context "חוזרים לסמי עופר" while giving him "סמי עופר, בצד
השני". He was never here. `tests/samiOfer.test.ts` asserts exactly that.

---

## 4. Phase 5 — the career timeline

Rebuilt as an actual timeline: a spine, a node per moment, lit nodes for major beats.

The substantive fix is historical context. A `Milestone` carries a season but no club and no
stage, so the panel had no way to say where the player was when it happened — and the obvious way
to add it, reading `currentClubId`, would have backdated today onto every moment in the career.
The era is looked up in the season record for that year and rendered through `teamDisplayLine`, so
a 2035 moment reads "מכבי חיפה — ילדים א׳" forever. No schema change; old saves get it for free.

The era prints only when it changed. Repeating one club name down eleven rows is height without
information; showing it at the moves makes the shape of a career visible in the gaps.

---

## 5. Phases 6, 6.1, 7 — the first three screens

**New Career** now reads as character creation rather than a signup form: three numbered steps and
a strip that names the boy just described. It also states the empty-name fallback — `createCareer`
has always quietly turned a blank name into מכביסט, and the screen now says so rather than letting
the player find out on the next screen.

**Pitch selector** went 3/4 → 1/1. At 358px wide the old ratio made the pitch 477px tall and
pushed the primary button off a 390×844 screen by itself, and the markers only ever occupied
7%–84% of the height. Squaring it up exposed a clipped label: a marker hangs ~31px below its
`bottom` anchor, which fitted in the taller pitch and cut שוער off the bottom edge. GK moved
7% → 13%. The turf is now actual turf rather than a dark card with a tint.

**The origin screen had no stylesheet at all.** `OriginReveal` referenced `.origin-card` and
`.origin-icon`, and neither existed in `global.css` — so the very first thing a player saw after
creating a career was a plain card with a floating emoji. It now has three treatments (gold for
scouted, green for accepted, amber for rejected) under a "פרק ראשון" header, because a rejection
is a beginning and not a loss screen. The rejected opening states the question the version is
built around — איך תגרום להם להתחרט? — once.

Two bugs fixed on the way: the club chip printed `getClub().name`, so a boy who passed the trials
was welcomed to "מכבי חיפה - מחלקת ילדים" — the exact failure the identity module exists to
prevent; and the scouted copy existed twice, once in the engine and once inline in the component.

---

## 6. Phase 8 — age-group transitions

Career moments and the youth verdict now draw the academy ladder with the step marked on it. An
early promotion lights two rungs instead of one, which makes a jump legible without reading the
title — that is the whole reason it is drawn rather than described. Reaching בוגרים lights every
rung; another year in נוער shows him still one short. A released player gets no ladder.

The ladder fills in reading order, so in RTL it fills from the right and the arrow points left:
"up" in this game means towards בוגרים, and the direction of travel should match the direction of
reading.

**Bug fixed.** The stylesheet muted `.promotion-card.tone-stay`, but `verdictToProgression`
produces `released`, `cohort_caught_up` or `senior` — there is no `stay`. A player kept in נוער
for another year therefore matched no rule and received the celebratory green treatment meant for
reaching the first team.

Also: "עוד 1 שלבים לבוגרים" is Hebrew only a form would write. One and two now get words.

---

## 7. Phases 13, 19, 23, 28 — measurement

### 7.1 Contrast, measured

`--text-tertiary` was `#6d7f74`, which measures **3.78:1** against `--surface-light` and 4.11:1
against `--surface` — below the 4.5:1 AA floor for normal text. It is the token carrying every
11px label in the game: hub ring captions, timeline seasons, hints, the ladder footnote. Moved to
`#82958a` at 5.07:1 worst case, still a clear step below `--text-secondary` at 7.07:1, so the
hierarchy survives. One token, every faint label in the product.

Every other foreground token passes: `text-secondary` 7.07, `green-primary` 5.04, `green-bright`
8.61, `gold` 10.50, `neutral` 5.11 (worst-case backgrounds).

### 7.2 The mobile audit, and why the first three versions of it lied

Gallery gained a `?probe=1` mode that measures every element against the pinned layout width and
writes the result where a headless `--dump-dom` run can read it, driven by
`scripts/overflowAudit.mjs`. Asking the page beats inferring from a screenshot — that inference is
how v0.4.5 produced a false positive.

It took three passes to make it tell the truth, and each failure is worth recording because each
one *reported a clean sweep*:

1. It measured against `document.documentElement.clientWidth`, which headless Chrome reports as
   504 whatever `--window-size` says. Every layout passed because the wrong number was checked.
2. `getBoundingClientRect` returns unclipped geometry, so `.sami-lights` and `.poster-glow` — both
   deliberately `inset-inline` negative inside `overflow: hidden` parents — registered as bugs.
3. Skipping clipped elements then skipped **everything**, because `.gallery-app` sets
   `overflow-x: hidden` as part of the screenshot harness. The probe reported 25 clean scenes
   while looking at nothing.

The third was caught only by injecting a 600px element into a 320px layout and finding the probe
did not care. That canary stays in the gallery, so the probe can be re-validated rather than
trusted.

**Result, with the probe verified working: 25 scenes × 6 widths (320/360/375/390/412/430), zero
overflow.**

### 7.3 Legacy metrics — and a defect this version did not fix

`scripts/legacyMetrics.ts`, 6,000 careers, 103,549 senior seasons, 18,585 club tenures:

```
LEGACY (per club tenure)      none 55.5%   fan_favourite 33.6%   icon 8.7%   legend 2.2%
careers reaching icon/legend anywhere                      33.7%    (was 91%)
squad role `icon` per senior season                         0.0%    (rung removed)
```

The legacy split holds. But the same run surfaced something the split did **not** fix:

```
SQUAD ROLE per senior season   squad 6.3%  rotation 8.5%  starter 10.1%  key 11.1%  star 64.1%
careers that ever reached `star`                            95.4%
```

`star` is now what `icon` was. Removing the top rung moved the inflation into the rung below it
rather than ending it. The cause is not the tier thresholds — it is that **`roleValue` saturates**:

```
roleValue across senior seasons   p5 29.6   p15 50.5   p25 64.3   p40 82.6   p55 97.9   p70+ 100
```

Over 40% of senior seasons sit at the hard ceiling of 100, so no threshold placement can make the
ladder discriminate. This is a genuine balance defect and it is the top item for the next version.
It is **not** patched here: `roleValue` feeds event gating, academy promotion, retrial eligibility
and offer generation, so re-tuning its growth needs its own measure-tune-validate cycle rather
than a threshold nudge late in a polish pass. Nudging `ROLE_TIERS` would have moved the reported
percentages without changing the game, which is worse than leaving it visible.

### 7.4 Event visual coverage (Phase 14)

`tests/eventVisuals.test.ts` walks the real catalogue rather than a sample. Every one of the 128
events resolves to a known variant with a non-empty icon, label and importance; the result is
stable for a given event; and no single variant holds more than half the catalogue — a variant
system where 80% of events are `career` is a variant system in name only.

For a Maccabi senior career:

```
match 21.9%   development 18.0%   career 12.5%   transfer 12.5%   maccabi 10.9%
coach  9.4%   media        6.3%   club     5.5%   crisis    3.1%
```

`europe` shows as unused in that table because `eventVisual` reads the career, and this one is at
home rather than abroad. `VARIANTS` is exported so the audit checks the real list rather than a
copy that would drift out of step with it.

---

## 8. Phase 27 — simulation

84,000 careers (14,000 × 6 strategies), plus an 18,000-career matched-seed comparison
(3,000 seeds × 6). Balanced-policy figures:

```
INVALID natural-stage repeats                 0        <- the version's acceptance criterion
reached Maccabi senior team               67.0%
academy graduate (נוער → בוגרים)          64.6%
early academy promotion                   16.9%
played/trained with older group           24.1%
became captain                            15.0%
played abroad                             38.5%
returned to Maccabi                       20.8%
avg peak ability                           81.3
avg / median Legend Score              43.6 / 38.0
distinct events used                        126
identical event sequences                  0.0%

Origin      scouted 9.7%   passed trials 68.3%   rejected 22.0%
  of those rejected at nine: later joined Maccabi 32.5%, reached senior football 100%,
  played for Maccabi seniors 50.4%

Career length   outfield  n=11,666  median 35   (29-31 2.0%, 32-33 27.3%, 34-35 50.9%,
                                                 36-37 18.7%, 38-39 1.1%)
                goalkeeper n=2,334  median 37   (34-35 4.7%, 36-37 53.0%, 38-39 38.6%, 40+ 3.6%)
```

**Acceptance criterion, all six strategies:**

```
balanced 0    loyalist 0    ambitious 0    bold 0    riskTaker 0    random 0
```

Zero invalid natural-stage repeats across all 84,000 careers.

**Strategy separation.** Average Legend Score by policy:

```
loyalist    46.7      playing for the badge is the best strategy in the game
balanced    43.6
bold        34.0
ambitious   28.9      chasing every move is not free
random      28.2
riskTaker   18.7      the deliberate worst case: preferring `risky` over `opportunity`
```

The ordering is the one the design intends. `riskTaker` sitting well below `random` is the
important one — it confirms that risky choices are a genuine trap rather than a bonus, since
`riskTaker` differs from `random` only by *preferring* them.

## 9. What this version did not finish

The brief listed 30 phases. These were not reached, and are listed plainly rather than folded into
the sections above:

| phase | status |
|---|---|
| 8.1 playing up, 8.2 direct senior promotion | engine and copy already existed (`olderGroupLine`, the youth verdict); no dedicated presentation added beyond the ladder |
| ~~14 event visual consistency audit~~ | **done** — see §7.4 |
| 15 career moment coverage audit | not done |
| 17 transfer/loan consistency pass | not done |
| 18 retirement screen polish | partial — fixed a duplicated heading; not redesigned |
| 20 RTL / mixed-language audit | partial — every `seasonLabel`/`careerYears` call site verified inside an `<Ltr>` isolate; no sweep of event copy |
| 21 decision UI final polish | not done |
| 22 reveal animation polish | not done |
| 24 performance | not done |
| 25 debug reporting preservation | not done (existing `bugReport.ts` untouched and still works) |
| 26 controlled visual scenarios A–S | partial — 27 gallery scenes exist and were swept, not the full A–S list |
| 30 event visual architecture for future speakers | not done |

Section 7.3 (`roleValue` saturation) is the single most valuable thing to pick up next; it is a
gameplay defect rather than a polish item.

---

## 10. Invariants re-verified

- Opening season 2030/31; birth cohort 2021, year locked, player picks day and month.
- Academy stage derived from cohort + season, never from numeric age.
- Ladder טרום ב׳ → … → נוער → בוגרים; senior is a transition with a decision attached, never a rung.
- No natural-stage repeat: **0** across all 84,000 careers, in all six strategies.
- Potential stays hidden. Nothing added this version reveals a hidden number.
- Seeded determinism; no `Math.random()` in core game logic.
- **The player may leave Maccabi. Maccabi never leaves the player's story.** Phases 2–4 are this
  invariant made visible, and §3 is the case where it would have been easiest to get wrong.

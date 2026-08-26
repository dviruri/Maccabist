# Maccabist — overnight sprint report

**Date:** 2026-08-25 → 2026-08-26
**Branch:** `main` · 10 commits · pushed · working tree clean
**Status:** build passes, 104/104 tests pass, 100,000 careers simulated, **Pages deployment
verified live**

---

## 0. A conflict you need to know about first

A **second Claude session (`maccabist-70`) was working in `C:\work\Maccabist` at the same time
as this one**, on what looked like the same brief. Files changed underneath me mid-audit
(`App.tsx`, `WelcomePage.tsx`, `global.css`, `site.webmanifest`) and **both test files were
deleted from the working tree**.

I stopped, asked, and you chose "I take over, stop the other". I messaged that session to stand
down. I could not verify that it actually stopped — **if it is still open, close it before
touching this repo**, or you may get a third divergent state.

Nothing was lost. I restored `tests/engine.test.ts` and `tests/simulation.test.ts` from `HEAD`
and migrated them properly, since the brief says to migrate the v0.1 tests rather than delete
them. I kept that session's in-flight work where it was correct and coherent: the
incompatible-save notice (`App.tsx` / `WelcomePage.tsx` / `global.css`) and the relative
`site.webmanifest` paths, both of which typecheck and build. Its two new test files
(`academy.test.ts`, `outcomes.test.ts`) were good, and I kept and extended them.

---

## 1. What existed when work started

Much more than the README implied, and in good shape. The v0.2 refactor was **already
substantially done** — roughly 11,400 lines of a clean, well-separated engine.

Already present and genuinely integrated, not just typed: seeded RNG, weighted probabilistic
outcomes with data-driven modifiers, hidden potential, coach trust, form, confidence, the full
ten-stage academy ladder as first-class data, team roles, playing/training with the older age
group, multi-phase seasons with mid-season and season-end summaries, academy promotion, the
youth-to-senior verdict with four paths, event history, cooldowns, `oncePerCareer`/`oncePerStage`,
spontaneous events, rare events, the Legend Score, the meta/replay layer, and a headless
simulator with three decision policies.

**The blockers described in the brief were not current.** `npm run build` already passed, and so
did `tsc --noEmit` — `tsconfig.json` only included `src`, so the old tests were not being
type-checked as part of the production build. The real problems were elsewhere:

| Found | Severity |
| --- | --- |
| Logo/mark would 404 on GitHub Pages (runtime `"/mark.png"`, which Vite does not rewrite) | **Real deployment bug** |
| Tests were not type-checked *at all* by any script | Real gap |
| `tests/engine.test.ts` was v0.1 and did not compile — 12 failures, 14 type errors | Known |
| Academy ladder badly stalled — see §6 | **Major balance bug** |
| Homecoming compounding to near-certainty | **Major balance bug** |
| Released academy players sent to clubs where they could never play | **Real gameplay bug** |
| Homecoming never recorded for academy-released players | Real bookkeeping bug |
| Risky choices were negative expected value | **Major balance bug** |

---

## 2. What was implemented

### P0 — build and deployment
- **Fixed a genuine Pages bug.** `Logo` built asset paths from string literals, which Vite does
  not rewrite, so the crest resolved against the domain root and would 404 under `/Maccabist/`.
  Now derives from `import.meta.env.BASE_URL`. Verified in the built bundle
  (`/Maccabist/mark.png`).
- **Base path is configurable, not hard-coded.** Dev serves from `/`, production defaults to
  `/Maccabist/`, `MACCABIST_BASE` overrides. `"/Maccabist/"` now appears in exactly one file.
- **Split the TypeScript projects.** `tsconfig.json` (app, what `build` checks) and
  `tsconfig.test.json` (adds `tests/` and `scripts/`, what `test` checks). Tests are now really
  compiled and validated, and can never block a deploy.
- Confirmed there is no router, so no SPA 404 fallback is needed. The existing Pages workflow was
  already correct (Node 22, `npm ci`, artifact upload, `deploy-pages`, no long simulation).

### P1 — engine and tests
- Migrated `tests/engine.test.ts` to the v0.2 API rather than deleting it, scoped so it does not
  duplicate the other two suites. Added coverage for hidden-attribute effects, `olderGroup` vs
  `academyStage` independence, coach trust driving minutes, potential as a soft ceiling *and* its
  `+8` limit, playing up accelerating development, all four youth-to-senior paths, the
  released-player route end to end, and RNG-state reproducibility.
- Fixed two incoherent fixtures in the inherited suites: one gave a nine-year-old's ability to a
  נערים ג׳ player so the promotion roll never fired, and the cooldown test asserted
  `x !== (y && false)`, which can never pass.

### P2 — repetition and content
- Repetition fixed **structurally first**: the repeat penalty was flat regardless of recency and
  now decays over a 16-season window; added a milder cross-season category penalty (previously
  only same-season repeats were penalised, so `coach → coach → coach` across seasons was
  possible); `pickEventForSlot` no longer silently drops a slot when everything is penalised to
  zero.
- **51 → 74 events**, inside the 65–85 target: 13 position-specific (all six positions, each with
  an opportunity, a pressure moment and a setback) and 10 senior events, which was the tightest
  pool. Added the `team` and `pressure` categories.

### P3/P5 — progression and season storytelling
Already present and working; verified rather than rebuilt. The academy ladder, three distinct
kinds of advancement, mid-season and season-end summaries, and the youth-to-senior moment were
all in place — what they needed was the balance work in §6, not new systems.

### P4/P6 — simulation
- Added `balanced` and `riskTaker` policies (now five), `npm run simulate` / `simulate:large`,
  and a much richer report: Legend Score distribution, academy-ladder metrics, repetition
  metrics, results by position and by strategy, and luck validation.
- Fixed two misleading metrics: starter/key-player now measure **senior Maccabi seasons** (being
  a starter *somewhere* over 15 seasons happened to 97–100% of careers and meant nothing), and
  "released" is split into "not kept at 18" vs "squeezed out later" — they previously overlapped
  academy graduates and summed past 100%.

### P7 — UX
- Form and confidence now surface as short phrases (`כושר מצוין`, `תקופה קשה`, `ביטחון שבור`)
  rather than being invisible — neither existed before.
- Added a five-step season progress strip (`פתיחת עונה → מחצית ראשונה → מחצית העונה →
  מחצית שנייה → סיום עונה`), which was called for and missing.

### P8/P9
The meta/replay layer was **already fully implemented** (careers played, best Legend Score, best
career, total championships, recent careers, all shown on the welcome screen). The share card
(P9) was **not** attempted — it is explicitly a stretch goal and the balance findings in §6 were
worth the time instead.

---

## 3. Build and deployment

```
npm run build     PASSES   dist/ 1.59 kB html, 19.47 kB css, 343.27 kB js (99.39 kB gzip)
npm run typecheck PASSES   both projects
```

`dist/` is valid and asset paths correctly resolve under `/Maccabist/`.

**Deployment verified live.** Pushed to `main` (fast-forward, no history rewritten), the Pages
workflow ran, and the deployed `index.html` references the exact asset hashes produced by this
build (`index-1eWByzs9.js`, `index-B2dYp3hN.css`) — so the new commit is what is serving.

Checked on the live site:

| URL | Result |
| --- | --- |
| `/Maccabist/` | 200 |
| `/Maccabist/mark.png`, `/Maccabist/logo.png` | **200 — the crest bug is fixed** |
| `/Maccabist/site.webmanifest` (relative icon paths) | 200 |
| `/Maccabist/icon-192.png` | 200 |
| `/mark.png`, `/logo.png` (the old paths) | **404 — confirming the bug was real** |

---

## 4. Tests

```
104 passed / 104 total, 4 files
```

| File | Tests |
| --- | --- |
| `engine.test.ts` | 62 |
| `outcomes.test.ts` | 24 |
| `academy.test.ts` | 13 |
| `simulation.test.ts` | 5 |

Both projects type-check cleanly under strict TypeScript with no new `any`.

---

## 5. Simulation results

**100,000 careers actually run** (20,000 per strategy × 5), 228.2s, 438 careers/sec.

### Balanced strategy (20,000 careers)

| Metric | Value |
| --- | --- |
| Reached Maccabi senior team | 64.1% |
| Failed to reach senior team | 35.9% |
| Academy graduate (נוער → בוגרים) | 63.6% |
| Not kept at end of נוער | 33.0% |
| Squeezed out of the first team later | 39.5% |
| Early academy promotion | 6.0% |
| Played/trained with older age group | 17.7% |
| Became regular starter (at Maccabi) | 52.0% |
| Became key player (at Maccabi) | 38.7% |
| Became captain | 20.2% |
| Played abroad | 8.3% |
| Returned to Maccabi | 38.6% |
| Saw a rare event | 11.6% |
| Avg peak ability | 78.4 |
| Avg Legend Score | 44.2 |
| Avg Maccabi appearances | 150.3 |
| Avg career length | 27.7 seasons |
| Avg retirement age | 36.7 |

### Legend Score distribution

| Bucket | Share |
| --- | --- |
| 0–39 | 56.2% |
| 40–59 | 14.2% |
| 60–74 | 9.3% |
| 75–84 | 9.4% |
| 85–89 | 5.7% |
| 90–94 | 3.8% |
| 95+ | **1.5%** |

### By strategy

| Strategy | Seniors | Key player | Captain | Abroad | Returned | Peak | Legend |
| --- | --- | --- | --- | --- | --- | --- | --- |
| balanced | 64.1% | 38.7% | 20.2% | 8.3% | 38.6% | 78.4 | 44.2 |
| loyalist | 54.7% | 32.4% | 15.4% | **0.0%** | 45.6% | 78.3 | 39.8 |
| ambitious | 61.2% | 37.3% | 17.2% | **18.2%** | 36.4% | 77.0 | 38.0 |
| riskTaker | 6.6% | 2.9% | 1.1% | 3.0% | 6.4% | 57.0 | 4.4 |
| random | 19.1% | 9.2% | 4.2% | 5.0% | 12.4% | 67.2 | 14.6 |

The loyalist never leaves; the ambitious player sees Europe most but scores slightly lower on a
Legend Score that deliberately measures *Maccabi* legend status. That is the intended shape.

### By position (balanced)

| Position | Peak | Legend | Reached seniors |
| --- | --- | --- | --- |
| שוער | 78.0 | 40.8 | 63.3% |
| בלם | 77.8 | 43.4 | 62.1% |
| מגן | 77.6 | 44.7 | 62.8% |
| קשר | 79.8 | 47.4 | 69.1% |
| כנף | 78.8 | 44.5 | 64.7% |
| חלוץ | 78.5 | 44.3 | 62.5% |

Midfielders are mildly favoured (+6.6 Legend over keepers); not enough to act on tonight.

### Luck validation — both PASS

- Same seed + same decisions → **identical career** (score, appearances, peak, event count).
- Same decisions, 400 different seeds → 82 distinct Legend Scores, range **14–97**, std dev
  **26.48**, peak ability 63.0–100.0, 8 distinct endings.

### Repetition

44 events per career, 69 of 74 distinct events used per batch, longest same-category run 1.96
average / 4 worst, **0.0% identical event sequences**, ~10.2 repeated events per career.

### Guardrails

| Guardrail | Result |
| --- | --- |
| Avoid 90%+ reaching the senior team | 64.1% ✅ |
| Avoid 50% captain | 20.2% ✅ |
| Avoid 50% early promotion | 6.0% ✅ |
| Avoid every career reaching 85+ ability | avg peak 78.4 ✅ |
| Avoid 20% at Legend 95+ | 1.5% ✅ |
| Avoid most careers failing in childhood | everyone reaches נוער ✅ |
| Avoid almost nobody experiencing Europe | 8.3% balanced / 18.2% ambitious ⚠️ acceptable |

---

## 6. Balance adjustments

Every threshold below was set from a **measured distribution**, not a guess. My first two
attempts at the promotion thresholds were wrong because I estimated instead of measuring; the
third was taken from sampling the real in-play score at the exact decision point.

### The academy ladder was badly stalled — the biggest find

Real end-of-season promotion scores centre on **14** (p95 ≈ 30), but `normalThreshold` was **30**.
So ~45% of season-ends failed the roll, players repeated nearly every age group, and **the
average career did not leave the academy until age 24**. `earlyThreshold` of 92 was unreachable
and early promotion fired in **0.00%** of careers — dead content.

| | Before | After |
| --- | --- | --- |
| `PROMOTION.normalThreshold` | 30 | 1 |
| `PROMOTION.earlyThreshold` | 92 | 40 |
| Age leaving academy | 24.4 | **19.6** |
| Repeated a year | 44.5% | 17.3% |
| Careers with an early promotion | 0.0% | **6.0%** |

### Homecoming was a near-certainty, not a story beat

The return offer is rolled every off-season, so ~0.5/season compounded to ~87% over a senior
career: more than half of all careers ended back at Maccabi and **97% reached the senior team**.
Return chances cut hard (`returnBaseChance` 0.14 → 0.006, maccabism weight 0.0055 → 0.0004), and
Maccabi now only calls for a player good enough to hold a place — measured against its own squad
quality rather than a flat `ability >= 55`.

→ Reached senior team **97% → 64.1%**.

### Bold play was a trap

Scoring every choice in the pool by its weighted outcome effects:

| Risk | Expected value |
| --- | --- |
| opportunity | +8.9 |
| balanced | +3.9 |
| safe | +3.7 |
| **risky** | **−1.4** |

Risky was *strictly dominated* — a trap, not a gamble — and a player who always went for it
finished with peak ability 55 and Legend Score 4 against 78 and 44. Added
`EVENTS.riskyUpsideBoost`, which lifts the good outcomes of a risky choice and leaves the
downside exactly as written. Also rewrote `ambitiousPolicy` to gamble only when form and
confidence can absorb it, since "picks the riskiest option forty times in a row" is a stress
test, not a player — `riskTakerPolicy` is retained for exactly that purpose.

### Youth-to-senior gate was too harsh

86% released / 13% signed is closer to a real academy's attrition than to a game worth replaying.
Thresholds 62/50/41 → 50/40/33.

### Two real bugs fixed

- **Released players were unplayable.** The destination draw could send a released 18-year-old to
  a top-tier club (quality 66–75) where a 45-ability player gets essentially no minutes, so the
  career flatlined. Two causes: `israeli_top` was in the pool, and a flat `+0.2/+0.35` additive
  floor swamped the real fit weights (all near zero for a low-value player), making every club an
  equal coin flip. Now `israeli_mid`/`israeli_low` with a single small floor.
- **Homecomings went unrecorded.** `returned` required `everLeft`, which is only set on a *senior*
  departure — so "released at 18, developed elsewhere, bought back years later" scored as if the
  player had never left, and the Legend Score's homecoming component missed it entirely.

### Repetition

`repeatPenalty` 0.35 → 0.12 with a 16-season recovery curve; added `recentCategoryPenalty` 0.55
over a 2-season window.

---

## 7. Gameplay and content changes

- **+23 events (51 → 74).** 13 position-specific: keeper (penalty save, distribution, the No.1
  shirt), centre back (marking job, organising a collapsing defence), full back (overlap duty),
  midfielder (tempo, a move to a deeper role), winger (one-on-one, the missing final ball),
  striker (drought, hot streak, losing the shirt). 10 senior: title run-in, national call-up, a
  new signing in your position, mentoring a youngster, contract renewal, media storm, injury
  comeback, cup final, agent pressure, losing the armband.
- All content is pure data — `conditions.positions` does the gating and the engine contains no
  per-position branching.
- New `team` and `pressure` categories.
- Form/confidence mood chips and the season progress strip (§2, P7).

### Manual playtest

Four careers played headlessly end to end, same seed for the first three:

| Career | Ending | Legend | Story |
| --- | --- | --- | --- |
| 1 — balanced | הבן האובד | **83** | 353 Maccabi apps, 3 titles, 2 as captain, drifts to Netanya at the end |
| 2 — ambitious | אחד משלנו | **60** | peak 93.3, refused the armband, Graz → Alkmaar → Hapoel TA → Benfica |
| 3 — loyal | הבן האובד | **85** | peak 88, stayed home |
| 4 — balanced, different seed | הדרך האחרת | **30** | never signed, 13 seasons at Hapoel Afula, brief 16-appearance homecoming |

Careers 1 and 4 use identical decision-making and differ by seed alone: **83 vs 30**, graduate vs
released. Career 4 is the released → develops elsewhere → comes home arc running end to end.

---

## 8. GitHub Pages URL

**https://dviruri.github.io/Maccabist/ — live and verified** (see §3 for what was checked).

---

## 9. Known issues

1. **Confirm `maccabist-70` is closed** before working here (§0). It was writing to this tree an
   hour before the push; if it is still open it may produce a third divergent state.
3. **Unmitigated risk-taking is still punished very hard** (riskTaker: Legend 4.4). Coach trust
   feeds minutes → development → trust, so trust damage self-reinforces into a spiral that is
   hard to escape. `riskyUpsideBoost` softened the symptom, not the mechanism.
4. **~10 repeated events per career.** 44 events over ~28 seasons against a 74-event pool.
   Selection tuning is close to exhausted; this needs more senior-phase content.
5. **Careers run long** — 27.7 seasons, leaving the academy at 19.6 vs the intended 18–19.
6. **Mobile is CSS-audited, not browser-verified.** Layout is mobile-first (single column below
   960px), `overflow-x: hidden`, global `border-box`, no fixed widths that can overflow, and the
   new progress strip uses `min-width: 0` with wrapping. But no browser automation is installed,
   so I could not check 360/390/412px for real.
7. **`academy graduate` (63.6%) and `not kept at נוער` (33.0%) do not sum to 100%** — a few
   careers get "another year in נוער" and then a verdict, so they can appear in neither bucket.
8. Midfielders are mildly favoured (Legend 47.4 vs 40.8 for keepers).
9. No share card (P9, explicitly a stretch goal).

---

## 10. Recommended next phase

In priority order:

1. **Browser-test mobile** at 360/390/412px, especially the new season strip and RTL. This is the
   one acceptance criterion I could not check for real (no browser automation installed).
2. **Play a few careers by hand** on the live site. The engine is well covered by 104 tests and
   100k simulated careers, but no human has clicked through the new season strip or mood chips.
3. **Break the coach-trust spiral.** Give a player a way back: a recovery floor, a reset on a new
   coach or a new club, or a diminishing penalty on repeated trust loss. This is the single
   biggest remaining threat to "every career tells a different story", because it currently
   makes one style of play unviable rather than merely riskier.
4. **More senior-phase content** — the tightest pool and the direct fix for issue 4. Aim for
   ~90–100 events total.
5. **Shorten the tail.** Trim the academy by a season and consider raising `RETIREMENT_MIN_AGE`
   behaviour so careers land nearer 22–24 seasons.
6. Then, and only then, the share card (P9).

Do not start a major new system before 3 and 4 — the foundations are good and those two are what
the simulation says are actually limiting the experience.

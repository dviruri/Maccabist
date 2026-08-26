# Maccabist v0.3 — balance report

**Run:** 50,000 careers (10,000 per strategy × 5) + 25,000 matched-seed careers
(5,000 seeds × 5 strategies) = **75,000 careers**, 390.8s, 128 careers/sec.
Positions rotated evenly. Deterministic seeds. `npm run simulate -- --careers=10000 --paired=5000`.

All figures below are measured. Nothing here is estimated.

---

## 1. Do decisions matter, or is it the seed?

This was the central question of v0.3. Every strategy plays the **same seeds**, so any
difference between them is decision quality rather than a kinder random universe.

| Strategy | Mean | Median | SD | Peak ability | Reached seniors | Beats baseline | Δ vs baseline |
| --- | --- | --- | --- | --- | --- | --- | --- |
| balanced | 37.5 | 25.0 | 24.3 | 79.2 | 50.9% | **84.6%** | +19.6 |
| loyalist | 38.9 | 25.0 | 27.7 | 78.9 | 46.9% | **85.5%** | +21.0 |
| ambitious | 30.7 | 23.0 | 20.4 | 78.7 | 48.4% | **76.3%** | +12.7 |
| riskTaker | 8.4 | 6.0 | 10.9 | 67.9 | 15.5% | 17.7% | −9.5 |
| random | 17.9 | 13.0 | 17.3 | 74.2 | 22.2% | — (baseline) | 0.0 |

**Decision-driven spread (same seed, different strategies): 43.15**
**Seed-driven spread (same strategy, different seeds): 17.30**

Decisions move outcomes about **2.5× more than luck does**. "Beats baseline" is measured
seed-by-seed: a strategy that made no difference would sit at 50%, and the three sensible
strategies sit at 76–86%.

Luck still owns the individual moment — the seed-driven SD of 17.3 is large, and the
distribution below is wide — which is the intended split: luck decides what happens to you,
decisions decide what you make of it.

### The strategies are now genuinely different, not just better and worse

- **loyalist** scores highest on a Legend Score that deliberately measures *Maccabi legend
  status* — and plays abroad **0.0%** of the time. It never leaves, by construction.
- **ambitious** plays abroad **28.7%** of the time, reaches a similar peak ability, and scores
  **lower** on Legend. Leaving costs you. That tension is the design working.
- **balanced** sits between them.

---

## 2. Guardrails

| Guardrail from the brief | Result | |
| --- | --- | --- |
| Avoid 90%+ reaching the Maccabi senior team | **51.5%** | ✅ |
| Captaincy achievable but special (was ~20% in v0.2) | **12.7%** | ✅ |
| Avoid 50% early promotion | **6.2%** | ✅ |
| Avoid every career reaching 85+ ability | avg peak **79.3** | ✅ |
| Avoid 20% at Legend 95+ | **1.2%** | ✅ |
| Avoid almost nobody experiencing Europe | **20.8%** (28.7% ambitious) | ✅ |
| Senior football around 18–19, not drifting to 20+ | **18.9** | ✅ |
| Homecoming should not end every European career | **22.8%** | ✅ |
| Recovery neither ~0% nor ~100% | **50.4%** | ✅ |
| Most careers should be ordinary | 65.1% below Legend 40 | ✅ |

---

## 3. Career outcomes (balanced, 10,000 careers)

| Metric | Value |
| --- | --- |
| Reached Maccabi senior team | 51.5% |
| Failed to reach senior team | 48.5% |
| Academy graduate (נוער → בוגרים) | 45.4% |
| Not kept at the end of נוער | 49.0% |
| Squeezed out of the first team later | 17.5% |
| Early academy promotion | 6.2% |
| Played/trained with the older age group | 9.8% |
| Became a regular starter at Maccabi | 42.7% |
| Became a key player at Maccabi | 33.9% |
| Became captain | 12.7% |
| Played abroad | 20.8% |
| Returned to Maccabi | 22.8% |
| Saw a rare event | 34.1% |
| Avg peak ability | 79.3 |
| Avg Legend Score | 37.9 |
| Median Legend Score | 25.0 |
| Legend Score SD | 24.47 |
| Avg Maccabi appearances | 118.9 |
| Avg career length | 27.8 seasons |
| Avg retirement age | 36.8 |

### Legend Score distribution

| Bucket | Share |
| --- | --- |
| 0–39 | 65.1% |
| 40–59 | 12.3% |
| 60–74 | 8.9% |
| 75–84 | 6.7% |
| 85–89 | 3.6% |
| 90–94 | 2.2% |
| 95+ | **1.2%** |

A 90+ career happens to about one player in thirty. That is the intended rarity.

---

## 4. Recovery — the new metric

A **slump** is a senior season where coach trust fell below 35, or the player dropped out of
the starting eleven having been in it. **Recovery** means reaching starter or better within
three seasons.

| Strategy | Careers hitting a slump | Slumps recovered | Avg seasons to recover |
| --- | --- | --- | --- |
| balanced | 45.0% | **50.4%** | 1.89 |
| loyalist | 44.3% | 38.7% | — |
| ambitious | 49.5% | 51.2% | — |
| riskTaker | 89.1% | 20.1% | — |
| random | 67.8% | 23.5% | — |

Roughly **half of all setbacks are recoverable and half are not**, which is the shape the
brief asked for. It is also strategy-sensitive in the right direction: a player who reads the
situation recovers about half the time, a player who does not recovers about a fifth of the time.

**This metric was initially wrong and the first measurement was misleading.** It originally
scanned the whole career including the academy, where being a squad player at eleven is normal
and the ladder knocks role value down at every promotion by design. That reported 99.3% of
careers "slumping" with a 13.2% recovery rate — a number that said nothing. Scoped to senior
football (and excluding the final two seasons, since a 35 year old losing his place is the
career ending rather than a slump), it became meaningful.

---

## 5. Story systems

| Metric | Value |
| --- | --- |
| Careers carrying at least one memory | 98.4% |
| Careers running at least one story arc | 98.6% |
| Avg milestones per career | 8.7 |
| Avg traits revealed per career | 1.38 |

Arc completion rates over a separate 1,500-career sample: `position_battle` 76%,
`injury_comeback` 31%, `coach_relationship` 31%, `older_group` 24%, `europe_move` 6%.

---

## 6. Academy ladder

| Metric | v0.2 | v0.3 |
| --- | --- | --- |
| Normal promotion | 82.1% | 88.5% |
| Early promotion (skipped a level) | 0.7% | 0.7% |
| Repeated the age group | 17.3% | 10.7% |
| Avg age leaving the academy | 19.6 | **18.9** |
| Avg seasons in the academy | 10.6 | 9.9 |

The brief asked for senior football around 18–19 and warned against the average drifting past
20. The recovery mechanics did most of this on their own: higher coach trust feeds the
promotion score.

---

## 7. Repetition

| Metric | v0.2 | v0.3 |
| --- | --- | --- |
| Events per career | 43.9 | 44.0 |
| Repeated events per career | 10.21 | **7.65** |
| Avg longest same-category run | 1.96 | 1.96 |
| Worst same-category run | 4 | 4 |
| Identical event sequences | 0.0% | 0.0% |
| Event pool | 74 | **108** |

The 25% drop in repeats comes from the larger pool, not from further weight tuning.

---

## 8. By position (balanced)

| Position | Peak | Legend | Reached seniors |
| --- | --- | --- | --- |
| שוער | 78.9 | 36.0 | 50.9% |
| בלם | 78.8 | 37.1 | 49.5% |
| מגן | 78.6 | 38.6 | 51.9% |
| קשר | 80.2 | 39.1 | 53.6% |
| כנף | 79.5 | 39.0 | 52.8% |
| חלוץ | 79.6 | 37.6 | 50.4% |

Spread of 3.1 Legend points between best and worst position, down from 6.6 in v0.2. No action
needed.

---

## 9. Archetypes (balanced)

| Archetype | Share |
| --- | --- |
| הדרך האחרת (a full career, just not in Haifa) | 44.1% |
| הכוכב האירופי | 13.3% |
| המקצוען | 8.6% |
| מי שלא רצו (released, then came back) | 7.1% |
| אגדה ירוקה | 6.7% |
| הסמל | 4.8% |
| הפריחה המאוחרת | 4.4% |
| שחקן של הליגה | 3.7% |

The modal archetype is the ordinary one, which is honest — only half of careers reach the
Maccabi first team at all — and Part 15 of the brief is explicit that not every career should
be epic. Two earlier attempts at this distribution had a single catch-all label on 46–48% of
careers because it keyed off a discipline threshold, and discipline drifts upward across a long
career; it is now keyed off the `professional` trait instead.

---

## 10. Luck validation

| Check | Result |
| --- | --- |
| Same seed + same decisions reproduces the career exactly | **PASS** |
| Distinct Legend Scores across 400 seeds | 87 |
| Legend Score range | 9–99 |
| Legend Score SD | 26.12 |
| Peak ability range | 58.4–100.0 |
| Distinct archetypes reached | 10 |
| Different seeds diverge | **PASS** |

---

## 11. Balance changes made, and why

Every threshold was set from a measured distribution.

| Change | Reason | Effect |
| --- | --- | --- |
| `YOUTH_TO_SENIOR` thresholds 50/40/33 → 62/52/44 | Recovery raised coach trust, which the readiness score weights at 0.3, pushing graduation to 90% and all but deleting the "not kept" branch | graduate 90.0% → 45.4%, not kept 3.5% → 49.0% |
| `CAPTAINCY` gated on hidden leadership, 5 Maccabi seasons, age 25, trust 60, then a 26% roll | Captaincy fell out of role value alone and happened to ~30% of everyone who reached the first team | 20.2% → 12.7% of all careers |
| Homecoming chances cut twice, plus "must be one of ours" and "cannot come home twice" | The per-season chance was only ~5%, but it is rolled every off-season away, so it compounded to 39% of all careers | 39.2% → 22.8% |
| Serious injury weight 9 → 5, cooldown 9 → 12 | A career-shaping injury was hitting 57% of careers and dominating the rare-event figure | rare event 48.3% → 34.1% |
| `EVENTS.riskyUpsideBoost` 1.0 → 2.0, plus new `riskyUpsideGain` 1.6 | Risky choices measured at negative expected value — strictly dominated by playing safe | see §12 |
| `RECOVERY.minutesModifierFloor` 0.4 | Minutes penalties stack multiplicatively; a few bad outcomes in one season could drive playing time to near zero, and no minutes means no development and no way back | rarely binds, but removes the failure mode |
| Injury-comeback arc recategorised off `injury` | Anti-repetition blocks the injury category in the season after an injury — exactly the season the rehab story needs | arc fired 0.2% → 31% |
| Archetype `professional` keyed off trait, not discipline | Discipline drifts upward, so a threshold matched everyone | 48.4% → 8.6% |

---

## 12. Known weakness: riskTaker

`riskTaker` sits at mean 8.4 and beats the baseline on only 17.7% of matched seeds. It is
better than v0.2 (mean 4.4, peak 55.0 → 67.9, seniors 18.4% → 15.5% on the harder v0.3
balance) but still weak, and its SD (10.9) is **lower** than balanced (24.3) — so it is a floor
rather than genuine high variance, which is not what the brief asked for.

Three levers were tried and measured:

1. **Probability** (`riskyUpsideBoost`). Measured expected value by risk class across the whole
   pool: opportunity +9.15, balanced +3.33, safe +3.15, risky **−1.40**. Raising the boost lifts
   risky EV, but with diminishing returns — the weight renormalises — and pushing it far enough
   to reach parity makes the "gamble" mostly succeed, which removes the drama the choice exists
   for. Settled at 2.0 (risky EV ≈ +1.05).
2. **Magnitude** (`riskyUpsideGain`). Widens the developmental payoff when a risky choice comes
   off, keeping the odds uncertain. Improved peak ability 66.6 → 68.1.
3. **Compounding floor** (`minutesModifierFloor`). Almost never binds in practice.

**Diagnosis: this is the policy, not the game.** `riskTaker` takes the maximum gamble on every
decision of a 28-season career — roughly 60 risky picks — and even a small per-decision
disadvantage compounds, with coach trust feeding minutes feeding development feeding trust.
Reaching parity would mean rebalancing the effect payloads of the ~60 risky choices
individually, which is a content pass, not a tuning constant. That is the recommended v0.4 task.

`riskTaker` is retained and documented as an intentional extreme baseline — it is what shows
where the tail is — while `ambitious` was rewritten to model a bold *player*, gambling only
when form and confidence can absorb the downside. Ambitious is now a fully viable strategy
(76.3% win rate, most Europe of any strategy).

---

## 13. Remaining observations

- **Repeats per career (7.65 of 44 events)** are still driven by arithmetic: a 28-season career
  outruns a 108-event pool. More senior content is the fix, not more tuning.
- **`played/trained with the older age group` fell to 9.8%** (from 17.7%) because the
  `older_group` arc now consumes the follow-up slots that used to re-trigger the base event.
  Worth a look if playing up should feel more common.
- **Median Legend 25 against a mean of 37.9** — the distribution is strongly bottom-heavy. That
  is intentional (most careers are ordinary) but means the headline "average" understates what a
  successful run looks like.

# Maccabist v0.9.6.1 — Release Candidate Truth & Visual Stability Hotfix

Four problems playtesting found in v0.9.6, plus one wording fix. No redesign, no new features,
no rebalancing, no regenerated assets. Base: v0.9.6 (`e7d5588`).

## Final state

| | |
|---|---|
| Final commit | `8bef627` |
| Branch | `main` |
| Version | 0.9.6 → **0.9.6.1** |
| Tests | **1326 passing, 78 files** (v0.9.6: 1302 / 77) |
| Suite stability | **3 consecutive full runs, 3/3 green, identical counts** |
| Deterministic baseline | **unchanged** |
| Files changed | 17 (+1198 / −36) |

Commits, in order:

| Hash | Phase |
|---|---|
| `06b833d` | Phases 1, 2, 5 — one chronological authority for Europe |
| `7edeeea` | Phase 3 — zero appearances means zero output, defensively too |
| `045761d` | Phase 4 — the player appears already in his crop |
| `8bef627` | Version bump, README, two hardening follow-ups |

## The bugs, and what was actually wrong

### 1. Europe revealed the future through fields outside `journey.steps`

v0.9.6 gated `journey.steps`. It did not gate the journey's future-complete **scalars** —
`finalCompetition`, `reachedLeaguePhase`, `furthest`, `wonCompetition`, `reachedFinal`,
`reachedSemiFinal` — which describe the end of a season the engine simulates in advance.
`currentCampaign` read two of them; the Europe card read another for its header, badge and tier.

`visibleEuropeanCampaign` now **replays the revealed path** and is the single answer every
player-facing current-season surface consumes: the home chip, the home context panel, the home
slot decision, the career feed, the Europe card and the standings sheet. At full reveal the walk
lands where `finalCompetition` would have — derived rather than asserted.

`EuropeCards` **fails closed** rather than falling back to the journey. A fallback would have kept
the scalar reads alive and defeated the static guard that now forbids them.

`europeStatus.currentCampaign` is left exactly as it was — the raw engine helper it has always
been. It simply has no player-facing callers now.

### 2. Different European surfaces showed different competitions

**Reproduced before the fix.** A constructed UCL → UEL → UECL journey at **preseason**:

```
currentCampaign()        הקונפרנס ליג / שלב הליגה
EuropeCards header       הקונפרנס ליג
EuropeCards entry line   נכנסנו למוקדמות ליגת האלופות — סיבוב ראשון
```

One card, two competitions — and the first two were the **final** state of a season that had not
kicked off. After the fix, the same journey:

```
preseason    ליגת האלופות    מוקדמות ליגת האלופות — סיבוב ראשון
midseason    הקונפרנס ליג    שלב הליגה
season_end   הקונפרנס ליג    שלב הליגה
```

### 3. Completed-Europe wording

A settled campaign said `העונה האירופית לפנינו` — "the European season is ahead of us" — to a
player who had finished it. The settled branch now uses past-tense wording for the won, knockout
and league-phase cases. The phrase survives only inside an explanatory comment, and a test asserts
it cannot reach the screen.

### 4. Zero appearances could still contain football output

v0.9.6 stopped a player scoring in a season he never played. The two **defensive** rolls have
exactly the same shape and were missed: with zero starts the mean is zero but the spread is not,
and `rng.gaussian` is bounded at ± spread — so `0.6` rounds to one clean sheet and `1.0` to one
goal conceded.

**Reproduced before the fix** over 300 goalkeeper, centre-back and full-back careers —
711,377 season records, 5,483 of them with no appearances:

```
seed 60180  2045  GK  apps=0 starts=0  cs=0  conceded=1
seed 60277  2040  CB  apps=0 starts=0  cs=1  conceded=0
```

A keeper who conceded in a season he never played, and a centre-back who kept a clean sheet in
one. **Zero impossible records after the fix, over the same sweep.**

Gated on **appearances**, not starts: a substitute appearance can genuinely end in a clean sheet,
and clamping on starts would have deleted real football.

Rolled first and discarded after, never skipped — a short-circuit would consume two fewer RNG
values in precisely the seasons this triggers on.

### 5. The player image jumped from near full-body to its intended crop

**Reproduced before the fix, in headless Chrome, with numbers.**

Every player surface crops with a static `transform` — a scale about a point below the head, so
the frame's overflow takes the legs. Every one of them also ran `animation: gf-rise`, whose
keyframes animate `transform`. An animated property **replaces** the static declaration for the
animation's whole duration, so the art drew at `scale(1)` — uncropped, and off-centre wherever the
static transform also carried a `translateX` — until the last frame snapped it back.

Career Home at 390×844:

| Class | During entrance | Settled | Left edge |
|---|---|---|---|
| `.gf-hero-art` | 207 × 311 | 362 × 544 | −83 → −5 |
| `.gf-md-art` | 268 × 402 | 415 × 623 | −13 → 195 |
| `.gf-moment-player` | 220 × 329 | 296 × 445 | 47 → 195 |

207 × 1.75 = 362: the entire crop, absent for the length of the entrance. **14 of 14 player scenes
failed.**

`.gf-hero-art`, `.gf-md-art` and `.gf-moment-player` now use `gf-player-fade`, which animates
opacity and nothing else. `gf-rise` is **left alone** — panels, cards and `.gf-moment-art` still
use it, and `.gf-moment-art` has no static transform to lose.

`gf-player-fade` deliberately has **no `to` keyframe**: an omitted 100% resolves to the element's
own computed value, so `.gf-md-art` fades to its declared `0.9` rather than to `1` and popping
back down.

## Regression result

The deterministic seed-5 baseline is **byte-identical to v0.9.6**:

```
european seasons 11    europe history 26    last journey uefa_europa_league/league_phase/12
uefa trophies 0        domestic cups 4      championships 4
ability 82 (peak 86)   legend 77            retired 35 after 17 senior seasons
appearances 702        goals 450            assists 120
```

Nothing in the baseline contained an impossible stat, so the Phase 3 fix changed no stored figure.

## Release gate

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm run build` | passes |
| `npm test` ×3 | **78 files / 1326 tests, 3/3 identical** |
| `npm run regress` | unchanged |
| `npm run rc:audit -- 240` | **0 violations** — 546,961 season records, 12,583 European journeys |
| `npm run fixture:audit -- 800` | **0 self-opponent** — 64,592 fixtures, 149,680 European ties |
| `npm run viewport:audit` | ALL CLEAR |
| `npm run touch:audit` | 0 undersized targets |
| `npm run contrast:audit` | 0 unaccepted failing text nodes |
| `npm run crop:audit` | **NO CROP JUMP** — 90 art elements, 3 viewports |

## New tests and tooling

- **`tests/europeConsistency.test.ts`** (17) — six European routes at all three reveal stages; the
  reported mismatch pinned as fixed; static guards that no player-facing surface reads the
  future-complete scalars; and, on **engine** journeys rather than fixtures, that every journey
  opens with `entered`, that the panel is never null, and that the replay converges with the
  recorded `finalCompetition` at full reveal — each with a non-vacuity counter.
- **`tests/playerCropStability.test.ts`** (6) — the **general** rule, not today's class names: no
  rule that crops with a transform may run an animation whose keyframes touch geometry.
- **`tests/statsTruth.test.ts`** — now asserts all four outputs, with a check that the sweep
  actually reaches defensive careers.
- **`npm run crop:audit`** and a `?crop=1` probe — seeks each entrance through the Web Animations
  API at 0/25/50/75/100% and compares rendered geometry.

## Two things worth recording

**The crop probe passed on the bug twice before it was trusted.** The first version sampled
`requestAnimationFrame`; headless Chrome delivers 4–11 callbacks across six seconds, so a 380ms
entrance began and ended between samples. The second still read `getAnimations()` too late, after
the animation had finished and been removed. Both reported "NO CROP JUMP" on CSS with the bug
deliberately restored. The probe was only believed once it failed 14/14 on the reverted CSS — the
same non-vacuity discipline the tests use.

**Phase 1 caused one real test failure, and the fixture was the fault.** `tests/oneScreen.test.ts`
built a Europe fixture that opened at a final league-phase table with no `entered` step — a journey
no season can produce — so it went silent under the new rule. Checked against the engine before
touching it: across 2,100 real campaigns every journey opens with `entered` and
`visibleEuropeanCampaign` is never null. The fixture was corrected and the invariant behind it is
now asserted against the engine.

## Is this safe for friend beta testing?

**Yes.**

Every European surface now derives what it shows from one authority replaying one chronology, so
they cannot disagree with each other or with the calendar. Zero-appearance seasons contain zero
football output on all four counters, verified over 546,961 audited season records. The player
renders in his intended crop from the first painted frame at 320, 390 and 430 px wide. The
deterministic baseline did not move, the suite is stable across three consecutive full runs, and
every browser audit is clean.

Two honest limits on that answer. The crop audit measures the fourteen gallery scenes that draw a
player, not every reachable screen state — the general CSS rule is what covers the rest, and it is
a source rule rather than a rendered one. And the defensive-stat bug surfaced twice in 711,377
records; a rate that low is exactly why the permanent test carries a non-vacuity check, but it
also means a bug of that frequency in an unaudited quantity would not necessarily have been
caught.

Nothing on the DO NOT TOUCH list was modified: no player artwork or filenames, no kit colours or
goalkeeper kit selection, no transfer/cup probabilities, no league simulation, no award logic, no
decision design, no Career Home layout, no navigation, no Matchday pacing, no European allocation
rules, no UEFA qualification graph, no club database, no visual theme.

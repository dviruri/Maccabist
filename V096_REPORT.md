# Maccabist v0.9.6 — Release Candidate QA & Truth Pass

The release that makes the game safe to hand to someone else.

No new features. Ten real bugs fixed, every one of them something a beta tester would have hit and
then had to be apologised for.

---

## 1. Baseline

| | |
| --- | --- |
| starting commit | `e250aa2` (v0.9.5.1 + the new age asset pack) |
| ending commit | `9694ed4` |
| starting tests | **69 files / 1244 tests** |
| ending tests | **76 files / 1302 tests** (+7 files, +58 tests) |
| starting build | passing |
| ending build | passing |
| player assets | 60 files, all 60 unique |

Phase commits, in order:

`0b4a235` · `c0b2ac7` · `bd53d1d` · `583cbdd` · `9bdc3e7` · `8d14341` · `3a65dbd`

---

## 2. Bugs fixed

### 2.1 The missing qualifying round (BYE)

A campaign showed qualifying round 1 followed by round 3. Round 2 had not been skipped — the club
had been given a **bye**, which the best-ranked entrant receives when a node has an odd field. The
engine advanced it correctly and **recorded nothing**, so the graph was right and the story had a
hole in it.

The branch had *two* faults, not one. It pushed no step, and unlike the tie-winner path three lines
below it, it never updated `furthest` — so a club given a bye at Q2 was recorded as having reached
Q1. The same fact, answered two different ways.

Fixed with a typed `{ kind: 'bye'; competition; stage; advanceTo }` step carrying **no opponent, no
score, no legs, no venue**. A bye is a bye; inventing a match to fill the gap would be a worse lie
than the gap was. `matches` and coefficient points are untouched for the same reason.

Now renders: **סיבוב ראשון → סיבוב שני (מעבר אוטומטי) → סיבוב שלישי**.

### 2.2 Europe revealed the future

`simulateEuropeanSeason` runs the whole continental season the moment it starts. Correct for a
deterministic engine, catastrophic as a source of truth for a screen — from the first preseason
beat the journey already contains the final table, the knockout draw, the elimination and the
trophy.

Nothing stopped the UI reading it, and the home screen did:

```ts
const phase = journey?.steps.find((step) => step.kind === 'league_phase');
const where = phase ? `מקום ${phase.position}` : ...
```

So the Europe panel printed the club's **final** European standing before a single European match
had been played. That string — "הקונפרנס ליג · מקום 12", at preseason — is visible in the v0.9.4.x
contrast screenshots. It was read three times as a colour bug.

### 2.3 The synthetic European matchday

`activeFixture` could return a stored European knockout tie, and `buildMatchday` would present it —
inventing a scoreline with `presentScore` while the journey already held the **real** legs and
aggregate. The Europe card could say the club went through 4–1 while the matchday screen showed
2–0, from one save on one night. The branch also had no chronology, so a February tie was offered
as "המשחק הבא" in July.

### 2.4 Cinematics replayed forever on refresh

`matchdaysSeen` and `ceremoniesSeen` were React `useState`. A reload emptied them — and
*permanently*, because finishing a matchday only marked it locally and never advanced the career,
so the career sat on the same beat and the ledger reset on every refresh.

### 2.5 Celebrating a defeat

The full-time pose ignored the score. Worse for keepers than it looked in `Matchday.tsx`:
`assetSelector` maps a goalkeeper's `'save'` onto the **celebration** artwork, so the losing keeper
celebrated too, by a different route.

### 2.6 Failed art never retried

`artFailed` was a bare `useState(false)` nothing ever reset. One dropped request blanked the player
for the component's lifetime — through a transfer, a birthday into a new age band, a new keeper
kit, a change of pose.

### 2.7 The youth cup drawn against senior clubs

`drawFinalOpponent` excluded academy and youth tiers **unconditionally**, so a youth cup final was
drawn from senior first teams. v0.9.5.1 fixed the identity half of this and recorded the age half
as a known limitation; this is that half.

### 2.8 Goals in seasons with zero appearances *(found by the RC audit)*

```ts
goals = round(rng.normal(expectedGoals, expectedGoals * 0.2 + 0.6))
```

With no appearances the **expectation** is zero but the **spread** is not — the noise floor is
unconditional — so `rng.normal(0, 0.6)` rounded to 1 often enough that a player who never took the
pitch was credited with a goal. Five distinct season records in twenty-four careers.

### 2.9 Transfer offers to your own club *(found by the RC audit at 240 careers)*

The release-destination pool excluded Maccabi and nothing else, so a senior starved of minutes at
Hapoel Afula could be handed an offer naming Hapoel Afula. **Invisible at 60 careers, two
occurrences at 240** — which is the whole argument for scaling the audit rather than trusting a
small sweep.

### 2.10 Twenty undersized touch targets

The worst was `.dc-choice-details` at **78×22px** — introduced in v0.9.5, and the only route to a
choice's outcome sheet. A control can be perfectly visible, perfectly unclipped, and still
impossible to hit with a thumb; that does not show up in a screenshot.

Fixed with padding plus a matching negative margin, so the rect the browser hit-tests grows to 44px
while the layout stays exactly where it was — necessary because the one-screen budget at 320×568
has no slack.

---

## 3. Europe truth model

**The engine still simulates ahead.** That is not the bug and was not changed: the whole continental
season resolves at once so a save cannot disagree with itself.

**The presentation does not reveal ahead.** `src/game/europePresentation.ts` is the single
chronology authority — one module, not a check scattered across components — and it uses the
career's own `seasonPoint` rather than an invented calendar:

| stage | what may be shown |
| --- | --- |
| `entry` (preseason) | competition and entry route. Nothing has been played. |
| `qualifying` (midseason) | the completed qualifying path, plus "שלב הליגה בעיצומו" |
| `full` (season_end / settlement) | the whole journey — table, knockouts, trophy |

`revealedSteps` filters by step **kind**, not by index: a journey's shape varies (a club can drop
competitions twice before reaching a league phase) and counting steps would be guessing.

**No partial standings are invented.** The engine has no halfway table, and fabricating one would
swap a premature truth for a manufactured one. A league phase in progress says so, and the
standings sheet guards itself as well as its link — because it is reachable by other routes.

**BYEs** are a typed journey step with no opponent, score, legs or venue.

**Matchday in v0.9.6** represents exactly two fixtures the game can tell the truth about: the
representative domestic league match (no stored team result to contradict it) and the stored
domestic cup final (whose result `world.cup.run` fixes, and whose scoreline is made to agree).
`'european'` was removed from `FixtureKind` entirely, so the **compiler** enforces that Europe
cannot become a fixture rather than it being a branch nobody happens to take — which immediately
surfaced three dead branches in `CareerHome`.

No European calendar was built. That is a real feature, and a partial one would have been a third
untruth.

---

## 4. Persistence

`seenPresentationKeys` on the Career — one system for every one-time presentation event, no
per-component localStorage keys. It is saved by the same effect as everything else, so the answer
to "has he seen this" is the same before and after a refresh because it is the same field.

- **Keys are season-scoped by construction** (`cup_final_2044`, `championship_2044`,
  `league_2044_mid_<opponent>`), so a championship in a later season is a different key and still
  gets its moment.
- **Marking is idempotent**, so a double-tap on Continue cannot grow the ledger, and it flows
  through the same `step` every gameplay action uses — so a refresh one frame after Continue lands
  *past* the cinematic.
- **Old saves hydrate cleanly**, backfilled to `[]`.
- **It cannot reach the simulation**: no module under `src/game` reads it (asserted), and a career
  that has watched every cinematic finishes with identical football to one that watched none.

One thing the gate caught that I would otherwise have shipped: this repo has a deliberate
`hydrateCareer(created) === created` **reference** invariant, and backfilling only in hydrate broke
it. The field is initialised at creation instead, matching the `seasonParticipation` precedent.

---

## 5. Player assets

**Matrix:** 36 outfield + 24 goalkeeper = **60 files, 60 unique images**. The age-duplication
limitation carried since v0.9.4.x is resolved; `tests/assetMatrix.test.ts` now hashes every cell to
prove `child`/`youth`/`adult` are genuinely different artwork, which nothing guarded before.

**Integrity audit:** exact directory shape, exact counts (so an *extra* file is caught too), no file
the matrix does not name, and per-file PNG structure read from the bytes — non-zero IHDR
dimensions, a real IEND chunk (a size check cannot see a truncated download), and an alpha channel.

**Runtime format: unchanged.** No image was touched.

| | files | total | median | max |
| --- | --- | --- | --- | --- |
| outfield | 36 | 58.41 MB | 1.75 MB | — |
| goalkeeper | 24 | 46.59 MB | 1.98 MB | — |
| **player pack** | **60** | **105.00 MB** | **1.83 MB** | **2.14 MB** |

Whole deployed `public/assets`: **210.70 MB**. One player image loads per screen.

No safe converter is installed (no `cwebp`, no ImageMagick, no `sharp`), and the only available
route was lossy re-encoding through headless Chrome's canvas. Per the brief — and confirmed with
the maintainer — nothing was converted: visual corruption is worse than payload.

**Goalkeeper kit:** identity is `(seed, club)`; the season is inert and documented as such. Constant
across screen, decision, match, season, age band and pose. Never the club's own basic outfield
colour, resolved through the same `ui/colourFamily.ts` the outfield art uses so the two cannot
disagree.

**Outfield:** colour comes from the club's own colour via `clubVisual`, never a club-name table.

---

## 6. Browser QA

Six viewports: `320x568` · `360x800` · `375x812` · `390x844` · `412x915` · `430x932`

**216 scene × viewport measurements. Every scene `sh === vh`, `over=0`** — no document scroll and no
horizontal overflow anywhere.

States covered: Career Home (adult, teen, youth, GK, red, yellow, Europe, offer) · Matchday preview,
live, half time, full time (win, **draw**, **loss**) · event decisions (two-choice, three-choice,
match, cup final, academy, GK) · transfer decisions (single, multiple, mandatory, no agent) · youth
transition (one and two offers) · arrival · senior debut · championship · relegation · European
moment · retirement decision · Europe / table / club / career sheets.

**Touch targets: 20 → 0** at the 44px minimum, via `npm run touch:audit` across 17 states.

**Contrast: 0 unaccepted failures** across all scenes (one reviewed and accepted item, recorded in
the audit's `ACCEPTED` list with its reasoning).

### Deviation: Playwright was not added

The brief asks for Playwright "if the repo does not already have" Chromium testing. It does:
`viewportAudit.mjs` drives real headless Chromium and measures the live DOM (document scroll,
horizontal overflow, per-element in-viewport checks), and `contrastAudit.mjs` reads computed styles
via an in-page probe. I extended that harness with the missing scenes and a new touch-target probe
rather than installing a second test framework and a browser binary to take the same measurements.

This is a judgement call and is recorded here so it can be overruled.

---

## 7. Simulation audit

`npm run rc:audit -- 240`

| | |
| --- | --- |
| careers | 240 (GK, CB, FB, CM, WG, ST × two policies) |
| beats walked | 41,739 |
| fixtures | 19,238 |
| matchdays | 10,129 |
| season records | 546,961 |
| cup finals | 7,418 |
| European journeys | 12,583 |
| goalkeeper assets | 7,368 |
| determinism pairs | 20 |
| **violations** | **0** |

Invariants checked — identity (no self fixture, no `sameFootballIdentity` opponent, `currentClubId`
resolves, coherent home/away); season history (strictly ordered, no duplicates, coherent age);
statistics (finite, non-negative, `starts <= appearances`, **no output without appearances**);
position logic (GK art for keepers, no keeper goal, no outfielder save, no moment in a match he did
not play); cup (no self final, not playable outside settlement, trophy agrees with `run`); Europe
(no silent qualifying hop, no self tie, no trophy without the pipeline, nothing revealed early);
transfers (no offer to his own identity).

**Failures found and fixed: 2** — §2.8 and §2.9. Both are now permanent tests.

**Two of my own invariants were wrong** and were corrected rather than the engine: `promotion`
(academy → senior) and `contract` (a renewal) are legitimately offers from the player's own football
identity.

Also standing: `npm run fixture:audit -- 800` — 138,682 beats, 0 self-opponent violations.

---

## 8. Determinism

**v0.9.6 did not change football outcomes for unchanged seeds.**

`npm run regress` — seed 5, balanced policy — after every phase:

| metric | baseline | v0.9.6 |
| --- | --- | --- |
| europe history seasons | 26 | **26** |
| last journey | europa, league_phase, 12 | **europa, league_phase, 12** |
| uefa trophies | 0 | **0** |
| domestic cups | 4 | **4** |
| championships | 4 | **4** |
| final ability (peak) | 82 (86) | **82 (86)** |
| legend score | 77 | **77** |
| retirement age (senior seasons) | 35 (17) | **35 (17)** |
| appearances / goals / assists | 702 / 450 / 120 | **702 / 450 / 120** |

Three changes in this release touch code that sits beside the RNG, and each preserved consumption
deliberately rather than by luck:

- **The BYE** appends to a record. No draw, no coefficient, no match count. Asserted at the branch.
- **The cup pool** (§2.7) takes its draw **before** inspecting the pool, because an early return on
  an empty pool would consume one fewer value and shift every later roll.
- **The zero-appearance clamp** (§2.8) takes both rolls and **then** discards, for the same reason.

The presentation ledger (§4) is proven inert both structurally and behaviourally.

---

## 9. Stability

`bash scripts/stability.sh` — ten consecutive full-suite runs.

**10 / 10 passed.** Identical test count on every run, no retries, nothing re-rolled.

```
run  1: exit=0  592s  Tests 1302 passed (1302)
run  2: exit=0  627s  Tests 1302 passed (1302)
run  3: exit=0  648s  Tests 1302 passed (1302)
run  4: exit=0  630s  Tests 1302 passed (1302)
run  5: exit=0  574s  Tests 1302 passed (1302)
run  6: exit=0  636s  Tests 1302 passed (1302)
run  7: exit=0  633s  Tests 1302 passed (1302)
run  8: exit=0  603s  Tests 1302 passed (1302)
run  9: exit=0  612s  Tests 1302 passed (1302)
run 10: exit=0  612s  Tests 1302 passed (1302)
```

No test failed once. The suite is heavily simulation-driven - several individual tests run tens of
thousands of careers - and it is deterministic by construction, which is why the counts do not
move. The ~10 minute runtime is the cost of that and is the reason this gate is a script rather
than something anyone runs by hand.

The browser audits were run repeatedly through the phase work rather than once: the viewport sweep
across six sizes, the touch audit across seventeen states, and the contrast audit across every
gallery scene, each executed several times during Phase 9 with stable results.

---

## 10. Known limitations

Real, non-blocking, and none of them a truth bug.

- **Asset payload.** 105 MB of player art, median 1.83 MB per image, one per screen; 210.70 MB
  deployed in total. Not a correctness issue but the clear top performance item for v1.0. No safe
  converter was available and a lossy re-encode was judged worse than the payload.
- **`public/assets/maccabist/bonus` (80 MB, 51 files) is referenced by nothing** — not by source,
  tests, scripts or the manifest. It ships to every user. Left in place at the maintainer's
  direction; removing it from `public/` would cut the deploy by ~38%.
- **One canvas-size outlier.** The six `outfield/youth/hero/*` files are 1086×1448 where the other
  54 are 1024×1536, so they render ~11% shorter at equal width. Inspected at 390×844 — the hero
  crop absorbs it and nothing looks wrong. Pinned exactly, so a seventh odd file fails.
- **Youth cup finals have no named opponent.** The world contains exactly two academy/youth clubs
  and both are Maccabi Haifa's identity, so there is genuinely nobody to name. The cup run is
  unaffected; only the fixture goes unnamed. A test asserts that club count, so adding a real youth
  league later *fails* and forces a revisit.
- **A preseason screen can show no next-match panel.** Where a European tie used to fill that slot,
  there is now a genuine absence — the season has not opened, so no fixture is known. An absence
  replacing a false claim.
- **One decision state scrolls internally.** At 320×568 an event with two odds-bearing cards gives
  its *choice region* an internal scroll — `auto`, never `hidden`, so every choice stays reachable
  and the document never moves.
- **`ui/playerArt.ts` retains its character resolver**, because `posterRenderer.ts` still uses it
  and the garment masks. Removing it would break the share poster. No speculative cleanup.
- **The share poster still uses the old kit compositor.** Deliberate since v0.9.5 and unchanged.

### Explicitly NOT deferred

No contradictory match truth, no state corruption, no reproducible self fixture, no broken save, no
major mobile blocker, no future-result spoiler, and no deterministic instability is being carried
into v1.0 as a "known limitation".

---

## 11. Is this safe to distribute?

**Yes** - with the payload caveat below stated plainly rather than buried.

The things that would have forced an apology are gone. A friend can start a career and try to break
it without being told to ignore Europe, or that a refresh might replay something, or that the score
sometimes contradicts the result, or that a missing round is normal, or that the goalkeeper's shirt
changes at random, or that they might end up playing themselves. Each of those was real in this
repository three days ago and each is now fixed at its source with a test that would catch its
return.

What makes me confident is not the test count, it is that the audits found bugs I had not been
told about - the phantom goal and the self-transfer offer both came out of the RC sweep, not the
brief - and that scaling from 60 to 240 careers surfaced one that 60 could not. The suite now looks
for impossible states rather than merely re-asserting the states I happened to think about.

**The one honest caveat: this is a 210 MB deploy, and 105 MB of it is player art at ~1.8 MB per
screen.** That is not a correctness problem and it will not corrupt anything, but a friend on a
phone over cellular will feel it on every screen transition. It should be the first thing addressed
in v1.0, and it was left alone here deliberately - no safe converter was available in this
environment, and a lossy re-encode that damaged faces or kits would have been worse than the wait.

If the beta group is on wifi, ship it. If it is not, they will notice the loading before they
notice anything else in this report.

# Maccabist v0.9.2 — Compact Game UI / Season Sequencing

## Executive Summary

Two goals, both met. The domestic cup final now happens at the end of the season instead of the
middle of it, and the main career screens were rebuilt to feel tight: a close upper-body player
instead of a small full-length one, a dominant scoreboard, one focused match moment at a time,
and a career home whose first viewport actually answers who/where/what-next.

The simulation is untouched and verified so: a same-seed career (seed 5, balanced) reproduces the
baseline shared by v0.8, v0.9 and v0.9.1 — 26 European seasons, the same Europa League
league-phase journey of 12 matches, 0 UEFA trophies, 4 domestic cups, final ability 82, Legend
Score 77.

Every visual claim below was checked against an actual mobile screenshot; several of them were
wrong on the first attempt and the screenshots are what caught it.

## Cup Final Sequencing

**The bug:** the cup final was playable mid-season, ahead of ordinary league football. Cause:
the engine commits the cup run and its opponent at *preseason*, so the final is known months
early — and v0.9.1's fixture priority treated known as playable.

**The fix:** known and active are now different questions.

- `knownCupFinal(career)` exposes the committed final so the home screen can tease it
  (`🏆 גביע המדינה: הפועל באר שבע — בסיום העונה`).
- `activeFixture` returns it only when `isFinalSeasonBeat(career)` — settlement, after the league
  season, before the ceremonies.
- At the final beat a league fixture is not merely deprioritised, it is `null`: no match can
  appear after the final, and a club that never reached one simply ends its season.

**A truth improvement that fell out of it:** `world.cup.run` already records whether the club won
or lost that final, so the reveal's scoreline is now made to agree with it. That correction runs
*after* the player's own goals move the score — applied before, the goal adjustments could push a
lost final back to a draw, shipping a 2:2 "defeat". Its own test caught that.

**Tests** (`tests/seasonSequencing.test.ts`, 10): opponent known at mid-season; known ≠ active;
mid-season fixture never the final across 30 seeds; active only at the final beat; played once
and identically on re-read; no league match at or after the final beat; a non-qualifying club
unaffected; an early cup exit is never a final; won finals end ahead and lost finals end behind.

One pre-existing fixture test encoded the *old* behaviour and moved to the new rule rather than
being deleted — it still asserts the final overrides the league pairing, now at the final beat.

## Hero Composition

The v0.9 hero fitted a whole body into a tall banner, which made the character small and the
type small with it. The hero is now a bust: the frame is `clamp(220px, 38vh, 300px)` and the art
is cropped **through layout** — scaled 1.75× about a point just below the head, so enlarging
pushes the legs out of frame while the face stays put. No image file was edited.

Three attempts, each corrected by a screenshot:

1. Oversizing the element and anchoring it to `bottom` clipped the head and filled the screen
   with shins.
2. `object-fit: cover` still showed ~73% of the body at this aspect.
3. `object-fit: contain` letterboxed instead of zooming.

A second RTL lesson landed here too: `grid-column: 2` put the identity block on the **left** in
RTL, straight over the player. Column 1 is the right-hand side.

Goalkeepers verified separately at 320 and 430: face, gloves/kit and upper body all read, with
the correct youth/teen/adult asset — the resolver in `playerArt.ts` was not bypassed.

## Career Home

Identity typography now leads: the name is `clamp(30px, 8.6vw, 46px)` and the largest element on
the screen. The next-match block became part of the hero **scene** rather than a separate
bordered card, and scene padding/gaps were tightened.

Measured at 390×844: identity, position/age, club, ability badge, the entire next-match hero and
the first two feed items sit in the first viewport. Before this pass the feed began below the
fold.

## Matchday

Score `clamp(52px, 16vw, 76px)` (was 34px), on a board with an inner green glow; club names and
minute scaled to match. The player is close and large, cropped by the same transform technique
and allowed to sit behind the board — the first pass pushed the lineup status off-screen, so the
stage is now a fixed height with the art absolutely placed and the status layered on top.

Moments have one focus: the latest revealed moment carries full opacity, larger type and the
glow; earlier ones recede to 50% as history. Full time reads as a conclusion — a large verdict
(ניצחון / הפסד / תיקו, trophy-worded for a cup final), the competition and opponent, then the
real numbers the matchday was drawn from.

## Career Decisions

Logic untouched. The screen leads with the destination crest, a `clamp(24px, 7vw, 36px)`
headline and the player as an upper-body crop; then the offer's own words; then a **short**
essential fact set (competition, expected role, Europe), with country and direction moved behind
an עוד פרטים tap. Action buttons grew to 58px.

## Typography

Five tiers replace a scatter of near-identical sizes, declared once as CSS custom properties:
DISPLAY (moment/score), HERO (player/club/opponent), SECTION, BODY, META. Body text moved to a
responsive clamp instead of fixed 13.5px; META never drops below 11.5px or below the
secondary-text contrast token, so Hebrew stays readable rather than decorative.

## Mobile

18 scenes at 320 / 360 / 375 / 390 / 412 / 430: **zero horizontal overflow**, with the probe
canary failing at every width as the control. Hero layers are clipped by their own frames and
never expand document width. At 320–350px the character narrows and the name steps down one size
so identity keeps clear air beside the art.

## Tests

```
1086 passed / 1086    (61 files)
```

1076 at the v0.9.1 baseline plus 10 new (`tests/seasonSequencing.test.ts`). Nothing deleted;
three test-side corrections are documented in the phase commits — one behavioural spec that moved
with the new rule, one over-strict assertion (the league may legitimately draw the club the final
holds, so *kind* is the invariant, not the opponent id), and one fixture that had to clear a cup
run the engine really does project.

## Regression

Same-seed career (seed 5, balanced) identical to the v0.8/v0.9/v0.9.1 baseline: 26 European
seasons, same UEL league-phase journey of 12 matches, 0 UEFA trophies, 4 cups, ability 82, Legend
Score 77. The only engine-side change this release is presentation sequencing and the cup-final
scoreline agreeing with the stored result; no simulation rule or probability moved.

## Build

`npm run build` clean throughout; every phase built before commit.

## Known Issues

- The cup-final matchday is reached at settlement, but a career that reloads exactly at that beat
  will replay the reveal (it is component state, like every other reveal) — harmless, since the
  result is stored and identical.
- The bottom nav's מועדון button still toggles two sheets, carried from v0.9.1.
- One phase-2 commit message lost a few backticked technical terms to shell substitution; the
  commit content is unaffected, and it was not amended because it had already been pushed.
- The matchday player art at very short viewports (<640px tall) can crop below the chest; the
  stage clamps to 32vh, which keeps the face but tightens the torso.

## Deferred

- Matchday for European ties (`activeFixture` resolves them; the reveal is still wired to the
  league beat and the cup final).
- A true domestic fixture calendar — still explicitly out of scope.
- Desktop-specific navigation and hero treatments; the layout remains mobile-first.

---

Phase commits, all on `main`:

```
2b220b6  v0.9.2 phase 1 - fix cup final sequencing
2a37124  v0.9.2 phase 2 - compact cinematic player heroes
fb41d80  v0.9.2 phase 3 - strengthen matchday hierarchy
6e3b35c  v0.9.2 phase 4 - tighten career decision screens
51b092a  v0.9.2 phase 5+6 - home density and game typography
3895b3d  v0.9.2 phase 7+8 - visual consistency and mobile hero polish
         v0.9.2 - compact game UI and cup final sequencing (this commit)
```

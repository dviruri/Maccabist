# Maccabist v0.9 — Game Feel / Career Experience

## Executive Summary

v0.9 rebuilds the presentation layer around the four concept images in `docs/design/v09/`,
turning the career dashboard into a career being lived: a cinematic home that answers WHO AM I /
WHERE AM I / WHAT IS NEXT / WHAT IS HAPPENING, a staged matchday reveal, full-screen career
decisions, a life-story journey timeline, an art-forward trophy room, full-screen ceremonies for
the seasons' real big moments, and European nights under floodlights.

The architectural principle held throughout: **existing engine + new presentation layer.** The
diff against the v0.8 baseline inside `src/game` + `src/data` is three things — a pure Hebrew
string helper, its use in one display text, and the new presentation-only matchday presenter on
an isolated rng. A same-seed check reproduces the v0.8 session baseline exactly (seed 5:
26 European seasons, the same UEL league-phase journey, the same trophies, the same final
ability and Legend Score). Simulation distributions are untouched by construction, and verified.

All phases 0–9 completed; every phase committed and pushed separately (per user instruction
mid-run, to `main` rather than `br_v09` — the branch was merged into main at phase 1 and is
historical).

## Visual Direction

From the concepts and the visual bible, implemented as a shared depth model used by every v0.9
screen: stadium backdrop → vignette → character art → glass panels → controls. Near-black
cinematic base, Maccabist green as the one UI accent, gold reserved for prestige, blue reserved
for European nights, character art in the pack's own black/pink/purple/blue. Big ruled section
titles, one hero per screen, information behind taps rather than all at once. The concept
images' sample content (name, #33, rating 72, the Ajax offer, scores) was treated as
illustration only — a test scans `src/` proving the sample strings never shipped.

## Art System

`src/ui/playerArt.ts` is the single resolver for every pack asset — characters, backdrops,
people, moments, transfer art, trophies, awards, overlays. No image path lives in a screen.
Graceful failure everywhere: art layers are decorative behind coded UI, so a missing file
degrades to the dark gradient, never a broken screen. Hero/backdrop images load eagerly; feed
faces, overlays and showcase art lazily.

## Player Age / Position Art Mapping

By ACTUAL age — ≤14 youth, 15–18 teen, ≥19 adult — never by team level, so a 17-year-old
starting senior football renders as seventeen (there is deliberately no way to pass a team
level to the resolver). GK ↔ outfield never cross: a keeper falls back to the keeper hero, not
to outfield art. Context poses (hero/celebration/save/ready) resolve per-band availability with
hero fallback. All of this is enforced by `tests/playerArt.test.ts`, including an on-disk
existence assertion for every resolvable path.

## Career Home (Phase 2)

`CareerHomeScene` replaces the compact hub: the player hero (name, position, age, club+crest,
and the game's own long-standing ability rating — no invented OVR, no shirt number because none
exists in the model), then המשחק הבא, then the feed. The honesty rule that shaped it: the
engine simulates seasons, not fixtures, so the next-match hero shows the season's next REAL
chapter — a committed cup final names the actual final opponent, a European knockout names the
actual stored tie, otherwise the league hero pairs the player's real table position against the
nearest real rival (producing the concept's own "מקום X נגד מקום Y" caption). Timing speaks in
season phases; kickoff times are never invented. The feed is deterministic templates over live
state (pending offers → agent, actual role/trust → coach, actual mid-season form → media,
actual journey → club, recent major milestone). During event/decision phases the scene
collapses to the compact hero — the v0.4.7 rule that the choice never drops below the fold.

## Matchday Experience (Phase 3)

`matchdayPresenter.ts` + `MatchdayExperience`: the mid-season beat opens on יום המשחק — preview
with real lineup status, staged reveal of a moment timeline, half time, full time, then the real
half-stats line that anchors it. Presentation-only and provable: opponent from `matchContext`'s
deterministic real-club pairing, score tilt from the real points gap, and tested honesty — a
player-goal moment requires a real goal in the half, keepers get keeper matchdays (no striker
moments, no invented penalty saves), a clean-sheet night requires a real clean sheet, zero real
appearances means the bench, and the scoreboard always equals the revealed moments. Isolated
rng (`seed^season^'matchday'`); a test proves rendering consumes nothing. Continue/skip; the
reveal is component state, so a save mid-reveal resumes cleanly. One bug its own test caught
pre-ship: the assist moment (which IS the assisted goal) wasn't counted on the scoreboard.

## Career Decisions (Phase 4)

`DecisionScreen` replaces the offseason offer list: club-crest hero, the offer's own engine
copy as headline, a facts table (league, country, kind, the engine's qualitative expected-role
bands, direction, and the destination's LIVE v0.8 European entry — מוקדמות vs שלב הליגה kept
distinct), the signed agent's read phrasing the offer's real direction, a stay-vs-go split, two
big buttons. No salary, contract length or appearance guarantees — the game doesn't model them,
so the screen doesn't claim them. Accept/decline semantics unchanged; multiple offers page.

## Career Journey (Phase 5)

`JourneyTimeline`: club eras derived from the season rows every archive generation carries
(clubId/season/age) — node, crest, season range, age each chapter began, academy chapters
marked, returns tagged חזרה הביתה as their own era, trophies/honors as gold marks. Renders old
archives with no migration. Lives in the archive detail and the live history sheet.

## Trophy Room / Awards (Phase 5)

`TrophyShowcase`: the pack's prestigious art, one card per silverware kind, counted, first…last
season captions. European silverware leads with its own night-blue treatment; each individual
honor uses its specific award art (boot, assists mark, player/goalkeeper of the season, rising
star) — no generic flattening. The v0.7 cabinet remains as the expandable detail beneath; both
read the same typed trophies and stored honors. Club Album unchanged in philosophy: a record,
not a currency.

## Major Career Moments (Phase 6)

Season settlement opens with full-screen ceremonies for the season's REAL events, prestige
order: UEFA trophy (europe night, star lights, trophy art), championship (ceremony + gold
confetti), cup, first-ever European league phase, and relegation — dark, no confetti, because a
moment system that only celebrates is a liar. Every trigger is a stored fact (typed trophy,
stored journey, deduped milestone, the world's own outcome); each shows once via the same
revealed-keys mechanism as the event reel. The ceremony screenshot caught a v0.8 Hebrew bug —
"זכייה בהקונפרנס ליג" — fixed with one shared ב+ה contraction helper used by the moment title,
the v0.8 milestone text and the journey champion line.

## European Presentation (Phase 7)

The journey card renders inside the europe-night stadium with glass on top — same v0.8 facts
(entry reason, each qualifying tie with its drop-down destination, league-phase standing, the
honest autumn state), Champions League tier keeping gold. The UCL→UEL→UECL story stays fully
spelled out; the Welcome page opens on the dark stadium; Retirement opens as the end of a
career (retirement art, name, years — with an Ltr fix after RTL rendered 2039–2055 backwards)
before the existing poster. Deliberately NOT migrated: the league table, stats sheets, summary
number grids — data screens stay data screens.

## Motion / Responsive (Phase 8)

Restrained: screen/panel rises (~380ms), a one-beat scoreboard pop keyed on the revealed score,
first-feed-item entrance. All timings route through tokens that `prefers-reduced-motion`
collapses to 1ms. Mobile: thirteen scenes audited at 320/360/375/390/412/430 — zero horizontal
overflow everywhere, with the probe canary failing at every width as the control. Two real RTL
bugs were caught by screenshots during the build (hero identity block flipped onto the art;
year ranges reversed) and fixed with documented causes.

## Backward Compatibility

No engine or save-shape changes: no new persisted fields, no schema bump, archives and old
saves load as before (v0.7/v0.8 suites all green). New visuals over old archives handle missing
fields (journey timeline needs only clubId/season/age; showcase renders whatever trophies
exist).

## Tests

```
1044 passed / 1044    (56 files)
```

1030 at the v0.8 baseline + 6 matchday-honesty tests + 8 art-resolver/sample-leak tests. No
test deleted or weakened.

## Build

`npm run build` clean (both TS projects + Vite). Bundle grew by the presentation layer only;
the 7.5MB art pack ships as static WebP/PNG assets loaded lazily except per-screen heroes.

## Known Bugs

- The moment/retirement artwork renders as rectangular blocks (the pack's images have baked
  backgrounds, not cutouts); acceptable inside scenes, slightly stiff on the retirement hero.
- The matchday reveal advances two moments per tap after kickoff — intentional pacing, but on
  very short matches the skip button barely matters.
- The gallery's Europe fixture career doesn't exercise the qualifying-card variant of
  EuropeCard with a live league phase mid-season (covered by unit paths, not by a screenshot).

## Carried v0.8 Issues

- Dev-only npm audit findings in the vite/vitest chain (documented in V071_REPORT.md).
- Ligat Ha'Al playoff scheduling remains the simplified allowance (v0.6.5.3).
- README deep-sections still describe pre-v0.6.2 systems (partially updated only around
  release state and the season-level simulation claim, which v0.8 had already made stale).

## Deferred

- Signing/press-presentation ceremony on transfer acceptance (the transfer art is in the pack;
  the moment system can host it — needs an arrival hook).
- Debut ceremony (milestone exists; same hook).
- Bottom navigation redesign from the concept (the sheet nav remains; a fixed bottom bar is a
  navigation-architecture change deserving its own pass).
- League-phase standings as a full 36-row European table screen.
- Poster restyle to the new visual language (current poster remains the v0.7 canvas design).

---

Phase commits, all on `main`:

```
f3a46ac  v0.9 phase 0 - sync v0.8 baseline
0cdc68d  v0.9 phase 1 - game presentation foundation
a40aee5  v0.9 phase 2 - cinematic career home
68b04c5  v0.9 phase 3 - matchday experience
ea8f0b0  v0.9 phase 4 - cinematic career decisions
e7eadb7  v0.9 phase 5 - visual career journey and trophies
b57f4f7  v0.9 phase 6 - major career moments
c57ce91  v0.9 phase 7 - europe game feel and remaining screen migration
9926e6c  v0.9 phase 8 - motion and mobile polish
         v0.9 phase 9 - nightly QA and report (this commit)
```

*מכביסט — מהילדים לאגדה. עכשיו זה מרגיש כמו קריירה.*

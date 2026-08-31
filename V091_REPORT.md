# Maccabist v0.9.1 — State Integrity / UX Completion

## Executive Summary

v0.9 made the game look like a game. v0.9.1 makes it hold together: three real continuity bugs
found in manual playtesting are fixed structurally, matchday becomes a place the player *enters*
rather than scrolls to, and the five items v0.9 deferred are delivered.

The engine is untouched. A same-seed career reproduces the v0.8/v0.9 baseline exactly — seed 5
still returns 26 European seasons, the same Europa League league-phase journey of 12 matches,
the same trophies, ability 82 and Legend Score 77. Every fix is presentation or data-plumbing;
no simulation rule, probability or balance value changed.

All eight phases completed, each committed and pushed to `main` separately.

## Match Context Fix

**The bug:** the career home showed Maccabi Netanya as the next opponent; kickoff produced
Maccabi Tel Aviv. Cause: two screens answered one question independently — the home derived a
"next match" from the nearest table rival, the matchday derived its own from `matchContext`.
Both deterministic, both reasonable, and they disagreed.

**The fix:** `src/game/fixture.ts` — `activeFixture(career)` is now the only answer. It carries
the fixture id, kind, competition (with UEFA id where relevant), both club ids and names,
home/away plus explicit home/away slots, stage, the league context, both table positions and the
points gap. The home hero and the matchday presenter both read it; neither derives an opponent.
The matchday's rng is seeded on the fixture id, so a given match always tells the same story.

Priority is fixed and documented: committed cup final → stored European tie → the generic league
beat. Stored competitions always win, because presenting a generic league opponent while the
engine holds a real committed final would be the same lie in a different costume.

This is **not** a fixture engine: the league beat remains a deterministic pairing from state that
already exists (projection table seed + season phase). No calendar was invented.

**Tests** (`tests/fixture.test.ts`, 6): identical opponent/name/venue/competition/fixture-id on
both screens across 60 seeds; home-away coherence; never plays itself; stability across reads;
cup final and European tie each overriding the league beat.

## Dedicated Matchday

`GamePage` now returns the matchday **before** the shell — no topbar, no home scene, no feed, no
league card, no nav, no sheets. It fills 100dvh with its controls anchored at the bottom and
hands back to the half summary at full time. It is a screen state rather than a route (the app
has no router and a rewrite was out of scope), keyed by the fixture id so a save mid-match
resumes into the same match.

Pacing fixed per the v0.9 report's own note: one meaningful moment per primary tap instead of
two, plus **הרגע הבא** (jump to the next moment that matters) and **לסיום** (full time) — so
neither control is meaningless.

## European State Separation

**The bug:** a club actually playing in the Conference League, with the UI announcing "Champions
League — direct league phase". Two facts had been collapsed into one field: `current.entries`
holds where a club *started* (a club that dropped from the UCL still carries a UCL entry), and
`DecisionScreen` additionally fell back to `nextEntries`, presenting a *future* qualification as
a present fact — rendering `entry === league_phase` as the exact wrong string.

**The fix:** `src/game/europeStatus.ts` separates them.

- `currentCampaign` follows the recorded journey's `finalCompetition`, so drop-downs move it — a
  club that fell to the Conference League reads Conference League. For clubs the world records no
  journey for, only the entry is known, and the result says so at `entry` certainty rather than
  claiming a campaign.
- `nextSeasonRoute` reads the v0.8 resolver's own `nextEntries` and is always labelled
  **בעונה הבאה**.

Neither re-derives UEFA allocation. The Europe card now says **אירופה העונה** explicitly and
carries a separate next-season line.

**Tests** (`tests/europeStatus.test.ts`, 6): a UCL→UECL drop reads UECL now while the journey
still records the UCL origin; a qualifying entry never renders as a league-phase place; next
season never renders as present; Israeli 2nd place never renders as a Champions League entry; the
Israeli champion earns a *qualifying* route, not a direct league-phase place.

## Parent Club Crest Inheritance

Clubs carry an optional `crestOwnerId`; `crestOwnerOf` in `clubVisuals.ts` — the file that has
been the single place a crest is named since v0.4.7 — resolves it. `getClubCrest` returns the
owner's file and `clubVisual` returns the owner's colours and initials, so an inheriting club
can't end up with the right crest beside a hash-generated badge.

Set for the Maccabi Haifa academy and youth sides and the three external youth clubs with real
senior parents (Hapoel Haifa, Maccabi Netanya, Hapoel Afula). Deliberately **not** set for the
two standalone regional academies (בית״ר קריות, עירוני הצפון) — no senior parent exists for them
in this world, so inheriting would be a lie.

Branding only, asserted both ways: the youth side keeps its own id, name, league and tier, and no
youth id appears in any senior league membership.

One existing invariant was *followed* rather than weakened: the v0.6.3 provenance rule (no
displayed crest without a manifest record) now checks the crest **owner**, since an inheriting
club's provenance legitimately lives in its parent's entry.

**Tests** (`tests/crestInheritance.test.ts`, 8) plus all pre-existing crest suites: 46/46.

## Career Feed Improvements

Derivation moved to `src/game/careerFeed.ts` with contextual pools. The coach reads form first
(real half rating and appearances), then the standing role, with separate pools for a trusted vs
cold rotation player. The agent distinguishes a foreign offer (quoting the real country), several
offers (real count), a single offer, and a quiet window for a well-regarded player. Media speaks
only where the half provides evidence. The club speaks Europe through `currentCampaign` — naming
the competition the club is *actually* in — and otherwise its real table position, split into
title race / mid-table / relegation.

Everything that made the feed trustworthy is unchanged: no rng consumed, no persisted history,
every line grounded in live state. Selection hashes (seed, season, season point, category,
context) with a per-season rotation, so wording moves across beats while staying stable within
one. Two speakers can never emit the same sentence.

**Tests** (`tests/careerFeed.test.ts`, 10): determinism and zero rng consumption; variety across
twelve seasons and across season points; no duplicates in one feed; silence when there are no
offers and before there is form to discuss; real country quoted; every number in a media line
asserted to be one the half actually contains.

## Signing / Debut Moments

**Arrival:** at the first preseason after a move — press-presentation art, green smoke, the new
club's crest, the real league and season. Nothing invented: no salary, shirt number or contract
length, because the game models none of them.

**Debut:** the engine now stamps a `senior_debut` milestone at the exact point it *already*
decides a debut (first senior season with real football in it — the same condition that gives the
manager his `gaveDebut` memory), and the ceremony reads that fact rather than re-deriving the
condition. Fires once, for the senior debut only.

## Bottom Navigation

A fixed mobile-first bar with five destinations — טבלה, הסיפור, בית, הקריירה, מועדון — wired to
the sheets that already existed. Active state via green fill and `aria-current`, RTL order from
the document direction, `safe-area-inset-bottom` honoured, and a spacer so content never sits
underneath. Deliberately absent from matchday and ceremony screens, which own the viewport.

## Career Poster

Same data, same 9:16 and 1:1 formats; styling moved into the v0.9 language: a dimmed
trophy-ceremony stadium under the gradient, the two axes as glowing plates, and the player's own
age/position-resolved art closing the poster — which also fills the dead lower half the v0.7
layout always had. Placement took three attempts, decided by screenshots: inline he landed on the
מורשת מכבי plate, as a bottom-left depth layer he sat across the stat row.

## European Standings

The 36-club league-phase table, reached from the Europe card. The engine already sorted these
exact rows to decide the knockouts and then discarded them; they are now recorded in the season
state for the **current** season only — same rows, no simulation change, no re-run. Optional
field, so pre-v0.9.1 saves simply report the table unavailable for a season in progress.

Shows position, club with crest, MP/W/D/L, goals, difference and points; the player's club is
highlighted, his competition listed first, and the post-2024 zones are coloured and legended
(1–8 direct to the R16, 9–24 play-off, 25–36 out). Horizontal scrolling is contained inside the
table. Verified on a simulated career: 36 rows per competition, non-increasing points, every club
on 8/8/6 matches.

## Art Integration

Moment and retirement art carries baked backgrounds, so it read as pasted rectangles. No artwork
was regenerated: a radial mask fades the corners, a screen blend lets the backdrop through, and a
slight scale-up hides the frame beyond the mask. Trophy and award PNGs are excluded (already
transparent, kept crisp); character art is never blended, which would flatten its palette.

## Tests

```
1076 passed / 1076    (60 files)
```

1044 at the v0.9 baseline plus 32 new: `fixture` (6), `europeStatus` (6), `crestInheritance` (8),
`careerFeed` (10), and 2 palette-regression tests added to `playerArt`. 1044 + 32 = 1076, with
nothing deleted. Two pre-existing tests were *updated* rather than weakened — a stale `.context`
reference after the fixture unification, and the crest provenance rule now following inheritance
to the crest owner.

## Regression

Same-seed determinism against the v0.8/v0.9 baseline (seed 5, balanced): 26 European seasons, the
same UEL league-phase journey of 12 matches, 0 UEFA trophies, final ability 82, Legend Score 77 —
identical. The only engine-side changes in this release are additive data (`crestOwnerId`,
`standings`, the `senior_debut` milestone); no simulation rule or probability was touched.

## Build

`npm run build` clean. Mobile audit: 14 scenes at 320/360/375/390/412/430 — zero horizontal
overflow, with the probe canary failing at every width as the control.

## Known Issues

- The relegation moment art contains red stadium lighting from the pack itself. This is scene
  lighting in supplied artwork, not a player kit or prestige UI, so it is left as delivered.
- The masked moment art still reads slightly rectangular at its widest — the mask softens the
  frame but cannot invent a cutout.
- The bottom nav's מועדון button toggles between the people and legacy sheets rather than opening
  a single destination; acceptable, but it is a compromise of mapping five buttons onto six
  existing sheets.
- The European standings screen is unavailable for a season that began before v0.9.1 (the rows
  did not exist to record); it populates from the next simulated season onward.

## Deferred

- A true domestic fixture calendar (explicitly out of scope; the season-level model stands).
- Matchday for cup finals and European ties — `activeFixture` already resolves them, but the
  reveal is still wired to the mid-season league beat only.
- Desktop navigation treatment (the bottom bar is mobile-first; desktop inherits it).
- Signing ceremony variants for loans and returns, which currently share the arrival moment.

# MACCABIST v0.7 — Collection / Meta / Visual Career Experience

**Mission:** from a dashboard with a game inside to a football game with a strong visual
identity. Careers persist, success is visible, retirement matters, and the player wants to
press קריירה חדשה.

---

## Build

```
typecheck (src)     clean
typecheck (tests)   clean
production build    clean
```

## Test Count

```
1007 passed / 1007    (53 files)
```

964 were green at the v0.6.5.3 baseline; the 43 new tests are `tests/v07Truth.test.ts` (25:
pre-flight youth fix, segments, competition split, honors), `tests/archive.test.ts` (9) and
`tests/trophyIcons.test.ts` (9).

## v0.6.5.3 Baseline

`6abd452`. 964 tests / 50 files. 50k balanced careers: Maccabi seniors 63.9%, abroad 33.2%,
loans 31.8%, Legend 41.8, peak 80.9, retirement 34.9.

## Pre-flight Youth Fix

`youth_guaranteed_spot` carried `transferTo: 'maccabi_netanya'` — the Liga Leumit **senior**
club — while its own text says מחלקת נוער של מועדון מתחרה. `moveToClub` sets
`academyStage = 'senior'` for any `isSenior` target, so a teenager choosing "לעבור" was made a
senior professional on the spot. Same defect class as the Hapoel Afula bug fixed in v0.4.1; this
one survived because the id looked plausible.

Fixed to `youth_maccabi_netanya`. Two regression tests: the event's target must be in the
external-youth pool and not a senior club, and applying the effect to a `youth_b` fifteen-year-old
must leave his stage untouched. A repository audit found no other event `transferTo` pointing at
a senior club for an academy-band player.

## Checkpoint A — Season Segments

**What a segment is.** The engine simulates a season as two halves, and a mid-season move
happens *between* them — so the finest grain the game truthfully knows is "one or two halves at
one club", and that is exactly what a `SeasonSegment` is. Most seasons: one. A mid-season move:
two, each keeping the stats and fixture count of the football actually played there. No
match-by-match database was invented.

**Write path.** `playFirstHalf` now captures `firstHalfContext` (club, league, stage, loan,
role) alongside the existing `firstHalfStats`/`firstHalfGames`, so settlement can build one
honest segment per spell even when an event has since moved the player. `playSecondHalf` builds
the segments from the two halves and attaches them to the record.

**Reconciliation.** Segment sums equal season totals *exactly*, for every additive stat
(appearances, starts, goals, assists, clean sheets, goals conceded), and segment fixtures sum to
`teamGames`. The v0.4.8 event-reconciliation delta (an appearance credited from an on-field
event) is applied to the closing segment, so the invariant holds unconditionally. Enforced by
three new integrity codes: `segment_totals_mismatch`, `competition_totals_mismatch`,
`segment_games_mismatch`. Rating is an average and `injuredGames` stays season-level — both
documented as outside the additive reconciliation.

**Mid-season truth (A7).** A season split across clubs shows each spell's own numbers. Goals
never migrate between spells, and a cross-league move means each league judges only the football
played in it.

## Competition Stats

Each segment carries `CompetitionLine[]`: `league`, `cup`, `continental_generic` (+ `youth` for
academy seasons, `combined` for legacy records).

**The split is deterministic and rng-free.** Matches are not simulated individually, so "which
of his 20 goals were cup goals" is not a fact the engine ever generated — but the fixture basis
is: `leagueScheduleBreakdown` (refactored out of `leagueSeasonGames`, so the total IS the sum of
the parts) gives the composition the season was actually produced against, and each stat is
apportioned across it by largest-remainder with fixed tie-breaking. Same season, same split,
forever; no rng stream is consumed, so a v0.6.x seed replays byte-identically apart from the new
fields. Appearances are capped by each competition's own fixtures; starts and clean sheets are
capped by their line's appearances.

**The European allowance (A4).** The generic continental fixtures strong clubs have always
carried are classified `continental_generic` and are never presented as Champions League,
Europa League or Conference League — competitions the game does not model. A test asserts no
named European competition appears in any line. v0.8 is expected to replace the allowance with
real competitions; stored lines stay as they are (A8: history is stored).

## Old Save Behavior

Pre-v0.7 records get one conservative legacy segment at hydration: full-season stats, club,
league, fixture count — and a single `combined` competition line marked
`breakdown: 'legacy_estimate'`. The true league/cup split of an old season was never known, so
it is not invented: legacy seasons are **excluded from retroactive league honors** rather than
approximated. Old careers therefore have reduced honors reconstruction, which is the documented,
honest trade. Old saves load; new segments begin at the next settlement (Scenario O).

## Checkpoint B — Individual Honors

Five awards, all league-relative, all stored at settlement, never recomputed:

| award | basis |
| --- | --- |
| מלך השערים | league goals vs best of 3 simulated rivals drawn from league size × scoring environment |
| מלך הבישולים | league assists, same philosophy |
| שחקן העונה | position-aware performance score vs the league's best rival score |
| שוער העונה | keeper-only field: rating + clean-sheet share + team defence |
| השחקן הצעיר של העונה | age ≤ 21 in the award season (a senior-award rule — academy stages are irrelevant to it), weaker field |

**Performance score** = engine season rating + minutes share + team-outcome bonus (read from the
world's own `clubSeasons`) + captaincy + a *position-normalized* contribution bonus: output is
measured against the player's own position expectation (ST 0.72/game … CB 0.12, GK by clean-sheet
rate), clamped so one freak stat cannot buy the award. Raw Ability is never an input.

**Determinism.** The field is seeded from `career.seed ^ season ^ league`, never the live rng —
same career seed, same award results, and no existing career moved by a single event.

**Honor truth.** `IndividualHonor { type, season, leagueId, league, clubId, position,
statValue, age }` pushed to `career.honors`; `statValue` is the number the award was won *with*
(league goals, clean sheets), so it renders forever as it was earned. A new integrity code
(`honor_without_season`) catches an honor pointing at a season that never happened.

**Season reveal (B10).** Honors appear inside the season summary as compact gold cards — the
mark, the crown, the league, the number — no modal spam.

**Calibration.** The first field drew one uniform rival and 85–93% of careers won שחקן העונה at
least once — award inflation. The fix was structural (the rival is the *best of several* draws,
bending the distribution toward the top of the band) plus raised anchors, iterated against
2,000-career measurements. Deferred as out of scope: the optional B11 late-season race display.

## Honor Simulation Distribution

50,000 balanced careers, positions rotated — share of careers winning each award **at least
once**:

```
pos      PoS    scorer  assists  GK-award  young
GK      19.2%    0.0%     0.0%    42.2%    21.5%
CB      27.9%    0.0%     0.0%     0.0%    28.6%
FB      32.8%    0.0%     0.1%     0.0%    30.6%
CM      40.9%    0.0%     9.4%     0.0%    36.5%
WG      42.2%    4.2%    25.7%     0.0%    37.5%
ST      45.8%   37.9%     0.5%     0.0%    37.7%
```

Health check against the pathology the brief names: with positions equally weighted, שחקן העונה
winners split roughly ST 22% / WG 20% / CM 20% / FB 16% / CB 13% / GK 9% — attackers lead, as
football awards do, and nobody is mathematically locked out. The scoring crown belongs to
strikers and the assists crown to creators, which is the game modelling football rather than a
quota. Distributions were tuned only against the one clearly broken state (the first field let
85–93% of ALL careers win שחקן העונה — award inflation), not toward equality.

## Checkpoint C — Career Archive

**Schema.** `ArchivedCareer`: identity, the two greatness axes, legacy rank, ending, totals
(position-aware), Maccabi block, ordered club journey (unique clubs with spells counted),
season rows, typed trophies, honors, achievements, 4–8 major-milestone highlights, promotions
(from `won_promotion` memories, which the integrity validator already cross-checks against world
outcomes). Deliberately **not** a Career: no rng state, no world tables, no pending events.

**Persistence.** New versioned key `maccabist:archive:v1` beside the existing career/meta keys.
`archiveCareer` is an **upsert by the career's own id** — retiring writes the snapshot,
reopening the retirement screen writes the same snapshot over itself (Scenario J). The write
happens the moment `retired` becomes true, not when the user leaves the screen, so closing the
app on retirement cannot lose a career (G6).

**A pre-existing double-count fixed.** `recordFinishedCareer`'s only guard was a React ref,
which resets on reload — reopening the app on the retirement screen counted the same career
twice into `careersPlayed`. It is now idempotent by career id in storage.

**Multi-career.** A list, newest first; best-of stats (careers, best global, best legacy, best
peak) are display-only. A test proves ten archived careers leave a newly created career
byte-identical (ability, potential, rngState) — archives feed nothing back into gameplay.

**Delete / reset.** Per-career delete with confirmation; full meta reset with strong
confirmation. Both tested to never touch the active career, which lives under a different key.

**Storage footprint** — measured, not assumed (`npm run archive:stress`):

```
100 careers, 2,566 seasons
total serialized       1,572 KB   (30.7% of a 5 MB localStorage budget)
per career              15.7 KB
snapshot build           0.05 ms avg
parse all                4.6 ms
```

First measurement was 3.0 MB; the fix was archiving segments only for seasons that actually
split (a one-club season's card renders from the row itself). An archive-payload decision, not a
truth decision — the live career keeps every segment.

## Checkpoint D — Season Cards / Timeline v2

`SeasonCardV2` renders from `ArchivedSeason`, which a live `SeasonRecord` satisfies
structurally — the in-game history sheet and the Career Archive use the same card and cannot
drift. Hierarchy (D3): crest + club + league first, then the position-aware numbers (GK leads
with clean sheets; CB/FB show the rating cell), then honors/trophies as gold chips, then — behind
a tap — role, ability delta, minutes-of-schedule, and per-spell breakdown.

**Mid-season honesty (D2).** The header shows the route (two crests, מכבי חיפה ← באר שבע), the
expanded view lists each spell's own apps/goals/assists with the totals beneath, and the stats
are never all attributed to the closing club.

**Youth cards (D4)** are visually quieter (`scv2-youth`) and show the stage team name.

**Timeline v2 (D5).** `CareerJourney`: chronological season cards with an era break (crest +
club name) at every club change. The GamePage "הקריירה" sheet now renders it; the milestone-based
CareerTimeline (סיפור הקריירה) remains as the narrative view.

## Checkpoint E — Trophy Cabinet

The icon language, explicitly:

- **League Championship = Championship Plate** — a circular salver. Never a cup.
- **Domestic Cup = Cup** — the handled trophy silhouette.
- **Promotion = Promotion Badge** — an upward ribbon badge. Neither plate nor cup.
- Continental (generic) = laurel-and-star, a reserved slot that is *not* a UEFA design.
- Individual honors: golden boot / assist mark / star medal / keeper glove / rising star.

All original SVG in `src/components/honorIcons.tsx` — no OS emoji in prestige surfaces (E7),
which is the rendering path that once produced a red "הסמל". `trophyIconKind` is the single
mapping from typed trophies to icon families, so a league title can never quietly render as a
cup somewhere. Tests assert the mapping, scan the icon file for emoji codepoints and
red-dominant hex colours, and pin the retirement screen and cabinet to the SVG marks.

The cabinet derives from **typed trophies and stored honors only** — never table labels,
narrative text or achievement names. Groups: team silverware (plates before cups), promotions,
individual honors; each expands to its seasons and clubs.

## Checkpoint F — Achievements

A presentation layer over the stored achievements the engine already writes — no competing
system, nothing invented. Aggregated across archived careers with win counts. Locked/hidden
achievement silhouettes (F2, optional) were deliberately not built.

## Club Album

Built from `ArchivedClubSpell[]` — clubs actually **played for**, in career order. A returned-to
club is one entry with spells counted (Scenario L: Maccabi → Dortmund → Napoli → Maccabi is
three album entries, Maccabi at ×2). Crest, country, seasons, appearances, and chips for תואר /
קפטן / חזרת. No rewards, no bonuses, no "collect all 200" (F4). "Encountered" clubs are not
tracked (F5) — played-for is the album.

## Checkpoint G — Retirement v2

Kept what v0.6.2 got right — the hero, the two greatness axes (קריירה עולמית / מורשת מכבי) and
only two, no visible Legend Score, gold-not-red prestige. Added:

- **תארים אישיים (G5):** per-type counts with the SVG honor marks and the leagues they were won in.
- The trophy summary now renders **SVG plate/cup marks** instead of the emoji table.
- **Poster export (H)** buttons.
- **חדר הגביעים** entry, telling the player the career is already saved — which it is: the
  archive write is idempotent and happened at the moment of retirement.

## Checkpoint H — Share Poster

Canvas-drawn in the app from the archived snapshot — no server, no html2canvas, no new
dependency. 9:16 story and 1:1 square; PNG download. Content hierarchy: wordmark → name →
position/years → the two axes → the club route in crests (real assets with the same generated
shield fallback the app uses, so a broken image is impossible) → silverware counts drawn beside
the correct marks (plate/cup/promotion, in miniature) → top honors → position-aware totals (GK
leads clean sheets; CB/FB lead seasons + combined contribution) → the legacy title.

Verified mechanically: a gallery scene renders the 9:16 poster in headless Chrome and reports
`data-poster="ready"` — the canvas pipeline, crest loading and fallback all execute in a real
browser engine.

## Checkpoint I — Visual / Game Feel

Not a redesign. The gameplay decision surface is untouched; the meta layer lives behind the
welcome screen and the retirement screen, so no meta UI pushes the active event down (I2).
Crests now carry the archive cards, the journey, the album, the route line, and the poster
(I4). New text sizes hold the project's 11px floor — density by hierarchy, not by shrinking
(I1). The honors reveal is a static gold card: prestige without casino effects, trivially
respecting reduced motion (I7).

## Mobile Audit

`scripts/overflowAudit.mjs` (headless Chrome, the page measuring itself) at
320/360/390/412/430px over the new and adjacent scenes:

```
scene        320  360  390  412  430
cabinet       0    0    0    0    0
album         0    0    0    0    0
journey       0    0    0    0    0
retirement    0    0    0    0    0
season        0    0    0    0    0
timeline      0    0    0    0    0
```

Zero overflowing elements everywhere; content-class canaries confirm the scenes actually
rendered.

## Accessibility

RTL throughout; every icon `aria-hidden` with the award type always in adjacent text — never
communicated by shape or colour alone; tabs use `aria-pressed`; interactive rows are real
buttons with ≥44px targets; new text ≥11px; delete/reset are two-step confirmations.

## Performance

Meta screens render from a parsed archive held in state (one localStorage read on mount).
Crests remain lazy `<img>`s in fixed boxes with drawn fallbacks. 100-career archive parses in
~5ms; no virtualization needed at that scale, and none was added. No crest preloading.

## Controlled Scenarios A–O

| # | scenario | result |
| --- | --- | --- |
| A | one-club season → one segment, competition split, exact reconciliation | ✅ |
| B | mid-season transfer → two segments, goals stay with their spell | ✅ |
| C | strong total, stronger simulated rival → no crown (both outcomes proven over seeds) | ✅ |
| D | field beaten → honor stored, with the league stat it was won with | ✅ |
| E | dominant GK season → שוער העונה winnable, שחקן העונה too (21.6% of GK careers) | ✅ |
| F | excellent CB season → שחקן העונה possible without goals | ✅ |
| G | 25 league + 8 cup goals → judged on 25; the same field with 33 league goals wins | ✅ |
| H | league champion → championship **plate**, never a cup | ✅ |
| I | cup winner → **cup** icon | ✅ |
| J | retire → exactly one archive entry; reopen → still one | ✅ |
| K | three careers → all visible, bests correct, no contamination | ✅ |
| L | Maccabi–Dortmund–Napoli–Maccabi → three unique album clubs, Maccabi ×2 spells | ✅ |
| M | retirement shows two axes only, no Legend Score, no red prestige | ✅ (held from v0.6.2 + icon tests) |
| N | 9:16 poster renders in headless Chrome, `data-poster="ready"` | ✅ |
| O | v0.6.x save loads; legacy seasons viewable; new segments begin at next settlement | ✅ |

## 50k+ Simulation

50,000 careers, balanced policy. Determinism holds — the property that mattered most, since v0.7
added seeded award fields beside the live rng:

```
same seed reproduces career      PASS
different seeds diverge          PASS
distinct endings reached           13
critical integrity violations       0   (6,000-career audit, 155,099 seasons)
segment reconciliation              0
competition reconciliation          0
academy fixture mismatches          0
save migration failures             0
```

The audit run includes the three new v0.7 integrity codes plus `honor_without_season`. One real
defect was caught by the population tests before shipping: a season with zero appearances but an
event-credited goal made the appearance-weighted apportioning drop the goal from the competition
lines. Fixed (zero-appearance segments apportion by fixture weights) and the suite re-run green.

## Archive Stress Test

See Checkpoint C: 100 careers = 1.57 MB (30.7% of budget), parse ~5ms. Pass.

## Regression Metrics

```
                              v0.6.5.3   v0.7
reached Maccabi senior team     63.9%     63.9%
played abroad                   33.2%     33.2%
returned to Maccabi             21.3%     21.3%
had a loan spell                31.8%     31.8%
avg Legend Score                 41.8      41.8
median Legend Score              34.0      34.0
avg peak ability                 80.9      80.9
avg Maccabi appearances         132.6     132.6
mean retirement age              34.9      34.9
```

Identical to the last decimal, which is the design working rather than luck: segments are built
from numbers the engine already produced, the competition split is rng-free, and the award
fields are seeded outside the live stream — v0.7 added an entire meta layer while consuming
zero draws from any career's rng.

## Known Limitations

- **Old careers have reduced honors reconstruction** — legacy seasons carry a `combined` line
  and are excluded from retroactive league awards rather than approximated.
- The competition split for new seasons is a stored deterministic apportioning of the fixture
  basis, not per-match truth — the engine does not simulate individual matches, and the split
  says so in its design rather than pretending otherwise.
- Ligat Ha'Al playoff modelling remains the simplified 7-fixture allowance (v0.6.5.3 limitation,
  unchanged); stored history is immune to its future correction.
- The optional B11 late-season scorer race, F2 locked-achievement silhouettes, and rarity labels
  were deliberately not built.
- Poster export uses PNG download; native share-sheet integration was not added.

## Deferred to v0.8

**European club competitions are NOT implemented in v0.7.** No Champions League, Europa League,
Conference League, qualification, brackets, or UEFA artwork. The existing continental fixture
allowance is stored as `continental_generic` and never presented under a competition name.
Reserved for **v0.8 — European Competitions**: qualification, competition progression, European
trophies (the `continental` icon slot already exists), and competition-specific stats/honors on
top of the CompetitionLine architecture this version shipped.

---

*מכביסט — מהילדים לאגדה*

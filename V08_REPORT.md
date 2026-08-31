# Maccabist v0.8 — Europe

## Executive Summary

v0.8 replaces the game's last rolled trophy with a real European club competition ecosystem.
Domestic football now produces UEFA qualification; a configurable qualification graph walks
clubs through qualifying and drops losers down Champions League → Europa League → Conference
League; three 36-club league phases feed seeded knockouts; and a UEFA trophy exists **only** as
the conclusion of that simulated journey. The bug this release structurally prevents is the one
the brief names: before v0.8, `seasonEngine` literally rolled
`rng.chance(europeChance)` and then a 20% coin for "Champions League" — a club that never
entered Europe could be handed its biggest prize. That code is gone; the invariant
`clubEuropeanTrophy ⇒ competitionFinalWinner === clubId` is enforced by structure and asserted
by tests and by a Monte Carlo audit.

The journey is the feature, and it is preserved end to end: entered UCL qualifying as champion →
lost in round two → dropped to Europa qualifying → lost again → landed in the Conference League
→ finished 12th in the league phase → won the knockout play-off → out in the Round of 16. That
story is stored on the season record, told in the season summary, shown during the season, kept
in the archive, and countable on the poster.

## A. Architecture

Three layers, mirroring how the game already separates truth:

- **Data** (`src/data/uefa.ts`): competitions, the qualification graph, per-association access
  rules, titleholder routes, and the European field (clubs from unmodeled associations, as
  competition scenery). All policy is data; gameplay code contains no `if (country === ...)`.
- **Engine** (`src/game/uefaEngine.ts`): entry resolution (pure slot algorithm over explicit
  domestic results), the season simulation (qualifying → league phases → knockouts → finals),
  and the rolling coefficient model. Deterministic from `(career seed, season)` on an isolated
  rng stream.
- **Integration**: Europe is projected at preseason inside `openWorldSeason`, exactly where the
  league projection and the cup already live — one committed answer everything downstream reads.
  Next season's entries are resolved at settlement, while the settled tables still exist.

Timing follows the football calendar: qualifying is summer football, so the preseason Europe
card shows the qualifying story already resolved (with each defeat's destination); the league
phase and knockouts resolve into the season summary.

## B. Domestic Qualification Rules

`ACCESS_RULES` configures every association explicitly — **there is no generic fallback**, and a
test proves an unlisted association sends nobody. Israel is the brief's required baseline,
stated in data: champion → `ucl_q1`, cup winner → `uel_q1`, 2nd → `uecl_q2`, 3rd → `uecl_q1`.
Elite associations (England, Spain, Italy, Germany) enter league phases directly; strong
associations (Portugal, Netherlands, Belgium) split champion-direct / late qualifying; mid
associations (Austria, Greece, Cyprus) enter mid-qualifying.

The data model deliberately separates *"qualified for Champions League qualifying"* from
*"qualified for the league phase"*: `entry` is either a graph node or `league_phase`, and the UI
renders מוקדמות ליגת האלופות for the former — never העפלה לליגת האלופות.

**Cup winners** (§7): the player's own cup run is authoritative where it reaches a final (a won
final names the player's club; a lost final names the opponent). Elsewhere the winner is a
deterministic quality-weighted seeded pick from the association's top eight — the "just enough"
extension: a real season result feeding qualification, without building an invisible knockout
gameplay system.

**Slot resolution** is a pure algorithm (`resolveEntriesFromResults`): titleholders → champion →
cup → positions; duplicates collapse to the best route (titleholder > champion > cup > position,
then higher competition); every vacated slot passes down the table as a promotion *chain* — the
runner-up moves up into a vacated Europa slot and the lowest slot extends one place, as real
domestic redistribution works. One club, one route, proven across the Israel matrix (Cases A–E,
plus titleholder overlap).

## C. UEFA Qualification Graph

`QUALIFYING_GRAPH` is a routing table: every node declares `winTo` **and** `loseTo`. The entire
drop-down system is auditable on one screen, and tests walk it mechanically: no dangling
destinations, losers never climb tiers, play-off losers parachute into the lower league phase.

```
ucl_q1 →W ucl_q2   →L uecl_q2
ucl_q2 →W ucl_q3   →L uel_q3
ucl_q3 →W ucl_po   →L uel_po
ucl_po →W UCL LP   →L UEL LP
uel_q1 →W uel_q2   →L uecl_q2
uel_q2 →W uel_q3   →L uecl_q3
uel_q3 →W uel_po   →L uecl_po
uel_po →W UEL LP   →L UECL LP
uecl_q1..po →W …   →L out
```

The round matters — losing late is worth more than losing early, which is the incentive the real
access list creates.

## D. Champions / Europa / Conference Formats

The post-2024 "Swiss model" per the official 2024/25 UEFA competition regulations, configured as
this world's format (the game runs decades in the future; nothing embeds a calendar year):

- 36-club league phase per competition; 8 matches in UCL/UEL, 6 in UECL.
- League-phase draw: circle method over the coefficient-ordered field — 8 (6) perfect-matching
  rounds, so every club meets exactly 8 (6) **distinct** opponents with balanced home/away.
  That is the constraint the real draw exists to satisfy, without its television ceremony.
- Standings: full 36-row table per competition (the player's position derives from the same
  table as everyone's); tiebreak points → GD → GF → coefficient (documented simplification).
- Positions 1–8 → Round of 16 directly; 9–24 → knockout play-off (9v24, 10v23…); 25–36 out.
- Two-legged ties everywhere except the single-match final. **No away-goals rule**: level
  aggregates go to extra time, then penalties, mildly strength-weighted.

League phases are completed to exactly 36 via the access-list depth pool: next-best-placed clubs
of the strongest associations by coefficient, resolved at settlement from the same tables as the
entries (persisted as `nextStandby`, because those tables no longer exist by the next
preseason).

## E. Drop-Down Logic

Implemented as graph edges, not code paths (§C above). The canonical journey — Israeli champion
→ UCL qualifying → eliminated → Europa qualifying → eliminated → Conference League → league
phase → knockouts — exists in the wild: the story test scans seeds for it and then asserts every
transition, and the Monte Carlo audit counts double-drop-down journeys (~3% of European
seasons). The `dropped` step records from-competition, to-competition and the entry stage, and
the UI renders each defeat's destination — the drama a qualifier actually has.

## F. Coefficients & Seeding

`EuropeState.coefficients` holds one rolling number per club and per association: decayed ×0.8
each season and fed by that season's points (qualifying wins, league-phase results, reaching a
phase, knockout rounds, +5 for a trophy). Exponential decay at 0.8 approximates the five-season
window — a result retains ~33% of its weight five seasons on — with one number instead of five
buckets (documented simplification). Associations move by their entrants' average points.

Used for: qualifying seeding (strongest v weakest pairing, as seeded draws produce), the
league-phase draw order, standings tiebreak, and the access-list depth fill. First-time
qualifiers seed from club quality (`max(4, (quality−55)×1.1)`) — dangerous but disadvantaged —
and earned results move them from there. Nothing freezes 2026 reputation: after a simulated
career, England sits around 64, Israel around 34, minnows near zero — ordered by what happened
in that world's Europe, not by a hardcoded table.

## G. Match & Competition Simulation

European strength = world club quality + a bounded coefficient bonus (up to +8) — the same
world, one earned axis on top, not an unrelated system. Legs are bounded Poisson-style goal
draws around strength-driven means with home advantage. Everything runs on
`uefaRng(seed, season, salt)` — isolated from the live career stream, so adding Europe consumed
**zero** draws from any existing career decision.

Every entrant walks the same graph and the same standings; what differs is *recording* — full
journey steps for the player's club and Maccabi, compact results and coefficient points for the
background field. The whole European season (~700 matches) costs a few ms; a full career went
from ~50ms to ~77ms in simulation.

The **European field** (`EUROPEAN_FIELD`, ~50 clubs) provides scenery from unmodeled
associations — PSG, Celtic, Galatasaray, Ludogorets, Sheriff — so qualifying rounds and league
phases hold a believable coherent field. They are competition entities only: not signable, never
granted a modeled club's slot, and never counted as titleholders.

## H. Player Career Integration

- Europe belongs to the **club**. Entries are resolved per club at settlement; a player who
  transfers in the summer joins the new club's European situation (the preseason simulation
  records the journey of the club he is at when the season opens). Mid-season transfers exist
  only for academy players, who have no Europe.
- **Match counts** (§24): European matches are additional fixtures. `levelContext` now derives
  continental fixtures from the journey's real match count — a club with no journey has **zero**
  European fixtures. The pre-v0.8 quality-based allowance survives only for pre-v0.8 saves
  mid-season, until their next preseason.
- **Stats** (§24): the season's competition lines split league / cup / europe with the europe
  bucket sized by the journey's real matches. Domestic honors read the league line only —
  European goals cannot influence מלך השערים (unchanged v0.7 mechanism, retested). No UEFA
  individual awards were added (§25, deliberately).
- **Market** (§41): a live European entry adds a modest, bounded attractiveness bonus (UCL 40 >
  UEL 25 > UECL 14, all scaled by the existing small `europe` weight) on top of the static
  prior. No transfer rebalance.
- **Milestones** (§43): first European campaign, first league phase, each European final, each
  European trophy — deduped by id, majors marked.
- **Trophies**: `rollTrophies` reads the stored journey; the squad-player medal gate (minutes
  share) applies to European silverware exactly as it always has to the league and cup.

## I. UI / Visual Assets

- **EuropeCard** (play surface): the summer's story — entry (with reason: כאלופת ישראל /
  כמחזיקת הגביע / titleholder), each qualifying tie with legs, aggregate, extra-time/penalties
  note, each drop-down's destination, and the honest state of the autumn.
- **EuropeJourneySummary** (season summary + archive): the whole journey as story lines, ending
  in a standing, an exit, or a gold champion line.
- **Competition marks**: original SVGs in the game's language — UCL a crowned gold star in a
  champion's ring, UEL a silver orb on a rising arc, UECL a green hex badge. Visual hierarchy:
  Champions League reads as the top tier. **No UEFA artwork is included**: the official logos
  are trademarks whose redistribution terms could not be confirmed for an open repository, so
  per the brief's own fallback the asset layer (`data/competitionAssets.ts` +
  `getCompetitionAsset`) is the substitution point — drop a legitimately licensed file into
  `public/competitions/` and name it there, and every surface switches with no code change. The
  exact target assets are documented in that file.
- Trophy Room: the three UEFA trophies lead the cabinet hierarchy, above domestic silverware,
  each with its own mark. Legacy rolled trophies (`champions_league`, `european_run`) keep
  rendering for pre-v0.8 careers.
- Poster: European trophy count leads the silverware row with a drawn gold star-ring mark.
- Palette: green/white/black, gold for prestige. Never red.

## J. Trophy Room / Archive Integration

`SeasonRecord.europe` stores the journey at settlement — the same law as `teamGames`: a 2044
Conference League run stays a 2044 Conference League run whatever later versions do to the
format. The archive preserves it per season (with per-leg detail dropped as an archive-payload
decision: 26.5→24.7 KB per career measured at 100 archives, 48% of a 5 MB budget; the live
record keeps every leg). Season Card v2 shows a compact Europe line; the archive detail renders
the full journey; `maccabi.europeanRuns` counts the new trophy ids alongside the legacy ones.

## K. Backward Compatibility

- Fresh careers are born with the Europe shell (`emptyWorld` includes it), so
  `hydrateCareer(created) === created` still holds.
- Pre-v0.8 saves take one hydration branch that attaches the empty shell; their next preseason
  starts a real European season, with entries resolved from last season's tables. Mid-season
  old saves keep the legacy fixture allowance until that preseason.
- Old records have no `europe` field and render exactly as before; archives from v0.7 load
  unchanged; no localStorage invalidation, no schema bump (the field is additive).
- Tested: a career with the europe field stripped settles a season safely.

## L. Tests

```
1030 passed / 1030    (54 files)
```

1007 were green at the v0.7.1 baseline; the 23 new tests are all `tests/uefa.test.ts` —
1007 + 23 = 1030, nothing removed anywhere. The road to green is part of the record: the first full pass against v0.8 failed 3 tests — two `hydrateCareer` identity
expectations (fresh careers are now BORN with the Europe shell, so hydration touches only
genuinely old saves) and the away-and-back title pin, re-pinned from seed 11 to seed 48. That
pin's own comment documents two previous re-pins for the same cause; v0.8 is the third: real
continental fixture counts shift every seed's trajectory. No test was deleted; the obsolete
random-European-trophy behaviour had no dedicated test to replace.

New suite `tests/uefa.test.ts` (25 tests): graph closure and monotonic drop-downs, explicit
association listing (no silent fallback), Israel Cases A–E and H, titleholder routes and
overlap, 36-club league phases, winners-from-league-phase invariant, determinism, distinct
league-phase opponents and standings-driven knockouts, no away goals, UCL-loss routing (Case F),
the canonical UCL→UEL→UECL story test (Case G), the absurdity regression (a club with no entry
is *absent*, not improbable; a season with no journey wins nothing European; a won journey is
the only trophy source), and old-save settlement.

Changed existing tests, each with cause: the trophy-icon kind list gained the three UEFA kinds;
one hydration-identity expectation moved from "no europe field" to "explicitly stripped europe
field" (fresh careers now carry the shell); and the away-and-back title pin was re-pinned from
seed 11 to seed 48 — the third re-pin in its own documented history, for the third instance of
the same cause: real continental fixture counts shift every seed's trajectory. No test was
deleted; the obsolete random-European-trophy behaviour had no dedicated test to replace.

## M. Monte Carlo Audit

2,000 full careers (`npm run europe:metrics`), auditing every European season the world produced
— 19,656 player-club European campaigns and ~155,000 simulated competition-seasons of world
history:

```
INVARIANTS (must be zero)
  impossible-trophy violations        0
  malformed league phases             0

ISRAELI CAMPAIGNS (player-club seasons)
  entered UCL route                   3,680   (18.7% of European seasons)
  survived to UCL league phase        1,229   (33.4% of UCL entrants)
  ended in UEL league phase           4,237
  ended in UECL league phase          4,641
  reached any knockout stage          8,484   (43.2%)
  reached a final                       762
  won a European trophy                 326   (43% of finals)
  double drop-down journeys (→→)        606   (3.1%)

UCL WINNERS BY CLUB STRENGTH TIER
  elite (q84+)      50,735   98.0%
  strong (76-83)     1,004    1.9%
  mid (68-75)            7    0.0%
  underdog (<68)         0    0.0%
```

Reading it against the brief's realism demands: the trophy invariant holds at zero across the
whole corpus; 98% of Champions League winners are elite clubs — matching the real competition's
history — yet a mid-tier winner exists **seven times in ~51,700 UCL seasons**: extraordinary,
compounded, and possible, which is exactly the required shape. Nothing is scripted: Manchester
City leads the winner table in this world's history, not a copied real-world honours list. The
player-club figures skew strong because the player is usually at Maccabi Haifa, whose
coefficient grows across a career — the world-evolution lever working as designed. Top
Conference winners include big-league clubs that fell in via their 6th-place route, which is the
access list behaving realistically.

## N. Regression Comparison

50,000 balanced careers against the v0.7.1 baseline:

```
                              v0.7.1    v0.8.0
reached Maccabi senior team    63.9%     67.5%
played abroad                  33.2%     32.5%
returned to Maccabi            21.3%     20.9%
had a loan spell               31.8%     31.2%
avg Legend Score                41.8      42.0
median Legend Score             34.0      35.0
avg peak ability                80.9      80.9
avg Maccabi appearances        132.6     157.9
mean retirement age             34.9      34.9
same seed reproduces career     PASS      PASS
different seeds diverge         PASS      PASS
```

Two figures moved beyond noise, and both are the feature, not drift:

- **Average Maccabi appearances 132.6 → 157.9.** Before v0.8, Maccabi carried a fixed 8-match
  continental allowance whether or not it had qualified for anything. Now a Maccabi that
  qualifies for Europe and survives into a league phase plays a REAL campaign — qualifying legs
  plus 6–8 league-phase matches plus knockouts — and Maccabi qualifies most seasons. More real
  fixtures, more appearances. The old number was the fiction.
- **Reached Maccabi seniors 63.9% → 67.5%.** Downstream of the same mechanism: longer seasons
  at the club mean more chances for a fringe player to make a first appearance.

Everything that measures career SHAPE — abroad rate, returns, loans, peak ability, retirement
age, Legend Score — held within noise, and both determinism checks pass. Per-seed trajectories
shifted (the re-pinned test in §L is the visible instance), which the brief explicitly accepts:
outcomes may legitimately change because clubs can now actually play European football.

## O. Known Simplifications

Documented at the site of each, summarized here:

- Access bands are configured data, not a live recomputation of the official access list;
  association coefficients evolve and feed seeding/fill, but entry rounds per association are
  static config (changeable in one file).
- The coefficient window is exponential decay (×0.8), not five explicit buckets.
- Qualifying draws pair strongest-v-weakest by coefficient; league-phase draw is the circle
  method over coefficient order rather than televised pots; tiebreaks end at coefficient.
- Background domestic tables (leagues the world isn't watching) are deterministic seeded
  rankings; the player's league and Maccabi's league use their real settled tables. Cup winners
  outside the player's run are seeded quality-weighted picks.
- A mid-season mover's European matches split across spells proportionally (the engine does not
  know which half a tie fell in).
- Odd qualifying fields give the best-ranked club a bye.
- The player's per-match influence on European ties is carried through club quality, not
  simulated per tie.

## P. Deferred to v0.9

- UEFA individual awards (competition top scorer etc.) — the CompetitionLine architecture is
  ready for them.
- A televised draw/race UI for the league phase; knockout bracket visualization.
- Super Cup; club world competitions; youth internationals — all out of scope by brief.
- Official competition artwork, pending licensing — the substitution layer is in place.

---

*מכביסט — מהילדים לאגדה. הדרך לאירופה עוברת בליגה.*

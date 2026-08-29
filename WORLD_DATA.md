# World data — snapshot, completeness and architecture

**`WORLD_DATA_VERSION = '2026.1'`** — the 2025/26 European season, the most recent whose full
league memberships could be verified end to end. The game's fictional 2030s careers play out
against this stylised present; the snapshot does not track real-world seasons and there is no
live data service.

## The rule

**No user-visible league may contain a placeholder club, and nothing at runtime may invent
one.** v0.6.2 and earlier padded short divisions with generated "קבוצה N" rows in
`leagueEngine.membership()`; that generator is deleted, and `tests/worldData.test.ts` (run via
`npm run world:validate`) fails the build on any league whose membership is not exactly its
declared size.

## Architecture

| layer | file | holds |
|---|---|---|
| Leagues | `src/data/leagues.ts` | identity, quality/prestige/visibility, promotion/relegation paths |
| Shapes | `src/data/leagueShape.ts` | division size, Europe/relegation/promotion places |
| Modelled clubs | `src/data/clubs.ts` | the 35 `Club` records a career can actually join |
| **Table clubs** | `src/data/worldClubs.ts` | the ~150 named clubs that complete every division |
| Visual identity | `src/data/clubVisuals.ts` + `src/data/clubCrests.generated.ts` | colours, initials, imported crest assets |

A **TableClub** is a named, identified division member — id, Hebrew name, quality, colours — that
appears in league tables, as a match opponent and as a cup finalist. It is deliberately **not** a
`Club`: it never signs the player, never makes an offer, and never enters `ALL_CLUBS`.

### Why transfer probabilities cannot move

The market's candidate pool is `ALL_CLUBS`, which v0.6.3 did not touch. Market probability is
decided first (per-career interest weights), destination chosen inside that pool second — so
adding ~150 table clubs changes nothing about how often a player moves or where the market can
send him. Pinned by two tests: one runs real careers and asserts no table club is ever signed,
one statically asserts `transferEngine`/`marketEngine` do not import `worldClubs`.

### The dynamic case

Only Israeli leagues declare `relegatesTo`/`promotesTo`, and the world records division changes
only for modelled clubs — so only an Israeli division can ever be short at runtime. The gap is
filled from `RESERVE_CLUBS_BY_LEAGUE`: real named clubs that belong to no division's main list
(so a reserve never sits in two tables at once). If reserves run out, `membership()` throws:
loud beats invented.

## League coverage (2026.1)

| country | league | size | modelled | table clubs |
|---|---|---|---|---|
| ישראל | ליגת העל | 14 | 10 | 4 |
| ישראל | הליגה הלאומית | 16 | 10 | 6 |
| בלגיה | be_pro | 16 | 1 | 15 |
| הולנד | nl_eredivisie | 18 | 1 | 17 |
| אוסטריה | at_bundesliga | 12 | 1 | 11 |
| יוון | gr_superleague | 14 | 1 | 13 |
| קפריסין | cy_first | 12 | 0 | 12 |
| פורטוגל | pt_primeira | 18 | 1 | 17 |
| גרמניה | de_bundesliga | 18 | 2 | 16 |
| ספרד | es_laliga | 20 | 2 | 18 |
| איטליה | it_seriea | 20 | 2 | 18 |
| אנגליה | en_premier | 20 | 2 | 18 |

`euro_elite` / `euro_strong` are legacy career-quality buckets kept only as `defaultLeagueFor`'s
fallback for a hypothetical club in an unmapped country. They have **no shape and no table**, and
a test asserts every modelled club's country maps to a real league — so their old
"יריבה אירופית" rows are unreachable.

## Corrections made by the 2026.1 snapshot

- **ליגת העל held 15 names for 14 places** (a comment said nine modelled clubs; ten map there)
  and silently sliced off the weakest real club every season.
- **il_leumit listed "מכבי יפו"** alongside the modelled מכבי קביליו יפו — one real club, two
  table rows.
- **Vitesse** (Eredivisie) and **Boavista** (Primeira) are not top-flight members in the
  snapshot season and were replaced by clubs that are.

## Save compatibility

Table clubs are derived-only: tables are rebuilt each season from `tableSeed`, and no filler id
was ever written into a save (season history, trophies and cup finalists referenced `ALL_CLUBS`
only before v0.6.3). So there is **no placeholder id to migrate** — an old save simply renders
its current tables against the complete dataset from its next drawn table onward, and its stored
history (which never contained placeholders) is untouched. No falsified history, no alias table
needed; `filler_*` ids appear nowhere in persisted state, which `tests/worldData.test.ts` keeps
true by banning the scheme.

## Adding a club or a league

1. Add the club to its league's list in `worldClubs.ts` (or a `Club` record if it should be a
   career destination).
2. `npm run world:validate` — it fails until the division's count is exact again.
3. Optionally seed `scripts/crestSeeds.ts` and run `npm run crests:missing`.

No component changes: every surface resolves identity through `clubVisual`/`ClubCrest` and names
through `clubDisplayName`.

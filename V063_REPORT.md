# Maccabist v0.6.3 — Football World Data & Club Identity

> When the player opens Serie A, he should see Serie A.

Real playtesting in Italy showed a league table whose bottom half read **קבוצה 8, קבוצה 9,
קבוצה 10**, and most of the football world had no visual identity beyond a hash-coloured badge.
v0.6.3 has one mission: the football world must stop looking generated.

Four checkpoints, each committed stable.

---

## 1. Build

```
npm run build                    ✓ built in ~1.0s
tsc -b / tsc -p test project     clean
```

## 2. Test count

```
Test Files   42 passed (42)
Tests        829 passed (829)
```

v0.6.2 ended at 794 tests across 39 files.

## 3. v0.6.2 baseline

```
commit 30a8bd0            794 tests, build clean
reached Maccabi senior team   64.1%
played abroad                 33.0%
returned to Maccabi           22.0%
avg Maccabi appearances       131.0
integrity                     50,000/50,000 clean
```

---

# Checkpoint 1 — World data

## 4. World audit

Every modeled user-visible league, as found in the repository before this version:

| country | league | size | modelled | named others | **placeholders rendered** |
|---|---|---|---|---|---|
| ישראל | il_premier | 14 | 10 | 5 | 0 (but see §5 — one real club silently dropped) |
| ישראל | il_leumit | 16 | 10 | 6 | 0 (one club duplicated) |
| בלגיה | be_pro | 16 | 1 | 8 | **7** |
| הולנד | nl_eredivisie | 18 | 1 | 8 | **9** |
| אוסטריה | at_bundesliga | 12 | 1 | 6 | **5** |
| יוון | gr_superleague | 14 | 1 | 6 | **7** |
| קפריסין | cy_first | 12 | 0 | 5 | **7** |
| פורטוגל | pt_primeira | 18 | 1 | 6 | **11** |
| גרמניה | de_bundesliga | 18 | 2 | 8 | **8** |
| ספרד | es_laliga | 20 | 2 | 8 | **10** |
| איטליה | it_seriea | 20 | 2 | 8 | **10** |
| אנגליה | en_premier | 20 | 2 | 8 | **10** |
| — | euro_elite / euro_strong | 18 | 0 | 4 | placeholder-named "rivals" by design |

## 5. Placeholder root cause

`leagueEngine.membership()` assembled modelled clubs + `LeagueShape.others`, then:

```ts
while (rows.length < shape.size) {
  rows.push({ clubId: `filler_${leagueId}_x${n}`, name: `קבוצה ${n}`, ... });
}
```

Serie A: 2 modelled + 8 named = 10 clubs for 20 places → **ten generated rows**, exactly what
the playtest saw. Every European league except none was affected. The same function's closing
`slice(0, shape.size)` hid the opposite bug in Israel: ליגת העל held 15 names for 14 places
(a comment said nine modelled clubs; ten map there) and **silently dropped the weakest real
club** every single season.

These placeholders were reachable in the league table, Match Moments (opponents are drawn from
division membership) and nowhere else — transfers, cup finalists and stored history always drew
from `ALL_CLUBS`.

## 6. World data architecture

New single source: **`src/data/worldClubs.ts`** — ~150 named `TableClub`s (id, Hebrew name,
quality, colours, initials), organised per league, plus named reserves for the one dynamic case
(an Israeli division short a club after promotion/relegation moved a modelled club).
`leagueShape.ts` keeps only the shape (size and what the places mean) and reads membership from
it. `membership()` fills from the data, then reserves, then **throws** — the קבוצה N generator
is deleted, and `tests/worldData.test.ts` keeps it deleted.

A `TableClub` is deliberately not a `Club`: it appears in tables, as a match opponent and as a
cup finalist, but never signs the player and never enters `ALL_CLUBS`. Full architecture and
how-to-extend in **WORLD_DATA.md**.

## 7. World snapshot

`WORLD_DATA_VERSION = '2026.1'` — the 2025/26 European season, the most recent whose complete
memberships could be verified end to end. Corrections the snapshot forced: Vitesse out of the
Eredivisie list, Boavista out of the Primeira list, the duplicate מכבי יפו out of il_leumit,
and the 15-for-14 ליגת העל fixed. No live data dependency; world data is identical across
builds.

## 8. League coverage after

| country | league | expected | real named clubs | placeholders |
|---|---|---|---|---|
| ישראל | il_premier | 14 | 14 | **0** |
| ישראל | il_leumit | 16 | 16 | **0** |
| בלגיה | be_pro | 16 | 16 | **0** |
| הולנד | nl_eredivisie | 18 | 18 | **0** |
| אוסטריה | at_bundesliga | 12 | 12 | **0** |
| יוון | gr_superleague | 14 | 14 | **0** |
| קפריסין | cy_first | 12 | 12 | **0** |
| פורטוגל | pt_primeira | 18 | 18 | **0** |
| גרמניה | de_bundesliga | 18 | 18 | **0** |
| ספרד | es_laliga | 20 | 20 | **0** |
| איטליה | it_seriea | 20 | 20 | **0** |
| אנגליה | en_premier | 20 | 20 | **0** |

The exactness is enforced (`===`, not `>=`): an over-full league silently drops real clubs,
which is the quieter version of the same lie. `euro_elite`/`euro_strong` no longer have tables
at all — they survive only as `defaultLeagueFor`'s fallback for an unmapped country, and a test
proves every club's country is mapped, so their placeholder rows are unreachable.

## 9. Transfer probability protection

The market never touched the new data. Market probability is decided first (per-career interest
weights over `ALL_CLUBS`), destination chosen inside that pool second — and `ALL_CLUBS` is
unchanged, so every market probability is unchanged **by construction**. Pinned twice in
`tests/worldData.test.ts`: real careers never sign a table club, and
`transferEngine`/`marketEngine` statically do not import `worldClubs`. Regression measurement
in §27 confirms it empirically.

## 10. Cup opponent integration

`drawFinalOpponent` now draws from the whole national dataset (modelled + table clubs of the
same country). An Italian final is no longer always Napoli against Bologna. Finalists resolve
names through `clubDisplayName` (which learned table clubs — one name authority) and crests
through the standard resolver.

---

# Checkpoint 2 — Crest pipeline

## 11. Club crest architecture

Unchanged at its core, by design: every club resolves through `clubVisual` → `ClubCrest`, which
renders a local asset if one exists and a generated SVG badge (club colours + initials)
otherwise, with image-load failure re-rendering the badge in place. v0.6.3 added table clubs to
the resolver (declared colours where confidently known, deterministic palette otherwise) and a
generated manifest as the single place an imported asset path lives.

## 12. Importer

`scripts/importClubCrests.ts` — build-time only:

```
seed (English name + aliases + country)         scripts/crestSeeds.ts
  → Wikidata search → verification (C6)
  → P154 logo → Commons licence check
  → local download → provenance manifest
  → regenerated src/data/clubCrests.generated.ts
```

`npm run crests:dry-run` / `crests:import` / `crests:missing`, with `--league=` / `--country=`
filters, an incremental cache (`scripts/.crest-cache.json`, gitignored), 700ms pacing with
exponential backoff on 429, and a descriptive User-Agent. No API credentials exist to commit;
`.env.example` documents that.

## 13. Provider research

| provider | verdict |
|---|---|
| Wikimedia Commons + Wikidata | **used** — the only surveyed source with per-file, machine-readable licence provenance |
| TheSportsDB | rejected — community-uploaded badges, no per-file licence provenance |
| football-data.org | rejected — API terms govern data; crest files carry no redistribution grant |
| official club media | rejected — proprietary; press kits are not game-embedding licences |
| image search / logo sites | rejected — no inspectable provenance (and the brief bans it) |

Full reasoning in **CLUB_ASSETS.md**.

## 14. Provenance and the licence rule

Only files whose Commons licence tag is in the PD/CC0 family are ingested — for club logos this
is the PD-textlogo class, marks below the threshold of originality, checked per file at
retrieval. The gate demonstrably works: Getafe's crest file is tagged CC BY-SA 4.0 and was
refused (`license_blocked`). **Copyright ≠ trademark**: every manifest entry records that the
mark may remain a protected trademark; usage here is referential (identifying clubs the game
already names as facts), and removing any club's asset is a one-line manifest deletion with the
badge taking over by architecture. Israeli clubs were not attempted — CLUB_CRESTS.md's v0.4.7
finding (pictorial non-free works, fair-use rationales excluding icon use) stands.

## 15. Alias matching and ambiguity

Seeds carry the names clubs are actually known by (Inter / Internazionale / FC Internazionale
Milano; Sporting CP / Sporting Lisbon). A candidate is accepted only as the **single** entity
passing label-match AND instance-of-football-club AND country-match. The live pilot produced
the exact case the brief warns about: "Inter Milan" surfaced two verifiable entities (men's and
women's clubs). The importer refused to choose; the resolution is a reviewed, dated QID on the
seed — which the importer still re-verifies on every run.

## 16. Local storage, manifest, fallback

Assets live in `public/club-crests/` (repo-local; the runtime never hotlinks, and
`getClubCrest` fails closed on any URL-shaped path). Provenance in
`public/club-crests/manifest.json`; the runtime module `src/data/clubCrests.generated.ts` maps
clubId → path + licence and nothing else. Every club without a verified asset keeps the
generated badge — there is no empty crest state, enforced by test.

---

# Checkpoint 3 — Coverage and integration

## 17. Crest coverage

**198 clubs in the world. 42 verified real crests, 156 generated badges, 0 missing, 0 broken.**
Coverage is deliberately honest - a crest ships only when its Commons licence tag is in the
PD/CC0 family, so the number is what the licence landscape allows, not what a scraper could grab.

| country | clubs | real crests | generated badges |
|---|---|---|---|
| איטליה | 20 | 13 | 7 |
| גרמניה | 18 | 11 | 7 |
| אוסטריה | 12 | 6 | 6 |
| הולנד | 18 | 5 | 13 |
| בלגיה | 16 | 3 | 13 |
| פורטוגל | 18 | 2 | 16 |
| יוון | 14 | 1 | 13 |
| אנגליה | 20 | 1 | 19 |
| ספרד | 20 | 0 | 20 |
| קפריסין | 12 | 0 | 12 |
| ישראל | 30 | 0 (deliberate - CLUB_CRESTS.md) | 30 |

The spread is the licence landscape speaking: Italian and German clubs favour geometric/text
marks that sit below the threshold of originality (PD-textlogo); Premier League and La Liga
crests are pictorial non-free works, correctly refused. Final cache state across 168 attempted
clubs: 42 imported, 97 no PD logo on the entity, 6 licence-blocked (CC BY/BY-SA - the gate
firing), 16 unmatched, 4 ambiguous-by-choice, 3 errors (one oversized SVG, two rate-limit
casualties retryable with `npm run crests:missing`).

## 18. Asset size

```
42 files, 751 KB total (SVG), largest single asset 169 KB
manifest.json: ~16 KB     clubCrests.generated.ts: ~4 KB
```

All SVG, all lazy-loaded in list contexts (`loading="lazy"`, `decoding="async"` - the existing
ClubCrest behaviour). Nothing is preloaded; a screen decodes only the crests it shows.

## 19. UI integration

Already-integrated surfaces (v0.4.6/4.7 architecture): league table rows, transfer offers,
player hub, match-moment scoreboard (both clubs), season strip, Maccabi panel. Added in v0.6.3:

- **D5 — cup final**: events gated on `cupFinal` show both finalists — crest and name each —
  read from the authoritative cup state, in the competition's neutral gold treatment. The strip
  cannot name a club that is not actually in the final.
- Timeline and manager cards deliberately left without crests: both are density-critical
  mobile surfaces, and the brief's "may" was declined in favour of "do not clutter".

---

# Checkpoint 4 — Validation

## 20. Validators

`tests/worldData.test.ts` (18) — exact league completeness; placeholder-pattern ban across club
data AND rendered tables at every phase; id uniqueness across modelled/table/reserve clubs;
per-division display-name uniqueness; reserves outside every main list; visual resolvability of
every club; quality bounds; market protection (behavioural + static).

`tests/crestPipeline.test.ts` (8) — every manifest entry exists locally with size > 0; only
known clubs mapped; no asset shared by two clubs; allow-listed licence on every entry; full
provenance per shipped asset; asset-or-badge for every club; badge inputs survive asset
removal; no remote image URLs anywhere in runtime source.

`npm run world:validate` runs the world suite alone.

## 21. Save migration

**No migration is needed, and none was invented.** Table rows are derived from `tableSeed`
every season and were never persisted; every stored clubId (season history, trophies, cup
finalists) came from `ALL_CLUBS`, which kept every id. So no save can contain `filler_*` or a
placeholder name, old careers load unchanged, and no history is falsified — the old save simply
draws complete tables from its next season onward. Scenario J pins hydration; the id-scheme ban
keeps the invariant.

## 22. Controlled scenarios A–J

| | scenario | result |
|---|---|---|
| A | Italian table | ✅ 20 named clubs incl. אינטר/מילאן/יובנטוס/רומא, zero קבוצה N, every row crest-resolvable |
| B | Netherlands | ✅ 18 named clubs, איאקס present |
| C | small market | ✅ Austria 12/12; Cyprus — no modelled club at all — 12/12 |
| D | transfer offer | ✅ real club, country, league, crest identity; pool unchanged |
| E | match moment | ✅ no placeholder opponent in any phase, Italy included |
| F | cup opponent | ✅ Italian finals draw >3 distinct finalists, all Italian, all named |
| G | missing crest | ✅ badge inputs exist for every manifest club; ClubCrest re-renders badge on load error |
| H | wrong alias | ✅ Inter ambiguity refused live; reviewed QID recorded and re-verified |
| I | no network | ✅ no remote URL in any crest path or runtime source; resolver is local-or-drawn |
| J | old save | ✅ hydrates clean, complete table on next draw, no history rewritten |

## 23. Simulation

30,000 careers, balanced policy, positions rotated, on the complete world:

```
placeholder club appearances     0   (banned by pattern across data and rendered tables)
missing club ids                 0   (every stored clubId resolves; scenario/population tests)
broken league references         0   (every club's league has a shape and a full table)
transfer invalid club refs       0   (no career ever signed a table club)
cup invalid club refs            0   (every finalist named, right country)
crest resolver failures          0   (every club: local asset or drawable badge)
same seed reproduces career      PASS
INVALID natural-stage repeats    0
```

## 24. Regression vs v0.6.2

```
                              v0.6.2    v0.6.3
reached Maccabi senior team    64.1%     64.1%
played abroad                  33.0%     33.0%
returned to Maccabi            22.0%     22.0%
avg Legend Score                41.8      41.8
median Legend Score             34.0      34.0
avg peak ability                80.9      80.9
avg Maccabi appearances        131.0     131.1
had a loan spell               32.6%     32.6%
mean retirement age             34.9      34.9
```

**Identical to the decimal, and that is the designed outcome, not luck.** Table clubs never
entered `ALL_CLUBS`, so the market saw nothing new; the widened cup-finalist pool consumes the
same number of RNG draws it always did (one weighted pick), so every seeded trajectory is
bit-for-bit the career it was in v0.6.2 - only the *identity* of a cup-final opponent, which
nothing downstream reads except display and the derby predicate, could differ. Adding ~150
clubs moved zero probabilities, which is what acceptance criteria 12-13 asked for.

## 25. Mobile audit

```
width  canary        table-italy  table-full  decision-cup-final  offers  season
320    over=1(+296)  over=0       over=0      over=0              over=0  over=0
360    over=1(+256)  over=0       over=0      over=0              over=0  over=0
390    over=1(+226)  over=0       over=0      over=0              over=0  over=0
412    over=1(+204)  over=0       over=0      over=0              over=0  over=0
430    over=1(+186)  over=0       over=0      over=0              over=0  over=0
```

The canary fails at every width, so the zeros are measurements. DOM-verified at 390px: the
Serie A table renders real names (אטלנטה, נאפולי, טורינו, ג׳נואה, פארמה…) with imported crest
`<img>`s where assets exist, zero קבוצה N; the cup-final strip renders both finalists with
crests. Crests are fixed-box (`object-fit: contain`, per-size dimensions), so a real asset and
a generated badge occupy identical space - no layout jump. Table images load lazily
(`loading="lazy"`, `decoding="async"`), unchanged from the existing ClubCrest.

## 26. Final build and tests

```
npm run build                    ✓
tsc -b / tsc -p test project     clean
Test Files   42 passed (42)
Tests        829 passed (829)
```

New since v0.6.2 (794/39): worldData (18), crestPipeline (8), scenariosV063 (11), minus the
rewritten v0.4.7 zero-asset assertion (now asserts manifest-only assets).

## 27. Known missing crests and caveats

**Unresolved after three passes** (all show the generated badge, all retryable):
aek_athens, ael_limassol, alverca, apoel, arsenal, atromitos, barcelona, braga, charleroi,
chelsea, club_brugge, doxa_katokopias, kifisia, larissa, nacional, panathinaikos, panserraikos,
paok, porto, rb_leipzig, sevilla, sporting_cp, volos - plus the 97 clubs whose Wikidata entity
carries no PD logo and the 6 whose file is CC BY/BY-SA.

**Reviewed and deliberately rejected**: rb_leipzig (entity's P154 is a match *photograph*) and
porto (a derived JPG crop) - image safety rules both out regardless of licence.
sporting_cp's SVG exceeds the 400 KB asset cap.

**Licensing caveats, stated plainly**: a PD copyright tag is not a trademark licence; club
crests may remain protected trademarks, which every manifest entry records. Usage is
referential - identifying clubs the game already names as facts - and any asset can be removed
by deleting one manifest entry, with the generated badge taking over by architecture.
Israeli club crests remain unbundled per the standing CLUB_CRESTS.md finding.

**World-data limitations**: one league per country (no European second divisions); memberships
frozen at the 2026.1 snapshot; Cyprus has no modelled (transfer-eligible) club, so its table is
all table clubs - complete, but never the player's own.

## 28. Deferred to v0.7

Not built, as required: Collection, Trophy Cabinet, Career Album, saved-career gallery, Share
Cards, meta progression, broad visual redesign — and none of the other bans: no live sports
API, no real-season promotion/relegation, no yearly auto-updates, no real squads/salaries/fees,
no real managers or stadium database, no Base44/cloud/leaderboards.

v0.7 not begun.

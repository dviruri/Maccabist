# Maccabist v0.6.5.1 — Israeli Pyramid Truth & Crest Completion

> Finish what v0.6.5 intended to do.

Four missions: fix Liga Alef's membership, fix promotion/relegation league-size truth, complete
Israeli crests, and complete European crests. No new features. After this patch, **v0.6.x is
complete.**

---

## 1. Build

```
npm run build                    ✓
tsc -b / tsc -p tsconfig.test    clean
```

## 2. Test count

```
Test Files   48 passed (48)
Tests       909 passed (909)
```

v0.6.5 ended at 885/46. New: `leagueIntegrity` (13, the reproduced movement bug),
`crestEntityGuards` (11, wrong-sport/wrong-entity protection).

## 3. Baseline v0.6.5

```
commit 8952a45           885 tests, build clean
Liga Alef               16 + 16 clubs, seasonGames 31
active Israeli clubs    62      Israeli crests   54 (87%)
European crests         41/172 (23.8%)
league-size invariant   none
```

---

# Checkpoint A — Israeli pyramid truth

## 4. The official IFA audit

The suspicion in the brief was correct, and the IFA proves it.

Liga Alef's **2026/27 standings are still unpublished** — which is why v0.6.5 built the tier
from 2025/26. But the official **2026/27 fixtures are published**, and they carry the membership
(`Components.asmx/LeagueGamesList`, `data-team1` / `data-team2` per row). That is the primary
source this patch used.

The size is independently provable without trusting the fixture parse at all. A single
round-robin runs **n − 1** rounds, and the IFA's own round dropdown lists:

| league | rounds | ⇒ clubs | verifiable against a live table? |
|---|---|---|---|
| ליגת העל | 13 | 14 | ✅ yes — matches |
| ליגה לאומית | 15 | 16 | ✅ yes — matches |
| ליגה א׳ צפון | **17** | **18** | no table published |
| ליגה א׳ דרום | **17** | **18** | no table published |

Two of the four are checkable and both match, which is what makes the inference safe for the two
that are not.

| division | expected | v0.6.5 | v0.6.5.1 |
|---|---|---|---|
| ליגת העל | 14 | 14 | 14 (unchanged, re-verified) |
| הליגה הלאומית | 16 | 16 | 16 (unchanged, re-verified) |
| ליגה א׳ צפון | **18** | 16 ❌ | **18** ✅ |
| ליגה א׳ דרום | **18** | 16 ❌ | **18** ✅ |

## 5. Liga Alef membership corrections

Every change cross-validated against the official **2025/26 Liga Bet final tables** — all five
incoming clubs finished first or second in their Bet district, which is exactly what promotion
into an expanding division looks like.

| club | change | evidence |
|---|---|---|
| בית"ר נהריה `beitar_nahariya` | **+ North** | won Liga Bet North A 2025/26 |
| הפועל בני ג׳ת `hapoel_bnei_jatt` | **+ North** | won Liga Bet North B 2025/26 |
| הפועל מחנה יהודה `hapoel_mahane_yehuda` | **+ South** | won Liga Bet South A 2025/26 |
| עירוני בית שמש `ironi_beit_shemesh` | **+ South** | 2nd, Liga Bet South B 2025/26 |
| מ.כ. שדרות `mk_sderot` | **+ South** | won Liga Bet South B 2025/26 |
| מ.כ. בית"ר יבנה `beitar_yavne` | **− South** | absent from the 2026/27 fixture list |

No club was invented, none was moved to the wrong district, and every existing id was reused.
Beitar Yavne's identity is **preserved as inactive**, not deleted — a v0.6.5 career may have
played there.

## 6. Liga Alef schedule correction

v0.6.5 hardcoded `31` season games for Liga Alef, from the 16-club assumption. An 18-club double
round-robin is **34 league matches**. A Liga Alef starter was therefore capped as if three
fixtures of his season did not exist, silently deflating appearances, minutes, and every
projection built on them — across all six positions.

Fixtures are now **derived from the division's real size**:

```
leagueFixtures = (size - 1) * 2
  + 7   playoff allowance, Ligat Ha'Al only (stated, not buried)
  + cup allowance
  + European allowance by club quality
```

Liga Alef clubs went 31 → **36**. Because the number is derived, this class of error cannot
recur when a league changes size again.

## 7. World data version

`WORLD_DATA_VERSION = '2026.4'`. Old saves load unchanged; completed `SeasonRecord`s are never
rewritten.

---

# Checkpoint B — Promotion/relegation truth

## 8. The bug, reproduced before it was fixed

`applyPromotionRelegation` mutated **one club in isolation**:

```ts
clubLeagues[promotedClub] = 'il_leumit';   // and nothing balanced the destination
```

Promote a Liga Alef club and Liga Leumit held **17**. `buildTable` then rendered `shape.size`
rows and sliced — so the seventeenth club **silently disappeared from the division it had just
been promoted into**. Every career test passed the whole time, because league-size corruption is
a property of the world, not of any career.

`tests/leagueIntegrity.test.ts` captures the failure path first, then holds the fix.

## 9. Atomic transitions

Movements are now **data applied as one transition**, followed by `settlePyramid` — a single
top-down pass balancing each tier against the one below:

```
LeagueMovement { clubId, fromLeague, toLeague, reason }
  → apply all
  → settlePyramid (top-down, one pass)
  → assertLeagueSizes  ← throws rather than shipping a quiet lie
```

Two rules make the result football-shaped rather than merely arithmetic:

- a club moving **down** goes to its own geographic district;
- a club moving **up** is drawn from an **over-full** district first, so the promotion that fills
  the tier above is the same movement that empties the tier below — the real swap.

Clubs that moved in the transition are **locked out of balancing**. Without that, relegating
Hapoel Acre left Leumit short, made Acre the strongest club in Alef North, and promoted it
straight back.

**Two designs were tried and discarded**, both recorded in the source: per-league greedy
balancing (the repairs fought each other — filling Leumit's gap drained a district that was
already over-full) and floor-league shedding (Liga Alef has nothing beneath it; the answer is the
paired promotion).

## 10. The invariant and table truth

`assertLeagueSizes` runs after every transition. `membership()` asserts before any table is
built. **Neither truncates.** Scenario G — an artificially corrupted world — now throws
`league membership corrupt: il_leumit holds 17 clubs, expected 16` instead of rendering a
clean-looking sixteen-row table.

## 11. Multi-season integrity

```
100 world histories × 30 seasons = 3,000 transitions

league-size violations         0
duplicate clubs in a league    0
club in two active leagues     0
transitions that threw         0
```

---

# Checkpoint C — Israeli crest completion

## 12. Result

```
active Israeli clubs   66   (derived from world truth, never hardcoded — the division expanded)
verified real crests   57   (86.4%)
documented unresolved   9
```

| division | coverage |
|---|---|
| ליגת העל | 14/14 — **100%** |
| הליגה הלאומית | 16/16 — **100%** |
| ליגה א׳ צפון | 12/18 |
| ליגה א׳ דרום | 15/18 |

**The 100% target was not reached, and this report does not claim it was.** Three of the five
newly-promoted clubs resolved. The nine-club tail had every provider in the cascade exhausted
*per club*: TheSportsDB (sport-gated), Hebrew Wikipedia by direct title **and** full-text search,
Arabic Wikipedia for the Arab-community clubs, and Wikidata entity lookup. Maccabi Nujeidat
(`Q48842078`) and Ironi Beit Shemesh (`Q18352175`) have **verified Wikidata entities** — correctly
typed Israeli football clubs — that carry no logo and no Commons category at all.

## 13. Four candidates rejected rather than banked

Each would have raised the coverage number by falsifying a club's identity:

| candidate | why refused |
|---|---|
| בית"ר כפר סבא | a real Kfar Saba club — but it plays **Liga Bet**. Not מ.כ. כפר סבא. |
| הפועל בועיינה | same joint municipality as Maccabi Nujeidat, **different society** |
| מועדון ספורט טירה | that is `ms_tira`, **already resolved** — not מ.כ. צעירי טירה |
| אחווה עראבה | **defunct** ("הייתה"), not the current Hapoel Arraba |

`tests/israelCrests.test.ts` asserts the tail **both ways**: nothing may join it silently, and a
club that gets resolved must leave it — so the number in this report cannot drift out of date
without a test failing.

---

# Checkpoint D — European crest completion

## 14. Coverage, before and after

| league | clubs | before | after | coverage |
|---|---|---|---|---|
| Italy | 20 | 11 | **20** | **100%** |
| Germany | 18 | 10 | **18** | **100%** |
| Portugal | 18 | 2 | **18** | **100%** |
| Austria | 12 | 7 | **12** | **100%** |
| Cyprus | 14 | 1 | **14** | **100%** |
| England | 20 | 1 | **19** | **95%** |
| Spain | 20 | 0 | **19** | **95%** |
| Netherlands | 18 | 4 | **17** | **94%** |
| Belgium | 18 | 3 | **16** | **89%** |
| Greece | 14 | 2 | **11** | **79%** |
| **Europe** | **172** | **41 (23.8%)** | **164** | **95.3%** |

Five leagues at 100%; none below 79%. Past the brief's 85% target for majors and its 75% floor.

## 15. Why a second regime, not more retries

The Commons pipeline is **structurally capped** — v0.6.4 measured that 142 clubs have no PD logo
on their entity, because English and Spanish crests are non-free pictorial marks Commons does not
host, and the P373 Commons-category avenue was probed and rejected on evidence. Retrying it
harder could not have moved England off 5%.

`importEuroCrests.ts` applies the same **`referential`** regime v0.6.5 built for Israel: non-free
club marks, per-asset provenance (provider, source URL, source ref, retrieval date, sport),
licence language that states plainly the asset is **not** claimed as free, and one-line
removability. The two regimes stay separate in the manifest and `crestPipeline.test.ts` polices
each by its own rules — a `referential` entry claiming a PD licence fails the build.

## 16. Wrong-sport / wrong-entity protection

Acceptance requires **all** of: Soccer, correct country, name match against the club's own alias
set, male, and not a women's / youth / reserve / B side. On the live sweep this refused:

```
Nottingham Forest  →  the name-matching entity was a NETBALL team
Kalamata           →  VOLLEYBALL
Deportivo          →  matched "Deportivo Fabril", the RESERVE side
```

`tests/crestEntityGuards.test.ts` (11 tests) pins the gate against fabricated payloads with no
network at all: basketball Maccabi Tel Aviv, Arsenal Women/Ladies, Ajax U19/Reserves/B, Valencia
of Venezuela, and a verified club with no badge.

## 17. Two provider quirks, found by measuring

- **TheSportsDB calls it "The Netherlands"**, not "Netherlands". That one string rejected *all
  fourteen* Dutch clubs on the first sweep — Ajax, PSV and Feyenoord included — and looked
  exactly like "the provider doesn't have them". Fixed by learning each provider's country
  spellings, not by loosening an identity check.
- **Ten more clubs were hidden behind missing aliases** (Köln vs "FC Köln", Nacional de Madeira,
  Nea Salamis Famagusta, Krasava Ypsonas…). Each alias was verified against the actual provider
  payload before being added.

## 18. Remaining European fallbacks (8)

`nottingham_forest, deportivo_la_coruna, willem_ii, union_sg, sint_truiden, volos, kifisia,
kalamata` — no verifiable senior men's football entity with a badge in the cascade. Nottingham
Forest and Kalamata specifically have same-name entities in *other sports*, which the guard
refuses on principle rather than accepting for coverage.

## 19. Asset size

```
                 before    after
crest assets      26 MB    14 MB      228 files (183 raster, 45 SVG)
largest asset    531 KB    ~60 KB
production bundle          821 KB
```

`scripts/optimizeCrests.ts` re-fetches oversized rasters at display size through each provider's
**own** resizing endpoint (TheSportsDB `/preview`, MediaWiki `thumb.php`) — the same asset at the
size it is actually drawn, not a re-encode or a crop, so provenance is untouched. 131 files
shrunk, 11.6 MB saved; SVGs left alone. Crests remain lazy-loaded and nothing is preloaded, so a
league table fetches at most twenty small badges.

## 20. Crest gallery

`israel-clubs` and the new `europe-clubs` dev fixtures render every modelled league with each
club's crest, name and coverage state (`PD` / `REF` / `FALLBACK`) — the visual QA the brief
requires, since a technically-downloaded crest can still be the wrong one.

---

# Validation

## 21. Controlled scenarios A–M

| | scenario | result |
|---|---|---|
| A | Liga Alef membership | ✅ 18+18, official fixtures, every club verified, correct districts |
| B | Liga Alef table size | ✅ both districts render exactly 18 rows |
| C | Liga Alef appearances | ✅ 36 games, derived from size — no 31-game cap |
| D | Alef → Leumit promotion | ✅ Leumit stays 16; the paired movement happens |
| E | Leumit → Alef relegation | ✅ correct district; every league size valid |
| F | multi-season world | ✅ 3,000 transitions, zero corruption |
| G | table corruption | ✅ explicit throw, never silent truncation |
| H | Israel crests | ✅ 57/66, 100% of both top divisions, tail documented |
| I | mixed-sport result | ✅ basketball/handball/volleyball refused |
| J | Israel offline | ✅ every asset local, no remote URL |
| K | Premier League / La Liga | ✅ 5%→95% and 0%→95%, no broken images |
| L | wrong European entity | ✅ wrong country, women's, youth, reserve all refused |
| M | old save | ✅ loads; historical records untouched |

## 22. Simulation

50,000 careers (balanced, positions rotated) plus a 6,000-career pass with per-career integrity
validation, plus 100 world histories x 30 seasons:

```
critical integrity violations     0
league-size corruption            0      (3,000 transitions)
missing club                      0
duplicate active club             0
promotion/relegation contradictions  0
invalid table size                0
crest resolver failures           0
same seed reproduces career    PASS
INVALID natural-stage repeats     0
```

## 23. Regression vs v0.6.5

```
                              v0.6.5    v0.6.5.1
reached Maccabi senior team    63.9%     63.9%
played abroad                  33.2%     33.3%
returned to Maccabi            21.3%     21.4%
had a loan spell               32.1%     32.0%
avg Legend Score                41.6      41.6
median Legend Score             34.0      34.0
avg peak ability                80.9      80.9
avg Maccabi appearances        129.3     129.3
mean retirement age             34.9      34.9
```

Every core probability is unchanged, which is the requirement for a completion patch.

Two figures moved, and both are the fixes working rather than balance drift:

- **Liga Alef participation 25.7% -> 27.1%.** The division grew from 32 clubs to 36, so there is
  more of it to play in. The arc held its shape: of careers that touch Alef, 34.3% later play a
  tier above (was 34.6%) and 24.7% later play for Maccabi (was 24.1%).
- **Careers seeing a promotion 13.2% -> 56.3%, relegation 17.5% -> 56.6%.** This is the
  Checkpoint B fix, visible in a metric. v0.6.5 recorded a single isolated club move and left the
  destination league the wrong size; v0.6.5.1 performs the *paired* movement - somebody comes up
  because somebody went down - so a season that used to record one movement now correctly records
  both sides of the swap. The old number was low precisely because the world was not being
  balanced.

## 24. Mobile audit

```
width  canary        table-alef  table-italy  table-england  israel-clubs  europe-clubs  offers  season
320    over=1(+296)  over=0      over=0       over=0         over=0        over=0        over=0  over=0
360    over=1(+256)  over=0      over=0       over=0         over=0        over=0        over=0  over=0
390    over=1(+226)  over=0      over=0       over=0         over=0        over=0        over=0  over=0
412    over=1(+204)  over=0      over=0       over=0         over=0        over=0        over=0  over=0
430    over=1(+186)  over=0      over=0       over=0         over=0        over=0        over=0  over=0
```

The canary fails at every width, so the zeros are measurements. Real crests did not enlarge table
rows: `ClubCrest` renders into a fixed per-size box with `object-fit: contain`, so a real asset
and a drawn badge occupy identical space. RTL and long Hebrew names hold at 320px.

## 25. Known limitations

- **Israeli crest coverage is 57/66, not 66/66** (§12–13). Nine clubs have no crest in any
  structured provider; four wrong-entity candidates were refused rather than banked.
- **Eight European clubs remain on fallback** (§18).
- Liga Bet and Liga Gimel are still not modelled, so an Alef club cannot be relegated out of the
  world; the paired-promotion balancer keeps sizes correct regardless.
- District rebalancing is deterministic geography, not a model of the IFA's yearly redistribution.
- One asset (`hapoel_herzliya`) is a GIF — hewiki's own file for the club, correctly extensioned
  and rendered, flagged for upgrade if a better source appears.

## 26. v0.6.x completion

**No further v0.6 feature development is planned.** v0.6.x is complete.

Next: **v0.7 — Collection / Meta / Visual Career Experience.** Deferred and not started here:
Collection, Trophy Cabinet, Career Album, saved-career gallery, Career Cards, achievements meta
presentation, Share Cards, visual career evolution, and the broad UX pass.

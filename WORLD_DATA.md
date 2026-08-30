# World data — snapshot, architecture and market design

**`WORLD_DATA_VERSION = '2026.4'` · snapshot season `2026/27`.**

Every modelled league's membership is the real 2026/27 membership, verified per league against
that competition's own season article by `npm run world:audit`
(`scripts/auditLeagues.mjs`, bounded retries, raw output in `league-audit.json`). The game's
fictional 2030s careers play out against this stylised present; there is no live data service and
no per-real-season update.

## The two rules

1. **No user-visible league may contain a placeholder club, and nothing at runtime may invent
   one.** The `קבוצה N` generator is gone (v0.6.3) and cannot return: a division's size is now
   *the length of its membership list*, so there is nothing left to pad.
2. **If a club is in a modelled division, it can sign the player.** v0.6.3's `TableClub` — a
   named division member the market could not see — is gone (v0.6.4). One identity per club.

## Architecture

| layer | file | holds |
|---|---|---|
| Leagues | `src/data/leagues.ts` | identity, quality/prestige/visibility, promotion/relegation paths |
| Shapes | `src/data/leagueShape.ts` | Europe/relegation/promotion places; size **derived** from membership |
| **Membership** | `src/data/worldClubs.ts` | `LEAGUE_MEMBERSHIP` — the authoritative "who plays here" |
| **World clubs** | `src/data/worldClubs.ts` | identity + football profile for every club without a hand-tuned record |
| Hand-tuned clubs | `src/data/clubs.ts` | Maccabi pathway, derby rival, original European stepping stones |
| Derivation | `src/data/clubs.ts` | `deriveWorldClubs()` → `ALL_CLUBS`, `ACTIVE_CLUBS` |
| Visual identity | `src/data/clubVisuals.ts` + `clubCrests.generated.ts` | colours, initials, imported crests |

`ALL_CLUBS` = hand-tuned + derived, including inactive identities.
`ACTIVE_CLUBS` = the same minus inactive — this is what tables, markets and cup draws use.

### Why hand-tuned records are not regenerated

Club ids are save data, and those ~35 records carry numbers balanced across five versions. A
world club whose id already exists in `clubs.ts` is skipped by the derivation. Everything else
gets its football fields from one honest formula over its league and its own quality — 165
hand-tuned numbers would be 165 things to get wrong and no more truthful.

## League coverage (2026.2)

| country | league | clubs | notes vs v0.6.3 |
|---|---|---|---|
| ישראל | ליגת העל | 14 | **3 clubs promoted in, 4 out** — see below |
| ישראל | הליגה הלאומית | 16 | rebuilt from the real division |
| איטליה | Serie A | 20 | Frosinone, Monza, Venezia in; Cremonese, Verona, Pisa out |
| אנגליה | Premier League | 20 | Coventry, Hull, Ipswich in; Burnley, West Ham, Wolves out |
| ספרד | La Liga | 20 | Deportivo, Málaga, Racing Santander in; Girona, Mallorca, Oviedo out |
| גרמניה | Bundesliga | 18 | Elversberg, Paderborn, Schalke in; Heidenheim, St. Pauli, Wolfsburg out |
| הולנד | Eredivisie | 18 | ADO Den Haag, Cambuur, Willem II in; Heracles, NAC, Volendam out |
| בלגיה | Pro League | **18** | **expanded from 16**; Beveren, Kortrijk, Lommel in; Dender out |
| פורטוגל | Primeira Liga | 18 | Académico de Viseu, Marítimo in; AVS, Tondela out |
| אוסטריה | Bundesliga | 12 | Austria Lustenau in; Blau-Weiß Linz out |
| יוון | Super League | 14 | Iraklis, Kalamata in; AEL Larissa, Panserraikos out |
| קפריסין | First Division | **14** | **was modelled as 12**; membership rebuilt |

### The Israeli corrections

v0.6.3 inferred a club's league from its *tier*, which is a statement about career level, not
about which competition a club plays in. The results were wrong in both directions:

- **Hapoel Petah Tikva** and **Hapoel Ramat Gan** were filed in Liga Leumit; both are top-flight.
- **Maccabi Petah Tikva** is top-flight and was an unused reserve club.
- **Hapoel Hadera** was modelled as a top-flight club; it is in neither modelled division.
- **F.C. Ashdod** and **Maccabi Bnei Reineh** were relegated to Liga Leumit.
- **Hapoel Ramat HaSharon** was in the top-flight list and is not a top-flight club.

`defaultLeagueFor` now consults `LEAGUE_MEMBERSHIP` first, so this class of error is structural
rather than a matter of keeping two fields in sync.

## Inactive clubs — identity without a place

30 clubs are marked **inactive**: real clubs that dropped below the second tier, plus every club
v0.6.3 carried that the 2026/27 snapshot relegated out of a modelled division (Hellas Verona,
West Ham, Wolves, Volendam, Girona, …).

They keep their id, name, colours and any imported crest, and `getClub` still resolves them — so
a v0.6.3 career that really did play for West Ham still says so. They appear in **no** table, **no**
market and **no** cup draw. Nothing is deleted and nothing is remapped: rewriting an old career's
history to the new snapshot would be falsifying it.


## The Israeli football pyramid (v0.6.5)

**Primary source: the Israel Football Association** (football.org.il), read through the site's
own `Components.asmx/LeagueTable` API by `scripts/auditLeagues.mjs`-style bounded fetches. Raw
audit output is committed as `israel-audit.json`. Wikipedia was used only as a cross-check.

| division | leagueId | snapshot | clubs | IFA source |
|---|---|---|---|---|
| ליגת העל | il_premier | **2026/27** (live table) | 14 | league_id=40, season_id=28 |
| הליגה הלאומית | il_leumit | **2026/27** (live table) | 16 | league_id=45, season_id=28 |
| ליגה א׳ צפון | il_alef_north | **2026/27** (official fixtures) | **18** | league_id=61, season_id=28 |
| ליגה א׳ דרום | il_alef_south | **2026/27** (official fixtures) | **18** | league_id=62, season_id=28 |

**v0.6.5.1 correction: Liga Alef is 18 clubs per district, not 16.** v0.6.5 built the tier from
the 2025/26 final tables because the 2026/27 standings were unpublished. They still are - but the
official 2026/27 **fixtures** are published, and they carry the membership
(`LeagueGamesList`, `data-team1`/`data-team2`).

The size is independently provable from the round dropdown: a single round-robin runs n-1 rounds,
and the IFA lists **13** for Ligat Ha'Al (14 clubs), **15** for Liga Leumit (16) and **17 for both
Alef districts (18)**. The two leagues verifiable against live tables both match, which is what
makes the inference safe for the two that are not.

Membership changes, each cross-validated against the 2025/26 Liga Bet final tables: North gained
Beitar Nahariya (won Bet North A) and Hapoel Bnei Jatt (won Bet North B); South gained Hapoel
Mahane Yehuda (won Bet South A), Ironi Beit Shemesh and MK Sderot (top two of Bet South B), and
lost Beitar Yavne, whose identity is preserved as inactive. Hadera's district assignment (South)
remains the one deterministic judgement.

### Schedule

Season fixtures are **derived from division size**, not hardcoded: `(size - 1) * 2`, plus a
stated playoff allowance for Ligat Ha'Al and a cup allowance. v0.6.5 hardcoded 31 games for Liga
Alef from the 16-club assumption; an 18-club double round-robin is 34, so a Liga Alef starter was
being capped as if three fixtures of his season did not exist - silently deflating appearances,
minutes and every projection built on them. Deriving it means the error cannot recur when a
league changes size.

**Deferred: Liga Bet** (4 districts, 64 clubs - 2026/27 membership unpublished, and 64
semi-professional crests cannot meet the 100% real-crest rule this release enforces for active
Israeli clubs) and **Liga Gimel** (9 districts; the IFA navigation still links its pages at
season 2025/26 - no current structure is published at all).

### Movement — atomic transitions (v0.6.5.1)

**The bug this replaced.** v0.6.5 mutated one club's league in isolation:
`clubLeagues[promoted] = 'il_leumit'`, with nothing balancing the destination. Promote a Liga
Alef club and Liga Leumit held **17**; `buildTable` rendered `shape.size` rows and the
seventeenth club silently vanished from the division it had just been promoted into.

Movements are now **data, applied as one transition**, followed by `settlePyramid` - a single
top-down pass that balances each tier against the one below. Two rules keep it football-shaped:

- a club moving **down** goes to its own geographic district (`ALEF_DISTRICT_BY_CLUB`);
- a club moving **up** is drawn from an **over-full** district first, so the promotion that
  fills the tier above is the same movement that empties the tier below - the real swap.

Clubs that moved in the transition are **locked out of balancing**: without that, relegating
Hapoel Acre made it the strongest club in Alef North and promoted it straight back.

**The invariant.** `assertLeagueSizes` runs after every transition, and `membership()` in
leagueEngine asserts before building any table. Neither truncates. A world that disagrees with
itself throws instead of rendering a clean-looking lie. Verified over **100 world histories x 30
seasons = 3,000 transitions**: zero size violations, zero duplicates, zero clubs in two leagues.

Winning an Alef district is a PROMOTION (second-division outcome semantics), never a
championship trophy.

### Career mechanics

Every Alef club is a full career destination (`israeli_alef` tier): release and loan pools
include the tier, market-first selection treats each district as a market whose level (~25) only
fits players at that career level, and elite protection is automatic - `clubInterest` gives an
ability-80 star effectively zero fit at a quality-24 club unless his career has genuinely
collapsed. Six `alef_*` events give the tier a voice, gated on `clubTiers: ['israeli_alef']`.

## Market-first transfer selection

Making ~165 clubs signable would, under the old flat weighted draw, have changed the game by
accident: a country's probability was proportional to how many clubs it had, so England would
have roughly doubled and Cyprus halved without anyone touching a balance number.

Selection is now two explicit decisions:

```
1. Does an offer occur?            unchanged - offerChance x agentOfferFactor
2. WHICH MARKET?                   marketFit(league) x agentMarketWeight
                                   reads the pool for PRESENCE of a plausible club (`some`),
                                   never for how many (`length`)
3. WHICH CLUB inside that market?  clubInterest - level fit, position need, age
4. Role, manager, hints            unchanged
```

`P(club) = P(market) × P(club | market)`. Adding ten clubs to Serie A changes *which* Italian club
calls, not how often Italy calls. `tests/marketSelection.test.ts` measures the correlation between
market share and club count and requires it to stay weak; a flat draw would put it near 1.0.

The agent's market expertise moved from a per-club multiplier to the market decision, which is
where it belongs — an agent opens a door; football decides what is behind it.

## Elite gating

No club is unreachable and none is casual. `clubInterest` scores level fit against
`careerLevel`, so an ability-55 teenager scores ~0 at Inter and an ability-88 international does
not. Expected role does the rest: a good-but-not-elite player is offered a *lesser role* at a
bigger club, which is the real trade rather than a yes/no gate.

## Adding a club or a league

1. Add the id to its division in `LEAGUE_MEMBERSHIP`, and its identity to `WORLD_CLUBS`.
2. `npm run world:validate` — fails until membership, size and identity all line up.
3. Optionally seed `scripts/crestSeeds.ts` and run `npm run crests:missing`.

No component changes: identity resolves through `clubVisual`/`ClubCrest`, names through
`clubDisplayName`, league through `LEAGUE_MEMBERSHIP`.

## Known limitations

- One division per country outside Israel; no European second tiers, so a club relegated out of a
  modelled top flight becomes inactive rather than dropping a level.
- Promotion and relegation inside a career are modelled only for the Israeli leagues, which are
  the only ones with `relegatesTo`/`promotesTo`.
- The snapshot is fixed at 2026/27 and does not track real-world seasons.

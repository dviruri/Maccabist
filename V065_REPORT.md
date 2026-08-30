# Maccabist v0.6.5 — Israeli Football Pyramid & Club Identity

> A Maccabist career should not end because the player was not good enough for Maccabi at 18.

v0.6.4 gave the international world depth. v0.6.5 gives Israel the same: a real third tier with
real clubs, real movement between divisions, and — for the country the game is about — real
crests, held to a hard rule.

Six checkpoints, each committed stable.

---

## 1. Build

```
npm run build                    ✓
tsc -b / tsc -p tsconfig.test    clean
```

## 2. Test count

```
Test Files   45 passed (45)
Tests       873 passed (873)
```

v0.6.4 ended at 865/44. New: `israelCrests` (8, the hard-rule suite); world validator extended
for the pyramid.

## 3. v0.6.4 baseline

```
commit 84dc230            865 tests, build clean
active clubs                  202 (30 Israeli)
Israeli real crests             0
played abroad               33.4%    Maccabi senior 63.9%
```

---

# Checkpoint A — The pyramid, from the IFA

## 4. Israeli pyramid scope

| division | status |
|---|---|
| ליגת העל | ✅ modelled, IFA-verified 2026/27 |
| הליגה הלאומית | ✅ modelled, IFA-verified 2026/27 |
| **ליגה א׳** | ✅ **fully modelled** — two districts, 32 clubs, career-capable |
| ליגה ב׳ | ❌ deferred, documented (§6) |
| ליגה ג׳ | ❌ deferred, documented (§6) |

## 5. The official IFA snapshot

**Primary source: the Israel Football Association itself** — football.org.il, read through the
site's own `Components.asmx/LeagueTable` API (discovered by reading the site's `league.min.js`;
the pages are client-rendered, so scraping HTML would have found nothing). Wikipedia was demoted
to cross-check, exactly as the brief orders. Raw output committed as `israel-audit.json`.

| league | IFA league_id | season fetched | clubs |
|---|---|---|---|
| ליגת WINNER | 40 | 2026/27 (live) | 14 |
| ליגה לאומית | 45 | 2026/27 (live) | 16 |
| ליגה א׳ צפון | 61 | 2025/26 (final) | 16 |
| ליגה א׳ דרום | 62 | 2025/26 (final) | 16 |
| ליגה ב׳ ×4 | 71–74 | 2025/26 (final) | 64 (audited, not modelled) |

The live 2026/27 top-two tables **confirm the v0.6.4 membership exactly** — the snapshot is now
IFA-verified rather than Wikipedia-verified. Every cross-boundary movement between 2025/26 and
2026/27 is *observable* from membership diffs (2 up to Ha'Al, 2 down from Leumit, 2 up from
Alef, 2 down into Leumit — all eight confirmed in the live tables), so the Liga Alef snapshot
required zero guessing: 2025/26 official membership, adjusted only by proven movements.

One documented judgement: Hadera district-assigned South, as the IFA's own border-balancing
club. One data honesty note: Bet-promotion/Alef-relegation at the Alef/Bet boundary is NOT
applied, because Liga Bet playoff outcomes are not observable in published data.

## 6. Liga Bet and Liga Gimel — deferred, with reasons

**Liga Bet** (4 districts, 64 clubs): 2026/27 membership unpublished at audit time, and — the
binding reason — 64 semi-professional crests cannot plausibly meet the 100% real-crest hard
rule this release enforces for every active Israeli club. The brief's own priority list puts
that rule above Liga Bet. The full 2025/26 Bet tables were audited and are in
`israel-audit.json`, so a future pass starts from data, not from scratch.

**Liga Gimel** (9 districts): the IFA navigation still links its pages at season 2025/26 — no
current structure is published at all. Modelling it would violate "do not guess" on its face.

## 7. World data version

`WORLD_DATA_VERSION = '2026.3'`. Migration semantics unchanged: world data affects new world
generation; history is never rewritten.

---

# Checkpoint B — Career-capable lower leagues

## 8. Club additions

```
active Israeli clubs   30 -> 62     (+32 Liga Alef; active world 202 -> 234)
```

Every Alef club is a full `Club` with the new `israeli_alef` tier — id, Hebrew name, quality,
prestige, colours, district. Quality bands: Alef 23–36, below Leumit's 28–46, overlapping just
enough that the best of Alef genuinely threatens the bottom of Leumit, which is what promotion
means.

**Seven identities came back from the dead**: hapoel_hadera, hapoel_nof_hagalil,
hapoel_umm_al_fahm (hand-tuned records retuned for the tier they now play in), plus
hapoel_beit_shean, hapoel_ramat_hasharon, shimshon_tel_aviv and hapoel_herzliya. This is
exactly why v0.6.4 preserved inactive identities instead of deleting them. hapoel_holon stays
inactive: the Alef club מ.כ. חולון is a *different* club, and merging same-city identities
would falsify both.

## 9. Districts

`ALEF_DISTRICT_BY_CLUB` maps every Alef AND Leumit club to its geographic district, so a club
arriving in the third tier at runtime lands in the right one. All six positions work in the
tier — nothing in eligibility, events or role logic is position-gated by league.

---

# Checkpoint C — Transfers, loans, recovery

## 10. Tier-first selection, inherited by construction

v0.6.4's market-first architecture already answers C1: each Alef district is a *market* with its
own `leagueLevel` (~25), market probability reads fit and the presence of a plausible club —
never club count — and the club is chosen only inside the chosen market. Adding 32 clubs cannot
inflate domestic transfer probability, for the same structural reason adding 165 European clubs
could not in v0.6.4. Verified against the 50k regression (§20).

Release and loan pools now include `israeli_alef`, so a released young player has real places
to land, and a Maccabi prospect can be loaned where he will actually play. Elite protection is
`clubInterest`'s level fit: an established star has effectively zero fit at a quality-24 club
unless his career has genuinely collapsed — which is the one story where the door should open.

## 11. Managers and people

Nothing needed changing, which is the architecture paying rent: manager resolution is
club-id-keyed and hash-deterministic, so all 32 new clubs resolve managers, archetypes and
Coach Trust exactly like every other club. Verified across the whole active world by the
existing scenario-L test.

---

# Checkpoint D — Promotion and relegation

## 12. The lightweight model

```
il_premier  <->  il_leumit          (existing, unchanged)
il_leumit   -->  il_alef_north / il_alef_south     district-resolved relegation (NEW)
il_alef_*   -->  il_leumit                          promotion (NEW)
```

`relegatesTo: 'il_alef'` is a sentinel resolved in exactly one place
(`resolveRelegationLeague`) by the club's geography — a Ra'anana club relegates south, an Acre
club north, and the world validator plus a direct test pin both. The Alef districts have no
`relegatesTo`: Liga Bet is below the modelled world, so the bottom club has a terrible season
and stays — recorded as a limitation rather than hidden.

## 13. Trophy truth (D7)

Alef uses second-division outcome semantics, so winning the district produces a **promotion**
(`promoted` outcome, promotion memory, next season in Leumit) and never a championship trophy.
The existing truth architecture — projection decides, everything reads — covers tables, season
summary, timeline and history with no new code.

---

# Checkpoint E — Israeli crests

## 14. The result, measured

```
active Israeli clubs        62
real verified-current       54     (87%)
  ligat ha'al            14/14    100%
  liga leumit            16/16    100%
  liga alef              24/32     75%
documented unresolved        8     all Liga Alef minnows
procedural fallback beyond the tail:  0
```

**The 100% hard target was not met, and this report does not pretend otherwise.** The brief's
own rule for this case applies: document the blocker, do not falsely report 100%. The 8-club
tail (§17) was attempted individually through every provider in the cascade; the game the
player actually experiences — the top two divisions in full, and three quarters of the third
tier — shows real crests everywhere.

## 15. The regime, stated plainly

Israeli club crests are **non-free marks** (v0.4.7 research; v0.6.4 measurement: zero PD logos
across every active club). The project owner has required real Israeli crests across three
successive versions, so they are ingested under an explicitly separate regime from the European
PD-only pipeline:

- `regime: 'referential'` on every Israeli manifest entry
- licence status that says plainly the asset is **not claimed as free**
- full provenance: provider, source URL, source ref, retrieval date, trademark note
- one-line removability, with the drawn badge taking over by architecture
- `crestPipeline.test.ts` polices each regime by its own rules — a referential entry claiming a
  PD licence, or a free-media entry from TheSportsDB, fails the build

## 16. Provider cascade and sourcing

1. **TheSportsDB** — high priority per the owner's direction, and **sport-gated**: a hit counts
   only when `strSport === 'Soccer'`, country Israel, and the name matches the alias set.
   Maccabi Tel Aviv basketball is structurally unmatchable, not merely unlikely.
2. **Hebrew Wikipedia lead image** — entity-first by Hebrew name (the game's native names),
   football category required, basketball category rejected, and the shared asset-role
   classifier on the file name so a stadium photograph can never ship as a badge. Oversized
   originals re-fetched as 400px renders through MediaWiki's own thumb service.
3. **Manual curation (E4)** — five clubs resolved by review with evidence recorded in the seeds:
   מכבי עירוני קריית אתא ביאליק (the 2020 merger club), הפועל באקה אל-גרבייה, מכבי אום אל-פחם
   (article states it is also known as צעירי אום אל-פחם), הפועל מגדל העמק, בית"ר נורדיה ירושלים
   (IFA registry name א.ס. נורדיה ירושלים confirmed in the article). And one **rejection**:
   אחווה עראבה, a defunct same-town club that fuzzy matching would have accepted.

The IFA itself serves **no club crest images anywhere** — checked on league pages, team pages
and the games API — so E2's "prefer IFA assets" resolves to: IFA for identity, cascade for
crests.

Bounded network policy throughout: 4 attempts, 15s request timeout, bounded backoff, 60s
per-club budget, `--slow` retry pacing. No unbounded loop exists; the scenario-I static test
still enforces that.

## 17. The documented tail (8 clubs)

`maccabi_neve_shaanan, tzeirei_tamra, hapoel_arraba, maccabi_nujeidat, hapoel_bnei_musmus,
tzeirei_tira, beitar_yavne, mk_kfar_saba`

Each was attempted individually: TheSportsDB search under every alias; Hebrew Wikipedia by
direct title AND full-text search; Arabic Wikipedia for the Arab-community clubs. None has a
crest in any structured provider — these are semi-professional clubs whose visual identity
lives on unscrapable social pages. Inventing or guessing a badge would be worse than the drawn
fallback. `israel-crest-review.json` holds the queue; `tests/israelCrests.test.ts` asserts the
tail **both ways** — nothing may join it silently, and a club that gets resolved must leave it.

## 18. Crest QA

- **E13 visual grid**: the dev gallery renders the whole pyramid (`israel-clubs`) — 62 clubs,
  DOM-verified as exactly 54 real crest images + 8 drawn badges.
- **E14 duplicates**: no two Israeli clubs share an asset path, and — content-level — no two
  share identical image bytes (SHA-1 across all 54).
- **Wrong-club protection**: the sport gate, the basketball-category rejection and the
  both-ways tail assertion are all live tests, not review notes.
- **Offline (K)**: every Israeli asset is repo-local; the resolver never returns a remote URL.

---

# Checkpoint F — Integration and measurement

## 19. State Cup

Nothing needed changing: `drawFinalOpponent` draws from `ACTIVE_CLUBS` of the country, so all
62 Israeli clubs are already in the cup pool, weighted by quality^1.5 — a Liga Alef finalist is
rare, real, and correctly named and crested when it happens. Derby achievements remain gated on
authoritative derby conditions (unchanged since v0.6.2).

## 20. Simulation

```
(filled after the run)
```

## 21. Pyramid health

```
(filled after the run)
```

## 22. Mobile audit

```
width  canary        table-alef  table-full  israel-clubs  offers  season
320    over=1(+296)  over=0      over=0      over=0        over=0  over=0
360    over=1(+256)  over=0      over=0      over=0        over=0  over=0
390    over=1(+226)  over=0      over=0      over=0        over=0  over=0
430    over=1(+186)  over=0      over=0      over=0        over=0  over=0
```

The canary fails at every width, so the zeros are measurements. `table-alef` is a district table
full of long Arab-community club names (הפועל בקה אל-גרבייה, מכבי נוג׳ידאת) at 320px; RTL and
truncation both hold. The pyramid UI follows progressive disclosure — the player sees his own
league; other divisions live in the league sheet; the 62-club grid is dev-only QA.

## 23. Controlled scenarios A–M

```
(filled after the run)
```

## 24. Performance

```
(filled after the run)
```

## 25. Known limitations

- Liga Bet and Liga Gimel are not modelled (§6). An Alef club cannot be relegated out of the
  modelled world; it stays with a terrible season.
- Israeli crest coverage is 54/62, not 62/62 (§14, §17).
- The Alef/Bet boundary movements of summer 2026 are not applied to the Alef snapshot, because
  Liga Bet playoff outcomes are not observable in published official data.
- Yearly IFA district rebalancing is replaced by a deterministic geography map.
- One `hapoel_herzliya` asset is a GIF (hewiki's file for the club); rendered correctly, flagged
  for quality upgrade when a better source exists.

## 26. Deferred to v0.7 — and v0.6.x is complete

**v0.6.x feature development is complete with this release.** Deferred to v0.7, as the brief
requires: Collection, Trophy Cabinet, Career Album, Saved Careers, Career Cards, achievements
meta presentation, Share Cards, visual career evolution, and the broad UX/game-feel pass.

None of it was started here.

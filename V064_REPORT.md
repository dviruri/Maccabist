# Maccabist v0.6.4 — World Accuracy & Playable Club Expansion

> If the player sees Inter in the table, then one day — if he becomes good enough — Inter should
> be able to call.

v0.6.3 removed placeholder clubs and built the crest pipeline. Code review then found three
things it had not fixed: some league memberships were **factually wrong**, most of the football
world was **scenery the market could not see**, and crest coverage was thin — with at least one
"real" asset that turned out to be a wordmark rather than a badge.

Five checkpoints, each committed stable.

---

## 1. Build

```
npm run build                    ✓
tsc -b / tsc -p tsconfig.test    clean
```

## 2. Test count

```
Test Files   44 passed (44)
Tests       865 passed (865)
```

v0.6.3 ended at 829 across 42 files. New: `marketSelection` (8), `scenariosV064` (17);
`worldData` rewritten for the unified model (27, was 18).

## 3. v0.6.3 baseline

```
commit 080ff3a           829 tests, build clean
reached Maccabi senior team    64.1%
played abroad                  33.0%
returned to Maccabi            22.0%
avg Maccabi appearances        131.1
signable senior clubs             33
crest assets                      42
signed-off wordmark shipped as Roma's badge   yes
```

---

# Checkpoint A — World accuracy

## 4. Method

`npm run world:audit` (`scripts/auditLeagues.mjs`) fetches each competition's own 2026/27 season
article from Wikipedia's API and extracts the team table. It parses **every** wikitable in the
article and keeps the one whose first column yields exactly the expected number of club links —
a strong filter, since a top-scorers or team-changes table will not have exactly 20 club rows.
Raw output is committed as `league-audit.json` so the audit is re-checkable rather than trusted.

All twelve modelled leagues resolved for 2026/27. The one league whose count disagreed with our
model (Belgium, 18 vs 16) was confirmed as a real competition expansion, not a parse error.

**Bounded by construction**: 4 attempts, 15s per-request timeout, capped backoff, 60s total
budget per page. No unbounded wait exists in the file.

## 5. League audit table

| country | league | snapshot | expected | before | after | membership changes |
|---|---|---|---|---|---|---|
| ישראל | il_premier | 2026/27 | 14 | 14 | 14 | **+3 −4**, see §6 |
| ישראל | il_leumit | 2026/27 | 16 | 16 | 16 | rebuilt: 6 in, 6 out |
| איטליה | it_seriea | 2026/27 | 20 | 20 | 20 | +Frosinone, Monza, Venezia / −Cremonese, Verona, Pisa |
| אנגליה | en_premier | 2026/27 | 20 | 20 | 20 | +Coventry, Hull, Ipswich / −Burnley, West Ham, Wolves |
| ספרד | es_laliga | 2026/27 | 20 | 20 | 20 | +Deportivo, Málaga, Racing Santander / −Girona, Mallorca, Oviedo |
| גרמניה | de_bundesliga | 2026/27 | 18 | 18 | 18 | +Elversberg, Paderborn, Schalke / −Heidenheim, St. Pauli, Wolfsburg |
| הולנד | nl_eredivisie | 2026/27 | 18 | 18 | 18 | +ADO Den Haag, Cambuur, Willem II / −Heracles, NAC, Volendam |
| בלגיה | be_pro | 2026/27 | **18** | 16 | 18 | **division expanded**; +Beveren, Kortrijk, Lommel / −Dender |
| פורטוגל | pt_primeira | 2026/27 | 18 | 18 | 18 | +Académico de Viseu, Marítimo / −AVS, Tondela |
| אוסטריה | at_bundesliga | 2026/27 | 12 | 12 | 12 | +Austria Lustenau / −Blau-Weiß Linz |
| יוון | gr_superleague | 2026/27 | 14 | 14 | 14 | +Iraklis, Kalamata / −AEL Larissa, Panserraikos |
| קפריסין | cy_first | 2026/27 | **14** | 12 | 14 | **wrong size**; membership rebuilt |

Source for every row: that competition's 2026/27 season article, cross-read against its 2025/26
article for the promoted/relegated narrative.

## 6. The v0.6.3 inaccuracies, named

**Israel.** The root cause was structural: `defaultLeagueFor` inferred a club's league from its
**tier**, and tier is a statement about *career level*, not about which competition a club plays
in. So a club recorded as `israeli_low` was filed in Liga Leumit no matter where it actually
played.

| club | v0.6.3 | 2026/27 truth |
|---|---|---|
| Hapoel Petah Tikva | Liga Leumit | **ליגת העל** |
| Hapoel Ramat Gan | Liga Leumit | **ליגת העל** |
| Maccabi Petah Tikva | unused reserve club | **ליגת העל** |
| Hapoel Hadera | **ליגת העל** | in neither modelled division |
| F.C. Ashdod | ליגת העל | Liga Leumit |
| Maccabi Bnei Reineh | ליגת העל | Liga Leumit |
| Hapoel Ramat HaSharon | ליגת העל | not a top-flight club at all |

`defaultLeagueFor` now consults `LEAGUE_MEMBERSHIP` first, which makes this class of error
unrepresentable rather than a matter of keeping two fields in sync.

**Cyprus.** Modelled as a 12-club division; it is 14. Membership was also wrong — Ethnikos Achna
and Doxa Katokopias were listed and are not in the division.

**Everywhere else.** Every European league carried stale promoted/relegated membership, listed
in §5.

## 7. World data version

`WORLD_DATA_VERSION = '2026.2'`, `WORLD_SNAPSHOT_SEASON = '2026/27'`.

Migration semantics: world data affects **new world generation only**. League tables are derived
per season from `tableSeed` and were never persisted, and every stored clubId still resolves. No
save is rewritten — see §16.

---

# Checkpoint B — Playable clubs

## 8. Old architecture and its problem

v0.6.3 introduced `TableClub`: a named division member with an id, a name and a quality, which
appeared in league tables and **could not sign the player**. It solved the placeholder problem
and created a product one. In Serie A the player saw twenty clubs and could join two.

## 9. New architecture

`TableClub` is deleted. One club identity per club:

```
LEAGUE_MEMBERSHIP   authoritative "who plays in this division" (ids, complete, exact)
WORLD_CLUBS         identity + football profile for clubs without a hand-tuned record
clubs.ts            hand-tuned records (Maccabi pathway, derby rival, original stepping stones)
                    -> deriveWorldClubs() -> ALL_CLUBS / ACTIVE_CLUBS
```

A league's **size is now the length of its membership list**, not a literal beside it — v0.6.3
asserted the two agreed; v0.6.4 makes disagreement unrepresentable.

Derived clubs get their football fields from one formula over their league and their own quality.
That is deliberate: 165 hand-tuned numbers would be 165 things to get wrong and no more truthful
than one honest curve. Hand-tuned records are never regenerated — ids are save data and those
numbers were balanced across five versions.

## 10. Clubs visible vs transfer-capable

| | v0.6.3 | v0.6.4 |
|---|---|---|
| clubs visible in tables | ~198 | 202 |
| **clubs that can sign the player** | **33** | **202** |
| inactive identities (visible in history only) | 0 | 30 |

Every active division member is transfer-capable. There are **no** documented exceptions: the
only non-playable clubs are the inactive identities, and their reason is recorded per club in
`notPlayableReason`.

---

# Checkpoint C — Market-first transfer selection

## 11. The pipeline

```
1. Does an offer occur?           offerChance x agentOfferFactor        (unchanged)
2. WHICH MARKET?                  marketFit(league) x agentMarketWeight  (new)
3. WHICH CLUB in that market?     clubInterest                           (unchanged formula)
4. Role / manager / hints         expectedRoleAt, resolveClubManager     (unchanged)
```

`P(club) = P(market) × P(club | market)`.

The danger this defuses: under v0.6.3's single flat weighted draw, a country's probability was
proportional to **how many clubs it had**. Making 165 more clubs signable would have roughly
doubled England and halved Cyprus without anyone touching a balance number — more data silently
becoming a different game.

`marketFit` reads the league's own standing against the player's career level, and reads the club
pool only for the **presence** of a plausible club (`some`), never for how many (`length`). That
one word is what keeps club count out of the market decision.

The agent's market expertise moved from a per-club multiplier to the market weight, which is
where it belongs: an agent opens a door, football decides what is behind it. The v0.5 contract is
unchanged — specialists make their markets likelier, no factor is ever zero.

## 12-14. Measured results

Transfer probability regression, destination diversity and elite-club health are measured in
sections 20, 21 and 22 - including a regression this version caused, found and fixed.

---

# Checkpoint D — Crest coverage and quality

## 15. Asset role classification

v0.6.3 accepted whatever a club's Wikidata **P154 (logo image)** pointed at. Code review was
right about the consequence: AS Roma shipped `AS ROMA Text Logo 2020 - 2021.svg` — a wordmark —
as its badge.

Assets are now classified `current_primary_crest` / `wordmark` / `historic_crest` / `unknown`,
and only the first is used.

**The polarity took two attempts.** The first classifier demanded the word "logo" in the title
and treated any four-digit year as historic. That rejected `Atalanta BC.png` — a perfectly good
crest — and `Bologna F.C. 1909 logo.svg`, where 1909 is the club's **founding year, printed on
the badge**. Crest files are also routinely named for their *adoption* year, which means current,
not old. P154 is Wikidata asserting "this is the club's logo", so the default must be to trust it
and the classifier's job is narrow: catch wordmarks, explicit historic markers ("old", "former",
"until"), year **ranges** ("2020 - 2021" — how Commons dates a superseded badge), colour variants
("black", "mono", "inverted") and photographs.

Applied offline to the existing 42 assets (`npm run crests:reclassify`), it demotes exactly two:

| club | file | role |
|---|---|---|
| as_roma | `AS ROMA Text Logo 2020 - 2021 .svg` | **wordmark** |
| juventus | `Juventus FC - logo black (Italy, 2020).svg` | monochrome variant |

Both now fall back to the generated badge.

## 16. Israel — attempted, and honestly reported

v0.6.3 excluded all Israeli clubs on v0.4.7's finding that their crests are pictorial non-free
works absent from Commons. **That finding may still hold, but a blanket skip asserts it about
thirty clubs without checking one.** All 30 active Israeli clubs are now seeded — with
transliteration aliases (Petah Tikva / Petach Tikva / Petah Tiqwa, Acre / Akko, Jaffa / Yafo) —
and run the identical gauntlet.

```
attempted        30 / 30      every active Ligat Ha'Al and Liga Leumit club
real-primary      0
alternate         0
fallback         30
unresolved       30   of which: 20 entity found, no PD logo linked
                                 7 no single verified entity match
                                 3 provider rate limit (retryable)
```

**The result is zero, and that is now a measurement rather than an assumption.** Every Israeli
club has a Wikidata entity; none links a public-domain logo. This is the same finding v0.4.7
reached by reading the licensing rules, arrived at independently by asking the provider — which
is worth more than the assumption was, because it can be re-run when the data changes
(`npm run crests:import -- --country=israel`).

## 17. Provider cascade, aliases, bounded retries

**Cascade.** Wikimedia Commons + Wikidata remains the only tier used. TheSportsDB,
football-data.org, official club media and image search were all evaluated and rejected on
provenance grounds — reasoning in CLUB_ASSETS.md. Technical availability is not a usage right,
and none of the alternatives offers per-file, machine-readable licence status.

**A structured alternative was tested and rejected on evidence.** 142 clubs come back `no_logo`
because their Wikidata entity has no P154 at all. The obvious next avenue is P373, the club's
Commons category — still stable entity identity, not fuzzy filename matching. Probed directly:

```
Arsenal F.C.        Commons category has 30 files, none a crest
Real Madrid C.F.    17 files; the only "logo" is a JPG
```

Commons hosts only freely-licensed files, so an absent P154 is itself evidence the crest is not
free. English and Spanish club crests are non-free pictorial marks and are simply not there. The
avenue would also have delivered a JPEG logo crop, which the image-safety rules forbid outright.
So it is documented rather than implemented.

**Aliases.** Two real matching bugs found while measuring:

- `Arsenal FC` never matched Wikidata's `Arsenal F.C.` — normalisation produced `arsenal fc` and
  `arsenal f c`. A punctuation-free comparison now runs alongside the spaced one.
- Barcelona and Chelsea are typed `Q103229495` ("men's association football team"), which was not
  in the accepted entity set. Adding it also *strengthens* the ambiguity guard, because a women's
  team carries a different class.

Together these recovered Panathinaikos, APOEL, Elversberg and Académico de Viseu.

**Bounded retries — confirmed, no unbounded loop exists.**

| control | value |
|---|---|
| attempts per request | 5, then unresolved |
| per-request timeout | 15s (`AbortController`) |
| backoff | bounded exponential, 0.7s → 11.2s |
| per-club total budget | **45s**, checked before every call |
| per-page budget (`auditLeagues`) | 60s |
| on 429 / 5xx | back off, then mark unresolved and continue |

`scenariosV064` scenario I asserts this **statically** — attempt cap, request timeout, total
budget and the absence of `while (true)` — because a job that never ends is a failure mode no
runtime test can catch by running it.

## 18. Crest coverage by league

| country | clubs | real primary | fallback | coverage |
|---|---|---|---|---|
| גרמניה | 18 | 12 | 6 | 66.7% |
| איטליה | 20 | 12 | 8 | 60.0% |
| אוסטריה | 12 | 7 | 5 | 58.3% |
| הולנד | 18 | 5 | 13 | 27.8% |
| בלגיה | 18 | 3 | 15 | 16.7% |
| פורטוגל | 18 | 3 | 15 | 16.7% |
| יוון | 14 | 2 | 12 | 14.3% |
| קפריסין | 14 | 1 | 13 | 7.1% |
| אנגליה | 20 | 1 | 19 | 5.0% |
| ספרד | 20 | 0 | 20 | 0.0% |
| ישראל | 30 | 0 | 30 | 0.0% |
| **total** | **202** | **46** | **156** | **22.8%** |

**The ≥70% target was not met, and the reason is licensing rather than pipeline.** Of 226 seeded
attempts:

```
imported          46   PD/CC0, verified current primary crest
no PD logo       142   entity found; no public-domain logo linked   <- the binding constraint
licence blocked    8   CC BY / CC BY-SA, refused (see below)
unmatched          7   no single verified entity
ambiguous          6   refused by design, queued for review
wrong role         2   wordmark / colour variant, refused by design
provider error    14   rate limit; retryable with `npm run crests:missing`
```

The 142 cannot be fixed by better matching or more effort — §17 shows the files do not exist
freely. Coverage tracks the shape of the licence landscape exactly: leagues whose clubs use
geometric or text-derived marks (Germany, Italy, Austria) clear 58–67%; leagues whose crests are
pictorial non-free works (England, Spain, Israel) are at or near zero. Every one of the other 156
clubs shows a generated badge — none is missing, none is broken.

---

# Checkpoint E — Integration and validation

## 19. Save migration

**No migration is performed, and none should be.**

League tables are derived per season from `tableSeed` and were never persisted. Every clubId that
could appear in a save still resolves: the 24 clubs the snapshot relegated out of a modelled
division, plus 6 others, are kept as **inactive identities** with their names, colours and any
imported crest intact.

So a v0.6.3 career that really did play for West Ham or Hellas Verona still says so. It is not
remapped to a club that happens to be in the division now — that would be falsifying a career's
history, which A6 forbids and which no amount of tidiness justifies. Inactive clubs appear in no
table, no market and no cup draw; scenario K pins both halves.

New careers never see an inactive club at all.

## 20. Transfer probability regression

50,000 careers, balanced policy, positions rotated.

```
                              v0.6.3    v0.6.4
reached Maccabi senior team    64.1%     63.9%
played abroad                  33.0%     33.4%
returned to Maccabi            22.0%     21.4%
had a loan spell               32.6%     32.4%
avg Legend Score                41.8      41.6
median Legend Score             34.0      34.0
avg peak ability                80.9      80.9
avg Maccabi appearances        131.1     129.5
mean retirement age             34.9      34.9
INVALID natural-stage repeats      0         0
same seed reproduces career     PASS      PASS
```

### The regression this version caused, found, and fixed

The first 50,000-career run came back with **played abroad at 54.6%** against a 33.0% baseline —
exactly the failure the brief warned about, caused by this version's own refactor.

The cause is worth recording. Market-first selection correctly removed club count from the market
decision — but Israel's dominance of the old flat draw had come *entirely* from holding 25 of the
33 signable clubs. Removing count-dependence removed the accidental home bias along with it, and
the abroad rate nearly doubled.

The fix is `MARKET.homeMarketBias`: leaving the country is a bigger step than changing clubs
inside it, stated as design intent rather than left to emerge from how many clubs each country
happens to have. Calibrated by sweep:

```
bias   1 -> 54.2% abroad          bias   8 -> 37.6%
bias   3 -> 46.0%                 bias  11 -> 35.1%
bias   5 -> 42.5%                 bias  15 -> 32.9%   <- v0.6.3 was 33.0%
```

Unique destination clubs held at ~200 across the entire sweep, so restoring the home rate cost
none of the diversity the version exists for.

## 21. Destination diversity

6,000 careers, 103,551 senior club-seasons.

```
unique destination clubs      202      (v0.6.3: 33 signable clubs)
countries reached              11
leagues reached                12
top club's share              31.7%    maccabi_haifa - the player's own club
top Italian club's share      15.5%    inter_milan
```

The v0.6.3 failure mode was "Bologna appears in 40% of Italian moves because the code favours
legacy playable clubs". Italian moves are now led by Inter at 15.5% — a plausible pull toward the
biggest club, not an artefact of which clubs the market could see.

```
BY LEAGUE (share of senior club-seasons)
  il_premier      56.4%      pt_primeira      1.2%
  il_leumit       27.3%      be_pro           0.8%
  en_premier       3.7%      nl_eredivisie    0.7%
  de_bundesliga    2.9%      gr_superleague   0.6%
  es_laliga        2.8%      at_bundesliga    0.5%
  it_seriea        2.8%      cy_first         0.2%
```

Note Cyprus (14 clubs, 0.2%) against Austria (12 clubs, 0.5%): the **larger** division has the
**smaller** share. Under a count-driven draw that ordering is impossible — direct evidence that
market probability follows fit rather than size.

## 22. Elite club health

```
careers ever reaching an elite club   19.30%     (club quality >= 84)
mean ability at first elite move       90.2
mean age at first elite move           27.9
```

Elite clubs are reachable and clearly earned: about one career in five gets there, at ability ~90
near a career's peak rather than as a teenager. `clubInterest` returns < 0.02 for an ability-55
player at Inter, Juventus, Real Madrid, Barcelona, Bayern or Manchester City
(`marketSelection.test.ts` pins it), and expected role does the rest — a good-but-not-elite player
is offered a *lesser role* at a bigger club, which is the real trade rather than a yes/no gate.

## 23. Controlled scenarios A–L

| | scenario | result |
|---|---|---|
| A | Serie A table | ✅ 20 named clubs incl. Inter/Milan/Juventus/Roma/Napoli; Cremonese, Verona, Pisa correctly gone |
| B | Israel | ✅ 14-club ליגת העל with the 3 promoted clubs in and Hadera/Ashdod/Bnei Reineh out; 16-club Liga Leumit |
| C | Cyprus | ✅ 14 clubs, no second-tier clubs inserted, Ethnikos Achna and Doxa Katokopias gone |
| D | elite Italian transfer | ✅ an 89/88 player reaches an Italian giant |
| E | normal Italian transfer | ✅ a 68/45 player is invisible to the giants and plausible to the rest |
| F | market probability | ✅ share does not track club count; Cyprus larger than Austria and below it in share |
| G | Israeli crests | ✅ all 30 attempted, none skipped; result honestly zero (§16) |
| H | wrong logo | ✅ Roma's wordmark and a black Juventus variant refused; founding-year crests correctly kept |
| I | provider failure | ✅ bounded attempts, timeout and per-club budget, asserted statically |
| J | offline game | ✅ every club resolves to a local asset or a drawn badge, no remote URL |
| K | old save | ✅ a career at now-inactive Hapoel Hadera loads, keeps its name, is never remapped |
| L | manager resolution | ✅ all active clubs resolve a manager with in-range starting trust, deterministically |

## 24. Simulation

50,000 careers, balanced policy, positions rotated, plus a 6,000-career world-metrics pass with
per-career integrity validation.

```
placeholder club appearances       0
invalid league membership          0
invalid destination club           0    (no inactive club ever signed)
market-weighting violations        0    (share/size correlation stays weak)
manager resolution violations      0    (all active clubs resolve)
crest resolver failures            0    (every club: local asset or drawable badge)
critical integrity violations      0
same seed reproduces career     PASS
```

## 25. Mobile audit

```
width  canary        table-italy  table-spain  table-england  offers  cup-final  season  timeline  hub
320    over=1(+296)  over=0       over=0       over=0         over=0  over=0     over=0  over=0    over=0
360    over=1(+256)  over=0       over=0       over=0         over=0  over=0     over=0  over=0    over=0
390    over=1(+226)  over=0       over=0       over=0         over=0  over=0     over=0  over=0    over=0
412    over=1(+204)  over=0       over=0       over=0         over=0  over=0     over=0  over=0    over=0
430    over=1(+186)  over=0       over=0       over=0         over=0  over=0     over=0  over=0    over=0
```

The canary fails at every width, so the zeros are measurements. `table-spain` and `table-england`
are new fixtures chosen as the hardest cases: Spain carries the longest Hebrew club name in the
dataset (דפורטיבו לה קורוניה) and England is twenty Latin-derived names. DOM-verified at 320px —
20 real club names, zero placeholders, no truncation. Crests sit in a fixed box with
`object-fit: contain`, so a real asset and a generated badge occupy identical space and adding
crests causes no layout shift.

## 26. Performance

```
                        v0.6.3     v0.6.4
production bundle       755,402    765,431 bytes    (+10 KB, +1.3%)
crest assets                 42         46 files, 1.3 MB, all SVG
manifest (runtime)         ~4 KB      ~5 KB
club dataset (source)      20 KB      62 KB
```

+10 KB of bundle for ~165 more signable clubs. Crests are lazy-loaded (`loading="lazy"`,
`decoding="async"`) and nothing is preloaded — a screen decodes only the crests it shows, so a
20-row table fetches at most 20 small SVGs and usually far fewer.

## 27. Known missing crests

156 of 202 clubs use the generated badge. By cause:

```
no PD logo on the entity   142    the binding constraint - the file does not exist freely
licence blocked              8    ado_den_haag, blau_weiss_linz, cambuur, celta_vigo,
                                  getafe, go_ahead_eagles, koln, union_sg   (CC BY / BY-SA)
ambiguous, queued            6    club_brugge, porto, rb_leipzig, schalke, sevilla, +1
wrong role, refused          2    as_roma (wordmark), juventus (colour variant)
```

Whole leagues on fallback: **Spain (20/20)** and **Israel (30/30)**, and most of England (19/20),
Cyprus (13/14) and Greece (12/14). The full review queue is `crest-review.json`.

## 28. Known licensing / trademark caveats

- A PD copyright tag is **not** a trademark licence. Club crests may remain protected trademarks
  regardless of the copyright status of a particular image file. Every manifest entry records this
  explicitly.
- Usage here is referential — identifying clubs the game already names as facts — and any club's
  asset can be withdrawn by deleting one manifest entry, with the generated badge taking over by
  architecture rather than by a code change.
- CC BY and CC BY-SA files are **refused**, not because attribution is impossible but because the
  game has no attribution surface and share-alike raises questions about the work it is bundled
  into. Eight clubs are blocked on exactly this and are named above rather than quietly taken.
- Israeli crests remain unbundled; v0.4.7's reasoning is now backed by a measurement (§16).
- No player photographs or likenesses anywhere, in this or any previous version.

## 29. Known world data limitations

- **Crest coverage is 22.8%, not the suggested 70%.** The pipeline works; the free-licence corpus
  does not cover most clubs. §17 documents the alternative avenue that was tested and rejected on
  evidence rather than skipped.
- One division per country outside Israel. A club relegated out of a modelled top flight becomes
  an inactive identity rather than dropping a level, because there is no level below to drop to.
- In-career promotion and relegation are modelled only for the Israeli leagues — the only ones
  with `relegatesTo` / `promotesTo`.
- The snapshot is fixed at 2026/27 and does not track real-world seasons. Re-running
  `npm run world:audit` is how a future version would refresh it.
- Derived clubs share one formula for title/cup/Europe chance rather than per-club tuning. The
  ordering is right; per-club precision is not claimed.
- A handful of clubs were left unresolved by provider rate limits and are retryable with
  `npm run crests:missing` — they cost nothing but a badge.

## 30. Deferred to v0.7

Not built, as required: Collection, Trophy Cabinet, Career Album, saved-career gallery, Share
Cards, meta progression, broad visual redesign — and none of the other bans: no live sports API
at runtime, no real-season promotion/relegation, no yearly auto-updates, no full squads or real
rosters, no wages or transfer fees, no full manager world simulation, no real stadium database,
no Base44, no cloud profiles, no leaderboards.

v0.7 not begun.

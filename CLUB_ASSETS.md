# Club crest assets — pipeline, provenance and coverage (v0.6.4)

Extends CLUB_CRESTS.md (the v0.4.7 licensing research) with the automated ingestion pipeline
introduced in v0.6.3 and the quality/coverage work of v0.6.4.

## The pipeline

`scripts/importClubCrests.ts` — development-time only, never a runtime dependency:

```
seed (English name + aliases + country)          scripts/crestSeeds.ts
  → Wikidata search (wbsearchentities)
  → verification: label/alias match AND instance-of football club AND country match
  → P154 (logo image) → Commons file
  → ASSET ROLE classification                    scripts/crestRoles.ts
  → licence check (PD/CC0 family only)
  → local download to public/club-crests/
  → provenance manifest + generated runtime module
```

```
npm run crests:dry-run       report without downloading
npm run crests:import        full pass (-- --league=… / --country=…)
npm run crests:missing       incremental: only clubs not already resolved
npm run crests:reclassify    offline: re-check shipped assets against the role rules
```

No API credentials are required (`.env.example` documents that none exist to leak).

## Bounded network policy (v0.6.4)

A previous run stalled in an unbounded wait. Nothing in the pipeline can now:

| control | value |
|---|---|
| attempts per request | 5, then unresolved |
| per-request timeout | 15s (`AbortController`) |
| backoff | bounded exponential, 0.7s → 11.2s |
| **per-club total budget** | **45s**, checked before every call |
| per-page budget (`auditLeagues`) | 60s |
| on 429 / 5xx | back off, then mark unresolved and continue |

A provider outage costs the run a few unresolved clubs, never its progress. `scenariosV064`
asserts this statically — a job that never ends is a failure mode no runtime test can catch by
running it.

## Provider research

| provider | verdict | why |
|---|---|---|
| **Wikimedia Commons + Wikidata** | **used** | The only surveyed source with per-file, machine-readable licence provenance. A club's P154 points at a Commons file whose own `LicenseShortName` is inspectable at retrieval. |
| TheSportsDB | rejected | Community-uploaded badges; the uploader cannot grant rights over club artwork. Technical access ≠ redistribution rights. |
| football-data.org | rejected | Terms govern the *data*; crest files carry no redistribution grant. |
| official club media | rejected | Proprietary; press kits license media use, not embedding in a distributed game. |
| image search / logo sites | rejected | No inspectable provenance, and explicitly out of scope. |

## Licence rule

- **Ingested**: Commons licence tag matching `^(public domain|pd|cc0)` — the PD-textlogo class,
  marks below the threshold of originality, inspected per file.
- **Not ingested**: everything else. CC BY and CC BY-SA are *refused*, not because attribution is
  impossible but because the game has no attribution surface yet and share-alike raises questions
  about the work it is bundled into. Eight clubs are blocked on exactly this and are listed as
  known-missing rather than quietly taken.
- **Trademark, separately**: PD status is a *copyright* statement. Club crests can remain
  protected trademarks regardless. Every manifest entry carries a `trademarkNote` saying so.
  Usage here is referential — identifying clubs the game already names as facts — and any club's
  asset can be removed by deleting one manifest entry, with the generated badge taking over by
  architecture.

## Asset role (v0.6.4, the quality fix)

v0.6.3 accepted whatever P154 pointed at, and shipped a **wordmark** as AS Roma's badge. Assets
are now classified and only `current_primary_crest` is used:

| role | used? | caught by |
|---|---|---|
| `current_primary_crest` | ✅ | default — P154 is Wikidata asserting "this is the club's logo" |
| `wordmark` | ❌ | "text logo", "wordmark", "lettering", "logotype" |
| `historic_crest` | ❌ | "old", "former", "until", "retro", or a year **range** ("2020 - 2021") |
| `unknown` | ❌ | colour variants ("black", "mono", "inverted"), photographs, credited images |

**A bare year proves nothing.** The first version of this classifier treated any four-digit year
as historic and rejected `Bologna F.C. 1909 logo.svg`, where 1909 is the founding year printed on
the badge; crest files are also routinely named for their *adoption* year, which means current.
Requiring the word "logo" was equally wrong — it rejected `Atalanta BC.png`.

`scripts/crestRoles.ts` is shared by the importer and the offline reclassifier, so the two cannot
drift apart.

## Alias matching

Seeds carry the names clubs are actually known by (Inter / Internazionale / FC Internazionale
Milano; Sporting CP / Sporting Lisbon; PSV / PSV Eindhoven). Israeli transliteration varies most,
so those seeds carry the widest alias sets — Petah Tikva / Petach Tikva / Petah Tiqwa, Acre /
Akko, Jaffa / Yafo.

Two matching bugs were found and fixed in v0.6.4 while measuring coverage:

- **`Arsenal FC` never matched Wikidata's `Arsenal F.C.`** — normalisation produced `arsenal fc`
  and `arsenal f c`. A punctuation-free comparison is now made alongside the spaced one.
- **Barcelona and Chelsea are typed `Q103229495` ("men's association football team")**, which was
  not in the accepted entity set. Adding it also strengthens the ambiguity guard, since a women's
  team carries a different class.

## Ambiguity

A candidate is accepted only as the **single** entity passing label-match AND football-club AND
country-match. Two passing candidates is `ambiguous` — reported to `crest-review.json`, never
auto-picked. "Milan" can never fetch the wrong Milan. Reviewed resolutions are recorded as dated
`wikidata:` QIDs on the seed, and the importer **re-verifies them on every run**.

## Israel

v0.6.3 skipped Israeli clubs entirely. v0.6.4 seeds all 30 active ones and runs them through the
identical gauntlet. The result is a measurement rather than an assumption, and it is reported in
V064_REPORT.md §23 — including the fact that it is currently zero.

## Manifests

- `public/club-crests/manifest.json` — provenance per asset: provider, Wikidata QID, source file,
  source page, licence, **assetRole**, **verifiedCurrent**, retrieval date, trademark note.
- `src/data/clubCrests.generated.ts` — the runtime module: clubId → local path + licence.
- `crest-review.json` — the manual-review queue: ambiguous, wrong-role and unmatched clubs with
  the reason each was refused.

## Fallback

The generated badge (club colours + initials, drawn as SVG) is the identity for every club without
a verified current crest, **and** the error fallback for every club with one — a failed image load
re-renders the badge in place. There is no empty crest state, no broken image, and no runtime
hotlink; `getClubCrest` fails closed on any URL-shaped path.

## Israeli crest coverage (v0.6.5)

**54 of 62 active Israeli clubs show a real, verified-current crest** - 14/14 ליגת העל, 16/16
לאומית, 24/32 ליגה א׳. The 8-club tail is documented below.

### The regime, plainly

Israeli club crests are **non-free marks** - v0.4.7's research finding, re-confirmed by
measurement in v0.6.4 (zero PD logos across every then-active club). The project owner has
required real Israeli crests across three successive versions, so they are ingested under an
explicitly separate `referential` regime: full per-asset provenance, a licence status that says
plainly the asset is NOT claimed as free, a trademark note, and one-line removability. The
European `free-media` regime (PD/CC0-only) is unchanged, and `crestPipeline.test.ts` polices
each regime by its own rules - a referential entry claiming a PD licence fails the build.

### Provider cascade

1. **TheSportsDB**, sport-gated: accepted only when `strSport === 'Soccer'`, country Israel, and
   the name matches the alias set - Maccabi Tel Aviv basketball is structurally unmatchable.
2. **Hebrew Wikipedia** lead image: entity-first article resolution, football-category required,
   basketball-category rejected, lead image must classify as a crest (a stadium photo cannot
   ship as a badge). Oversized originals are re-fetched as 400px renders via MediaWiki's own
   thumb service.
3. **Manual curation** (E4): five clubs resolved by human review with the evidence recorded in
   the seeds - including מכבי אום אל-פחם, whose article states it is also known as
   צעירי אום אל-פחם, and the REJECTION of אחווה עראבה, a defunct same-town club fuzzy matching
   would have taken.

### The documented tail (8)

`maccabi_neve_shaanan, tzeirei_tamra, hapoel_arraba, maccabi_nujeidat, hapoel_bnei_musmus,
tzeirei_tira, beitar_yavne, mk_kfar_saba` - Liga Alef clubs attempted individually through
TheSportsDB, Hebrew Wikipedia (direct titles and full-text search) and Arabic Wikipedia; none
has a crest in any structured provider. Their visual identity lives on unscrapable social
pages, and a guessed badge is worse than the drawn fallback. `tests/israelCrests.test.ts`
asserts the tail both ways: nothing may join it silently, and a resolved club must leave it.


## v0.6.5.1 — European completion and the two regimes

Coverage after the v0.6.5.1 pass:

| league | before | after |
|---|---|---|
| England | 5% | **95%** |
| Spain | 0% | **95%** |
| Germany | 56% | **100%** |
| Italy | 55% | **100%** |
| Portugal | 11% | **100%** |
| Austria | 58% | **100%** |
| Cyprus | 7% | **100%** |
| Netherlands | 22% | **94%** |
| Belgium | 17% | **89%** |
| Greece | 14% | **79%** |
| **Europe** | **23.8%** | **95.3%** (164/172) |
| Israel | 86% | 86% (57/66) |

### Why a second regime rather than more retries

The Commons pipeline is structurally capped: v0.6.4 measured that 142 clubs have no PD logo on
their Wikidata entity, because English and Spanish crests are non-free pictorial marks Commons
does not host. `importEuroCrests.ts` therefore applies the same `referential` regime v0.6.5
established for Israel - non-free club marks, full per-asset provenance, no claim of free
licensing, removable per entry. The regimes stay separate in the manifest and
`crestPipeline.test.ts` polices each by its own rules.

### Wrong-entity protection, proven on live data

A candidate is accepted only when it is Soccer, in the right country, name-matched against the
club's alias set, male, and not flagged as a women's / youth / reserve / B side. On the live
sweep this refused:

- **Nottingham Forest** - the name-matching entity was a **netball** team
- **Kalamata** - **volleyball**
- **Deportivo** - matched "Deportivo Fabril", the **reserve** side

`tests/crestEntityGuards.test.ts` (11 tests) pins the gate against fabricated payloads with no
network: basketball Maccabi Tel Aviv, Arsenal Women/Ladies, Ajax U19/Reserves/B, Valencia of
Venezuela, and a verified club with no badge.

Two provider quirks were found by measuring rather than assuming: TheSportsDB calls it **"The
Netherlands"**, which alone rejected all fourteen Dutch clubs, and ten more clubs were hidden
behind missing aliases (Köln, Nacional de Madeira, Nea Salamis Famagusta, Krasava Ypsonas...).

### Asset size

26 MB -> **14 MB**. `scripts/optimizeCrests.ts` re-fetches oversized rasters at display size
through each provider's **own** resizing endpoint (TheSportsDB `/preview`, MediaWiki
`thumb.php`) - the same asset at the size it is actually drawn, not a re-encode or a crop, so
provenance is untouched. 131 files shrunk, 11.6 MB saved, SVGs left alone.

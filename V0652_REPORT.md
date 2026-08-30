# MACCABIST v0.6.5.2 — League Truth Hotfix

**Scope:** eliminate the remaining places where the game read a static `Club` field as a
statement about the present. No new features, no new data, no new crest imports, no rebalancing.

---

## 1. The defect, in one sentence

`Club.league`, `Club.tier` and `Club.seasonGames` describe where a club was when the dataset was
written; v0.6.5 made clubs move, and eleven call sites never learned.

## 2. What the player actually saw

Three things, all real, all reproduced before being fixed:

**A release offer named a division the club had left.** Hapoel Hadera's record still says
ליגת העל. The club has been in ליגה א׳ דרום since the 2026/27 snapshot. The offer chip said
ליגת העל, the offer *body* said "מליגת העל" from a second interpolation of the same stale field,
and then the engine correctly signed the player into Liga Alef. The text and the game disagreed.

**A relegated player kept his old schedule.** `levelContext` returned `club.seasonGames`, frozen
at derivation time. Relegation changed the table, the prize money and the opposition, and left
the fixture count untouched.

**Finished seasons were re-scored years later.** Every historical denominator — impact,
valuation, stagnation, the integrity ceiling, the season card's minutes box — divided
appearances by the club's *current* `seasonGames`. Promote the club and a completed season
silently changed value. That is the one with the hard rule attached: history is a record, not a
query.

## 3. The model, stated

Three contexts that were being conflated, now named and kept apart:

| context | question it answers | authority |
| --- | --- | --- |
| static identity | who is this club | `Club` — id, name, colours, country, crest |
| current world | where does it play **now** | `currentLeagueOf(world, club)` |
| historical season | where did it play **then** | `SeasonRecord.leagueId` |

`src/game/leagueTruth.ts` is the single authority. `src/game/leagueSchedule.ts` holds the pure
fixture-count formula, split out only so the club dataset can derive against it without an
import cycle.

The hard rule is enforced structurally, not by convention: `historicalLeagueId` takes a
`SeasonRecord` and nothing else. It has no access to a `WorldState`, so it *cannot* derive
history from the current world even by accident.

## 4. Save compatibility

`SeasonRecord.leagueId` is **optional**. `SCHEMA_VERSION` is unchanged at 4.

New records carry the id. Records written before v0.6.5.2 carry only the display name, and
`historicalLeagueId` resolves that name against the league table — returning `null`, not a
guess, when even that fails. A v0.6.5.1 save loads with its full history intact and its
historical schedules correctly resolved. Pinned by test D5.

## 5. Repository-wide audit

Every read of `club.league`, `club.tier` and `club.seasonGames`, classified.

### `club.league` / league identity

| site | classification |
| --- | --- |
| `rules.ts:81` `levelContext` | **FIXED** → `currentLeagueOf(career.world, club)` |
| `transferEngine.ts:433` release offer chip | **FIXED** → `currentLeagueName` |
| `transferEngine.ts:439` release offer **body text** | **FIXED** → same resolved name, one interpolation |
| `transferEngine.ts:580` senior contract offer | **FIXED** → `currentLeagueName` |
| `transferEngine.ts:603` immediate youth loan | **FIXED** → `currentLeagueName` |
| `transferEngine.ts:208, 251, 387` other offers | already correct — `leagueOf(...).name` since v0.4.1 |
| `worldEngine.ts:33` `leagueOf` | **CENTRALIZED** — now delegates to `currentLeagueOf` |
| `bugReport.ts:128` | already correct — `leagueOf(...).id` |
| `data/clubs.ts`, `youthClubs.ts`, `academy.ts` literals | **SAFE STATIC IDENTITY** — dataset source, documented non-authoritative |
| `data/academy.ts` stage leagues | **SAFE STATIC IDENTITY** — academy age-group leagues do not move |
| `types/index.ts` `Club.league` | **COMPATIBILITY ONLY** — doc-comment added, fallback for unmodelled clubs |

### `club.seasonGames` / schedule

| site | classification |
| --- | --- |
| `rules.ts:83` `levelContext` | **FIXED** → `leagueSeasonGames(currentLeague, …)` |
| `worldEngine.ts:82` `playerImpact` | **FIXED** → `seasonFixtures(record)` |
| `integrity.ts:120` `plausibleFixtures` | **FIXED** → `seasonFixtures(record)` |
| `integrity.ts:241` minutes share | **FIXED** → `seasonFixtures(record)` |
| `marketEngine.ts:50` valuation minutes | **FIXED** → `seasonFixtures(last)` |
| `marketEngine.ts:397` `isStagnating` | **FIXED** → `seasonFixtures(last)` |
| `SeasonCards.tsx:204` historical minutes box | **FIXED** → `seasonFixtures(record)` |
| `SeasonCards.tsx:146` *current* mid-season box | **SAFE** — this one really is about now; `levelContext` is correct here and is now itself correct |
| `participation.ts:60`, `seasonEngine.ts:236, 333, 369` | **SAFE** — read `level.seasonGames`, correct once `levelContext` was fixed |
| `progressionEngine.ts:1173`, `academy.ts` | **SAFE STATIC IDENTITY** — academy stage schedules |
| `types/index.ts` `Club.seasonGames` | **COMPATIBILITY ONLY** — doc-comment added |

### `club.tier`

Audited and left alone, deliberately. `tier` never meant "which division"; it means "what kind
of move is this for a player", which is why `israeli_low` and `euro_dev` are separate bands.
The codebase already keeps the two apart cleanly — `conditions.ts:149` gates events on
`club.tier` (career band) while `conditions.ts:184` gates on `league.tier` (division level), and
that is correct in both places. Every `league.tier` read comes from `leagueOf`/`getLeague` and is
authoritative. Test E2 pins the decoupling so nobody later "fixes" `tier` to match the league.

**Divergence measured:** 21 of 268 clubs have a `club.league` that disagrees with world truth.
Five are genuinely in a different division (Hapoel Hadera, Hapoel Petah Tikva, Hapoel Ramat Gan,
Hapoel Nof HaGalil, Hapoel Umm al-Fahm); the rest are naming drift such as
`ליגה לאומית` vs `הליגה הלאומית`. Both kinds now resolve to the same string everywhere.

## 6. A second leak, found by the tests

Writing the schedule test surfaced something the audit had not: the fixture formula added
European nights from **club quality alone**, with no reference to the division.

Relegate a strong club to Liga Leumit and it kept eight European fixtures in a division that
qualifies nobody — while `europeChance` correctly sat at zero, because *that* function did check
`europePlaces`. Two systems, one right and one wrong, and the disagreement swallowed. The leak
was invisible while schedules were frozen and became live the moment they started following the
world, so this fix ships with the change that exposed it: European fixtures now require
`leagueShape(leagueId).europePlaces > 0`.

## 7. A test that was measuring the wrong thing

`tests/longevity.test.ts` failed after the fix: a maximum minutes share of 0.979 against a cap
of 0.9.

It was dividing appearances by the club's static `seasonGames` — the same stale denominator this
version removes. The engine now plays the league's real schedule; the test was still measuring
against a number that no longer described anything. Corrected to `seasonFixtures(record)`, and
it passes. The cap itself was not touched.

Worth stating plainly because it cuts the other way too: **relegation does not mean a shorter
season.** Liga Alef has 18 clubs to Ligat Ha'Al's 14, so its round-robin is 34 games against
26 + 7 playoff. A relegated player plays a *longer* league season. The first draft of the test
asserted otherwise, and the code was right.

## 8. Scenarios

`tests/leagueTruth.test.ts` — 18 tests.

| # | scenario | result |
| --- | --- | --- |
| A1 | current league matches world membership, all 268 clubs | ✅ |
| A2 | disagrees with the static field exactly where the snapshot moved a club | ✅ |
| A3 | follows a club relegated inside a career | ✅ |
| A4 | agrees with `worldEngine.leagueOf` for every club | ✅ |
| B1 | world says Liga Alef → `levelContext` says Liga Alef | ✅ |
| B2 | moved club (Hapoel Hadera) reads correctly from an untouched world | ✅ |
| B3 | schedule follows the division on relegation | ✅ |
| B4 | no European fixtures in a division that qualifies nobody | ✅ |
| B5 | round-robin derived from the division's real size | ✅ |
| C1 | no offer, over 60 seeds, advertises a league its club is not in | ✅ |
| C2 | release offer **body text** says ליגה א׳ דרום, never מליגת העל | ✅ |
| D1 | recorded league survives the club being promoted | ✅ |
| D2 | finished season scored against its own schedule | ✅ |
| D3 | `playerImpact` identical however the world changed since | ✅ |
| D4 | — folded into D2/D3 | — |
| D5 | pre-v0.6.5.2 record resolves by league name | ✅ |
| D6 | unresolvable league still returns a usable number | ✅ |
| E1 | `club.league` still present for fallback | ✅ |
| E2 | `tier` stays decoupled from the division | ✅ |

## 9. Checkpoint D — crest policy

**No import pass was run.** This checkpoint is verification only, as the brief requires.

| division | coverage | policy | status |
| --- | --- | --- | --- |
| ליגת העל | **14/14 — 100%** | must remain 100% | ✅ held |
| הליגה הלאומית | **16/16 — 100%** | must remain 100% | ✅ held |
| ליגה א׳ (both districts) | **27/36 — 75%** | gaps acceptable temporarily | ⚠️ documented, not claimed complete |
| Europe (10 modelled divisions) | **144/152 — 94.7%** | no regression | ✅ held |

Israel is **not** 100% and this report does not say it is. The nine Liga Alef clubs without a
verifiable current crest are listed individually in `tests/israelCrests.test.ts`, where the tail
is asserted in both directions so it can neither grow silently nor hide a club that has since
been resolved.

The European figure uses modelled league membership as its denominator. v0.6.5.1 reported
164/172 on a wider basis that also counts 20 European clubs outside a modelled division, all of
which have crests; 144/152 and 164/172 are the same manifest measured two ways.

Six new regression tests in `tests/crestEntityGuards.test.ts` pin all of the above — including
`expect(have).toBeLessThan(total)` for Liga Alef, so the honest tail cannot be quietly papered
over, and a check that every manifest entry points at a file that exists.

## 10. Verification

> **Correction (v0.6.5.3):** the test count below is 927, taken from a full-suite run that was
> started before the last six Checkpoint D crest tests were added. The v0.6.5.2 tree holds
> **933**. The suite was green at both counts; only the number was stale.

```
tests                     927 passed / 927   (49 files)
typecheck (src)           clean
typecheck (tests)         clean
production build          clean, 821.76 kB / 219.16 kB gzip
```

50,000 careers, balanced policy, positions rotated — the same basis as the v0.6.5.1 baseline:

```
                              v0.6.5.1   v0.6.5.2
reached Maccabi senior team     63.9%      63.9%
played abroad                   33.3%      33.2%
returned to Maccabi             21.4%      21.3%
had a loan spell                32.0%      31.8%
avg Legend Score                 41.6       41.8
median Legend Score              34.0       34.0
avg peak ability                 80.9       80.9
avg Maccabi appearances         129.3      132.5
mean retirement age              34.9       34.9
```

```
INVALID natural-stage repeats        0
registered behind own cohort         0
identical event sequences         0.0%
same seed reproduces career       PASS
different seeds diverge           PASS
distinct events used               182
```

Determinism is the one that mattered most here: this version changed the fixture count that
drives every season loop, and a schedule that varied by anything other than league identity
would have broken seed reproducibility immediately. It did not.

### The one figure that moved, and why

**Average Maccabi appearances 129.3 → 132.5 (+2.5%).**

Maccabi Haifa is a hand-authored club, and its literal `seasonGames: 42` simply disagreed with
its own division. Ligat Ha'Al's real schedule for a club of quality 76 is 43: 26 round-robin
(14 clubs) + 7 playoff + 2 cup + 8 European. One extra fixture per season, across a career, is
+2.5% appearances.

That is a truth correction rather than a balance change — the stale number was not a considered
balance decision, it was a typo-grade disagreement between a club record and the league it
plays in, and nothing had been reading the league until now. Every probability that describes
the *shape* of a career is unchanged, which is the requirement for a hotfix.

The remaining deltas — loan spells 32.0% → 31.8%, Legend Score 41.6 → 41.8 — are within run
noise at this sample size.

### A false alarm, recorded

A partial run showed the per-position `europe` column at 0.0% and briefly looked like a serious
regression. It was the tail of a **loyalist**-policy run, a strategy whose whole point is never
leaving. The balanced run reads 26.8–33.7% by position. Nothing was wrong; noting it because the
0.0% was alarming enough to be worth chasing, and chasing it was correct.

## 11. Not done, on purpose

Per the brief: no Liga Bet, no Liga Gimel, no new events, no transfer redesign, no rebalancing,
no new crest-provider infrastructure, no European import pass, and no v0.7 work.

### Observed, documented, not implemented

- **`Club.league` could be deleted outright.** Every engine read is gone; it now survives only as
  a display fallback for clubs outside a modelled division. Removing it is a dataset-wide edit
  with save implications, which is not a hotfix.
- **`Club.seasonGames` is likewise fully derived** and could become a pure function call at every
  site. Same reasoning.
- **The 21 naming-drift clubs** (`ליגה לאומית` vs `הליגה הלאומית`) could be normalised in the
  dataset. Harmless now that nothing reads the field, but it is a real inconsistency in the data.

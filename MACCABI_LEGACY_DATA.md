# Maccabi Legacy — Historical Data Documentation

**Rebuilt in v0.6.1 at the corrected statistical scope.** Every exact historical number shown to
the player traces to this file.

---

## 1. The scope correction (v0.6.1)

v0.6 used **league-only** historical totals, on the stated belief that the game's
`SeasonRecord.stats.appearances` was league-scope. **That belief was wrong.**

The evidence is in the game's own club data:

| club | league | europeChance | `seasonGames` |
|---|---|---|---|
| Maccabi Haifa | ליגת העל | 0.22 | **42** |
| Maccabi Tel Aviv | ליגת העל | 0.20 | **42** |
| Hapoel Haifa | ליגת העל | 0.01 | **36** |
| Hapoel Kfar Saba | ליגת העל | 0.00 | **36** |
| AZ Alkmaar | Eredivisie (34 league matches) | 0.16 | **46** |

`seasonGames` differs *between clubs in the same league* and tracks `europeChance`. League
fixtures are identical for every club in a league, so a club-specific, Europe-correlated figure
cannot be a league count. AZ Alkmaar settles it: the Eredivisie plays 34 league matches and the
game gives AZ 46.

**The game models all competitive senior matches.** Cups are separate trophy rolls that add no
appearances, but the fixture count already includes cup and European football.

### Why this mattered, measured

Over 4,000 simulated careers:

| record | scope | % of careers that beat it |
|---|---|---|
| 495 (v0.6, league) | wrong | **12.2%** |
| 717 (v0.6.1, all competitions) | correct | **1.1%** |

An all-time club appearance record should be rare. At the wrong scope it was routine.

## 2. Historical snapshot

**End of the completed 2025/26 season.** All sources accessed **2026-08-29**. The club page
listed 15 championships (through 2022/23) on that date. All pantheon members are retired; totals
are static. The in-game career begins 2030/31; the baseline never moves, and the game does not
invent fictional historical players to defend records in the 2026–2030 gap (documented
limitation, by design).

## 3. Stat scope definition

**All competitive senior first-team matches for Maccabi Haifa, across every spell.**

- **Included**: league, State Cup, Toto Cup, European competition.
- **Excluded**: friendlies, youth/academy football, matches for any other club.
- **Multi-spell players are summed across all spells** (Katan, Benado, Atar, Benayoun, Mizrahi).

Declared in code as `MetricScope = 'all_competitive'` on every record category, with a test
asserting the whole ranking shares one scope.

## 4. Source hierarchy and what was used

Per the official-first policy:

1. **Official Maccabi Haifa** — the club's record book, *used and cited*.
2. Official IFA / UEFA — no structured historical per-player tables located.
3. Statistical databases — not needed given 1 and 4 agreed.
4. Wikipedia — the primary tabular source, cross-checked against 1.

### Correction to v0.6's documentation

v0.6 stated: *"the club's official site does not publish structured historical league-appearance
tables."* **This was false and is retracted.** The official record book
(mhaifafc.com — "המוזיאון הירוק – ספר השיאים של מכבי חיפה") publishes **per-competition** splits:

- אלון חרזי — **494 league appearances** (the official league record), plus **64 cup** and
  **93 Toto Cup** appearances.
- זאהי ארמלי — **90 league goals** (the official league scoring record).
- דני שמולביץ־רום — 20 State Cup goals (competition record).
- אלון מזרחי and יניב קטן — 15 European goals each (competition record).

Harazi's 494 + 64 + 93 = 651 domestic, which with European ties corroborates the 717
all-competition total used here. The two sources agree; they simply answer different questions.

**Note:** the official *league* record (494) differs by one from the Wikipedia career-table sum
v0.6 used (495). Since v0.6.1 uses all-competition totals throughout, neither number appears in
the game — but the discrepancy is recorded here because v0.6's report cited 495 as fact.

| ref | source | accessed |
|---|---|---|
| official-records | https://www.mhaifafc.com/news/22678 — "המוזיאון הירוק – ספר השיאים" | 2026-08-29 |
| wiki-players | https://en.wikipedia.org/wiki/List_of_Maccabi_Haifa_F.C._players — **the primary table**; its own note: *"Appearances and goals are for first-team competitive matches only; friendly matches are excluded."* | 2026-08-29 |
| wiki-club | https://en.wikipedia.org/wiki/Maccabi_Haifa_F.C. — honours, club records | 2026-08-29 |
| wiki-harazi | https://en.wikipedia.org/wiki/Alon_Harazi | 2026-08-29 |
| wiki-katan | https://en.wikipedia.org/wiki/Yaniv_Katan | 2026-08-29 |
| wiki-benado | https://en.wikipedia.org/wiki/Arik_Benado | 2026-08-29 |
| wiki-aharoni | https://en.wikipedia.org/wiki/Eitan_Aharoni | 2026-08-29 |
| wiki-davidovich | https://en.wikipedia.org/wiki/Nir_Davidovich | 2026-08-29 |
| wiki-atar | https://en.wikipedia.org/wiki/Reuven_Atar | 2026-08-29 |
| wiki-boccoli | https://en.wikipedia.org/wiki/Gustavo_Boccoli | 2026-08-29 |
| wiki-armeli | https://en.wikipedia.org/wiki/Zahi_Armeli | 2026-08-29 |
| wiki-benayoun | https://en.wikipedia.org/wiki/Yossi_Benayoun | 2026-08-29 |
| wiki-berkovic | https://en.wikipedia.org/wiki/Eyal_Berkovic | 2026-08-29 |
| wiki-mizrahi | https://en.wikipedia.org/wiki/Alon_Mizrahi | 2026-08-29 |

**Why one table for the numbers.** Every appearance and goal figure comes from `wiki-players` —
a single table with a single declared scope. v0.6 scraped each player's own page separately,
which is exactly how mixed scope enters a ranking. Individual pages are now used only for
championships, captaincy and spell dates.

## 5. The pantheon (19 members) — all competitions

| player | pos | era | apps | goals | titles | captain |
|---|---|---|---|---|---|---|
| אלון חרזי | DF | 1991–2009 | **717** | 42 | **8** | yes |
| יניב קטן | FW | 1998–2005, 2006–2014 | 557 | 94 | 6 | yes |
| אריק בנאדו | DF | 1991–94, 1996–2006, 2010–11 | 522 | 13 | 5 | yes |
| איתן אהרוני | DF | 1979–1994 | 478 | 12 | 5 | — |
| ניר דוידוביץ׳ | GK | 1995–2013 | 460 | 0 | 7 | — |
| ישעיהו שוגר | DF | 1963–1976 | 410 | 17 | — | — |
| ראובן עטר | MF | 1986–94, 1996–97, 2000–02 | 375 | 102 | 5 | — |
| אהרון גרשגורן | MF | 1964–1978 | 371 | 36 | — | — |
| יוסי קרמר | MF | 1974–1990 | 371 | 9 | — | — |
| גוסטבו בוקולי | MF | 2004–2015 | 364 | 37 | 4 | — |
| ברוך ממן | MF | 1974–1987 | 364 | 53 | — | — |
| דני שמולביץ־רום | FW | 1958–1971 | 326 | 98 | — | — |
| אשר אלמני | MF | 1952–1968 | 307 | 50 | — | — |
| אייל ברקוביץ׳ | MF | 1990–1996 | 276 | 50 | 2 | — |
| אברהם מנצ׳ל | MF | 1952–1964 | 257 | 83 | — | — |
| יחזקאל גרשוני | GK | 1958–1973 | 238 | 0 | — | — |
| זאהי ארמלי | FW | 1982–1992 | 233 | **119** | 3 | — |
| יוסי בניון | MF | 1998–2002, **2014–2016** | 210 | 70 | 2 | yes |
| אלון מזרחי | FW | 1993–94, 1994–1999 | 129 | 97 | 1 | — |

**Records**: appearances — Harazi **717**; goals — Armeli **119**; championships — Harazi **8**.

## 6. What changed from v0.6, value by value

Every number changed, because every number changed scope. The material corrections:

| player | v0.6 (league) | v0.6.1 (all comps) | note |
|---|---|---|---|
| Harazi | 495 / 29 | **717 / 42** | record holder; official league split 494+64+93 corroborates |
| Katan | 464 / 80 | **557 / 94** | |
| Benado | 400 / 9 | **522 / 13** | |
| Aharoni | 368 / 7 | **478 / 12** | |
| Davidovich | 385 / 0 | **460 / 0** | |
| Atar | 198 / 49 | **375 / 102** | v0.6's league figure was badly under-scoped |
| Boccoli | 434 / 39 | **364 / 37** | v0.6's 434 "league" **exceeded** his 364 all-competition total — impossible, and the clearest proof of the scope error |
| Armeli | 179 / 90 | **233 / 119** | goals record holder |
| Berkovic | 128 / 25 | **276 / 50** | |
| **Benayoun** | 130 / 55 | **210 / 70** | **v0.6 omitted his entire 2014–2016 second spell**, in which he captained the club and won the State Cup |
| Mizrahi | 91 / 63 | **129 / 97** | |
| Revivo | 57 / 45 | **removed** | 78/65 all-comps; dropped to keep the pantheon at 19 with stronger benchmarks |

**Added** (impossible at league scope — no per-player league tables exist for these eras, which
is why v0.6 had to omit them): Schwager 410, Gershgoren 371, Kramer 371, Maman 364,
Shmulevich-Rom 326, Almani 307, Menchel 257, Gershoni 238.

The Boccoli case deserves naming: v0.6 recorded 434 "league" appearances for a player whose
**all-competition** total is 364. A league figure cannot exceed an all-competition figure. That
single contradiction was sufficient to prove the dataset was mis-scoped, and it is the reason
the whole set was rebuilt from one table rather than patched player by player.

## 7. Known limitations — stated, not hidden

1. **Wikipedia is a secondary source.** Its `wiki-players` table declares its scope and is
   corroborated by the official record book on the figures the club publishes, but individual
   values may be revised. The snapshot is what those pages said on 2026-08-29.
2. **Championships are unknown for the pre-1983 generation** and recorded as `undefined` rather
   than guessed — the club's first championship was 1983/84, so most historic-era members
   legitimately have none, but distinguishing "none" from "unrecorded" is not possible from
   these sources. The championships ladder therefore ranks only the players with sourced counts.
3. **Captaincy is a boolean**, recorded only where a source states it (Harazi, Katan, Benado,
   Benayoun). No captain-appearance totals exist in any source and none are claimed in-game.
4. **Clean sheets are not sourced per player** and are not used as a historical category;
   goalkeeper legacy runs through appearances, longevity, titles and leadership.
5. **The official league record (494) differs by one** from the Wikipedia career-table sum
   (495). Neither is used in-game under the all-competition scope; recorded for transparency
   because v0.6's report asserted 495.
6. **Records do not evolve in the fictional 2026–2030 gap.** The baseline is frozen at the
   snapshot.

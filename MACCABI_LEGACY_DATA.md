# Maccabi Legacy — Historical Data Documentation (v0.6)

Every exact historical number shown to the player traces to this file.

## Historical snapshot

**End of the completed 2025/26 season**, as reflected by the sources on the access date. All
sources accessed **2026-08-29**. The club page listed 15 championships (through 2022/23) on that
date, so no title was added in 2023/24–2025/26. All pantheon members are retired; their totals
are static.

The in-game career begins in 2030/31. The baseline never changes during play, and the game does
**not** invent fictional historical players who improve on these records in the gap years
(Phase 41 limitation, by design).

## Stat scope definition

**League appearances and league goals only.**

The game's `SeasonRecord.stats.appearances` is derived from the club's league fixture count
(`seasonGames`), so game totals are league-scope. Historical benchmarks therefore use the
league-scope rows of each player's career-statistics table — never the all-competition totals
(e.g. Alon Harazi's 717 all-competition appearances are *not* used anywhere).

Championships are counted as titles won in seasons the player was at the club, per each
player's honours section.

**Excluded**: cup appearances, European appearances, friendlies, academy/youth appearances.

## Sources

| ref | source | accessed |
|---|---|---|
| wiki-club | https://en.wikipedia.org/wiki/Maccabi_Haifa_F.C. (honours, records) | 2026-08-29 |
| wiki-players | https://en.wikipedia.org/wiki/List_of_Maccabi_Haifa_F.C._players (discovery only — its tables are all-competition scope and are NOT used numerically) | 2026-08-29 |
| wiki-harazi | https://en.wikipedia.org/wiki/Alon_Harazi | 2026-08-29 |
| wiki-katan | https://en.wikipedia.org/wiki/Yaniv_Katan | 2026-08-29 |
| wiki-boccoli | https://en.wikipedia.org/wiki/Gustavo_Boccoli | 2026-08-29 |
| wiki-benado | https://en.wikipedia.org/wiki/Arik_Benado | 2026-08-29 |
| wiki-davidovich | https://en.wikipedia.org/wiki/Nir_Davidovich | 2026-08-29 |
| wiki-aharoni | https://en.wikipedia.org/wiki/Eitan_Aharoni | 2026-08-29 |
| wiki-atar | https://en.wikipedia.org/wiki/Reuven_Atar | 2026-08-29 |
| wiki-armeli | https://en.wikipedia.org/wiki/Zahi_Armeli | 2026-08-29 |
| wiki-benayoun | https://en.wikipedia.org/wiki/Yossi_Benayoun | 2026-08-29 |
| wiki-berkovic | https://en.wikipedia.org/wiki/Eyal_Berkovic | 2026-08-29 |
| wiki-mizrahi | https://en.wikipedia.org/wiki/Alon_Mizrahi | 2026-08-29 |
| wiki-revivo | https://en.wikipedia.org/wiki/Haim_Revivo | 2026-08-29 |

Wikipedia was used because the club's official site does not publish structured historical
league-appearance tables, and Wikipedia's career-statistics tables are themselves compiled from
league records with a consistent scope across players — which is the property this dataset needs
most. Where a page's prose and its table disagreed, the table won. Discrepancies are listed
below rather than hidden.

## The pantheon (12 members)

| player | pos | era | league apps | league goals | championships | captain |
|---|---|---|---|---|---|---|
| אלון חרזי (Alon Harazi) | DF | 1990–2009 | 495 | 29 | 8 | yes |
| יניב קטן (Yaniv Katan) | FW | 1998–2014 | 464 | 80 | 6 | yes |
| גוסטבו בוקולי (Gustavo Boccoli) | MF | 2004–2015 | 434 | 39 | 4 | — |
| אריק בנאדו (Arik Benado) | DF | 1991–2011 | 400 | 9 | 5 | yes |
| ניר דוידוביץ׳ (Nir Davidovich) | GK | 1994–2013 | 385 | 0 | 7 | — |
| איתן אהרוני (Eitan Aharoni) | DF | 1979–1994 | 368 | 7 | 5 | — |
| ראובן עטר (Reuven Atar) | MF | 1986–2002 | 198 | 49 | 5 | — |
| זאהי ארמלי (Zahi Armeli) | FW | 1982–1989 | 179 | 90 | 3 | — |
| יוסי בניון (Yossi Benayoun) | MF | 1998–2002 | 130 | 55 | 2 | — |
| אייל ברקוביץ׳ (Eyal Berkovic) | MF | 1989–1996 | 128 | 25 | 2 | — |
| אלון מזרחי (Alon Mizrahi) | FW | 1993–1999 | 91 | 63 | 1 | — |
| חיים רביבו (Haim Revivo) | MF | 1994–1996 | 57 | 45 | 0 | — |

### Per-player derivations

- **Harazi**: 209 (1990–97) + 286 (1998–2009) = 495 league apps; 14+15 = 29 goals. "Won 9
  league championships … 8 of those with Maccabi Haifa"; finished his career as captain.
- **Katan**: 225 + 239 = 464 apps; 41+39 = 80 goals; 6 championships listed; club captain
  2006–2014.
- **Boccoli**: 434 apps / 39 goals; 4 championships (2004-05, 05-06, 08-09, 10-11).
- **Benado**: 71 + 304 + 25 = 400 apps; 2+7+0 = 9 goals; article text: "five league
  championships". Captaincy: the Katan article names Benado as Katan's predecessor as club
  captain.
- **Davidovich**: 385 apps, 0 goals; 7 championships listed; described as a club "symbol".
- **Aharoni**: 368 apps / 7 goals; 5 championships (1983-84 … 1993-94).
- **Atar**: 198 apps / 49 goals across three spells; 5 championships listed.
- **Armeli**: 179 apps / 90 goals; "remains the club's record goalscorer with 90 league goals";
  3 championships.
- **Benayoun**: 130 apps / 55 goals; 2 championships (2000-01, 2001-02).
- **Berkovic**: 128 apps / 25 goals; 2 championships (1990-91, 1993-94).
- **Mizrahi**: 38+53 = 91 apps; 28+35 = 63 goals; 1 championship (1993-94); shares the
  single-season record of 28 league goals.
- **Revivo**: 57 apps / 45 goals; no championship (State Cup 1994-95); twice league top scorer.

## Club-level facts

- **Championships: 15** — 1983-84, 1984-85, 1988-89, 1990-91, 1993-94, 2000-01, 2001-02,
  2003-04, 2004-05, 2005-06, 2008-09, 2010-11, 2020-21, 2021-22, 2022-23. [wiki-club]
- **State Cups: 6** — 1961-62, 1990-91, 1992-93, 1994-95, 1997-98, 2015-16. [wiki-club]
- **Single-season league goals: 28** — Alon Mizrahi (1993-94) and Shlomi Arbeitman (2009-10).
  [wiki-club]

## Known discrepancies and limitations — stated, not hidden

1. **Harazi appearances, 419 vs 495.** The club page's records section says "most league
   appearances: 419"; Harazi's own career-statistics table sums to 495. The dataset uses **495**
   because the career-table scope is the one applied consistently to every member (the same
   tables produced every other number here), and because 419 cannot be reconciled with his
   listed spells under any scope we could identify. The in-game record book is internally
   consistent either way — every member is measured by the same ruler.
2. **Benado's championship count** — article prose says "five" while its honours list is
   broader. Recorded as 5, per the prose.
3. **Historic-era players** (Shmulevich-Rom, Schwager, Almani, etc.) appear in the
   all-competition list but lack reliable league-scope tables; they are **omitted** rather than
   included with mixed-scope numbers.
4. Wikipedia is a secondary source. Its career tables are the most scope-consistent public
   dataset available, but individual figures may be revised; the snapshot is what those pages
   said on 2026-08-29.
5. **Captaincy** is recorded only as a boolean where sources state it plainly. No
   captain-appearance totals exist in the sources and none are claimed in-game (Phase 39).
6. Clean sheets are not reliably sourced per player and are **not** used as a historical
   category; goalkeeper legacy runs through appearances, longevity, titles and leadership
   (Phase 11).

# Maccabist v0.6 — Maccabi Legacy

> What will Maccabi remember about you?

v0.6 gives the game its fourth concept. Ability says how good you are. The global career score
says how far you went. Maccabism says how you feel about the club. **Maccabi Legacy says what
you actually did in green — measured against the real men who did it before you.**

At retirement, two careers with the same ability no longer feel remotely identical. The game
can now say *you were a great footballer* and *you were not a Maccabi legend* in the same
breath — or: *you never became the biggest star in Europe, but in green, you became immortal.*

---

## 1. Build

```
npm run build     ✓ built in ~1.0s
npx tsc --noEmit  clean (app and test projects)
```

## 2. Test count

```
Test Files  35 passed (35)
Tests      728 passed (728)
```

v0.5.2 ended at 694. The 34 new tests: the historical dataset validator (10), the legacy
scenario suite (24 — scenarios A–L plus mechanics).

## 3. v0.5.2 baseline, recorded before work began

```
commit a0407f4          694 tests, build clean
reached Maccabi senior team   63.3%
played abroad                 31.8%
returned to Maccabi           22.1%
avg / median Legend Score     43.8 / 36.0
avg Maccabi appearances       129.4
integrity                     30,000/30,000 clean
```

## 4. Phase 1 audit — what already existed

Three legacy-adjacent systems predated v0.6, and none was what the brief calls Maccabi Legacy:

| system | what it is | v0.6 disposition |
|---|---|---|
| `legendEngine` (מדד אגדה) | already Maccabi-weighted, with a Europe component mixed in | **untouched** — it stays the ending-narrative score; regression baselines depend on it |
| `legacyEngine` (LegacyStatus) | in-career per-club standing (fan_favourite/icon/legend) | untouched, except its red-rendering shield icon (below) |
| `storyEngine` ARCHETYPES | narrative ending vocabulary | untouched — legacy archetypes are a separate, deterministic read |

The key audit finding: the existing "Legend Score" was *already* mostly a Maccabi measure, so
the brief's separation is delivered by **adding** a true global read (`globalCareerScore`) and
a truth-derived Maccabi Legacy — not by mutating a score that every baseline, test and ending
depends on. Phase 63 confirmed the payoff: regression vs v0.5.2 is nil.

Found during the audit: `legacyEngine.LEGACY_ICONS.icon` still carried U+1F6E1 — the shield
Segoe UI Emoji renders **red**, the exact class v0.5.1 fixed on the poster, missed because
this map predates that test. Swapped to the gold star. No red prestige identity anywhere.

## 5. Historical research methodology

Live web research against English Wikipedia, all pages accessed **2026-08-29**. The club page
supplied honours and club records; each pantheon member's numbers come from **his own
career-statistics table** — one source class, one scope, every member measured by the same
ruler. The all-competition table on the club players list was used for *discovery only* and
never numerically. Where prose and table disagreed, the table won; where neither was reliable,
the value is `undefined`, never a guess.

## 6. Historical snapshot

**End of the completed 2025/26 season.** The club page listed 15 championships (through
2022/23) on the access date, so no title was added 2023/24–2025/26. All pantheon members are
retired; totals are static. The in-game career starts 2030/31; the baseline never moves, and
the game does **not** invent fictional historical players to defend records in the gap years
(Phase 41 — documented limitation, by design).

## 7. Stat scope definition

**League appearances and league goals only.** The game's `SeasonRecord.stats.appearances`
derives from the club's league fixture count, so game totals are league-scope — and the
benchmarks match it. Alon Harazi's famous 717 all-competition appearances appear nowhere in
the game; his 495 *league* appearances are the record the player chases.

## 8. Sources

Fourteen source refs, each with URL and access date, in `MACCABI_LEGACY_DATA.md`. Every exact
number in the dataset must literally appear in that document — a test fails CI otherwise
(Phase 73).

## 9. The curated pantheon (12 members)

| player | pos | era | apps | goals | titles |
|---|---|---|---|---|---|
| אלון חרזי | DF | 1990–2009 | **495** | 29 | **8** |
| יניב קטן | FW | 1998–2014 | 464 | 80 | 6 |
| גוסטבו בוקולי | MF | 2004–2015 | 434 | 39 | 4 |
| אריק בנאדו | DF | 1991–2011 | 400 | 9 | 5 |
| ניר דוידוביץ׳ | GK | 1994–2013 | 385 | 0 | 7 |
| איתן אהרוני | DF | 1979–1994 | 368 | 7 | 5 |
| ראובן עטר | MF | 1986–2002 | 198 | 49 | 5 |
| זאהי ארמלי | FW | 1982–1989 | 179 | **90** | 3 |
| יוסי בניון | MF | 1998–2002 | 130 | 55 | 2 |
| אייל ברקוביץ׳ | MF | 1989–1996 | 128 | 25 | 2 |
| אלון מזרחי | FW | 1993–1999 | 91 | 63 | 1 |
| חיים רביבו | MF | 1994–1996 | 57 | 45 | 0 |

Records: appearances — Harazi 495; goals — Armeli 90; championships-by-player — Harazi 8.
Captaincy recorded as a boolean only where sources state it (Harazi, Katan, Benado); no
captain-appearance totals exist and none are claimed (Phase 39).

## 10. Legacy architecture

```
ABILITY            career.ability / peakAbility        (unchanged)
GLOBAL CAREER      globalCareerScore(career)           (new, display-only)
MACCABISM          career.maccabism                    (v0.4.8 guard unchanged)
MACCABI LEGACY     maccabiLegacy.ts                    (new, first-class)
```

`maccabiLegacyFacts` re-derives everything from settled `SeasonRecord`s: Maccabi senior
seasons only, loans-away excluded, trophies filtered to `clubId === MACCABI_ID`. It does not
read the `career.maccabi.*` counters — and the integrity validator asserts the two independent
derivations are **equal** on every career, which is how "one truth" is proven rather than
assumed. UI components calculate nothing; they render selectors (Phase 2).

## 11. Maccabi Legacy formula

Weights (sum 100), targets tuned against the real pantheon:

| component | weight | target | note |
|---|---|---|---|
| longevity (league apps) | 26 | 420 | between Benado (400) and Katan (464); curve^0.7 |
| seasons | 10 | 12 | a genuine era, not a spell |
| achievement (titles) | 24 | 4 championships + a cup | curve^0.8; Boccoli's haul ≈ full |
| leadership (captain seasons) | 14 | 5 | Katan wore it 8 years |
| contribution (position-normalised) | 14 | 60 | `outputScore` — GK clean sheets, striker goals |
| club story | 6 | — | academy graduate 0.5 + *real* return 0.5 (2+ seasons, 40+ apps) |
| relationship (Maccabism) | 6 | — | **gated by appearances/120** — feeling amplifies, never substitutes |

No double counting (Phase 13): every point reads a fact once — trophies from the trophy list,
the return from the career record, never from memories.

## 12. Position normalization

`outputScore` already normalises production per position; everything else is position-blind.
Measured max legacy by position over 1,800 balanced careers: CB 100, FB 97, CM 97, WG 100,
ST 97, **GK 97** — and the GK scenario reaches **הסמל** on 448 appearances, three titles and
five captain seasons with zero goals. Clean sheets are not compared historically (unsourced —
Phase 11's rule against invented history).

## 13. Legacy ranks

Four tiers in the game's own language, score + **hard gates**:

| rank | score | hard gate |
|---|---|---|
| שחקן מכבי | — | — |
| יקיר הקהל | 34+ | 70+ apps |
| אגדה ירוקה | 65+ | 200+ apps and (2+ titles or 3+ captain seasons) |
| הסמל | 88+ | 340+ apps, 11+ seasons, 3+ captain seasons **and** 3+ titles |

The first symbol gate was measured before tightening: a long stay alone made 12% of balanced
and 24% of loyal careers "הסמל", with the symbol *outnumbering* the legend tier. The symbol is
the full package or nothing. After: 3.6% balanced / 12.8% loyal / 0.8% ambitious.

Icons are green and gold only (🟢 💚 ⭐ 👑) — the v0.5.1 brand rule, enforced by the badge
test class.

## 14. Career archetypes

Rank says how big; archetype says what shape. Ten archetypes, deterministic priority, every
predicate a fact of the record: הסמל, אגדה ירוקה, הבן האובד, הכוכב האירופי, המנהיג, יקיר
הקהל, פורח מאוחר, שחקן מכבי, אורח לרגע, קריירה בחוץ. Primary + up to two secondary tags.

**הבן האובד requires the whole journey** (Phase 17): a real Maccabi spell (100+ apps total),
a real departure, 3+ seasons elsewhere, a real return, and 2+ seasons of football after it. A
rejected foreign offer or a homecoming spent on the bench does not qualify — asserted both
directions.

## 15. Historical record book

Three categories, each historically compatible with game scope: league appearances, league
goals, championships-with-Maccabi. `historicalStanding` gives rank among (pantheon + player),
the name directly above, the gap, and distinct **tie** / **break** facts (matching 495 equals
the record; the 496th appearance breaks it). The dataset is immutable — display uses
`max(history, player)`, and a mutation canary plus the validator guard it.

## 16. Milestones

Twelve live milestones: appearances 50/100/200/300/400, top-10/top-3 of the real ladder,
tying and breaking Harazi's 495, the goals top-10 and Armeli's 90, first captaincy. Announced
at settlement — the moment the season record they read comes into existence — via the
**announced ledger** (`career.legacyMilestones`), the only persisted legacy state. Exactly
once, structurally (Phase 26); totals and milestones survive leaving and returning because
facts are summed over all Maccabi senior records (Phases 43, 56).

Reconciliation: `maccabi_debut` and `first_championship` already existed in the milestone
system and are **not** duplicated (Phase 13).

### A bug the integrity scan caught on first run

The record-TIE predicate used `===`. A player who tied at 495 and then played a 496th game
had an announced milestone whose threshold "was not met" — 0.2% of a 5,000-career smoke scan,
every one of them a player who tied and kept playing. Milestone predicates must be
**monotonic**: having-once-tied never un-happens. Fixed and rescanned clean.

## 17. Career Memory / Timeline / Season Summary integration

Four new memory kinds (`maccabi_century`, `maccabi_top10_appearances`,
`maccabi_appearance_record`, `first_maccabi_captaincy`) — narrative facts for event gating,
never statistics. Major milestones land on the Career Timeline (thresholds 50 stays minor —
Phase 28's restraint). Season Summary shows one compact green line when that season crossed a
milestone, selected from the timeline the engine already wrote.

## 18. Retirement integration

The poster carries **two scores honestly** — מדד אגדה and the global career read — plus a
מורשת מכבי block: legacy score, rank, primary archetype with its line, secondary tags, and
the historical standing sentence. A 90-global/34-green career shows both without inflating
either (Phase 35); a career that never touched Maccabi gets "קריירה בחוץ" and no forced
legend language (Scenario L).

## 19. Legacy events (Phase 64)

Seven, not dozens: the century night, entering the top ten (chasing history in the papers can
fuel *or* crush — a real tradeoff), the record night, the first armband conversation, the
academy visit, the star abroad asked about home, and the first home game after a return. None
can grant appearances, trophies or records (Phase 65). Maccabism moves only on explicitly
tagged fans/people/return outcomes — the achievement itself never moves it (Phase 66), and
the whole-catalogue audit still shows 0 unlabelled mutations.

## 20. Save migration (Phases 44–45)

Only the announced ledger persists; everything else derives. A v0.5.2 veteran loading with
235 appearances is marked as having **lived** the 50/100/200 milestones — zero retroactive
popups, zero backdated timeline entries — while the 300 he crosses later fires normally. All
asserted in Scenario I tests, including idempotence. `hydrateCareer` remains identity on a
fresh career.

## 21. Integrity validator

Five new codes: `duplicate_legacy_milestone`, `milestone_before_threshold`,
`legacy_score_out_of_bounds`, `symbol_without_contribution`, `legacy_facts_counter_mismatch`
(the agreement check between the legacy derivation and the v0.4.8 counters — two independent
derivations, proven equal on every career). 28 codes in total now.

## 22. Controlled scenarios A–L

| | scenario | result |
|---|---|---|
| A | one-club Maccabi player | ✅ facts exact, score ≥85, הסמל |
| B | European superstar, little Maccabi | ✅ global ≥65, legacy <35, **not** הסמל, הכוכב האירופי |
| C | prodigal son | ✅ full journey qualifies; benched return does not |
| D | goalkeeper legend | ✅ הסמל with zero goals |
| E | fan favourite | ✅ devotion ≠ crown; Maccabism 100 with 8 apps < 20 legacy |
| F | record tie/break | ✅ three distinct facts, milestone exactly once |
| G | leave and return | ✅ 203+100 = 303, no reset |
| H | trophy separation | ✅ Maccabi 2, global 5 |
| I | old save | ✅ derived correctly, no milestone flood, next threshold fires |
| J | academy only | ✅ senior record 0, low legacy, no ranking |
| K | captain without records | ✅ leadership lifts score, invents no appearances |
| L | non-Maccabi career | ✅ legacy ≤6, honest global score, graceful language |

## 23. Simulation methodology

50,000 careers through `validateCareerIntegrity` (all 28 codes); distribution metrics over
1,800 balanced + 900 loyal + 900 ambitious careers with positions cycled; regression at 3,000
balanced careers against the recorded v0.5.2 baseline.

## 24. Legacy Score distribution

```
balanced   p50=33  p90=82  p99=97  max=100
loyal      p50=8   p90=97          max=97     (bimodal: all-in or never-made-it)
ambitious  p50=16  p90=65  p99=89  max=97

BY CAREER TYPE (balanced)
  maccabi senior careers   p50=63  p90=84  max=100
  one-club Maccabi         p50=75  p90=93  max=97
  homecoming               p50=54  p90=83  max=100
  european                 p50=29  p90=80  max=100
```

## 25. Rank distribution

```
            player   fan_favourite   green_legend   symbol
balanced     51.9%       21.9%          22.6%        3.6%
loyal        69.0%        4.4%          13.8%       12.8%
ambitious    70.3%       21.1%           7.8%        0.8%
```

Top ranks rare, meaningful, attainable — and the loyal path is the widest road to the crown,
which is what the crown means.

## 26. Position distribution

Max legacy by position (balanced): CB 100 · FB 97 · CM 97 · WG 100 · ST 97 · GK 97. No
position is structurally excluded from the top (Phase 11 / criterion 11).

## 27. Strategy comparison

```
            avgGlobal   symbol%   european_star archetype
balanced      58.4        3.6%        10.1%
loyal         52.5       12.8%         ~0%
ambitious     60.2        0.8%        24.0%
```

Ambition wins the world and almost never the crown; loyalty wins the crown and cedes the
world. No strategy dominates both dimensions (Phase 62 strategy health) — the tradeoff is the
product.

## 28. Regression vs v0.5.2 (Phase 63)

```
                              v0.5.2    v0.6
reached Maccabi senior team    62.8%    62.8%
played abroad                  31.4%    31.5%
returned to Maccabi            21.9%    22.3%
avg Legend Score                43.8     43.8
median Legend Score             36.0     36.0
avg Maccabi appearances        129.4    130.1
INVALID natural-stage repeats      0        0
```

Legacy observes, derives and celebrates; it does not change career generation. The only
engine-side additions are deterministic milestone announcements at settlement and seven
events in the pool.

## 29. The 50,000-career simulation

```
v0.6 INTEGRITY SCAN — 50,000 careers, balanced policy

clean careers   50,000 / 50,000   100.00%

No violations in any category.

All 28 codes active: the twelve from v0.4.8, seven from v0.5, four from
v0.5.1, and the five legacy codes added here — including the agreement check
between the legacy derivation and the v0.4.8 counters, and the monotonic
milestone-threshold invariant that caught the record-tie bug on its first
5,000-career smoke run.
```

## 30. Mobile audit

The legacy sheet — score head, numbers grid, proximity line, three record ladders with the
player's row inside the real names, comparisons — probed at **320/360/390/412/430px: zero
overflow at all five**, with the 600px canary failing at every width. Content verified from
the DOM at 360px: rank + archetype + "עוד 58 הופעות — איתן אהרוני 368" + the player at #7 in
the appearance ladder. Gameplay loop untouched: PLAYER → SEASON → EVENT → DECISION, legacy
one tap away.

## 31. Known historical-data limitations

Stated fully in `MACCABI_LEGACY_DATA.md`; the headlines:

1. **Harazi 419 vs 495** — the club page's records line disagrees with his own career table.
   The dataset uses 495 (the scope applied consistently to every member) and documents the
   conflict.
2. Historic-era greats (Shmulevich-Rom, Schwager, Almani…) are **omitted** — only mixed-scope
   numbers exist for them.
3. Wikipedia is a secondary source; the snapshot is what its pages said on 2026-08-29.
4. Captaincy is a boolean; no captain-appearance totals exist or are claimed.
5. Clean sheets are not sourced per player and are not compared historically.
6. Records do not evolve in the fictional 2026–2030 gap; the baseline is frozen (Phase 41).

## 32. Known gameplay limitations

- Game seasons cap near 36 league games, so beating 495 requires a genuinely exceptional
  one-club career — reachable (max observed legacy 100) but rare, as a record should be.
- The championships ladder compares the player's count against per-player historical counts
  whose season-attribution conventions vary slightly between sources.
- `loyal` policy's legacy distribution is bimodal by construction (never leaves → either the
  full life or an early exit); the median of 8 reflects careers that never reached Maccabi.

## 33. Deferred to v0.7 — explicitly not implemented

Collection screen · Trophy Cabinet · Career Album · saved-career gallery · share
posters/cards · broad visual redesign (Legionnaire-inspired IA) · meta progression. Also not
implemented: historical player photos, fictional historic competitors, full captaincy match
logs, new football attributes.

**v0.7 was not started.**

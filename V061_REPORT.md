# Maccabist v0.6.1 — Legacy Truth, Cup & Narrative Coherence

> Make v0.6 true.

v0.6's architecture was sound. Code review and playtesting found that several things it *said*
were not true: the historical benchmarks used the wrong statistical scope, two systems could
both award "הסמל", a State Cup vanished from the career summary, a neutral final borrowed the
player's club colour, and 111 meaningful decisions still showed the player a percentage next to
the word "הצלחה".

Five checkpoints, each committed stable.

---

## 1. Build

```
npm run build     ✓ built in ~1.0s
npx tsc --noEmit  clean (app and test projects)
```

## 2. Test count

```
Test Files  36 passed (36)
Tests      754 passed (754)
```

v0.6 ended at 728. New: the cup/derby truth suite (13), Checkpoint B separation and prodigal
tests (6), historical scope validators (4), and the D6 outcome validators (3).

## 3. v0.6 baseline

```
commit d0b39a8          728 tests, build clean
reached Maccabi senior team   62.8%
played abroad                 31.5%
returned to Maccabi           22.3%
avg / median Legend Score     43.8 / 36.0
avg Maccabi appearances       130.1
integrity                     50,000/50,000 clean
```

---

# Checkpoint A — Historical data truth

## 4. The scope error

v0.6 benchmarked against **league-only** totals, on the stated belief that
`SeasonRecord.stats.appearances` was league-scope. That belief was wrong, and the game's own
club data proves it:

| club | league | europeChance | `seasonGames` |
|---|---|---|---|
| Maccabi Haifa | ליגת העל | 0.22 | **42** |
| Maccabi Tel Aviv | ליגת העל | 0.20 | **42** |
| Hapoel Haifa | ליגת העל | 0.01 | **36** |
| Hapoel Kfar Saba | ליגת העל | 0.00 | **36** |
| AZ Alkmaar | Eredivisie — 34 league matches | 0.16 | **46** |

`seasonGames` differs *between clubs in the same league* and tracks `europeChance`. League
fixtures are identical within a league, so a club-specific, Europe-correlated count cannot be
league-only. AZ Alkmaar settles it: 34 real league matches, 46 in the game.

**The game models all competitive senior matches.**

### Measured consequence

| record | scope | careers beating it (n=4,000) |
|---|---|---|
| 495 (v0.6, league) | wrong | **12.2%** |
| 717 (v0.6.1, all competitions) | correct | **1.1%** |

An all-time club appearance record should be rare. At the wrong scope it was routine.

### The smoking gun

v0.6 recorded **Gustavo Boccoli: 434 "league" appearances**. His **all-competition** total is
**364**. A league figure cannot exceed an all-competition figure. That single contradiction was
enough to prove the set mis-scoped, and is why it was rebuilt from one table rather than patched
player by player.

## 5. Historical snapshot

**End of the completed 2025/26 season.** All sources accessed **2026-08-29**. Static and
immutable; the game does not invent fictional historical players to defend records in the
2026–2030 gap.

## 6. Stat scope definition

**All competitive senior first-team matches for Maccabi Haifa, across every spell.** League,
State Cup, Toto Cup and Europe included; friendlies, academy football and other clubs excluded.
Declared in code as `MetricScope = 'all_competitive'` on every record category.

## 7. Source hierarchy — and a correction to v0.6

Official-first, per A1:

1. **Official Maccabi Haifa** — the club's record book, **now used and cited**.
2. Official IFA / UEFA — no structured historical per-player tables located.
3. Statistical databases — not needed; 1 and 4 agreed.
4. Wikipedia — the primary *tabular* source, cross-checked against 1.

> **v0.6 stated: "the club's official site does not publish structured historical
> league-appearance tables." This was false and is retracted.**

The official record book ("המוזיאון הירוק – ספר השיאים") publishes **per-competition** splits:
Harazi **494 league + 64 cup + 93 Toto**; Armeli **90 league goals**; Shmulevich-Rom 20 State
Cup goals; Mizrahi and Katan 15 European goals each. Harazi's 494+64+93 = 651 domestic, which
with European ties corroborates the 717 all-competition total. The two sources agree — they
answer different questions.

**One table for the numbers.** Every appearance and goal figure now comes from a single
Wikipedia table whose own note reads *"Appearances and goals are for first-team competitive
matches only; friendly matches are excluded."* v0.6 scraped each player's page separately, which
is exactly how mixed scope enters a ranking. Individual pages now supply only championships,
captaincy and spell dates.

## 8. Every value changed — because every value changed scope

| player | v0.6 (league) | v0.6.1 (all comps) | note |
|---|---|---|---|
| Harazi | 495 / 29 | **717 / 42** | record holder |
| Katan | 464 / 80 | **557 / 94** | |
| Benado | 400 / 9 | **522 / 13** | |
| Aharoni | 368 / 7 | **478 / 12** | |
| Davidovich | 385 / 0 | **460 / 0** | |
| Atar | 198 / 49 | **375 / 102** | v0.6 badly under-scoped |
| Boccoli | 434 / 39 | **364 / 37** | the contradiction that exposed the error |
| Armeli | 179 / 90 | **233 / 119** | goals record holder |
| Berkovic | 128 / 25 | **276 / 50** | |
| **Benayoun** | 130 / 55 | **210 / 70** | **v0.6 omitted his entire 2014–16 spell** — in which he captained the club and won the State Cup (the brief's A4 case, confirmed) |
| Mizrahi | 91 / 63 | **129 / 97** | |
| Revivo | 57 / 45 | removed | dropped to keep 19 stronger benchmarks |

**Added** — impossible at league scope, since no per-player league tables exist for these eras
(which is why v0.6 had to omit them): Schwager 410, Gershgoren 371, Kramer 371, Maman 364,
Shmulevich-Rom 326, Almani 307, Menchel 257, Gershoni 238.

Pantheon: **12 → 19 members**, spanning 1951–2016, with two goalkeepers and four defenders.

## 9. Historical data validator

`tests/maccabiHistory.test.ts`, 14 tests. New in v0.6.1:

- **one metric scope across every ranking** — the assertion that would have caught this in v0.6
- **multi-spell players summed** — Benayoun's era must contain 2014, totals must match
- goals may never exceed appearances (the Boccoli contradiction, forbidden structurally)
- the official source is cited and used
- every exact number appears literally in `MACCABI_LEGACY_DATA.md`, so a silent edit to either
  side fails CI

## 10. Corrected record book

```
appearances   1. חרזי 717   2. קטן 557   3. בנאדו 522   4. אהרוני 478   5. דוידוביץ׳ 460
goals         1. ארמלי 119  2. עטר 102   3. מזרחי 97    4. שמולביץ־רום 98  5. קטן 94
championships 1. חרזי 8     2. דוידוביץ׳ 7  3. קטן 6
```

## 11. A9 — recalibration after the data change

Distribution re-measured: p50 33 (unchanged), symbol rate 3.1% (was 3.6%), position maxima
intact, GK max 100. Nothing broke, so **per A9's explicit instruction the formula was not
adjusted.** Noted in Known Issues that the score's internal longevity target (420) now sits
lower relative to the pantheon than it did at league scope.

---

# Checkpoint B — One legacy authority

## 12. Global greatness vs Maccabism vs Maccabi Legacy

| concept | question | authority |
|---|---|---|
| Global career | how impressive was the whole career? | `globalCareerScore`, `legendEngine` |
| Maccabism | how does he feel about the club? | `career.maccabism`, v0.4.8 guard |
| **Maccabi Legacy** | **what does he mean in Maccabi history?** | **`maccabiLegacyRank` / `maccabiArchetypes` — sole authority for הסמל and אגדה ירוקה** |

## 13. Old ending system migration

**Three** systems could award "הסמל" and "אגדה ירוקה": `storyEngine.ARCHETYPES`, `endings.ts`,
and `maccabiLegacy` — and the poster's headline came from the first, so it could crown a player
the Legacy system had ranked יקיר הקהל.

What remains, and what lost authority:

- `legendEngine` / מדד אגדה — **kept**, as career greatness. Every baseline and test depends on
  it; it names no rank.
- `storyEngine.ARCHETYPES` — **kept as narrative flavour**, titles retired to descriptive
  language: "אגדה ירוקה" → "קריירה גדולה בירוק", "הסמל" → "מועדון אחד".
- `endings.ts` — **kept for the story prose only**, same retitling.
- `maccabiLegacy` — **sole authority** for Maccabi-specific prestige ranks.

A test asserts no other system may use either word.

## 14. Retirement reconciliation

The headline is now the Legacy **career archetype**, which also covers non-Maccabi careers
(הכוכב האירופי, אורח לרגע, קריירה בחוץ) — so no career is forced into prestige language it did
not earn (B4). Gold trim follows the Legacy rank rather than retired ending ids.

Verified from the DOM at 360px: headline **הסמל**, מדד אגדה **86**, קריירה עולמית **80**, and
the מורשת מכבי block reading **95 · הסמל** with secondary tags — headline and block now
*agree*, which is the entire point of the checkpoint.

## 15. B5 — geography from data, not display strings

`legendEngine` inferred Europe from `s.league !== 'ליגת העל'` — the same defect class v0.4.8
removed from the retirement screen. It counted **every Liga Leumit season** as European (the
name is 'הליגה הלאומית', also `!== 'ליגת העל'`) **and every academy season**. A player who
dropped to the Israeli second division scored as if he had gone abroad.

Now `isForeignSeason`, which reads the club's country. This is the one deliberate scoring change
in v0.6.1 and its effect is measured in §24.

## 16. B6 — goalkeeper fairness in the global score

Audited: `legendEngine` already passes the keeper's clean sheets to the shared `outputScore`,
and `globalCareerScore` uses no output term at all. Pinned with a parity test — a GK and a CB
with comparable careers land within 12 legacy points, and the GK scenario still reaches הסמל
with zero goals.

## 17. B8 — the prodigal son must actually play

v0.6 required 2+ seasons after the return and 100+ **career** Maccabi appearances. A farewell
tour satisfies both: the appearances were banked years earlier in the first spell.

Added `postReturnAppearances` — derived from the records by finding the last non-Maccabi season
and summing everything after it — and the archetype now requires **60+**. Asserted both ways: a
6-appearance ceremonial return is refused despite passing every v0.6 condition; a 90-appearance
return qualifies. The same rule now gates the "real return" story points.

---

# Checkpoint C — Cup and match-context truth

## 18. State Cup typed trophy

Already correct and verified: `TROPHY_DEFS.cup` is `{ id: 'cup', name: 'גביע המדינה' }`. No
generic display string anywhere.

## 19. Trophy reconciliation — the real bug

Traced end to end for a cup won at Hapoel Kfar Saba: the trophy record is correct, it reaches
the **season record**, the **timeline**, and the Maccabi counter (correctly **0**, since it was
not won at Maccabi) — and then **retirement showed only `career.trophies.length`**.

A player who won the State Cup with Hapoel Kfar Saba saw *"תארים בקריירה: 1"* and never saw the
words גביע המדינה on the one screen that sums a career up.

Added `trophySummary` — a derived selector grouping trophies by competition with the clubs they
were won at — and a named list at retirement. Verified in the DOM: **🥇 גביע המדינה ×2**.
Asserted: named, exactly once, club attribution preserved, survives a later transfer, not
credited to Maccabi Legacy, and reconciling with the trophy list across real careers.

## 20. Neutral cup final presentation

`sen_cup_final` described *"אצטדיון מלא, חצי ירוק"* — it asserts the player's club plays in
**green** at a **neutral** final. False for most clubs in the game, and exactly what the
playtest read as the venue belonging to somebody.

- Text rewritten to describe the occasion and both ends of the stadium, claiming no colour.
- Recategorised `competition`, which now maps to a new **`final`** visual variant: gold on dark,
  the competition's own identity, equal for both clubs.
- The app's chrome stays Maccabist green — that is the *game's* identity. The venue does not
  borrow the current club's.

An audit of the same class across the catalogue found one more (a veteran "ending in green" at
whatever club he happened to be at — reworded) and one false positive ("אור ירוק" is the idiom
*green light* — left alone).

## 21. Derby authority — the report did not reproduce

Tested directly for Hapoel Kfar Saba:

```
rivalryBetween(kfar_saba, umm_al_fahm)  = null   (both directions)
derbyRival(kfar_saba)                    = null
isDerbyEligible(kfar_saba career)        = false
derby-gated events eligible, all slots   = none
matchContext for derby events            = null
derby text in real simulated careers     = none
```

All five events using the word are gated on `requiresDerby`, and no code path generates it
dynamically. **I could not reproduce the reported instance and the guard already holds.**

Rather than invent a fix for a defect I cannot locate, the guarantee is locked so it can never
regress: the C8 scenario as a deterministic test, plus a **C10 static validator** asserting any
event whose text contains דרבי is derby-gated — and that only `localDerby` earns the word, so
the Israeli Clasico (a `majorRivalry`) can never drift into it.

Scenario H confirms a real derby still works: the Haifa derby is recognised and its events stay
reachable.

---

# Checkpoint D — Outcome quality

## 22. The audit, defined correctly first

"Missing preview" flags 224 outcomes — but the decision system has **three tiers** (the
outcome's own preview → a shared label for a recognisable id → the bare valence), and only the
third is the defect. Measured through the existing `isGenericLabel`:

```
total outcomes audited                    582
generic (tier-3 fallthrough)              208
  ...in MEANINGFUL choices (>1 outcome)   111   ← the real number
```

### After

```
generic labels in meaningful choices        0
```

All 111 now carry concrete, forward-tense football text, derived from each outcome's own
resolved narrative so preview and result describe one event:

| before | after |
|---|---|
| החלטה טובה | המאמן ימצא דרך לשחק עם שניכם |
| תוצאה רעה | משפט אחד ייצא מהקשרו ויהפוך לכותרת |
| כישלון כבד | השוער ינחש, והשקט באצטדיון יהיה רועש מכל דבר |
| תוצאה טובה | דקה 79, השם שלך, ושבע דקות שתזכור |

### Remaining exceptions, and why

**97 single-outcome choices** keep the internal fallback, per D5. A choice with one outcome is a
certainty, not a gamble — the player is not weighing odds, and the resolved text (which always
exists) carries the meaning. Making these fail validation would demand custom text for branches
that are not decisions.

## 23. Validators

Three, so it cannot regress: no meaningful outcome may reach a generic label; **a preview may
not merely restate the valence** (D3 — renaming "החלטה טובה" to "תוצאה חיובית" is the same bug,
so valence words *and* sub-12-character previews both fail); and preview and resolution remain
fields of one outcome object (D4).

## 24. Decision Reveal regression

Untouched. The v0.4.8 flow — cycle → decelerate → lock the resolved outcome → hold ~1s → narrate
— is unchanged, and now locks onto the **specific** new text rather than a valence word. The
`reveal-locked` scene probes clean at all five widths.

---

# Checkpoint E — Integrity, simulation, regression

## 25. Save migration

v0.6 saves load unchanged. `legacyMilestones` and all career history are untouched. Derived
values legitimately change with the corrected data — historical rank, record gap, next
benchmark — which is the intended effect of fixing the scope. No factual career history is
mutated. Frozen retirement narratives for already-completed careers keep their stored prose;
only the derived rank/archetype re-reads through the single authority.

## 26. Integrity validation

```
v0.6.1 INTEGRITY SCAN — 50,000 careers, balanced policy

clean careers   50,000 / 50,000   100.00%

No violations in any category.

Every target the brief set came back at zero: historical data validation, Maccabi-specific
ending contradictions, league/string geography, GK scoring, fake derby labels, cup trophy
reconciliation, generic meaningful outcome labels, legacy milestones, Maccabism, v0.4.8 truth,
and manager truth. All 28 integrity codes active.
```

## 27. Controlled scenarios A–J

| | scenario | result |
|---|---|---|
| A | historical appearance record | ✅ one scope; Harazi 717 tops the ladder; top-3/top-10 and gaps all all-competition |
| B | European superstar | ✅ high global, low legacy, **no** הסמל / אגדה ירוקה |
| C | Maccabi symbol | ✅ הסמל on Maccabi football; global may trail the superstar, correctly |
| D | goalkeeper | ✅ not punished for zero goals; within 12 points of a comparable CB |
| E | prodigal son | ✅ 6 post-return appearances refused; 90 qualifies |
| F | Kfar Saba cup final | ✅ neutral presentation, no colour claim, no derby label |
| G | State Cup win | ✅ named in season record, timeline and retirement; survives transfer; not a Maccabi trophy |
| H | real derby | ✅ Haifa derby recognised, events reachable |
| I | generic outcome | ✅ specific football text, zero generic valence in meaningful choices |
| J | retirement authority | ✅ headline and legacy block both read הסמל from one system |

## 28. Regression vs v0.6

```
                              v0.6      v0.6.1
reached Maccabi senior team    62.8%     63.3%
played abroad                  31.5%     31.8%
returned to Maccabi            22.3%     22.0%
avg Legend Score                43.8      41.4     ← the B5 correction
median Legend Score             36.0      33.0     ← the B5 correction
avg Maccabi appearances        130.1     129.1
INVALID natural-stage repeats      0         0
```

**The Legend Score drop is a correction, and the split proves it.** Measured over 1,500 careers:

```
never went abroad   n=1035   avg Legend 33.7
went abroad         n= 465   avg Legend 60.9
```

Before B5, the never-went-abroad group was credited with `europePoints` for every Liga Leumit
and academy season. The 2.4-point fall in the mean is concentrated exactly where the false
credit was. Career generation itself is unchanged (Maccabi rate, Europe rate, homecoming and
appearances all within 0.5pp).

## 29. Mobile audit

```
width  probe-canary      retirement   sheet-legacy   decision
320    over=1 (+296)     over=0       over=0         over=0
360    over=1 (+256)     over=0       over=0         over=0
390    over=1 (+226)     over=0       over=0         over=0
412    over=1 (+204)     over=0       over=0         over=0
430    over=1 (+186)     over=0       over=0         over=0
```

The canary fails at every width, so the zeros are measurements. No red prestige identity (the
badge test class now covers both legacy icon maps). No new cards in the primary gameplay loop.

## 30. Known issues

- **The goals record is easier than the appearance record.** Measured: 11.3% of careers beat
  Armeli's 119, against 1.1% beating Harazi's 717. This is a *game* property — the engine's
  scoring model is generous for strikers — not a data problem, and the honest fix is balance
  work rather than inflating history. Flagged for v0.7.
- **The legacy score's longevity target (420)** was chosen against league-scope benchmarks and
  now sits lower relative to the pantheon. A9 measured no distributional break, so per the
  brief it was left alone; worth revisiting deliberately.
- **Championships are unknown for the pre-1983 generation** and recorded as `undefined` rather
  than guessed. The championships ladder ranks only players with sourced counts.
- The official league record (494) differs by one from the Wikipedia career-table sum (495).
  Neither is used under the all-competition scope; recorded because v0.6 asserted 495 as fact.
- **The reported derby instance could not be reproduced** (§21). The guard is now locked by
  tests; if it recurs, the debug trace and the C10 validator should localise it immediately.

## 31. Deferred to v0.7 — explicitly not implemented

Collection · Trophy Cabinet · Career Album · saved-career gallery · share posters/cards · meta
progression · achievements/unlocks · broad visual redesign. Also not implemented: real player
images, full cup fixture engine, alternate-history Maccabi world, new attribute systems.

**v0.7 was not started.**

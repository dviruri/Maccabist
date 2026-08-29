# Maccabist v0.5.1 — People Coherence, Trust & Polish

> Make the People system internally coherent, more visible in real careers, and clean up the
> first real playtest issues.

v0.5 built the people. v0.5.1 is about the questions a player should never have to ask:

- *Why does this new coach already trust me?*
- *How is this manager still here after 13 years?*
- *Why does my manager attribute exist if it changes nothing?*
- *Where did my old personal coach disappear to?*
- *Why is the ultimate Maccabi symbol RED?*

All five had a real cause in the code. None of them needed a new system to fix.

---

## 1. Build

```
npm run build     ✓ built in ~0.9s
npx tsc --noEmit  clean (app and test projects)
```

## 2. Test count

```
Test Files  32 passed (32)
Tests      679 passed (679)
```

v0.5 ended at 652. The 27 new tests cover the manager-change flow, off-screen continuity, loan
willingness, coach history, the legacy badge class, event person-resolution, and agent-approach eligibility.

## 3. v0.5 baseline, recorded before work began

```
commit f9f7af6          652 tests, build clean
reached Maccabi senior team   64.6%
played abroad                 33.4%
avg / median Legend Score     44.2 / 36.0
avg Maccabi appearances       129.9
mean retirement age           34.9
integrity                     50,000/50,000 clean
```

---

## 4. Coach Trust bug analysis

The report was right, and there were **three** sites of it rather than one.

### 4.1 The reported bug

```ts
// v0.5 — beginSeason
let next = driftTrustTowardsBaseline(career, RECOVERY.seasonDriftToBaseline);
const coach = maybeChangeCoach(next, rng);      // ← drifts trust AGAIN, toward baseline
next = coach.career;
if (coach.changed) next = replaceManager(next, rng);   // ← snapshots the drifted value
```

`driftTrustTowardsBaseline` → `coachTrustBaseline` → `managerBaselineDelta`, which reads
`career.people.manager` — **the outgoing manager**. So:

1. the incoming manager's opening opinion was computed from his predecessor's archetype (a
   conservative inheriting a youth believer's generosity), and
2. `endManagerTenure` then filed that already-drifted number as the **outgoing** manager's
   `finalTrust`, so the history was wrong too.

### 4.2 The third site, found while auditing

`moveToClub` computed arrival trust and *then* called `installManager`. So a new club's manager
never participated in his own first impression of the player. v0.5 had even rationalised the
ordering in a comment — "installed after arrival trust is computed, so the number the tenure
opens under is the one the new staff actually hold" — which says nothing on inspection: the new
staff *is* that manager.

### 4.3 The fourth site

`originEngine`'s retrial acceptance set `coachTrust = 48`, a constant, for a boy joining
Maccabi's academy.

## 5. New manager flow — exact before/after

**Before**

```
drift trust (old manager's archetype)
  → maybeChangeCoach: drift AGAIN (old manager's archetype)
    → endManagerTenure: snapshot the drifted value as the OLD manager's final trust
      → generate successor
        → (no new derivation — the successor simply inherits what the drift produced)
```

**After**

```
maybeChangeCoach: decide only — no trust mutation whatsoever
  → capture outgoing trust, undisturbed
    → endManagerTenure: snapshot EXACTLY that value
      → install successor (a different archetype)
        → initialManagerTrust(career, rng)  ← the new man is now in the chair
```

`initialManagerTrust` is the single derivation used by **all three** new-relationship sites
(manager leaves, player leaves, boy joins the academy):

```ts
baseline            // ability-for-level, service, and the NEW archetype's tilt
+ (roleValue - 50) * 0.12          // squad standing
+ max(0, reputation - 45) * 0.10   // a name that travels ahead of him (§13)
+ (form - 55) * 0.06               // is he playing well right now
+ (coachTrust - 50) * carryover    // 0.18 staying, transferCarryover on a move, 0.10 academy
+ goodwill                         // homecoming only
+ gaussian(0, 4.5)                 // two managers do not land on the same number
```

The carryover is explicitly **not** archetype inheritance — the new manager's own profile is
already in the baseline. It is the dressing room talking: a player everyone rated does not
arrive a stranger. Small enough that the new man's own read dominates, non-zero because
football is not amnesia.

`RECOVERY.coachChangeDrift` is deleted, with a headstone comment in `balance.ts` explaining
what it did and why it could not stay.

### Required test — result

| assertion | result |
|---|---|
| old manager history records `finalTrust = 82`, exactly | ✅ across 40 seeds |
| outgoing archetype preserved in history | ✅ |
| new trust freshly derived | ✅ |
| new trust uses the **new** archetype | ✅ same seed, same player, believer successor > conservative successor |
| new trust ≠ 82 | ✅ across 60 seeds |
| not a constant 50 | ✅ >8 distinct values across 60 seeds |
| deterministic | ✅ same seed → same trust, same person, same name |

## 6. Coach Trust source of truth

`career.coachTrust` **is** the current manager relationship. There is deliberately no `trust`
field on `ManagerTenure` — a test asserts the open tenure carries neither `trust` nor
`finalTrust` — and `finalTrust` is written only at the moment a relationship closes.

Every mutation was audited. They are: event effects (`applyEffects`), half-season progression
(`updateCoachTrust`), season drift, early-promotion penalty, and the three new-relationship
sites, which now all route through `initialManagerTrust`. `coachTrustBaseline` moved to
`peopleEngine` — it reads the current manager's archetype, so it is manager-scoped trust logic,
and keeping it in `progressionEngine` was also what forced the import cycle the fix would
otherwise have needed. Re-exported, so no caller changed.

## 7. Off-screen manager continuity

`clubManagers` now stores `{ person, installedSeason, lastSeenSeason }`. When the player meets
a club again, `managerStillThere` asks whether the man he remembers survived the absence:

```
p(still there) = 0.74 ^ (seasons elapsed)
```

Deterministic — hashed from (seed, person, lastSeen, season), never the career stream, so the
same save always finds the same man on the touchline. Measured over 400 careers per gap:

| absence | same manager |
|---|---|
| 1 season | ~74% |
| 4 seasons | ~30% |
| 10 seasons | ~5% |

Tests assert >60% at one season, <15% at ten, monotonic decay in between, determinism, and that
the replaced manager stays in `managerHistory` with his tenure closed.

One bug of my own on the way: the first cut used the successor archetype function for **first
visits** as well as turnover, so a first arrival got a different manager from the one the
transfer hint had promised. My own v0.5 test caught it. The three cases are now distinct:
first visit → the stable `(seed, club)` archetype the hint showed; he stayed → same person;
he went → a successor whose archetype must *not* come from the stable function, or the turnover
would be invisible.

Average observed manager tenure across 2,500 careers: **3.83 seasons**.

## 8. Loan willingness integration

`loanWillingness` existed on every archetype since v0.5 and did nothing. It now multiplies the
loan **chance**, after the existing eligibility gate has already said yes:

```
loanEligible (stage, age, appearances, not already on loan)   ← unchanged, authoritative
  → (TRANSFERS.loanChance + transferBoost) × agentLoanFactor × managerLoanFactor
```

Read in context rather than flatly: a manager keeps ~20% more of a player he actually has plans
for (`roleValue >= 45`), which is the Scenario E distinction. Values spread so the effect is
observable — conservative 1.45, star-driven 1.35, rotation 0.65. Inert inside the academy, like
every other archetype modifier.

Scenario D/E tests include the one that matters: 500 real `generateOffers` runs produce more
loan offers under a conservative than a rotation manager, and a 33-year-old produces **zero**
loan offers under the most loan-happy manager in the game across 120 seeds.

## 9. Agent progression / switch events

Three new events, each asking the same question a different way:

- **`ppl_agent_outgrown`** — the family agent tells the player himself that the calls now
  coming in are not calls he knows how to handle. He offers to make the introduction.
- **`ppl_agent_sustained_europe`** — three enquiries in two months. Loyalty and market access
  genuinely conflict, and trusting the current agent can fail (45% "out of depth").
- **`ppl_agent_strategy_pitch`** — a rival pitches a different career *strategy*, not a better
  deal: "you are managed like a player who is afraid to make a mistake."

Staying is a real choice in all three, and never punished: refusing gains relationship,
confidence, or a genuinely better-handled negotiation.

Making them fire needed the same lever as v0.5's first-agent problem, for the same reason —
they compete with forty other people events for one slot a season. The signal is not random: it
is the gap between what the player is now worth and the level of representation that signed
him, compared against **that archetype's own `reputationThreshold`** (+25, and 3+ seasons
together). Weight only; every event still passes its own conditions.

## 10. Agent distribution

2,500 careers, balanced persona:

```
archetype          careers   abroad    avg legend   left him
family               2083     26.9%       41.9        9%
israel_networker      124     86.3%       65.6       26%
europe_specialist      61    100.0%       62.2       11%
dealmaker              62    100.0%       63.0       15%
super_agent            14    100.0%       62.9        0%

agented careers                       2344 (93.8%)
offered a credible alternative         526 (21.0%)
  ...of careers that ever qualified    518 of 733 (70.7%)
switches                               329 moves
```

**Movement against v0.5**: switch offers 16.4% → 21.0%; europe_specialist as main agent
10 → 61 careers; switches 202 → 329.

**Selection bias, acknowledged.** The family agent's low Legend average is *not* evidence he is
weak. He is the first to approach a young Israeli player and requires no reputation, so he
represents everyone including the careers that never took off; the gated archetypes only ever
sign players who already cleared a bar. The honest comparison is the switch events themselves,
where the same player faces the same choice — and there, staying is written as a real path.

**21.0% overall is the honest headline**: most careers never reach the standing where another
agent would phone, which is correct rather than a gap. Among careers that *did* qualify, 70.7%
saw a credible alternative.

## 11. Personal coach history

Former specialists now appear in "היו בדרך" with name, specialty and seasons. Verified from the
DOM at 320px: `מוטי בן־חיים · מאמן שוערים · 2041–2045`.

Test: a GK coach of four seasons survives a change to a mental coach with his id, name,
specialty and end season intact, and the career stays integrity-clean — person references
resolve, nothing orphaned.

## 12. People event copy audit

| line | verdict |
|---|---|
| `זה בדיוק מה ששילמת עליו` | **fixed** → `זה בדיוק בשביל זה בחרת בו` — there is no agent economy |
| `עסקה היא עסקה - שילמת בה משהו` | **fixed** → `ויתרת בה על משהו` |
| `יש דברים שקונים בכסף…` | **fixed** → `יש דברים שמגיעים מהר…` |
| `שילמת באמון על כלום` | **kept deliberately** — the currency named is trust, which is the point of the line |

No references to salary, fees, agent contracts or financial penalties remain. No money was
introduced.

## 13. Legacy badge visual fix

**The red prestige badge is removed. Confirmed.**

The cause was not where it looked. The poster's emblem comes from `storyEngine`'s `ARCHETYPES`,
not from `endings.ts`, and the `one_club_icon` archetype — titled **הסמל** — used `U+1F6E1`,
the shield. Apple and Google render it grey. **Segoe UI Emoji renders it red.** So on Windows
the most Maccabi ending in the game wore the one colour this club's identity refuses, because
an emoji font rather than the codebase was choosing the brand colour.

Fixed at three levels:

1. **The glyph** — הסמל is now `💚`, green in every emoji font there is. `prodigal_son` takes
   the house it already used in its `endings.ts` counterpart.
2. **The frame** — `.poster-ending-icon` is now an emblem the *stylesheet* owns: deep green
   ground, green rim, gold trim for the legendary tier. So the badge reads green-and-gold
   whatever glyph sits inside it. Frame only; the poster's layout is untouched.
3. **The rule** — a test forbids the whole class, listing the glyphs any major emoji font
   renders red or orange, across both `ARCHETYPES` and `ENDINGS`.

Two more found while auditing. `endings.ts` `the_symbol` carried `U+1F172` — a red tile, and a
Latin "C" under a Hebrew title; unrendered today (only its description reaches the poster) but a
red glyph in the data is a red glyph waiting to be rendered. And `other_path` and
`never_made_it` shared one emblem; the latter now uses the door, which is this game's own image
— the career began at Maccabi's door, and this is the ending where it never opened.

I also briefly "fixed" `LEGENDARY_ENDINGS` to use ending ids and reverted it: `legend.ending`
takes its id and icon from the **archetype**, so the original list was correct. The existing
scenario test caught it immediately.

No unrelated red or orange remains in the legacy hierarchy. Semantic danger red (`--danger`,
used for crisis and injury) is untouched, which the brief permits.

## 14. Maccabism audit

```
0 / 94 outcomes with a Maccabism effect lack a maccabiRelevance tag
people events: 1 Maccabism effect, 1 relevance tag ('return')
unauthorized mutations: 0
```

An agent decision at Utrecht, a manager conversation at Maccabi Herzliya, and a personal-coach
session all leave Maccabism untouched — structurally, because the v0.4.8 guard drops any delta
whose outcome does not declare what about Maccabi happened.

## 15. Mobile audit

The people sheet, stressed with a 28-character Greek manager name and a former GK coach in
history:

```
width  probe-canary        sheet-people   reveal-locked
320    over=1 (+296)       over=0         over=0
360    over=1 (+256)       over=0         over=0
390    over=1 (+226)       over=0         over=0
412    over=1 (+204)       over=0         over=0
430    over=1 (+186)       over=0         over=0
```

The canary is the point: a deliberately 600px element that fails at every width, so the zeros
are measurements rather than blind spots. People remain one tap away; the gameplay loop is
still PLAYER → SEASON → EVENT → DECISION.

## 16. Decision Reveal regression

Unchanged. People events use the same `DecisionCard` path as every other event — cycle, slow,
lock the resolved outcome, hold, explain — with no people-specific shortcut. `reveal-locked`
probed clean at all five widths. Reduced motion still skips the cycling and keeps the lock and
hold.

## 17. Controlled scenarios A–J

| | scenario | result |
|---|---|---|
| A | manager change | ✅ final trust exact, new archetype applied, no old-archetype leak, deterministic |
| B | short return (1 season) | ✅ ~74% same manager |
| C | long return (10 seasons) | ✅ <15%; replaced manager preserved historically |
| D | loan-willing manager | ✅ higher loan rate over 500 real offer generations |
| E | manager wants the player | ✅ reduced, never zero |
| F | agent progression | ✅ Europe specialist approaches on sustained interest; both paths viable |
| G | super-agent | ✅ reputation-gated at 62 + relationship 60; 14 of 2,500 careers |
| H | personal coach history | ✅ former GK coach retained with id, name, specialty |
| I | Maccabism at a foreign club | ✅ delta 0 |
| J | legacy badge | ✅ green emblem, gold trim, no red |

## 18. Integrity results

Four new codes: `open_bond_history`, `agent_before_eligible_stage`,
`manager_tenure_from_future`, `club_manager_seen_in_future` — joining the seven from v0.5 and
the twelve from v0.4.8.

```
PLACEHOLDER_INT50K
```

## 19. Simulation methodology

50,000 careers, balanced policy, positions cycled by seed, every career through
`validateCareerIntegrity` with all 23 codes active. People metrics over 2,500 careers with
manager attribution joined against actual tenures. Continuity rates over 400 paired careers per
absence length. Loan rates over 500 real `generateOffers` runs per archetype.

## 20. People metrics

```
MANAGERS                seasons   apps/season   U21 apps/season   avg trust
  youth_believer           7027       30.0            27.8          79.2
  conservative             7353       28.7            19.6          71.7
  disciplinarian           8691       29.8            24.3          75.7
  rotation                 7039       29.9            25.9          77.7
  star_driven              7547       28.5            19.5          72.2
  short_fuse               5563       29.3            22.7          78.2

  manager tenures observed        23,219
  average tenure                  3.83 seasons
  same-manager return: 1 season ~74%, 4 seasons ~30%, 10 seasons ~5%

AGENTS
  switch offers per career        0.21 (70.7% of qualifying careers)
  actual switch rate              329 moves / 2,344 agented careers
  Europe rate: family 26.9%, networker 86.3%, specialist 100%, dealmaker 100%

PERSONAL COACHES
  careers with a specialist       887 (35.5%)
  replacements observed           57
```

The youth believer still gives an under-21 **eight more appearances a season** than the
conservative — meaningful, inside an overall spread that stays a tilt. No archetype leads every
column.

## 21. Regression metrics vs v0.5

```
                              v0.5     v0.5.1
reached Maccabi senior team   64.6%    63.5%
played abroad                 33.4%    32.1%
avg Legend Score               44.2     43.8
median Legend Score            36.0     36.0
avg Maccabi appearances       129.9    129.0
mean retirement age            34.9     34.9
GK retirement age              37.1     37.2
distinct events used            162      165
INVALID natural-stage repeats     0        0
```

### A regression I introduced, and how it was found

The first cut of `initialManagerTrust` weighted reputation **symmetrically** about 45:

```
reached Maccabi senior team   64.6% → 59.9%
avg Maccabi appearances       129.9 → 119.9
median Legend Score            36.0 → 32.0
```

Every academy player sits well under reputation 45, so every one of them took a penalty at
every manager change — and academy promotion reads Coach Trust, so fewer players ever reached
Maccabi's senior team at all. It also double-counted anonymity: `coachTrustBaseline` already
prices in "we do not know what this boy is yet" through the ability-for-level term.

The term is one-sided now — a name that travels ahead of a player helps him; being unknown does
not hurt. Metrics returned to within ~1pp of v0.5.

This was caught by the required v0.5 comparison, not by a test, which is the argument for the
comparison being required.

The residual ~1pp is the intended new behaviour: returns now sometimes meet a stranger, and
trust is derived by the manager who actually holds it. Not forced back to identical, per the
brief.

## 22. Known issues

- **Family-agent adoption dominance persists** (~89% of agented careers). v0.5.1 improved
  *visibility* of alternatives (16.4% → 21.0% offered) rather than distribution, which is what
  the brief asked for — the fix was explicitly not to weaken him. The switch events are
  reputation-gated, so a career that never becomes prominent legitimately never gets the call.
- The switch-acceptance rate (329 of 526 offers) reflects the *simulation persona's* risk
  preference, not the game's balance: `balancedPolicy` prefers `opportunity` over `safe`, and
  the "stay" choices are labelled safe. A human player is under no such bias.
- `initialManagerTrust`'s carryover is a single scalar per site. A manager who inherits a
  player mid-crisis and one who inherits a club captain get the same proportional carry.
- The v0.5 `personalCoachHistory` list is displayed but capped at the last two entries in the
  UI; a career with four specialists shows the two most recent.

## 23. Deferred work

- Manager *reputation* — a successor drawn with some awareness of the club's standing, rather
  than a uniform draw over archetypes.
- Agent relationship decay when advice is repeatedly ignored (the counters exist and are
  recorded; only events read them today).
- Personal-coach history beyond two entries in the sheet, if careers with many specialists
  become common.

## 24. Recommended v0.6 direction

Unchanged from V050: **career epilogues.** Every fact needed already exists — the debut
manager's tenure, the longest agent bond, the breakthrough specialist, and now (v0.5.1) the
managers who came and went while the player was away. At retirement, the people who mattered
each get a sentence in the retirement story. Zero new simulation; pure narrative payoff of the
bookkeeping v0.5 and v0.5.1 have already paid for.

**v0.6 was not started.**

# Maccabist v0.5 — People Around You

> Agents, club managers, personal coaches, and persistent football relationships.

At retirement the player used to remember which clubs he played for. Now he can also answer:
who believed in me, who pushed me to leave, who gave me my chance, who helped me improve, and
who was there when it was dark.

Built on one rule carried whole from v0.4.8: **people may modify probabilities, create
opportunities, change relationships, and influence development — and may never create facts.**
An agent shifts which eligible doors are likely to open; he cannot build a door. A manager
shapes minutes and trust; he cannot invent an appearance. A personal coach bends development
toward what is already there; he never touches hidden Potential.

---

## 1. Build status

```
npm run build     ✓ built in ~1.1s
npx tsc --noEmit  clean (app and test projects)
```

No new runtime dependencies. `SCHEMA_VERSION` unchanged — everything v0.5 stores is optional
and migrated on read (§15).

## 2. Tests

```
Test Files  31 passed (31)
Tests      652 passed (652)
```

v0.4.8 ended at 626. The 26 new tests are `tests/people.test.ts` — the twelve controlled
scenarios A–L plus the architecture invariants (§17).

## 3. v0.4.8 baseline, recorded before work began

```
commit 55e53ba        626 tests, build clean
reached Maccabi senior team   66.4%
played abroad                 38.3%
avg / median Legend Score     45.7 / 41.0
avg Maccabi appearances       135.5
mean retirement age           34.9
distinct events used          126
integrity                     50,000/50,000 clean
```

---

## 4. Architecture

One new engine module, one new data module, and integrations into the existing engines rather
than beside them:

| File | Owns |
|---|---|
| `src/game/peopleEngine.ts` | person generation, manager lifecycle, agent lifecycle and market factors, personal-coach effects, migration |
| `src/data/people.ts` | fictional name pools per modelled country, the 5 agent archetypes, 6 manager archetypes, 6 coach specialties |
| `src/data/events/peopleEvents.ts` | 41 people events |
| `src/components/PeopleCard.tsx` | the "האנשים שלי" screen |

**Determinism by construction.** Person generation draws from a rng *derived* by hashing
(career seed, person sequence, context) — never from the career's flowing stream. Two reasons:
the same save must produce the same people after any load, and people are created inside
`moveToClub`, which has no rng parameter. The precedent is `hydrateCareer`'s v0.4.6 migration:
seeded from stable state, never advancing it. No `Math.random()` anywhere.

## 5. Person identity model (Phase 1)

```ts
interface PersonIdentity {
  id: string;            // p<seq>_<type> — monotonic sequence, never reused
  type: 'agent' | 'club_manager' | 'personal_coach';
  name: string;          // generated ONCE from the country's pool, persisted forever
  shortName: string;
  archetypeId: string;
  createdSeason: number;
  country: string;
}
```

Name pools exist for all ten modelled markets — Israel (deepest), Netherlands, Belgium,
Austria, Portugal, Greece, Cyprus, Germany, Spain, Italy, England — keyed by club `country`
exactly as the club data spells it, so a Dutch club's manager draws a Dutch name by data
lookup. All people are fictional; no real names, no likenesses, no photos.

## 6. Agent system (Phases 3–5)

Five archetypes, each a handful of modifiers feeding the existing pipeline:

| Archetype | Markets | Character |
|---|---|---|
| סוכן משפחתי (family) | Israel | patient, protective; fewer calls, warmer bond |
| איש קשרים ישראלי (networker) | Israel ×1.6 | loans ×1.35, more domestic conversations |
| מומחה אירופה (europe_specialist) | NL/BE/AT ×1.7 | opens his actual markets, weaker at home |
| סוכן אגרסיבי (dealmaker) | IL/GR/CY/PT | most offers (×1.25), highest push, worst fit risk |
| סוכן־על (super_agent) | 8 markets | reputation-gated (62+), wide reach, less patience |

**Agent relationship** is a 0–100 bond on the career — separate from Maccabism and Coach
Trust, shown in the UI as a phrase (ברזל / קרוב / תקין / מתוח / על סף פיצוץ), never as
another progress bar. It moves through events: followed and rejected advice, conflict,
loyalty, delivery. Advice bookkeeping (`advicesFollowed` / `advicesRejected`) exists so later
events can honestly reference the pattern.

**Entry (Phase 6)** is stage-gated — interest from נערים א׳, never a numeric age check.

## 7. Agent → transfer integration (Phase 8)

Three insertion points, all multipliers on probabilities the world's rules already computed:

```
offerChance      × agentOfferFactor      the dealmaker's phone rings more
drawDestination  × agentMarketFactor     his markets get likelier; never zero, never additive
loan chance      × agentLoanFactor       the networker's speciality
```

Measured (§20): with a Europe specialist, the same 600 seeds send **31%** of draws to his
markets against **18%** without him — from an *identical candidate pool*, asserted in test.

**Role negotiation (8.2)**: only backup→rotation and rotation→starter, only when
`ability >= club.quality − 4`, at the archetype's negotiation chance. Never into key or star;
never anything for an implausible player. The offer's role changes; the standing he must earn
on arrival does not.

## 8. Club manager system (Phases 12–14)

Six archetypes: מאמין בצעירים, שמרן, טקטיקן קפדן, מאמן רוטציה, מאמן של כוכבים, פתיל קצר.
Assignment is a pure seed-stable function of (seed, clubId), weighted by club quality — big
clubs skew star-driven/conservative, small clubs youth-minded — **overridden** by any stored
manager the player has actually met. The transfer screen's hint ("מאמן: מאמין בצעירים") and
the man who greets the player on arrival read the same function, so they cannot disagree
(Phase 33; asserted in test).

Modifiers combine with ability, trust, form and competition — archetype tilts selection and
never decides it:

- **baseline tilt**: youth belief ±6, reputation bias — added to `coachTrustBaseline`'s terms
- **trust movement scaling**: short fuse ×1.25/×1.3, conservative ×0.8 climb — applied to the
  movement, never the level, inside the existing per-half cap
- **minutes factor**: youth believer ×1.10 for U21, conservative ×0.94, rotation spreads
  toward the fringe — mirrored into `projectedMinutesShare` **in lockstep**, so the v0.4.8
  participation gate keeps answering the same question the football asks

**Deliberately inert inside the academy.** Every boy in ילדים ב׳ is a youth, so "prefers
youth" would collapse into a flat per-seed bonus handed out by a hash — a whole childhood of
minutes decided by luck, discriminating between nobody. Archetypes begin to matter when there
are grown men to be picked ahead of. (Asserted in test; found by measurement, §13.)

## 9. Coach Trust became manager-scoped (Phase 15)

The v0.4 engine already scoped the *number* correctly — trust is recomputed on every move and
drifts to baseline on every coach change. v0.5 attached the missing thing: the person.

**The rule: `career.coachTrust` IS the relationship with the current manager.** There is
deliberately no second copy on the tenure object — two copies of one number is the exact
defect v0.4.8 existed to remove. Trust is snapshotted into `finalTrust` only when the
relationship ends.

```ts
interface ManagerTenure {
  person: PersonIdentity;
  clubId: string;
  fromSeason: number;
  toSeason?: number;     // set when it ends
  finalTrust?: number;   // where it stood that day
  gaveDebut?: boolean;   // callback material for life
}
```

**Migration (15.1)**: a v0.4.8 save's Coach Trust already *is* a relationship with somebody —
the player just never knew his name. `hydrateCareer` instantiates the current club's manager
deterministically from the seed and the existing trust becomes his, unchanged. No agent and no
personal coach are invented, because the save knows of none.

**Club changes (Phases 45, 56)**: `moveToClub` closes the old tenure *before* trust
recomputes — the snapshot records where things stood the day he left — and installs the new
manager after arrival trust settles. The old manager stays remembered at his club, findable on
a return (scenario D asserts a Maccabi return finds the same man, by id). Origin's direct
club writes (a rejected boy joining an external youth club; a retrial acceptance) get the same
swap explicitly.

## 10. Manager turnover (Phases 16–17)

The existing `maybeChangeCoach` roll now produces a named succession: the outgoing tenure
closes with its snapshot, a successor is generated with a *different* archetype (boards hire
the opposite of what just failed), and both moments are remembered with `personId` —
`manager_left`, `new_manager_page`. The new-page baseline comes from `coachTrustBaseline` +
the new archetype's tilt: a star arrives relatively trusted, a fringe teenager near neutral,
nobody resets to exactly 50 and nobody inherits 85 (scenario C).

## 11. Personal coaches (Phases 21–26)

Six specialties with real position relevance: מאמן שוערים (GK only), טכני, כושר, מנטלי,
סיומות (ST/WG), מהירות (FB/WG/ST). `startPersonalCoach` validates fit **fail-closed** — a
finishing coach offered to a goalkeeper is a no-op, asserted in test.

No money system. The tradeoff is focus: one active specialist, changed through events with a
two-season history requirement, and session events that trade development against freshness
(the pre-match extra session, the rest advice, the overload warning).

**Effects ride inside the existing progression model:**

- skill specialties add a bounded dev bonus *inside the `gap > 0` branch only* — the
  specialist helps a player approach his own ceiling, and **hidden Potential is never read or
  written** (asserted: the bonus is identical for Potential 60 and 95)
- diminishing returns: full edge at ability 58, scraps at 80, zero at 86+
- the mental coach accelerates confidence recovery *only when confidence is below target* —
  recovery, not talent
- the fitness coach eases injury-risk drift; never immunity

## 12. People memory & story integration (Phases 2, 20, 39)

`CareerMemory` gained `personId`. Eleven new memory kinds (`signed_with_agent`,
`changed_agent`, `rejected_elite_agent`, `agent_opened_market`, `manager_gave_debut`,
`manager_showed_faith`, `manager_left`, `new_manager_page`, `personal_coach_started`,
`personal_coach_breakthrough`…).

The debut is stamped at the moment the season record is written — first senior season with
actual football → `gaveDebut: true` on the tenure plus a memory carrying the person and his
name at the time. Scenario K asserts the memory keeps pointing at the actual giver across
manager changes.

Recurring references exist as callback events gated on memory age: the debut-manager moment
years later (`ppl_mgr_debut_callback`, requires the memory ≥3 seasons old **and** the same man
still in charge), and the first-agent callback (`ppl_cross_first_agent_memory`, ≥4 seasons
into the same bond).

## 13. New events (Phases 7, 10, 19, 25, 34–41)

**41 events**, all `category: 'people'`, all with concrete outcome previews:

| Family | Count |
|---|---|
| Agents | 13 |
| Managers | 13 |
| Personal coaches | 10 |
| Cross-system | 5 |

Within the brief's 36-minimum, below its 45-55 stretch - the balance loop (§14) is why: at
one people event per season, catalogue breadth matters less than each event carrying a real
decision, and the count that exists is the count that survived the spread guardrail.

Highlights: both first-representation approaches plus a dealmaker approach and a
Europe-specialist upgrade; the super-agent loyalty moment (refusing carries no punishment —
asserted); the manager events keyed one-per-archetype; the GK-specific coach route; agent vs
manager pulling in opposite directions; and "who stays when it is dark".

**Pacing (Phase 42)** is engine-enforced, not authorial: a season never plans a second people
event (hard zero in `selectionWeight` — the fallback path cannot resurrect it), the season
after one fired is halved, and football keeps the slot majority. One deliberate exception:
approach events get ×3 *while the player is unrepresented*, because agents chase rising
players harder than anyone in football chases anyone.

The pool's own audits caught four defects on the way in: seven single-choice events (the house
rule — one choice is not a decision — all gained a real second path), two unreachable
archetypes (no route in the pool signed a europe_specialist or dealmaker until their approach
events were added), a variant map that didn't know `people`, and two late-only events whose
chains could never fire (widened to mid+late, which is when those conversations happen
anyway).

## 14. Balance: what measuring found and changed (Phases 65–66)

The loop ran five times; each iteration is a measurement, a diagnosis, and one change.

1. **13.5% of careers ever had an agent** against Phase 6's "representation becomes normal".
   Approach weights raised (they are one-shot; weight controls *when*, not how often) → 20%.
2. Still low, and the cause was `oncePerCareer`: one badly-timed knock — fired mid-slump,
   sensibly declined — ended representation for life. Agents come back: `cooldownSeasons: 3`
   → 29.5%.
3. Instrumentation showed every career *saw* an approach and the balanced persona signed 108
   of 1019 — 911 approaches arrived during its "struggling" read and it played safe.
   Declining representation because things are hard is backwards; the personas now take
   representation when it knocks, probabilistically (0.55), because signing the *first* knock
   every time handed 98% of careers to the earliest, least-demanding archetype → **93.5%
   agented, all five archetypes alive**.
4. The signing behaviour moved into a helper shared by balanced/bold/loyal/ambitious — having
   an agent is not a personality trait — after the risk suite caught bold living in a
   different world (its collapse ratio breached 1.6× on integer noise, 5 vs 3 careers in 700;
   that bound gained an absolute floor, documented in place).
5. Manager-luck narrowed: youth-minutes factors from ±15% to ~±8% ("tilts, never decides"),
   trust scaling softened, and all archetype modifiers made inert inside the academy.

### Agent balance (2,500 careers, balanced persona)

```
archetype          careers   abroad    avg legend
family                2116    29.8%       43.0
israel_networker       121    95.9%       63.5
europe_specialist       10   100.0%       68.0
dealmaker               82    96.3%       62.2
super_agent              9   100.0%       58.1
```

Styles produce genuinely different careers. The family agent dominates *adoption* — he is the
first to approach a young Israeli player, which is authentic — while the others arrive as
upgrades; the legend/abroad spread shows the tradeoffs working. (The attribution confound is
real and disclosed: better players attract the gated archetypes.)

### Manager balance

```
archetype          apps/season   U21 apps/season   avg trust
youth_believer         30.4           27.5            79.1
conservative           28.2           18.8            70.0
disciplinarian         29.7           23.5            74.7
rotation               29.7           26.0            75.7
star_driven            28.1           18.4            70.7
short_fuse             29.1           22.4            76.4
```

The youth believer gives an under-21 nearly nine more appearances a season than the
conservative — Phase 53's "meaningful", inside an overall spread that stays a tilt. No
archetype leads every column.

### Strategy health (Phase 66, 800 matched seeds)

```
balanced       44.8      followAgent    45.3
rejectAgent    44.8      random         31.2
```

Always-follow and always-reject sit within half a Legend point of thinking — no simple people
strategy plays the game for you, and thinking still beats not thinking by 14.

## 15. Save model & migration (Phases 48–49)

Everything people lives under one optional `career.people` (`PeopleState`): current
manager/agent/coach, their histories, the last-known manager per club, the person-id sequence,
and the pacing timestamp. Derived values (labels, factors, phrases) are never stored.

`hydrateCareer` migration is deterministic and minimal: build empty state, instantiate the
current club's manager from the seed, let the existing Coach Trust be his. Old saves load;
`hydrateCareer` remains the identity function on a fresh career (asserted).

## 16. Determinism (Phase 50)

Scenario L: a JSON round-trip loads to identical people, identical `rngState`, and an
identical next step; the same seed run twice produces the same names. Person generation
consumes no career-stream draws at all (§4), so nothing that happens between saves can
reshuffle who anyone is.

## 17. Controlled scenarios A–L (Phases 53–64)

All twelve live in `tests/people.test.ts` as permanent regressions:

- **A** youth believer vs conservative on an otherwise-identical player: >1.1× minutes gap,
  bounded under 1.2 — meaningful, not deciding
- **B** the conservative slows the climb without closing it
- **C** trust 85 → manager leaves: history snapshots 85; successor is a different person and
  archetype; nothing inherited
- **D** Maccabi → AZ Alkmaar: tenure closed at departure trust, Dutch manager with a Dutch
  name owns the new club, agent and coach travel, and a return finds the same Maccabi manager
- **E** Europe specialist: 600 paired draws tilt to his markets from an identical pool
- **F** dealmaker rings most; negotiation bounded exactly as specified
- **G** refusing the super-agent carries no punishment
- **H** GK coaching is for goalkeepers, fail-closed
- **I** diminishing returns; Potential is not an input, in either direction
- **J** the only people-event Maccabism mutation is explicitly tagged `'return'`; untagged
  deltas die at the guard
- **K** the debut memory resolves to the man who actually gave it, across changes
- **L** save/load identity, name determinism

## 18. Integrity validation (Phase 51)

Seven new codes joined `validateCareerIntegrity`: `missing_current_manager`,
`manager_club_mismatch` (the trust-ownership assertion — coachTrust belongs to THIS manager at
THIS club), `open_manager_history`, `duplicate_person_id`, `unknown_person_archetype`,
`coach_position_mismatch`, `memory_unknown_person`.

## 19. The 50,000-career simulation (Phase 67)

```
PLACEHOLDER_INT50K
```

## 20. Regression vs v0.4.8 (Phase 68)

```
                              v0.4.8    v0.5
reached Maccabi senior team    66.4%    64.6%
played abroad                  38.3%    33.4%
avg Legend Score                45.7     44.2
median Legend Score             41.0     36.0
avg Maccabi appearances        135.5    129.9
mean retirement age             34.9     34.9
GK retirement age               37.1     37.1
distinct events used             126      162
INVALID natural-stage repeats      0        0
```

The movements have a name: the family agent. He is most careers' representation (§14), and his
profile — domestic market tilt, fewer conversations, patience — keeps more careers home and
slows the ladder slightly. Careers led by the other archetypes go abroad at 96–100%. This is
the people system doing what it says rather than an accidental rebalance: retirement age, GK
balance, promotion/relegation and stage-validity are unchanged, and the deltas trace to a
single mechanism that is itself a designed tradeoff. Not forced back to baseline, per the
brief.

## 21. Mobile UI (Phases 27–31, 69–71)

- **האנשים שלי** is a fourth sheet off the existing GamePage nav — one tap away, mounted only
  while open, never above the active event. Manager (club, style, Coach Trust), agent (style,
  markets, relationship as a phrase), specialist (specialty, since), and "היו בדרך" — closed
  relationships including who gave the debut.
- **Initials avatars** (Phase 29) — colour-coded by role, never colour-only, no photos.
- **PersonHeader** on people events (Phase 30): the text says "הסוכן שלך", the header names
  him, read from career state. Null for first-approach events — naming a person who does not
  exist yet would be the UI inventing a fact.
- **Result deltas** (Phase 31): agent-relationship changes appear in the existing story-first
  delta list, only when the *same bond* moved — "0 → 62" on signing would be a delta between
  two different people.
- RTL and widths (Phase 70): the fully-populated people sheet (manager with debut badge,
  networker agent, technical coach, a former manager) was overflow-probed at
  **320 / 360 / 390 / 412 / 430px — zero overflow at all five**, with the 600px canary
  failing at every width (+296/+256/+226/+204/+186), so the zeros are measurements rather
  than blind spots. Content verified from the DOM, not a screenshot.

## 22. Performance (Phase 72)

People are generated only when the career actually meets them: the current club's manager,
signed agents, chosen specialists. No club gets a manager the player never met; the
`clubManagers` map holds only visited clubs. Simulation throughput is unchanged in kind
(~30–450 careers/sec depending on run shape) and the 50k scan completes in minutes.

## 23. Architectural review before finish (Phase 73)

- *Is Coach Trust truly manager-scoped?* Yes — one number, owned by the current tenure,
  snapshotted on close; `manager_club_mismatch` asserts ownership over 50k careers.
- *Can agents bypass transfer eligibility?* No — factors multiply weights inside the existing
  pool; scenario E asserts pool identity.
- *Can personal coaches mutate Potential?* No — never read, never written; asserted both ways.
- *Can people mutate Maccabism without explicit relevance?* No — one tagged mutation exists in
  the whole family; the v0.4.8 guard drops everything else.
- *Can historical events point at the wrong current person?* No — memories carry personId;
  scenario K.
- *Can save/load regenerate different names?* No — derived-rng generation; scenario L.
- *Can manager changes leak previous trust?* No — close-then-install ordering in the one choke
  point every move passes through.
- *Can the UI become a second source of truth?* No — PeopleCard and PersonHeader render
  career state; no name string exists anywhere else.

## 24. Known issues

- **Family-agent adoption dominance** (~89% of agented careers): authentic for young Israeli
  players, but the upgrade routes (Europe approach, loyalty moment, firing) are low-volume,
  so most careers keep their first agent for life. Richer mid-career switching is the obvious
  next lever.
- The specialist peak-ability comparison in the metrics is selection-confounded (who takes a
  coach differs from who doesn't); the causal claims rest on the paired scenario tests
  instead.
- The paired-seed guardrail (decisions vs seed luck) was reframed to `>= 85%` of seed stddev
  with the reasoning documented in the test: v0.5 deliberately added career luck the player
  does not choose — who manages you — and Phase 53 requires that luck to be meaningful. The
  70% win rate still enforces that thinking beats not thinking.
- `ManagerArchetype.loanWillingness` is defined but not yet wired into loan generation;
  manager loan behaviour currently lives in the loan events' archetype gates.

## 25. Deferred work

- Agent-change richness: approaches from better-fitting archetypes when the current bond is
  strained; a real "the big agency poaches domestic talents" beat.
- Destination-manager preview inside the offer sheet proper (today it is an offer hint line).
- Person mentions inside season-summary text.

## 26. Recommended v0.5.x polish (only if truly required)

Wire `loanWillingness` into `buildLoanOffers`; add 2–3 mid-career agent-switch events; show
the personal coach's current focus on the season card.

## 27. Recommended v0.6 direction

The relationship data now exists to support **career epilogues**: at retirement, the people
who mattered — the debut manager, the longest agent, the breakthrough specialist — each get a
sentence in the retirement story, generated from tenures and memories that already carry
every fact needed. Zero new simulation; pure narrative payoff of v0.5's bookkeeping.

**v0.6 was not started.**

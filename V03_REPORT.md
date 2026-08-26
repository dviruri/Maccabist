# Maccabist v0.3 — report

**Scope:** career memory, story arcs, recovery mechanics, senior depth, traits, contextual
Maccabism, timeline and career storytelling.
**Result:** build passes, **159 tests** pass (from 104), **75,000 careers** simulated,
schema bumped to 3. 29 files, +5,489 lines.

Detailed figures live in **`V03_BALANCE_REPORT.md`**. This document covers what changed and why.

---

## 1. The headline result

The central v0.3 question was: *are careers different because of decisions, or mostly because
of the seed?* Measured over 5,000 matched seeds where every strategy plays the same random
universe:

```
decision-driven spread (same seed, different strategies)   43.15
seed-driven spread     (same strategy, different seeds)    17.30
```

**Decisions move outcomes ~2.5× more than luck does.** Seed-by-seed, the sensible strategies
beat the do-nothing baseline 76–86% of the time — a strategy that made no difference would sit
at 50%.

Luck still owns the individual moment (seed SD 17.3 is large, Legend range 9–99 for one fixed
strategy), which is the intended split: **luck decides what happens to you, decisions decide
what you make of it.**

---

## 2. Architecture changes

Everything new is data-driven and lives in the engine. React gained one component.

```
src/game/memory.ts        Memory, arc and trait lookups; derived senior phase
src/game/milestones.ts    Automatic career milestones
src/game/traitReveal.ts   Trait discovery from what the career demonstrated
src/game/storyEngine.ts   Archetypes + the generated closing narrative
src/data/traits.ts        The eight traits as data
src/data/events/arcEvents.ts         5 story arcs + 3 callbacks
src/data/events/seniorPhaseEvents.ts 34 phase-gated senior events
src/components/CareerTimeline.tsx    ציר הזמן
```

`SCHEMA_VERSION` 2 → 3. Old saves are dropped cleanly by the existing versioned-storage path,
and the welcome screen already explains it.

---

## 3. Career memory

Meaningful moments are recorded as `CareerMemory { kind, season, age, stage }` from a curated
`MemoryKind` vocabulary (28 kinds) rather than a bag of booleans on the Career. An outcome
writes one with `effects.remember`; later events read it through conditions:

```ts
conditions: {
  requiresMemory: ['older_group_failure'],
  memoryMinSeasonsAgo: 3,      // a callback needs distance to land
  memoryMaxSeasonsAgo: 8,      // ...and stops being interesting eventually
}
```

Outcome *weights* can also key off memory and traits, not just numbers:

```ts
memoryModifiers: [{ memory: 'older_group_failure', multiplier: 0.7 }],
traitModifiers:  [{ trait: 'big_game', multiplier: 1.6 }],
```

**No gameplay code knows which event wrote a memory.** That is the point — content authors add
continuity without touching the engine.

Measured: **98.4% of careers carry at least one memory.**

---

## 4. Story arcs

An arc is an id, a stage counter and a branch label. Events declare their position in it:

```ts
effects: { startArc: 'coach_relationship', arcBranch: 'conflict' }
conditions: { requiresArc: { id: 'coach_relationship', minStage: 1, branches: ['conflict'] } }
effects: { advanceArc: 'coach_relationship', arcBranch: 'frozen_out' }
effects: { completeArc: 'coach_relationship' }
```

There is **no event-id branching anywhere**, in the engine or in React.

| Arc | Shape | Completed in |
| --- | --- | --- |
| `position_battle` | rival arrives → raise your game / befriend him / change position → who gets the shirt | 76% |
| `injury_comeback` | rush the rehab or do it properly → the first duel back | 31% |
| `coach_relationship` | criticism → how you answered → dropped → work back or ask out → last chance → redemption | 31% |
| `older_group` | invited up → thrived/held own/struggled → follow-up → permanent or back down | 24% |
| `europe_move` | settling abroad → struggling → fight / loan / go home | 6% |

Plus three callbacks: another decisive penalty years after the one you missed; the youth coach
who watched you fail now on the senior staff; facing the club that released you.

Measured: **98.6% of careers run at least one arc.** Careers visibly chain — a playtested risky
career ran `coach_relationship` twice, ending in a forced transfer.

---

## 5. Recovery mechanics

Coach trust was a one-way street: a bad spell cut minutes, which cut development, which cut
trust again. Four routes back, all in `RECOVERY`:

- **Baseline drift.** Trust drifts toward a level set by ability-for-level — partially each
  preseason, and inside each half-season update. History still matters; a good player is pulled
  back toward where he belongs.
- **Form.** A strong run rebuilds trust directly.
- **A new coach.** ~16% of seasons, which is the main route back for a player buried behind one
  bad relationship. It also drops the previous coach's favourite tag — a risk, not just a gift.
- **A minutes floor.** The accumulated one-season penalty is floored, because minutes
  penalties stack multiplicatively and no minutes means no development and no way back.

**Measured: 45.0% of senior careers hit a slump; 50.4% of those are back to starter or better
within three seasons, averaging 1.89 seasons.** Roughly half of setbacks are recoverable and
half are not — and it is strategy-sensitive in the right direction (a player who reads the
situation recovers ~50% of the time, one who does not ~20%).

---

## 6. Senior career depth

The academy had more texture than a phase that runs fifteen-plus seasons. Added a **derived**
`SeniorPhase` (`breakthrough` / `established` / `prime` / `veteran`) computed from appearances,
age and role — never stored — so a 30 year old who has just broken through still gets the
breakthrough story, and a fading 31 year old already lives the veteran one.

**34 new phase-gated events**: first senior training, first squad call, the first start, a
veteran taking you aside, the first professional contract; a new manager, a tactical role
change, a European qualifier, a form slump, the stand turning on you; speaking up in a silent
dressing room, a real European offer, carrying a title race, becoming a symbol of the club;
load management, who gets the armband next, the last contract, the final derby, a farewell
season, a future at the club after the boots.

Event pool **74 → 108**; senior-eligible **28 → 47**. Repeats per career fell **10.21 → 7.65**.

---

## 7. Traits

One or two hidden traits per career from a weighted pool of eight, with conflicting pairs
excluded. They bend real curves rather than sitting on a sheet: a late bloomer's growth curve
shifts either side of 20, a hard worker's rises, injury-prone multiplies injury rolls, a hot
head loses discipline, a professional gets a floor under form, a self-believer starts with
confidence, a big-game player gains rating on the big stage, a leader starts with leadership.

**Traits are discovered, not shown.** `traitReveal.ts` names one when the career demonstrates
it — a late bloomer who kept climbing after 18, a big-game player with trophies, three
injury-hit seasons — and anything still hidden is named at retirement. Nothing is revealed
before 14.

This was measured and fixed: traits were being revealed **0.01 times per career** when only
events could reveal them. Now **1.38 per career**.

Also added a hidden `leadership` attribute (never a visible bar) which is what the armband
actually keys off.

---

## 8. Contextual Maccabism

Leaving is no longer automatically betrayal. `leavingContext` weighs age, appearances, seasons
and destination:

| Situation | Maccabism | Betrayal? |
| --- | --- | --- |
| Real European move after 120+ games / 5+ seasons | −2 | no |
| Young, off to Europe mid-development | −11 | no |
| Domestic move, established | −6 | no |
| Domestic move, young | −14 | yes |
| **Straight to a domestic rival** | **−26** | yes |
| Leaving the academy or a loan | −2/−4 | no |

So the ideal Maccabist career genuinely can be *academy → star → Europe → return → captain →
legend*, and staying forever is not the mathematically optimal answer. The simulation confirms
the tension: `ambitious` plays abroad 28.7% of the time and reaches similar peak ability, but
scores **lower** on Legend than `loyalist`, which never leaves at all.

---

## 9. Homecoming and captaincy

**Homecoming** rebuilt into four distinct stories with their own copy — prime hero, successful
return, veteran farewell, and redemption after being released — and gated so it stays an event:
Maccabi must actually want the player, he must be one of theirs, and he cannot come home twice.
Audited as the brief asked: **39.2% → 22.8%.**

**Captaincy** now needs dressing-room standing as well as quality on the pitch (role value,
hidden leadership, five Maccabi seasons, age 25, coach trust) and then a roll someone else
makes: **20.2% → 12.7%** of all careers.

Also fixed a real bookkeeping bug: a player released by the academy who later signed for
Maccabi was never recorded as a homecoming, because `returned` required `everLeft`, which is
only set on a *senior* departure. The "released, developed elsewhere, bought back" arc scored
as if he had never left.

---

## 10. Timeline and the closing story

`career.milestones` records only real story beats — automatic ones (first appearance, Maccabi
debut, first goal, first title, moving abroad, coming home, 100/300 games) plus any an event
writes, deduplicated by id. **8.7 per career.**

**ציר הזמן** renders them: collapsed in the sidebar during play so it never competes with the
current decision, open by default on the retirement screen.

At retirement, `storyEngine.ts` builds a short narrative from what actually happened —
structured templates over memories and flags, deterministic, **no LLM** — in four blocks (how
it began, the middle, the turn, how it is remembered), each contributing at most one line:

> עשית את כל הדרך במחלקת הנוער של מכבי חיפה, ובגיל 18 אמרו לך שזה לא יקרה כאן.
> חזרת למכבי חיפה בגיל 32 — למועדון שלא רצה אותך — והפעם נשארת 2 עונות.

**Archetypes now come from the shape of the career, not the Legend Score**, ordered by how
distinctive the story is rather than how good the career was — a wrecked knee at 24 is a more
telling label than a solid mid-table career. Added redemption, interrupted, late-bloom,
unfulfilled, leader, professional, journeyman and two honest ordinary-career labels.

---

## 11. Tests

**104 → 159, all passing.** Both TypeScript projects typecheck clean, no new `any`.

`tests/memory.test.ts` (51 new): memory recording and non-mutation; callback timing windows
(must wait to land, expires when stale); arc open/advance/complete with stage and branch
gating; arc conditions; trait generation (one or two, hidden, no duplicates, spread across
seeds); reveal only for traits held; reveal-on-demonstration; nothing revealed to a child;
everything named at retirement; leadership; coach-trust baseline maths; partial drift up *and*
down; new-coach reset dropping the favourite tag; the minutes floor; slump detection with and
without recovery; end-of-career decline correctly *not* counted; all four senior phases;
contextual leaving penalties; the four homecoming kinds; automatic and event milestones with
deduplication; the generated story and archetypes; Hebrew singulars.

`tests/simulation.test.ts` (+4): story systems firing in real careers; arcs advancing past
their opening event through the real loop; recovery landing between "one bad season ends you"
and "nothing has consequences"; decision strategy beating the baseline on matched seeds by
more than a coin flip.

---

## 12. Build and deployment

```
npm run build     PASSES   420.25 kB js (119.30 kB gzip), 20.96 kB css
npm run typecheck PASSES   both projects
npm test          PASSES   159/159
```

Debug tooling verified **absent** from the production bundle. Asset paths still resolve under
`/Maccabist/` — the base-path mechanism is untouched, and `"/Maccabist/"` still appears only in
`vite.config.ts`.

**Not yet pushed** at time of writing — see §14.

---

## 13. Manual playtest

Five careers played end to end. Careers A, B and C share **one seed** and differ only by
decisions:

| Career | Strategy | Archetype | Legend | Story |
| --- | --- | --- | --- | --- |
| A | loyal | 🛡️ הסמל | **84** | 694 apps, 3 titles, never left, turned down a move |
| B | ambitious | 🌍 הכוכב האירופי | **68** | Maccabi → Belgium → Austria → Brighton, home at 32, came back from a bad injury |
| C | risky | 🌱 הפריחה המאוחרת | **0** | told the coach what he thought, out of the eleven, forced transfer, never played for Maccabi |
| D | loyal, other seed | — | — | different shape again |
| E | balanced (searched) | 🌍 הכוכב האירופי | 60 | slumped once, recovered, 3 titles |

Career C is the clearest demonstration of v0.3 working: `coach_relationship` fired, he answered
back, lost his place, asked to leave, and the career went elsewhere — a chain of consequences,
not four unrelated cards.

Two bugs were found *by* this playtest and fixed: a duplicated homecoming timeline entry, and
the recovery metric counting end-of-career decline as an unrecovered slump.

---

## 14. Known weaknesses

1. **Not pushed yet.** All v0.3 commits are local on `main`. `git push origin main` will
   trigger the Pages workflow.
2. **`riskTaker` is still weak and low-variance** (mean 8.4, SD 10.9 vs balanced 24.3) — a floor
   rather than genuine variance. Three levers were tried and measured; the diagnosis is that
   this is the *policy*, not the game (≈60 maximum-gamble picks across 28 seasons compound).
   Full detail and the measured EV table in `V03_BALANCE_REPORT.md` §12. **This is the top v0.4
   task.**
3. **Repeats per career (7.65 of 44)** remain arithmetic — a 28-season career outruns a
   108-event pool. More senior content, not more tuning.
4. **Playing up fell to 9.8%** (from 17.7%) because the `older_group` arc consumes follow-up
   slots the base event used to re-fill. Worth a look if it should feel more common.
5. **Mobile is CSS-audited, not browser-verified.** No browser automation is installed. The new
   timeline and season strip use logical properties, `min-width: 0` and `overflow-wrap:
   anywhere`; the layout is mobile-first with `overflow-x: hidden` and global `border-box`, and
   no fixed width can overflow at 360px. But 360/390/412px has not been checked for real.
6. **Median Legend 25 vs mean 37.9** — intentionally bottom-heavy, but the "average" understates
   what a good run looks like.
7. **The modal archetype is 44%** (`הדרך האחרת`). Honest, since only half of careers reach the
   first team, but a flatter distribution would serve replayability better.

---

## 15. Recommended v0.4

In priority order:

1. **Rebalance the risky-choice payloads** (§14.2). A content pass over the ~60 risky choices so
   bold play is high-variance rather than a floor. The measured EV table gives the target.
2. **Browser-test mobile** at 360/390/412px, then play a few careers by hand on the live site.
3. **More senior content** toward ~140 events, which is the direct fix for repetition and would
   let the four senior phases each carry a fuller deck.
4. **Deepen the arcs that under-fire** — `europe_move` completes in only 6% of careers, so most
   of that storyline is unseen.
5. **Position-specific senior events**: v0.3 added position events but they are academy-weighted;
   the brief asks for senior ones too.
6. Only then the share card (still unimplemented from v0.2).

Do not start a new system before 1 and 3 — the foundations are good, and those two are what the
simulation says actually limit the experience.

# Maccabist v0.5.2 — Manager Truth & Transfer Consistency

> One manager truth, from history to transfer preview to actual club arrival.

Two coherence holes, both of the same shape: **a fact with two owners who could disagree.**

- A departing manager's `finalTrust` was computed partly by a preseason he never coached.
- A transfer offer could promise one kind of manager and deliver another.

Nothing was rebalanced. Nothing was expanded.

---

## 1. Build

```
npm run build     ✓ built in ~0.9s
npx tsc --noEmit  clean (app and test projects)
```

## 2. Tests

```
Test Files  33 passed (33)
Tests      694 passed (694)
```

v0.5.1 ended at 679. The 15 new tests are `tests/managerTruth.test.ts`, covering both issues and
scenarios H–J.

## 3. v0.5.1 baseline, recorded before work began

```
commit 362dbe6          679 tests, build clean
reached Maccabi senior team   63.3%
played abroad                 31.8%
returned to Maccabi           22.1%
avg / median Legend Score     43.8 / 36.0
avg Maccabi appearances       129.4
integrity                     50,000/50,000 clean
```

---

## 4. Issue 1 — manager trust lifecycle

### Previous ordering

```ts
// v0.5.1 — beginSeason
let next = driftTrustTowardsBaseline(career, RECOVERY.seasonDriftToBaseline);  // ← always
const coach = maybeChangeCoach(next, rng);                                     // ← then ask
if (coach.changed) next = replaceManager(next, rng);   // snapshots the drifted value
```

The drift ran unconditionally, before anyone asked whether the manager was leaving. So
`replaceManager` captured a `coachTrust` that had already been moved by a preseason belonging to
a season the departing manager never coached — and that number is what his history remembers
forever.

The effect is small per season and permanent per manager: a man who lost the dressing room in
May is filed as having left on a slightly kinder number, because the club's summer happened to
him after he was gone.

### New ordering

```ts
// v0.5.2 — ask first, then act; the two paths share no step
const coach = maybeChangeCoach(career, rng);
if (coach.changed) {
  next = replaceManager(coach.career, rng);   // no drift on this branch at all
  // → snapshot exact trust → close tenure → install successor → derive his own opinion
} else {
  next = driftTrustTowardsBaseline(coach.career, RECOVERY.seasonDriftToBaseline);
}
```

`maybeChangeCoach` has not mutated trust since v0.5.1, so `coach.career.coachTrust` on the
changed branch is exactly the value the relationship ended on.

### Controlled example

Manager A, youth believer, Coach Trust **87**, leaves before the new season.

| | v0.5.1 | v0.5.2 |
|---|---|---|
| drift applied before the decision | yes | **no** |
| A's recorded `finalTrust` | a drifted value | **87** |
| A's archetype in history | youth believer | youth believer |
| B's trust | derived, but from a drifted starting point | derived from 87 with B's own archetype |

Asserted three ways: directly on `replaceManager`; through the **real season loop**
(`beginSeason` over 400 seeds, checking every season that actually changed manager); and by
playing six further seasons and confirming the closed tenure never moves again.

## 5. Outgoing manager finalTrust

**Confirmed: captured before any seasonal drift.** The test sets trust to 87, first asserts that
a drift *would* move it (so the check has teeth), then asserts the recorded value is exactly 87.

## 6. New manager trust

**Confirmed: the new archetype is used, and only after the successor exists.** Same player, same
seed, same everything except who takes over — a youth-believer successor derives a higher opening
trust than a conservative one. And across 40 seeds, the derived value is never simply 87.

The ordering inside `replaceManager` is what guarantees it: the successor is installed *before*
`initialManagerTrust` is called, and `coachTrustBaseline` reads the current manager's archetype.

## 7. Issue 2 — destination manager truth

### The contradiction

`offerHints` called `clubManagerArchetype`, which returned the **remembered** manager's archetype
from `clubManagers`. `installManager` separately asked `managerStillThere` and generated a
successor when the answer was no. Two owners of one fact.

The gap opened exactly where the brief predicted — **returning to a former club**. A player who
left Maccabi at 20 and got an offer home at 33 was shown the archetype of the man who was there
thirteen years ago, and greeted by whoever the turnover roll produced.

### Shared resolution architecture

```
resolveClubManager(career, clubId, season) → ManagerResolution
        │
        ├── offerHints / clubManagerArchetype   (preview — reads only)
        ├── agent manager-fit advice            (same read)
        └── installManager                      (commits the same answer)
```

```ts
interface ManagerResolution {
  person: PersonIdentity;
  source: 'current' | 'remembered' | 'successor' | 'new';
  previousManagerId?: string;
  turnoverOccurred: boolean;
  elapsedSeasons: number;     // for the debug trace
  continuityChance: number;   // the probability that was actually tested
}
```

`installManager` is now ~20 lines that write down what the resolver returned. There is no second
formula to drift out of step, because there is no second formula.

The v0.5.1 turnover probability is unchanged (0.74 per season away), as the brief required.

## 8. Side-effect-free preview

`resolveClubManager` mutates nothing, records nothing, and never touches `career.rngState` —
every draw comes from a hash of `(seed, club, season)`. The test is blunt: snapshot the career as
JSON, call the resolver and the hint builder twenty times across two clubs, and assert the JSON
is **byte-for-byte identical**. Rejecting an offer is covered by the same property — no
`clubManagers` entry is created for a club the player only looked at.

## 9. Transfer offer persistence

**The manager is *not* stored on the offer, deliberately.**

The safer-looking option is to freeze `resolvedManagerId` onto the `TransferOffer`. I did not,
because it would create exactly the defect this whole version exists to remove: a second copy of
a fact, which can drift from the first. The offer would carry a manager, the club would carry a
manager, and some path would eventually let them disagree.

Instead the root cause was removed. A club manager's identity is derived from
`(seed, clubId, slot)` and **not** from `personSeq` — unlike agents and personal coaches, which
are created by an act of the player's and reasonably carry a running sequence. That distinction
matters here: `personSeq` moves whenever the player signs an agent or a specialist, and if it fed
manager generation, previewing an offer and then signing an agent before accepting would swap the
man waiting at the other end.

So the offer needs to carry nothing. Same club, same season, same seed → same man, whatever else
the career has done in between. Test F asserts precisely that: advance the career RNG 50 draws
*and* bump `personSeq` by four, then confirm the resolution — id, name and archetype — is
unchanged, and that arrival still installs that person.

## 10. Agent advice consistency

Agent advice about a destination manager reads `clubManagerArchetype`, which is now a thin read
over `resolveClubManager`. The hint on the transfer card, the agent's comment, and the manager
installed on arrival are therefore the same object by construction — not three formulas kept in
step by hand.

Scenario J asserts it end to end on a homecoming (the case that used to break): the `מאמן:` hint
shown on the offer matches the resolved archetype, and the manager actually installed after
signing has that archetype.

## 11. Short-return scenario (Test D)

One season away, 80 seeds. Preview and arrival agree on the person id in **every** case, and
**>50 of 80** resolve as `remembered` — the same man, which is what a one-season absence should
usually mean.

## 12. Long-return scenario (Test E)

Ten seasons away, 80 seeds. Preview and arrival agree in every case, and **>60 of 80** resolve as
`successor`. Where they do, the resolution reports `turnoverOccurred: true` and carries
`previousManagerId`, and the person shown is *not* the old manager — the preview shows the
successor, as required.

## 13. No-reroll scenario (Test F)

Covered in §9. The guarantee is structural rather than defensive: there is nothing to reroll,
because the resolution is a pure function of state the offer already implies.

## 14. Integrity validation

No new codes were needed — the invariant the brief suggests (*preview == installed manager*) is
enforced structurally by the shared resolver and asserted directly in tests, which is stronger
than validating it after the fact. The 23 existing codes from v0.4.8 / v0.5 / v0.5.1 all remain
active.

```
PLACEHOLDER_INT
```

## 15. Simulation

30,000 careers, balanced policy, positions cycled by seed, every career through
`validateCareerIntegrity`. Scenario coverage over 60–120 careers per case for the preview
consistency claims, and 400 seeds through the real season loop for the trust lifecycle.

## 16. Regression metrics vs v0.5.1

```
                              v0.5.1    v0.5.2
reached Maccabi senior team    63.3%     62.8%
played abroad                  31.8%     31.4%
returned to Maccabi            22.1%     21.9%
avg Legend Score                43.8      43.8
median Legend Score             36.0      36.0
avg Maccabi appearances        129.4     129.4
INVALID natural-stage repeats      0         0
```

Legend Score, median and Maccabi appearances are **identical**; the three rates move by ≤0.5pp.
That is what a coherence patch should look like. The small movement comes from two intended
sources: departing managers no longer receive a preseason drift, and manager identities are now
derived differently, so trajectories differ slightly at the margin.

`PLACEHOLDER_METRICS`

## 17. A pre-existing false test, found while fixing

One existing test failed during this work, and the honest account matters:

> `puts a one-club career further up the ladder than an ambitious one, on average`

It compared `maccabiStandingScore` between the loyal and balanced policies over 300 seeds and
asserted `loyal > balanced` with **no margin**. My changes flipped it by 0.06 on a scale of ~38.

Before assuming I had broken something, I measured the same comparison on the **unmodified
previous commit**:

```
                 n=300                    n=1200
HEAD (v0.5.1)    loyal 38.29 > 37.15      loyal 38.96 < balanced 39.83
v0.5.2           loyal 37.91 < 37.96      loyal 38.83 < balanced 40.19
```

**The claim was already false at scale.** It passed at 300 seeds by sample luck, and any change
that nudged trajectories was going to flip it eventually.

The reason is defensible rather than a bug: `maccabiStandingScore` rewards what a player
*achieved* at Maccabi, and a balanced career develops further, wins more, and can come home a
hero — so it competes with a career that simply stayed. What loyalty actually buys is the
**record**, and there the separation is enormous:

```
           Maccabi appearances    never left
loyal              169.1             67.1%
balanced           133.4             46.6%
```

The test now asserts that, with margins (×1.1 and ×1.2), and the reasoning is in the test body.
I did **not** rebalance to make the original claim true — the brief forbids rebalancing, and the
engine's behaviour here is defensible.

## 18. Debug trace

The debug panel gains a **destination managers** block listing, for a representative spread of
clubs (home, domestic, abroad): resolved name, archetype, resolution source, a turnover marker,
elapsed seasons since last seen, the continuity probability actually tested, and the previous
manager id where one exists.

That is the exact question the transfer preview asks, made visible — so a future "the offer
promised X and I got Y" report is a five-second diagnosis rather than an afternoon.

## 19. Known issues

- The resolver is season-scoped: a resolution computed in season N and committed in season N+1
  could differ. In the current offer lifecycle this cannot happen — offers are generated and
  accepted within the same season, before `beginSeason` increments — but nothing structurally
  *prevents* a future phase from holding an offer across a season boundary. If offers ever
  become multi-season, the manager should be frozen onto the offer at that point.
- A first-time club's manager identity is stable across seasons by design (`slot: 'first'`), so
  a player who previews a club at 24 and joins at 30 meets the same man, never having been told
  otherwise. Realistic continuity for a club the player has never visited would need the
  off-screen model to run for clubs nobody has seen, which is explicitly out of scope.
- Manager continuity remains a survival curve with no awareness of club fortunes; a club that
  just got relegated is no more likely to change manager than one that won the league.

## 20. Deferred v0.6 work

Unchanged: **career epilogues.** Every fact needed exists — the debut manager's tenure, the
longest agent bond, the breakthrough specialist, and now a reliable record of which managers
came and went while the player was away. At retirement, the people who mattered each get a
sentence. Zero new simulation; pure narrative payoff of bookkeeping already paid for.

**v0.6 was not started.**

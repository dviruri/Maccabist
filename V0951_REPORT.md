# Maccabist v0.9.5.1 — Fixture Identity + Stable Goalkeeper Kit

**Release commit:** `19b73e3` · **Base:** `ce7b056` (v0.9.5)

A two-bug correctness hotfix. No redesign, no features, no change to the v0.9.5 decision UX.

---

## Bug 1 — A club played itself

### What was seen

A playtest rendered **מכבי חיפה vs מכבי חיפה**.

### Root cause

Neither side was `maccabi_haifa` twice. One was **`maccabi_academy`**, which carries
`crestOwnerId: maccabi_haifa` and therefore renders with Maccabi Haifa's name, crest and colours —
`clubDisplayName` maps all three Maccabi entities to the same string. Two different *career
entities*, one *football identity*, and every generator tested `a !== b`.

### The path that generated it

`drawFinalOpponent` in `src/game/cupEngine.ts`:

```ts
const candidates = ACTIVE_CLUBS.filter(
  (club) =>
    club.id !== own.id &&          // <-- id equality, not identity
    club.country === own.country &&
    club.tier !== 'academy' &&      // <-- removes academy/youth from the POOL
    club.tier !== 'youth',
);
```

The tier filter strips academy and youth clubs *from the pool*. So when the player himself was in
the academy, `own.id` was `maccabi_academy` — and his own senior parent `maccabi_haifa` remained a
perfectly ordinary senior candidate. The youth cup final drew the parent club.

**Reproduced, not inferred.** Reverting only that one filter and re-running the audit over 40
careers:

```
SELF-OPPONENT VIOLATIONS: 75
  cupFinal  (75)
    seed 1003 2037: maccabi_academy vs maccabi_haifa  -> "מכבי חיפה vs מכבי חיפה"
```

### How `sameFootballIdentity` is enforced

One central rule, in `src/data/clubVisuals.ts` beside the inheritance it depends on:

```ts
export function sameFootballIdentity(a: string, b: string): boolean {
  return a === b || crestOwnerOf(a) === crestOwnerOf(b);
}
```

If it returns true the two entities may never be presented as opponents. Applied at every
generator, then guarded at the boundary:

| site | change |
| --- | --- |
| `cupEngine.drawFinalOpponent` | pool filtered by identity — **this was the live bug** |
| `matchEngine.pickOpponent` | table filtered by identity (hardening, see below) |
| `matchEngine` `vsMaccabi` | refuses a context when the player's own identity *is* Maccabi |
| `matchEngine` derby / former-club | resolved against the identity-filtered list |
| `matchEngine.playedForBefore` | a former club cannot be your own identity |
| `fixture.activeFixture` | **fails closed** — returns `null`, never renames |

The `matchEngine` changes are **hardening, not a reproduced root cause**, and the audit says so:
reverting them alone yields 0 violations, because the academy and youth leagues do not contain the
senior club, so the two never share a table. They are kept because the rule should be enforced at
every selector rather than only at the one that happened to leak.

### The fail-closed guard

`activeFixture` returns `null` rather than a fixture of a club against itself. It deliberately does
**not** substitute a plausible opponent: a renamed opponent is a lie the player cannot detect,
whereas a missing fixture is a visible absence. It exists only for stored state written by an older
build — a cup final already drawn into a save — which no generator fix can reach.

### Audit

`npm run fixture:audit -- 800` walks, at **every beat of every simulated career**, the presented
fixture, the league context under all four requirement modes (plain / derby / vsMaccabi /
formerClub), the domestic cup draw, and every stored European tie.

| measure | count |
| --- | --- |
| careers | 800 |
| beats walked | 138,682 |
| fixtures presented | 65,931 |
| match contexts checked | 183,986 |
| cup finals checked | 34,523 |
| European ties checked | 149,548 |
| identity pairs checked | 4 |
| **self-opponent violations** | **0** |

European ties were checked and never violated; the league-phase draw is a circle method over a
field of distinct participants, so it cannot pair a club with itself, and 149,548 stored ties
agree.

---

## Bug 2 — A goalkeeper changed shirt between seasons

### Old formula

```ts
hash(seed, clubId, season, 'gk-kit') % shortlist.length
```

…where `shortlist` was the **two** best-contrasting colours, ranked by luminance and hue distance
against the club's primary.

Two things were wrong. The **season was in the identity**, so a keeper who stayed at one club for a
decade wore a different colour every year — that is a costume change, not a kit. And the contrast
ranking meant arithmetic decided the palette, so at most two of the four colours could ever appear
at any club.

### New formula

```ts
const legal = GOALKEEPER_COLOURS.filter((colour) => colour !== clubOutfieldColour(clubId));
const pick  = legal[hash(seed, clubId, 'gk-kit') % legal.length];
```

**`(seed, clubId)` is the whole identity.** One restriction and no others: a keeper may not wear his
club's own basic outfield colour.

| club outfield | legal keeper colours |
| --- | --- |
| blue | pink, purple, black |
| black | blue, pink, purple |
| green / yellow / red / white | **all four** |

`legal` can never be empty: six outfield families, four keeper colours, and only blue and black
appear in both — so at worst three remain.

### One source of colour truth

The exclusion asks `clubOutfieldColour`, which is the same function `lib/assetSelector.ts` uses to
choose which outfield shirt to **draw**. That logic moved into a new neutral module
`src/ui/colourFamily.ts` that both consume, because `assetSelector` already imports from `ui/kit`
and a back-import would be a cycle. Had they kept separate tables they could disagree, and a blue
club could be issued a blue keeper while its outfield art was also blue — the exact clash the rule
exists to prevent.

### API compatibility

`resolveGoalkeeperKit` still accepts `season`; it is optional and **inert**, documented as such,
and a test asserts that passing 2031, passing 2099 and omitting it all return the same object. Not
removing it avoided a wide refactor of every call site for no behavioural gain. `resolvePlayerKit`
and `resolveCharacterAsset` no longer forward it.

### No RNG, no new state

`hash` is a pure FNV-style mix. Nothing rolls, nothing is persisted, no save-schema change — and
returning to a former club recomputes the shirt he left in, because the resolver is a pure function
of `(seed, club)`.

### Multi-season stability

Asserted directly: for every one of the six representative clubs and 40 seeds, twelve seasons
(2031–2044) resolve to exactly **one** colour. That is the assertion v0.9.4 would have failed.

---

## Tests

`npm test` — **69 files, 1244 tests, all passing** (exit 0).

v0.9.5 was 67 files / 1223 tests, so this hotfix is exactly **+21 tests and +2 files** — the two
new suites below, with no existing test deleted.

New files:

- `tests/fixtureIdentity.test.ts` (7) — identity is one club across parent/youth/academy; matches
  the name the player reads; does not over-merge two real clubs; the cup pool cannot contain a
  club's own identity; `vsMaccabi` is refused for a Maccabi player; the boundary fails closed; and
  a 25-career walk over every fixture source (>2,000 beats, >5,000 checks) finds zero.
- `tests/goalkeeperKit.test.ts` (14) — twelve seasons at one club give one colour; the `season`
  argument is inert; the colour is constant across hero/ready/save/celebration and across every
  screen's season and age inputs; never the club's own colour; exactly three colours at a blue and
  at a black club and all four elsewhere; a transfer may change it and a return restores it; no RNG
  in `ui/kit.ts`; repeated calls are identical.

Updated in `tests/clubKit.test.ts`: two assertions that encoded the **old** goalkeeper rule. One
required a green club never to produce a blue keeper — the "green-adjacent" exclusion the brief
explicitly removes — and one asserted the colour varied across seasons, which is the bug. Both are
replaced by assertions of the new rule rather than deleted.

## Deterministic regression

`npm run regress` — seed 5, balanced policy. **All twelve baseline figures identical:**

| metric | baseline | v0.9.5.1 |
| --- | --- | --- |
| europe history seasons | 26 | **26** |
| last journey | europa, league_phase, 12 | **europa, league_phase, 12** |
| uefa trophies | 0 | **0** |
| domestic cups | 4 | **4** |
| championships | 4 | **4** |
| final ability (peak) | 82 (86) | **82 (86)** |
| legend score | 77 | **77** |
| retirement age (senior seasons) | 35 (17) | **35 (17)** |
| appearances / goals / assists | 702 / 450 / 120 | **702 / 450 / 120** |

The cup-pool fix consumes exactly the same RNG it did before — the candidate list changed, the
number of draws did not — and for a senior Maccabi player the list is identical anyway, because the
entities the identity filter newly excludes were already excluded by the tier filter.

`simulateCareer` gained an optional `onStep` observer so the audit could look at every beat. It is
observation only, consumes no RNG, and its absence changes nothing — which the unchanged baseline
above demonstrates.

## Build

`npm run build` — **passes.**

`npm run viewport:audit` — **210 scene x viewport measurements across 7 viewports, 0 FAIL**,
identical to v0.9.5. This hotfix touches no layout CSS; the sweep is here to prove that.

`git diff --check` — clean.

## Final product invariants

- [x] **A club never plays itself** — 0 violations across 138,682 beats
- [x] **A youth/parent identity never plays its own parent identity** — `sameFootballIdentity`
      enforced at every selector, plus a fail-closed boundary
- [x] **A goalkeeper does not change shirt while he stays at the same club** — season removed from
      the hash; twelve-season stability asserted
- [x] **A goalkeeper never wears his club's own basic outfield colour** — 300 seeds per club, from
      the same colour source the outfield art uses

## Known limitations

- The `matchEngine` identity filters are unexercised by current world data — the academy, youth and
  senior leagues never share a table. They are correct and cheap, but the audit cannot prove they
  are load-bearing, and this report does not claim they were the bug.
- The academy/youth cup draws its final opponent from **senior** clubs, because the pool excludes
  academy and youth tiers. That is a separate data oddity, deliberately left alone: fixing it means
  changing which clubs a youth cup can contain, which is a balance decision and out of scope for a
  correctness hotfix. The identity rule makes it safe; it does not make it realistic.

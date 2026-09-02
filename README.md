# מכביסט — Maccabist

A browser-based Hebrew football **career simulation**. You start as a nine-year-old in
טרום ב׳ — the bottom rung of Maccabi Haifa's academy — and play out a whole career: climbing the
age groups, the youth-to-senior verdict, transfers, Europe, a homecoming, trophies and retirement.

The question the game asks is deliberately not *"how good a footballer did you become?"* but
**"how big a Maccabi Haifa legend did you become?"** — measured at retirement by the
**מדד אגדה** (Legend Score).

The design goal: *every career should tell a different story, and finishing one should make you
want to start another immediately.* A decision never maps to a fixed stat change — it opens a
distribution of outcomes weighted by who your player is right now.

Fully client-side: React + TypeScript + Vite, LocalStorage for saves. No backend, no auth, no
external services.

**Play:** https://dviruri.github.io/Maccabist/

**Current stable release: v0.9.6 — Release Candidate QA & Truth Pass.** The release that makes
the game safe to hand to someone. No football lies: a qualifying round the player was given is now
shown as one rather than silently skipped; Europe no longer reveals its own final table before a
match has been played; the matchday screen no longer invents a scoreline for a European tie whose
real aggregate is already stored; a player no longer scores in a season he never played; and no
club — or offer — is ever paired with itself. Cinematics survive a refresh instead of replaying
forever, nobody celebrates a defeat, and every touch target is thumb-sized. Verified by a
240-career invariant audit, a six-viewport browser sweep and ten consecutive suite runs
(`V096_REPORT.md`).

**v0.9.5 — Decisions & Career Flow.** v0.9.5 changes how a career
decision is made, and nothing about what it does. Every decision in the game — a transfer offer,
an event dilemma, the step out of the youth setup, the end of the career — now reads the same way:
what happened, then the futures as cards you press. The card IS the action, so there is no generic
Accept / Decline pair under a block of information anywhere. Each card carries its own
consequences, in facts the engine actually models: the offer's own direction and expected role,
the club's live European entry, the player's real standing. Where the engine has real
probabilities, the cards show them — grouped from `calculateOutcomeDistribution`, never
recalculated — and where it has none, they show none. Not one file under `src/game`, `src/data` or
`src/types` changed, and seed 5 reproduces the v0.8 baseline career exactly (`V095_REPORT.md`).

**v0.9.4 — Club Identity / Final One-Screen Pass.** v0.9.4 finishes the
illusion. The player's shirt is his club's: green at Maccabi Haifa, red at Hapoel, yellow at
Maccabi Tel Aviv, the parent club's colours for a youth side. Goalkeepers keep their
own palette (blue, pink, purple or black), chosen deterministically per season and contrasting
with the club. Every cinematic moment now features THAT player rather than a generic footballer
painted into a background, and the one-screen rule is finished for Europe and for every major
moment, across seven viewports from 320x568 up (`V094_REPORT.md`).
**v0.9.3 — One Screen Game Flow:** v0.9.3 makes the main career flow
behave like a game rather than a long web page: every primary screen — home, matchday, career
decision, major moment — fits one viewport at 320x568 through 430x932, matchday became a
four-state machine showing one state at a time, a decision owns the screen with no home content
under it, the career player is drawn on his own big moments, and each navigation button opens
exactly one destination. It also fixes a real presentation bug playtesting found: the scoreboard
could pair a number with the wrong club, because the pairing was left to RTL text direction
(`V093_REPORT.md`). **v0.9.2 — Compact Game UI:** v0.9.2 puts the domestic cup final at the
end of the season where it belongs, and tightens the presentation into a game: close upper-body
player heroes, a dominant scoreboard, one focused match moment at a time, and a denser career
home (`V092_REPORT.md`). **v0.9.1 — State Integrity:** v0.9.1 fixes continuity found in
playtesting (one authoritative match fixture shared by every screen, current vs next-season
European state kept apart, parent-club crest inheritance), makes matchday a dedicated
full-screen experience, and completes the deferred v0.9 items — signing and debut ceremonies,
bottom navigation, restyled poster and the 36-club European standings (`V091_REPORT.md`).
**v0.9.0 — Game Feel:** v0.9 rebuilds the presentation layer around a
cinematic career experience: a player hero home, a staged matchday reveal, full-screen career
decisions, a life-story journey timeline, an art trophy room, big-moment ceremonies and
European nights (`V09_REPORT.md`). **v0.8 — Europe:** v0.8 adds a real European club competition
ecosystem: domestic results earn UEFA qualification, a connected qualifying graph drops losers
down through Champions League → Europa League → Conference League, three 36-club league phases
feed seeded knockouts, and a European trophy exists only as the conclusion of that simulated
journey (`V08_REPORT.md`). v0.7 added the Collection / Meta / Visual Career layer
(`V07_REPORT.md`); v0.7.1 was release hygiene (`V071_REPORT.md`).

---

## Install & run

```bash
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (debug panel enabled) |
| `npm run build` | Type-check the app project + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Type-check the test project, then run Vitest |
| `npm run typecheck` | Type-check both projects |
| `npm run simulate` | 2,000 headless careers per strategy + balance report |
| `npm run simulate:large` | 20,000 careers per strategy (~100k careers) |

### TypeScript project layout

Production and test compilation are deliberately separate, so a test that is mid-migration or
uses a test-only helper can never block a deploy:

| File | Covers | Used by |
| --- | --- | --- |
| `tsconfig.json` | `src/`, `vite.config.ts` | `npm run build` |
| `tsconfig.test.json` | the above **plus** `tests/`, `scripts/` | `npm test` |

Both share the same strict settings — the test project only widens the file set.

---

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs on every push to `main`: checkout → Node 22 → `npm ci` →
`npm run build` → `upload-pages-artifact` (`./dist`) → `deploy-pages`. It fails loudly if the
production build fails, and deliberately does **not** run the long simulation suite.

The app is served from a sub-path, so asset resolution is configurable rather than hard-coded:

```bash
npm run build                    # base = /Maccabist/  (GitHub Pages default)
MACCABIST_BASE=/ npm run build   # base = /            (root deploy, custom domain)
```

`"/Maccabist/"` appears in exactly one place — `vite.config.ts`. Everything else derives from it:

- Components build asset URLs from `import.meta.env.BASE_URL` (see the `Logo` component). A bare
  `"/mark.png"` is **not** rewritten by Vite and will 404 on Pages.
- Files inside `public/` are copied verbatim and are never transformed, so `site.webmanifest`
  uses paths relative to itself (`icon-192.png`, `start_url: "."`).
- Paths written in `index.html` *are* rewritten by Vite, so plain `/favicon.ico` is fine there.

There is no router — the app is a single page driven by state — so a reload on Pages cannot hit a
404 and no SPA fallback is needed.

---

## Architecture

The single most important rule: **React displays the game, React is not the game.** Every rule
lives in `src/game/` as pure functions over a plain-data `Career`, so a career can be simulated
tens of thousands of times with no DOM involved.

```text
src/
  types/index.ts          Domain model. Career, events, offers, clubs, legend result.

  game/                   THE ENGINE — pure, no React, no DOM
    balance.ts            Every tunable number. Start here to rebalance.
    random.ts             Seeded RNG (mulberry32). The only source of randomness.
    rules.ts              Shared helpers: level context, role tier, minutes age curve.
    calendar.ts           Real dates: leap years, month lengths, date of birth.
    eligibility.ts        Who is old enough for professional football. One predicate.
    identity.ts           Club vs team unit vs stage. The one source of team wording.
    decisionEngine.ts     Outcome distributions. The preview and the resolver share one.
    eventValidation.ts    Developer-time rules that catch whole classes of content bug.
    bugReport.ts          A reproducible snapshot for playtest reports.
    conditions.ts         Generic condition matching for events and outcomes.
    worldEngine.ts        Season-level football world: club seasons, promotion, relegation.
    marketEngine.ts       The career ladder: what a player is worth, who wants him, as what.
    maccabiEngine.ts      Standing with Maccabi. Derived, never stored.
    careerEngine.ts       Public API + the phase state machine. React only calls this file.
    eventEngine.ts        Eligibility, anti-repetition weighting, choice resolution.
    outcomeEngine.ts      Weighted outcomes: base weights x modifiers = the real odds.
    seasonEngine.ts       Half-season simulator: appearances, goals, ratings, trophies.
    progressionEngine.ts  Effects, development, coach trust, role, academy promotion.
    transferEngine.ts     Offers, loans, the youth-to-senior verdict, homecoming.
    legendEngine.ts       מדד אגדה calculation.
    simulate.ts           Headless simulateCareer()/simulateBatch() + decision policies.

  data/                   CONTENT — plain data, no logic
    academy.ts            The 10-stage academy ladder. First-class domain data.
    clubs.ts              23 clubs: the Maccabi pathway, Israeli league, Europe.
    leagues.ts            11 leagues, with promotion/relegation links between divisions.
    events/               events across eight files (see "Adding an event").
    achievements.ts       Milestone definitions.
    trophies.ts           Trophy definitions and their Legend Score weights.
    endings.ts            Career archetypes shown on the retirement card.

  services/storage.ts     Persistence (swap LocalStorage for a backend here).
  state/useGame.ts        The single React hook wiring the engine to the UI.
  components/             Presentation pieces, including the dev-only DebugPanel.
  pages/                  Welcome / New career / Game / Retirement.
  ui/format.ts            Hebrew formatting, mood chips, season phase. UI only.
  styles/global.css       Design system: colours, cards, RTL-aware layout.

scripts/simulate.ts       The balancing CLI. Developer-only, never imported by the app.
```

### The world timeline and birth cohorts (v0.3.1)

The world has a **fixed** timeline. Every career starts in season **2030/31** with the **2021
birth cohort**; the player picks only a day and month of birth, and the year is locked.

```ts
dateOfBirth: { day: 17, month: 12, year: 2021 }   // plain numbers, never a timestamp
```

Stored as plain numbers on purpose: football-age maths has to be exact and
timezone-independent, and a UTC timestamp for 17 December can render as the 16th or the 18th
depending on the browser.

**Age is derived, never incremented** — from `(dateOfBirth, currentSeason, seasonPoint)`, with
three checkpoints a season (mid-August, mid-January, June). That is what lets a January-born
and a December-born player in the same cohort show different ages while belonging to exactly
the same age group.

> **The rule everything rests on: age never determines the academy stage.** An academy is
> organised by birth year.

```ts
naturalStage(career)   // the age group this player's cohort plays this season
career.academyStage    // the team he is actually registered with
```

| Season | Natural stage for the 2021 cohort |
| --- | --- |
| 2030/31 | טרום ב׳ |
| 2031/32 | טרום א׳ |
| 2032/33 | ילדים ג׳ |
| 2033/34 | ילדים ב׳ |
| 2034/35 | ילדים א׳ |
| 2035/36 | נערים ג׳ |
| 2036/37 | נערים ב׳ |
| 2037/38 | נערים א׳ |
| 2038/39 | נוער |

**A player cannot repeat his own age group.** `resolveAcademyProgression` floors next season's
stage at the cohort's next stage, so a player registered with his own year moves up every
season no matter how badly it went. The promotion roll only decides whether he goes up
*faster*. Verified over 20,000 simulated careers: **0 invalid repeats, 0 players registered
behind their cohort.**

The one case that *looks* like standing still is `cohort_caught_up`: a player pushed up early
keeps the same shirt while his own year arrives in that group. That is the opposite of being
held back, and the copy says so («השנתון שלך הגיע ל...», never «נשארת»).

A small, fading, **academy-only** relative-age effect gives players born January–March a
physical-maturity edge. It never touches potential — it is maturity, not talent — and is gone
by senior football.

### Origin: does Maccabi's door open? (v0.3.1)

Maccabist always begins with Maccabi, and never guarantees Maccabi.

| Origin | Share | What happens |
| --- | --- | --- |
| `scouted` | ~10% | A scout saw you and invited you straight in. Never reveals a number. |
| `trial_accepted` | ~68% | You went to the trials and got in. |
| `trial_rejected` | ~22% | You did not. You join another youth academy and the career continues. |

Being rejected is not game over — it is the question the version is built around:
*«אם הדלת של מכבי לא נפתחה — איך תגרום להם להתחרט?»* A rejected player who stands out where he
landed can be invited back (`eligibleForRetrial`), judged on what he has actually done rather
than one afternoon. Measured over 20,000 careers, of those rejected at nine: ~18% are invited
back, ~15% join Maccabi later, **~99% still reach senior football**, and ~14% play abroad.

The stage sets the age group but **the club sets the standard** — נערים ב׳ at a small northern
academy is not the same level as נערים ב׳ at Maccabi. Without that, a rejected boy could never
stand out where he landed, which is the whole premise of the road back.

### The academy ladder

The stage — not the age — is the player's identity for the whole youth career. It is real domain
data in `src/data/academy.ts`, never reduced to a generic "academy / youth / senior":

```text
טרום ב׳ → טרום א׳ → ילדים ג׳ → ילדים ב׳ → ילדים א׳
        → נערים ג׳ → נערים ב׳ → נערים א׳ → נוער → בוגרים
```

Age and stage are **separate fields**. Progression normally maps 9→טרום ב׳, 10→טרום א׳ … 17+→נוער,
but the stage is never inferred from age, which is what makes accelerated development, repeated
years and unusual career shapes possible.

Three different kinds of advancement are kept distinct:

| | What it means |
| --- | --- |
| **Normal promotion** | One step up the ladder, e.g. ילדים ב׳ → ילדים א׳ |
| **Playing/training up** | Officially still נערים ב׳, but `olderGroup` is `training`/`playing`. Faster development, fewer minutes, harder level. **Not** a promotion. |
| **Early promotion** | Skips a level entirely. Rare (~6–8% of careers) and deliberately exciting. |

### The season loop

```text
preseason → early event → first half → mid-season summary → mid event
          → second half → optional key moment → season summary
          → academy promotion / youth-to-senior verdict / transfer window
          → age +1 → next season … → retirement → Legend Score
```

Young stages skip the mid-season card to keep the pace up; how many decision points a season gets
comes from the stage config (`minEvents`/`maxEvents`), roughly 1 per season in טרום, 1–2 in
ילדים, 2 in נערים, 2–3 in נוער.

The `Career` object carries its own `phase`, `seasonSlot`, pending events/offers **and its RNG
state** (`seed` + `rngState`). A save resumes the exact same random stream, and a given seed plus
a given set of decisions always reproduces the same career.

---

## Career memory and story arcs (v0.3)

The point of v0.3 is that the game remembers. An event should feel like a chapter, not a card.

### Memory

Meaningful moments are recorded as `CareerMemory { kind, season, age, stage }` from a curated
`MemoryKind` vocabulary — `older_group_failure`, `penalty_miss`, `major_injury`,
`released_by_maccabi`, `derby_hero`, `refused_transfer` and so on. An outcome writes one with
`effects.remember`, and later events read it:

```ts
conditions: {
  requiresMemory: ['penalty_miss'],
  memoryMinSeasonsAgo: 1,   // a callback needs distance to land
  memoryMaxSeasonsAgo: 8,   // ...and stops being interesting eventually
}
```

Outcome weights can also key off memory and traits, not just numbers:

```ts
memoryModifiers: [{ memory: 'older_group_failure', multiplier: 0.7 }],
traitModifiers: [{ trait: 'big_game', multiplier: 1.6 }],
```

No gameplay code knows which event wrote a memory. That is the whole point.

### Story arcs

An arc is an id, a stage counter and a branch label. Events declare where they sit:

```ts
// the event that opens it
effects: { startArc: 'coach_relationship', arcBranch: 'conflict' }

// a later event in the same storyline
conditions: { requiresArc: { id: 'coach_relationship', minStage: 1, branches: ['conflict'] } }
effects:    { advanceArc: 'coach_relationship', arcBranch: 'frozen_out' }

// the resolution
effects: { completeArc: 'coach_relationship' }
```

There is **no event-id branching anywhere in the engine**. The five arcs:

| Arc | Shape |
| --- | --- |
| `older_group` | invited up → thrived / held own / struggled → follow-up → permanent promotion or back down |
| `coach_relationship` | criticism → how you answered → dropped → work back or ask out → a last chance → redemption |
| `injury_comeback` | rush the rehab or do it properly → the first duel back |
| `position_battle` | a rival arrives → raise your game, befriend him, or change position → who gets the shirt |
| `europe_move` | settling abroad → struggling → fight, loan, or go home |

### Traits

One or two hidden traits per career from a weighted pool of eight (`src/data/traits.ts`), with
conflicting pairs excluded. They bend real curves rather than sitting on a character sheet — a
late bloomer's growth curve shifts either side of 20, a hot head loses discipline, a big-game
player gains rating on the big stage.

Traits are **discovered, not shown**. `src/game/traitReveal.ts` reveals one when the career
demonstrates it, and anything still hidden is named at retirement:

> «המאמנים מתחילים להבין שאתה שחקן של משחקים גדולים.»

### Recovery

Coach trust used to be a one-way street: a bad spell cut minutes, which cut development, which
cut trust again. Four routes back, all in `RECOVERY`:

- trust drifts toward a baseline set by ability-for-level, partially each preseason and inside
  each half-season update — history still matters, but a good player is pulled back up;
- a strong run of form rebuilds it directly;
- the club changes coach ~16% of seasons, the main route back for a player buried behind one
  bad relationship;
- the accumulated one-season minutes penalty is floored, so a bad season is bad, not terminal.

Measured: 45% of senior careers hit a slump, and 49% of those are back to starter or better
within three seasons.

### Timeline and the closing story

`career.milestones` records only real story beats — automatic ones in `src/game/milestones.ts`
(first appearance, Maccabi debut, first title, moving abroad, coming home, 100/300 games) plus
any an event writes. `ציר הזמן` renders them. At retirement `src/game/storyEngine.ts` builds a
short narrative from what actually happened (structured templates, deterministic, no LLM) and
picks an archetype from the *shape* of the career rather than the Legend Score.

---

## Probabilistic outcomes

This is the core of the game. The model is:

```text
player decision + player state + career context + weighted randomness = outcome
```

Every choice declares several possible outcomes. Each has a `baseWeight`, optionally narrowed by
`conditions` (impossible unless they hold) and tuned by `modifiers` that multiply the weight when
an attribute crosses a threshold. `outcomeEngine.ts` turns that into the real distribution and
draws one — no probability logic ever lives inside an individual event.

Modifiers can read: `ability`, `potential`, `form`, `confidence`, `coachTrust`, `maccabism`,
`reputation`, `discipline`, `roleValue`, `age`, `injuryRisk`, and `abilityVsLevel` (how far ahead
of your age group you are). Events declare only what actually matters to them.

**The player never sees a percentage.** Choices carry a qualitative hint at most
(`בחירה בטוחה`, `סיכון גבוה`, `הזדמנות גדולה`). Exact weights are debug-mode only.

**Story first, numbers second.** The outcome screen leads with what happened, then shows the
stat movement underneath.

One engine-level rule worth knowing: a choice marked `risky` gets its *good* outcomes weighted up
by `EVENTS.riskyUpsideBoost`, leaving the downside as written. Measured across the whole pool,
risky choices were otherwise negative expected value — strictly dominated by playing safe, which
made bold play a trap rather than a gamble.

### Club and position context (v0.3.1)

Two classes of immersion bug that careful authoring does not prevent at scale, so they are
enforced by `tests/eventAudit.test.ts`:

**Club context.** `conditions.clubScope` declares which club situation an event belongs to:

| Scope | Fires when |
| --- | --- |
| `maccabi` | Only at Maccabi Haifa |
| `nonMaccabi` | Only somewhere else |
| `abroad` | Only outside Israel |
| `formerMaccabi` | Has a Maccabi past, currently elsewhere ("they are still watching you") |
| `currentClub` | Generic — the text must not name a club |
| `any` | Truly universal |

The audit fails the build if an event's text names Maccabi without a Maccabi-aware scope. It
deliberately does *not* demand a scope on all 108 events: an event with no club-specific text
reads correctly anywhere, so blanket annotation would be churn that cannot catch a bug.

**Position context.** An event must not describe *the player's own slot* by a position it is
not scoped to — `"החלוץ הפותח נפצע... אתה מתחיל"` must never reach a goalkeeper. The check is
phrase-based, not word-based: `קשר` also means "contact" and `מגן` also means "shield", and
naming the *opponent's* position (the striker you mark, the keeper you beat) is perfectly
correct.

### Three things that are not one thing (v0.4.1)

`identity.ts` keeps apart what the codebase used to collapse into a club id:

```
CLUB IDENTITY   which club he belongs to        maccabi_haifa
TEAM UNIT       which side of it he plays for   academy | youth | first_team
STAGE           where he is in development      youth_a | u19 | senior
```

A boy at Maccabi's academy and a Maccabi first-team player share a club and share nothing else.
Collapsing them produced the playtest bug where a promoted player was described as
"מכבי חיפה - מחלקת ילדים" for the rest of his career.

**The UI never assembles team wording.** It calls `currentTeamDisplay(career)` and renders the
result. Historical rows call `teamDisplayFor(clubId, stage)` with the values that were true then,
so a first-team player's נערים ב׳ season still reads נערים ב׳ — history, not staleness.

Everything is derived, never stored, so it cannot go stale and old saves get correct answers for
free. `hasCoherentIdentity` asserts the only two legitimate club/stage combinations.

### Decisions with visible odds (v0.4.1)

The player sees what can happen and how likely each result is before committing. The hard part is
not rendering percentages — it is guaranteeing the numbers shown are the numbers used.

```
calculateOutcomeDistribution(career, event, choice, slot)
            |                              |
      UI preview                   resolveEventChoice
```

One function, consumed by both. `resolveEventChoice` is *handed* the preview's distribution and
draws from that object, so there is no second formula to drift. **React computes no
probabilities.**

Two rules that make it hold rather than merely look like it holds:

- The distribution is computed on the career state the player is *looking at*, before the choice's
  own `effects` are applied. Otherwise a choice that costs coach trust silently moves the odds it
  was shown alongside.
- Integer percentages are computed once, in the engine, by largest remainder. If the UI rounded
  independently it could print 33/33/33 while the engine used something else.

The reveal animation is presentation only: the engine resolves from the seeded stream first and
the animation merely delays showing it. Turning it off changes nothing but the wait.

Adding odds to an event means nothing more than giving a choice more than one weighted outcome. A
single-outcome choice simply shows no odds, so old content keeps working untouched.

### Validating content (v0.4.1)

`eventValidation.ts` runs in the test suite and catches whole classes of content bug: a Maccabi
event with no declared Maccabi relationship, a professional gate reaching childhood, an outcome
list that cannot produce a result, a club-strength window no club in the game satisfies,
contradictory conditions, duplicate ids.

Every rule corresponds to a bug that actually shipped. When you add a class of mistake, add a rule.

### The football world (v0.4)

The world is simulated at **season** level: no fixtures, no tables, no squads. A club's season
costs a handful of RNG calls, and the shape it produces is right.

`clubStrengthVsLeague` is the idea everything hangs off — a club's quality relative to *its own
division*, not in the abstract. It is what makes promotion and relegation matter, because the
same club is a title contender in the second division and a relegation candidate in the first.
It is also what in-season events read: the final table is only resolved at season end, but
everyone at a club knows in August whether they are expected to go up, stay up, or fight.

```ts
conditions: { clubLeagueTier: [2], minClubStrength: 0.15 }   // a promotion favourite
conditions: { maxClubStrength: -0.5 }                        // a club out of its depth
```

A division's `quality` must be the level its clubs actually play at. הליגה הלאומית shipped at 42
while both its clubs rate 40 and 36, which meant nobody in it was ever a promotion contender and
the promotion-race events were unreachable. `tests/world.test.ts` now asserts that every world
event's strength window matches at least one real club.

### Standing with Maccabi (v0.4)

`maccabiEngine.ts` answers a different question from מכביסטיות, and keeping them apart is the
whole point:

- **מכביסטיות** is what the player *feels* about the club. It is his, and he spends it.
- **Standing** is what the club and the stand *remember*. He can only earn it.

They come apart constantly, and that gap is most of the drama. A boy released at fifteen can stay
a Maccabist his whole life and still be a stranger at Sami Ofer; a captain who walks out for a
rival keeps every appearance he ever made and is booed anyway.

Standing is **derived, never stored** — computed from the Maccabi record and the season trail —
so it cannot drift out of sync with what happened, and saves written before it existed get a
correct value for free. Seven bands from `stranger` to `son_of_the_club`, plus `traitor`, which
overrides service entirely: joining a domestic rival straight from Maccabi is not something a
crowd nets off against 200 appearances.

Events key off it directly, which is how one fixture serves a returning hero and a booed
defector without either reading wrong:

```ts
conditions: { clubScope: 'formerMaccabi', canFaceMaccabi: true, crowdResponse: ['hostile'] }
```

This is also the mechanism behind the product invariant — **the player may leave Maccabi, Maccabi
never leaves the player's story**. It is honoured through *context*, never by handing a Hapoel
Afula player Maccabi dressing-room events.

### Anti-repetition

Repetition is handled in selection, not by adding more cards:

- Events support `oncePerCareer`, `oncePerStage` and `cooldownSeasons`.
- A just-seen event is suppressed hard (`repeatPenalty`) and recovers gradually over
  `repeatRecoverySeasons` — a story from ten seasons ago should not be as suppressed as last
  season's.
- A category already used **this season** is penalised heavily; one used in the **last couple of
  seasons** is penalised mildly, so careers do not run coach → coach → coach.
- `injury` and `discipline` are blocked from landing in consecutive seasons.
- Rare events are throttled hard by `rarityWeight` so they stay rare.

---

## Adding an event

Append an object to one of the arrays in `src/data/events/`:

| File | Contents |
| --- | --- |
| `academyEvents.ts` | The youth journey, טרום through נוער |
| `positionEvents.ts` | Position-specific storylines (gated by `conditions.positions`) |
| `spontaneousEvents.ts` | Things that happen *to* you, plus the rare breakthroughs/setbacks |
| `seniorEvents.ts` | The professional career |

Nothing in the engine changes — it reads conditions and weights generically.

```ts
{
  id: 'unique_id',
  kicker: 'מגרשי האימונים, יום שלישי',   // optional flavour line above the title
  title: 'כותרת האירוע',
  description: 'הסיפור עצמו, בעברית של כדורגל.',
  category: 'opportunity',               // drives anti-repetition variety
  rarity: 'uncommon',                    // common (default) | uncommon | rare
  conditions: {                          // when may this appear at all?
    bands: ['teens'],                    // children | teens | u19 | senior
    stages: ['youth_b'],                 // or exact academy stages
    positions: ['ST'],                   // position gating lives here, not in the engine
    olderGroup: ['none'],
    minCoachTrust: 40,
    atMaccabi: true,
  },
  weight: 9,                             // relative frequency inside the eligible pool
  slots: ['early', 'mid'],               // which part of the season (default: any)
  oncePerStage: true,
  cooldownSeasons: 2,
  choices: [
    {
      id: 'go_for_it',
      label: 'מה שכתוב על הכפתור',
      hint: 'רמז קצר על ה-trade-off',
      risk: 'opportunity',               // safe | balanced | risky | opportunity
      effects: { confidence: 1 },        // applied on every outcome of this choice
      outcomes: [ /* see below */ ],
    },
    { id: 'stay_put', label: '...', risk: 'safe', outcomes: [ /* ... */ ] },
  ],
}
```

### Adding an outcome

Outcomes belong to a choice. Exactly one is drawn, weighted:

```ts
{
  id: 'impressed',
  baseWeight: 30,                        // relative to the other outcomes of this choice
  tone: 'good',                          // good | bad | neutral
  conditions: { minAbility: 55 },        // optional: impossible unless these hold
  modifiers: [                           // optional: multiply the weight in context
    { attribute: 'coachTrust', above: 65, multiplier: 1.4 },
    { attribute: 'confidence', below: 40, multiplier: 0.6 },
  ],
  text: 'נכנסת לאימון קצת לחוץ, אבל אחרי כמה דקות השתחררת...',
  effects: { ability: 2.5, coachTrust: 7, olderGroup: 'training' },
}
```

Effect keys: `ability`, `potential`, `maccabism`, `reputation`, `coachTrust`, `roleValue`,
`confidence`, `form`, `discipline`, `injuryRisk`, `pressure`, `injuryChance`, `transferChance`,
`minutesModifier`, `olderGroup`, `promotionBoost`, `flags`, `clearFlags`, `achievement`,
`transferTo`, `captain`.

**Design rules.** Every choice needs a real trade-off — if one button is always correct, the
event is not finished. Every outcome must tell a story, not report a number. And the same choice
must not produce the same result in every career.

---

## Rebalancing

Almost everything numeric is in **`src/game/balance.ts`**:

| Constant | Controls |
| --- | --- |
| `START` | Starting ability, potential range, wonderkid chance, starting maccabism |
| `PROGRESSION` | Growth per age band, potential pull, and the overshoot rule |
| `COACH_TRUST` | How trust moves, and how strongly it buys minutes and role |
| `SEASON` | Minutes model, injuries, ratings, reputation, maccabism drift, playing up |
| `PROMOTION` | Academy promotion score weights and the normal/early thresholds |
| `YOUTH_TO_SENIOR` | Readiness weights and the four path thresholds |
| `EVENTS` | Repetition penalties, rarity throttle, risky upside boost |
| `TRANSFERS` | Offer frequency, loans, homecoming odds |
| `LEGEND` | Legend Score weights, targets and penalties |
| `POSITIONS` | Per-position output rates and Legend Score factors |
| `ROLE_TIERS` | Where each team-role label starts |

Endings live in `src/data/endings.ts`, trophy weights in `src/data/trophies.ts`.

**Potential is a soft ceiling, not a wall.** A player having an exceptional season with high
confidence can grow past it, up to `PROGRESSION.overshoot.maxAbove`. High-potential players
regularly fail; medium-potential players sometimes have excellent careers.

### Checking a change

```bash
npm run simulate                              # all five strategies, 2,000 careers each
npm run simulate -- --careers=5000 --policy=balanced
npm run simulate:large                        # 20,000 each
```

The report covers: reaching (or not reaching) the Maccabi senior team, academy graduation,
release, early promotion, playing up, starter/key-player/captain, Europe, homecoming, peak
ability, Legend Score distribution by bucket, the academy ladder, repetition metrics, results by
position, the most common endings, and a luck-validation check.

Five decision policies model different players — `balanced`, `loyalist`, `ambitious`,
`riskTaker` and `random` — because measuring the game by always pressing the first button tells
you very little. `riskTaker` is an intentional extreme baseline, not a model of a real player.

**Matched-seed comparison** (v0.3) answers the question the balance work exists for: do
decisions matter, or is it just the seed? Every strategy plays the *same* seeds, so any
difference between them is decision quality:

```
strategy        mean  median     sd   peak  seniors  beats base  vs base
balanced        41.4    30.0   25.5   78.5    58.7%       85.4%     21.2
loyalist        43.5    28.0   28.3   78.3    56.7%       84.3%     23.1
ambitious       34.2    25.0   22.0   78.1    54.3%       78.0%     13.8
riskTaker       10.2     6.0   12.9   68.1    23.7%       19.9%    -10.2
```

`beats base` is measured seed-by-seed against the `random` baseline, so 50% would mean
decisions are irrelevant. Decision-driven spread on a fixed seed (~46) is more than twice the
seed-driven spread for a fixed strategy (~20).

**Luck validation** is part of every run and asserts the two properties the design rests on:
the same seed reproduces a career exactly, and the same decisions on different seeds diverge.

---

## How the Legend Score works

`src/game/legendEngine.ts`. Nine weighted components, each on a diminishing-returns curve
(`(value / target) ** 0.85`), summing to 100:

| Component | Max | Full marks at |
| --- | --- | --- |
| הופעות במכבי (senior appearances) | 20 | 430 appearances |
| תרומה התקפית (position-adjusted goals + assists) | 12 | 190 output points |
| עונות בירוק (seasons with ≥8 appearances) | 11 | 15 seasons |
| תארים עם מכבי (weighted trophies) | 19 | 11 trophy points |
| קפטן | 8 | 7 captain seasons |
| בוגר האקדמיה | 5 | promoted from the youth team |
| מכביסטיות | 13 | 100/100 |
| החזרה הביתה | 6 | returned + 5 seasons after |
| קריירה באירופה | 6 | a big continental career |

Then `+2` per loyalty moment (capped `+6`), `−3.5` per forced-move moment (capped `−14`), and a
hard cap of 34 for a player who never made a senior Maccabi appearance. Clamped to 0–100 and
mapped to one of ten career archetypes.

The key property — enforced by a test — is that **a long-serving Maccabi captain outscores a
world-class player who only passed through**. Europe contributes but can never dominate.

**Leaving is not automatically betrayal.** The penalty is contextual: leaving very young for
money hurts, leaving as an established first-teamer for a real European opportunity barely does,
and moving to a direct domestic rival hurts a lot. Coming home is worth real points — more so
while still good enough to play. The ideal Maccabist career genuinely can be
*academy → star → Europe → return → captain → legend*, so staying forever is not the
mathematically optimal answer.

---

## Debug mode

In `npm run dev` a `⚙ debug` button appears bottom-left: seed, phase and season slot, academy
stage and seasons at stage, older-group status, ability, **potential**, coach trust, role value,
form, confidence, discipline, injury risk, plus the current event's choices with their **raw
outcome probabilities**. Actions include stepping the loop, advancing a season, ageing, forcing
retirement and overriding attributes.

A console API is exposed on `window.maccabist` in dev.

Both are stripped from production builds (`import.meta.env.DEV`), and no simulation ever runs in
a player's browser during normal play.

Careers can be started from a fixed seed, which makes bug reports reproducible — "it happens on
seed 17384920" is enough to recreate the exact career.

---

## Tests

```bash
npm test
```

387 tests over the pure engine, in fifteen files:

| File | Covers |
| --- | --- |
| `academy.test.ts` | The ladder order and labels, normal/early/repeated promotion, the fast-track cap, the pecking-order reset, coach trust driving promotion |
| `cohort.test.ts` | Birth cohorts, real dates of birth, natural vs current stage, the road back to Maccabi, whole-career cohort invariants |
| `eligibility.test.ts` | Professional-football gating (no contracts for children), the exceptional-youth exception, the youth exit leaving nobody stranded |
| `outcomes.test.ts` | Weighted outcomes, modifiers, seed reproducibility and divergence, the risky-upside rule, event data integrity, eligibility, cooldowns, `oncePerCareer`, category anti-repetition, rarity throttling |
| `engine.test.ts` | Effects, club moves, half-season simulation, development and the potential ceiling, the four youth-to-senior paths, the released-player route end to end, transfers and homecoming, Legend Score, the season state machine, retirement |
| `memory.test.ts` | Career memory, story arcs, traits, senior phases |
| `eventAudit.test.ts` | Every event naming Maccabi declares a `clubScope`; position phrasing matches the player's position |
| `world.test.ts` | Promotion/relegation, loan parent club and expiry, expected roles, position need, draw determinism, and that every world event's club-strength window matches a real club |
| `maccabi.test.ts` | Service and grievance, the relationship bands, the rival override, the ex-Maccabi event family, homecoming archetypes and the traitor gate |
| `identity.test.ts` | Club vs team unit vs stage, display wording, and a coherence sweep over whole careers |
| `decision.test.ts` | The probability invariant (preview == resolver), 100% rounding, determinism, frequency validation, bug reports |
| `longevity.test.ts` | Retirement windows, career-length distributions, and the goalkeeper root causes |
| `risk.test.ts` | Choice-level expected value, bold vs reckless, variance and collapse rates |
| `scenarios.test.ts` | The lettered end-to-end scenarios: academy to senior, prodigy promotion, goalkeeper longevity, bold success and collapse, move direction, ambient Maccabi, facing them, relegated homecoming |
| `simulation.test.ts` | Full headless careers to retirement, determinism, and batch-level sanity bounds |

---

## Design notes

- **Hebrew + RTL from the ground up.** Logical CSS properties everywhere; bars fill
  right-to-left; deltas render as `68 ← 72`; years and scorelines sit in a bidi-isolated span.
- **Mobile first.** Single column up to 960px, two columns above. Chunky touch targets.
- **Form and confidence stay hidden numbers** and surface only as a phrase
  (`כושר מצוין`, `תקופה קשה`, `ביטחון שבור`) — two more progress bars would say less.
- **Celebrations are rationed.** Only major milestones interrupt with a full-screen moment.

## Brand assets

The crest in `public/` is the supplied artwork, processed into the sizes the app needs:
`logo.png` (welcome hero), `mark.png` (top bar monogram), `favicon.*` (tight monogram crop, still
legible at 16px), `icon-192/512.png` (manifest), `apple-touch-icon.png` (dark tile baked in,
since iOS drops alpha). To swap the artwork, replace the files — only the `Logo` component
references them.

---

## Known limitations

- **Repeated events over a long career.** A career sees ~44 events across ~28 seasons while the
  pool is 74, so roughly 10 events recur. Selection improvements have taken this about as far as
  they can; the fix is more senior-phase content, which is the tightest pool.
- **Unmitigated risk-taking is punished hard.** Coach trust feeds minutes, which feed
  development, which feed trust, so repeated trust damage compounds into a spiral that is
  difficult to recover from. The `riskTaker` policy shows the tail clearly.
- **Careers run long.** ~28 seasons, leaving the academy at ~19.6 on average — a little later
  than the intended 18–19.
- **Mobile layout is CSS-audited, not browser-verified** at 360/390/412px.
- **The second division has only two clubs**, so promotion races there are reachable but thin.
  A data gap rather than a logic one.
- **Careers accumulate a lot of football.** Retirement ages are believable since v0.4.1 (outfield
  mean 34.4, goalkeepers 37.2), but total appearances still run high. The Maccabi relationship
  weights were calibrated against that inflated distribution and will need revisiting when it is
  fixed.
- **`rng.gaussian` is hard-bounded** to +/- its spread, with no tails. Club seasons use
  `rng.normal` since v0.4.1 for exactly that reason - a dominant club could not be relegated at
  all - but season ratings still use `gaussian`, so a rating outlier is impossible.
- **Bold play cannot win on Legend Score**, because the score is deliberately Maccabi-weighted and
  bold careers go to Europe. Its upside is real and measured in football rather than in Maccabi
  service; whether that needs a second axis is a product decision.

## Not in this version

No auth, no backend, no Base44 integration, no leaderboards, no monetisation, no match-level
simulation. The domestic football world is simulated at **season** level: clubs have seasons,
divisions and promotion/relegation, without per-match fixtures or squads; European competitions
(v0.8) are simulated at **tie and league-phase** level, still without individual match detail
beyond scores. `src/services/storage.ts` is a small interface specifically so it can
be swapped for a real service later.

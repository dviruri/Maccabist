# מכביסט — Maccabist

A browser-based Hebrew football **career simulation**. You start as a nine-year-old in Maccabi
Haifa's youth academy and play out an entire career — seasons, decisions, transfers, Europe,
homecomings, trophies and retirement.

The question the game asks is deliberately not *"how good a footballer did you become?"* but
**"how big a Maccabi Haifa legend did you become?"** — measured at retirement by the
**מדד אגדה** (Legend Score).

Fully client-side: React + TypeScript + Vite, LocalStorage for saves, no backend, no auth,
no external services.

---

## Install & run

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (debug panel enabled) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the engine test suite (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |

---

## Architecture

The single most important rule in this codebase: **React displays the game, React is not the
game.** Every rule lives in `src/game/` as pure functions over a plain-data `Career` object, so a
career can be simulated thousands of times with no DOM involved.

```text
src/
  types/index.ts          Domain model. Career, events, offers, clubs, legend result.

  game/                   THE ENGINE — pure, no React, no DOM
    balance.ts            Every tunable number in the game. Start here to rebalance.
    random.ts             Seeded RNG (mulberry32) + clamp/round. The only randomness source.
    rules.ts              Small shared helpers (stage, status tier, minutes age curve).
    careerEngine.ts       Public API + the phase state machine. React only calls this file.
    eventEngine.ts        Event eligibility, weighted selection, choice resolution.
    seasonEngine.ts       Season simulator: appearances, goals, assists, clean sheets, trophies.
    progressionEngine.ts  Effects, growth, status/reputation/maccabism movement, club moves.
    transferEngine.ts     Offers, loans, promotions, releases, the homecoming mechanic.
    legendEngine.ts       מדד אגדה calculation.
    simulate.ts           Headless simulateCareer() / simulateBatch() for balancing.

  data/                   CONTENT — plain data, no logic
    clubs.ts              23 clubs: Maccabi pathway, Israeli league, European destinations.
    events.ts             38 story events with conditions, weights and choices.
    achievements.ts       Milestone definitions.
    trophies.ts           Trophy definitions and their Legend Score weights.
    endings.ts            Career archetypes shown on the retirement card.

  services/storage.ts     Persistence abstraction (swap LocalStorage for a backend here).
  state/useGame.ts        The single React hook wiring the engine to the UI.
  components/             Reusable presentation pieces.
  pages/                  Welcome / New career / Game / Retirement.
  ui/format.ts            Hebrew formatting, timeline grouping. UI only.
  styles/global.css       Design system: colours, cards, RTL-aware layout, animations.
```

### The season loop

```text
preseason → event(s) → decision → outcome → simulate season → season card
          → transfer/loan/contract decision (only when there is one)
          → age +1 → next season … → retirement decision → retirement card
```

The `Career` object carries its own `phase`, `pendingEventIds`, `pendingOffers` **and its RNG
state** (`seed` + `rngState`). That means a save file resumes the exact same random stream, and a
given seed plus a given set of decisions always reproduces the same career.

---

## Where things live

### Adding an event

Append an object to the array in `src/data/events.ts`. Nothing else changes — the engine reads
conditions and weights generically.

```ts
{
  id: 'unique_id',
  kicker: 'חדר הלבשה, ינואר',          // optional flavour line above the title
  title: 'כותרת האירוע',
  description: 'הסיפור עצמו, בעברית של כדורגל.',
  conditions: {                          // when may this appear?
    stages: ['prime'],                   // kids | youth | breakthrough_youth | breakthrough | prime | veteran
    atMaccabiSenior: true,
    minStatusValue: 55,
    once: true,                          // never twice in one career
  },
  weight: 8,                             // relative frequency inside the eligible pool
  choices: [
    {
      id: 'choice_a',
      label: 'מה שכתוב על הכפתור',
      hint: 'רמז קצר על ה-trade-off',
      effects: { maccabism: 4 },         // applied for every outcome of this choice
      outcomes: [                        // exactly one is drawn, weighted
        { weight: 60, tone: 'good', text: 'מה שקרה', effects: { ability: 2, statusValue: 5 } },
        { weight: 40, tone: 'bad',  text: 'מה שקרה', effects: { confidence: -6 } },
      ],
    },
    { id: 'choice_b', label: '...', outcomes: [ /* ... */ ] },
  ],
}
```

Available effect keys: `ability`, `potential`, `maccabism`, `reputation`, `statusValue`,
`confidence`, `form`, `discipline`, `injuryRisk`, `pressure`, `injuryChance`, `transferChance`,
`minutesModifier`, `captain`, `transferTo`, `achievement`, `flags`.

**Design rule:** every choice must have a real trade-off. If one button is always correct,
the event is not finished.

### Adding a club

Append to the array in `src/data/clubs.ts`:

```ts
{
  id: 'club_id',
  name: 'שם המועדון',
  country: 'ספרד',
  league: 'לה ליגה',
  quality: 74,        // squad strength — how hard it is to get minutes
  prestige: 70,       // how much international recognition playing here brings
  development: 68,    // how well the club develops players
  tier: 'euro_mid',   // israeli_top | israeli_mid | israeli_low | euro_dev | euro_mid | euro_top
  titleChance: 0.01,
  cupChance: 0.06,
  europeChance: 0.08,
  isSenior: true,
  seasonGames: 42,
}
```

The transfer engine picks destinations by weighted eligibility (`interestWeight`), so new clubs
are automatically part of the market with no engine change.

### Rebalancing

Almost everything numeric is in **`src/game/balance.ts`**:

| Constant | Controls |
| --- | --- |
| `START` | Starting ability, potential range, wonderkid chance, starting maccabism |
| `PROGRESSION` | Growth per age band, potential pull, how much minutes/club/rating matter |
| `SEASON` | Minutes model, injuries, ratings, reputation gain, maccabism drift, status movement |
| `TRANSFERS` | Offer frequency, loan rules, homecoming odds, release thresholds |
| `LEGEND` | Legend Score weights, targets and penalties |
| `POSITIONS` | Per-position goal/assist/clean-sheet rates and Legend Score output factors |
| `STATUS_TIERS` | Where each status label starts |
| `RETIREMENT_MIN_AGE` / `RETIREMENT_FORCED_AGE` | When retirement becomes possible / certain |

Endings live in `src/data/endings.ts`, trophy weights in `src/data/trophies.ts`.

To check the effect of a change:

```ts
import { simulateBatch } from './src/game/simulate';
simulateBatch(500, { playerName: 'sim', position: 'CM' });
// → { averageLegendScore, averageMaccabiAppearances, averagePeakAbility, endings }
```

In the dev build the same thing is available from the browser console via
`window.maccabist.simulate(500)`.

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

Then: `+2` per loyalty moment (capped at `+6`), `−3.5` per forced-move moment (capped at `−14`),
and a hard cap of 34 for a player who never made a senior Maccabi appearance. Result is clamped
to 0–100 and mapped to one of ten career archetypes.

The key property — enforced by a test — is that **a long-serving Maccabi captain outscores a
world-class player who only passed through**. European success contributes but can never dominate.

---

## Design notes

- **Hebrew + RTL from the ground up.** Logical CSS properties (`inset-inline`, `padding-inline`,
  `border-inline-start`) everywhere; progress bars fill right-to-left; the desktop sidebar sits on
  the right; deltas render as `68 ← 72` so they read correctly right-to-left; years and scorelines
  are wrapped in a bidi-isolated `.ltr` span.
- **Mobile first.** Single column up to 960px, two columns above it. Chunky 54px touch targets.
- **Palette.** Vivid Maccabi green on near-black, white for the big numbers, gold reserved for
  trophies and the captain's armband.
- **Celebrations are rationed.** Only achievements flagged `major` interrupt with a full-screen
  moment; everything else just lands in the list.

## Brand assets

The crest in `public/` is the supplied artwork, processed once into the sizes the app needs:

| File | Used for |
| --- | --- |
| `logo.png` | Welcome hero and the retirement share card (720px, transparent) |
| `mark.png` | The monogram in the in-game top bar |
| `favicon.ico`, `favicon-16/32/48.png` | Browser tab — a tight crop on the M monogram, which stays legible at 16px |
| `icon-192.png`, `icon-512.png` | PWA / manifest icons (full crest) |
| `apple-touch-icon.png` | iOS home screen — dark tile baked in, since iOS drops alpha |
| `site.webmanifest` | Name, RTL, theme colours for add-to-home-screen |

The light backdrop was removed with a connected flood fill seeded from the image border, so the
white outlines *inside* the crest survive while the backdrop and its drop shadow do not. Files are
palette-quantised, which is visually lossless here and cuts the logo from 625 KB to 209 KB.

To swap the artwork, replace the files in `public/` — nothing in the code references the image
beyond the `Logo` component in `src/components/primitives.tsx`.

## Development tools

In `npm run dev` a `⚙ debug` button appears bottom-left with live attribute inspection
(including hidden attributes), plus actions: step, advance a season, age +1, bump
ability/status/maccabism/reputation, force retirement.

The console API `window.maccabist` exposes `career`, `set()`, `autoStep()`, `run(seasons)`,
`retire()`, `simulate(count)` and `events`. Both are stripped from production builds.

## Tests

```bash
npm test
```

38 tests over the pure game logic: career creation and determinism, effect application and
clamping, club-move bookkeeping, event eligibility, season statistics by position, transfer and
promotion eligibility, Legend Score properties, and full headless careers run to retirement
(including a check that a loyal strategy scores higher on average than a random one).

## Not in this MVP

No auth, no backend, no Base44 integration, no leaderboards, no monetisation, no match-level
simulation. The persistence layer (`src/services/storage.ts`) is a small interface specifically so
it can be swapped for a repository backed by a real service later.

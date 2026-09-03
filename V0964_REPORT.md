# Maccabist v0.9.6.4 — Anonymous Product Analytics

One purpose: trustworthy anonymous product analytics for the friend beta. No gameplay change.

## Baseline

| | |
|---|---|
| Starting commit | `c301f28` |
| Ending commit | `e951115` (code and docs; this report follows it) |
| Starting version | 0.9.6.3 |
| Ending version | **0.9.6.4** |
| Starting tests | 1351 passing, 79 files |
| Ending tests | **1386 passing, 80 files** |

| Hash | Change |
|---|---|
| `449c4e2` | analytics implementation and tests |
| `e951115` | `ANALYTICS.md`, version and README |

## Analytics architecture

| | |
|---|---|
| GA4 Measurement ID | `G-4KJEM0LPCF` |
| Core module | `src/analytics/analytics.ts` — consent, gtag, dedupe, the single `emit` |
| Typed events | `src/analytics/events.ts` — whitelisted payloads, transition observer |
| Version source | `src/analytics/version.ts`, injected from `package.json` by both vite configs |
| Consent UI | `src/components/AnalyticsConsent.tsx` |
| Wiring | `src/state/useGame.ts` — two action calls, one observer effect |
| Tests | `tests/analytics.test.ts` — 35 tests |

**Consent.** Stored in `localStorage` under `maccabist.analytics.consent` (`granted`/`denied`).
The game had no settings surface, so this is a one-time bottom bar rather than a new preferences
system. Nothing is sent before an answer; either answer dismisses it permanently; declining leaves
the game identical and the Google tag is never loaded.

**Environment exclusions.** Analytics is a no-op under `import.meta.env.DEV`, mode `test`, Vitest,
hostname `localhost`/`127.0.0.1`/`::1`/empty, and any of `?gallery=1`, `?probe=1`, `?contrast=1`,
`?touch=1`, `?crop=1` — exactly the flags the dev gallery and the four browser audits use. The
Google tag is loaded lazily by the module after consent rather than from a `<script>` in
`index.html`, so in every excluded case the network request is never made at all.
`?analyticsDebug=1` forces it on for GA4 DebugView verification.

**Dedupe.** Semantic and persistent, in `localStorage` under `maccabist.analytics.sent` (capped at
400 keys, oldest dropped). Keyed on the career's **existing** non-PII `id`
(`career_<seed>_<createdAt>`), so no field was added to `Career` and the save schema is untouched.
`career_resumed` additionally keys on a `sessionStorage` tab id so a resume counts once per session.

## Events

Seven, each with `game_version` attached at the single exit point.

| Event | Fires | Dedupe key |
|---|---|---|
| `career_started` | a brand-new career is created and committed | `career_started:<id>` |
| `career_resumed` | an existing save is actively resumed | `career_resumed:<id>:<session>` |
| `season_completed` | a season record is appended to history | `season_completed:<id>:<season>` |
| `senior_debut` | first genuine senior appearance | `senior_debut:<id>` |
| `transfer_completed` | the club actually changes | `transfer_completed:<id>:<season>:<from>:<to>` |
| `europe_reached` | a European campaign becomes visible this season | `europe_reached:<id>:<season>` |
| `career_completed` | retirement is committed | `career_completed:<id>` |

> **`career_started` Event count is the authoritative number of newly-created careers tracked
> after v0.9.6.4 went live.**

> **Corrected in v0.9.6.5.** Three statements above did not hold as written. (1) The count is of
> newly-created careers among players who **granted consent** — and in v0.9.6.4 a career started
> before the non-blocking consent bar was answered was lost even if the player then granted.
> v0.9.6.5 holds it locally and sends it on grant. (2) `senior_debut` used the cumulative
> `career.stats.appearances`, which includes academy football, so it fired on entry to the senior
> stage rather than on a first senior appearance — in 30 of 30 simulated careers. It now reads the
> engine's own `senior_debut` milestone. (3) `?analyticsDebug=1` bypassed the environment block but
> did not set GA4 `debug_mode`, so it did not reach DebugView. See `V0965_REPORT.md`.

Full parameter lists, firing conditions and the GA4 instructions are in **`ANALYTICS.md`**.

Two design points worth recording:

- **`europe_reached` uses `visibleEuropeanCampaign`**, the chronology-aware authority from
  v0.9.6.1, so analytics inherits the no-future-leak rule and cannot report a competition the
  player has not been shown. A test asserts the analytics source never reads `finalCompetition`,
  `reachedLeaguePhase`, `wonCompetition` or `furthest`.
- **`transfer_completed.move_type` has three values**, not two: `permanent`, `loan`, `loan_return`.
  A loan return is also a club change, and calling it permanent would report a transfer that never
  happened.

## Privacy

Confirmed, and enforced structurally rather than by convention:

- **No player-entered name.** `playerName` is never read anywhere in `src/analytics/`.
- **No email, phone or contact detail.** None exists in the game to send.
- **No raw save or `Career` payload.** There is no object spread in the events file; every payload
  is written out field by field.
- **No free-text user data** — no event prose, no decision prose, no feed lines.

`tests/analytics.test.ts` sends a career with a distinctive name through all seven events and
asserts it appears in none of them, that no parameter key is `playerName`, and that every value is
a string, number or boolean. Source-level guards assert the module never spreads a career.

## Existing saves

**A career created before v0.9.6.4 can never produce a `career_started` event.**

This is structural, not a filter. `trackCareerStarted` has exactly one caller —
`useGame.startCareer` — which is also the only place in the app that calls `createCareer`. Loading,
hydrating and resuming do not pass through it. Asserted both behaviourally and on the source, so a
future refactor cannot quietly widen it.

Older saves otherwise behave normally: resuming one emits `career_resumed`, and continuing to play
emits progression events for what genuinely happens next. They are not backfilled — the observer
treats the first career state of a session as a baseline rather than a transition, so a loaded save
does not re-report a debut it made eight seasons ago. The one exception is documented:
`europe_reached` is state-based, so a career already mid-campaign reports it once.

## Determinism

**The seed regression baseline did not change.** Identical to v0.9.6 through v0.9.6.3:

```
european seasons 11    europe history 26    last journey uefa_europa_league/league_phase/12
uefa trophies 0        domestic cups 4      championships 4
ability 82 (peak 86)   legend 77            retired 35 after 17 senior seasons
appearances 702        goals 450            assists 120
```

Analytics never touches the simulation: no `Career` is mutated, no game RNG is consumed, ids come
from `crypto.randomUUID()`. A test simulates the same seed twice — once reporting every transition
— and asserts the resulting careers are identical.

## QA

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | 80 files, **1386 tests**, exit 0 |
| `npm run build` | passes |
| `npm run regress` | unchanged |
| `npm run rc:audit -- 240` | 0 violations |
| `npm run fixture:audit -- 800` | 0 self-opponent violations |
| `npm run viewport:audit` | ALL CLEAR |
| `npm run touch:audit` | 0 undersized targets |
| `npm run contrast:audit` | 0 unaccepted failing text nodes |
| `npm run crop:audit` | NO CROP JUMP — 120 art elements |

### Three consecutive `npm test`

| Run | Result |
|---|---|
| 1/3 | exit 0 — 80 files, **1386 tests**, 0 TypeScript errors, 0 skipped (605s) |
| 2/3 | exit 0 — 80 files, **1386 tests**, 0 TypeScript errors, 0 skipped (582s) |
| 3/3 | exit 0 — 80 files, **1386 tests**, 0 TypeScript errors, 0 skipped (636s) |

Identical counts, no flaky rerun, TypeScript test compilation included every time, and no test
skipped or marked todo — each run's output was scanned for both.

One failure occurred during development and was fixed rather than re-run: an analytics test passed
alone and failed inside the full suite. `career.id` embeds `Date.now()`, and the `senior_debut`
fixture built its "before" and "after" states from two separate `createCareer` calls, whose ids
diverge when the calls straddle a millisecond — which the observer correctly treats as a career
switch rather than a transition. The fixture was wrong, not the guard.

## Deployment

**I cannot observe the GitHub Actions run from this environment** — `gh` is not installed here, so
I have not seen Test → Build → Deploy go green on `e951115`. Every step that workflow performs was
run locally on the release tree and passed. Confirm in the Actions tab.

Analytics also cannot be verified end to end until the build is live, because it is disabled on
localhost by design. The manual sequence is in `ANALYTICS.md`; in short: open the deployed site,
accept, start a new career, and confirm one `career_started` in GA4 Realtime or DebugView, then
refresh and confirm no second one. GA4 can take up to 24 hours to surface a new custom event in
the standard Events report, though Realtime and DebugView show it immediately.

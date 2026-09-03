# Maccabist analytics

Anonymous product analytics, added in v0.9.6.4.

**Measurement ID:** `G-4KJEM0LPCF` (GA4)
**Property URL:** https://dviruri.github.io/Maccabist/

---

## The core metric: how many careers were started?

**GA4 event:** `career_started`
**Metric:** **Event count**

That number is the count of new careers. It is designed to be trustworthy: the event fires from
exactly one place in the code — the action that creates and commits a new career — and is deduped
on the career's own id, so it cannot be produced by a refresh, a resume, a re-render or a reopened
screen.

**Two limits, stated plainly:**

1. **It only counts careers created after v0.9.6.4 went live.** It cannot reconstruct careers
   started before analytics existed, and it deliberately does not try. A save from an earlier
   version is not a new career and will never be counted as one.
2. **It counts careers, not people.** One friend starting four careers is four events. There is no
   login and no cross-device identity, by design.

---

## How to check the number

### 1. Realtime — is anything arriving at all?

**GA4 → Reports → Realtime.** Shows the last 30 minutes. Use this right after asking someone to
play, to confirm traffic is reaching the property. If Realtime is empty, the problem is
connectivity or consent, not the numbers.

### 2. Events — the authoritative count

**GA4 → Reports → Engagement → Events.** Find `career_started` in the table. Its **Event count**
column is the number of new careers started in the selected date range. Change the range at the
top right; "Last 28 days" is a reasonable default for a beta.

If `career_started` is not listed yet, it has not been received. New GA4 custom events can take
up to 24 hours to appear in standard reports, though Realtime shows them immediately.

### 3. DebugView — verifying your own session

**GA4 → Admin → DebugView.** Open the game with `?analyticsDebug=1` appended to the URL and your
own events appear here within seconds. Useful for confirming the wiring end to end without waiting
for reports to populate.

### 4. Progression — how far do people get?

Compare the event counts of:

| Event | Reads as |
|---|---|
| `career_started` | careers begun |
| `senior_debut` | careers that reached a real senior appearance |
| `season_completed` | total seasons played across all careers |
| `career_completed` | careers played all the way to retirement |

**These are event counts, not a funnel.** `season_completed` counts seasons, not players, so it is
much larger than the rest by design. Dividing one by another gives a rough feel, not a cohort
analysis — GA4 event counts cannot tell you *which* careers reached each stage without exploration
reports and a user identifier, which this build deliberately does not have.

---

## Event dictionary

Every event also carries `game_version` (from `package.json`, injected at build time).

### `career_started`

| | |
|---|---|
| **Fires** | When a brand-new career is created and committed, from `useGame.startCareer` |
| **Dedupe** | `career_started:<career.id>` |
| **Parameters** | `position`, `origin`, `starting_stage`, `start_season` |

Never fires on load, hydrate, resume, mount, render, or for a pre-v0.9.6.4 save.

### `career_resumed`

| | |
|---|---|
| **Fires** | When an existing save is actively resumed, from `useGame.resumeCareer` |
| **Dedupe** | `career_resumed:<career.id>:<browser session id>` — once per tab session |
| **Parameters** | `position`, `career_age`, `current_stage`, `season_number`, `retired` |

This is **not** the career count.

### `season_completed`

| | |
|---|---|
| **Fires** | When a season record is appended to the career's history |
| **Dedupe** | `season_completed:<career.id>:<season>` |
| **Parameters** | `season_number`, `career_age`, `position`, `club_id`, `team_unit`, `on_loan`, `appearances`, `goals`, `assists`, `clean_sheets`, `won_league`, `won_domestic_cup` |

Reopening a completed-season screen does not emit it again.

### `senior_debut`

| | |
|---|---|
| **Fires** | On the first genuine senior **appearance** — the game's own `first_senior_appearance` milestone predicate (out of the academy, at least one appearance) |
| **Dedupe** | `senior_debut:<career.id>` |
| **Parameters** | `career_age`, `position`, `club_id`, `season_number` |

Reaching senior age or joining a senior squad without playing does not count.

### `transfer_completed`

| | |
|---|---|
| **Fires** | When the player's club actually changes |
| **Dedupe** | `transfer_completed:<career.id>:<season>:<from>:<to>` |
| **Parameters** | `season_number`, `career_age`, `position`, `from_club_id`, `to_club_id`, `move_type` |

`move_type` is `permanent`, `loan` or `loan_return`. The third value exists because a loan return
is also a club change, and calling it "permanent" would report a transfer that never happened.

### `europe_reached`

| | |
|---|---|
| **Fires** | On first observation that the club has a visible European campaign this season |
| **Dedupe** | `europe_reached:<career.id>:<season>` |
| **Parameters** | `season_number`, `career_age`, `club_id`, `competition`, `entry_stage` |

The competition comes from `visibleEuropeanCampaign` — the same chronology-aware authority the UI
uses since v0.9.6.1 — so analytics can never report a competition the player has not been shown.
The journey's future-complete scalars (`finalCompetition`, `reachedLeaguePhase`, `wonCompetition`,
`furthest`) are never read; a test enforces this.

This is the one **state-based** event rather than a transition. A campaign becomes visible at a
single preseason beat, and a player who refreshes past that beat would otherwise never be counted.
The trade-off: a career that was already mid-campaign when analytics arrived reports it once.

### `career_completed`

| | |
|---|---|
| **Fires** | When retirement is committed |
| **Dedupe** | `career_completed:<career.id>` |
| **Parameters** | `position`, `retirement_age`, `senior_seasons`, `appearances`, `goals`, `assists`, `clean_sheets`, `league_titles`, `domestic_cups`, `european_trophies`, `legend_score`, `final_club_id` |

Reopening the retirement screen does not emit it again.

---

## Privacy

**Never sent:**

- the player-entered name
- email, phone, or any contact detail
- any free-text or user-authored content
- event prose, decision prose, or feed lines
- the save JSON or any part of it
- a `Career` object, or a spread of one

**Only sent:** the parameters listed above — predefined enums, internal ids, numbers and booleans.

This is enforced structurally, not by convention. Every payload in `src/analytics/events.ts` is
written out field by field; there is no object spread anywhere in the file and `playerName` is
never read. `tests/analytics.test.ts` sends a career with a distinctive name through all seven
events and asserts it appears in none of them, that no parameter key is `playerName`, and that
every value is a string, number or boolean.

### Consent

Analytics is **off until the player answers**. On first run in a real deployed build, a one-time
bar asks:

> עזרו לנו לשפר את מכביסט
> אנחנו אוספים נתוני שימוש אנונימיים בלבד, למשל כמה קריירות התחילו וכמה עונות שוחקו. לא נשלחים
> שמות או מידע אישי.

with `אישור` and `לא עכשיו`.

- The choice is stored in `localStorage` under **`maccabist.analytics.consent`** (`granted` /
  `denied`).
- Either answer dismisses the bar permanently. There is no repeat prompt.
- If declined, no event is sent and the Google tag is never even loaded — the game behaves
  identically in every other respect.
- Ad personalisation and Google Signals are explicitly disabled in the gtag config; IP anonymisation
  is on. This is product measurement only — no ads pixel, no second analytics provider.

There is no settings screen in the game today, so changing the answer means clearing that key.
Adding a preferences surface for a single boolean was out of scope for this release.

---

## Why local, dev and QA runs do not pollute the data

Analytics is a no-op unless it is a real deployed build being played by a person. It is disabled
when any of these is true:

- `import.meta.env.DEV`, or mode `test`
- running under Vitest
- hostname is `localhost`, `127.0.0.1`, `::1`, or empty
- the URL carries `?gallery=1`, `?probe=1`, `?contrast=1`, `?touch=1` or `?crop=1`

Those five flags are exactly what the dev gallery and the four browser audits use. The audits drive
the game through headless Chrome dozens of times per run; if any of it reached GA the
`career_started` count would be fiction.

The Google tag is loaded **lazily by the analytics module after consent**, not from a `<script>` in
`index.html`. So in every excluded case the network request is never made at all.

**Override:** `?analyticsDebug=1` forces analytics on regardless — used with GA4 DebugView to verify
the wiring by hand. It is the only way to emit from a local build, and it must be typed
deliberately.

---

## Reliability

Analytics is fire-and-forget and can never affect gameplay:

- No gameplay transition waits on it; nothing is awaited.
- Every public function swallows its own failures.
- A blocked Google tag, an offline device, an absent `gtag`, a throwing `localStorage` or a
  throwing transport all leave the game working exactly as before. Tested.
- It never mutates a `Career` and never touches the simulation RNG — ids come from
  `crypto.randomUUID()`. A test simulates the same seed twice, once reporting every transition, and
  asserts the resulting careers are identical.

---

## Where things live

| | |
|---|---|
| Core, consent, gtag, dedupe | `src/analytics/analytics.ts` |
| Typed events and the transition observer | `src/analytics/events.ts` |
| Version constant | `src/analytics/version.ts` (from `package.json` via both vite configs) |
| Consent UI | `src/components/AnalyticsConsent.tsx` |
| Wiring | `src/state/useGame.ts` — two action calls plus one observer effect |
| Tests | `tests/analytics.test.ts` |

**Storage keys** (all `localStorage` except where noted):

| Key | Purpose |
|---|---|
| `maccabist.analytics.consent` | `granted` / `denied` |
| `maccabist.analytics.sent` | dedupe registry, capped at 400 keys, oldest dropped |
| `maccabist.analytics.session` | `sessionStorage` — the tab id, used only for `career_resumed` |

Clearing these resets the consent prompt and the dedupe registry. It does not touch the save.

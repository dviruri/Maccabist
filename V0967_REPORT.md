# Maccabist v0.9.6.7 — GA4 Bootstrap Fix

Analytics transport only. No gameplay, no simulation, no RNG, no change to the event model.

## Baseline

| | |
|---|---|
| Starting HEAD | `d83da5b` (v0.9.6.6) |
| Ending commit | `2f4d3f4` (code and version; this report follows it) |
| Starting version | 0.9.6.6 |
| Ending version | **0.9.6.7** |
| Starting tests | 1415 passing, 80 files |
| Ending tests | **1425 passing, 80 files** |

## Production symptom

Manual testing on `https://dviruri.github.io/Maccabist/?analyticsDebug=1`, with consent granted and
a genuinely new career created:

```
googletagmanager.com/gtag/js?id=G-4KJEM0LPCF   -> HTTP 200
google-analytics.com/g/collect...              -> NO REQUEST
GA4 DebugView                                   -> empty
```

The tag was being served, loading successfully, and then doing nothing.

## Root cause

The internal command queue was an arrow function with a rest parameter:

```ts
const gtag: GtagFn = (...args: unknown[]) => {
  holder.dataLayer!.push(args);          // a real Array
};
```

The official bootstrap is:

```js
function gtag(){dataLayer.push(arguments);}   // an Arguments object
```

That difference is load-bearing. `gtag.js` tells a queued **command** apart from a plain data push
by exactly this distinction, so the `js` and `config` commands were queued as data and never
executed as commands. Nothing was ever configured, so nothing was ever collected.

An arrow function cannot be used here at all: it has no `arguments` of its own.

## The fix

Extracted as `createGtagQueue(dataLayer)` in `src/analytics/analytics.ts`, using a normal function
declaration so `arguments` is the real one:

```ts
export function createGtagQueue(dataLayer: unknown[]): GtagFn {
  function gtag(): void {
    dataLayer.push(arguments);
  }
  return gtag;
}
```

Extracting it also makes the queue shape assertable without a browser, which is why this is now
covered by tests rather than by inspection.

**Unchanged:** the tag is still loaded lazily and only after consent; nothing loads before the
player answers or when they decline; the environment exclusions (dev, tests, localhost,
`?gallery/probe/contrast/touch/crop=1`) are untouched; `?analyticsDebug=1` still forces analytics on
and still sets `debug_mode: true`; Google Signals and ad personalisation remain disabled; the
pending `career_started` mechanism and all dedupe behaviour are untouched. No event was renamed,
added, removed or re-scoped, and no parameter changed.

## Tests

Ten new assertions in `tests/analytics.test.ts`:

- the queued entry is an `Arguments` object and **not** an `Array`
- every argument stays readable by index, with the right `length`
- an explicit side-by-side reproduction of the old arrow shape versus the new one
- the `js` and `config` commands carry the real measurement id `G-4KJEM0LPCF` and the product-only
  config flags
- `debug_mode: true` rides into the queued config under `?analyticsDebug=1`, and is absent without it
- an existing `dataLayer` is appended to, not replaced
- the queue never throws into its caller
- no bootstrap before consent, none when declined, and one once granted

**Verified non-vacuous:** restoring the arrow implementation fails 2 of them.

## QA

| Check | Result |
|---|---|
| `git diff --check` | clean |
| `npm test` | 80 files, **1425 tests**, exit 0 |
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
| 1/3 | exit 0 — 80 files, **1425 tests**, 0 TypeScript errors, 0 skipped (613s) |
| 2/3 | exit 0 — 80 files, **1425 tests**, 0 TypeScript errors, 0 skipped (657s) |
| 3/3 | exit 0 — 80 files, **1425 tests**, 0 TypeScript errors, 0 skipped (625s) |

Determinism unchanged: `ability 82 (peak 86), legend 77, 702 appearances, 450 goals, 120 assists`.

## Deployment

**Not observed.** `gh` is not installed in this environment, so I have not seen Test → Build →
Deploy go green on the final commit. Every step that workflow performs was run locally and passed.

## Live GA verification

**`g/collect` was NOT observed.** This environment cannot inspect production network traffic.

Local/CI code verification passed; final GA transport confirmation requires Uri's production
browser check:

1. Open `https://dviruri.github.io/Maccabist/?analyticsDebug=1`
2. Grant analytics consent if asked
3. Create a **genuinely new** career — `career_started` is deduped per career id, so an existing
   one will correctly refuse to report twice
4. DevTools → Network, filter `collect` → expect at least one request to a GA4 collection endpoint
5. Filter `google` → `gtag/js?id=G-4KJEM0LPCF` should still be HTTP 200
6. GA4 → Admin → DebugView should show the session and the event

If the tag still loads at 200 with no `g/collect`, check `window.dataLayer[0]` in the console: it
should print as `Arguments`, not as an `Array`. See the troubleshooting section in `ANALYTICS.md`.

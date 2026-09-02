# Maccabist v0.9.6.2 — Hebrew Copy QA & Final Beta Readiness

The remaining European presentation-truth bugs, a hardened crop audit, and a complete review of
every player-facing Hebrew string in the game.

## Baseline

| | |
|---|---|
| Starting commit | `0c86c81` (v0.9.6.1) |
| Ending commit | `c261755` (see the CI note below — `823ae80` was the report, `c261755` the hotfix that followed it) |
| Starting tests | 1326 passing, 78 files |
| Ending tests | **1349 passing, 79 files** |
| Version | 0.9.6.1 → **0.9.6.2** |
| Suite stability | 3 consecutive `npx vitest run`, 3/3 green — **not** the full `npm test`; see below |

| Hash | Phase |
|---|---|
| `b41c9c3` | 1 — the career feed tells the truth about qualifying |
| `004ed7f` | 2 — an eliminated campaign is presented as eliminated |
| `e289d45` | 3 — crop audit that sees the cascade |
| `22642ee` | 4 & 5 — Hebrew copy audit |
| `63e7c52` | version and README |
| `823ae80` | this report |
| `c261755` | post-report CI hotfix — TypeScript-invalid test fixtures |

## Product fixes

### 1. Active qualifying no longer reports a finished season

`clubItem` chose its wording with `inLeaguePhase ? europe_lp : europe_out`, making
`!inLeaguePhase` a synonym for elimination. A club still alive in qualifying — where a Maccabi
season *starts* — was told `הקיץ האירופי נגמר מוקדם. הליגה היא הכול עכשיו.` before it had played a
single qualifier.

Four states now, resolved in `europeContext` from the typed result of `visibleEuropeanCampaign`
and nothing else. Elimination outranks everything, since a club knocked out of qualifying is still
nominally "in" the competition it went out of; a settled season outranks the league phase, so a
finished campaign no longer promises `לילות גדולים מחכים` about nights that already happened.

> **Superseded by v0.9.6.3.** Putting elimination above the reveal stage was itself wrong at season
> end: a club knocked out in qualifying kept `הליגה היא הכול עכשיו` into June, by which point the
> league has finished too. The reveal stage is now checked first.

Eight tests; **four of them fail against the old two-state logic.**

### 2. Elimination is described as elimination

`eliminated` was already on the campaign and Home ignored it, so a club knocked out in the
play-off round rendered `קונפרנס ליג · פלייאוף` — indistinguishable from a club currently playing
in that round. Home now says `הודחנו ב{stage}` using the stage the club actually went out at. No
opponent, score, date or extra round is invented.

`EuropeCards` keyed the same idea off `!visible.inLeaguePhase`. The two coincide at that reveal,
but they are different claims — and treating one as the other is exactly what produced bug 1. Both
surfaces now read `eliminated` directly and name the stage from the same field, so they cannot
drift.

Adds `stageShort`, because `stage` carries the graph's full label and Home was showing
`ליגת האלופות · מוקדמות ליגת האלופות — סיבוב ראשון`. It is keyed off the node's round id rather
than its Hebrew, so rewording a label cannot silently change Home.

### 3. Crop regression audit hardened

The v0.9.6.1 audit analysed one rule at a time. `.gf-moment-art` declares `animation: gf-rise` at
line 329 and `transform: scale(1.04)` at line 1056 — neither rule an offender alone, the element
very much one.

The source audit now merges declarations by **target** (the last class token, with ancestors,
attribute filters and pseudo-classes stripped), and the merge is proved against synthetic
stylesheets — split rules, an ancestor-qualified rule, and an opacity-only entrance that must *not*
be flagged. The previous non-vacuity check asserted `.gf-moment-art` had both, which stops being
true the moment it is fixed; a guard that only holds while the bug exists is not a guard.

The browser probe had the matching blind spot: it seeked 0→100% of the entrance and never sampled
geometry *after* the animation stops applying — which is exactly where this snap lives, since
gf-rise holds `transform` at `scale(1)` through its own 100% keyframe. It now cancels every
animation and measures the static geometry in the same series. Re-verified: still fails 17
scene/viewport combinations with the v0.9.6.1 player fix reverted.

**One deletion, no animation change.** `transform: scale(1.04)` never applied — every moment object
in the game is a trophy or award (the only production source is `moment.object` in `CareerMoments`,
all three sites calling `getTrophyArt`), and the higher-specificity trophy rule always won with
`transform: none`. There is no jump today, so per the brief the entrance was left alone and only
the unreachable declaration removed.

`crop:audit` now also covers the decision screens and the composed trophy moment: 120 art elements
across 320×568, 390×844 and 430×932.

### 4. Additional truth bugs found during the Hebrew pass

Two, both in code that assembles Hebrew rather than in the copy itself.

**Every goal in the matchday timeline was credited to the wrong club name.**
`withHebrewPrefix` applied the definite-article contraction to club names. The rule is right for
competitions — it is why `inCompetition` gives `בקונפרנס ליג` — but in a club name the ה belongs
to the name:

```
שער לפועל באר שבע     should be   שער להפועל באר שבע
שער למבורג            should be   שער להמבורג          (Hamburg)
שער לופנהיים          should be   שער להופנהיים        (Hoffenheim)
שער לאל סיטי          should be   שער להאל סיטי        (Hull City)
נשאר בפועל תל אביב    should be   נשאר בהפועל תל אביב  (decision card)
```

37 clubs begin with ה, and transliterations lost their first letter outright. The two cases are now
two functions — `contractedPrefix` for definite common nouns, `withHebrewPrefix` for proper names —
each documented against the other, with a sweep asserting no club in the database is mangled.

**A feed line could render with a hole in it.** `מדברים על השוער של {club}` fell back to an empty
string when no fixture was active, producing `מדברים על השוער של .`

## Hebrew QA

| | |
|---|---|
| Files carrying Hebrew | 115 |
| Lines containing Hebrew | 4,441 |
| Files audited | 115 |
| Files changed | 14 |
| Copy corrections | 25 |

| Category | Count |
|---|---|
| Spelling / malformed word | 2 (`חריצה`, both occurrences) |
| Football terminology | 3 |
| Grammar (prefixes, contraction) | 7 |
| Gender / number agreement | 9 |
| Punctuation | 2 |
| Truth / chronology | 4 |

Full detail in **`HEBREW_COPY_AUDIT.md`**, including a before/after row for every change.

**The `חריצה` correction.** `src/data/events/academyEvents.ts` described a late challenge as
`חריצה מאוחרת על שחקן מפתח` / `נכנסת מאוחר בחריצה על שחקן מפתח`. `חריצה` is not a football word in
Hebrew. Corrected per context rather than by one substitution: the preview now reads
`כניסה מאוחרת בשחקן מפתח` and the outcome `נכנסת מאוחר בשחקן מפתח`, where `בחריצה` was redundant
beside `נכנסת מאוחר` anyway.

**The headline finding is that the prose is good.** It is written, not translated, and no line was
changed for style. What needed fixing was Hebrew assembled at runtime — and nearly every bug was a
place that had a correct helper available and did not use it. `inCompetition`, `countLabel` and the
prefix rule all already existed; `countLabel` was called from exactly one component, so anything a
player did once read `1 הופעות`, and a one-point title race read `1 נקודות מהפסגה`.

Terminology was checked by counting variants, not by impression. Europe, transfers, academy,
matchday and goalkeeper language are each internally consistent; the two apparent Europa League
variants turned out to be a domestic-league *quality* bucket, and `UECL` appears only in comments.

`tests/hebrewCopy.test.ts` is the guard: a short curated token list plus unit tests for the three
helpers and the whole-database sweep. Deliberately not a grammar engine. Verified non-vacuous —
reintroducing `חריצה` fails with the correct file and line.

## Determinism

Copy changes did not affect simulation. `npm run regress` is **byte-identical** to v0.9.6, v0.9.6.1
and this release:

```
european seasons 11    europe history 26    last journey uefa_europa_league/league_phase/12
uefa trophies 0        domestic cups 4      championships 4
ability 82 (peak 86)   legend 77            retired 35 after 17 senior seasons
appearances 702        goals 450            assists 120
```

Diff integrity confirmed separately: the only changes under `src/data/**` are three `text:`/
`preview:` strings. `git diff --word-diff` shows no touched id, icon, flag, condition, effect,
probability or graph value, and quote/brace/bracket counts in both edited event files match the
base exactly.

## Browser QA

| Audit | Result |
|---|---|
| `viewport:audit` | ALL CLEAR |
| `touch:audit` | 0 undersized targets |
| `contrast:audit` | 0 unaccepted failing text nodes |
| `crop:audit` | NO CROP JUMP — 120 art elements, 3 viewports |

## Stability

| Run | Result |
|---|---|
| 1 | 79 files, 1349 tests, green (616s) |
| 2 | 79 files, 1349 tests, green (574s) |
| 3 | 79 files, 1349 tests, green (592s) |

### Correction: the stability gate was run with the wrong command

Added after the fact, because the claim above was measured with
`npx vitest run` rather than `npm test`.

`npm test` is `tsc -p tsconfig.test.json && vitest run`. Vitest does not typecheck, so the
TypeScript compile step — the one CI runs first — was never run during this release. The three
runs were genuinely green; they simply did not cover that step.

CI then failed on it. `EuropeanStep`'s `entered` variant takes `reason: UefaEntryReasonKind`, a
plain string union, and two fixtures added in `b41c9c3` and `004ed7f` passed
`{ kind: 'league_position', position: 2 }`. The `as EuropeanStep` cast could not bridge the two
types, so `tsc` rejected it while the tests stayed green — nothing reads `reason` at runtime.
Because the workflow runs the suite before the build in the same job, the artifact was never
uploaded and the deploy failed from `b41c9c3` onward.

`c261755` corrected the fixtures (and two more of the same wrong shape that had only typechecked
because they sat inside broader casts). CI is green from that commit.

v0.9.6.3 runs the real gate: three consecutive `npm test`, with the TypeScript compile included.
See `V0963_REPORT.md`.

Plus `git diff --check` clean, `npm run build` passing, `npm run rc:audit -- 240` at 0 violations
across 546,961 season records, and `npm run fixture:audit -- 800` at 0 self-opponent violations
across 64,592 fixtures and 149,680 European ties.

## Known limitations

Genuine, and none of them a beta blocker. No football-truth or major Hebrew-copy bug is being
filed here instead of fixed.

- **The crop audit measures scenes, not states.** It covers the 21 gallery scenes that draw a
  player, at three widths. The cascade-aware source rule is what covers everything else, and it is
  a source-level rule rather than a rendered one — it can flag a combination the cascade would not
  actually produce, and it reasons about CSS text rather than about a live page.
- **The Hebrew guard is a curated list, not a checker.** It catches the specific forms found in
  this audit and the three helpers' behaviour. New copy with a new mistake will not be caught
  automatically; that is a deliberate trade, since a guard that flags unusual-but-valid Hebrew
  would train the next person to add exceptions.
- **Number agreement is fixed where a count of one is reachable.** `maccabiLegacy`'s record-chase
  labels and the media feed's goal counts were left alone because their values are structurally
  never 1 (club records and the thresholds `[50, 100, …]`; guards at `>= 3` and `>= 5`). If either
  guard changes, the wording needs revisiting.
- **The stability figure above was measured with the wrong command.** Corrected in place rather
  than deleted; see the correction under Stability.
- **`0.9.6.2` is not valid semver.** It is what the brief asked for and npm accepts it, but a
  tool that parses the version strictly would reject it.

## Is this safe for friend beta testing?

**Yes.**

Every European surface derives what it shows from one authority replaying one chronology, and the
last two places that reasoned about elimination independently now read the same field. A club in
qualifying is described as being in qualifying; a club knocked out is described as knocked out; a
finished campaign is described in the past tense. Zero-appearance seasons still contain zero
football output. The player renders in his intended crop from the first painted frame, and the
audit that proves it can now see hazards split across the cascade.

The Hebrew a player reads is correct. The prose was already good; the assembled strings were not,
and the two worst — a mangled club name on every goal, and `1 הופעות` on anything done once — were
in the most-repeated lines in the game.

The deterministic baseline did not move across any of it, three consecutive full runs agree, and
every audit is clean.

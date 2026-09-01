# Maccabist v0.9.5 — Decisions & Career Flow

**Base:** `3cf88f8` · **Phases:** `1cd9fb0` `b122c55` `2df1e96` `d0d3cdf` `d894a7f` `7a6a49a`
`972b0cd`

## Executive Summary

v0.9.5 changes how a career decision is **made**, and nothing about what it **does**.

Before this release every decision in the game ended the same way: a block of information, and
then, separately, a pair of generic buttons. The player read a comparison and then had to map it
onto a verb. That is a form. It is why a transfer offer — the most dramatic thing that can happen
to a career — read like a settings page.

Now every decision reads the same way, and the same way as each other: **what happened**, then the
**futures as cards you press**. The card is the action. There is no Accept / Decline pair anywhere,
and no confirmation step, because the card already says what pressing it does.

The claim that this is presentation-only is not an assertion in this document. It is structural:

- **Not one file under `src/game`, `src/data` or `src/types` changed.** `git diff 3cf88f8..HEAD
  --stat -- src/game src/data src/types` is empty. The simulation, the RNG, the probabilities, the
  transfer logic, the event pool and every type are byte-identical to the base commit.
- **Seed 5 reproduces the v0.8 baseline career exactly** — all twelve quoted figures, unchanged.

## Decision Design Language

Two new files carry the whole grammar.

`src/ui/decisionView.ts` is the view model and the only place allowed to turn engine output into
card shape. Its single arithmetic operation is `outcomeSummary`, which **adds up percentages the
engine already assigned**. Grouping 45 and 15 into 60 is the same odds, grouped — not a second
opinion. It returns `null` below two outcomes, so a choice with nothing to be uncertain about can
never grow a bar. `toneOfHint` recognises `consequenceHints`' own downside vocabulary rather than
guessing sentiment; an unrecognised hint renders neutral, which is the safe failure — still true,
just uncoloured.

`src/components/DecisionChoice.tsx` is the grammar: `DecisionScene`, `DecisionHead`,
`DecisionChoices`, `DecisionChoiceCard`. Four regions, and exactly one may move:

| region | behaviour |
| --- | --- |
| `head` | the question. **Never** scrolls. |
| `context` | elaboration. Scrolls when there is not enough room. |
| `choices` | the futures. Never scroll off. |
| `footer` | offer paging. |

The details link is a **sibling** of the card's button, never a child — nesting would be invalid
HTML and would make reading the consequences indistinguishable from committing to them.

### The honesty rule, enforced rather than intended

No card may state a fact the game does not model. This is checked as vocabulary, because intent is
not testable: `tests/decisionLanguage.test.ts` fails if a choice card ever contains שכר, משכורת,
בונוס, מיליון, ₪, יורו, דולר, עמלה or a hard-coded percentage, and if the presentation layer ever
references `Math.random`, `rng` or `resolveFromDistribution`.

## Transfer Decisions

`src/components/DecisionScreen.tsx`. The stay-versus-go comparison **is** the choice now: two
cards, each carrying the facts that make it what it is.

A move is no longer implicitly the good option. The old screen put the destination on the "go" side
with nothing negative anywhere; `factsForMove` colours the engine's own `direction`, so a step back
reads red, and an expected role of **גיבוי** is a red line on the card offering it rather than a
neutral chip elsewhere. The stay card carries `roleText` and nothing invented — the game models no
guaranteed minutes, so the card promises none.

**Decline semantics.** With several offers on the table, `onDecline()` turns down the whole summer.
That is now stated as a consequence **on the card that performs it** ("דוחה את כל ההצעות שעל
השולחן"), not only in a label that happened to be visible.

**Mandatory offers** render **one card and no stay side**. Drawing a second card for visual symmetry
would offer a choice the engine will not honour.

`onAccept(offer.id)`, `onDecline()`, mandatory semantics and multi-offer semantics are untouched.
The transfer shirt identity rule is untouched: he wears his **current** club while deciding.

## Event Decisions

`src/components/DecisionCard.tsx`. Each choice is a card carrying its own consequences; the
concrete outcomes moved into a sheet.

The old design defeated itself. Four choices with four outcomes each was an unreadable wall, and the
inline "מה יכול לקרות?" expansion pushed the other choices off the screen — so the comparison the
odds bar existed to enable stopped working the moment anyone used it. Comparing two choices is now
reading two cards; reading the full outcome list is one tap and moves nothing.

The engine's qualitative read is **kept, not replaced**: `riskLevelFrom` and `hasHighUpside` are the
card's subtitle, because "unlikely but catastrophic" versus "likely but mild" is a judgement three
summary figures genuinely cannot express.

`OutcomeReveal` is untouched — same resolution, same timing, same deterministic behaviour.

## Real Probability Presentation

| situation | what the card shows |
| --- | --- |
| `distribution.outcomes.length >= 2` | bar + three figures, grouped from the engine's own percentages |
| `distribution.outcomes.length < 2` | the authored `choice.hint`, or the risk band. **No odds.** |
| full outcome list | sheet: exact label, exact engine percentage, consequence hints |

No probability is computed in the UI. The load-bearing test runs **every choice of every event in
the real pool** and asserts the three summary figures reconstruct the engine's own total exactly.

## Youth-to-Senior Decision

`YouthTransitionCard` in `src/components/SeasonCards.tsx`. Ten seasons of climbing used to resolve
into `btn btn-choice` rows showing a club name and a league as a grey hint.

Each destination is a choice card now, and `factsForMove` is **imported from the transfer screen**
rather than reimplemented — two copies of "which of an offer's fields belong on a card, and what
colour is each" is two places to disagree about whether rotation is a warning. The result states
the tradeoff the engine already modelled: stay at Maccabi Haifa and rotate, or drop a division and
start. Both facts were on the offers; neither was legible before.

With **no offer** it stays one button. There is no decision to make, and manufacturing one would be
a lie.

## Retirement Decision

`RetirementDecision` in `src/pages/GamePage.tsx`. Two cards.

**No percentages and no odds bar.** The retirement flow models nothing numeric — no probability of
another good season, no injury risk, no projected decline — so the cards carry plain consequences of
the two paths the engine offers. This was the easiest place in the release to invent a number and
the worst.

## Mobile / One-Screen QA

Seven viewports, via `npm run viewport:audit`:

`320x568 · 360x640 · 360x800 · 375x812 · 390x844 · 412x915 · 430x932`

**210 scene x viewport measurements. 0 FAIL.** Every decision scene reports `over=0` — the
document's scroll height equals the viewport at every size — and every required element
(`.dc-title`, `.dc-choice`, the STAY card, the pager, the bottom nav) is inside the viewport
rather than merely present. Asking for `.dc-choice-quiet` specifically is what catches the second
card being clipped by the nav; asking only for `.dc-choice` would pass on a screen showing one.

The layout contract is structural, not tuned: the question is pinned, the context gives way, the
choices hold. Three findings, all from measurement:

1. **The question could scroll away.** The first build put the headline inside the scrolling region;
   at 320x568 an offer rendered as a crest and two cards with the title out of sight. `DecisionScene`
   now has a pinned head — the question is structurally incapable of scrolling off.
2. **A `min-width` media query was answering about the wrong box.** `@media (min-width: 380px)` reads
   the viewport, and the gallery pins the app to 320 inside a 520 window, so two cramped columns
   rendered where a stack belonged. Replaced with `auto-fit` + `minmax`, which asks the container.
3. **Three choices needed a much higher floor than two.** A two-choice dilemma has short verbs for
   labels; a three-choice event has sentences. At `minmax(140px)` the personal-coach question
   rendered as two columns of six-line towers — the "do not shrink text to force side-by-side"
   failure in layout form. Three and four now use `minmax(200px)` and stack on every phone.

Nothing shrinks type. Every height tier removes content or tightens space, and a test walks the
v0.9.5 CSS block to prove no `font-size` appears inside one.

### Decision states inspected

**Transfer:** single offer (loan, Europe fact present) · multiple offers · mandatory / release
(one card) · promotion (youth) · agent present · **no agent** · Europe fact absent.

**Event:** two-choice probabilistic · two-choice with one non-probabilistic side · three-choice
(the widest the pool contains) · match moment · people event · cup final · major event · academy ·
goalkeeper.

**Career:** youth-to-senior with one offer · youth-to-senior with two offers · retirement.

**Seven of these had no gallery scene before this release** — `youth-fork`, `youth-fork-two`,
`retirement-decision`, `decision-mandatory`, `decision-no-agent`, `event-three` and
`event-cup-final`. That is a large part of why the youth fork and retirement were still rows of
`btn btn-choice` after three passes of visual work: a screen with no way to screenshot it is a
screen nobody checks. All seven are now in the gallery and in the viewport audit.

## RTL

**One real bug, present since v0.9.3.** The document is `dir="rtl"` and the offer pager is a plain
flex, so its first child renders on the **right**. I could not read the glyphs reliably at any zoom,
so I replaced them with the words PREV and NEXT and screenshotted: previous sits on the right, and
offer 1's dot is the rightmost dot. Travelling to the previous offer therefore moves **rightward** —
and the button was carrying `‹`, on the right, pointing away from where it took you. Swapped, and
pinned by a test that records the measurement so the next person cannot restore the intuition
instead of the behaviour.

Otherwise clean: percentages are wrapped in `<bdi>`, the retirement age in `<Ltr>`, club names and
country/league pairs read correctly, and no VS strip survives on a decision surface. `›` as the
"more" affordance is deliberately left alone — it is the app's established convention on every
other screen, and changing it here would be a redesign rather than a fix.

## Tests

`npm test` — **67 files, 1223 tests, all passing** (exit 0, 1275s).

The base commit was 66 files / 1202 tests, so this release is a net **+21 tests and +1 file**.

New: `tests/decisionLanguage.test.ts` (20 tests) covering the summary/engine invariant, the fact
vocabulary, the presentation-layer boundary, the scene layout contract and the RTL pairings.

Updated in `tests/oneScreen.test.ts`: the assertions that required `<GameButton>` and `.btn-choice`
on a decision surface. Those described the system this release replaced; they are **inverted**
rather than deleted — the screen must now contain no `GameButton` and exactly two
`DecisionChoiceCard`s, and must guard against double commits.

## Deterministic Regression

`npm run regress` — seed 5, balanced policy, against the baseline every release since v0.8 has
quoted:

| metric | baseline | v0.9.5 |
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

Every figure identical.

### Engine invariants

- [x] same seed produces same career — twelve figures, exact
- [x] same event choice produces same resolved result — `resolveFromDistribution` draws from the
      preview's own object, unchanged
- [x] probabilities unchanged — `src/game` untouched
- [x] transfer acceptance / decline unchanged — same two handlers
- [x] multiple-offer decline semantics unchanged — still declines all; now *stated*
- [x] mandatory offers unchanged — and now render one card
- [x] youth transition semantics unchanged — same `onChoose(offerId | null)`
- [x] retirement semantics unchanged — same `retirementChoice`
- [x] no new RNG call introduced — forbidden in the presentation layer by test
- [x] no new simulated facts introduced — forbidden by vocabulary test

### UX invariants

- [x] no generic Accept / Decline transfer UI remains
- [x] the choice card itself is the action
- [x] the title explains what pressing it does
- [x] consequence preview is concise (three facts, two on short screens)
- [x] real probabilities appear only where the engine provides them
- [x] no fake percentages
- [x] detailed outcomes remain accessible (sheet)
- [x] no decision requires **document** scrolling
- [x] all legal choices remain reachable
- [x] selected / disabled feedback prevents duplicate commit — on all four surfaces

## Build

`npm run build` — **passes.**

```
dist/index.html                 1.59 kB   gzip:   0.66 kB
dist/assets/index-CmJ9sxc9.css  113.98 kB gzip:  21.06 kB
dist/assets/index-9dO3ICBt.js   966.57 kB gzip: 260.31 kB
built in 2.80s
```

CSS grew 4.3 kB (109.67 -> 113.98) for the decision language block; JS grew 5.5 kB for the two new
modules and the rebuilt screens. The >500 kB chunk warning is pre-existing and unrelated.

`git diff --check` — clean at every phase.

## Known Issues

- **One decision state scrolls internally.** At **320x568**, an event with two odds-bearing cards
  needs about 60px more than the viewport has, after the framing is hidden and the description is
  clamped. The choice *region* takes an internal scroll there — `auto`, never `hidden`, so every
  choice stays reachable and the document does not move. Every other viewport and every other
  decision type fits without it. The alternatives were all worse: hiding a choice removes an option
  the engine will honour, dropping the odds removes the numbers this release exists to show, and
  shrinking the type is forbidden outright.
- **A mandatory offer leaves a visible gap** between the description and its single card, because
  the context region stretches to pin the choice to the bottom. Consistent rather than broken, but
  it reads as empty on tall screens.
- **Both cards of an event often show the same consequence lines.** `consequenceHints` reports what
  a choice can *move*, and two choices in the same dilemma usually move the same attributes; the
  odds are what differ. This is the engine being honest, and differentiating the text would mean
  inventing it.
- **No four-choice event exists in the pool** (max is three, in five events), so the four-up grid
  path is implemented and unexercised by real content.
- The three-choice `.dc-choices-3` grid pairs up only above ~410px of container width, i.e. on
  tablets. On every phone it stacks. That is deliberate, not a fallback.

## Deferred to v0.9.6 QA

- Player asset work of any kind — age artwork, shirt assets, the `child`/`youth`/`adult` buckets
  still being byte-identical copies of the adult render.
- New career events; a four-choice event would exercise the grid path above.
- Any balance, simulation or probability change.
- The full release-candidate pass.

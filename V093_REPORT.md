# Maccabist v0.9.3 — One Screen Game Flow

## Executive Summary

v0.9 made the game look like a game and v0.9.2 made it feel tight. Manual playtesting still
found a web page: primary states stacked one under another, too much visible at once, and a
scoreboard that could read backwards. v0.9.3 fixes both halves of that.

**Every primary screen now fits one viewport, at every phone size tested.** Sixteen screens
across six viewports — 320×568, 360×800, 375×812, 390×844, 412×915, 430×932 — is 96
combinations, and all 96 fit with every required element inside the viewport. At the 390×844
reference the career home went from wanting 1087px to 844, and the event decision from 1096 to
844.

**The score bug was real and structural.** The matchday board put the player's club first in the
DOM, which in an RTL document puts it on the right, then printed the score as one LTR string —
so the digit drawn beside his club was the opponent's. Every number was correct and the screen
still lied, because the pairing of number to club was left to text direction.

The simulation is untouched and shown to be: a same-seed career (seed 5, balanced) reproduces
the baseline every release since v0.8 has quoted — 26 European seasons, the same Europa League
league-phase journey of 12 matches, 0 UEFA trophies, 4 domestic cups, 4 championships, final
ability 82, Legend Score 77, retirement at 35, 702 appearances.

Every visual claim below was checked against a screenshot at a real phone size. Several were
wrong first, including one where the screenshot harness itself was lying to me; those are named.

## Score / RTL Integrity

**The bug.** `[ opponent ]  2 : 1  [ player's club ]` — the score was a single LTR run in the
middle of a flex row that inherited the document's RTL direction. The digit adjacent to the
player's club was the second of them.

**The fix is a model, not a string.** `src/game/matchScore.ts`:

```
MatchScoreViewModel { homeClubId, homeClubName, awayClubId, awayClubName,
                      homeScore, awayScore, playerIsHome, home, away }
```

The engine's numbers are player-relative (`scoreFor` / `scoreAgainst`), because that is how the
presenter derives them from the player's real half. Mapping them onto home/away happens here,
once, from the fixture's own `home` flag.

**The geometry is explicit.** `src/components/MatchScoreboard.tsx` is the only component in the
game that draws a score. Its container declares `direction: ltr` and every cell names its own
grid area:

```
away  awayScore  :  homeScore  home
```

Away left, home right — the home club leading from the right, the Hebrew convention — with each
number in the cell touching its own club. Club **names** are RTL, because they are Hebrew text;
the board's geometry is not. RTL can move a club to the other side of the screen; it cannot move
a number away from its club.

Everything that shows a matchday score reads that one model: the live board, half time, full
time, the verdict, the timeline tally. The verdict comes from the player's own side of the model
rather than from digit order.

**Two truth improvements fell out of it.** A goal moment now names the club it went to — "שער
למכבי חיפה" instead of "שער לקבוצה שלנו" — through a shared `withHebrewPrefix` helper in
`identity.ts` that contracts the definite article the way `inCompetition` already did for ב. And
the board's own venue labels replaced the duplicated "בבית / בחוץ" caption, which existed to
compensate for a scoreline that did not carry the venue.

## Career Home

Measured with the real `GamePage`, not the scene inside it: **1087px at 390×844**, with the
primary button off screen at y=900. After: **844**, button at 676.

| what changed | how |
| --- | --- |
| the season's action | A card with a kicker, a title, a paragraph, a chip and a button — 204px, of which the title was the club (already in the hero) and the season (already in the topbar). What survives is what is genuinely once-only: the first preseason of a career, the older-age-group chip, and the button. |
| the feed | Four message cards became the two most relevant lines plus עוד, which opens the story sheet the full feed already lived in. |
| the next match | A tall bordered card became a strip. Crest **beside** club name rather than above it — stacked, a two-word Hebrew name wrapped to a second line and the card paid 25px for it on every home screen. |
| league and Europe | The season strip and the Europe card left the home screen for one tappable chip each. `SeasonStrip` now leads the table sheet, `EuropeCard` leads the Europe sheet. |
| the hero | Club and ability moved onto one row (~30px on every screen the hero appears on), and the frame's min-height dropped from `clamp(220px, 38vh, 300px)` to `clamp(176px, 21vh, 220px)`. Its rendered height went 245px → 204px; the identity block is content-driven, so the min-height was mostly slack. It is still the largest thing on the screen. |
| rhythm | `.shell.play` gap 16 → 9. |

Because the feed's derivation now decides what a player sees first, its priority became a product
decision: `clubItem` moved above `mediaItem`. Agent, coach, club, media — what a player acts on
first, colour last.

At 390×844 the first viewport holds: identity, position and age, club, ability, the league
situation, the whole next match, two feed lines, עוד, the season's one action, and the bottom
nav.

One deliberate deviation from the brief's sketch: the primary action sits **below** the
next-match strip rather than inside it. It is still the screen's only primary button — nothing
else on the home screen is a filled green control — and keeping it in the phase layer means the
engine stays the single owner of what "continue" means at this beat, rather than the home screen
duplicating that mapping.

## Matchday State Machine

Four explicit states, exactly one on screen:

```
PREVIEW  →  LIVE  ⇄  HALF TIME  →  FULL TIME
```

The state is **derived** from how much has been revealed rather than stored, so it cannot drift
out of step with the story the reveal has told — the moment at the head of the reveal decides it.

- **LIVE** — the current moment only: minute, icon, one line at hero size, and at display size
  when it is the player's own.
- **HALF TIME** — its own concise state, with wording taken from `matchVerdict` rather than from
  comparing two scores.
- **FULL TIME** — a conclusion: the verdict at display size (was 30px), the competition and
  opponent, then the real half-stats the matchday was drawn from.

What this replaced: every revealed moment stayed stacked on screen, so by full time the verdict
sat under a growing list and the player scrolled to find the button. Earlier moments are not
deleted — they moved behind **מה קרה במשחק**, a list that scrolls inside itself because it is
data rather than the game.

The player art became one atmospheric depth layer behind all four states instead of a section
only the preview had. Controls are one primary button and two genuinely secondary text actions;
v0.9.2 gave three buttons identical weight, which made none of them obviously the one to press.

## Career Decisions

Two decision surfaces, one rule: **a choice owns the viewport.**

**The event decision.** v0.9.2 collapsed the home to its compact hero here — the v0.4.7 fix, and
a real improvement over the four-screen dashboard before it. But 229px of hero above the question
still meant the event decision measured 1011px at 390×844 with its last choice below the fold
(1096 before Phase 2 took the league strip and the Europe card off the screen).
`GamePage` now has `DECISION_PHASES` and renders no home scene for them. The context a decision
needs is not a generic hero: it is the event's own framing, which it already carries — the
variant strip, the match strip, the person header, the cup-final strip. **The bottom nav stays,
deliberately**, so a player can still consult the table before he answers. No decision logic,
offer generation, odds or accept/decline semantics were touched. Measured: 1011 → 844.

**The transfer offer.** Same elements, no longer a page-shaped stack of nine blocks.

- The facts stopped being a table. Three rows of label-and-value dominated a screen whose subject
  is a choice; they are one chip line now, with everything else behind **פרטי ההצעה** — a real
  bottom sheet, so nothing was deleted.
- Paging became dots. ● ○ reads like a card you can move between; each dot is its own button, so
  a specific offer is one tap away rather than three. The arrows stayed, and in RTL the bidi
  mirroring of the chevrons lands correctly: previous sits right and points right, next sits left
  and points left.
- The buttons say what they do: **עוברים לטורינו** and **נשארים**, derived from the real
  destination — but only for the kinds that *have* a destination (transfer, loan, return_home). A
  contract, a release or a forced promotion keeps the engine's own labels, because there is
  nowhere to move to and those labels are how those beats phrase themselves.
- The club is named once: crest, then league and country, then the headline. The first pass printed
  it three times above one choice.
- The offer's own prose is clamped to three lines **and tappable**, because a clamp ends in an
  ellipsis and an ellipsis has to lead somewhere. It opens the same sheet.

No invented facts: no salary, no contract length, no appearance guarantee. There is a test.
Neither button is styled as recommended; the agent may have an opinion, the layout may not.

## Major Moments

The art pack's moment images are **scenes**, and several contain a generic footballer — a
championship celebration, a debut, a press presentation, a retirement. Drawn alone, a career's
biggest night was showing somebody else, and the last screen of a whole career was a stranger
hanging up his boots.

Every `CareerMoment` now carries a `mood`, and `MomentShell` takes a `playerArt` layer.
`CareerMomentScreen` resolves the career player through `ui/playerArt` by his **real age and
position** and draws him on his own moment; the retirement hero does the same, at his retirement
age.

`mood` is also where the v0.9 confetti rule extends to poses: `celebration` for a night he
celebrates, `hero` for one he does not. A relegation moment gets no confetti and no celebrating
character, because a moment system that only celebrates is a liar.

**Two compositions, decided by what the art is.** The first attempt put the scene beside the
player at 58% width; the screenshot showed a pasted rectangle with a *second* footballer standing
in it — worse than the problem it was fixing.

- A **scene** becomes a full-stage layer behind him, dimmed to 0.34 and defocused with a 2.5px
  blur, so its own generic figure reads as depth of field rather than as a person.
- A **trophy** is a transparent object with nobody in it, so it keeps the leading half of the
  stage, crisp, at full opacity, with the player beside it. Selected in CSS off the asset path,
  with the player's placement following via a sibling selector.

## Information Architecture

Five navigation buttons, five destinations, one each. The ambiguity v0.9.1 flagged in its own
Known Issues is gone: **מועדון** used to *toggle* between the people screen and the Maccabi
record book, so the same button meant two things depending on where you already were.

| button | destination |
| --- | --- |
| טבלה | `SeasonStrip` (what the table means) + the league table + the season-phase strip |
| הסיפור | the **full** career feed + the career timeline |
| בית | the home screen |
| הקריירה | the Player Hub + the trophy showcase + the journey + season cards |
| מועדון | the people around him + the Maccabi record book |

Europe is a drill-down from the home chip: the full `EuropeCard` in front of the 36-club
standings it was always the summary of.

Two destinations gained the content they were always the destination for. **הסיפור** now leads
with the whole career feed — the home's two lines are literally the first two of these, because
`CareerFeedFull` shares both the derivation and the line markup with the home feed. **הקריירה**
gained the trophies he has actually won, via the same `TrophyShowcase` the archive renders, so a
live career and an archived one display the same cabinet; previously the showcase existed only
after retirement.

Nothing is duplicated: `SeasonStrip`, `EuropeCard`, `EuropeStandings` and `LeagueTableCard` each
render exactly once in `GamePage`, and there is a test.

## Typography

The brief's warning taken literally: **less content + stronger hierarchy + tighter spacing**,
never same content + smaller text. This pass has exactly one direction, and it is up.

```
SCORE     clamp(50px, 15vw, 74px)   the matchday's subject
IDENTITY  clamp(30px, 8.6vw, 46px)  the player's own name
DISPLAY   clamp(34px, 10vw, 56px)   a moment, a verdict, half time
HERO      clamp(24px, 7vw, 36px)    a decision headline, a match moment
NUMBER    clamp(22px, 6.5vw, 30px)  a rating badge
SECTION   clamp(17px, 5vw, 22px)    a screen area's title
LEAD      clamp(15px, 4.4vw, 19px)  a club, a role, an agent, a button
BODY      clamp(14px, 4vw, 16px)    ordinary information
META      12.5px                    genuinely secondary
MICRO     11.5px                    the floor
```

Every stray magic number in the game layer moved **up** into the nearest tier: 10.5px and 11px to
the 11.5px floor, 12px to META, 13/13.5/14.5px to BODY, 15px to LEAD. The 320px override that
dropped the player's name to 29px is gone — the identity clamp already floors at 30, so that was
a 1px shrink for nothing. **No font size in `gamefeel.css` got smaller in v0.9.3, and no height
media query changes one.** Both are tested.

What got smaller is the space between things — scene gap 11 → 10, scene padding 14/13/16 →
13/12/14, glass padding 14 → 12, slim topbar 10px → 7px — and the number of things, which was
phases 2 through 6.

One card-inside-card removed (the trophy showcase's own cards *are* the surface), and
`.gf-glass .gf-glass` flattens the inner surface generally. Deliberately **not** a blanket
`.card .card` reset: that would reach every legacy surface in `global.css`, some of which nest on
purpose, and flattening those blind is a redesign with no screenshot behind it.

## Mobile Viewport QA

`scripts/viewportAudit.mjs` (new) asks the page itself for `document.scrollHeight`, the real
`window.innerHeight`, and whether each required element is present **and** inside the viewport.
That last part is what stops the test from being gameable: a screen can always be made to "fit"
by cropping its primary button away, and the page reports that as `CUT`.

```
=== 320x568 ===  16/16 ok        === 390x844 ===  16/16 ok
=== 360x800 ===  16/16 ok        === 412x915 ===  16/16 ok
=== 375x812 ===  16/16 ok        === 430x932 ===  16/16 ok

ALL CLEAR  (96 scene/viewport combinations)
```

Every one of the 96 measured `scrollHeight` **exactly equal** to `innerHeight` — not merely
inside the 24px safe-area tolerance the script allows. Nothing in the final run relies on it.

Scenes audited: `gameplay`, `gameplay-away`, `play-academy`, `play-gk`, `gf-play-home`,
`gf-play-home-euro`, `gf-home`, `gf-matchday`, `gf-matchday-live`, `gf-matchday-half`,
`gf-matchday-ft`, `gf-play-decision`, `gf-moment`, `gf-moment-uefa`, `gf-moment-relegation`,
`gf-moment-debut`.

Horizontal overflow, separately, on 18 scenes × the same six widths: **zero**, with the
`probe-canary` failing at every width as the control.

### Two real bugs the measurement found

**The same 40px, three times.** Decision screens measured 608 against a 568 viewport; the
matchday had measured 884 against 844 in Phase 3. `.app` adds 40px plus the safe-area inset so an
ordinary page's last action clears a phone's home indicator — and a 100dvh child that handles its
own inset then makes the document exactly that much taller. A third case: any screen carrying the
fixed bottom nav, where the nav already honours the inset and the spacer already clears the bar,
so the padding was 40px of nothing under every viewport.

**An internal scroll region cannot cap anything if its column has no height.**
`.play-main-decision` had `flex: 1` but `.shell.play` had no height, so at 320×568 the event card
still grew to 644px and the document still scrolled. The shell is now exactly one viewport tall
while a decision is on screen (`play-fixed`) — and only then, because a settled-season summary is
a report and a report may be longer than a phone.

### What gives way on a short screen

Height tiers, not width ones: 360×800 and 375×812 are two of the commonest phones there are and
both are shorter than the 390×844 reference.

| tier | what is removed |
| --- | --- |
| ≤830px | one feed line instead of two (עוד is right there); the offer's prose clamps to two lines |
| ≤700px | tighter seams, shorter hero and matchday stages |
| ≤620px | the position-and-age line (name, club and ability stay); the home feed entirely, because הסיפור is one of the five buttons at the bottom of the screen; the next match's stake line; the offer's prose; and the event card and the offer's detail region each take their own scroll |

Every region that absorbs height **scrolls** rather than clipping, so nothing is hidden to fake
the measurement. Tested.

### The screenshot harness was lying to me

`--window-size` is 95px taller than the CSS viewport under `--dump-dom`, so the audit asks for
target + 95. Under `--screenshot` it is **not**: the capture is the window height exactly. Adding
the same 95 produced screenshots at a 939px viewport while claiming to show 844 — which silently
disabled every `max-height` rule, so the 320×568 shot showed the full hero, the caption and the
feed, and looked broken. `scripts/shot.mjs` passes the height through untouched now, and the
PNG's own dimensions are the check.

Inspected by eye at a true 320×568 and 390×844: home, matchday preview, matchday live, matchday
full time, the transfer offer, the event decision, a European trophy moment, a relegation moment,
a debut moment, and the retirement hero.

## Tests

```
1142 passed / 1142    (64 files)     npm test, exit 0
```

`npm test` runs `tsc -p tsconfig.test.json` before vitest, so the test sources typecheck too.

1086 at the v0.9.2 baseline plus 56 new, in three files:

| file | tests | what it holds |
| --- | --- | --- |
| `tests/matchScore.test.ts` | 15 | home wins 2–1; away wins 1–2; a draw at either end; the player club as home; as away; the stylesheet's own grid row asserted to read `away awayScore sep homeScore home`, so each score touches its own club; no other component names a home or away score; the live timeline agrees with the board at every beat and lands exactly on the result; half time; matchday vs summary across 25 real seeds |
| `tests/oneScreen.test.ts` | 31 | the home renders none of ten archive components and caps the feed at two with a destination; every full rendering lives inside a sheet and exactly once; the matchday's four states are derived not stored and the moment list is iterated in one place; one primary control and two minor ones; a decision renders no home scene and keeps the nav; every FactRow inside the details sheet; dots not a counter; no invented contract facts; one destination per nav button; the whole tier ladder with nothing below 11.5px and no font size inside a height tier; every scroll region reachable rather than hidden |
| `tests/majorMoments.test.ts` | 10 | championships, cups and European trophies are celebrations and a relegation is not; arrival and debut carry a mood; the mood is one of three values; the player layer comes from age and position; the retirement hero draws him at his retirement age; a scene is dimmed and blurred while a trophy keeps opacity 1; every pose resolves to a file that exists, goalkeepers never falling back to outfield |

Nothing was deleted, weakened or even edited: `git diff --stat fcddcdf..HEAD -- tests/` shows
three new files and **no change to any existing test**. The 1086 that passed at the v0.9.2
baseline are the same 1086 tests.

Worth stating plainly, though: the new assertions caught my own work four times while I was
writing them, and each catch was the useful part.

1. Phase 3 — the "no component names a home or away score" rule flagged the matchday's half-time
   line, which really was comparing `homeScore` to `awayScore`. That is exactly the "component
   pairs a number with a club" reasoning Phase 1 exists to remove; it reads `matchVerdict` now.
2. Phase 4 — the "no invented contract facts" rule flagged my own disclaimer, which said "no
   salary, no contract length here". Honest, but it put those words on the decision screen. The
   footnote is one line now and the test stayed strict.

And twice the assertion itself was wrong, which is its own kind of finding:

3. Twice a source check matched a **comment** rather than a rendering — `CareerHome`'s doc comment
   explaining what had moved, and then the score rule's own explanation of why it exists. Both
   now match JSX or strip comments first.
4. Phase 6 — three assertions anchored on `sheet === 'x'`, which also matches the nav button's
   active-state check higher up the file, so they were reading the wrong sheet's body. Phase 7 — a
   regex-built CSS block lookup read the first declaration rather than the cascade winner, and then
   matched the tail of a compound selector instead of the base rule. Phase 8 — a pattern cannot
   close a media block that contains nested rules; it counts braces now.

## Regression

Same-seed career, seed 5, balanced — the baseline every release since v0.8 has quoted, now a
committed script (`scripts/sameSeedRegression.ts`) rather than a line in a report:

```
europe history seasons  26
last journey            uefa_europa_league, furthest league_phase, 12 matches
uefa trophies           0
domestic cups           4
championships           4
final ability           82   (peak 86)
legend score            77
retirement age          35   (17 senior seasons)
career totals           702 appearances, 450 goals, 120 assists
```

Identical to v0.8, v0.9, v0.9.1 and v0.9.2. **No engine change in this release at all.** The only
non-presentation edits are `withHebrewPrefix` in `identity.ts` (a string helper), `matchScore.ts`
(a pure view model over facts the presenter already had), and the reordering of two feed
templates. No simulation rule, probability or balance value moved.

### Previous fixes verified

- [x] Home and Matchday same opponent — `tests/fixture.test.ts`, 60 seeds
- [x] Matchday same competition — same
- [x] correct home/away — `tests/matchScore.test.ts`, both venues
- [x] score semantics correct — the whole of Phase 1
- [x] cup final remains end-of-season — `tests/seasonSequencing.test.ts`, 30 seeds
- [x] current European campaign correct — `tests/europeStatus.test.ts`
- [x] next-season route separate — same
- [x] youth crest inheritance correct — `tests/crestInheritance.test.ts`
- [x] Career Feed variety preserved — `tests/careerFeed.test.ts`, plus the new priority test
- [x] signing ceremony preserved — `deriveArrivalMoment`, now with the career player on it
- [x] debut ceremony preserved — `deriveDebutMoment`, same
- [x] bottom nav preserved — and now one destination per button
- [x] European standings preserved — in the Europe sheet, behind the full card
- [x] old saves load — the hydration suites pass unchanged; `SCHEMA_VERSION` is untouched
- [x] archived careers load — `tests/archive.test.ts`

### One-screen checklist, at 390×844

- [x] Home does not document-scroll — 844 / 844
- [x] Matchday Preview — 844 / 844
- [x] Matchday Live — 844 / 844
- [x] Matchday Full Time — 844 / 844
- [x] Decision screen — 844 / 844, both the offer screen and the event decision
- [x] Major Moment — 844 / 844, all four moment scenes

### Score checklist

- [x] Home team score tied to home team — grid area `homeScore` adjacent to `home`
- [x] Away score tied to away team — `awayScore` adjacent to `away`
- [x] RTL does not invert meaning — the container declares `direction: ltr`
- [x] Timeline agrees with scoreboard — asserted at every reveal step
- [x] FT agrees with simulation result — asserted across 25 seeds

### Decision checklist

- [x] one offer owns the viewport
- [x] multiple offers use paging (dots + arrows, each dot its own target)
- [x] no old offer-list UI
- [x] no dominant facts table — every `FactRow` is inside the details sheet
- [x] agent line visible
- [x] stay/go clear
- [x] no invented contract facts — tested by word

## Build

```
npm run build   clean, every phase, before every commit
dist/index.html                 1.59 kB
dist/assets/index-*.css       107.45 kB  (gzip 19.90 kB)
dist/assets/index-*.js        951.02 kB  (gzip 255.10 kB)
```

`git diff --check` clean throughout.

## Known Issues

- The relegation scene's own generic footballer is still faintly visible behind the career player
  at 0.34 opacity and 2.5px blur. It reads as depth of field rather than as a person, but it is
  there; removing it would need artwork without a figure in it, which the pack does not have.
- At 320×568 the event decision and the offer's detail region each scroll **inside** their own
  region. The document does not scroll and nothing is clipped, but they are the two primary
  surfaces on that phone that are not literally one static screen. At 568px of viewport a
  four-choice event with odds bars has no arrangement that fits, and hiding a choice would be
  worse.
- The retirement **hero** is one screen; the retirement report below it is a career summary and
  scrolls, deliberately.
- The season-result and mid-season summary phases still document-scroll. They are reports rather
  than game states, and the brief's one-screen list does not include them.
- The relegation moment art contains red stadium lighting from the pack itself — carried from
  v0.9.1, now much dimmer as a side effect of the background treatment. Still supplied artwork,
  still not a player kit or prestige UI.
- The European standings screen remains unavailable for a season that began before v0.9.1.

## Deferred

- Matchday for European ties. `activeFixture` resolves them and the scoreboard would render them
  correctly; the reveal is still wired to the league beat and the cup final.
- A true domestic fixture calendar — still explicitly out of scope.
- Desktop-specific navigation and hero treatments; the layout remains mobile-first.
- Signing ceremony variants for loans and returns, which still share the arrival moment.

---

Phase commits, all on `main`:

```
cf58519  v0.9.3 phase 1 - fix match score orientation
cd1c449  v0.9.3 phase 2 - one-screen career home
de15c02  v0.9.3 phase 3 - one-screen matchday flow
ea40d46  v0.9.3 phase 4 - rebuild cinematic decision flow
ad8526c  v0.9.3 phase 5 - tighten major career moments
2573a3a  v0.9.3 phase 6 - simplify game information architecture
1186b69  v0.9.3 phase 7 - tighten typography and spacing
b416001  v0.9.3 phase 8 - one-screen mobile QA
         v0.9.3 - one-screen game flow (this commit)
```

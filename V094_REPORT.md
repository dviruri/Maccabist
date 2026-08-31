# Maccabist v0.9.4 — Club Identity / Final One-Screen Pass

## Executive Summary

Three goals, all met.

**The player looks like he plays for his club.** An outfield shirt is now the club's colour —
green at Maccabi Haifa, red at Hapoel Haifa, yellow at Maccabi Tel Aviv, maroon at Bologna, the
parent club's colour for a youth side. It is composited onto the existing character art through a
per-pose garment mask, so the shirt changes and the face, hair, arms, gloves, boots and the
football do not. There is no filter on the character anywhere.

**A goalkeeper looks like a goalkeeper.** Blue, pink, purple or black, chosen by a hash of
(seed, club, season) so it is the same colour on every screen for that season, and picked from
the two candidates that contrast most with his club's outfield primary.

**A cinematic moment features THAT player.** The art pack's moment images are complete scenes
with a generic footballer painted into them; v0.9.3 kept them behind the career player, dimmed
and blurred, which was still two footballers. Moments are now composed from layers that contain
no people — an empty stadium, confetti or star lights, a trophy — with the career player as the
only person in the frame.

**And the one-screen rule is finished.** 23 primary scenes across seven viewports — 320×568,
360×640, 360×800, 375×812, 390×844, 412×915, 430×932 — is 161 combinations, all clear.

The simulation is untouched and shown to be: a same-seed career (seed 5, balanced) reproduces the
baseline every release since v0.8 has quoted, exactly.

Three real defects were found by looking at screenshots rather than at numbers, and they are named
below.

## One-Screen Completion

### The moment that was not a moment

v0.9.3 made the arrival and the debut full-screen states and left the SEASON's moments where they
were: derived inside `PhaseView`, which renders in `.play-main`, inside the shell. `season_result`
is not one of the focused phases, so a championship arrived with the entire home screen stacked
above it and the bottom navigation below it — exactly the "home content + moment + nav + more
content below" the brief describes.

They are resolved in `GamePage` now, beside the ceremonies, and returned before the shell. One
headline, one subtitle, one button, no navigation.

Two layout bugs fell out of fixing it, both invisible until the scene was full-screen:

| bug | cause |
| --- | --- |
| **no width** | `.app` centres its child and `.shell` is what supplies the width, so a state returning before the shell had none. The championship rendered as a 240px column in the middle of a 390px phone with its subtitle wrapping into the button. The matchday had the same bug and hid it, because a scoreboard is wide enough to fill on its own. |
| **no height** | `min-height: min(72vh, 600px)` on the content box left 244px of black under a championship at 390×844: the scene stretched, the content did not. |

### Short heights

The aggressive tier moved from ≤620px to **≤660px**, because 360×640 is a real and common Android
and it fell in the gap: it got the ≤700 seam tightening and none of the content reduction, so the
home wanted 706px of a 640px phone.

At ≤660 the character narrows and the identity column widens — which is what gets the player's
name onto one line, ~30px back without touching a font size — and the status chips give way when
the contextual slot is occupied, scoped with `:has` so they stay when the slot is only showing the
feed.

One rule in that tier turned out to be doing nothing: `.gf-context-head` is defined *after* the
tier in the file, so at equal specificity the plain rule wins. The head fits at 320×568 anyway,
measured, so the rule is gone rather than reordered.

## Europe Compaction

Home shows a compact European status and nothing more:

```
אירופה                            לפרטים ›
הקונפרנס ליג · מקום 12
```

Competition, where he is in it, and a way to the rest. The entry route, every qualifying round,
the drop-downs, next season's route and the 36-club table all stay in the Europe sheet, which is a
scrolling destination and can afford them. Every value is the v0.9.1 separation's: `currentCampaign`
follows the recorded journey, so a club that fell from the Champions League to the Conference
League reads Conference League, and next season's route is not shown here at all because it is not
a present fact.

### One contextual panel

The home screen's answer to "what matters right now" is a single slot with a priority:

| priority | state | source |
| --- | --- | --- |
| 1 | an offer on the table | `pendingOffers` — the most urgent thing a career can hold |
| 2 | Europe | a recorded campaign this season |
| 3 | the people around him | the top one or two feed lines, agent first |

Only the winner renders, and the Europe **chip** drops out when the Europe **panel** is showing —
otherwise the screen said the competition in a chip and again in a panel three rows later.

Two new European moments, both derived from the settled record's own stored journey (historical
truth, not live world state):

- **qualification** — the first league phase a career ever reaches, off the engine's own deduped
  milestone. "העפלנו לשלב הליגה!"
- **knockout** — `furthest` in {ko_playoff, r16, qf, sf, final}, titled by stage, and **suppressed
  when he won the competition**, because the trophy moment is the same evening told better. Two
  scenes for one night is the mistake this phase removes.

No new gameplay: both read fields v0.8 already stores.

## Club Kit System

### One source of colour

`clubVisual` already answers "what colour is this club", already resolves `crestOwnerId`
inheritance and already backs every crest in the game. It answers here too — so a Maccabi Haifa
youth side wears its parent's green for exactly the same reason it wears its parent's crest, and
**no youth club is named anywhere in `ui/kit.ts`**. A test asserts that.

The two standalone regional academies (בית״ר קריות, עירוני הצפון) keep their own identity, because
they have no senior parent in this world — the same line v0.9.1 drew for their crests.

### The rule that changed

Up to v0.9.3 the rule was: no red player kit, no yellow player kit, ever. It is **superseded, not
relaxed**, by two narrower rules:

| | rule | asserted in |
| --- | --- | --- |
| OUTFIELD | the club's colours, reds and yellows included | `tests/clubKit.test.ts` |
| GOALKEEPER | blue, pink, purple or black — nothing else | `tests/clubKit.test.ts`, by hue |
| GAME CHROME | still no red in panels, prestige or buttons | `tests/playerArt.test.ts` |

The goalkeeper's is strictly the tighter of the two. And the chrome rule is unchanged: a club
colour arriving through `ui/kit.ts` is a fact about a club, whereas a red border in the stylesheet
would be a design choice.

### Strength, not tint

The recolour is a `screen` blend over the artwork's own black fabric. Screening a colour onto black
yields that colour; screening it onto a highlight yields a lighter version of it — so every fold,
seam and highlight survives and the result is cloth rather than a flat shape pasted over cloth.

`strength` is computed from the colour's own luminance rather than tuned per club, so a club added
later behaves correctly without being listed:

```
strength = clamp(1.05 - luminance * 0.5, 0.62, 0.95)

  PAOK      #1b1b1b   lum 0.106   0.95      near-black needs nearly all of it
  Hapoel    #c8102e   lum 0.292   0.905
  K. Shmona #1b4f9c   lum 0.283   0.909
  Hadera    #7b2d8e   lum 0.311   0.894
  Haifa     #0fa64a   lum 0.433   0.834
  MTA       #f4d03f   lum 0.793   0.654
  Tottenham #ffffff   lum 1.000   0.620     white restrained, or the fabric goes
```

A colour too dark to read (luminance < 0.17) gets a quiet second pass in the club's **own**
secondary, never a colour the club does not have.

## Garment Masks

There is no pixel information in the art pack saying which parts of a character are kit, so
`scripts/buildKitMasks.mjs` builds it once from the artwork itself. No image was regenerated and no
external service was called: there is no image library in this toolchain, but headless Chrome
decodes WebP and gives pixel access through a canvas (with `--allow-file-access-from-files`, or the
canvas is tainted and `getImageData` throws).

### The first attempt failed, and the preview said so immediately

The first classifier went purely by colour: skin is a warm `r > g > b` ramp, so everything opaque
and not-warm is kit. The player came out with **green hair and green knees**.

The reason is the art's own lighting. Every figure carries neon pink and blue rim light, and it
falls on skin as much as on fabric: a magenta-lit knee reads `(77,28,56)` and a magenta-lit shirt
reads `(136,50,205)`. No colour rule separates them, because they are the same light.

### What replaced it

Geometry decides **where** the kit is; colour only decides what to protect inside it.

- **include** — a torso polygon plus one capsule per sleeve. Capsules, because a bent arm is a
  segment with a radius and not an eight-point outline.
- **exclude** — the things inside that region which are not kit: a football, a bare forearm, a
  fist, a goalkeeper's glove.
- **skin** — still subtracted inside the region, as a safety net for the neck and a hand on a hip.
  It can only ever remove pixels, so a wide net is free.
- **morphology** — an asymmetric open (erode 3, dilate 2) deletes every structure thinner than the
  kernel: rim lights, eyes, teeth. A final intersection with the character's own alpha means
  dilation cannot escape the silhouette.

Coordinates are percentages read off a 5% grid rendered from the artwork itself
(`scripts/kitMaskGrid.html`, committed — without it the numbers in the `POSES` table are
unverifiable).

Ten masks, one per pose, 13.6–16.2 kB each, **145 kB total**.

### Imperfections, recorded honestly

- The **youth goalkeeper** mask leaves a faint rectangular corner at the shirt's lower right where
  the torso polygon ends. It reads as a kit panel rather than as an error.
- The **teen and youth outfield heroes** leave the shirt's right-hand panel dark where the bare
  forearm crossing it is excluded. The first radii were wider and ate more; they were tightened
  after inspection and the remainder reads as shading.
- **adult/goalkeeper-save** is the diving pose and the least precise trace of the ten. Face, ball
  and gloves are clean; the shirt's edge along the lower back is approximate.
- Shorts, socks and boots are **not** recoloured. The brief permits this and the masks are cleaner
  for it.

## Goalkeeper Kits

```
blue    #2a6ede    218°
pink    #e0489b    328°
purple  #7b3fd4    263°
black   #17171c    achromatic, luminance 0.09
```

Asserted **by hue**, not by the name of the key, so the palette cannot drift into the colours
v0.9.4 opened up for outfield shirts.

**Stable**, because the alternative has no identity: a keeper who is purple on the home screen,
blue at kickoff and pink in his career journey is not wearing a kit. Nothing is rolled — the colour
is `hash(seed, clubId, season, "gk-kit")`, which every screen recomputes to the same answer.

**Contrast first, then variety**: the two best-contrasting colours against the club's outfield
primary are found, and the hash picks between those two. So a green club never produces a
green-adjacent keeper and a blue club never produces a blue one, while two careers at the same club
in the same season can still differ. Luminance carries most of the contrast weight because that is
what separates two shirts at a glance; hue supplies the rest, and a club colour with no hue is
judged on brightness alone. Deliberately not kit-clash regulation.

Verified on the adult and youth goalkeeper poses in all four colours: faces, hair, gloves and
shorts untouched, the black kit lifted by its own secondary so it reads as dark grey with
highlights.

## Career Player Identity

Every character presentation in the game goes through **one component**, `PlayerRender`. There is a
test that fails if any component or page resolves player art for itself, because club recolouring
applied separately in five places is five chances for the same player to wear two different shirts.

Sites converted: the home hero, the matchday stage, the offer screen, every cinematic moment, the
retirement hero, and the share poster.

`:where(.pr)` gives the component's own `position` zero specificity on purpose. Every caller passes
its own class — `.gf-hero-art`, `.gf-md-art`, `.gf-dec-art`, `.gf-moment-player` — and those rules
are defined *earlier* in the stylesheet, so a plain `.pr { position: relative }` appended at the end
would have won at equal specificity and silently broken all four layouts.

## Major Moments

A moment is composed from layers that contain no people:

```
backdrop   an empty stadium: trophy ceremony, European night, matchday crowd, home dark
overlay    confetti, star lights, smoke
object     a trophy - a transparent object, not a scene
player     PlayerRender, the only person on the screen
```

The field is called `object` rather than `art` on purpose: the type will not accept a scene.

This trades some supplied artwork for correctness, exactly as the brief weighed it — the six
`moments/*.webp` and five `transfer/*.webp` images are no longer drawn anywhere. They are left in
the pack rather than deleted; `getMomentArt` and `getTransferArt` remain as the pack's resolvers and
a test asserts the moment path never calls them.

**The era, not today.** A moment carries its own `kitClubId` and `age`, from the settled record. A
championship won before a summer move is still that club's championship, and a debut at eighteen
shows the teen character for ever after.

**A moment that only celebrates is a liar.** `mood` is `celebration` or `hero`; a relegation night
gets no confetti and no celebration pose.

## Transfer / Signing Identity

The most important call in this release, and it is a product decision rather than a technical one:

- **during the offer** the player wears his **current** club's colours. He has not signed anything.
  Putting him in Torino's shirt while he is deciding whether to join Torino would tell him the
  decision was already made.
- **at the signing** — the arrival moment, which fires at the first preseason *after* the move — he
  is already in the new club's colours. That is the reveal the sequence exists for.

Both asserted, in both directions.

## Mobile QA

```
=== 320x568 ===  23/23 ok        === 390x844 ===  23/23 ok
=== 360x640 ===  23/23 ok        === 412x915 ===  23/23 ok
=== 360x800 ===  23/23 ok        === 430x932 ===  23/23 ok
=== 375x812 ===  23/23 ok

ALL CLEAR  (161 scene/viewport combinations)
```

Horizontal overflow, separately, on 16 real scenes × six widths: **zero**, with the `probe-canary`
failing at every width as the control.

### Three defects only screenshots could find

**The offer's headline was being cropped.** At 360×640 "הצעה מטורינו" read "הצעה".
`.gf-dec-hero` is a flex item in the detail column, so with space short it shrank below its own
content — and its `overflow: hidden`, which exists to crop the player's legs, cut 43px off the
headline. Measured: the headline wanted 122..296 and the hero stopped at 249. The hero never shrinks
now, and at short heights the league-and-country line goes, because it is already one of the chips
directly underneath.

**The matchday's history button sat on the moment.** At 320×568 the stage is 120px and a big moment
is three lines of display type, so the absolutely-placed "מה קרה במשחק" printed over the words. The
history stands down at short heights.

**The smoke was drowning the signing.** `green-smoke` at the shared 0.8 turned an arrival at Bologna
into a green screen with a maroon shirt somewhere in it — the club he had just joined was the
hardest thing to see. Confetti and star lights are sparse and keep their opacity; smoke fills the
frame, so it gets 0.45.

### Kits inspected by eye, in the game

Maccabi Haifa green, Hapoel Haifa red, Maccabi Tel Aviv yellow, Hapoel Hadera purple, Bologna
maroon, PAOK near-black, Tottenham white, a pink goalkeeper, an academy twelve-year-old in the
parent club's green. In every one: skin, face, hair, hands, gloves, boots and the football
untouched; fabric folds and highlights surviving; no flat pasted rectangle; crest and shirt in
agreement.

### Screens inspected

At 320×568 / 360×640 / 390×844 / 430×932: home (league, Europe, urgent offer, goalkeeper, youth,
red club, yellow club), matchday preview / live / full time, the offer screen, a championship, a
Conference League trophy night, a relegation, a debut, a signing, and the retirement hero.

## Tests

```
1177 passed / 1177    (65 files)     npm test, exit 0
```

1142 at the v0.9.3 baseline plus 35 new: `clubKit` (22, a new file), `oneScreen` (+8),
`majorMoments` (+4), `playerArt` (+1). `npm test` typechecks the test sources before vitest runs.

One new file and three extended:

| file | tests | what it holds |
| --- | --- | --- |
| `tests/clubKit.test.ts` | 22 | outfield colours come from `clubVisual` for seven representative clubs; red and yellow asserted as facts so the product change cannot silently revert; strength never gives a brighter colour more push than a darker one; a near-black club is lifted with its own secondary; five youth sides inherit exactly and the two standalone academies do not; goalkeepers are one of four colours by HUE across 60 seeds × 7 clubs × 3 seasons, stable per season, contrasting, still varied; every pose has a mask on disk derived from its art path; no filter on the character; only `PlayerRender` resolves character art; the offer uses `currentClubId` and never `offer.clubId`; the matchday render takes no venue input; the poster composites mask-then-colour-then-screen; the archive carries the seed |
| `tests/majorMoments.test.ts` | 14 | trophy nights carry a real trophy object; the era's club and age are used; the knockout moment fires for a quarter-final, stands down for a win, never fires on a summer that ended in qualifying; the league-phase moment needs the engine's milestone; neither the moment derivation nor the retirement page may reach for `getMomentArt`; `MomentShell` renders exactly one person |
| `tests/oneScreen.test.ts` | 39 | + season moments derived before the shell, `PhaseView` rendering no moment screen, a full-screen state having a width and a height its content uses, the slot picking one state in priority order, an offer outranking Europe, the Europe chip dropping when the panel shows |
| `tests/playerArt.test.ts` | 11 | + the palette invariant restated, and no hex literal in the art resolver |

Nothing was deleted or weakened.

### Assertions that caught my own work

1. **Phase 2** — the "no filter on the character" rule flagged its own comment saying *no
   hue-rotate*. It strips comments now.
2. **Phase 2** — a luminance ordering I had guessed wrong: Kiryat Shmona's blue (0.283) is very
   slightly darker than Hapoel's red (0.292). It asserts the *property* now, not my sequence.
3. **Phase 2** — a v0.9.3 assertion named the `max-height: 620px` tier that Phase 1 renamed to 660.
   That failure was real and I shipped it: the phase-1 focused run happened before the last CSS
   change of that phase.
4. **Phase 1** — the "otherwise the feed" case was testing the engine rather than the priority: a
   Maccabi Haifa career in 2046 really does have a European campaign. It clears Europe explicitly.
5. **Phase 4** — matching `playerArt` across a whole file hit the `ui/playerArt` import path. It is
   scoped to `MomentShell`'s own body now.

## Regression

Same-seed career, seed 5, balanced — `npx vite-node scripts/sameSeedRegression.ts`:

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

Identical to v0.8, v0.9, v0.9.1, v0.9.2 and v0.9.3.

The only non-presentation edit in the whole release is `ArchivedCareer.seed` — optional, additive,
presentation-only, written by `buildArchivedCareer` from `career.seed` and read by exactly one
thing: the share poster, so a retired goalkeeper keeps the shirt his career was played in.
`SCHEMA_VERSION` is unchanged. No simulation rule, probability or balance value moved.

### Previous fixes verified

- [x] Home / Matchday same fixture — `tests/fixture.test.ts`, 60 seeds
- [x] score orientation correct — `tests/matchScore.test.ts`
- [x] RTL does not reverse football semantics — the scoreboard's grid row is asserted
- [x] cup final only at end of season — `tests/seasonSequencing.test.ts`, 30 seeds
- [x] Matchday remains one-screen — four states, all seven viewports
- [x] decisions remain one-screen — offer and event, all seven viewports
- [x] Europe `currentCampaign` / `nextSeasonRoute` remain separate — `tests/europeStatus.test.ts`
- [x] parent crest inheritance works — `tests/crestInheritance.test.ts`, and the kit inherits with it
- [x] Career Feed variety preserved — `tests/careerFeed.test.ts`
- [x] signing / debut moments work — and now show the right kit and the right age band
- [x] European standings work — in the Europe sheet, behind the compact card
- [x] bottom navigation works — five destinations, one each
- [x] old saves load — hydration suites pass unchanged; `SCHEMA_VERSION` untouched
- [x] archives load — `tests/archive.test.ts`; `seed` is optional so pre-v0.9.4 archives are fine

### New v0.9.4 invariants

- [x] Home with active Europe fits one viewport — `gf-play-home-euro`, all seven
- [x] European major moment fits one viewport — `gf-moment-uefa`, all seven
- [x] no primary gameplay state requires document scroll at 390×844 — 23 of 23
- [x] outfield shirt reflects current club
- [x] youth outfield shirt reflects parent club branding
- [x] goalkeeper uses blue/pink/purple/black only — asserted by hue
- [x] goalkeeper kit is stable throughout the season
- [x] no whole-character colour filter — asserted in source and CSS
- [x] skin / hair remain natural — verified by eye at zoom on ten poses
- [x] major moments feature the career player
- [x] GK moment uses GK — the resolver never falls back to outfield art
- [x] youth moment uses youth — the moment carries the era's age
- [x] current club colours are correct — seven families inspected in the game
- [x] transfer offer shows CURRENT club colours
- [x] signing after acceptance shows NEW club colours

## Build

```
npm run build   clean, every phase, before every commit
dist/index.html                 1.59 kB   (gzip  0.66 kB)
dist/assets/index-*.css       109.42 kB   (gzip 20.24 kB)
dist/assets/index-*.js        958.28 kB   (gzip 257.17 kB)

garment masks                 145 kB total, 10 files
```

`git diff --check` clean throughout.

## Known Issues

- The garment-mask imperfections listed under **Garment Masks**: a rectangular corner on the youth
  goalkeeper, a dark right-hand panel on the teen and youth outfield heroes, and an approximate
  lower-back edge on the diving goalkeeper. Face, hair, arms, gloves and the football are clean in
  all ten poses; these are shirt-edge inaccuracies, which the brief accepts.
- Shorts, socks and boots keep the artwork's own black. Only the shirt and its sleeves are
  recoloured.
- At **320×568** two primary surfaces scroll **inside their own region**: the event decision's
  choice list and the offer's detail column. The document does not scroll and nothing is clipped —
  the offer's region now fades at its foot to say so — but at 568px of viewport a four-choice event
  with odds bars has no arrangement that fits, and hiding a choice would be worse. Carried from
  v0.9.3 and still true.
- The matchday's moment history is unavailable at heights ≤660px, because its button collided with
  the moment text it annotates.
- The **season-result and mid-season summary** phases still document-scroll. They are reports rather
  than game states, and the brief's one-screen list does not include them.
- The six `moments/*.webp` and five `transfer/*.webp` images are no longer drawn anywhere. They
  remain in `public/`, so the deployed bundle carries 916 kB of unused artwork (836 kB of moments,
  80 kB of transfer scenes). Deleting supplied art felt like the wrong call to make silently.
- A club's **name** on the home screen renders in the Maccabist green accent even when the club
  plays in red. That is the chrome palette rule holding, deliberately, but it does mean the text
  colour and the shirt colour differ.
- The **retirement report** below the hero is a career summary and scrolls, deliberately.
- The European standings screen remains unavailable for a season that began before v0.9.1.

## Deferred

- Matchday for European ties. `activeFixture` resolves them and the scoreboard would render them
  correctly; the reveal is still wired to the league beat and the cup final.
- A true domestic fixture calendar — still explicitly out of scope.
- Desktop-specific navigation and hero treatments; the layout remains mobile-first.
- Signing ceremony variants for loans and returns, which still share the arrival moment.
- Recolouring shorts and socks, which would need a second mask per pose and gains little.
- A per-club **secondary** trim on the shirt (a stripe or a collar in the club's second colour).
  The palette carries `secondary` and only the very dark clubs use it today.

---

Phase commits, all on `main`:

```
307b0c7  v0.9.4 phase 1 - finish one-screen gameplay flow
d8ccccc  v0.9.4 phase 2 - add club-coloured player kits
b1fa6ac  v0.9.4 phase 3 - deterministic goalkeeper kits
0b43f5b  v0.9.4 phase 4 - personalize cinematic career moments
223c929  v0.9.4 phase 5 - integrate club identity across career UI
b77ac0f  v0.9.4 phase 6 - final primary-screen compaction
495b13e  v0.9.4 phase 7 - mobile and kit visual QA
         v0.9.4 - club identity and final one-screen pass (this commit)
```

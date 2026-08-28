# Maccabist v0.4.7 — Mobile Gameplay Density & Club Identity Pass

**Scope:** make the game feel designed for a phone rather than adapted to one, and give the world
richer club identity.

**Result:** build passes, **579 tests** pass (from 554 at the end of v0.4.6). At 390px the active
decision moved from y=1155 to y=334, and the first pressable choice from y=1454 to y=645 — inside
one viewport. **No engine, event or type file was touched.**

---

## 1. Build status

```
npm run build                           PASSES
npx tsc -p tsconfig.test.json --noEmit  PASSES
```

## 2. Tests

```
npm test        579 passed   (554 at the end of v0.4.6)
```

| new test file | tests | what it pins |
|---|---|---|
| `tests/crests.test.ts` | 13 | every club resolves a badge; no crest is ever an external URL |
| `tests/seasonStrip.test.ts` | 12 | which sentence a league situation produces; current club outranks Maccabi |

## 3. v0.4.6 baseline, measured

```
build PASSES   554 tests   130 events
390px gameplay screen:   event begins y=1155    first choice y=1454    total 1765px
360px gameplay screen:   event begins y=1175    first choice y=1504    total 1814px
```

That is 1.37 viewports of scrolling before the event begins and 1.72 before the player can press
anything.

---

## 4. Main gameplay layout, before and after

**Before.** `GamePage` rendered an `aside` of secondary panels before the `main` column. On a
desktop that is a sidebar; `.game-layout` is only a two-column grid inside a media query, so on a
phone it collapses and the aside becomes four screens of dashboard stacked on top of the event:

```
topbar → Player Hub (~330px) → full league table (~370px) → career timeline
       → season history (~160px) → season-phase strip (~55px) → EVENT
```

**After.** The order is the loop itself:

```
slim topbar → CompactHub → SeasonStrip → EVENT → nav row
                                                 ↳ טבלה | סיפור הקריירה | הקריירה  (sheets)
```

Nothing was deleted. The full Player Hub, the full table, the timeline and the season history are
all still reachable, in bottom sheets, one tap away.

## 5. Player Hub compact redesign

`src/components/CompactHub.tsx`. Same information, about a third of the height:

- ability sits **beside** the identity instead of under it, which is where most of the saved height
  comes from — it is still 38px and still the biggest number in the block
- the three secondary metrics are one labelled row (`אמון 81 · מכביסטיות 72 · מוניטין 63`) rather
  than three ring widgets
- role, captaincy and legacy are tags on one wrapping line
- a loan is a tag — `בהשאלה ממכבי חיפה` — where the old hub needed a whole extra line
- the club crest identifies the club before the text is read

The whole block is one button that opens the career sheet, so the full hub is a tap away.

**Dense, not small.** Nothing in the new CSS is under 10px, and the two smallest sizes are the
ability label and the tag text. `--text-micro` and above carry everything a player reads to make a
decision.

## 6. Season Strip

`src/components/SeasonStrip.tsx`. One line, and it answers what the table *means* rather than what
it says:

```
7   ליגת העל · מחזור 22/26 · מחצית שנייה        [טבלה]
    4 נק׳ מאירופה
────────────────────────────────────────────────────────
💚 מכבי חיפה   מקום 1                        ליגת העל
```

Derived from the same authoritative `leagueContext` the events are gated on, so the strip and the
event pool cannot disagree — if it says title race, a title-race event can fire.

The season-phase strip that used to be its own 55px module is now one word inside this line. It
still renders separately for academy careers, which have no league table.

### 6.1 A drop-zone fix the screenshots found

Union SG were shown 16th of 16 with the strip reading **"מתחת לציפיות"**. `relegationBattle` is a
*race* test — close enough on points, with enough season left — and a club cut adrift at the bottom
fails it. True, and absurd.

Being in the drop zone is a fact about the position, not about the gap, so it is now checked before
the race tests: `8 נק׳ מתחת לקו` when the gap is small enough to name, `בתוך מקומות הירידה` when
it is not. Pinned across every relegation position in a division.

### 6.2 Maccabi hierarchy (Phases 3.2, 3.3, 32)

Maccabi appears as a quieter row underneath, with a smaller crest, smaller type and a muted
background — and **only when the player is somewhere else**. At Maccabi the strip already *is* the
Maccabi season; the parallel projection is dropped at source in `openWorldSeason`, so there is
nothing for a component to hide. `tests/seasonStrip.test.ts` asserts that at source rather than in
the render.

## 7. Full table as progressive disclosure

`src/components/Sheet.tsx` — a modal bottom sheet. Deliberately **not** gesture-driven: a
drag-to-dismiss that fights the browser's own scrolling is an Android reliability problem, and the
brief is explicit that a simple sheet beats a fragile clever one. What it does provide:

- scrolling inside the sheet with the page behind it locked, and `overscroll-behavior: contain` so
  a flick at the end of the list does not scroll the gameplay screen underneath
- Escape, backdrop tap and a 44px close button
- focus moved in on open and restored on close
- `env(safe-area-inset-bottom)` respected
- `role="dialog"` + `aria-modal`, labelled by its own title

The table inside gains `inSheet`, which suppresses its own league heading — the sheet header
already names the league and the round, and printing both is the screen saying one thing twice.

## 8. Timeline and history relocation

Both moved into sheets, reached from the nav row. The timeline keeps the v0.4.5.1 visual design
untouched. The career sheet holds the full Player Hub and the season history together, which is
where a player who wants to study himself actually wants them.

## 9. Event density

The match strip took three iterations, because the first two were denser and *less readable* —
which is the trade this version is explicitly not supposed to make.

1. Two stacked rows naming the player's own club, its position, the opponent, and a stakes line.
2. One row with crests: truncated the clubs to `מכבי חי...` and `הפ...` at 360px.
3. **Final:** the two sides stack, the stakes badge takes its own row, and the player's own
   position pill is gone because the season strip directly above shows it as the largest number on
   the screen. Both club names render in full at 320px.

```
88׳   🛡 מכבי חיפה
      🛡 הפועל חיפה  12
      [דרבי חיפה]
```

## 10. Decision density

The choice block already had the right structure — a visible valence bar with the concrete outcomes
collapsed. What was missing was the *size*: the bar showed that a choice was mostly green without
saying whether that was 55% or 85%, which is the judgement being asked.

```
לבעוט
סיכון בינוני · פוטנציאל גבוה
🟢 63%  🔴 37%   ▓▓▓▓▓▓▓▓░░░░
מה יכול לקרות?
```

The three figures are a **summary** and replace nothing: v0.4.6's concrete outcome descriptions are
still the only thing the expansion contains, and still available before choosing. The emoji is
decoration; a visually-hidden word (`טוב` / `ללא שינוי` / `רע`) carries the meaning for a screen
reader and for anyone who cannot tell the colours apart.

The expansion is labelled `מה יכול לקרות?` rather than `הצג סיכויים`, because the player is not
asking for numbers.

## 11. Sticky actions

Not implemented, and deliberately. With the first choice now at y=645 on a 390px phone and the
whole ordinary decision inside about 1,020px, a sticky footer would occupy permanent height to
solve a scroll problem that no longer exists — and the brief warns against giant sticky footers.
The sheets do respect `safe-area-inset-bottom`, which is where the real risk was.

Listed in §21 as deferred, because a long narrative event on a 320×568 screen would still benefit.

## 12. Scroll-depth comparison

| | v0.4.6 | v0.4.7 | change |
|---|---|---|---|
| 390px — event begins | 1155px | **334px** | −71% |
| 390px — first pressable choice | 1454px | **645px** | −56% |
| 390px — total page height | 1765px | 1058px | −40% |
| 360px — event begins | 1175px | **334px** | −72% |
| 360px — first pressable choice | 1504px | **675px** | −55% |

## 13. One-viewport testing

First pressable choice against each device's actual viewport height:

| viewport | choice at | inside one viewport? |
|---|---|---|
| 320 × 568 | 701px | no — 1.23 viewports |
| 360 × 740 | 675px | **yes** |
| 375 × 812 | 645px | **yes** |
| 390 × 844 | 645px | **yes** |
| 412 × 915 | 645px | **yes** |
| 430 × 932 | 645px | **yes** |

Other scenarios at 390px: title race 528px, abroad 585px, academy 600px, four-outcome expanded
308px.

---

## 14. Club crest architecture

`getClubCrest(clubId)` is the single place a crest path is resolved (Phase 16). It returns a
repo-local path or null, and **fails closed for anything starting `http:`/`https:`** — an external
URL in that field degrades to the generated badge rather than shipping a hotlink.

Sizes are tokens with one bounding box each, and a real asset gets `object-fit: contain` in the
same box so a wide banner and a tall shield cannot distort to match:

| token | px | used in |
|---|---|---|
| `xs` | 14 | dense rows |
| `small` | 18 | league table, match strip, Maccabi line |
| `medium` | 26 | compact hub, transfer offer |
| `large` | 44 | career moments, retirement |

Fallback: `ClubCrest` tracks load failure in state and re-renders the generated badge. My first
version replaced the `<img>` with an HTML comment on error, which is not a fallback — it is a hole
where the crest was.

## 15. Israeli crest coverage

**All 20 modelled Israeli clubs: declared colours, generated fallback badge, no real asset.**
Full per-club table in `CLUB_CRESTS.md` §3.

ליגת העל (10): `maccabi_haifa`, `maccabi_tel_aviv`, `hapoel_beer_sheva`, `beitar_jerusalem`,
`hapoel_tel_aviv`, `maccabi_netanya`, `bnei_sakhnin`, `ironi_kiryat_shmona`, `hapoel_haifa`,
`hapoel_hadera` — all ✅ colours, all fallback badge.

הליגה הלאומית (10): `hapoel_petah_tikva`, `hapoel_afula`, `hapoel_ramat_gan`, `hapoel_nof_hagalil`,
`maccabi_herzliya`, `hapoel_kfar_saba`, `hapoel_rishon`, `sektzia_nes_tziona`,
`hapoel_umm_al_fahm`, `maccabi_kabilio_jaffa` — all ✅ colours, all fallback badge.

## 16. European crest coverage

**All 13 modelled European clubs gained declared colours in v0.4.7.** Before this they fell through
to a hash palette, so a career abroad had a badge whose colour meant nothing.

`benfica`, `atletico`, `napoli`, `dortmund`, `tottenham`, `bologna`, `brighton`, `werder_bremen`,
`getafe`, `az_alkmaar`, `paok`, `union_sg`, `sturm_graz` — all ✅ colours, all fallback badge.

**33 of 33 senior clubs have declared colours. 0 have real crest assets. 0 render broken.**

## 17. Crest licensing and source notes

**No real crest is bundled, and this is a licensing finding rather than a technical one.** The full
research is in `CLUB_CRESTS.md` §1. Summary:

- Israeli club crests are **not on Wikimedia Commons**. The one promising hit,
  `File:Haifa logo official apperence dark (cropped).png`, is the **University of Haifa**.
- On Wikipedia they carry [`Template:Non-free logo`](https://en.wikipedia.org/wiki/Template:Non-free_logo),
  whose own guidance states copyrighted logos are for "one namespace article… specifically in the
  infobox" and that they "**cannot be used as icons**". A crest beside a table row is an icon.
- `PD-textlogo` does not apply: these are pictorial works — Beitar's menorah, Hapoel's emblem — and
  since *Interlego v. Exin-Lines* Israel applies a US-style originality test they clear comfortably.
- They are **trademarks** besides, and copyright licensing never conveys trademark rights. Commons
  says so on its own free files.

Acceptance criteria 24–26 say "real locally stored crests **where safely sourced, otherwise clear
fallbacks**". This is the fallback branch, taken deliberately and documented so it can be revisited
if crests are obtained through a route that permits it — a club licence, a commission, or an
original set. `CLUB_CRESTS.md` §4 is the entire integration: one file, one field, one doc row.

## 18. Total local crest asset size

```
public/club-crests/    0 files, 0 bytes
```

Every crest is inline SVG generated at render time from ~40 bytes of colour and initials per club.
No image request, no cache, nothing to optimise. **No hotlinking** — asserted by test.

---

## 19. Mobile widths tested

320 / 360 / 375 / 390 / 412 / 430 px.

**32 gallery scenes × 6 widths, zero overflow**, with the probe re-validated against its 600px
canary immediately afterwards — a clean sweep from an unverified tool is worth nothing.

One harness fix, the same class as the v0.4.5 false positive: a bottom sheet is `position: fixed`
and resolves against the viewport, not the gallery's pinned body width, so the first sheet
screenshot showed club names cut off at the right edge and looked exactly like a layout bug. The
harness now pins fixed UI too — with *physical* `left`/`right`, because the document is RTL and a
logical inset anchors to the wrong edge.

## 20. RTL

Every new module uses logical properties (`inset-inline`, `padding-inline`, `border-block-start`).
Mixed content verified in screenshots:

- long Latin club names in Hebrew lines — `יוניון סן ז׳ילואז`, `נאפולי` (both render in full)
- season format `2043/44` inside an `Ltr` isolate in the slim topbar
- round format `22/26` and gaps `4 נק׳ מאירופה`
- `→` in a loan header, pointing the right way for reading order
- percentages `63%` beside Hebrew labels in the odds summary

The one place the harness got RTL wrong was the harness itself (§19), which is documented rather
than quietly fixed.

## 21. Accessibility

- Contrast unchanged from v0.4.5.1's measured AA pass; no token was lowered. The smallest new type
  is 10px (ability label, tags), and everything a player reads to decide is `--text-micro` (11px)
  or larger.
- Touch targets: nav buttons 44px, sheet close 44px, season strip 52px, odds expansion 40px, the
  whole compact hub is one large button.
- The odds summary's meaning is carried by a visually-hidden word, not by colour or emoji.
- Table zones keep their v0.4.6 labels (`אליפות` / `אירופה` / `עלייה` / `ירידה`) alongside colour.
- Sheets: `role="dialog"`, `aria-modal`, labelled, focus moved in and restored, Escape closes.
- `prefers-reduced-motion` disables the sheet animations.

## 22. Performance

The sheets render **nothing at all** while closed — `if (!open) return null` — so a fourteen-row
table and a full career timeline are not mounted during ordinary play. That is a straight reduction
against v0.4.6, which mounted both on every gameplay frame.

Crests are inline SVG with no network request. Real assets, if ever added, carry `loading="lazy"`
and `decoding="async"`.

Total page height at 390px fell 40%, which is proportionally less DOM.

## 23. Screens inspected

`gameplay`, `gameplay-away`, `play-academy`, `play-abroad`, `play-title`, `play-relegation`,
`play-gk`, `play-longname`, `odds`, `decision`, `four-outcomes`, `sheet-table`, `sheet-timeline`,
`loan-offer`, `offers`, `midseason`, `season`, `season-memorable`, `retirement`,
`retirement-modest`, `new-career`, `origin-prodigy`, `origin-rejected`, `hub-senior`, `hub-loan`,
`reveal`, `outcome`, `sami-legend`, `news`, `timeline`, `table-full`, `crests`, `ladder-early`.

Phase 46 scenarios A–O all covered.

## 24. Engine regression

**No engine, event or type file was modified.** Verified rather than asserted:

```
git diff --stat 222835c..HEAD -- src/game src/data/events src/types
(empty)
```

The only non-component change is `src/data/clubVisuals.ts` (colour data) and
`src/main.tsx` (one CSS import).

## 25. Simulation sanity results

4,000 careers per strategy, plus 3,000-career coherence metrics.

| | v0.4.6 | v0.4.7 |
|---|---|---|
| INVALID natural-stage repeats | 0 | **0** |
| reached Maccabi senior team | 67.8% | 66.7% |
| early academy promotion | 16.6% | 16.0% |
| became captain | 14.3% | 14.5% |
| played abroad | 37.7% | 37.6% |
| returned to Maccabi | 21.6% | 20.9% |
| avg peak ability | 81.4 | 81.3 |
| avg Legend Score | 44.3 | 43.8 |

Differences are sample-size noise — v0.4.6's figures come from 14,000 careers per strategy and
these from 4,000 — and no engine code changed, so they cannot be anything else.

**Coherence metrics, all required to be zero:**

```
club season with no table position                 0
final position outside the division                0
outcome the final position does not produce        0
```

**Role distribution unchanged** (v0.4.6 figures in brackets):

```
per senior season   squad 5.7 (5.7)  rotation 12.9 (12.9)  starter 16.5 (16.5)
                    key 38.6 (38.8)  star 26.4 (26.0)
by club level       strong 30.1% star (29.8)   mid 38.0% (37.4)   weak 13.5% (13.4)
careers ever star   63.2% (62.5)     downgrades 14.3% of transitions (14.3)
```

**Every gated event still reachable**, at rates unchanged from v0.4.6:

```
sen_derby_moment   29.7%      wrl_title_race          21.3%
youth_derby_youth  16.9%      wrl_relegation_battle   17.8%
vt_final_derby      3.2%      wrl_promotion_race      13.3%
sen_title_run_in    5.4%      spon_last_minute        17.2%
```

---

## 26. Known issues

**The 320×568 screen still needs a short scroll** to reach the first choice (701px against a 568px
viewport, 1.23 viewports). Every other target width fits. Chasing it further would mean cutting
narrative or shrinking type, which the brief rules out.

**No sticky action bar.** Justified in §11 for the ordinary loop; a long narrative event on the
smallest screen would still benefit.

**The season strip's league line truncates on the longest league names** — `ליגת העל הבלגית · מחזור
26/30 · מחצי…`. The phase is the least important element and truncates last, which is the correct
priority, but it does truncate.

**No real crest assets**, for the licensing reasons in §17. This is the largest gap against the
brief's literal ask and the one I am least able to close from here.

**`spon_form_slump` and `gk_form_slump`** now both exist, but the goalkeeper variant was written in
v0.4.6 and has not been through a content review pass.

**The gallery's `play-*` scenes force a `pendingEventIds`** rather than going through eligibility,
so a screenshot showing an event is not evidence that event is eligible in that state. The
coherence metrics are the evidence for that.

## 27. Deferred work

- Sticky bottom action bar for long events on small screens
- Swipe-to-dismiss on sheets (currently tap/Escape/backdrop only)
- Crest assets, if a licensing route opens
- A season-history sheet distinct from the career sheet, if the combined one grows
- Content review of `gk_form_slump`

## 28. Recommended v0.5 direction

Not implemented, and stated only as a recommendation.

The interface now has room it did not have before: the gameplay loop occupies roughly 1,000px where
it used to occupy 1,765px, and there are three sheets with nothing competing for their space. That
is the natural home for what v0.5 was always going to need — **people**.

A coach with a name and an opinion, a teammate who is either a rival or an ally, an agent who
sometimes lies. v0.4.6 already left the architecture ready: `MatchContext` carries a real opponent
club id, `ClubVisual` resolves any club to an identity, and `eventClaims` scopes a rule to an
event's declared conditions, so a `speakerId` on an outcome slots into the same pattern without a
rewrite.

The one thing I would do first is give the compact hub a **fourth line that changes** — today's
training, this week's opponent, what the manager said. The loop is fast now; what it lacks is a
reason to open the game twice in a day.

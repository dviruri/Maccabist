# Club crests — sources, status and licensing

**Status: every club in Maccabist uses a generated fallback badge. No real club crest is bundled.**

This document exists because v0.4.7 was asked to add real crests "where safely possible", and the
honest answer after checking is: not for these clubs, not from these sources. What follows is the
research, so the decision can be re-examined rather than taken on trust.

---

## 1. What was checked

| question | answer |
|---|---|
| Are Israeli club crests on Wikimedia Commons? | No. Commons accepts only freely-licensed or public-domain files, and these crests are not there. A search that looked promising — `File:Haifa logo official apperence dark (cropped).png` — turned out to be the **University of Haifa**, not the football club. |
| Are they on English Wikipedia? | Yes, under [`Template:Non-free logo`](https://en.wikipedia.org/wiki/Template:Non-free_logo) with per-article fair-use rationales. |
| Does that rationale permit this use? | **No.** [Wikipedia's logo guidance](https://en.wikipedia.org/wiki/Wikipedia:Logo_Copyright/Trademark) states copyrighted logos are for "one namespace article… specifically in the infobox", and that "copyrighted logos cannot be used as icons". A crest beside a table row is an icon. |
| Would `PD-textlogo` apply? | No. That template covers logos "consisting only of simple geometric shapes or text". Israeli club crests are pictorial — Beitar's menorah, Hapoel's emblem, Maccabi Haifa's device — and since [*Interlego v. Exin-Lines*](https://commons.wikimedia.org/wiki/Commons:Threshold_of_originality/Asia/en) Israel applies a US-style originality test that these clear comfortably. |
| Trademark? | Separately and additionally yes. Even a *freely licensed* image carries Commons' own warning that "this work includes material that may be protected as a trademark… you have to ensure that you have the legal right to do so." Copyright licensing never conveys trademark rights. |

**Conclusion.** Downloading these files would mean bundling copyrighted, trademarked artwork into a
game under a rationale that explicitly excludes this use. The brief's own instruction — "use only
assets whose source/status is reasonably understood" — points the same way. So the crest
*architecture* is complete and drop-in ready, and the *assets* are the project's own.

This is a licensing finding, not a technical limitation. If crests are obtained through a route
that does permit it — a licence from the clubs, an artist commission, or an original set — §4 below
is the entire integration.

---

## 2. What is shipped instead

An original SVG shield per club, drawn from two things that are facts rather than artwork:

- **the club's colours**, used the same way its name is
- **its initials**

`src/data/clubVisuals.ts` holds one `ClubVisual` per club. `src/components/ClubCrest.tsx` draws it.
Nothing is fetched, so a badge cannot be broken, missing, or slow.

The shield outline is deliberately not any real club's silhouette.

---

## 3. Coverage

### ליגת העל — 10 modelled clubs

| club | clubId | colours declared | crest asset |
|---|---|---|---|
| מכבי חיפה | `maccabi_haifa` | ✅ green / white | generated fallback |
| מכבי תל אביב | `maccabi_tel_aviv` | ✅ yellow / blue | generated fallback |
| הפועל באר שבע | `hapoel_beer_sheva` | ✅ red / black | generated fallback |
| בית״ר ירושלים | `beitar_jerusalem` | ✅ yellow / black | generated fallback |
| הפועל תל אביב | `hapoel_tel_aviv` | ✅ red / white | generated fallback |
| מכבי נתניה | `maccabi_netanya` | ✅ yellow / blue | generated fallback |
| בני סכנין | `bnei_sakhnin` | ✅ red / white | generated fallback |
| עירוני קריית שמונה | `ironi_kiryat_shmona` | ✅ blue / white | generated fallback |
| הפועל חיפה | `hapoel_haifa` | ✅ red / white | generated fallback |
| הפועל חדרה | `hapoel_hadera` | ✅ purple / white | generated fallback |

### הליגה הלאומית — 10 modelled clubs

| club | clubId | colours declared | crest asset |
|---|---|---|---|
| הפועל פתח תקווה | `hapoel_petah_tikva` | ✅ blue / white | generated fallback |
| הפועל עפולה | `hapoel_afula` | ✅ green / white | generated fallback |
| הפועל רמת גן | `hapoel_ramat_gan` | ✅ red / black | generated fallback |
| הפועל נוף הגליל | `hapoel_nof_hagalil` | ✅ orange / white | generated fallback |
| מכבי הרצליה | `maccabi_herzliya` | ✅ blue / yellow | generated fallback |
| הפועל כפר סבא | `hapoel_kfar_saba` | ✅ green / white | generated fallback |
| הפועל ראשון לציון | `hapoel_rishon` | ✅ red / yellow | generated fallback |
| סקציה נס ציונה | `sektzia_nes_tziona` | ✅ blue / white | generated fallback |
| הפועל אום אל פחם | `hapoel_umm_al_fahm` | ✅ green / black | generated fallback |
| מכבי קביליו יפו | `maccabi_kabilio_jaffa` | ✅ orange / black | generated fallback |

### European clubs the transfer engine actually uses — 13 modelled clubs

All gained declared colours in v0.4.7; before that they fell through to a hash palette, so a
career abroad had a badge whose colour meant nothing.

| club | clubId | colours | crest asset |
|---|---|---|---|
| בנפיקה | `benfica` | ✅ red / white | generated fallback |
| אתלטיקו מדריד | `atletico` | ✅ red / white | generated fallback |
| נאפולי | `napoli` | ✅ sky blue / white | generated fallback |
| דורטמונד | `dortmund` | ✅ yellow / black | generated fallback |
| טוטנהאם | `tottenham` | ✅ white / navy | generated fallback |
| בולוניה | `bologna` | ✅ maroon / blue | generated fallback |
| ברייטון | `brighton` | ✅ blue / white | generated fallback |
| ורדר ברמן | `werder_bremen` | ✅ green / white | generated fallback |
| חטאפה | `getafe` | ✅ blue / white | generated fallback |
| AZ אלקמאר | `az_alkmaar` | ✅ red / white | generated fallback |
| PAOK סלוניקי | `paok` | ✅ black / white | generated fallback |
| אוניון סן-ז׳ילואז | `union_sg` | ✅ yellow / blue | generated fallback |
| שטורם גראץ | `sturm_graz` | ✅ black / white | generated fallback |

### Filler clubs

The league-table filler clubs (`src/data/leagueShape.ts`) have names and a quality number only.
They get a deterministic palette derived from their id, so the same filler club always has the same
badge in the table, in a transfer offer and in a season summary — a badge that changed between
screens would be worse than no badge.

**Totals: 33 modelled clubs, 33 with declared colours, 0 real crest assets, 0 broken.**

---

## 4. How to add a real asset later

The architecture is one field and one function.

1. Put the file in `public/club-crests/<clubId>.svg` — SVG preferred, transparent PNG otherwise.
2. Add `asset: 'club-crests/<clubId>.svg'` to that club's record in `src/data/clubVisuals.ts`.
3. Add a row to §3 above with the source page, licence, retrieval date and any trademark caveat.

That is the whole integration. `getClubCrest(clubId)` is the only place a crest path is resolved,
so nothing in the UI changes — and if an asset ever has to be removed, it comes out of one record
and every screen falls back to the generated badge automatically.

**Guards already in place:**

- `getClubCrest` returns `null` for anything starting `http:` or `https:`, so an external URL in
  that field fails closed to the generated badge rather than shipping a hotlink.
- `ClubCrest` tracks load failure in state and re-renders the generated badge, so a wrong path or
  an undeployed file degrades to a working crest rather than a broken-image icon.
- `tests/crests.test.ts` asserts both, and asserts that no `asset` value is an external URL.

---

## 5. Asset footprint

```
public/club-crests/    0 files, 0 bytes
```

Every crest in the game is inline SVG generated at render time from ~40 bytes of colour and
initial data per club. There is no image request, no cache, and nothing to optimise.

# Hebrew copy audit — v0.9.6.2

A review of every player-facing Hebrew string in the game: 115 files carrying Hebrew, 4,441 lines
containing it.

The headline finding is that the game's Hebrew is **good**. It is written, not translated — the
event prose in particular reads like someone who has stood on the touchline at an Israeli academy.
Almost nothing needed rewording for style, and nothing was reworded for style alone.

What did need fixing was mechanical: **Hebrew that is assembled at runtime**. Three helpers already
existed for exactly these problems — `inCompetition`, `countLabel`, `withHebrewPrefix` — and the
bugs are all in places that either did not call them or called the wrong one. Every correction
below is a grammar, terminology or truth fix; none is a change of voice.

## Changes

| File | Before | After | Reason |
|---|---|---|---|
| `src/data/events/academyEvents.ts` | `חריצה מאוחרת על שחקן מפתח, ושיעור בחדר ההלבשה` | `כניסה מאוחרת בשחקן מפתח, ושיעור בחדר ההלבשה` | unnatural Hebrew — `חריצה` is not a football word |
| `src/data/events/academyEvents.ts` | `נכנסת מאוחר בחריצה על שחקן מפתח.` | `נכנסת מאוחר בשחקן מפתח.` | unnatural Hebrew; `בחריצה` was also redundant beside `נכנסת מאוחר` |
| `src/game/identity.ts` | `withHebrewPrefix('ל','הפועל באר שבע')` → `לפועל באר שבע` | `להפועל באר שבע` | grammar — the ה of a club name is part of the name, not an article |
| `src/game/identity.ts` | `המבורג`→`למבורג`, `הופנהיים`→`לופנהיים`, `האל סיטי`→`לאל סיטי`, `היידנהיים`→`ליידנהיים`, `הרקליס`→`לרקליס` | `להמבורג`, `להופנהיים`, `להאל סיטי`, `להיידנהיים`, `להרקליס` | grammar — 37 clubs affected; transliterations lost their first letter |
| `src/components/EuropeCards.tsx` | `זכינו בהקונפרנס ליג!` | `זכינו בקונפרנס ליג!` | grammar — ב contracts the definite article |
| `src/components/EuropeCards.tsx` | `הגענו להגמר` | `הגענו לגמר` | grammar — ל contracts the definite article |
| `src/game/careerFeed.ts` | `עונה אירופית בהקונפרנס ליג.` / `אנחנו בהליגה האירופית.` | `עונה אירופית בקונפרנס ליג.` / `אנחנו בליגה האירופית.` | grammar — bare name interpolated after ב |
| `src/game/careerFeed.ts` | `הקיץ האירופי נגמר מוקדם.` shown during active qualifying | dedicated qualifying wording | chronology/truth (see phase 1) |
| `src/game/careerFeed.ts` | `לילות גדולים מחכים.` on a finished campaign | `המסע האירופי {comp} הסתיים.` | chronology/truth |
| `src/game/careerFeed.ts` | `מדברים על השוער של .` when no fixture is active | club name always resolved | grammar — empty interpolation left a dangling sentence |
| `src/components/CareerHome.tsx` | `קונפרנס ליג · פלייאוף` after elimination | `קונפרנס ליג · הודחנו בפלייאוף` | chronology/truth (see phase 2) |
| `src/components/CareerHome.tsx` | `ליגת האלופות · מוקדמות ליגת האלופות — סיבוב ראשון` | `ליגת האלופות · מוקדמות — סיבוב ראשון` | unnatural Hebrew — the competition was named twice in one line |
| `src/components/LeagueTableCard.tsx` | `1 נקודות מהפסגה` | `נקודה אחת מהפסגה` | number agreement (also the promotion, safety and Europe lines) |
| `src/game/matchdayPresenter.ts` | `1 הופעות · 1 שערים · 1 בישולים` | `הופעה אחת · שער אחד · בישול אחד` | number agreement |
| `src/game/matchdayPresenter.ts` | `בסיבוב הראשון: …` beside `העונה: …` | `הסיבוב הראשון: …` | consistency — both are labels before a colon |
| `src/game/legendEngine.ts` | `1 הופעות`, `1 עונות`, `1 שערים`, `1 בישולים`, `1 שערים נקיים`, `1 עונות עם הסרט` | singular forms | number agreement |
| `src/game/legendEngine.ts` | `חזרת בגיל 30 ל-עונה אחת` | `חזרת בגיל 30 לעונה אחת` | punctuation — a prefix hyphenates before a numeral, not before a word |
| `src/game/maccabiLegacy.ts` | `1 הופעות רשמיות`, `1 עונות`, `1 עונות עם הסרט`, `1 שערים`, `1 בישולים`, `1 שערים נקיים` | singular forms, incl. `הופעה אחת רשמית` | number agreement (noun **and** its adjective) |
| `src/game/storyEngine.ts` | `נשארת 1 עונות` | `נשארת עונה אחת` | number agreement |
| `src/game/storyEngine.ts` | `1 עונות עם הסרט ו-1 אליפויות` | `עונה אחת עם הסרט ואליפות אחת` | number agreement and punctuation |
| `src/game/storyEngine.ts` | `1 הופעות בירוק` | `הופעה אחת בירוק` | number agreement |
| `src/game/honorsEngine.ts` | `1 שערים`, `1 בישולים`, `1 שערים נקיים` | singular forms | number agreement |
| `src/pages/RetirementPage.tsx` | `1 הופעות רשמיות בירוק.` | `הופעה אחת רשמית בירוק.` | number agreement |
| `src/game/milestones.ts` | `ערב אירופאי בסמי עופר` | `ערב אירופי בסמי עופר` | consistency — 48 other uses take the `אירופ־י` form |
| `src/data/events/seniorPhaseEvents.ts` | `ערב אירופאי שלא שוכחים בחיפה` | `ערב אירופי שלא שוכחים בחיפה` | consistency |

## What the runtime bugs actually looked like

The two worst were invisible in the source and only appear once a name is substituted in.

**Every goal in the matchday timeline.** `withHebrewPrefix` applied the definite-article
contraction to club names. For `הפועל` clubs it produced a real but wrong word; for transliterated
names it deleted the first letter:

```
שער לפועל באר שבע      should be   שער להפועל באר שבע
שער למבורג             should be   שער להמבורג          (Hamburg)
שער לופנהיים           should be   שער להופנהיים        (Hoffenheim)
נשאר בפועל תל אביב     should be   נשאר בהפועל תל אביב  (decision card)
```

The rule itself is correct — it is why `inCompetition` turns `הקונפרנס ליג` into `בקונפרנס ליג` —
but it was generalised to the one kind of word it does not apply to. The two cases now have two
functions, `contractedPrefix` for definite common nouns and `withHebrewPrefix` for proper names,
each documented against the other.

**Anything a player did exactly once.** `countLabel` existed and was called in one component.
Everywhere else a raw count was concatenated, so a one-point title race read `1 נקודות מהפסגה` and
a single-appearance season read `1 הופעות`.

## Terminology

Checked by counting every variant across the source rather than by reading for impressions.

- **Europe.** `ליגת האלופות` (19), `הליגה האירופית` (9), `קונפרנס ליג` (19) — no competing
  variants. `ליגת הקונפרנס` and `אירופה ליג` appear nowhere; `UECL` appears only in code comments.
  `ליגה אירופית מובילה/חזקה` is a domestic-league *quality* bucket, not the Europa League, and is
  unambiguous in context. `מוקדמות`, `פלייאוף`, `שלב הליגה`, `שמינית/רבע/חצי הגמר`, `העפלה`,
  `הדחה`, `מעבר אוטומטי` are each used consistently.
- **Transfers and contracts.** `הצעה`, `העברה`, `השאלה`, `חוזה`, `חזרה הביתה`, `סוף דרך` — one
  term per concept.
- **Academy.** `שנתון`, `נוער`, `נערים`, `מחלקה`, `קבוצה בוגרת`, `אימון בוגרים` — consistent.
- **Matchday.** `שריקת פתיחה`, `מחצית`, `שריקת סיום`, `שער`, `בישול`, `הרכב`, `ספסל` — consistent.
- **Goalkeepers.** `שער נקי`, `הצלה`, `עצירה`, `יציאה נכונה סוגרת זווית`, `הגנה על הקו` — all
  keeper language, none of it borrowed from outfield play. The keeper's own stat line reports
  `שערים נקיים` where an outfielder's reports `שערים` and `בישולים`.
- **Tackling.** Only one term exists in the game after the `חריצה` fix, so there is nothing to be
  inconsistent with.

## What was deliberately left alone

- `מכביסטיות` (`hint: 'מכביסטיות - במחיר עייפות'`) — a coinage, not an error, and the kind of
  intentional slang the brief asks to preserve.
- `בזמן שאתה נהנית` — colloquial but valid, and the parallel preview line already uses the tighter
  `בזמן שנהנית`.
- `1 הופעות` in `maccabiLegacy`'s record-chase labels — the values there are club records and the
  thresholds `[50, 100, 200, 300, 400, 500]`, so the count is never 1.
- `{n} שערים` in the media feed — guarded at `>= 3` and `>= 5`, so the plural is always correct.
- The event prose throughout. It is strong, and rewriting good copy would have been the larger
  mistake.

## Regression guard

`tests/hebrewCopy.test.ts`. Not a grammar engine — a short curated list of forms that were
actually found in the shipped game, plus unit tests for the three helpers and a sweep asserting
that no club name in the database is mangled by a preposition. Comments are stripped before the
token scan, since the notes explaining these rules necessarily quote the wrong forms.

Verified non-vacuous: reintroducing `חריצה` fails the test with the correct file and line.

One note against my own work here: fixing the noun exposed the adjective. `הופעות רשמיות` became
`הופעה אחת רשמיות` on the first pass — correct in number, wrong in agreement — because the
adjective sat outside the helper. Both singular and plural now carry their own adjective, and
every other `countLabel` call site was re-checked for a trailing word that inflects. The rest are
followed only by prepositional phrases (`עם הסרט`, `בירוק`, `מהפסגה`), which do not.

## Totals

| | |
|---|---|
| Files carrying Hebrew | 115 |
| Lines containing Hebrew | 4,441 |
| Files audited | 115 |
| Files changed | 14 |
| Copy corrections | 25 distinct changes |
| Spelling / malformed word | 2 (`חריצה`, both occurrences) |
| Terminology | 3 |
| Grammar (prefixes, contraction) | 7 |
| Number agreement | 9 (two of which also required the adjective to agree) |
| Punctuation | 2 |
| Truth / chronology | 4 |

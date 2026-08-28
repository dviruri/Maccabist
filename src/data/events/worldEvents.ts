import type { GameEvent } from '../../types';

/**
 * The club's own season (v0.4 Phase 7).
 *
 * Until now a career happened in a vacuum: the player could be relegated without a single event
 * acknowledging it. These are the beats that make the table matter — a promotion run, a survival
 * fight, a club falling apart around a player who is doing fine personally.
 *
 * They read `minClubStrength` / `maxClubStrength` rather than the finishing position, because the
 * table is only resolved at season end and an in-season event cannot honestly know it. What
 * everyone at a club *does* know in August is whether they are expected to go up, stay up, or
 * fight, and that is exactly what club strength expresses.
 *
 * All `clubScope: 'currentClub'` — the text never names a club, so these read correctly whether
 * the player is at Maccabi, at Hapoel Afula, or in Belgium.
 */

export const WORLD_EVENTS: GameEvent[] = [
  /* ---------------------------------------------------------------- */
  /* Fighting to stay up                                               */
  /* ---------------------------------------------------------------- */
  {
    id: 'wrl_relegation_battle',
    kicker: 'שמונה מחזורים לסיום',
    title: 'קרב ההישרדות',
    description:
      'הקבוצה בתחתית הטבלה, והאווירה במועדון כבדה. באימון היום המאמן דיבר על אופי, לא על טקטיקה.',
    category: 'team',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      maxClubStrength: -0.3,
      requiresProfessionalFootball: true,
      minRoleValue: 28,
    },
    slots: ['mid', 'late'],
    weight: 11,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'lead',
        label: 'לקחת אחריות. לדבר בחדר ההלבשה',
        risk: 'risky',
        outcomes: [
          {
            id: 'galvanised',
            baseWeight: 42,
            tone: 'good',
            text: 'אתה מדבר שתי דקות, וזה נשמע נכון. הקבוצה יוצאת אחרת למגרש בשבת.',
            effects: {
              leadership: 6,
              roleValue: 7,
              coachTrust: 7,
              reputation: 5,
              form: 5,
              revealTrait: 'leader',
              remember: 'survived_relegation_battle',
            },
            modifiers: [
              { attribute: 'roleValue', above: 60, multiplier: 1.5 },
              { attribute: 'age', below: 22, multiplier: 0.55 },
            ],
            traitModifiers: [{ trait: 'leader', multiplier: 1.9 }],
          },
          {
            id: 'not_your_place',
            baseWeight: 58,
            tone: 'bad',
            text: 'הוותיקים מסתכלים עליך בשקט עד שאתה מסיים. לא זה הרגע ולא אתה האיש.',
            effects: { roleValue: -4, confidence: -6, pressure: 6 },
          },
        ],
      },
      {
        id: 'play',
        label: 'לא לדבר. לשחק',
        risk: 'balanced',
        outcomes: [
          {
            id: 'delivered',
            baseWeight: 55,
            tone: 'good',
            text: 'אתה פשוט משחק טוב, שבוע אחרי שבוע. יש שחקנים שמובילים ככה.',
            effects: { form: 6, coachTrust: 5, roleValue: 4 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.5 }],
          },
          {
            id: 'dragged_down',
            baseWeight: 45,
            tone: 'bad',
            text: 'הלחץ במועדון נכנס לך לרגליים. אתה משחק מכווץ, כמו כולם.',
            effects: { form: -6, confidence: -5, pressure: 5 },
          },
        ],
      },
    ],
  },

  {
    id: 'wrl_club_in_crisis',
    kicker: 'מאחורי הקלעים',
    title: 'המועדון מתפרק',
    description:
      'המשכורות מתעכבות, המנהל המקצועי התפטר, ובעיתונות מדברים על המועדון בלשון עבר. אתה עדיין צריך לצאת לאמן.',
    category: 'team',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      /*
       * -0.15 covered almost every club outside the top three and fired in 45% of careers, which
       * made "the club is falling apart" the normal state of football. A club genuinely in
       * crisis is one clearly out of its depth in its own division.
       */
      maxClubStrength: -0.5,
      requiresProfessionalFootball: true,
    },
    weight: 7,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'stay_professional',
        label: 'לבוא לאימון כרגיל',
        risk: 'safe',
        outcomes: [
          {
            id: 'noticed',
            baseWeight: 100,
            tone: 'good',
            text: 'חצי מהסגל מפסיק להתאמן ברצינות. אתה לא. אנשים בענף רואים את זה.',
            effects: { reputation: 5, coachTrust: 6, discipline: 4, transferChance: 0.1 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.4 }],
          },
        ],
      },
      {
        id: 'look_around',
        label: 'להתחיל לחפש מועדון אחר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'door_opens',
            baseWeight: 60,
            tone: 'good',
            text: 'הסוכן שלך מתחיל לעבוד. אולי הבלגן הזה הוא בעצם הזדמנות.',
            effects: { transferChance: 0.35, roleValue: -3 },
          },
          {
            id: 'word_gets_out',
            baseWeight: 40,
            tone: 'bad',
            text: 'מישהו מספר למאמן שאתה מחפש. הוא לא אומר כלום, והוא גם לא מעמיד אותך בשבת.',
            effects: { coachTrust: -8, roleValue: -6, transferChance: 0.2 },
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Going up                                                          */
  /* ---------------------------------------------------------------- */
  {
    id: 'wrl_promotion_race',
    kicker: 'הישורת האחרונה',
    title: 'המרוץ לעלייה',
    description:
      'הקבוצה בצמרת הליגה, ופתאום כל משחק הוא גמר. בעיר מדברים על עלייה בפעם הראשונה מזה שנים.',
    category: 'competition',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      clubLeagueTier: [2],
      minClubStrength: 0.15,
      requiresProfessionalFootball: true,
      minRoleValue: 30,
    },
    slots: ['mid', 'late'],
    weight: 14,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'carry',
        label: 'לקחת את הקבוצה על הגב',
        risk: 'risky',
        outcomes: [
          {
            id: 'decisive',
            baseWeight: 46,
            tone: 'good',
            text: 'שלושה משחקים, שלוש הכרעות שלך. זו העונה שבה הפכת לשחקן שסומכים עליו.',
            effects: {
              form: 9,
              roleValue: 9,
              reputation: 9,
              confidence: 8,
              transferChance: 0.15,
              milestone: {
                id: 'promotion_push',
                icon: '🚀',
                text: 'הובלת את הקבוצה במרוץ לעלייה',
                major: true,
              },
            },
            modifiers: [{ attribute: 'ability', below: 55, multiplier: 0.5 }],
            traitModifiers: [{ trait: 'big_game', multiplier: 1.6 }],
          },
          {
            id: 'overplayed',
            baseWeight: 54,
            tone: 'bad',
            text: 'אתה מנסה לעשות הכל לבד, ומפספס יותר משאתה קולע. הקבוצה משלמת על זה.',
            effects: { form: -7, confidence: -6, coachTrust: -4, pressure: 6 },
          },
        ],
      },
      {
        id: 'system',
        label: 'לשחק את התפקיד שלך, בלי גימיקים',
        risk: 'safe',
        outcomes: [
          {
            id: 'steady',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה עושה את העבודה שלך בשקט. המאמן מזכיר את השם שלך בכל תדריך.',
            effects: { coachTrust: 6, roleValue: 4, form: 3 },
          },
        ],
      },
    ],
  },

  {
    id: 'wrl_title_race',
    kicker: 'מחזור 30',
    title: 'אליפות באוויר',
    description:
      'הפרש נקודה אחת בצמרת, וארבעה משחקים לסיום. באימונים כבר אין צחוקים.',
    category: 'competition',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      clubLeagueTier: [1],
      minClubStrength: 0.3,
      requiresProfessionalFootball: true,
      minRoleValue: 40,
    },
    // Was late-only, which combined with the narrow strength window made it unreachable.
    slots: ['mid', 'late'],
    weight: 12,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'embrace',
        label: 'לחיות את זה. בשביל זה שיחקת כל החיים',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'rose',
            baseWeight: 52,
            tone: 'good',
            preview: 'הלחץ עושה לך טוב - החודש הכי טוב בקריירה, בדיוק כשצריך',
            text: 'הלחץ עושה לך טוב. אתה משחק את החודש הכי טוב בקריירה שלך בדיוק כשצריך.',
            effects: {
              form: 10,
              reputation: 8,
              roleValue: 7,
              confidence: 9,
              leadership: 3,
            },
            traitModifiers: [
              { trait: 'big_game', multiplier: 1.8 },
              { trait: 'self_believer', multiplier: 1.3 },
            ],
            modifiers: [{ attribute: 'confidence', below: 40, multiplier: 0.55 }],
          },
          {
            id: 'froze',
            baseWeight: 48,
            tone: 'bad',
            preview: 'הרגליים כבדות, ותבקש פחות כדורים - וזה נראה מהיציע',
            text: 'הרגליים כבדות. אתה מבקש פחות כדורים, וזה נראה מהיציע.',
            effects: { form: -8, confidence: -8, pressure: 8, coachTrust: -3 },
          },
        ],
      },
      {
        id: 'routine',
        label: 'להתייחס לזה כמו לכל משחק אחר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'held',
            baseWeight: 68,
            tone: 'good',
            preview: 'אותה שגרה, אותן שעות שינה, אותו חימום',
            text: 'אותה שגרה, אותן שעות שינה, אותו חימום. זה בדיוק מה שצריך עכשיו.',
            effects: { form: 4, pressure: -5, coachTrust: 3 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.6 }],
          },
          {
            id: 'flat',
            baseWeight: 32,
            tone: 'neutral',
            preview: 'קור רוח, אבל בלי להרים את עצמך',
            text: 'שמרת על קור רוח, אבל גם לא הרמת את עצמך. עונה כמו כל עונה.',
            effects: { form: -2 },
          },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /* Personal season, club season                                      */
  /* ---------------------------------------------------------------- */
  {
    id: 'wrl_carrying_a_small_club',
    kicker: 'ראיון אחרי המשחק',
    title: 'טוב מדי לליגה הזאת',
    description:
      'שוב הבקעת, ושוב הקבוצה הפסידה. הכתב שואל אותך ישירות מה אתה עושה במועדון כזה.',
    category: 'pressure',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      maxClubStrength: -0.1,
      minRoleValue: 62,
      minLastAppearances: 8,
      requiresProfessionalFootball: true,
    },
    slots: ['mid', 'late'],
    weight: 10,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'loyal',
        label: '"אני פה, ואני נותן הכל פה"',
        risk: 'safe',
        outcomes: [
          {
            id: 'adored',
            baseWeight: 100,
            tone: 'good',
            text: 'הקהל שומע את זה ומאמץ אותך סופית. בליגה שומעים משהו אחר: הוא גם בנאדם.',
            effects: {
              roleValue: 6,
              reputation: 4,
              coachTrust: 5,
            },
          },
        ],
      },
      {
        id: 'ambitious',
        label: '"אני שואף גבוה יותר. זה לא סוד"',
        risk: 'risky',
        outcomes: [
          {
            id: 'shop_window',
            baseWeight: 58,
            tone: 'good',
            text: 'הציטוט מתגלגל. שני מועדונים מתקשרים לסוכן שלך תוך יומיים.',
            effects: {
              transferChance: 0.4,
              reputation: 6,
              roleValue: -3,
            },
          },
          {
            id: 'turned_on_you',
            baseWeight: 42,
            tone: 'bad',
            text: 'היציע קורא את זה אחרת. בשבת הבאה שורקים לך בבית, וזה כואב יותר משציפית.',
            effects: { roleValue: -7, confidence: -6, pressure: 6, transferChance: 0.2 },
          },
        ],
      },
    ],
  },
];

import type { GameEvent } from '../../types';

/**
 * The fall-and-rise arc, and the callbacks that hang off the football world (v0.4 Phase 8).
 *
 * v0.4 gave careers a shape - relegated, promoted, abroad and back, up a level and down again -
 * but nothing in the game ever referred to that shape afterwards. These are the events that make
 * a season two years ago still mean something.
 *
 * The arc itself is deliberately built on a *bad* outcome. Getting relegated is the moment a
 * career forks hardest: stay and rebuild, or get out while someone still wants you. Both are
 * legitimate football decisions and the game should not imply otherwise.
 *
 * All `clubScope: 'currentClub'` - none of this text names a club, so it reads correctly wherever
 * the player is.
 */

export const FALL_AND_RISE_EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* ARC: relegated, and what he did about it                           */
  /* ================================================================= */
  {
    id: 'arc_fall_the_morning_after',
    kicker: 'המחזור האחרון נגמר',
    title: 'הבוקר שאחרי',
    description:
      'הקבוצה ירדה ליגה. חדר ההלבשה ריק כבר שעה, ואתה עדיין יושב שם. הסוכן שלך התקשר שלוש פעמים.',
    category: 'pressure',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      requiresMemory: ['suffered_relegation'],
      memoryMaxSeasonsAgo: 1,
      forbidsActiveArc: 'fall_and_rise',
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    /*
     * Weighted high on purpose. Being relegated is a defining moment and the season after it
     * should almost always open with this decision - at weight 20 only one relegated player in
     * five ever saw it, and the arc it opens was correspondingly unreachable.
     */
    weight: 55,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'stay',
        label: 'להישאר. להחזיר אותם למעלה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'committed',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה אומר לסוכן לא לענות לאף אחד. במועדון שומעים על זה תוך יומיים, והיחס אליך משתנה.',
            effects: {
              roleValue: 9,
              coachTrust: 9,
              leadership: 5,
              reputation: -3,
              startArc: 'fall_and_rise',
              arcBranch: 'stayed',
              milestone: {
                id: 'stayed_after_relegation',
                icon: '🛡️',
                text: 'נשארת אחרי הירידה',
              },
            },
          },
        ],
      },
      {
        id: 'leave',
        label: 'לבקש לעזוב. ליגה שנייה זה לא המקום שלך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'understood',
            baseWeight: 62,
            tone: 'neutral',
            preview: 'יבינו. אף אחד לא יאהב את זה, ואף אחד לא יופתע',
            text: 'הם מבינים. אף אחד לא אוהב את זה, אבל אף אחד גם לא מופתע.',
            effects: {
              transferChance: 0.45,
              roleValue: -5,
              startArc: 'fall_and_rise',
              arcBranch: 'asked_to_leave',
            },
          },
          {
            id: 'resented',
            baseWeight: 38,
            tone: 'bad',
            preview: 'המאמן יגיד שציפה ליותר ממך - ולא על כדורגל',
            text: 'המאמן אומר לך שהוא ציפה ליותר ממך. הוא לא מתכוון לכדורגל.',
            effects: {
              transferChance: 0.35,
              coachTrust: -10,
              roleValue: -8,
              startArc: 'fall_and_rise',
              arcBranch: 'asked_to_leave',
            },
          },
        ],
      },
    ],
  },

  {
    id: 'arc_fall_the_long_season',
    kicker: 'באמצע ליגה שנייה',
    title: 'העונה הארוכה',
    description:
      'מגרשים קטנים, אוטובוסים ארוכים, ואף אחד לא מצלם. אתה טוב מהליגה הזאת וכולם יודעים.',
    category: 'pressure',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      requiresArc: { id: 'fall_and_rise', branches: ['stayed'], minSeasonsSinceStart: 1 },
      clubLeagueTier: [2],
      requiresProfessionalFootball: true,
    },
    weight: 30,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'keep_standard',
        label: 'לשחק כאילו זו ליגת העל',
        risk: 'safe',
        outcomes: [
          {
            id: 'dragged_them_up',
            baseWeight: 66,
            tone: 'good',
            preview: 'הקבוצה תתיישר לפיך, וזו תהפוך להיות הקבוצה שלך',
            text: 'אתה מסרב להוריד את הרמה, והקבוצה מתיישרת לפיך. זו הפכה להיות הקבוצה שלך.',
            effects: {
              form: 7,
              roleValue: 8,
              leadership: 4,
              coachTrust: 6,
              advanceArc: 'fall_and_rise',
              revealTrait: 'professional',
            },
            traitModifiers: [{ trait: 'professional', multiplier: 1.5 }],
          },
          {
            id: 'wore_down',
            baseWeight: 34,
            tone: 'bad',
            preview: 'תישחק מלשחק ברמה שכל השאר לא נמצאים בה',
            text: 'אי אפשר לשחק ברמה אחת כשכל השאר ברמה אחרת. אתה נשחק, ומתחיל להיפצע.',
            effects: { form: -5, injuryRisk: 5, confidence: -4, advanceArc: 'fall_and_rise' },
          },
        ],
      },
      {
        id: 'coast',
        label: 'לשמור על עצמך לעונה הבאה',
        risk: 'risky',
        outcomes: [
          {
            id: 'fresh',
            baseWeight: 40,
            tone: 'neutral',
            preview: 'תעבור את העונה בלי להישבר. גם בלי להיזכר',
            text: 'אתה עובר את העונה בלי להישבר. גם בלי להיזכר.',
            effects: { form: -2, injuryRisk: -4, advanceArc: 'fall_and_rise' },
          },
          {
            id: 'noticed',
            baseWeight: 60,
            tone: 'bad',
            preview: 'הקהל יראה שחקן שלא באמת פה - ועל זה לא סולחים',
            text: 'הקהל רואה שחקן שלא באמת פה. בליגה הזאת סולחים על הרבה, לא על זה.',
            effects: {
              roleValue: -9,
              coachTrust: -8,
              reputation: -5,
              advanceArc: 'fall_and_rise',
            },
          },
        ],
      },
    ],
  },

  {
    id: 'arc_rise_back_up',
    kicker: 'סוף העונה',
    title: 'בחזרה למעלה',
    description:
      'עלייה. שנתיים אחרי הבוקר ההוא בחדר ההלבשה הריק, אתם חוזרים לליגה הבכירה - ואתה היית שם כל הדרך.',
    category: 'competition',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      requiresArc: { id: 'fall_and_rise', branches: ['stayed'] },
      requiresMemory: ['won_promotion'],
      memoryMaxSeasonsAgo: 1,
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    weight: 30,
    choices: [
      {
        id: 'own_it',
        label: 'זה שלך. תיהנה מזה',
        risk: 'safe',
        outcomes: [
          {
            id: 'legend_here',
            baseWeight: 100,
            tone: 'good',
            text: 'ביציע שרים את השם שלך. במועדון הזה אתה כבר לא שחקן - אתה חלק מהסיפור שלהם.',
            effects: {
              roleValue: 12,
              reputation: 10,
              confidence: 10,
              leadership: 5,
              completeArc: 'fall_and_rise',
              remember: 'rebuilt_career',
              achievement: 'brought_them_back',
              milestone: {
                id: 'brought_them_back',
                icon: '🔺',
                text: 'ירדת איתם וגם החזרת אותם',
                major: true,
              },
            },
          },
        ],
      },
      {
        /*
         * The other honest answer. He paid two years of his prime for this, and using the
         * promotion as a shop window is a real football decision - not a betrayal of the story
         * he just finished, which is why he keeps the achievement either way.
         */
        id: 'cash_it_in',
        label: 'סיימת את העבודה. עכשיו לחשוב על עצמך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'moved_on_a_hero',
            baseWeight: 64,
            tone: 'good',
            preview: 'תגיד להם בפנים לפני שזה מגיע לעיתונות - ותצא בכבוד',
            text: 'אתה אומר להם את זה בפנים, לפני שזה מגיע לעיתונות. הם לא שמחים, והם גם לא כועסים.',
            effects: {
              transferChance: 0.5,
              reputation: 8,
              confidence: 6,
              completeArc: 'fall_and_rise',
              remember: 'rebuilt_career',
              achievement: 'brought_them_back',
              milestone: {
                id: 'brought_them_back',
                icon: '🔺',
                text: 'ירדת איתם, החזרת אותם, והמשכת הלאה',
                major: true,
              },
            },
          },
          {
            id: 'no_one_called',
            baseWeight: 36,
            tone: 'bad',
            preview: 'הטלפון לא יצלצל - שנתיים בליגה השנייה עשו את שלהן',
            text: 'הטלפון לא מצלצל. שנתיים בליגה השנייה עשו את שלהן גם לשם שלך.',
            effects: {
              confidence: -7,
              roleValue: -5,
              completeArc: 'fall_and_rise',
              remember: 'rebuilt_career',
              achievement: 'brought_them_back',
            },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* Callbacks on the shape of the career                               */
  /* ================================================================= */
  {
    id: 'cb_the_year_abroad',
    kicker: 'ראיון',
    title: 'השנה ההיא בחו״ל',
    description:
      'הכתב מוציא דף עם הסטטיסטיקות שלך מהתקופה בחוץ. "אתה מתחרט שהלכת?"',
    category: 'family',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      requiresMemory: ['returned_to_israel'],
      memoryMinSeasonsAgo: 2,
      requiresProfessionalFootball: true,
    },
    weight: 8,
    cooldownSeasons: 5,
    choices: [
      {
        id: 'no_regrets',
        label: '"הייתי הולך שוב מחר"',
        risk: 'balanced',
        outcomes: [
          {
            id: 'grew',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה מתאר איך זה היה לגור לבד בעיר שלא מדברת עברית. הכתב מפסיק לכתוב ופשוט מקשיב.',
            effects: { confidence: 6, reputation: 3, leadership: 3 },
            memoryModifiers: [{ memory: 'failed_abroad', multiplier: 0.6 }],
          },
        ],
      },
      {
        id: 'honest_failure',
        label: '"לא הייתי מוכן. זו האמת"',
        risk: 'safe',
        outcomes: [
          {
            id: 'respected_honesty',
            baseWeight: 100,
            tone: 'good',
            text: 'שחקנים לא אומרים דברים כאלה בקול. בחדר ההלבשה מסתכלים עליך אחרת אחרי זה.',
            effects: { leadership: 5, roleValue: 3, confidence: -2, revealTrait: 'professional' },
          },
        ],
      },
    ],
  },

  {
    id: 'cb_the_way_back_down',
    kicker: 'מחשבה באוטובוס',
    title: 'הדרך למטה, והדרך חזרה',
    description:
      'לפני כמה שנים ירדת רמה, ורוב האנשים בענף מחקו אותך. עכשיו אתה שוב במקום אחר לגמרי.',
    category: 'family',
    conditions: {
      bands: ['senior'],
      clubScope: 'currentClub',
      requiresMemory: ['rebuilt_career'],
      memoryMinSeasonsAgo: 1,
      requiresProfessionalFootball: true,
      minAge: 26,
    },
    weight: 9,
    cooldownSeasons: 5,
    choices: [
      {
        id: 'remember_it',
        label: 'לזכור בדיוק איך זה הרגיש',
        risk: 'safe',
        outcomes: [
          {
            id: 'fuel',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה שומר את זה קרוב. יש שחקנים שנשברים אחרי ירידה, ויש כאלה שנבנים ממנה.',
            effects: {
              confidence: 7,
              form: 4,
              leadership: 4,
              revealTrait: 'self_believer',
              milestone: {
                id: 'the_long_way_round',
                icon: '📈',
                text: 'ירדת רמה וחזרת ממנה',
              },
            },
          },
        ],
      },
      {
        id: 'help_someone',
        label: 'לדבר עם הצעיר שעובר את זה עכשיו',
        risk: 'balanced',
        outcomes: [
          {
            id: 'passed_it_on',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה מספר לו את זה בלי לייפות כלום. הוא לא אומר תודה, אבל הוא זוכר.',
            effects: { leadership: 8, roleValue: 4, coachTrust: 4, revealTrait: 'leader' },
          },
        ],
      },
    ],
  },
];

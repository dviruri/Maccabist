import type { GameEvent } from '../../types';

/**
 * Facing Maccabi, and being an ex-Maccabi player (v0.4 Phase 5).
 *
 * Every event here is for a player who is *not* at Maccabi. That is the whole point: the product
 * invariant is that the player may leave Maccabi but Maccabi never leaves his story, and the way
 * to honour it is context, not by handing a Hapoel Afula player Maccabi dressing-room events.
 *
 * They are all gated on `crowdResponse` or `maccabiRelationship`, so the same fixture reads
 * completely differently depending on how the career actually went. A defector walks out to
 * whistles; a graduate who left for Portugal walks out to applause; a player who spent two
 * anonymous seasons there walks out to nothing at all, which is its own kind of answer.
 */

export const MACCABI_EVENTS: GameEvent[] = [
  /* ---------------------------------------------------------------- */
  /* Facing them                                                       */
  /* ---------------------------------------------------------------- */
  {
    id: 'mac_return_to_sami_ofer_warm',
    kicker: 'סמי עופר, חימום',
    title: 'החזרה',
    description:
      'אתה יוצא לחימום בחולצה של הקבוצה השנייה. היציע המערבי מזהה אותך, ומתחיל למחוא כפיים.',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      canFaceMaccabi: true,
      crowdResponse: ['warm'],
      playedForMaccabi: true,
      requiresProfessionalFootball: true,
    },
    /**
     * Weighted well above the hostile version deliberately. A beloved ex-player tends to leave
     * for Europe, where he cannot meet them, while a defector stays in the league and faces them
     * twice a season - so at equal weights the warm homecoming fired less than half as often as
     * the booing, which is the wrong way round for the nicest beat in the family.
     */
    weight: 20,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'applaud_back',
        label: 'להרים יד ליציע',
        risk: 'safe',
        outcomes: [
          {
            id: 'moment',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה מרים יד, והמחיאות מתחזקות. תשעים דקות מכאן אתם יריבים. עכשיו לא.',
            maccabiRelevance: 'fans',
            effects: {
              maccabism: 6,
              confidence: 5,
              remember: ['played_against_maccabi', 'applauded_at_sami_ofer'],
              milestone: {
                id: 'welcomed_back',
                icon: '👏',
                text: 'קיבלת מחיאות כפיים בסמי עופר בחולצה אחרת',
              },
            },
          },
        ],
      },
      {
        id: 'stay_focused',
        label: 'להמשיך בחימום כאילו כלום',
        risk: 'balanced',
        outcomes: [
          {
            id: 'professional',
            baseWeight: 62,
            tone: 'neutral',
            preview: 'תמשיך לרוץ - זה משחק, ואתה בו בשביל מישהו אחר',
            text: 'אתה ממשיך לרוץ. זה משחק, ואתה משוחק בו בשביל מישהו אחר עכשיו.',
            effects: { form: 3, remember: ['played_against_maccabi', 'applauded_at_sami_ofer'] },
            traitModifiers: [{ trait: 'professional', multiplier: 1.5 }],
          },
          {
            id: 'cost_him',
            baseWeight: 38,
            tone: 'bad',
            preview: 'לא תסתכל למעלה, והראש בכל זאת יהיה שם',
            text: 'אתה לא מסתכל למעלה, והראש בכל זאת שם. הפתיחה שלך במשחק איטית.',
            effects: { form: -4, confidence: -3 },
          },
        ],
      },
    ],
  },

  {
    id: 'mac_return_to_sami_ofer_hostile',
    kicker: 'סמי עופר, דקה 1',
    title: 'קבלת הפנים',
    description:
      'הנגיעה הראשונה שלך בכדור מלווה בשריקות מכל האצטדיון. הם לא שכחו לאיזו חולצה הלכת.',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      canFaceMaccabi: true,
      crowdResponse: ['hostile'],
      requiresProfessionalFootball: true,
    },
    weight: 10,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'use_it',
        label: 'לקחת את זה כדלק',
        risk: 'risky',
        outcomes: [
          {
            id: 'thrives',
            baseWeight: 45,
            tone: 'good',
            text: 'ככל שהם שורקים חזק יותר אתה נוגע יותר בכדור. יש שחקנים שנולדו למשחקים כאלה.',
            effects: {
              form: 8,
              confidence: 8,
              reputation: 6,
              roleValue: 5,
              remember: ['played_against_maccabi', 'booed_at_sami_ofer'],
            },
            traitModifiers: [
              { trait: 'big_game', multiplier: 1.7 },
              { trait: 'self_believer', multiplier: 1.4 },
            ],
            modifiers: [{ attribute: 'confidence', below: 45, multiplier: 0.5 }],
          },
          {
            id: 'swallowed',
            baseWeight: 55,
            tone: 'bad',
            preview: 'הרעש ייכנס לך לראש, והחלפה בהפסקה',
            text: 'הרעש נכנס לך לראש. שתי מסירות רעות, והמאמן מוציא אותך בהפסקה.',
            effects: {
              form: -8,
              confidence: -8,
              coachTrust: -4,
              pressure: 7,
              remember: ['played_against_maccabi', 'booed_at_sami_ofer'],
            },
          },
        ],
      },
      {
        id: 'head_down',
        label: 'להוריד את הראש ולעבוד',
        risk: 'safe',
        outcomes: [
          {
            id: 'survived',
            baseWeight: 100,
            tone: 'neutral',
            text: 'תשעים דקות, אפס דרמה. יצאת מהמגרש בלי שאף אחד ידבר עליך. זה מספיק.',
            effects: { form: 2, pressure: 3, remember: ['played_against_maccabi', 'booed_at_sami_ofer'] },
          },
        ],
      },
    ],
  },

  {
    id: 'mac_scored_against_them',
    kicker: 'רגע אחרי',
    title: 'הכדור שלך נכנס',
    description:
      'הכדור עובר את הקו, והאצטדיון משתתק. הפינה שלך פתוחה, והחברים לקבוצה כבר רצים לחגוג.',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      canFaceMaccabi: true,
      playedForMaccabi: true,
      requiresProfessionalFootball: true,
      notPositions: ['GK'],
      minRoleValue: 34,
    },
    weight: 10,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'refuse',
        label: 'לא לחגוג. להרים יד להתנצלות',
        risk: 'safe',
        outcomes: [
          {
            id: 'respected',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה עומד במקום עם יד מורמת. חצי מהאצטדיון מוחא לך כפיים, וזה חצי שלא ציפית לו.',
            maccabiRelevance: 'opponent',
            effects: {
              maccabism: 8,
              reputation: 4,
              flags: ['loyalty_moment'],
              remember: ['played_against_maccabi', 'scored_against_maccabi', 'refused_to_celebrate'],
              milestone: {
                id: 'no_celebration',
                icon: '🤝',
                text: 'הבקעת מול מכבי ולא חגגת',
                major: true,
              },
            },
          },
        ],
      },
      {
        id: 'celebrate',
        label: 'לחגוג. אתה משחק בשביל המועדון הזה עכשיו',
        risk: 'risky',
        outcomes: [
          {
            id: 'adopted',
            baseWeight: 55,
            tone: 'good',
            preview: 'תחליק על הברכיים מול היציע האורח, והם יאמצו אותך',
            text: 'אתה רץ ליציע האורח ומחליק על הברכיים. הקהל שלך מאמץ אותך סופית הערב.',
            maccabiRelevance: 'opponent',
            effects: {
              roleValue: 8,
              confidence: 8,
              reputation: 6,
              maccabism: -6,
              remember: ['played_against_maccabi', 'scored_against_maccabi', 'celebrated_against_maccabi'],
            },
          },
          {
            id: 'burned',
            baseWeight: 45,
            tone: 'bad',
            preview: 'החגיגה תרוץ בלולאה בכל מהדורה, ובחיפה ידברו עליה',
            text: 'החגיגה שלך רצה בלולאה בכל מהדורה. בחיפה מדברים על זה הרבה יותר מאשר על הגול.',
            maccabiRelevance: 'opponent',
            effects: {
              reputation: 3,
              maccabism: -12,
              pressure: 6,
              flags: ['betrayal_moment'],
              remember: ['played_against_maccabi', 'scored_against_maccabi', 'celebrated_against_maccabi'],
            },
          },
        ],
      },
    ],
    // Scoring against them is a bigger deal the more of your career was theirs.
    // (Weighting lives on the outcomes; the memory is what later events read.)
  },

  /* ---------------------------------------------------------------- */
  /* Being an ex-Maccabi player                                        */
  /* ---------------------------------------------------------------- */
  {
    id: 'mac_they_still_watch',
    kicker: 'שיחה מהעבר',
    title: 'הם עדיין עוקבים',
    description:
      'מאמן הנוער הישן שלך מתקשר. בלי סיבה מיוחדת - הוא ראה את המשחק שלך בשבת ורצה להגיד שראה.',
    category: 'family',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      maccabiRelationship: ['son_of_the_club', 'icon', 'beloved', 'respected', 'known'],
      requiresProfessionalFootball: true,
    },
    weight: 5,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'talk',
        label: 'לדבר איתו באריכות',
        risk: 'safe',
        outcomes: [
          {
            id: 'grounded',
            baseWeight: 100,
            tone: 'good',
            text: 'חצי שעה על כלום. אתה מנתק ומרגיש קצת יותר בטוח במי שאתה.',
            maccabiRelevance: 'people',
            effects: { confidence: 5, maccabism: 5, pressure: -4 },
          },
        ],
      },
      {
        id: 'brief',
        label: 'להודות לו ולסגור',
        risk: 'balanced',
        outcomes: [
          {
            id: 'fine',
            baseWeight: 100,
            tone: 'neutral',
            text: 'שתי דקות ונעים. יש לך משחק בשבת, והראש כבר שם.',
            effects: { form: 2 },
          },
        ],
      },
    ],
  },

  {
    id: 'mac_asked_about_them',
    kicker: 'מסיבת עיתונאים',
    title: 'השאלה שתמיד נשאלת',
    description:
      '"אתה עדיין מרגיש שחקן של מכבי חיפה?" הכתב שואל את זה בכל ראיון, ואתה יודע שהתשובה תרוץ בכותרת.',
    category: 'pressure',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      playedForMaccabi: true,
      requiresProfessionalFootball: true,
      minReputation: 30,
    },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'honest',
        label: '"גדלתי שם. זה לא נמחק"',
        risk: 'balanced',
        outcomes: [
          {
            id: 'loved_there',
            baseWeight: 70,
            tone: 'good',
            text: 'בחיפה מצטטים אותך באהבה. בחדר ההלבשה שלך מותחים אותך על זה שבוע, בלי לכעוס.',
            maccabiRelevance: 'opponent',
            effects: { maccabism: 7, flags: ['loyalty_moment'] },
          },
          {
            id: 'awkward',
            baseWeight: 30,
            tone: 'bad',
            text: 'הכותרת יוצאת "עדיין של מכבי". המאמן שלך קורא לך לשיחה קצרה ולא נעימה.',
            maccabiRelevance: 'opponent',
            effects: { maccabism: 5, coachTrust: -5, roleValue: -3 },
          },
        ],
      },
      {
        id: 'loyal_to_now',
        label: '"אני שחקן של המועדון הזה. נקודה"',
        risk: 'safe',
        outcomes: [
          {
            id: 'respected_now',
            baseWeight: 100,
            tone: 'good',
            text: 'המאמן שלך שומע את זה ברדיו ואומר לך מילה טובה למחרת בבוקר.',
            maccabiRelevance: 'opponent',
            effects: { coachTrust: 5, roleValue: 3, maccabism: -4 },
          },
        ],
      },
      {
        id: 'deflect',
        label: 'לצחוק ולעבור לשאלה הבאה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'nothing',
            baseWeight: 100,
            tone: 'neutral',
            text: 'עברת את זה בלי לומר כלום. גם זו תשובה, ושני הצדדים מבינים אותה.',
            effects: { pressure: -2 },
          },
        ],
      },
    ],
  },

  {
    id: 'mac_the_door_is_closed',
    kicker: 'ידיעה קטנה בעיתון',
    title: 'הדלת שנסגרה',
    description:
      'מכבי חיפה מחפשת שחקן בעמדה שלך. השם שלך לא מופיע ברשימה, ואתה יודע בדיוק למה.',
    category: 'pressure',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      maccabiRelationship: ['traitor'],
      requiresProfessionalFootball: true,
    },
    weight: 6,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'accept',
        label: 'לקבל. בחרת, וזה המחיר',
        risk: 'safe',
        outcomes: [
          {
            id: 'peace',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה סוגר את העיתון. יש חולצות שלובשים פעם אחת, וזהו.',
            effects: { pressure: -3, confidence: 2 },
          },
        ],
      },
      {
        id: 'make_amends',
        label: 'לנסות לתקן משהו בפומבי',
        risk: 'risky',
        outcomes: [
          {
            id: 'softened',
            baseWeight: 30,
            tone: 'good',
            text: 'הראיון שלך מפתיע. זה לא מוחק כלום, אבל בפעם הבאה ישרקו לך קצת פחות.',
            maccabiRelevance: 'return',
            effects: { maccabism: 6, flags: ['loyalty_moment'] },
            traitModifiers: [{ trait: 'leader', multiplier: 1.4 }],
          },
          {
            id: 'worse',
            baseWeight: 70,
            tone: 'bad',
            preview: 'זה ייקרא כהתנצלות של מי שלא באמת מצטער',
            text: 'זה נקרא כמו התנצלות של מי שלא באמת מצטער. שני הצדדים כועסים עליך עכשיו.',
            maccabiRelevance: 'return',
            effects: { maccabism: -4, reputation: -4, pressure: 5 },
          },
        ],
      },
    ],
  },
];

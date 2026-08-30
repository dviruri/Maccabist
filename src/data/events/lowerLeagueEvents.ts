import type { GameEvent } from '../../types';

/**
 * Liga Alef events (v0.6.5).
 *
 * A small, deliberately focused set - the third tier got real clubs and real career mechanics
 * this version, and these give it a voice. Six events, not sixty: distinctive semi-professional
 * moments that cannot happen anywhere else in the game, gated on `clubTiers: ['israeli_alef']`
 * so they can never fire at Maccabi or in Belgium.
 *
 * Tone rule, stated because the brief states it: Liga Alef football is smaller, not lesser.
 * Grounds are rougher and squads train in the evening, and the football still matters to
 * everyone in it - the events describe the circumstances without turning them into a joke.
 */

export const LOWER_LEAGUE_EVENTS: GameEvent[] = [
  {
    id: 'alef_first_training',
    kicker: 'שבוע ראשון במועדון',
    title: 'דשא אחר לגמרי',
    description:
      'האימון בשש בערב, כי לחצי מהקבוצה יש עבודה עד ארבע. הדשא לא מושלם והיציע קטן. הכדור, מסתבר, בדיוק באותו גודל.',
    category: 'team',
    // No arrival-window condition exists in the engine; the long cooldown keeps this a
    // once-per-spell moment rather than an annual rerun.
    conditions: { bands: ['senior'], clubTiers: ['israeli_alef'] },
    slots: ['early'],
    weight: 12,
    cooldownSeasons: 6,
    choices: [
      {
        id: 'embrace',
        label: 'להיכנס בשתי הרגליים - זה המועדון שלך עכשיו',
        risk: 'safe',
        outcomes: [
          {
            id: 'respected',
            baseWeight: 100,
            tone: 'good',
            text: 'נשארת אחרי האימון לעזור לקפל את השערים. עד סוף השבוע כולם יודעים את השם שלך.',
            effects: { coachTrust: 8, confidence: 5, maccabism: 0 },
          },
        ],
      },
      {
        id: 'distance',
        label: 'לשמור מרחק. אתה לא מתכנן להישאר כאן',
        risk: 'risky',
        outcomes: [
          {
            id: 'motivated',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'הרעב יישאר, אבל חדר ההלבשה ירגיש את זה',
            text: 'שמרת על הרעב. חדר ההלבשה מרגיש את המרחק, והמאמן רואה הכול.',
            effects: { form: 4, coachTrust: -6, pressure: 3 },
          },
          {
            id: 'isolated',
            baseWeight: 55,
            tone: 'bad',
            preview: 'תישאר לבד בקבוצה שיודעת להיות משפחה',
            text: 'בקבוצה כזאת אין אנונימיות. מי שלא בפנים - בחוץ, וזה מורגש בכל מסירה.',
            effects: { confidence: -6, coachTrust: -8 },
          },
        ],
      },
    ],
  },
  {
    id: 'alef_veteran_teammate',
    kicker: 'אחרי אימון ערב',
    title: 'הוותיק שראה הכול',
    description:
      'בן 38, שיחק פעם בליגת העל, נשאר כאן כי זה הבית. הוא מתיישב לידך: "אני יודע בדיוק מה אתה חושב על המקום הזה."',
    category: 'people',
    conditions: { bands: ['senior'], clubTiers: ['israeli_alef'], maxAge: 26 },
    weight: 9,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'listen',
        label: 'לשבת ולהקשיב',
        risk: 'safe',
        outcomes: [
          {
            id: 'wisdom',
            baseWeight: 100,
            tone: 'good',
            text: '"מי שמכבד את הליגה הזאת, הליגה הזאת מקדמת אותו. מי שמזלזל - נשאר." אתה זוכר כל מילה.',
            effects: { confidence: 4, discipline: 5, coachTrust: 4 },
          },
        ],
      },
      {
        id: 'polite_nod',
        label: 'להנהן בנימוס ולהמשיך הלאה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'missed',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הוא מחייך, קם והולך. רק בעוד כמה שנים תבין מה פספסת באותו ערב.',
            effects: {},
          },
        ],
      },
    ],
  },
  {
    id: 'alef_scout_in_the_stand',
    kicker: 'אחרי ניצחון שלישי ברצף',
    title: 'מישהו רושם ביציע',
    description:
      'איש עם מחברת ישב ביציע כל המשחק ורשם. אחרי השריקה הוא שאל את המאמן רק שאלה אחת - את השם שלך.',
    category: 'opportunity',
    conditions: {
      bands: ['senior'],
      clubTiers: ['israeli_alef'],
      requiresAppearance: true,
      minForm: 62,
      maxAge: 27,
    },
    slots: ['mid', 'late'],
    weight: 10,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'keep_working',
        label: 'להמשיך לעבוד. אם זה אמיתי - זה יגיע',
        risk: 'safe',
        outcomes: [
          {
            id: 'noticed',
            baseWeight: 100,
            tone: 'good',
            text: 'לא שינית כלום, וזה בדיוק מה שהרשים. השם שלך מתחיל לעלות בשיחות של ליגות למעלה.',
            effects: { reputation: 6, transferChance: 0.15, confidence: 4 },
          },
        ],
      },
      {
        id: 'press_too_hard',
        label: 'לשחק בשבילו במשחק הבא',
        risk: 'risky',
        outcomes: [
          {
            id: 'forced',
            baseWeight: 55,
            tone: 'bad',
            preview: 'תכריח מהלכים שלא שם ותיראה בדיוק כמו שחקן ליגה א׳',
            text: 'ניסית להראות הכול בתשעים דקות. יצא פחות מהרגיל, והמחברת נסגרה מוקדם.',
            effects: { form: -5, confidence: -5 },
          },
          {
            id: 'showcase',
            baseWeight: 45,
            tone: 'good',
            preview: 'תתפוס משחק ענק בדיוק כשצריך',
            text: 'יש ערבים שבהם הכול מתחבר. זה היה אחד מהם, והוא ראה את כולו.',
            effects: { reputation: 8, transferChance: 0.2, form: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'alef_promotion_project',
    kicker: 'פגישה עם ההנהלה',
    title: 'הפרויקט: לעלות ליגה',
    description:
      'יושב הראש פורס את התוכנית: תקציב מוגדל, שני חיזוקים, ומטרה אחת - הליגה הלאומית. "אתה במרכז התוכנית הזאת."',
    category: 'team',
    conditions: {
      bands: ['senior'],
      clubTiers: ['israeli_alef'],
      minRoleValue: 55,
      promotionRace: true,
    },
    slots: ['mid'],
    weight: 10,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'commit',
        label: 'להתחייב לפרויקט',
        risk: 'balanced',
        outcomes: [
          {
            id: 'leader',
            baseWeight: 100,
            tone: 'good',
            text: 'אמרת שאתה נשאר עד שהמועדון עולה. משהו השתנה באיך שכולם מסתכלים עליך.',
            effects: { coachTrust: 8, roleValue: 5, maccabism: 0, flags: ['loyalty_moment'] },
          },
        ],
      },
      {
        id: 'stay_open',
        label: 'להשאיר את האופציות פתוחות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'professional',
            baseWeight: 100,
            tone: 'neutral',
            text: 'לא הבטחת כלום. מקצועי, הגיוני - וקצת קר. ההנהלה רשמה לעצמה.',
            effects: { transferChance: 0.1, coachTrust: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'alef_day_job_teammate',
    kicker: 'נסיעה משותפת לאימון',
    title: 'שש בבוקר, משמרת. שש בערב, אימון',
    description:
      'החלוץ שלכם קם בחמש לעבודה בנמל, ובערב הוא רץ יותר מכולם. "כדורגל זה החלק הקל של היום," הוא צוחק.',
    category: 'people',
    conditions: { bands: ['senior'], clubTiers: ['israeli_alef'] },
    weight: 7,
    cooldownSeasons: 5,
    choices: [
      {
        id: 'respect',
        label: 'לשאול אותו איך הוא מחזיק את זה',
        risk: 'safe',
        outcomes: [
          {
            id: 'perspective',
            baseWeight: 100,
            tone: 'good',
            text: '"בגלל שזה לא מובן מאליו." אתה חוזר הביתה ומסתכל אחרת על כל דקה שאתה מקבל על הדשא.',
            effects: { discipline: 5, confidence: 3, form: 2 },
          },
        ],
      },
      {
        id: 'offer_help',
        label: 'להציע לו טרמפ קבוע לאימונים',
        risk: 'safe',
        outcomes: [
          {
            id: 'bond',
            baseWeight: 100,
            tone: 'good',
            text: 'חצי שעה ברכב, פעמיים בשבוע. עד סוף העונה הוא המסנן של כל החלטה גדולה שלך.',
            effects: { confidence: 4, coachTrust: 3, discipline: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'alef_higher_division_calls',
    kicker: 'הסוכן על הקו',
    title: 'ליגה למעלה שמעה עליך',
    description:
      '"מועדון מהלאומית עוקב אחריך שלושה משחקים. הם רוצים לדבר. אבל אתה באמצע עונה, ובאמצע משהו כאן."',
    category: 'transfer',
    conditions: {
      bands: ['senior'],
      clubTiers: ['israeli_alef'],
      minRoleValue: 58,
      minReputation: 22,
    },
    slots: ['mid', 'late'],
    weight: 8,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'open_door',
        label: 'לבקש מהסוכן להתקדם בשיחות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'market_moves',
            baseWeight: 100,
            tone: 'neutral',
            text: 'השיחות מתחילות. בינתיים - כל מסירה שלך נמדדת פעמיים.',
            effects: { transferChance: 0.3, pressure: 5 },
          },
        ],
      },
      {
        id: 'finish_the_job',
        label: 'לסגור את זה: קודם מסיימים את העונה כאן',
        risk: 'safe',
        outcomes: [
          {
            id: 'grounded',
            baseWeight: 100,
            tone: 'good',
            text: 'אמרת שבקיץ מדברים. חדר ההלבשה שמע על זה, וזה שווה יותר מכל נאום.',
            effects: { coachTrust: 6, form: 3, flags: ['loyalty_moment'] },
          },
        ],
      },
    ],
  },
];

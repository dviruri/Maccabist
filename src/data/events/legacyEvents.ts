import type { GameEvent } from '../../types';

/**
 * Maccabi Legacy events (v0.6, Phase 64) - a small set, not a flood.
 *
 * The milestones themselves are engine facts announced at settlement; these are the HUMAN
 * moments around them, gated on the memories the milestones record. None of them can grant
 * appearances, trophies or records (Phase 65) - decisions here move confidence, pressure,
 * leadership, and occasionally Maccabism where the moment is explicitly about the fans or the
 * club's identity (Phase 66: the achievement does not move Maccabism; the chosen response to
 * the crowd may).
 */

export const LEGACY_EVENTS: GameEvent[] = [
  /* ---------------- the hundredth ---------------- */
  {
    id: 'leg_century_night',
    kicker: 'אחרי המשחק המאה',
    title: 'מועדון המאה',
    description:
      'מאה הופעות רשמיות בירוק. אחרי המשחק מחכים לך שלט מהיציע, חולצה ממוסגרת מהמועדון, ושורה של ילדים מהאקדמיה שרוצים צילום. פתאום אתה מבין איך זה נראה מהצד השני.',
    category: 'team',
    conditions: {
      atMaccabiSenior: true,
      requiresMemory: ['maccabi_century'],
      memoryMaxSeasonsAgo: 1,
    },
    slots: ['early', 'mid'],
    weight: 12,
    oncePerCareer: true,
    choices: [
      {
        id: 'embrace_it',
        label: 'לעצור רגע. להרגיש את זה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'moment_kept',
            baseWeight: 100,
            tone: 'good',
            preview: 'רגע שנשאר איתך - והקהל רואה שאתה אחד מהם',
            text: 'אתה נשאר על הדשא אחרי שכולם נכנסו, מסתכל על היציע המתרוקן. מאה משחקים במקום שחלמת עליו. הקהל שנשאר מוחא כפיים - הם יודעים לזהות מי מרגיש את זה באמת.',
            maccabiRelevance: 'fans',
            effects: { maccabism: 3, confidence: 4, pressure: -3 },
          },
        ],
      },
      {
        id: 'next_game',
        label: 'יפה, אבל יש משחק בשבת',
        risk: 'safe',
        outcomes: [
          {
            id: 'professional',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'מקצוענות קרה - הראש נשאר בעונה',
            text: 'אתה מודה לכולם ומתקדם הלאה. מאה זה מספר, והעונה עוד לא הסתיימה. יש בזה משהו קר - ויש בזה משהו שמאמנים אוהבים.',
            effects: { discipline: 3, coachTrust: 3 },
          },
        ],
      },
    ],
  },

  /* ---------------- entering the ten ---------------- */
  {
    id: 'leg_top10_papers',
    kicker: 'העיתונים סופרים',
    title: 'בין עשרת הגדולים',
    description:
      'כתבה כפולה בסוף השבוע: השם שלך ברשימה אחת עם חרזי, קטן ובוקולי. מהיום כל הופעה שלך היא גם שאלה היסטורית - כמה רחוק זה יכול ללכת?',
    category: 'pressure',
    conditions: {
      atMaccabiSenior: true,
      requiresMemory: ['maccabi_top10_appearances'],
      memoryMaxSeasonsAgo: 1,
    },
    slots: ['early', 'mid'],
    weight: 11,
    oncePerCareer: true,
    choices: [
      {
        id: 'chase_history',
        label: 'לרדוף את ההיסטוריה בקול',
        risk: 'risky',
        outcomes: [
          {
            id: 'fuel',
            baseWeight: 55,
            tone: 'good',
            preview: 'המטרה הגדולה תדליק אותך - והקהל ידלק איתך',
            text: 'אתה אומר לעיתון בדיוק מה שאתה חושב: "באתי לשבור את השיא." היציע מאמץ את המשפט לשלט. יש שחקנים שלחץ כזה מרים.',
            effects: { form: 4, confidence: 5, pressure: 4 },
          },
          {
            id: 'weight',
            baseWeight: 45,
            tone: 'bad',
            preview: 'או שכל כותרת תהפוך למשקל על הרגליים',
            text: 'המשפט רודף אותך. כל משחק בינוני הופך לכתבה על "המרדף שנתקע". לפעמים עדיף לתת למספרים לדבר לבד.',
            effects: { pressure: 7, form: -3 },
          },
        ],
      },
      {
        id: 'quiet_road',
        label: 'להמשיך בשקט. המספרים ידברו',
        risk: 'safe',
        outcomes: [
          {
            id: 'steady',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'בלי כותרות - רק עוד שבת ועוד הופעה',
            text: '"אני חושב רק על המשחק הבא," אתה אומר, והכתב מתאכזב. אבל ככה נבנים המספרים הגדולים באמת - שבת אחרי שבת, בלי רעש.',
            effects: { discipline: 3, pressure: -3 },
          },
        ],
      },
    ],
  },

  /* ---------------- the record itself ---------------- */
  {
    id: 'leg_record_night',
    kicker: 'הערב שאחרי',
    title: 'השיא שייך לך',
    description:
      'שיא ההופעות של מכבי חיפה. המועדון עוצר משחק שלם בדקה שמספרה כמספר ההופעות שלך, סמי עופר קם על הרגליים, ואלון חרזי שולח ברכה. השם שלך עכשיו בראש הרשימה שגדלת עליה.',
    category: 'rare',
    rarity: 'rare',
    conditions: {
      atMaccabiSenior: true,
      requiresMemory: ['maccabi_appearance_record'],
      memoryMaxSeasonsAgo: 1,
    },
    slots: ['mid', 'late'],
    weight: 14,
    oncePerCareer: true,
    choices: [
      {
        id: 'to_the_crowd',
        label: 'לתת את הערב הזה לקהל',
        risk: 'balanced',
        outcomes: [
          {
            id: 'eternal',
            baseWeight: 100,
            tone: 'good',
            preview: 'רגע שנכנס להיסטוריה של המועדון - ושלך',
            text: 'אתה לוקח את המיקרופון ואומר משפט אחד: "השיא הזה לא שלי. הוא של כל מי שבא לכאן כל שבת." היציע עונה בשאגה שתזכור עד יומך האחרון.',
            maccabiRelevance: 'fans',
            effects: { maccabism: 4, confidence: 5, leadership: 4, reputation: 3 },
          },
        ],
      },
      {
        id: 'family_night',
        label: 'לחגוג בשקט, עם מי שהיה שם מההתחלה',
        risk: 'safe',
        outcomes: [
          {
            id: 'private',
            baseWeight: 100,
            tone: 'good',
            preview: 'ערב פרטי - השיא ציבורי, הרגע שלך',
            text: 'אחרי הטקס אתה נעלם מהמסיבה ויושב עם המשפחה שהסיעה אותך לאימונים עשרים שנה. השיא ציבורי. הרגע הזה שלך.',
            effects: { confidence: 4, pressure: -4 },
          },
        ],
      },
    ],
  },

  /* ---------------- the armband ---------------- */
  {
    id: 'leg_first_band_talk',
    kicker: 'שיחה עם המאמן',
    title: 'העונה הראשונה עם הסרט',
    description:
      'המאמן מזמין אותך לשיחה על מה שהסרט אומר אצלו: לא רק להוביל את החימום. לדבר כשקשה, לספוג כשמפסידים, להיות הכתובת של הצעירים. "קפטן של מכבי," הוא אומר, "זה תפקיד שנמדד בשנים."',
    category: 'team',
    conditions: {
      atMaccabiSenior: true,
      requiresMemory: ['first_maccabi_captaincy'],
      memoryMaxSeasonsAgo: 1,
    },
    slots: ['early'],
    weight: 11,
    oncePerCareer: true,
    choices: [
      {
        id: 'take_it_all',
        label: 'לקחת את כל מה שהתפקיד דורש',
        risk: 'balanced',
        outcomes: [
          {
            id: 'grew_into_it',
            baseWeight: 70,
            tone: 'good',
            preview: 'הסרט יהפוך לחלק ממך - מנהיגות אמיתית נבנית ככה',
            text: 'אתה מתחיל להגיע ראשון ולצאת אחרון, לדבר עם מי ששקט מדי, לעמוד מול התקשורת אחרי הפסדים. לאט לאט הסרט מפסיק להיות בד ומתחיל להיות אתה.',
            effects: { leadership: 6, coachTrust: 5, discipline: 3 },
          },
          {
            id: 'heavy_start',
            baseWeight: 30,
            tone: 'neutral',
            preview: 'ההתחלה תהיה כבדה - תפקיד כזה לא לובשים ביום אחד',
            text: 'החודשים הראשונים מלמדים אותך כמה המשחק שלך עצמו סובל כשאתה אחראי על כולם. זה ישתפר. קפטנים אמיתיים לומדים.',
            effects: { leadership: 3, pressure: 4, form: -2 },
          },
        ],
      },
      {
        id: 'lead_by_playing',
        label: 'להוביל בעיקר דרך המשחק שלך',
        risk: 'safe',
        outcomes: [
          {
            id: 'quiet_captain',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'קפטן שקט - הדוגמה האישית כשפה',
            text: 'אתה לא נואם. אתה רץ יותר מכולם, וזה הנאום. יש חדרי הלבשה שזה בדיוק מה שהם צריכים - ויש רגעים שידרשו ממך יותר.',
            effects: { leadership: 3, form: 2 },
          },
        ],
      },
    ],
  },

  /* ---------------- the veteran and the kids ---------------- */
  {
    id: 'leg_academy_visit',
    kicker: 'ביקור במחלקה',
    title: 'הילדים שואלים על הדרך',
    description:
      'המועדון מבקש ממך לדבר מול קבוצת הילדים א׳. חמישים זוגות עיניים מסתכלים על מי שנמצא ברשימות שהם משננים בעל פה. אחד מהם שואל: "מה הכי חשוב בדרך?"',
    category: 'team',
    conditions: {
      atMaccabiSenior: true,
      requiresMemory: ['maccabi_top10_appearances'],
      minAge: 29,
    },
    slots: ['mid'],
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'honest_answer',
        label: 'לענות את האמת, גם החלקים הקשים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'passed_on',
            baseWeight: 100,
            tone: 'good',
            preview: 'שיחה שילד אחד לפחות יזכור בעוד עשרים שנה',
            text: 'אתה מספר גם על העונות הרעות, גם על הספסל, גם על הלילות שרצית לעזוב. בסוף ילד קטן בא לבקש חתימה ואומר שהוא ישחק פה יום אחד. אולי הוא צודק.',
            maccabiRelevance: 'people',
            effects: { maccabism: 2, leadership: 4, confidence: 3 },
          },
        ],
      },
      {
        id: 'short_visit',
        label: 'ביקור קצר ומנומס',
        risk: 'safe',
        outcomes: [
          {
            id: 'polite',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'עשית את המוטל - הראש נשאר במגרש',
            text: 'חצי שעה, כמה תמונות, וחזרה לאימון. עשית את שלך. הדרך שלך עוד באמצע, ויש לך שיא לרדוף.',
            effects: { pressure: -2 },
          },
        ],
      },
    ],
  },

  /* ---------------- the star asked about home ---------------- */
  {
    id: 'leg_star_abroad_asked',
    kicker: 'ראיון לתקשורת הישראלית',
    title: 'שואלים אותך על מכבי',
    description:
      'באמצע העונה הגדולה שלך באירופה, כתב ישראלי שואל את השאלה שתמיד חוזרת: "ההופעות הספורות שלך במכבי - זה פרק סגור, או חוב פתוח?"',
    category: 'pressure',
    conditions: {
      clubScope: 'formerMaccabi',
      abroad: true,
      minReputation: 68,
      playedForMaccabi: true,
    },
    slots: ['mid'],
    weight: 8,
    oncePerCareer: true,
    choices: [
      {
        id: 'open_debt',
        label: 'חוב פתוח. יום אחד אשלם אותו',
        risk: 'balanced',
        outcomes: [
          {
            id: 'door_ajar',
            baseWeight: 100,
            tone: 'good',
            preview: 'הכותרת בחיפה תהיה חמה - והדלת תישאר פתוחה',
            text: '"לא סיימתי שם," אתה אומר, והמשפט רץ בחיפה כמו אש. ביציע כבר מדמיינים את החזרה. משפטים כאלה זוכרים - לטוב ולחובה.',
            maccabiRelevance: 'return',
            effects: { maccabism: 3, pressure: 2 },
          },
        ],
      },
      {
        id: 'closed_chapter',
        label: 'פרק יפה שנגמר. אני פה עכשיו',
        risk: 'safe',
        outcomes: [
          {
            id: 'honest_distance',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'תשובה כנה וקרה - הקריירה שלך במקום אחר',
            text: 'אתה עונה בכנות: הקריירה שלך כאן עכשיו. בחיפה יקראו את זה בעצב, אבל יעריכו שלא מכרת להם סיפורים.',
            effects: { discipline: 2 },
          },
        ],
      },
    ],
  },

  /* ---------------- the returning legend's first home game ---------------- */
  {
    id: 'leg_return_first_home',
    kicker: 'המשחק הביתי הראשון מאז',
    title: 'סמי עופר מקבל אותך חזרה',
    description:
      'הופעה ראשונה בבית מאז החזרה. כשהקריין מגיע לשם שלך בהרכב, היציע לא נותן לו לסיים את המשפט. יש חזרות שהן עסקה - ויש כאלה שהן תיקון.',
    category: 'team',
    conditions: {
      atMaccabiSenior: true,
      requiresMemory: ['returned_home'],
      memoryMaxSeasonsAgo: 1,
      minMaccabism: 40,
      requiresAppearance: true,
    },
    slots: ['early', 'mid'],
    weight: 10,
    oncePerCareer: true,
    choices: [
      {
        id: 'give_back',
        label: 'לשים את הערב הזה על הכתפיים',
        risk: 'risky',
        outcomes: [
          {
            id: 'homecoming_hero',
            baseWeight: 55,
            tone: 'good',
            preview: 'ערב חזרה מושלם - מהסוג שנכנס לסרטוני המועדון',
            text: 'אתה משחק כאילו לא עברו השנים, והיציע עונה על כל נגיעה. בסוף המשחק אתה זורק את החולצה לקהל. ערבים כאלה הם הסיבה שחוזרים.',
            maccabiRelevance: 'fans',
            effects: { maccabism: 4, confidence: 6, form: 4 },
          },
          {
            id: 'legs_shaking',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'או שההתרגשות תשתלט - יש ערבים גדולים מדי',
            text: 'הרגליים כבדות מרוב רצון. המשחק עצמו בינוני, אבל הקהל שר את שמך עד הסוף - הם באו לקבל אותך, לא לשפוט אותך.',
            maccabiRelevance: 'fans',
            effects: { maccabism: 2, pressure: 3 },
          },
        ],
      },
      {
        id: 'just_football',
        label: 'להוריד ראש ולשחק כדורגל',
        risk: 'safe',
        outcomes: [
          {
            id: 'solid_return',
            baseWeight: 100,
            tone: 'good',
            preview: 'חזרה עניינית ויציבה - הרומנטיקה תחכה',
            text: 'משחק צנוע ונכון, בלי דרמות. הרומנטיקה יכולה לחכות; קודם כל להוכיח שחזרת בתור שחקן, לא בתור סיפור.',
            effects: { form: 3, coachTrust: 4 },
          },
        ],
      },
    ],
  },
];

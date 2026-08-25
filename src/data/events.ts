import type { GameEvent } from '../types';

/**
 * Data-driven event pool.
 *
 * Adding an event = adding an object to this array. Nothing else in the codebase changes.
 * `conditions` decide when it can appear, `weight` how often, and every choice should carry
 * a real trade-off - there should almost never be an obviously correct button.
 */

export const EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* מחלקת ילדים (9-12)                                                */
  /* ================================================================= */
  {
    id: 'kids_older_group',
    kicker: 'מגרשי האימונים, יום שלישי בערב',
    title: 'המאמן רוצה להעלות אותך שנתון',
    description:
      'אחרי האימון המאמן קורא לך הצידה. "אתה קטן מהם בשנה, אבל אתה מבין את המשחק יותר טוב. אני רוצה לנסות אותך עם הגדולים." בבית אומרים לך שכדאי להיזהר - שם לא יחכו לך.',
    conditions: { stages: ['kids'], once: true },
    weight: 10,
    choices: [
      {
        id: 'go_up',
        label: 'לעלות לשנתון הגדול',
        hint: 'מתפתחים מהר יותר, אבל תשחק פחות',
        effects: { pressure: 6 },
        outcomes: [
          {
            weight: 60,
            tone: 'good',
            text: 'קשה לך בהתחלה, אבל אחרי חודשיים אתה מדביק את הקצב. הקפיצה עשתה לך טוב.',
            effects: { ability: 3.5, confidence: 4, potential: 1.5 },
          },
          {
            weight: 40,
            tone: 'bad',
            text: 'הם גדולים ממך פיזית ואתה מוצא את עצמך רץ אחרי הכדור. חוזר לשנתון שלך קצת שבור.',
            effects: { ability: 1, confidence: -8 },
          },
        ],
      },
      {
        id: 'stay',
        label: 'להישאר עם השנתון שלי',
        hint: 'שחקן מוביל בקבוצה שלך, ביטחון גבוה',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה נשאר החזק בקבוצה, משחק את כל הדקות ונהנה מכל רגע. מתפתח לאט אבל בטוח.',
            effects: { ability: 1.5, confidence: 6, statusValue: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_work_harder',
    kicker: 'שיחה קצרה ליד הגדר',
    title: '"מוכשר זה לא מספיק"',
    description:
      'המאמן אומר לך את זה בלי לרכך: "יש לך כישרון. יש עוד עשרה כמוך בליגה. ההבדל יהיה מה אתה עושה כשאף אחד לא מסתכל."',
    conditions: { stages: ['kids', 'youth'] },
    weight: 9,
    choices: [
      {
        id: 'extra_training',
        label: 'להישאר אחרי כל אימון',
        hint: 'יכולת, אבל שוחקים את הגוף',
        outcomes: [
          {
            weight: 70,
            tone: 'good',
            text: 'שעה נוספת כל יום מול הקיר. הנגיעה הראשונה שלך הופכת לנשק.',
            effects: { ability: 3, discipline: 6, injuryRisk: 3 },
          },
          {
            weight: 30,
            tone: 'bad',
            text: 'העומס מוקדם מדי לגוף הצעיר שלך. כאבי גדילה בברכיים מלווים אותך כל העונה.',
            effects: { ability: 1, injuryRisk: 8, form: -4 },
          },
        ],
      },
      {
        id: 'balance',
        label: 'לשמור על איזון',
        hint: 'ילדות, חברים, ראש נקי',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה נשאר ילד. מגיע לאימונים שמח, וזה נראה על המגרש.',
            effects: { ability: 1, confidence: 5, pressure: -6 },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_no_minutes',
    kicker: 'שבת בבוקר',
    title: 'יושב על הספסל',
    description:
      'שלושה משחקים ברצף שאתה נכנס לעשר דקות. אבא שלך שואל אם לדבר עם המאמן. אתה לא בטוח שאתה רוצה שידבר.',
    conditions: { stages: ['kids', 'youth'], maxStatusValue: 30 },
    weight: 8,
    choices: [
      {
        id: 'dad_talks',
        label: 'שאבא ידבר עם המאמן',
        hint: 'אולי תקבל דקות, אולי תיצרב',
        outcomes: [
          {
            weight: 45,
            tone: 'good',
            text: 'המאמן מקשיב ונותן לך הרכב במשחק הבא. אתה מנצל.',
            effects: { statusValue: 5, confidence: 4 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'המאמן לא אוהב הורים על הגדר. הדקות שלך דווקא מתקצרות.',
            effects: { statusValue: -4, confidence: -5 },
          },
        ],
      },
      {
        id: 'shut_up_work',
        label: 'לשתוק ולעבוד',
        hint: 'לוקח יותר זמן, בונה אופי',
        outcomes: [
          {
            weight: 60,
            tone: 'good',
            text: 'המאמן שם לב שאתה האחרון שעוזב את המגרש. הדקות מגיעות לבד.',
            effects: { statusValue: 4, discipline: 6, ability: 1.5 },
          },
          {
            weight: 40,
            tone: 'neutral',
            text: 'העונה נגמרת בלי שינוי אמיתי, אבל אתה יודע שלא ויתרת.',
            effects: { discipline: 5, confidence: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_first_stadium',
    kicker: 'סמי עופר, אליפות',
    title: 'הפעם הראשונה ביציע',
    description:
      'המחלקה מקבלת כרטיסים לדרבי. 30 אלף איש, האורות, השירים. באוטובוס בדרך חזרה אתה לא מפסיק לדבר.',
    conditions: { stages: ['kids'], once: true, atMaccabi: true },
    weight: 8,
    choices: [
      {
        id: 'dream',
        label: 'להבטיח לעצמך שתשחק שם',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'משהו בך משתנה באותו ערב. מהיום זה כבר לא רק כיף - זו מטרה.',
            effects: { maccabism: 8, confidence: 4, pressure: 3 },
          },
        ],
      },
      {
        id: 'enjoy',
        label: 'פשוט ליהנות מהערב',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה שר עם כולם, מאבד את הקול, וישן על הכתף של אבא באוטובוס.',
            effects: { maccabism: 5, pressure: -4, confidence: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_travel',
    kicker: 'שתי אוטובוסים כל יום',
    title: 'הדרך ארוכה',
    description:
      'הנסיעות לאימונים אוכלות לך שלוש שעות ביום. קבוצה קטנה ליד הבית מציעה לך מקום, שעה פחות נסיעה, ומשכורת קטנה להורים.',
    conditions: { stages: ['kids', 'youth'], atMaccabi: true, once: true },
    weight: 6,
    choices: [
      {
        id: 'stay_maccabi',
        label: 'להמשיך לנסוע. זו מכבי חיפה.',
        hint: 'מכביסטיות, אבל עייפות',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אתה עושה את הדרך כל יום, חורף וקיץ. במחלקה שמים לב מי באמת רוצה.',
            effects: { maccabism: 9, discipline: 5, form: -2 },
          },
        ],
      },
      {
        id: 'move_local',
        label: 'לעבור לקבוצה הקרובה',
        hint: 'עדיף לגוף, פחות לחלום',
        outcomes: [
          {
            weight: 100,
            tone: 'bad',
            text: 'אתה מתאמן רענן ומשחק הרבה, אבל הרמה נמוכה יותר וכולם יודעים איפה היית אמור להיות.',
            effects: { maccabism: -14, ability: 1, transferTo: 'hapoel_afula', statusValue: 8 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* מחלקת נוער (13-15)                                                */
  /* ================================================================= */
  {
    id: 'youth_agent',
    kicker: 'שיחת טלפון לסלון',
    title: 'סוכן פונה למשפחה',
    description:
      'סוכן מוכר מתקשר להורים שלך. "אני עובד עם שלושה שחקנים בליגת העל. אני רוצה לייצג את הבן שלכם." אמא שלך לא בטוחה. אבא כבר מחפש אותו בגוגל.',
    conditions: { stages: ['youth', 'breakthrough_youth'], once: true },
    weight: 9,
    choices: [
      {
        id: 'sign',
        label: 'לחתום עם הסוכן',
        hint: 'פותח דלתות, מוסיף רעש',
        effects: { flags: ['agent_signed'] },
        outcomes: [
          {
            weight: 65,
            tone: 'good',
            text: 'הוא מכניס אותך למחנה אימונים בחו״ל ומדבר עליך בכל מקום. השם שלך מתחיל להסתובב.',
            effects: { reputation: 7, ability: 1, pressure: 5 },
          },
          {
            weight: 35,
            tone: 'bad',
            text: 'הוא מבטיח הרבה ומגיע מעט. במחלקה לא אוהבים את השיחות שלו עם עיתונאים.',
            effects: { reputation: 3, maccabism: -4, statusValue: -2 },
          },
        ],
      },
      {
        id: 'wait',
        label: 'לחכות. קודם כדורגל.',
        hint: 'פחות רעש, פחות הזדמנויות',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'ההורים מודים לו בנימוס. אתה ממשיך להתאמן בשקט, בלי אף אחד שמנפח לך את הראש.',
            effects: { pressure: -5, ability: 1.5, discipline: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_guaranteed_spot',
    kicker: 'ההצעה שקשה לסרב לה',
    title: 'קבוצה אחרת מבטיחה לך הרכב',
    description:
      'מחלקת נוער של מועדון מתחרה פונה אליך ישירות: "אצלנו אתה משחק 90 דקות כל שבוע. במכבי חיפה תמיד תהיה בתחרות." אתה יודע שהם צודקים לגבי התחרות.',
    conditions: { stages: ['youth'], atMaccabi: true, maxStatusValue: 45, once: true },
    weight: 8,
    choices: [
      {
        id: 'stay',
        label: 'להישאר ולהילחם על המקום',
        hint: 'קשה יותר, אבל זה הבית',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 55,
            tone: 'good',
            text: 'אתה נשאר. אחרי חצי עונה אתה חוטף את המקום ממי שהיה לפניך.',
            effects: { maccabism: 8, statusValue: 7, ability: 2 },
          },
          {
            weight: 45,
            tone: 'neutral',
            text: 'אתה נשאר וממשיך להיאבק על דקות. לא קל, אבל אתה עדיין כאן.',
            effects: { maccabism: 8, ability: 1, confidence: -3 },
          },
        ],
      },
      {
        id: 'leave',
        label: 'לעבור. דקות זה מה שחשוב עכשיו.',
        hint: 'תשחק הרבה - אבל תצא מהמסלול',
        effects: { flags: ['betrayal_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה משחק כל דקה אפשרית ומתפתח, אבל בחיפה כבר לא סופרים אותך כאחד משלהם.',
            effects: {
              maccabism: -18,
              ability: 3,
              statusValue: 14,
              transferTo: 'maccabi_netanya',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_gym',
    kicker: 'חדר הכושר החדש',
    title: 'תוכנית כוח',
    description:
      'מאמן הכושר בנה לך תוכנית אישית. זה אומר לקום בשש בבוקר, גם בחופש, גם בחורף.',
    conditions: { stages: ['youth', 'breakthrough_youth'] },
    weight: 7,
    choices: [
      {
        id: 'commit',
        label: 'לעשות הכול לפי הספר',
        outcomes: [
          {
            weight: 75,
            tone: 'good',
            text: 'הגוף שלך משתנה תוך עונה. אתה כבר לא נזרק מהכדור.',
            effects: { ability: 2.5, injuryRisk: -6, discipline: 6 },
          },
          {
            weight: 25,
            tone: 'neutral',
            text: 'אתה מתחזק, אבל מגיע לחלק מהאימונים שחוק.',
            effects: { ability: 1.5, form: -3, injuryRisk: -2 },
          },
        ],
      },
      {
        id: 'partial',
        label: 'לעשות את זה בקצב שלי',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה מגיע לרוב האימונים. לא כולם, אבל רוב.',
            effects: { ability: 1, injuryRisk: -1, discipline: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_friends',
    kicker: 'סוף שבוע',
    title: 'החברים מבחוץ',
    description:
      'כל החברים מבית הספר יוצאים הערב. יש לך משחק בעשר בבוקר. אף אחד לא יידע חוץ ממך.',
    conditions: { stages: ['youth', 'breakthrough_youth'] },
    weight: 7,
    choices: [
      {
        id: 'go_out',
        label: 'לצאת. גם זה חלק מהחיים.',
        outcomes: [
          {
            weight: 45,
            tone: 'neutral',
            text: 'ערב מצוין, בוקר פחות. שיחקת בינוני ואף אחד לא אמר כלום.',
            effects: { discipline: -5, form: -4, pressure: -6 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'המאמן מריח את זה מרחוק. אתה מוצא את עצמך בספסל למשחק הבא.',
            effects: { discipline: -8, statusValue: -4, confidence: -3 },
          },
        ],
      },
      {
        id: 'stay_home',
        label: 'להישאר בבית',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אתה ישן שמונה שעות ומגיע רענן. במשחק הזה אתה הכי טוב על המגרש.',
            effects: { discipline: 6, form: 5, ability: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_scout',
    kicker: 'איש עם מחברת ביציע',
    title: 'צופה מחו״ל בהופעה',
    description:
      'במשחק מול מכבי תל אביב יושב ביציע צופה של מועדון אירופי. הוא לא בא בשבילך - אבל הוא כאן.',
    conditions: { stages: ['youth', 'breakthrough_youth'], minAbility: 45 },
    weight: 6,
    choices: [
      {
        id: 'show_off',
        label: 'לשחק בשביל להרשים',
        hint: 'או שתבלוט, או שתיראה אנוכי',
        outcomes: [
          {
            weight: 40,
            tone: 'good',
            text: 'שני כדורים שהוצאת מהכובע נכנסו למחברת שלו. השם שלך יוצא מהארץ.',
            effects: { reputation: 9, confidence: 4 },
          },
          {
            weight: 60,
            tone: 'bad',
            text: 'ניסית יותר מדי, איבדת כדורים, והמאמן החליף אותך בהפסקה.',
            effects: { reputation: 1, statusValue: -3, confidence: -5 },
          },
        ],
      },
      {
        id: 'play_normal',
        label: 'לשחק את המשחק שלי',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'משחק פשוט, נקי וחכם. הצופה לא כתב עליך הרבה, אבל המאמן שלך כן.',
            effects: { statusValue: 4, ability: 1.5, reputation: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_captain',
    kicker: 'לפני המשחק',
    title: 'הסרט של קבוצת הנוער',
    description: 'המאמן מחזיק את הסרט ומסתכל עליך. "אתה רוצה את זה?"',
    conditions: { stages: ['youth', 'breakthrough_youth'], minStatusValue: 35, once: true },
    weight: 6,
    choices: [
      {
        id: 'take',
        label: 'לקחת את הסרט',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אתה לומד לדבר בחדר הלבשה. זה משנה איך מסתכלים עליך בכל המועדון.',
            effects: { statusValue: 7, maccabism: 5, pressure: 6, confidence: 3 },
          },
        ],
      },
      {
        id: 'decline',
        label: 'לוותר. אני מדבר במגרש.',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה מוריד את הראש וממשיך לעבוד. פחות אחריות, פחות עיניים.',
            effects: { pressure: -6, ability: 1.5 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* על סף הבוגרים (16-18)                                             */
  /* ================================================================= */
  {
    id: 'first_senior_training',
    kicker: 'הודעה בקבוצת הוואטסאפ',
    title: 'זימון לאימון הבוגרים',
    description:
      'מאמן הבוגרים ביקש אותך לאימון של יום חמישי. אתה עומד בחדר הלבשה שראית רק בטלוויזיה, ומחפש איפה לשים את התיק.',
    conditions: { stages: ['breakthrough_youth'], atMaccabi: true, minAbility: 45, once: true },
    weight: 12,
    choices: [
      {
        id: 'aggressive',
        label: 'להיכנס חזק. שידעו שהגעת.',
        hint: 'רושם גדול או חדר הלבשה עוין',
        outcomes: [
          {
            weight: 55,
            tone: 'good',
            text: 'חטפת כדור מהקפטן ולא התנצלת. אחרי האימון הוא טפח לך על הכתף.',
            effects: { statusValue: 8, ability: 2, confidence: 6 },
          },
          {
            weight: 45,
            tone: 'bad',
            text: 'נכנסת מאוחר בחריצה על שחקן מפתח. בחדר הלבשה הסבירו לך מה זה כבוד.',
            effects: { statusValue: -3, discipline: -4, confidence: -4 },
          },
        ],
      },
      {
        id: 'humble',
        label: 'לשתוק, ללמוד, לרוץ',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'הבאת את הכדורים, רצת הכי הרבה, ולא פתחת את הפה. המאמן ביקש אותך גם לשבוע הבא.',
            effects: { statusValue: 5, ability: 2.5, discipline: 5 },
          },
        ],
      },
    ],
  },
  {
    id: 'first_contract',
    kicker: 'משרד ההנהלה',
    title: 'חוזה מקצועני ראשון',
    description:
      'המועדון מניח על השולחן חוזה. לא סכום גדול, אבל זו הפעם הראשונה שכתוב שם "שחקן מקצועני". הסוכן אומר שאפשר לסחוט עוד.',
    conditions: { stages: ['breakthrough_youth'], atMaccabi: true, minAbility: 48, once: true },
    weight: 10,
    choices: [
      {
        id: 'sign_now',
        label: 'לחתום מיד',
        hint: 'המועדון יזכור שלא עשית בעיות',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'חתמת באותו יום. במועדון אוהבים שחקנים שלא הופכים כל דבר למשא ומתן.',
            effects: { maccabism: 8, statusValue: 5, confidence: 4 },
          },
        ],
      },
      {
        id: 'negotiate',
        label: 'לתת לסוכן לנהל משא ומתן',
        hint: 'תנאים טובים יותר, יחסים קרירים יותר',
        outcomes: [
          {
            weight: 55,
            tone: 'good',
            text: 'הסוכן משיג חוזה ארוך ותנאים מצוינים. ההנהלה חייכה בשיניים חשוקות.',
            effects: { reputation: 5, maccabism: -4, statusValue: 3 },
          },
          {
            weight: 45,
            tone: 'bad',
            text: 'המשא ומתן נמשך חודשיים. המאמן, שלא אוהב הסחות דעת, מוריד אותך לספסל.',
            effects: { maccabism: -6, statusValue: -5, reputation: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'big_game_chance',
    kicker: 'שעה לפני המשחק',
    title: 'ההרכב במשחק הגדול',
    description:
      'פציעה ברגע האחרון והמאמן קורא לך: "אתה מתחיל." מולך מכבי תל אביב, ואתה עוד לא בן 18.',
    conditions: {
      stages: ['breakthrough_youth', 'breakthrough'],
      atMaccabiSenior: true,
      once: true,
    },
    weight: 11,
    choices: [
      {
        id: 'simple',
        label: 'לשחק פשוט ולא להסתבך',
        outcomes: [
          {
            weight: 70,
            tone: 'good',
            text: 'משחק בוגר להפליא. אפס טעויות, והמאמן אמר במסיבת העיתונאים שיש למועדון שחקן.',
            effects: { statusValue: 8, ability: 2, confidence: 6, reputation: 5 },
          },
          {
            weight: 30,
            tone: 'neutral',
            text: 'נעלמת קצת מהמשחק, אבל לא עשית נזק. הוחלפת בדקה 70 עם מחיאות כפיים.',
            effects: { statusValue: 3, ability: 1, reputation: 2 },
          },
        ],
      },
      {
        id: 'brave',
        label: 'לקחת אחריות ולנסות דברים',
        outcomes: [
          {
            weight: 45,
            tone: 'good',
            text: 'החלטת לשחק בלי פחד, וזה עבד. היציע קם לך פעמיים והשם שלך בכל הכותרות.',
            effects: { statusValue: 12, ability: 2.5, confidence: 9, reputation: 10, maccabism: 4 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'איבדת כדור מסוכן שהוביל לשער. חיפשו אשם, ומצאו את הצעיר.',
            effects: { statusValue: -4, confidence: -9, pressure: 7 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_first_injury',
    kicker: 'אימון רגיל, יום שני',
    title: 'הברך מסתובבת',
    description:
      'נחיתה לא נכונה. הרופא מדבר לאט מדי בשביל שזה יהיה משהו קטן. אתה בן 17 והמילה "ניתוח" נאמרה בחדר.',
    conditions: { stages: ['breakthrough_youth', 'breakthrough'], once: true },
    weight: 5,
    choices: [
      {
        id: 'rush_back',
        label: 'לחזור מהר. אין זמן.',
        outcomes: [
          {
            weight: 45,
            tone: 'good',
            text: 'חזרת שלושה שבועות לפני הזמן והמאמן העריך את זה.',
            effects: { statusValue: 4, injuryRisk: 10, confidence: 3 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'הברך לא הייתה מוכנה. עוד ארבעה חודשים בחוץ.',
            effects: { ability: -3, injuryRisk: 14, confidence: -8, statusValue: -5 },
          },
        ],
      },
      {
        id: 'full_rehab',
        label: 'שיקום מלא, בלי קיצורי דרך',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'חצי שנה בחדר הכושר עם הפיזיותרפיסט. חוזר חזק יותר ממה שהיית.',
            effects: { injuryRisk: -8, ability: 1, statusValue: -4, discipline: 6 },
          },
        ],
      },
    ],
  },
  {
    id: 'media_hype',
    kicker: 'כותרת ראשית בעיתון הספורט',
    title: '"הכישרון הגדול ביותר מזה עשור"',
    description:
      'עיתונאי בכיר כתב עליך טור שלם. פתאום כולם יודעים מי אתה, וכולם מצפים.',
    conditions: {
      stages: ['breakthrough_youth', 'breakthrough'],
      minAbility: 58,
      minReputation: 20,
      once: true,
    },
    weight: 7,
    choices: [
      {
        id: 'embrace',
        label: 'לתת ראיון ולהודות',
        outcomes: [
          {
            weight: 50,
            tone: 'good',
            text: 'ראיון בוגר וממוקד. אתה נשמע כמו מישהו שאפשר לבנות עליו מועדון.',
            effects: { reputation: 8, maccabism: 4, pressure: 6 },
          },
          {
            weight: 50,
            tone: 'bad',
            text: 'משפט אחד הוצא מהקשרו והפך לכותרת. הלחץ נדבק אליך.',
            effects: { reputation: 5, pressure: 12, confidence: -5 },
          },
        ],
      },
      {
        id: 'ignore',
        label: 'לא לקרוא. להמשיך לעבוד.',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'סגרת את הטלפון לשבועיים. הראש נשאר במקום שלו.',
            effects: { pressure: -7, ability: 1.5, form: 4, reputation: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'loan_talk',
    kicker: 'שיחה בחדר הווידאו',
    title: 'המועדון מציע לך השאלה',
    description:
      'מנהל הספורט מדבר איתך בכנות: "אתה לא תשחק כאן השנה. יש קבוצה שרוצה אותך על קבוע 90 דקות. תחזור אחר."',
    conditions: {
      stages: ['breakthrough_youth', 'breakthrough'],
      atMaccabiSenior: true,
      maxStatusValue: 48,
      maxLastAppearances: 14,
    },
    weight: 9,
    choices: [
      {
        id: 'accept_loan',
        label: 'לצאת להשאלה',
        hint: 'דקות ופיתוח - אבל יוצא מהעיניים',
        effects: { flags: ['wants_loan'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'הסכמת. השנה הבאה תהיה על מגרשים קטנים יותר, אבל תשחק בהם.',
            effects: { transferChance: 0.3, confidence: 2 },
          },
        ],
      },
      {
        id: 'stay_fight',
        label: 'להישאר ולהילחם על מקום',
        hint: 'סיכון: עוד עונה על הספסל',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 40,
            tone: 'good',
            text: 'הישארת, ובינואר נפתחה לך דלת. תפסת אותה.',
            effects: { maccabism: 6, statusValue: 8, minutesModifier: 1.25 },
          },
          {
            weight: 60,
            tone: 'bad',
            text: 'עוד עונה של חימומים ארוכים וכניסות בדקה 85.',
            effects: { maccabism: 5, minutesModifier: 0.7, confidence: -6 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* פריצה (19-23)                                                     */
  /* ================================================================= */
  {
    id: 'derby_moment',
    kicker: 'דקה 88, סמי עופר',
    title: 'הרגע של המשחק הגדול',
    description: 'הכדור מגיע אליך בקצה הרחב. שוויון בדרבי, והיציע כבר על הרגליים.',
    conditions: { stages: ['breakthrough', 'prime'], atMaccabiSenior: true, minStatusValue: 40 },
    weight: 9,
    choices: [
      {
        id: 'shoot',
        label: 'לבעוט',
        outcomes: [
          {
            weight: 42,
            tone: 'good',
            text: 'הכדור נכנס בחיבורים. האצטדיון מתפוצץ ואתה רץ לפינה בלי לדעת מה אתה עושה.',
            effects: {
              reputation: 9,
              maccabism: 8,
              statusValue: 9,
              confidence: 10,
              achievement: 'derby_moment',
              flags: ['fan_favourite'],
            },
          },
          {
            weight: 58,
            tone: 'bad',
            text: 'מעל המשקוף. שריקת הסיום, והחזרה לחדר ההלבשה ארוכה מאוד.',
            effects: { confidence: -7, pressure: 6 },
          },
        ],
      },
      {
        id: 'pass',
        label: 'למסור לחבר במצב טוב יותר',
        outcomes: [
          {
            weight: 60,
            tone: 'good',
            text: 'מסירה מושלמת, והוא לא מחטיא. בחדר ההלבשה כולם יודעים של מי הכדור הזה.',
            effects: { statusValue: 6, maccabism: 5, reputation: 4, confidence: 5 },
          },
          {
            weight: 40,
            tone: 'neutral',
            text: 'הוא בעט לידיים של השוער. אף אחד לא כועס עליך, אבל אף אחד לא מדבר עליך.',
            effects: { confidence: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'fans_sing_your_name',
    kicker: 'דקה 20, שער צפוני',
    title: 'הקהל שר את השם שלך',
    description:
      'זה מתחיל בפינה אחת של היציע ותוך דקה כל האצטדיון עושה את זה. השם שלך. לחן שאתה מכיר משירים על שחקנים אחרים.',
    conditions: {
      stages: ['breakthrough', 'prime'],
      atMaccabiSenior: true,
      minStatusValue: 55,
      minMaccabism: 55,
      once: true,
    },
    weight: 8,
    choices: [
      {
        id: 'salute',
        label: 'להצדיע ליציע',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'הרמת יד ליציע והם החזירו לך פי מאה. מהיום אתה שלהם.',
            effects: { maccabism: 12, confidence: 8, statusValue: 5, flags: ['fan_favourite'] },
          },
        ],
      },
      {
        id: 'focus',
        label: 'להוריד ראש ולהמשיך לשחק',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'לא הרמת מבט. הם מעריכים גם את זה - ואת שני הכדורים שהוצאת אחר כך מהשער.',
            effects: { maccabism: 6, form: 6, ability: 1, statusValue: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'first_europe_interest',
    kicker: 'טלפון מהסוכן, אחת בלילה',
    title: 'התעניינות ראשונה מאירופה',
    description:
      'מועדון אירופי שלח מכתב רשמי. לא ענק, אבל אמיתי. הם רוצים אותך בקיץ, והמועדון עוד לא ענה.',
    conditions: {
      stages: ['breakthrough', 'prime'],
      atMaccabiSenior: true,
      minReputation: 35,
      once: true,
    },
    weight: 9,
    choices: [
      {
        id: 'push',
        label: 'לבקש מהמועדון לא לחסום אותי',
        hint: 'מגדיל מאוד את הסיכוי למעבר',
        effects: { flags: ['wants_transfer'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אמרת את זה בפנים גלויות. ההנהלה הבינה, היציע פחות.',
            effects: { transferChance: 0.45, maccabism: -8, reputation: 4 },
          },
        ],
      },
      {
        id: 'let_club_decide',
        label: 'להשאיר את זה למועדון',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אמרת שאתה שחקן של מכבי חיפה ושיעשו מה שטוב למועדון. זה נשמע טוב, וזה גם היה נכון.',
            effects: { maccabism: 7, transferChance: 0.12, statusValue: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'new_coach',
    kicker: 'קיץ, מאמן חדש',
    title: 'המאמן החדש לא סופר אותך',
    description:
      'הוא הגיע עם רשימה, ואתה לא עליה. בשבוע הראשון שיחקת עם הקבוצה השנייה במשחק אימון.',
    conditions: { stages: ['breakthrough', 'prime', 'veteran'], minStatusValue: 35 },
    weight: 8,
    choices: [
      {
        id: 'confront',
        label: 'לדפוק על הדלת שלו',
        outcomes: [
          {
            weight: 45,
            tone: 'good',
            text: 'שיחה קשה ואמיתית. הוא אוהב שחקנים עם ביצים, ואתה חוזר להרכב.',
            effects: { statusValue: 8, confidence: 5, minutesModifier: 1.2 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'הוא לא אהב את הטון. עכשיו אתה גם בחוץ וגם מסומן.',
            effects: { statusValue: -8, minutesModifier: 0.65, discipline: -4 },
          },
        ],
      },
      {
        id: 'earn_it',
        label: 'להוכיח באימונים',
        outcomes: [
          {
            weight: 60,
            tone: 'good',
            text: 'שלושה חודשים של אימונים מטורפים ואי אפשר היה להשאיר אותך בחוץ.',
            effects: { statusValue: 6, ability: 2, discipline: 5 },
          },
          {
            weight: 40,
            tone: 'bad',
            text: 'עבדת כמו חיה ועדיין לא שיחקת. חצי עונה הלכה.',
            effects: { minutesModifier: 0.7, confidence: -7, ability: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'national_team_call',
    kicker: 'רשימת הסגל פורסמה',
    title: 'זימון לנבחרת',
    description: 'השם שלך ברשימה. אמא שלך שלחה לך צילום מסך לפני הסוכן.',
    conditions: { stages: ['breakthrough', 'prime'], minAbility: 70, minReputation: 45, once: true },
    weight: 7,
    choices: [
      {
        id: 'go',
        label: 'לנסוע ולתת הכול',
        outcomes: [
          {
            weight: 70,
            tone: 'good',
            text: 'שיחקת 90 דקות והיית מהטובים במגרש. הטלפון של הסוכן לא מפסיק לצלצל.',
            effects: { reputation: 12, confidence: 6, transferChance: 0.2 },
          },
          {
            weight: 30,
            tone: 'bad',
            text: 'חטפת מכה בדקה 60 וחזרת למועדון צולע.',
            effects: { reputation: 6, injuryRisk: 8, form: -6 },
          },
        ],
      },
      {
        id: 'rest',
        label: 'לבקש מנוחה בגלל עומס',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'המועדון מרוצה, הנבחרת פחות. חזרת לעונה רענן.',
            effects: { reputation: -4, form: 7, injuryRisk: -5, statusValue: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'loan_success',
    kicker: 'בהשאלה',
    title: 'אתה הכי טוב בקבוצה הזו',
    description:
      'המועדון המשאיל רוצה לקנות אותך על קבוע. מכבי חיפה מוכנה להקשיב. אתה משחק שם כל דקה.',
    conditions: { onLoan: true, minLastAppearances: 20 },
    weight: 9,
    choices: [
      {
        id: 'stay_loan_club',
        label: 'להישאר כאן ולהיות מלך',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה בוחר בביטחון ובדקות. במכבי חיפה מוחקים אותך מהתוכניות.',
            effects: { maccabism: -12, statusValue: 10, confidence: 6, flags: ['betrayal_moment'] },
          },
        ],
      },
      {
        id: 'return_home',
        label: 'לחזור למכבי ולהילחם',
        hint: 'לחזור לתחתית התור - בבית',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אמרת להם שיש לך עסק לא גמור בחיפה. חוזר בקיץ עם משהו להוכיח.',
            effects: { maccabism: 10, confidence: 4, minutesModifier: 1.15 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* שיא הקריירה (24-30)                                               */
  /* ================================================================= */
  {
    id: 'captaincy_offer',
    kicker: 'המשרד של המאמן',
    title: 'המאמן מציע לך את הקפטנות',
    description:
      '"אני צריך מישהו שידבר כשאני לא בחדר. אתה גדלת כאן. אתה מבין מה זה המועדון הזה." הסרט על השולחן.',
    conditions: {
      stages: ['prime', 'veteran'],
      atMaccabiSenior: true,
      minStatusValue: 62,
      isCaptain: false,
      once: true,
    },
    weight: 14,
    choices: [
      {
        id: 'accept',
        label: 'לקחת את הסרט',
        hint: 'מעמד ואגדה - ולחץ אמיתי',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אתה קפטן מכבי חיפה. יש כאלה שמחכים לזה כל החיים ולא מקבלים.',
            effects: {
              statusValue: 10,
              maccabism: 12,
              pressure: 12,
              confidence: 5,
              captain: true,
            },
          },
        ],
      },
      {
        id: 'decline',
        label: 'לוותר. אני לא טיפוס של נאומים.',
        effects: { flags: ['refused_captaincy'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'המאמן מכבד את זה, אבל הסרט הולך למישהו אחר - ואיתו גם קצת מהמעמד שלך.',
            effects: { pressure: -10, form: 5, maccabism: -5, statusValue: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'big_money_offer',
    kicker: 'הצעה שמשנה חיים',
    title: 'הצעה כספית ענקית מחו״ל',
    description:
      'מועדון עשיר מוכן לשלם עליך פי חמישה ממה שאתה מרוויח. הסוכן אומר שהצעה כזו מגיעה פעם אחת. ההורים שלך שותקים בטלפון.',
    conditions: {
      stages: ['prime'],
      atMaccabiSenior: true,
      minAbility: 72,
      minReputation: 50,
    },
    weight: 10,
    choices: [
      {
        id: 'take_money',
        label: 'לקחת את הכסף',
        hint: 'ביטחון כלכלי, מוניטין - ומרחק מהבית',
        effects: { flags: ['wants_transfer', 'betrayal_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'סגרת את זה בשיחה אחת. ביציע כבר מדברים עליך בזמן עבר.',
            effects: { transferChance: 0.7, maccabism: -12, reputation: 8 },
          },
        ],
      },
      {
        id: 'stay',
        label: 'לסרב ולהישאר',
        hint: 'מכביסטיות בשמיים, כסף שלא יחזור',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אמרת לא. תוך שעה זה בכל האתרים, ובמשחק הבא היציע פרש שלט עם השם שלך.',
            effects: { maccabism: 18, statusValue: 8, confidence: 6, reputation: -3 },
          },
        ],
      },
      {
        id: 'end_of_season',
        label: 'לבקש לעבור רק בסוף העונה',
        hint: 'פשרה: לסיים את הסיפור בכבוד',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'ביקשת לסיים את העונה כמו שצריך ואז לדבר. המועדון מעריך, אבל כולם יודעים לאן זה הולך.',
            effects: { transferChance: 0.4, maccabism: -3, statusValue: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'title_race_penalty',
    kicker: 'דקה 94, מחזור אחרון',
    title: 'פנדל על האליפות',
    description:
      'שוויון. השופט מצביע על הנקודה. כל האצטדיון מסתכל עליך, והקפטן שואל אם אתה רוצה את זה.',
    conditions: { stages: ['prime', 'breakthrough'], atMaccabiSenior: true, minStatusValue: 55 },
    weight: 7,
    choices: [
      {
        id: 'take_penalty',
        label: 'לקחת את הכדור',
        outcomes: [
          {
            weight: 62,
            tone: 'good',
            text: 'הנחת אותו בפינה. חצי מהיציע ירד למגרש. יש דברים שלא שוכחים בעיר הזאת.',
            effects: {
              maccabism: 12,
              statusValue: 10,
              confidence: 10,
              reputation: 6,
              flags: ['fan_favourite'],
            },
          },
          {
            weight: 38,
            tone: 'bad',
            text: 'השוער ניחש. השקט באצטדיון היה הדבר הכי רועש ששמעת.',
            effects: { confidence: -12, pressure: 10, maccabism: 3 },
          },
        ],
      },
      {
        id: 'let_other',
        label: 'לתת לבועט הקבוע',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'הוא לקח, ולא משנה מה קרה - אף אחד לא יזכור שאתה עמדת שם.',
            effects: { pressure: -6, maccabism: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'young_talent',
    kicker: 'חדר הלבשה, ספטמבר',
    title: 'הילד שבא לקחת לך את המקום',
    description:
      'בן 18, מהאקדמיה, ומזכיר לך מישהו. המאמן מתחיל לתת לו דקות שהיו שלך.',
    conditions: { stages: ['prime', 'veteran'], atMaccabiSenior: true, minStatusValue: 55 },
    weight: 8,
    choices: [
      {
        id: 'mentor',
        label: 'לקחת אותו תחת חסות',
        hint: 'טוב למועדון, אולי רע לדקות שלך',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אתה נשאר איתו אחרי אימונים ומלמד אותו לקרוא משחק. במועדון מתחילים לראות בך יותר משחקן.',
            effects: { maccabism: 10, statusValue: 3, minutesModifier: 0.9, pressure: -4 },
          },
        ],
      },
      {
        id: 'crush_him',
        label: 'להראות לו מי בעל הבית',
        outcomes: [
          {
            weight: 55,
            tone: 'good',
            text: 'עלית רמה כדי לא לוותר על המקום. באימונים אי אפשר לגעת בך.',
            effects: { ability: 1.5, form: 7, statusValue: 5, minutesModifier: 1.1 },
          },
          {
            weight: 45,
            tone: 'bad',
            text: 'הלחץ שלך היה מורגש, והוא דווקא פרח. חדר ההלבשה מרגיש את המתח.',
            effects: { form: -6, statusValue: -5, pressure: 8 },
          },
        ],
      },
    ],
  },
  {
    id: 'homesick_abroad',
    kicker: 'דירה בעיר זרה, נובמבר',
    title: 'געגועים',
    description:
      'אתה מסתדר מצוין על המגרש, אבל בבית אין לך עם מי לדבר. ביום שישי אתה פותח שידור של מכבי חיפה בטלפון ולא מצליח להפסיק לחשוב על זה.',
    conditions: { abroad: true, minAge: 22 },
    weight: 8,
    choices: [
      {
        id: 'settle_in',
        label: 'להשתקע. ללמוד את השפה, לבנות חיים.',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'שיעורי שפה, חברים חדשים, שגרה. פתאום אתה משחק חופשי.',
            effects: { form: 8, ability: 1.5, maccabism: -6, confidence: 5 },
          },
        ],
      },
      {
        id: 'keep_the_flame',
        label: 'לשמור על החיבור לחיפה',
        hint: 'הלב בבית - הראש קצת פחות במשחק',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אתה מדבר עם אנשים מהמועדון כל שבוע ועוקב אחרי כל משחק. הם לא שכחו אותך.',
            effects: { maccabism: 9, form: -3, transferChance: 0.15 },
          },
        ],
      },
    ],
  },
  {
    id: 'abroad_bench',
    kicker: 'ליגה זרה, ינואר',
    title: 'אתה לא משחק',
    description:
      'המועדון קנה שחקן חדש בעמדה שלך והמאמן לא מסתיר את הסדר. חלון ההעברות נפתח בעוד שבועיים.',
    conditions: { abroad: true, maxLastAppearances: 15 },
    weight: 9,
    choices: [
      {
        id: 'fight_for_place',
        label: 'להישאר ולהילחם',
        outcomes: [
          {
            weight: 45,
            tone: 'good',
            text: 'פציעה שלו, הזדמנות שלך, ושני חודשים מצוינים.',
            effects: { statusValue: 8, ability: 2, confidence: 5 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'חצי שנה של אימונים בלי משחקים. הרגליים זוכרות, הראש פחות.',
            effects: { ability: -1.5, confidence: -8, reputation: -5 },
          },
        ],
      },
      {
        id: 'ask_move',
        label: 'לבקש לעזוב',
        hint: 'אולי דלת הביתה נפתחת',
        effects: { flags: ['wants_transfer'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'הודעת שאתה רוצה לשחק. הסוכן כבר מדבר עם כמה מועדונים - וגם עם חיפה.',
            effects: { transferChance: 0.5, maccabism: 4 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* ותיק (31+)                                                        */
  /* ================================================================= */
  {
    id: 'one_year_deal',
    kicker: 'חידוש חוזה, גיל 33',
    title: 'עונה אחת בלבד',
    description:
      'המועדון מציע חוזה לשנה עם שכר מופחת. "אנחנו אוהבים אותך, אבל צריך לחשוב על הגיל." הסוכן אומר שיש מקומות שישלמו יותר.',
    conditions: { minAge: 31, atMaccabiSenior: true },
    weight: 11,
    choices: [
      {
        id: 'sign',
        label: 'לחתום. אני נשאר.',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'חתמת בלי לריב על כלום. במועדון יודעים בדיוק מה קיבלו.',
            effects: { maccabism: 10, statusValue: 3, confidence: 3 },
          },
        ],
      },
      {
        id: 'seek_more',
        label: 'לבדוק אפשרויות אחרות',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'הסוכן מתחיל לעבוד. במועדון קלטו שאתה בודק, וזה קצת מצנן את היחסים.',
            effects: { transferChance: 0.45, maccabism: -7 },
          },
        ],
      },
    ],
  },
  {
    id: 'veteran_money_abroad',
    kicker: 'הצעה אחרונה',
    title: 'משכורת ענק בליגה רחוקה',
    description:
      'ליגה עשירה, שנתיים, סכום שיסדר את המשפחה שלך לכל החיים. אף אחד שם לא יודע מי אתה, ולא ממש אכפת להם.',
    conditions: { minAge: 30, minAbility: 62 },
    weight: 8,
    choices: [
      {
        id: 'take',
        label: 'לקחת. זו הפעם האחרונה.',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'סיימת את הקריירה במקום שקט עם הרבה כסף ומעט משמעות.',
            effects: { transferChance: 0.6, maccabism: -12, reputation: -3, ability: -1 },
          },
        ],
      },
      {
        id: 'refuse',
        label: 'לסרב ולסיים כאן',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'החלטת שהסוף שלך יהיה בירוק. יש כאלה שלא יבינו את זה לעולם.',
            effects: { maccabism: 15, statusValue: 5 },
          },
        ],
      },
    ],
  },
  {
    id: 'veteran_bench_role',
    kicker: 'שיחה לפני העונה',
    title: 'תפקיד חדש',
    description:
      'המאמן מציע לך תפקיד של שחקן ספסל מנוסה: פחות דקות, יותר אחריות בחדר ההלבשה, ועזרה לצעירים.',
    conditions: { minAge: 32, atMaccabiSenior: true },
    weight: 9,
    choices: [
      {
        id: 'accept_role',
        label: 'לקבל את התפקיד',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'אתה הופך לאיש הכי חשוב בחדר שלא תמיד משחק. הצעירים עוקבים אחרי כל מילה שלך.',
            effects: { maccabism: 9, statusValue: 4, minutesModifier: 0.65, pressure: -8 },
          },
        ],
      },
      {
        id: 'refuse_role',
        label: 'אני עדיין שחקן הרכב',
        outcomes: [
          {
            weight: 45,
            tone: 'good',
            text: 'הגעת לכושר מפלצתי בהכנה וסתמת לכולם את הפה.',
            effects: { form: 9, minutesModifier: 1.2, ability: 0.5, confidence: 6 },
          },
          {
            weight: 55,
            tone: 'bad',
            text: 'הגוף כבר לא עונה כמו פעם. עונה מתסכלת של חצאי כניסות.',
            effects: { form: -7, minutesModifier: 0.75, confidence: -7 },
          },
        ],
      },
    ],
  },
  {
    id: 'retirement_thoughts',
    kicker: 'אחרי משחק, שתיים בלילה',
    title: 'המחשבה על הסוף',
    description:
      'הברכיים כואבות שלושה ימים אחרי כל משחק. הילדים שלך שואלים מתי תהיה בבית בשבתות. אתה מתחיל לחשוב על זה ברצינות.',
    conditions: { minAge: 33 },
    weight: 10,
    choices: [
      {
        id: 'one_more',
        label: 'עוד עונה אחת',
        effects: { flags: ['retirement_considered'] },
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'החלטת ללכת על עוד שנה. הגוף שמע והחליט להתאמץ.',
            effects: { form: 4, injuryRisk: 5, maccabism: 3 },
          },
        ],
      },
      {
        id: 'plan_end',
        label: 'להתחיל לתכנן פרידה מסודרת',
        effects: { flags: ['retirement_considered'] },
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'הודעת למועדון שזו כנראה השנה האחרונה. פתאום כל משחק מרגיש אחרת.',
            effects: { maccabism: 6, pressure: -10, form: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'veteran_return_call',
    kicker: 'טלפון ממנהל הספורט',
    title: 'חיפה מחפשת אותך',
    description:
      'מספר לא מוכר. בצד השני מנהל הספורט של מכבי חיפה: "יש לנו קבוצה צעירה. צריך מישהו שיודע מה זה המועדון הזה."',
    conditions: { abroad: true, minAge: 28, minMaccabism: 35, hasLeftMaccabi: true },
    weight: 10,
    choices: [
      {
        id: 'interested',
        label: 'להגיד שאתה מעוניין',
        hint: 'מגדיל מאוד את הסיכוי לחזרה הביתה',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'לא היססת אפילו רגע. הסוכן שלך פחות התלהב.',
            effects: { maccabism: 12, transferChance: 0.55 },
          },
        ],
      },
      {
        id: 'not_yet',
        label: '"עוד לא סיימתי כאן"',
        outcomes: [
          {
            weight: 100,
            tone: 'neutral',
            text: 'אמרת שאתה עוד באמצע משהו. הדלת נשארה פתוחה, אבל לא לנצח.',
            effects: { maccabism: -4, reputation: 3, confidence: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'veteran_farewell_game',
    kicker: 'המשחק האחרון בבית',
    title: 'משחק פרידה',
    description:
      'המועדון מארגן לך ערב פרידה. שלטים ביציעים, המשפחה על הדשא, ועשרות אלפי אנשים ששרים שיר אחד.',
    conditions: { minAge: 34, atMaccabiSenior: true, minMaccabism: 60, once: true },
    weight: 9,
    choices: [
      {
        id: 'speech',
        label: 'לקחת מיקרופון ולדבר',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'לא הצלחת לסיים את המשפט הראשון. גם הם לא. יש דברים שאי אפשר לקנות.',
            effects: { maccabism: 12, statusValue: 6, flags: ['fan_favourite'] },
          },
        ],
      },
      {
        id: 'lap',
        label: 'סיבוב הקפה בשקט עם הילדים',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'הסתובבת סביב המגרש עם הילדים על הידיים. התמונה הזו תישאר בעיר הזאת שנים.',
            effects: { maccabism: 10, statusValue: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'form_slump',
    kicker: 'ארבעה משחקים בלי כלום',
    title: 'שפל',
    description:
      'לא נכנס לך כלום, והרשתות החברתיות לא מרחמות. המאמן עוד מאמין בך, אבל השאלות מתחילות.',
    conditions: { stages: ['breakthrough', 'prime', 'veteran'], minStatusValue: 40 },
    weight: 8,
    choices: [
      {
        id: 'extra_work',
        label: 'להישאר אחרי אימונים ולבעוט מאה כדורים',
        outcomes: [
          {
            weight: 65,
            tone: 'good',
            text: 'הכדור נכנס במשחק החמישי, ואחריו עוד שניים. יצאת מזה חזק יותר.',
            effects: { form: 9, confidence: 6, ability: 1 },
          },
          {
            weight: 35,
            tone: 'bad',
            text: 'ככל שניסית יותר, זה נראה כבד יותר. עונה מתסכלת.',
            effects: { form: -6, confidence: -6 },
          },
        ],
      },
      {
        id: 'clear_head',
        label: 'לנתק, לצאת מהרשתות, לנקות ראש',
        outcomes: [
          {
            weight: 70,
            tone: 'good',
            text: 'שבועיים בלי טלפון וחזרת לשחק בלי לחשוב. זה מה שהיה חסר.',
            effects: { form: 7, pressure: -10, confidence: 5 },
          },
          {
            weight: 30,
            tone: 'neutral',
            text: 'הראש נרגע, המשחק עוד לא. לוקח זמן.',
            effects: { pressure: -6, form: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'fan_meeting',
    kicker: 'אחרי אימון פתוח',
    title: 'ילד עם חולצה עם השם שלך',
    description:
      'הוא מחכה שעתיים בשמש בשביל חתימה. אתה מאחר לפגישה, והביטחון כבר מושך אותך לרכב.',
    conditions: { atMaccabiSenior: true, minStatusValue: 45 },
    weight: 7,
    choices: [
      {
        id: 'stop',
        label: 'לעצור, לחתום, להצטלם',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'עמדת שם עשרים דקות עם כל מי שהגיע. התמונה הזו הסתובבת בכל הרשתות.',
            effects: { maccabism: 7, statusValue: 2, flags: ['fan_favourite'] },
          },
        ],
      },
      {
        id: 'drive',
        label: 'להתנצל ולהמשיך',
        outcomes: [
          {
            weight: 100,
            tone: 'bad',
            text: 'מישהו צילם אותך נוסע. זה לא היה נעים לראות את זה למחרת.',
            effects: { maccabism: -5, reputation: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'europe_champions_night',
    kicker: 'ליגת האלופות, משחק חוץ',
    title: 'הלילה הגדול באירופה',
    description:
      'אצטדיון מלא, המנון שכולם מכירים, ואתה בהרכב. כל מה שחלמת עליו כילד קורה עכשיו.',
    conditions: { abroad: true, minAbility: 76, minReputation: 60 },
    weight: 7,
    choices: [
      {
        id: 'seize',
        label: 'לשחק כאילו אין מחר',
        outcomes: [
          {
            weight: 50,
            tone: 'good',
            text: 'הופעת ענק. אחרי המשחק כל אירופה יודעת את השם שלך.',
            effects: { reputation: 14, confidence: 9, ability: 1.5 },
          },
          {
            weight: 50,
            tone: 'bad',
            text: 'הקצב שם היה גבוה מדי הלילה. הוחלפת בהפסקה.',
            effects: { reputation: 2, confidence: -8, pressure: 8 },
          },
        ],
      },
      {
        id: 'solid',
        label: 'לשחק חכם ולא לחפש הצגות',
        outcomes: [
          {
            weight: 100,
            tone: 'good',
            text: 'משחק נקי ובוגר. המאמן סומך עליך מהיום גם במשחקים הגדולים.',
            effects: { reputation: 7, statusValue: 5, ability: 1 },
          },
        ],
      },
    ],
  },
];

export const EVENTS_BY_ID: Record<string, GameEvent> = Object.fromEntries(
  EVENTS.map((event) => [event.id, event]),
);

export function getEvent(id: string): GameEvent {
  const event = EVENTS_BY_ID[id];
  if (!event) throw new Error(`Unknown event: ${id}`);
  return event;
}

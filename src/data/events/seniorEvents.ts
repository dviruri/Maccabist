import type { GameEvent } from '../../types';

/**
 * Senior career events, migrated to the weighted-outcome model.
 * The senior systems (transfers, Europe, homecoming, retirement) are unchanged - these events
 * simply feed them, and now do it probabilistically.
 */

export const SENIOR_EVENTS: GameEvent[] = [
  {
    id: 'sen_derby_moment',
    kicker: 'דקה 88, סמי עופר',
    title: 'הרגע של המשחק הגדול',
    description: 'הכדור מגיע אליך בקצה הרחב. שוויון בדרבי, והיציע כבר על הרגליים.',
    category: 'match_moment',
    conditions: { bands: ['senior'], atMaccabiSenior: true, minRoleValue: 40 },
    weight: 9,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'shoot',
        label: 'לבעוט',
        risk: 'risky',
        outcomes: [
          {
            id: 'scored',
            baseWeight: 40,
            tone: 'good',
            text: 'הכדור נכנס בחיבורים. האצטדיון מתפוצץ ואתה רץ לפינה בלי לדעת מה אתה עושה.',
            effects: {
              reputation: 9,
              maccabism: 8,
              roleValue: 9,
              confidence: 10,
              coachTrust: 6,
              achievement: 'derby_moment',
              flags: ['fan_favourite'],
            },
            modifiers: [
              { attribute: 'form', above: 62, multiplier: 1.35 },
              { attribute: 'confidence', below: 42, multiplier: 0.6 },
            ],
          },
          {
            id: 'missed',
            baseWeight: 60,
            tone: 'bad',
            text: 'מעל המשקוף. שריקת הסיום, והחזרה לחדר ההלבשה ארוכה מאוד.',
            effects: { confidence: -7, pressure: 6, coachTrust: -2 },
          },
        ],
      },
      {
        id: 'pass',
        label: 'למסור לחבר במצב טוב יותר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'assist',
            baseWeight: 58,
            tone: 'good',
            text: 'מסירה מושלמת, והוא לא מחטיא. בחדר ההלבשה כולם יודעים של מי הכדור הזה.',
            effects: { roleValue: 6, maccabism: 5, reputation: 4, confidence: 5, coachTrust: 4 },
          },
          {
            id: 'wasted',
            baseWeight: 42,
            tone: 'neutral',
            text: 'הוא בעט לידיים של השוער. אף אחד לא כועס עליך, אבל אף אחד לא מדבר עליך.',
            effects: { confidence: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_fans_sing',
    kicker: 'דקה 20, שער צפוני',
    title: 'הקהל שר את השם שלך',
    description:
      'זה מתחיל בפינה אחת של היציע ותוך דקה כל האצטדיון עושה את זה. השם שלך.',
    category: 'match_moment',
    conditions: {
      bands: ['senior'],
      atMaccabiSenior: true,
      minRoleValue: 55,
      minMaccabism: 55,
    },
    weight: 8,
    oncePerCareer: true,
    choices: [
      {
        id: 'salute',
        label: 'להצדיע ליציע',
        risk: 'balanced',
        outcomes: [
          {
            id: 'theirs',
            baseWeight: 100,
            tone: 'good',
            text: 'הרמת יד ליציע והם החזירו לך פי מאה. מהיום אתה שלהם.',
            effects: { maccabism: 12, confidence: 8, roleValue: 5, flags: ['fan_favourite'] },
          },
        ],
      },
      {
        id: 'focus',
        label: 'להוריד ראש ולהמשיך לשחק',
        risk: 'safe',
        outcomes: [
          {
            id: 'respect',
            baseWeight: 100,
            tone: 'good',
            text: 'לא הרמת מבט. הם מעריכים גם את זה - ואת שני הכדורים שהוצאת אחר כך מהשער.',
            effects: { maccabism: 6, form: 6, coachTrust: 4, roleValue: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_first_europe_interest',
    kicker: 'טלפון מהסוכן, אחת בלילה',
    title: 'התעניינות ראשונה מאירופה',
    description:
      'מועדון אירופי שלח מכתב רשמי. לא ענק, אבל אמיתי. המועדון עוד לא ענה.',
    category: 'transfer',
    conditions: { bands: ['senior'], atMaccabiSenior: true, minReputation: 35 },
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'push',
        label: 'לבקש מהמועדון לא לחסום אותי',
        hint: 'מגדיל מאוד את הסיכוי למעבר',
        risk: 'risky',
        effects: { flags: ['wants_transfer'] },
        outcomes: [
          {
            id: 'pushed',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אמרת את זה בפנים גלויות. ההנהלה הבינה, היציע פחות.',
            effects: { transferChance: 0.45, maccabism: -8, reputation: 4, coachTrust: -4 },
          },
        ],
      },
      {
        id: 'let_club_decide',
        label: 'להשאיר את זה למועדון',
        risk: 'safe',
        outcomes: [
          {
            id: 'classy',
            baseWeight: 100,
            tone: 'good',
            text: 'אמרת שאתה שחקן של מכבי חיפה ושיעשו מה שטוב למועדון. זה נשמע טוב, וזה גם היה נכון.',
            effects: { maccabism: 7, transferChance: 0.12, roleValue: 3, coachTrust: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_new_coach',
    kicker: 'קיץ, מאמן חדש',
    title: 'המאמן החדש לא סופר אותך',
    description: 'הוא הגיע עם רשימה, ואתה לא עליה.',
    category: 'coach',
    conditions: { bands: ['senior'], minRoleValue: 35 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'confront',
        label: 'לדפוק על הדלת שלו',
        risk: 'risky',
        outcomes: [
          {
            id: 'won_him',
            baseWeight: 42,
            tone: 'good',
            text: 'שיחה קשה ואמיתית. הוא אוהב שחקנים עם ביצים, ואתה חוזר להרכב.',
            effects: { roleValue: 8, coachTrust: 10, confidence: 5, minutesModifier: 1.2 },
            modifiers: [{ attribute: 'abilityVsLevel', above: 5, multiplier: 1.5 }],
          },
          {
            id: 'marked',
            baseWeight: 58,
            tone: 'bad',
            text: 'הוא לא אהב את הטון. עכשיו אתה גם בחוץ וגם מסומן.',
            effects: { roleValue: -8, coachTrust: -10, minutesModifier: 0.65 },
          },
        ],
      },
      {
        id: 'earn_it',
        label: 'להוכיח באימונים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'earned',
            baseWeight: 58,
            tone: 'good',
            text: 'שלושה חודשים של אימונים מטורפים ואי אפשר היה להשאיר אותך בחוץ.',
            effects: { roleValue: 6, coachTrust: 8, ability: 1.5, discipline: 5 },
            modifiers: [{ attribute: 'discipline', above: 62, multiplier: 1.35 }],
          },
          {
            id: 'wasted_half',
            baseWeight: 42,
            tone: 'bad',
            text: 'עבדת כמו חיה ועדיין לא שיחקת. חצי עונה הלכה.',
            effects: { minutesModifier: 0.7, confidence: -7, coachTrust: -2, ability: 0.8 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_captaincy_offer',
    kicker: 'המשרד של המאמן',
    title: 'המאמן מציע לך את הקפטנות',
    description:
      '"אני צריך מישהו שידבר כשאני לא בחדר. אתה גדלת כאן." הסרט על השולחן.',
    category: 'promotion',
    conditions: {
      bands: ['senior'],
      atMaccabiSenior: true,
      minRoleValue: 62,
      isCaptain: false,
    },
    weight: 14,
    oncePerCareer: true,
    choices: [
      {
        id: 'accept',
        label: 'לקחת את הסרט',
        hint: 'מעמד ואגדה - ולחץ אמיתי',
        risk: 'balanced',
        outcomes: [
          {
            id: 'captain',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה קפטן מכבי חיפה. יש כאלה שמחכים לזה כל החיים ולא מקבלים.',
            effects: {
              roleValue: 10,
              maccabism: 12,
              coachTrust: 8,
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
        risk: 'safe',
        effects: { flags: ['refused_captaincy'] },
        outcomes: [
          {
            id: 'passed',
            baseWeight: 100,
            tone: 'neutral',
            text: 'המאמן מכבד את זה, אבל הסרט הולך למישהו אחר - ואיתו גם קצת מהמעמד שלך.',
            effects: { pressure: -10, form: 5, maccabism: -5, roleValue: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_big_money_offer',
    kicker: 'הצעה שמשנה חיים',
    title: 'הצעה כספית ענקית מחו״ל',
    description:
      'מועדון עשיר מוכן לשלם עליך פי חמישה. הסוכן אומר שהצעה כזו מגיעה פעם אחת.',
    category: 'transfer',
    conditions: {
      bands: ['senior'],
      atMaccabiSenior: true,
      minAbility: 72,
      minReputation: 50,
      maxAge: 30,
    },
    weight: 10,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'take_money',
        label: 'לקחת את הכסף',
        risk: 'risky',
        effects: { flags: ['wants_transfer', 'betrayal_moment'] },
        outcomes: [
          {
            id: 'gone',
            baseWeight: 100,
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
        risk: 'balanced',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'legend_move',
            baseWeight: 100,
            tone: 'good',
            text: 'אמרת לא. תוך שעה זה בכל האתרים, ובמשחק הבא היציע פרש שלט עם השם שלך.',
            effects: { maccabism: 18, roleValue: 8, confidence: 6, reputation: -3 },
          },
        ],
      },
      {
        id: 'end_of_season',
        label: 'לבקש לעבור רק בסוף העונה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'compromise',
            baseWeight: 100,
            tone: 'neutral',
            text: 'ביקשת לסיים את העונה כמו שצריך ואז לדבר. המועדון מעריך, אבל כולם יודעים לאן זה הולך.',
            effects: { transferChance: 0.4, maccabism: -3, roleValue: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_title_penalty',
    kicker: 'דקה 94, מחזור אחרון',
    title: 'פנדל על האליפות',
    description: 'שוויון. השופט מצביע על הנקודה. הקפטן שואל אם אתה רוצה את זה.',
    category: 'match_moment',
    conditions: { bands: ['senior'], atMaccabiSenior: true, minRoleValue: 55 },
    weight: 7,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'take',
        label: 'לקחת את הכדור',
        risk: 'risky',
        outcomes: [
          {
            id: 'scored',
            baseWeight: 60,
            tone: 'good',
            text: 'הנחת אותו בפינה. חצי מהיציע ירד למגרש. יש דברים שלא שוכחים בעיר הזאת.',
            effects: {
              maccabism: 12,
              roleValue: 10,
              confidence: 10,
              reputation: 6,
              flags: ['fan_favourite'],
            },
            modifiers: [
              { attribute: 'confidence', above: 62, multiplier: 1.3 },
              { attribute: 'confidence', below: 40, multiplier: 0.6 },
            ],
          },
          {
            id: 'saved',
            baseWeight: 40,
            tone: 'bad',
            text: 'השוער ניחש. השקט באצטדיון היה הדבר הכי רועש ששמעת.',
            effects: { confidence: -12, pressure: 10, maccabism: 3 },
          },
        ],
      },
      {
        id: 'let_other',
        label: 'לתת לבועט הקבוע',
        risk: 'safe',
        outcomes: [
          {
            id: 'anonymous',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הוא לקח, ולא משנה מה קרה - אף אחד לא יזכור שאתה עמדת שם.',
            effects: { pressure: -6, maccabism: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_young_talent',
    kicker: 'חדר הלבשה, ספטמבר',
    title: 'הילד שבא לקחת לך את המקום',
    description: 'בן 18, מהאקדמיה, ומזכיר לך מישהו. המאמן מתחיל לתת לו דקות שהיו שלך.',
    category: 'competition',
    conditions: { bands: ['senior'], atMaccabiSenior: true, minRoleValue: 55, minAge: 26 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'mentor',
        label: 'לקחת אותו תחת חסות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'club_man',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה נשאר איתו אחרי אימונים ומלמד אותו לקרוא משחק. במועדון מתחילים לראות בך יותר משחקן.',
            effects: { maccabism: 10, roleValue: 3, coachTrust: 6, minutesModifier: 0.9, pressure: -4 },
          },
        ],
      },
      {
        id: 'fight',
        label: 'להראות לו מי בעל הבית',
        risk: 'risky',
        outcomes: [
          {
            id: 'held_off',
            baseWeight: 52,
            tone: 'good',
            text: 'עלית רמה כדי לא לוותר על המקום. באימונים אי אפשר לגעת בך.',
            effects: { ability: 1.2, form: 7, roleValue: 5, minutesModifier: 1.1 },
            modifiers: [{ attribute: 'age', below: 30, multiplier: 1.3 }],
          },
          {
            id: 'tension',
            baseWeight: 48,
            tone: 'bad',
            text: 'הלחץ שלך היה מורגש, והוא דווקא פרח. חדר ההלבשה מרגיש את המתח.',
            effects: { form: -6, roleValue: -5, coachTrust: -5, pressure: 8 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_homesick',
    kicker: 'דירה בעיר זרה, נובמבר',
    title: 'געגועים',
    description:
      'על המגרש אתה מסתדר, אבל בבית אין לך עם מי לדבר. ביום שישי אתה פותח שידור של מכבי חיפה בטלפון.',
    category: 'random',
    conditions: { abroad: true, minAge: 22 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'settle',
        label: 'להשתקע. ללמוד את השפה, לבנות חיים.',
        risk: 'balanced',
        outcomes: [
          {
            id: 'settled',
            baseWeight: 100,
            tone: 'good',
            text: 'שיעורי שפה, חברים חדשים, שגרה. פתאום אתה משחק חופשי.',
            effects: { form: 8, ability: 1.2, maccabism: -6, confidence: 5, coachTrust: 4 },
          },
        ],
      },
      {
        id: 'flame',
        label: 'לשמור על החיבור לחיפה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'kept',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה מדבר עם אנשים מהמועדון כל שבוע ועוקב אחרי כל משחק. הם לא שכחו אותך.',
            effects: { maccabism: 9, form: -3, transferChance: 0.15 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_abroad_bench',
    kicker: 'ליגה זרה, ינואר',
    title: 'אתה לא משחק',
    description: 'המועדון קנה שחקן חדש בעמדה שלך והמאמן לא מסתיר את הסדר.',
    category: 'competition',
    conditions: { abroad: true, maxLastAppearances: 15 },
    weight: 9,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'fight',
        label: 'להישאר ולהילחם',
        risk: 'risky',
        outcomes: [
          {
            id: 'chance_came',
            baseWeight: 42,
            tone: 'good',
            text: 'פציעה שלו, הזדמנות שלך, ושני חודשים מצוינים.',
            effects: { roleValue: 8, ability: 1.5, confidence: 5, coachTrust: 6 },
            modifiers: [{ attribute: 'abilityVsLevel', above: 0, multiplier: 1.4 }],
          },
          {
            id: 'wasted_year',
            baseWeight: 58,
            tone: 'bad',
            text: 'חצי שנה של אימונים בלי משחקים. הרגליים זוכרות, הראש פחות.',
            effects: { ability: -1.2, confidence: -8, reputation: -5, coachTrust: -3 },
          },
        ],
      },
      {
        id: 'ask_move',
        label: 'לבקש לעזוב',
        risk: 'balanced',
        effects: { flags: ['wants_transfer'] },
        outcomes: [
          {
            id: 'market',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הודעת שאתה רוצה לשחק. הסוכן כבר מדבר עם כמה מועדונים - וגם עם חיפה.',
            effects: { transferChance: 0.5, maccabism: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_champions_night',
    kicker: 'ליגת האלופות, משחק חוץ',
    title: 'הלילה הגדול באירופה',
    description: 'אצטדיון מלא, המנון שכולם מכירים, ואתה בהרכב.',
    category: 'match_moment',
    conditions: { abroad: true, minAbility: 76, minReputation: 60 },
    weight: 7,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'seize',
        label: 'לשחק כאילו אין מחר',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'huge',
            baseWeight: 48,
            tone: 'good',
            text: 'הופעת ענק. אחרי המשחק כל אירופה יודעת את השם שלך.',
            effects: { reputation: 14, confidence: 9, ability: 1.2, coachTrust: 6 },
            modifiers: [{ attribute: 'form', above: 62, multiplier: 1.3 }],
          },
          {
            id: 'too_fast',
            baseWeight: 52,
            tone: 'bad',
            text: 'הקצב שם היה גבוה מדי הלילה. הוחלפת בהפסקה.',
            effects: { reputation: 2, confidence: -8, pressure: 8, coachTrust: -3 },
          },
        ],
      },
      {
        id: 'solid',
        label: 'לשחק חכם ולא לחפש הצגות',
        risk: 'safe',
        outcomes: [
          {
            id: 'trusted',
            baseWeight: 100,
            tone: 'good',
            text: 'משחק נקי ובוגר. המאמן סומך עליך מהיום גם במשחקים הגדולים.',
            effects: { reputation: 7, roleValue: 5, coachTrust: 7, ability: 0.8 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_fan_meeting',
    kicker: 'אחרי אימון פתוח',
    title: 'ילד עם חולצה עם השם שלך',
    description: 'הוא מחכה שעתיים בשמש בשביל חתימה. אתה מאחר לפגישה.',
    category: 'random',
    conditions: { atMaccabiSenior: true, minRoleValue: 45 },
    weight: 7,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'stop',
        label: 'לעצור, לחתום, להצטלם',
        risk: 'safe',
        outcomes: [
          {
            id: 'photo',
            baseWeight: 100,
            tone: 'good',
            text: 'עמדת שם עשרים דקות עם כל מי שהגיע. התמונה הזו הסתובבה בכל הרשתות.',
            effects: { maccabism: 7, roleValue: 2, flags: ['fan_favourite'] },
          },
        ],
      },
      {
        id: 'drive',
        label: 'להתנצל ולהמשיך',
        risk: 'risky',
        outcomes: [
          {
            id: 'filmed',
            baseWeight: 65,
            tone: 'bad',
            text: 'מישהו צילם אותך נוסע. זה לא היה נעים לראות את זה למחרת.',
            effects: { maccabism: -5, reputation: -2 },
          },
          {
            id: 'unnoticed',
            baseWeight: 35,
            tone: 'neutral',
            text: 'אף אחד לא שם לב. הגעת לפגישה בזמן.',
            effects: { pressure: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_one_year_deal',
    kicker: 'חידוש חוזה',
    title: 'עונה אחת בלבד',
    description:
      'המועדון מציע חוזה לשנה עם שכר מופחת. "אנחנו אוהבים אותך, אבל צריך לחשוב על הגיל."',
    category: 'contract',
    conditions: { minAge: 31, atMaccabiSenior: true },
    weight: 11,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'sign',
        label: 'לחתום. אני נשאר.',
        risk: 'safe',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'stayed',
            baseWeight: 100,
            tone: 'good',
            text: 'חתמת בלי לריב על כלום. במועדון יודעים בדיוק מה קיבלו.',
            effects: { maccabism: 10, roleValue: 3, confidence: 3, coachTrust: 5 },
          },
        ],
      },
      {
        id: 'seek_more',
        label: 'לבדוק אפשרויות אחרות',
        risk: 'risky',
        outcomes: [
          {
            id: 'cooled',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הסוכן מתחיל לעבוד. במועדון קלטו שאתה בודק, וזה קצת מצנן את היחסים.',
            effects: { transferChance: 0.45, maccabism: -7, coachTrust: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_veteran_role',
    kicker: 'שיחה לפני העונה',
    title: 'תפקיד חדש',
    description:
      'המאמן מציע לך תפקיד של שחקן ספסל מנוסה: פחות דקות, יותר אחריות בחדר ההלבשה.',
    category: 'coach',
    conditions: { minAge: 32, atMaccabiSenior: true },
    weight: 9,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'accept',
        label: 'לקבל את התפקיד',
        risk: 'safe',
        outcomes: [
          {
            id: 'leader',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה הופך לאיש הכי חשוב בחדר שלא תמיד משחק. הצעירים עוקבים אחרי כל מילה שלך.',
            effects: { maccabism: 9, roleValue: 4, coachTrust: 8, minutesModifier: 0.65, pressure: -8 },
          },
        ],
      },
      {
        id: 'refuse',
        label: 'אני עדיין שחקן הרכב',
        risk: 'risky',
        outcomes: [
          {
            id: 'proved_it',
            baseWeight: 42,
            tone: 'good',
            text: 'הגעת לכושר מפלצתי בהכנה וסתמת לכולם את הפה.',
            effects: { form: 9, minutesModifier: 1.2, confidence: 6, coachTrust: 4 },
            modifiers: [{ attribute: 'age', below: 34, multiplier: 1.4 }],
          },
          {
            id: 'body_said_no',
            baseWeight: 58,
            tone: 'bad',
            text: 'הגוף כבר לא עונה כמו פעם. עונה מתסכלת של חצאי כניסות.',
            effects: { form: -7, minutesModifier: 0.75, confidence: -7, coachTrust: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_retirement_thoughts',
    kicker: 'אחרי משחק, שתיים בלילה',
    title: 'המחשבה על הסוף',
    description:
      'הברכיים כואבות שלושה ימים אחרי כל משחק. הילדים שלך שואלים מתי תהיה בבית בשבתות.',
    category: 'contract',
    conditions: { minAge: 33 },
    weight: 10,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'one_more',
        label: 'עוד עונה אחת',
        risk: 'balanced',
        effects: { flags: ['retirement_considered'] },
        outcomes: [
          {
            id: 'pushed_on',
            baseWeight: 100,
            tone: 'neutral',
            text: 'החלטת ללכת על עוד שנה. הגוף שמע והחליט להתאמץ.',
            effects: { form: 4, injuryRisk: 5, maccabism: 3 },
          },
        ],
      },
      {
        id: 'plan_end',
        label: 'להתחיל לתכנן פרידה מסודרת',
        risk: 'safe',
        effects: { flags: ['retirement_considered'] },
        outcomes: [
          {
            id: 'peace',
            baseWeight: 100,
            tone: 'good',
            text: 'הודעת למועדון שזו כנראה השנה האחרונה. פתאום כל משחק מרגיש אחרת.',
            effects: { maccabism: 6, pressure: -10, form: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_return_call',
    kicker: 'טלפון ממנהל הספורט',
    title: 'חיפה מחפשת אותך',
    description:
      'מספר לא מוכר. בצד השני מנהל הספורט של מכבי חיפה: "צריך מישהו שיודע מה זה המועדון הזה."',
    category: 'transfer',
    conditions: { abroad: true, minAge: 28, minMaccabism: 35, hasLeftMaccabi: true },
    weight: 10,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'interested',
        label: 'להגיד שאתה מעוניין',
        risk: 'balanced',
        outcomes: [
          {
            id: 'home',
            baseWeight: 100,
            tone: 'good',
            text: 'לא היססת אפילו רגע. הסוכן שלך פחות התלהב.',
            effects: { maccabism: 12, transferChance: 0.55 },
          },
        ],
      },
      {
        id: 'not_yet',
        label: '"עוד לא סיימתי כאן"',
        risk: 'balanced',
        outcomes: [
          {
            id: 'later',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אמרת שאתה עוד באמצע משהו. הדלת נשארה פתוחה, אבל לא לנצח.',
            effects: { maccabism: -4, reputation: 3, confidence: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_farewell',
    kicker: 'המשחק האחרון בבית',
    title: 'משחק פרידה',
    description:
      'המועדון מארגן לך ערב פרידה. שלטים ביציעים, המשפחה על הדשא, ועשרות אלפי אנשים ששרים שיר אחד.',
    category: 'match_moment',
    conditions: { minAge: 34, atMaccabiSenior: true, minMaccabism: 60 },
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'speech',
        label: 'לקחת מיקרופון ולדבר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'tears',
            baseWeight: 100,
            tone: 'good',
            text: 'לא הצלחת לסיים את המשפט הראשון. גם הם לא. יש דברים שאי אפשר לקנות.',
            effects: { maccabism: 12, roleValue: 6, flags: ['fan_favourite'] },
          },
        ],
      },
      {
        id: 'lap',
        label: 'סיבוב הקפה בשקט עם הילדים',
        risk: 'safe',
        outcomes: [
          {
            id: 'picture',
            baseWeight: 100,
            tone: 'good',
            text: 'הסתובבת סביב המגרש עם הילדים על הידיים. התמונה הזו תישאר בעיר הזאת שנים.',
            effects: { maccabism: 10, roleValue: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'sen_veteran_money_abroad',
    kicker: 'הצעה אחרונה',
    title: 'משכורת ענק בליגה רחוקה',
    description:
      'ליגה עשירה, שנתיים, סכום שיסדר את המשפחה שלך. אף אחד שם לא יודע מי אתה.',
    category: 'transfer',
    conditions: { minAge: 30, minAbility: 62 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'take',
        label: 'לקחת. זו הפעם האחרונה.',
        risk: 'risky',
        outcomes: [
          {
            id: 'quiet_end',
            baseWeight: 100,
            tone: 'neutral',
            text: 'סיימת את הקריירה במקום שקט עם הרבה כסף ומעט משמעות.',
            effects: { transferChance: 0.6, maccabism: -12, reputation: -3, ability: -0.8 },
          },
        ],
      },
      {
        id: 'refuse',
        label: 'לסרב ולסיים כאן',
        risk: 'safe',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'green_end',
            baseWeight: 100,
            tone: 'good',
            text: 'החלטת שהסוף שלך יהיה בירוק. יש כאלה שלא יבינו את זה לעולם.',
            effects: { maccabism: 15, roleValue: 5 },
          },
        ],
      },
    ],
  },
];

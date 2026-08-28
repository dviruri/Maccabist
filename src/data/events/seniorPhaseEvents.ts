import type { GameEvent } from '../../types';

/**
 * Senior career events, gated by the derived senior phase.
 *
 * The academy had far more texture than the professional career, which is backwards - a
 * senior career runs fifteen-plus seasons. `conditions.seniorPhases` splits the pool into
 * four eras so a 19 year old fighting for his first start and a 34 year old handing over the
 * armband are not drawing from the same deck.
 *
 * Tone note: most of these are small. A career is mostly ordinary weeks, and an event that
 * announces itself as life-changing every time stops meaning anything.
 */

export const SENIOR_PHASE_EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* BREAKTHROUGH - the first year or two among men                     */
  /* ================================================================= */
  {
    id: 'br_first_senior_training',
    kicker: 'שבע בבוקר, מתחם האימונים',
    title: 'האימון הראשון עם הבוגרים',
    description:
      'אותם מגרשים, חדר הלבשה אחר. אתה מחפש איפה לשים את התיק ומגלה שאין לך עמדה קבועה עדיין.',
    category: 'promotion',
    conditions: { seniorPhases: ['breakthrough'], atMaccabi: true },
    weight: 12,
    oncePerCareer: true,
    choices: [
      {
        id: 'quiet',
        label: 'לשתוק, להקשיב, לעבוד',
        risk: 'safe',
        outcomes: [
          {
            id: 'accepted',
            baseWeight: 100,
            tone: 'good',
            text: 'לא פתחת פה ולא איחרת. אחרי שבועיים אחד הוותיקים שמר לך מקום לידו בשולחן.',
            effects: { coachTrust: 6, discipline: 4, confidence: 4, leadership: 2 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.3 }],
          },
        ],
      },
      {
        id: 'show_them',
        label: 'להיכנס חזק ולהראות שאתה שייך',
        risk: 'risky',
        outcomes: [
          {
            id: 'impressed',
            baseWeight: 42,
            tone: 'good',
            text: 'נכנסת בקפטן בדו-קרב ולא התנצלת. הוא הסתכל עליך, חייך, ואמר "טוב".',
            effects: { coachTrust: 9, roleValue: 5, confidence: 8, leadership: 5 },
            modifiers: [{ attribute: 'ability', above: 62, multiplier: 1.4 }],
            traitModifiers: [
              { trait: 'self_believer', multiplier: 1.4 },
              { trait: 'leader', multiplier: 1.3 },
            ],
          },
          {
            id: 'overstepped',
            baseWeight: 58,
            tone: 'bad',
            text: 'נכנסת חזק מדי בשחקן שמשחק כאן עשר שנים. חדר ההלבשה לא אוהב את זה מילד בן 18.',
            effects: { coachTrust: -6, confidence: -5, discipline: -4 },
            traitModifiers: [{ trait: 'hot_headed', multiplier: 1.4 }],
          },
        ],
      },
    ],
  },
  {
    id: 'br_first_bench',
    kicker: 'רשימת הסגל למשחק שבת',
    title: 'הפעם הראשונה בסגל',
    description:
      'השם שלך מופיע ברשימה. לא בהרכב - בסגל. אתה מצלם את זה בטלפון לפני שמישהו יראה.',
    category: 'promotion',
    conditions: { seniorPhases: ['breakthrough'], clubScope: 'maccabi' },
    weight: 11,
    oncePerCareer: true,
    choices: [
      {
        id: 'ready',
        label: 'להתחמם כאילו אתה נכנס',
        risk: 'balanced',
        outcomes: [
          {
            id: 'came_on',
            baseWeight: 46,
            tone: 'good',
            text: 'דקה 79, והמאמן אומר את השם שלך. שבע דקות, שלוש נגיעות, וכל אחת מהן אתה זוכר.',
            effects: {
              confidence: 9,
              coachTrust: 4,
              roleValue: 3,
              milestone: { id: 'first_bench_appearance', icon: '⚽', text: 'דקות ראשונות בבוגרים', major: false },
            },
            modifiers: [{ attribute: 'coachTrust', above: 58, multiplier: 1.4 }],
          },
          {
            id: 'stayed_seated',
            baseWeight: 54,
            tone: 'neutral',
            text: 'לא נכנסת. התחממת שלוש פעמים וחזרת לשבת, וזה גם חלק מזה.',
            effects: { confidence: -2, pressure: 3 },
          },
        ],
      },
      {
        id: 'enjoy',
        label: 'פשוט לספוג את הרגע',
        risk: 'safe',
        outcomes: [
          {
            id: 'memory',
            baseWeight: 100,
            tone: 'good',
            text: 'ישבת על הספסל של הקבוצה הבוגרת של מכבי חיפה. לפני תשע שנים ישבת ביציע.',
            effects: { maccabism: 6, confidence: 4, pressure: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'br_first_start',
    kicker: 'ההרכב על הלוח',
    title: 'ההרכב הראשון',
    description:
      'המאמן עובר על השמות ואומר את שלך במקום שבו בדרך כלל אומרים מישהו אחר. חדר ההלבשה מסתכל עליך רגע.',
    category: 'opportunity',
    conditions: { seniorPhases: ['breakthrough'], minRoleValue: 30 },
    weight: 13,
    oncePerCareer: true,
    choices: [
      {
        id: 'play_my_game',
        label: 'לשחק כמו שאתה יודע',
        risk: 'balanced',
        outcomes: [
          {
            id: 'excellent',
            baseWeight: 38,
            tone: 'good',
            text: 'שיחקת בלי פחד. בדקה 70 היציע קרא את השם שלך, ובראיון המאמן אמר שלא הופתע.',
            effects: {
              coachTrust: 11,
              roleValue: 9,
              confidence: 12,
              reputation: 6,
              flags: ['first_team_radar'],
              milestone: { id: 'first_start', icon: '🌟', text: 'ההרכב הראשון שלך - ומשחק גדול', major: true },
            },
            modifiers: [
              { attribute: 'ability', above: 62, multiplier: 1.45 },
              { attribute: 'confidence', above: 58, multiplier: 1.3 },
              { attribute: 'form', below: 42, multiplier: 0.6 },
            ],
            traitModifiers: [{ trait: 'big_game', multiplier: 1.5 }],
          },
          {
            id: 'ordinary',
            baseWeight: 40,
            tone: 'neutral',
            text: 'לא בלטת ולא נפלת. משחק ראשון סביר, וזה בדיוק מה שצריך בשביל לקבל שני.',
            effects: { coachTrust: 3, confidence: 3, roleValue: 2 },
          },
          {
            id: 'overwhelmed',
            baseWeight: 22,
            tone: 'bad',
            text: 'הקצב היה אחר לגמרי. הוחלפת בהפסקה, והמאמן אמר שזה נורמלי - וזה לא עזר.',
            effects: { confidence: -10, coachTrust: -4, pressure: 8 },
            modifiers: [{ attribute: 'ability', above: 68, multiplier: 0.5 }],
            traitModifiers: [{ trait: 'self_believer', multiplier: 0.6 }],
          },
        ],
      },
      {
        id: 'safe_start',
        label: 'לא לעשות שטויות',
        risk: 'safe',
        outcomes: [
          {
            id: 'solid',
            baseWeight: 100,
            tone: 'neutral',
            text: 'מסירות קצרות, בלי סיכונים, בלי טעויות. המאמן העריך את זה יותר משחשבת.',
            effects: { coachTrust: 5, confidence: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'br_veteran_mentor',
    kicker: 'אחרי אימון, בחניה',
    title: 'הוותיק לוקח אותך לצד',
    description:
      'שחקן שמשחק כאן מאז שהיית בילדים עוצר אותך. "אתה טוב. אבל אתה לא יודע עדיין איך זה עובד כאן."',
    category: 'team',
    conditions: { seniorPhases: ['breakthrough'] },
    weight: 10,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'listen',
        label: 'להקשיב לו',
        risk: 'safe',
        outcomes: [
          {
            id: 'learned',
            baseWeight: 100,
            tone: 'good',
            text: 'הוא לימד אותך דברים שלא מלמדים באימון. חצי מהם על כדורגל, חצי על אנשים.',
            effects: { ability: 1.2, leadership: 6, discipline: 4, coachTrust: 3 },
          },
        ],
      },
      {
        id: 'know_better',
        label: 'אתה יודע מה אתה עושה',
        risk: 'risky',
        outcomes: [
          {
            id: 'right',
            baseWeight: 34,
            tone: 'neutral',
            text: 'עשית את זה בדרך שלך, וזה עבד. הוא לא אמר כלום, אבל גם לא ניגש שוב.',
            effects: { confidence: 5, leadership: -2 },
            traitModifiers: [{ trait: 'self_believer', multiplier: 1.5 }],
          },
          {
            id: 'wrong',
            baseWeight: 66,
            tone: 'bad',
            text: 'טעית, והוא צדק, וכולם ראו. בחדר הלבשה כזה זה נזכר יותר מדי זמן.',
            effects: { coachTrust: -5, leadership: -4, confidence: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'br_first_contract_pressure',
    kicker: 'שיחה עם ההורים במטבח',
    title: 'החוזה המקצועני הראשון',
    description:
      'הסכום כתוב על נייר מול העיניים שלך. זה יותר כסף ממה שאבא שלך הרוויח בשנה, ואתה בן 19.',
    category: 'contract',
    conditions: { seniorPhases: ['breakthrough'], atMaccabi: true },
    weight: 10,
    oncePerCareer: true,
    choices: [
      {
        id: 'stay_grounded',
        label: 'לחתום ולהמשיך כרגיל',
        risk: 'safe',
        outcomes: [
          {
            id: 'unchanged',
            baseWeight: 100,
            tone: 'good',
            text: 'חתמת, ולמחרת הגעת לאימון ראשון כרגיל. יש שחקנים שהחוזה הראשון משנה אותם. לא אותך.',
            effects: { discipline: 6, coachTrust: 5, maccabism: 5, confidence: 3 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.3 }],
          },
        ],
      },
      {
        id: 'celebrate',
        label: 'סוף סוף להרשות לעצמך',
        risk: 'risky',
        outcomes: [
          {
            id: 'harmless',
            baseWeight: 52,
            tone: 'neutral',
            text: 'קנית אוטו, יצאת עם החברים, וחזרת לאימון בזמן. מותר גם ליהנות.',
            effects: { confidence: 6, form: 3 },
          },
          {
            id: 'noticed',
            baseWeight: 48,
            tone: 'bad',
            text: 'תמונות ברשת, אימון אחד באיחור, ושיחה לא נעימה עם מנהל הספורט.',
            effects: { discipline: -8, coachTrust: -7, form: -4 },
            traitModifiers: [
              { trait: 'hot_headed', multiplier: 1.4 },
              { trait: 'professional', multiplier: 0.4 },
            ],
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* ESTABLISHED - in the squad, fighting to stay in the eleven         */
  /* ================================================================= */
  {
    id: 'es_new_manager',
    kicker: 'הודעה באתר המועדון',
    title: 'מאמן חדש',
    description:
      'הודיעו על זה בבוקר. עד עכשיו ידעת בדיוק מה המאמן חושב עליך. מהיום אתה לא יודע כלום.',
    category: 'coach',
    conditions: { seniorPhases: ['established', 'prime'] },
    weight: 11,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'introduce',
        label: 'לבוא אליו ולהציג את עצמך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'good_start',
            baseWeight: 55,
            tone: 'good',
            text: 'שיחה של עשר דקות שבה אמרת בדיוק מה אתה יכול לתת. הוא רשם לעצמו.',
            effects: { coachTrust: 8, confidence: 5 },
            modifiers: [{ attribute: 'roleValue', above: 60, multiplier: 1.3 }],
            traitModifiers: [{ trait: 'leader', multiplier: 1.4 }],
          },
          {
            id: 'his_own_men',
            baseWeight: 45,
            tone: 'bad',
            text: 'הוא היה מנומס ולא יותר. תוך חודש הביא שני שחקנים משלו, ואחד מהם בעמדה שלך.',
            effects: { coachTrust: -6, roleValue: -5, minutesModifier: 0.82 },
          },
        ],
      },
      {
        id: 'wait',
        label: 'לחכות ולראות',
        risk: 'safe',
        outcomes: [
          {
            id: 'judged_on_pitch',
            baseWeight: 100,
            tone: 'neutral',
            text: 'לא ניגשת אליו. הוא ישפוט אותך לפי מה שיראה, וזה בסדר גמור.',
            effects: { pressure: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'es_tactical_change',
    kicker: 'ישיבה טקטית, יום חמישי',
    title: 'שיטה חדשה, תפקיד חדש',
    description:
      'הוא משנה מערך, והתפקיד שלך בתוכו נראה אחרת לגמרי ממה שעשית עשר שנים.',
    category: 'development',
    conditions: { seniorPhases: ['established', 'prime'] },
    weight: 10,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'adapt',
        label: 'ללמוד את התפקיד החדש',
        risk: 'balanced',
        outcomes: [
          {
            id: 'better_player',
            baseWeight: 52,
            tone: 'good',
            text: 'לקח חודש להבין ואז זה נפתח. אתה שחקן שלם יותר ממה שהיית בהתחלת העונה.',
            effects: { ability: 2.2, coachTrust: 8, roleValue: 5, confidence: 5 },
            modifiers: [{ attribute: 'ability', above: 66, multiplier: 1.3 }],
            traitModifiers: [{ trait: 'hard_worker', multiplier: 1.35 }],
          },
          {
            id: 'never_fit',
            baseWeight: 48,
            tone: 'bad',
            text: 'זה פשוט לא אתה. אתה עושה את מה שביקשו ומרגיש בינוני בפעם הראשונה בחיים.',
            effects: { confidence: -7, roleValue: -5, form: -5, minutesModifier: 0.85 },
          },
        ],
      },
      {
        id: 'say_no',
        label: 'להגיד לו שזה לא התפקיד שלך',
        risk: 'risky',
        outcomes: [
          {
            id: 'heard',
            baseWeight: 36,
            tone: 'good',
            text: 'הוא הקשיב, חשב, והזיז מישהו אחר. לא כל מאמן היה עושה את זה.',
            effects: { coachTrust: 4, roleValue: 4, confidence: 6, leadership: 4 },
            modifiers: [{ attribute: 'roleValue', above: 70, multiplier: 1.6 }],
          },
          {
            id: 'benched',
            baseWeight: 64,
            tone: 'bad',
            text: '"אז תשב." זה כל מה שהוא אמר, ובשבת ישבת.',
            effects: { coachTrust: -9, minutesModifier: 0.65, roleValue: -6, remember: 'lost_starting_role' },
          },
        ],
      },
    ],
  },
  {
    id: 'es_europe_qualifier',
    kicker: 'מוקדמות אירופה, משחק גומלין',
    title: 'הערב שבו נכנסים לאירופה',
    description:
      'שוויון מהמשחק הראשון, אצטדיון מלא, ומי שינצח ממשיך לשלב הבתים. אלה הערבים שזוכרים בעיר.',
    category: 'match_moment',
    conditions: { seniorPhases: ['established', 'prime'], atMaccabiSenior: true, minRoleValue: 45 },
    weight: 9,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'lead',
        label: 'לקחת את המשחק על עצמך',
        risk: 'risky',
        outcomes: [
          {
            id: 'european_night',
            baseWeight: 42,
            tone: 'good',
            text: 'הערב הזה נכנס לתולדות המועדון, ואתה בתוכו. אנשים יספרו לילדים שלהם איפה היו.',
            effects: {
              reputation: 11,
              maccabism: 9,
              roleValue: 8,
              confidence: 11,
              remember: 'european_night',
              milestone: { id: 'european_night', icon: '✨', text: 'ערב אירופאי שלא שוכחים בחיפה', major: true },
            },
            modifiers: [
              { attribute: 'ability', above: 70, multiplier: 1.45 },
              { attribute: 'form', above: 62, multiplier: 1.3 },
            ],
            traitModifiers: [{ trait: 'big_game', multiplier: 1.7 }],
          },
          {
            id: 'fell_short',
            baseWeight: 58,
            tone: 'bad',
            text: 'נעלמתם בשעה השנייה. אצטדיון מלא שיצא בשקט זה הצליל הכי כבד שיש.',
            effects: { confidence: -7, pressure: 8, form: -4 },
          },
        ],
      },
      {
        id: 'team_first',
        label: 'לעשות את התפקיד ולא להתאבד',
        risk: 'balanced',
        outcomes: [
          {
            id: 'professional_night',
            baseWeight: 100,
            tone: 'neutral',
            text: 'משחק ממושמע ובלי הברקות. אלה משחקים שמנצחים ככה יותר מאשר בגאונות.',
            effects: { coachTrust: 5, maccabism: 4, confidence: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'es_form_slump',
    kicker: 'שבעה משחקים, אפס',
    title: 'התקופה שבה כלום לא הולך',
    description:
      'לא פציעה ולא עונש. פשוט תקופה שבה כל נגיעה יוצאת חצי סנטימטר לא נכון, והיציע התחיל לשים לב.',
    category: 'pressure',
    conditions: { seniorPhases: ['established', 'prime'], maxForm: 46 },
    weight: 12,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'extra_work',
        label: 'להישאר אחרי אימונים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'worked_out',
            baseWeight: 52,
            tone: 'good',
            text: 'שבועיים של עבודה נוספת ואז מסירה אחת שיוצאת מושלם. משם זה חוזר לבד.',
            effects: { form: 12, confidence: 8, coachTrust: 4 },
            traitModifiers: [
              { trait: 'hard_worker', multiplier: 1.45 },
              { trait: 'professional', multiplier: 1.3 },
            ],
          },
          {
            id: 'tried_too_hard',
            baseWeight: 48,
            tone: 'bad',
            text: 'ככל שעבדת יותר, כך שיחקת מתוח יותר. יש דברים שלא נפתרים בעבודה.',
            effects: { form: -5, confidence: -6, injuryRisk: 5 },
          },
        ],
      },
      {
        id: 'switch_off',
        label: 'להתנתק לכמה ימים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'reset',
            baseWeight: 58,
            tone: 'good',
            text: 'סופ״ש בלי כדורגל, בלי טלפון ובלי חדשות. חזרת וזה נראה פשוט יותר.',
            effects: { form: 9, confidence: 7, pressure: -8 },
          },
          {
            id: 'rusty',
            baseWeight: 42,
            tone: 'bad',
            text: 'חזרת רענן בראש ואיטי ברגליים, והמאמן ראה את זה בדיוק באימון הלא נכון.',
            effects: { coachTrust: -4, form: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'es_fan_criticism',
    kicker: 'אחרי הפסד ביתי',
    title: 'היציע לא סלח',
    description:
      'שרקו לך בהחלפה. לא לקבוצה - לך. בדרך לחניה מישהו אמר משהו שלא תשכח מהר.',
    category: 'pressure',
    conditions: { seniorPhases: ['established', 'prime'], atMaccabiSenior: true },
    weight: 9,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'answer_pitch',
        label: 'לענות על המגרש',
        risk: 'balanced',
        outcomes: [
          {
            id: 'won_them_back',
            baseWeight: 50,
            tone: 'good',
            text: 'שלושה משחקים אחר כך אותו יציע שר את השם שלך. ככה זה עובד פה, לטוב ולרע.',
            effects: { form: 8, maccabism: 7, roleValue: 6, confidence: 8, flags: ['fan_favourite'] },
            modifiers: [{ attribute: 'ability', above: 68, multiplier: 1.35 }],
            traitModifiers: [{ trait: 'self_believer', multiplier: 1.35 }],
          },
          {
            id: 'got_worse',
            baseWeight: 50,
            tone: 'bad',
            text: 'התחלת לשחק בשביל לא לטעות. זה בדיוק מה שגורם לטעויות.',
            effects: { confidence: -9, form: -6, pressure: 9 },
          },
        ],
      },
      {
        id: 'ignore',
        label: 'להתעלם לגמרי',
        risk: 'safe',
        outcomes: [
          {
            id: 'thick_skin',
            baseWeight: 100,
            tone: 'neutral',
            text: 'סגרת את הרשתות ולא קראת כלום. יש שחקנים שלמדו את זה מאוחר מדי.',
            effects: { pressure: -6, confidence: 2, discipline: 3 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.25 }],
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* PRIME - the best years, and what you do with them                  */
  /* ================================================================= */
  {
    id: 'pr_dressing_room_leader',
    kicker: 'אחרי הפסד שלישי ברציפות',
    title: 'חדר ההלבשה שותק',
    description:
      'אף אחד לא מדבר. המאמן יצא, והשקט הזה הוא הדבר שהורג עונות. מישהו צריך להגיד משהו.',
    category: 'team',
    conditions: { seniorPhases: ['prime'], minRoleValue: 60 },
    weight: 11,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'speak',
        label: 'לקום ולדבר',
        risk: 'risky',
        outcomes: [
          {
            id: 'galvanised',
            baseWeight: 48,
            tone: 'good',
            text: 'דיברת שתי דקות בלי לצעוק. בשבת הבאה הקבוצה נראתה כמו קבוצה אחרת.',
            effects: {
              leadership: 12,
              roleValue: 7,
              coachTrust: 7,
              maccabism: 5,
              form: 5,
            },
            modifiers: [{ attribute: 'roleValue', above: 70, multiplier: 1.4 }],
            traitModifiers: [
              { trait: 'leader', multiplier: 1.7 },
              { trait: 'big_game', multiplier: 1.2 },
            ],
          },
          {
            id: 'fell_flat',
            baseWeight: 52,
            tone: 'bad',
            text: 'דיברת, ואף אחד לא הרים את הראש. יש רגעים שבהם מילים לא עוזרות, וזה היה אחד מהם.',
            effects: { leadership: -4, confidence: -5, pressure: 6 },
          },
        ],
      },
      {
        id: 'let_captain',
        label: 'לתת לקפטן לעשות את זה',
        risk: 'safe',
        outcomes: [
          {
            id: 'stayed_quiet',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הוא דיבר, ואתה הנהנת. לא כל אחד צריך להיות זה שמדבר.',
            effects: { leadership: -2, discipline: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'pr_big_european_offer',
    kicker: 'שיחה בחדר ישיבות',
    title: 'מועדון גדול באירופה רוצה אותך',
    description:
      'הצעה אמיתית, מהסוג שמגיע פעם אחת. משכורת אחרת, ליגה אחרת, וחיים אחרים לגמרי.',
    category: 'transfer',
    conditions: {
      seniorPhases: ['prime'],
      atMaccabiSenior: true,
      minReputation: 58,
      maxAge: 29,
    },
    weight: 9,
    rarity: 'uncommon',
    cooldownSeasons: 4,
    choices: [
      {
        id: 'go',
        label: 'ללכת. זו ההזדמנות.',
        hint: 'קריירה כזאת לא חוזרת',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'took_it',
            baseWeight: 100,
            tone: 'neutral',
            text: 'חתמת. הפרידה מהיציע הייתה קשה יותר ממה שציפית, ואף אחד לא קרא לך בוגד.',
            effects: {
              transferChance: 0.85,
              reputation: 8,
              confidence: 6,
              maccabism: -3,
            },
          },
        ],
      },
      {
        id: 'stay',
        label: 'להישאר',
        hint: 'יש דברים ששווים יותר מכסף',
        risk: 'balanced',
        outcomes: [
          {
            id: 'legend_choice',
            baseWeight: 100,
            tone: 'good',
            text: 'סירבת, והעיר ידעה למחרת בבוקר. יש החלטות שקובעות איך יזכרו אותך יותר מכל שער.',
            effects: {
              maccabism: 20,
              roleValue: 8,
              leadership: 6,
              flags: ['loyalty_moment'],
              remember: 'refused_transfer',
              milestone: {
                id: 'turned_down_europe',
                icon: '💚',
                text: 'סירבת להצעה גדולה מאירופה ונשארת',
                major: true,
              },
            },
          },
        ],
      },
    ],
  },
  {
    id: 'pr_title_race_leader',
    kicker: 'שלושה מחזורים לסוף',
    title: 'הקבוצה מסתכלת עליך',
    description:
      'אתה השחקן שהם מסתכלים עליו כשקשה. זו מחמאה, וזה גם משקל שצריך לסחוב עד סוף העונה.',
    category: 'pressure',
    conditions: { seniorPhases: ['prime'], atMaccabiSenior: true, minRoleValue: 68 },
    weight: 10,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'carry',
        label: 'לסחוב את הקבוצה',
        risk: 'risky',
        outcomes: [
          {
            id: 'champion',
            baseWeight: 45,
            tone: 'good',
            text: 'שלושה משחקים שבהם היית הכי טוב על הדשא. את האליפות הזאת יקשרו לשם שלך.',
            effects: {
              reputation: 10,
              maccabism: 10,
              roleValue: 9,
              confidence: 10,
              leadership: 8,
              remember: 'title_winner',
            },
            modifiers: [
              { attribute: 'ability', above: 74, multiplier: 1.45 },
              { attribute: 'form', above: 64, multiplier: 1.35 },
            ],
            traitModifiers: [{ trait: 'big_game', multiplier: 1.6 }],
          },
          {
            id: 'buckled',
            baseWeight: 55,
            tone: 'bad',
            text: 'המשקל היה כבד מדי. הפסדתם את זה בשתי נקודות, ואתה יודע איפה בדיוק.',
            effects: { confidence: -11, pressure: 11, form: -6, remember: 'big_mistake' },
          },
        ],
      },
      {
        id: 'share',
        label: 'לחלק את האחריות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'together',
            baseWeight: 100,
            tone: 'good',
            text: 'העברת את המסר שזה על כולם, לא על אחד. הקבוצה נשמה קצת יותר טוב.',
            effects: { leadership: 7, coachTrust: 5, form: 3, pressure: -5 },
            traitModifiers: [{ trait: 'leader', multiplier: 1.35 }],
          },
        ],
      },
    ],
  },
  {
    id: 'pr_club_symbol',
    kicker: 'ראיון לקראת משחק ה-200',
    title: 'אתה כבר סמל של המועדון',
    description:
      'העיתונאי אומר את זה כמו עובדה: "אתה מכבי חיפה." אתה לא בטוח מתי בדיוק זה קרה.',
    category: 'random',
    conditions: { seniorPhases: ['prime', 'veteran'], atMaccabiSenior: true, minMaccabism: 70 },
    weight: 8,
    oncePerCareer: true,
    choices: [
      {
        id: 'own_it',
        label: 'לקחת את זה על עצמך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'embraced',
            baseWeight: 100,
            tone: 'good',
            text: 'אמרת שאתה מרגיש אחריות כלפי הילד שישב ביציע לפני עשרים שנה. העיר אימצה את המשפט.',
            effects: {
              maccabism: 12,
              leadership: 8,
              roleValue: 5,
              flags: ['fan_favourite'],
              milestone: { id: 'club_symbol', icon: '🛡️', text: 'הפכת לסמל של המועדון', major: true },
            },
          },
        ],
      },
      {
        id: 'deflect',
        label: 'להעביר את זה לקבוצה',
        risk: 'safe',
        outcomes: [
          {
            id: 'humble',
            baseWeight: 100,
            tone: 'good',
            text: '"יש פה 25 שחקנים." תשובה משעממת לעיתונות, ומצוינת לחדר ההלבשה.',
            effects: { leadership: 6, coachTrust: 4, maccabism: 5 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* VETERAN - the last chapters                                        */
  /* ================================================================= */
  {
    id: 'vt_reduced_minutes',
    kicker: 'שיחה לפני העונה',
    title: 'המאמן מדבר על ניהול עומסים',
    description:
      '"נשמור עליך למשחקים הנכונים." אתה יודע בדיוק מה זה אומר, והוא יודע שאתה יודע.',
    category: 'coach',
    conditions: { seniorPhases: ['veteran'] },
    weight: 12,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'accept',
        label: 'לקבל את התפקיד החדש',
        risk: 'safe',
        outcomes: [
          {
            id: 'useful',
            baseWeight: 100,
            tone: 'good',
            text: 'שיחקת פחות ובאיכות גבוהה יותר. הגוף החזיק, והקבוצה קיבלה אותך במשחקים שצריך.',
            effects: {
              minutesModifier: 0.8,
              injuryRisk: -8,
              coachTrust: 6,
              leadership: 5,
              form: 4,
            },
            traitModifiers: [{ trait: 'professional', multiplier: 1.3 }],
          },
        ],
      },
      {
        id: 'fight_it',
        label: 'להגיד שאתה עדיין שחקן הרכב',
        risk: 'risky',
        outcomes: [
          {
            id: 'proved_it',
            baseWeight: 36,
            tone: 'good',
            text: 'שיחקת פריסיזן של בן 24 והכרחת אותו לשנות דעה. עוד עונה אחת בהרכב.',
            effects: { roleValue: 8, coachTrust: 6, confidence: 9, minutesModifier: 1.15 },
            modifiers: [
              { attribute: 'ability', above: 70, multiplier: 1.5 },
              { attribute: 'age', above: 35, multiplier: 0.5 },
            ],
            traitModifiers: [{ trait: 'self_believer', multiplier: 1.35 }],
          },
          {
            id: 'body_said_no',
            baseWeight: 64,
            tone: 'bad',
            text: 'הגוף ענה במקומך. שתי פציעות קטנות בחודש, וההחלטה התקבלה בלעדיך.',
            effects: {
              injuryRisk: 12,
              minutesModifier: 0.6,
              confidence: -7,
              roleValue: -6,
              remember: 'lost_starting_role',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'vt_captaincy_succession',
    kicker: 'סוף עונה, שיחה עם המאמן',
    title: 'מי יקבל את הסרט אחריך',
    description:
      'הוא שואל אותך למי להעביר את זה. זו שאלה מקצועית, והיא גם דרך מנומסת להגיד לך משהו.',
    category: 'team',
    conditions: { seniorPhases: ['veteran'], isCaptain: true },
    weight: 14,
    oncePerCareer: true,
    choices: [
      {
        id: 'name_youngster',
        label: 'להמליץ על הצעיר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'legacy',
            baseWeight: 100,
            tone: 'good',
            text: 'הצעת את הילד שעלה מהנוער. שנתיים אחר כך הוא מרים גביע, ואומר את השם שלך ברדיו.',
            effects: {
              maccabism: 10,
              leadership: 6,
              milestone: { id: 'passed_the_armband', icon: '🤝', text: 'העברת את הסרט לדור הבא', major: true },
            },
          },
        ],
      },
      {
        id: 'keep_it',
        label: 'להגיד שאתה עוד לא סיים',
        risk: 'risky',
        outcomes: [
          {
            id: 'one_more',
            baseWeight: 45,
            tone: 'good',
            text: 'הוא קיבל את זה. עוד עונה עם הסרט, ואתה מתכוון להצדיק כל דקה.',
            effects: { roleValue: 5, confidence: 7, leadership: 4, pressure: 5 },
            modifiers: [{ attribute: 'roleValue', above: 72, multiplier: 1.5 }],
          },
          {
            id: 'awkward',
            baseWeight: 55,
            tone: 'bad',
            text: 'הוא לא התווכח, ובכל זאת הסרט עבר בתחילת העונה. זה נגמר פחות יפה ממה שהיה צריך.',
            effects: { captain: false, leadership: -5, maccabism: -4, confidence: -6 },
          },
        ],
      },
    ],
  },
  {
    id: 'vt_final_contract',
    kicker: 'ינואר, שנה אחרונה בחוזה',
    title: 'החוזה האחרון',
    description:
      'מנהל הספורט לא מדבר על שנתיים. הוא מדבר על שנה, ועל "מה תרצה לעשות אחר כך".',
    category: 'contract',
    conditions: { seniorPhases: ['veteran'] },
    weight: 13,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'sign_here',
        label: 'לחתום ולסיים כאן',
        risk: 'safe',
        outcomes: [
          {
            id: 'closure',
            baseWeight: 100,
            tone: 'good',
            text: 'חתמת על שנה. שני הצדדים יודעים מה זה אומר, ושניהם בסדר עם זה.',
            effects: { maccabism: 9, confidence: 4, flags: ['loyalty_moment'] },
          },
        ],
      },
      {
        id: 'look_around',
        label: 'לבדוק מה יש בחוץ',
        risk: 'risky',
        outcomes: [
          {
            id: 'better_deal',
            baseWeight: 44,
            tone: 'neutral',
            text: 'יש מי שמוכן לתת לך שנתיים ודקות. בגיל הזה זו הצעה שקשה לפטור בהינף יד.',
            effects: { transferChance: 0.5, maccabism: -6, confidence: 4 },
          },
          {
            id: 'nothing_there',
            baseWeight: 56,
            tone: 'bad',
            text: 'הסוכן חזר בידיים ריקות. גילית בדיוק כמה שווה שחקן בן 34, וזה לא היה נעים.',
            effects: { confidence: -8, pressure: 6, maccabism: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'vt_final_derby',
    kicker: 'הדרבי האחרון שלך',
    title: 'בפעם האחרונה',
    description:
      'ידעת שזה האחרון עוד לפני שהודעת. בחימום הסתכלת על היציע קצת יותר מדי זמן.',
    category: 'match_moment',
    conditions: {
      seniorPhases: ['veteran'],
      atMaccabiSenior: true,
      minAge: 33,
      requiresDerby: true,
    },
    weight: 11,
    oncePerCareer: true,
    choices: [
      {
        id: 'empty_tank',
        label: 'לרוקן את המיכל',
        risk: 'risky',
        outcomes: [
          {
            id: 'perfect_goodbye',
            baseWeight: 44,
            tone: 'good',
            text: 'תשעים דקות שבהן שכחת בן כמה אתה. בסיום כל האצטדיון עמד, כולל היציע האורח.',
            effects: {
              maccabism: 14,
              reputation: 7,
              confidence: 10,
              flags: ['fan_favourite'],
              remember: 'derby_hero',
              milestone: { id: 'final_derby', icon: '🔥', text: 'הדרבי האחרון שלך - וערב מושלם', major: true },
            },
            modifiers: [{ attribute: 'form', above: 58, multiplier: 1.4 }],
            traitModifiers: [{ trait: 'big_game', multiplier: 1.6 }],
          },
          {
            id: 'legs_gone',
            baseWeight: 56,
            tone: 'neutral',
            text: 'הרצון היה שם, הרגליים פחות. הוחלפת בדקה 62 והאצטדיון קם בכל זאת.',
            effects: { maccabism: 8, confidence: -2, injuryRisk: 5 },
          },
        ],
      },
      {
        id: 'enjoy_it',
        label: 'פשוט ליהנות מהערב',
        risk: 'safe',
        outcomes: [
          {
            id: 'present',
            baseWeight: 100,
            tone: 'good',
            text: 'שיחקת בלי לחץ ובלי להוכיח כלום, ונהנית מכל דקה. זה מגיע לך.',
            effects: { maccabism: 9, confidence: 6, pressure: -8 },
          },
        ],
      },
    ],
  },
  {
    id: 'vt_farewell_season',
    kicker: 'הודעה לפני העונה האחרונה',
    title: 'עונת הפרידה',
    description:
      'להודיע מראש שזו האחרונה, או לשחק בשקט ולהחליט בסוף. שתי דרכים לסיים, ושתיהן לגיטימיות.',
    category: 'random',
    conditions: { seniorPhases: ['veteran'], minAge: 34 },
    weight: 12,
    oncePerCareer: true,
    choices: [
      {
        id: 'announce',
        label: 'להודיע מראש',
        risk: 'balanced',
        outcomes: [
          {
            id: 'farewell_tour',
            baseWeight: 100,
            tone: 'good',
            text: 'כל מגרש בליגה מחא לך כפיים בפעם האחרונה. יש בזה משהו מביך ומרגש בו-זמנית.',
            effects: {
              maccabism: 10,
              reputation: 4,
              pressure: -6,
              milestone: { id: 'farewell_season', icon: '👋', text: 'הכרזת על עונת הפרידה', major: true },
            },
          },
        ],
      },
      {
        id: 'quiet',
        label: 'לשחק ולראות',
        risk: 'safe',
        outcomes: [
          {
            id: 'no_fuss',
            baseWeight: 100,
            tone: 'neutral',
            text: 'לא אמרת כלום לאף אחד. אולי עוד שנה, אולי לא - בינתיים יש משחק בשבת.',
            effects: { pressure: -3, form: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'vt_coaching_offer',
    kicker: 'קפה עם מנהל המחלקה',
    title: 'מה תעשה אחר כך',
    description:
      'הוא לא מציע לך חוזה שחקן. הוא מדבר על תפקיד במחלקת הנוער, על ילדים בני תשע, ועל מעגל שנסגר.',
    category: 'contract',
    conditions: { seniorPhases: ['veteran'], minAge: 34, atMaccabi: true },
    weight: 10,
    oncePerCareer: true,
    choices: [
      {
        id: 'interested',
        label: 'זה מעניין אותי',
        risk: 'safe',
        outcomes: [
          {
            id: 'future_set',
            baseWeight: 100,
            tone: 'good',
            text: 'לא חתמת על כלום, אבל שניכם יודעים שיש לך בית גם אחרי שתפסיק לשחק.',
            effects: {
              maccabism: 12,
              leadership: 6,
              pressure: -6,
              milestone: { id: 'future_at_the_club', icon: '🌱', text: 'המועדון הציע לך עתיד גם אחרי הנעליים', major: true },
            },
          },
        ],
      },
      {
        id: 'not_yet',
        label: 'אני עוד שחקן',
        risk: 'balanced',
        outcomes: [
          {
            id: 'still_playing',
            baseWeight: 100,
            tone: 'neutral',
            text: '"תדבר איתי כשאני אפסיק." הוא צחק ואמר שזו בדיוק התשובה שציפה לה.',
            effects: { confidence: 5, form: 3 },
          },
        ],
      },
    ],
  },
];

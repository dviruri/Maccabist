import type { GameEvent } from '../../types';

/**
 * Academy events (טרום ב׳ → נוער).
 *
 * Every choice opens a *distribution*, not a fixed result. `baseWeight` sets the shape and
 * `modifiers` bend it towards the player: a trusted, confident, talented kid lands the good
 * outcomes more often - but never always.
 */

export const ACADEMY_EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* טרום / ילדים                                                      */
  /* ================================================================= */
  {
    id: 'kids_older_group',
    kicker: 'מגרשי האימונים, יום שלישי בערב',
    title: 'המאמן רוצה להעלות אותך שנתון',
    description:
      'אחרי האימון המאמן קורא לך הצידה. "אתה קטן מהם בשנה, אבל אתה מבין את המשחק יותר טוב. בוא תנסה איתם."',
    category: 'opportunity',
    conditions: { bands: ['children', 'teens'], olderGroup: ['none'], maxAge: 15 },
    weight: 10,
    oncePerStage: true,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'go_up',
        label: 'אני הולך על זה',
        hint: 'מתפתחים מהר יותר, אבל תשחק פחות',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'thrived',
            baseWeight: 22,
            tone: 'good',
            text: 'תוך שלושה אימונים הפסיקו להתייחס אליך כאל הקטן. אתה פשוט אחד מהם עכשיו.',
            effects: {
              ability: 2.5,
              coachTrust: 7,
              confidence: 6,
              olderGroup: 'playing',
              promotionBoost: 6,
              startArc: 'older_group',
              arcBranch: 'thrived',
              remember: 'older_group_success',
            },
            modifiers: [
              { attribute: 'abilityVsLevel', above: 6, multiplier: 1.5 },
              { attribute: 'potential', above: 84, multiplier: 1.35 },
              { attribute: 'confidence', above: 65, multiplier: 1.25 },
              { attribute: 'confidence', below: 40, multiplier: 0.5 },
            ],
          },
          {
            id: 'held_own',
            baseWeight: 40,
            tone: 'good',
            text: 'קשה לך בהתחלה, אבל אחרי כמה שבועות אתה מדביק את הקצב. המאמן מרוצה.',
            effects: {
              ability: 1.4,
              coachTrust: 3,
              olderGroup: 'training',
              confidence: 2,
              startArc: 'older_group',
              arcBranch: 'held_own',
              remember: 'older_group_success',
            },
          },
          {
            id: 'struggled',
            baseWeight: 28,
            tone: 'bad',
            text: 'הם גדולים ממך פיזית ואתה מוצא את עצמך רץ אחרי הכדור. חוזר לשנתון שלך קצת שבור.',
            effects: {
              confidence: -8,
              coachTrust: -3,
              form: -4,
              startArc: 'older_group',
              arcBranch: 'struggled',
              remember: 'older_group_failure',
            },
            modifiers: [
              { attribute: 'abilityVsLevel', below: 0, multiplier: 1.6 },
              { attribute: 'abilityVsLevel', above: 8, multiplier: 0.45 },
              { attribute: 'coachTrust', above: 70, multiplier: 0.7 },
            ],
          },
          {
            id: 'breakthrough',
            baseWeight: 8,
            conditions: { minPotential: 82 },
            tone: 'good',
            text: 'לא רק שעמדת בקצב - שלטת. אחרי חודש כבר מדברים עליך בכל המחלקה.',
            effects: {
              ability: 4,
              coachTrust: 11,
              confidence: 9,
              olderGroup: 'playing',
              promotionBoost: 16,
              flags: ['academy_star'],
              startArc: 'older_group',
              arcBranch: 'thrived',
              remember: 'older_group_success',
              milestone: {
                id: 'older_group_breakthrough',
                icon: '⬆️',
                text: 'קפצת שנתון ושלטת בו',
                major: true,
              },
            },
            modifiers: [
              { attribute: 'potential', above: 88, multiplier: 1.8 },
              { attribute: 'abilityVsLevel', above: 10, multiplier: 1.6 },
              { attribute: 'coachTrust', above: 72, multiplier: 1.3 },
            ],
          },
        ],
      },
      {
        id: 'stay',
        label: 'אני מעדיף להישאר כרגע',
        hint: 'תמשיך להוביל את השנתון שלך',
        risk: 'safe',
        outcomes: [
          {
            id: 'leader',
            baseWeight: 65,
            tone: 'neutral',
            preview: 'תישאר החזק בקבוצה ותשחק כל דקה',
            text: 'אתה נשאר החזק בקבוצה, משחק את כל הדקות ונהנה מכל רגע.',
            effects: { ability: 0.8, confidence: 5, roleValue: 4 },
          },
          {
            id: 'coach_note',
            baseWeight: 35,
            tone: 'bad',
            preview: 'המאמן ירשום לעצמו שכשקראו לך לא באת',
            text: 'המאמן לא אמר כלום, אבל רשם לעצמו שכשקראו לך - לא באת.',
            effects: { coachTrust: -4, confidence: 2, roleValue: 2 },
            modifiers: [{ attribute: 'coachTrust', above: 70, multiplier: 0.55 }],
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
      'המאמן אומר לך את זה בלי לרכך: "יש עוד עשרה כמוך בליגה. ההבדל יהיה מה אתה עושה כשאף אחד לא מסתכל."',
    category: 'coach',
    conditions: { bands: ['children', 'teens'] },
    weight: 9,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'extra_training',
        label: 'להישאר אחרי כל אימון',
        hint: 'יכולת ואמון - במחיר שחיקה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'paid_off',
            baseWeight: 58,
            tone: 'good',
            preview: 'שעה נוספת כל יום נכנסת למשחק שלך',
            text: 'שעה נוספת כל יום מול הקיר. הנגיעה הראשונה שלך הופכת לנשק.',
            effects: { ability: 2.4, coachTrust: 6, discipline: 6, injuryRisk: 2 },
            modifiers: [
              { attribute: 'discipline', above: 65, multiplier: 1.3 },
              { attribute: 'discipline', below: 45, multiplier: 0.6 },
            ],
          },
          {
            id: 'burned_out',
            baseWeight: 26,
            tone: 'bad',
            preview: 'העומס מוקדם מדי לגוף שלך, וכאבי גדילה מלווים את כל העונה',
            text: 'העומס מוקדם מדי לגוף הצעיר שלך. כאבי גדילה בברכיים מלווים אותך כל העונה.',
            effects: { ability: 0.6, injuryRisk: 9, form: -5, coachTrust: 1 },
            modifiers: [{ attribute: 'injuryRisk', above: 25, multiplier: 1.5 }],
          },
          {
            id: 'noticed',
            baseWeight: 16,
            tone: 'good',
            preview: 'מנהל המחלקה רואה אותך לבד עם הכדור בשבע בערב',
            text: 'מנהל המחלקה עבר במקרה במגרש בשבע בערב וראה אותך לבד עם הכדור. זה נשאר איתו.',
            effects: { ability: 1.8, coachTrust: 10, promotionBoost: 5, discipline: 5 },
            modifiers: [{ attribute: 'discipline', above: 70, multiplier: 1.4 }],
          },
        ],
      },
      {
        id: 'balance',
        label: 'לשמור על איזון',
        hint: 'ילדות, חברים, ראש נקי',
        risk: 'safe',
        outcomes: [
          {
            id: 'happy',
            baseWeight: 70,
            tone: 'neutral',
            preview: 'אתה נשאר ילד שמח, וזה נראה על המגרש',
            text: 'אתה נשאר ילד. מגיע לאימונים שמח, וזה נראה על המגרש.',
            effects: { ability: 0.9, confidence: 5, pressure: -6, form: 4 },
          },
          {
            id: 'slipped',
            baseWeight: 30,
            tone: 'bad',
            preview: 'שניים מהשנתון עוברים אותך בזמן שנהנית',
            text: 'בזמן שאתה נהנית, שניים מהשנתון עברו אותך. המאמן שם לב.',
            effects: { coachTrust: -5, roleValue: -3, pressure: -4 },
            modifiers: [{ attribute: 'abilityVsLevel', above: 8, multiplier: 0.5 }],
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
      'שלושה משחקים ברצף שאתה נכנס לעשר דקות. אבא שלך שואל אם לדבר עם המאמן.',
    category: 'coach',
    conditions: { bands: ['children', 'teens'], maxRoleValue: 45 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'dad_talks',
        label: 'שאבא ידבר עם המאמן',
        hint: 'אולי תקבל דקות, אולי תיצרב',
        risk: 'risky',
        outcomes: [
          {
            id: 'listened',
            baseWeight: 35,
            tone: 'good',
            preview: 'המאמן מקשיב, ואתה בהרכב במשחק הבא',
            text: 'המאמן מקשיב ונותן לך הרכב במשחק הבא. אתה מנצל.',
            effects: { roleValue: 6, confidence: 5, coachTrust: 2 },
            modifiers: [{ attribute: 'coachTrust', above: 65, multiplier: 1.5 }],
          },
          {
            id: 'backfired',
            baseWeight: 50,
            tone: 'bad',
            preview: 'המאמן לא אוהב הורים על הגדר, והדקות מתקצרות',
            text: 'המאמן לא אוהב הורים על הגדר. הדקות שלך דווקא מתקצרות.',
            effects: { roleValue: -5, coachTrust: -8, confidence: -4 },
            modifiers: [{ attribute: 'coachTrust', above: 70, multiplier: 0.6 }],
          },
          {
            id: 'honest_answer',
            baseWeight: 15,
            tone: 'neutral',
            preview: 'תקבל תשובה כנה על מה שחסר לך',
            text: 'המאמן אומר בפנים גלויות מה חסר לך. זה כאב לשמוע, אבל עכשיו אתה יודע.',
            effects: { discipline: 6, confidence: -2, coachTrust: 2 },
          },
        ],
      },
      {
        id: 'shut_up_work',
        label: 'לשתוק ולעבוד',
        hint: 'לוקח יותר זמן, בונה אופי',
        risk: 'balanced',
        outcomes: [
          {
            id: 'earned',
            baseWeight: 55,
            tone: 'good',
            preview: 'המאמן שם לב שאתה האחרון שעוזב, והדקות מגיעות',
            text: 'המאמן שם לב שאתה האחרון שעוזב את המגרש. הדקות מגיעות לבד.',
            effects: { roleValue: 5, coachTrust: 6, discipline: 6, ability: 1 },
            modifiers: [
              { attribute: 'discipline', above: 65, multiplier: 1.35 },
              { attribute: 'abilityVsLevel', above: 4, multiplier: 1.3 },
            ],
          },
          {
            id: 'nothing_changed',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'העונה נגמרת בלי שינוי, אבל לא ויתרת',
            text: 'העונה נגמרת בלי שינוי אמיתי, אבל אתה יודע שלא ויתרת.',
            effects: { discipline: 5, confidence: -3, coachTrust: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_first_stadium',
    kicker: 'סמי עופר, ערב אליפות',
    title: 'הפעם הראשונה ביציע',
    description:
      'המחלקה מקבלת כרטיסים. 30 אלף איש, האורות, השירים. באוטובוס בדרך חזרה אתה לא מפסיק לדבר.',
    category: 'family',
    conditions: { bands: ['children'], atMaccabi: true },
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'dream',
        label: 'להבטיח לעצמך שתשחק שם',
        risk: 'balanced',
        outcomes: [
          {
            id: 'fire',
            baseWeight: 100,
            tone: 'good',
            text: 'משהו בך משתנה באותו ערב. מהיום זה כבר לא רק כיף - זו מטרה.',
            effects: { maccabism: 9, confidence: 4, pressure: 4, discipline: 3 },
          },
        ],
      },
      {
        id: 'enjoy',
        label: 'פשוט ליהנות מהערב',
        risk: 'safe',
        outcomes: [
          {
            id: 'joy',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה שר עם כולם, מאבד את הקול, ונרדם על הכתף של אבא באוטובוס.',
            effects: { maccabism: 6, pressure: -5, confidence: 3, form: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_travel',
    kicker: 'שני אוטובוסים כל יום',
    title: 'הדרך ארוכה',
    description:
      'הנסיעות לאימונים אוכלות שלוש שעות ביום. קבוצה קטנה ליד הבית מציעה לך מקום ומשכורת קטנה להורים.',
    category: 'family',
    conditions: { bands: ['children'], atMaccabi: true },
    weight: 7,
    oncePerCareer: true,
    choices: [
      {
        id: 'stay_maccabi',
        label: 'להמשיך לנסוע. זו מכבי חיפה.',
        hint: 'מכביסטיות - במחיר עייפות',
        risk: 'balanced',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'committed',
            baseWeight: 72,
            tone: 'good',
            preview: 'תעשה את הדרך כל יום, ובמחלקה שמים לב מי באמת רוצה',
            text: 'אתה עושה את הדרך כל יום, חורף וקיץ. במחלקה שמים לב מי באמת רוצה.',
            effects: { maccabism: 10, coachTrust: 5, discipline: 5, form: -2 },
          },
          {
            id: 'worn',
            baseWeight: 28,
            tone: 'bad',
            preview: 'תגיע לאימונים חצי ישן, הראש עוד באוטובוס',
            text: 'אתה מגיע לאימונים חצי ישן. הרגליים שם, הראש עוד באוטובוס.',
            effects: { maccabism: 8, form: -7, ability: -0.5 },
          },
        ],
      },
      {
        id: 'move_local',
        label: 'לעבור לקבוצה הקרובה',
        hint: 'עדיף לגוף, פחות לחלום',
        risk: 'risky',
        outcomes: [
          {
            id: 'left',
            baseWeight: 100,
            tone: 'bad',
            text: 'אתה מתאמן רענן ומשחק הרבה, אבל הרמה נמוכה יותר וכולם יודעים איפה היית אמור להיות.',
            effects: {
              maccabism: -16,
              ability: 0.8,
              /*
               * A pool, not a club (v0.4.1). This used to name Hapoel Afula, which is a *senior*
               * club - so a boy choosing "move to the local team" was made a senior professional
               * on the spot. It was also 55% of every second-division season in the game.
               */
              transferTo: 'external_youth',
              flags: ['released_by_maccabi'],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'kids_school',
    kicker: 'מבחן מחר בבוקר',
    title: 'בית ספר או אימון',
    description:
      'מבחן חשוב מחר, ואימון היום בשבע. אמא שלך אומרת שהפעם לומדים. המאמן אמר שנוכחות זה הכול.',
    category: 'family',
    conditions: { bands: ['children', 'teens'] },
    weight: 6,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'training',
        label: 'ללכת לאימון',
        risk: 'balanced',
        outcomes: [
          {
            id: 'good_session',
            baseWeight: 60,
            tone: 'good',
            preview: 'אימון מצוין, והמאמן מזכיר אותך לטובה מול כולם',
            text: 'אימון מצוין, המאמן הזכיר אותך לטובה מול כולם. את המבחן תשלים.',
            effects: { coachTrust: 5, ability: 1, confidence: 3 },
          },
          {
            id: 'home_trouble',
            baseWeight: 40,
            tone: 'bad',
            preview: 'תלך, ובבית זה יעלה ביוקר',
            text: 'הלכת, אבל בבית זה עלה ביוקר. השבוע הבא היה מתוח.',
            effects: { coachTrust: 4, confidence: -5, pressure: 5 },
          },
        ],
      },
      {
        id: 'study',
        label: 'להישאר ללמוד',
        risk: 'safe',
        outcomes: [
          {
            id: 'understood',
            baseWeight: 55,
            tone: 'neutral',
            preview: 'המאמן מבין, ובבית גאים בך',
            text: 'המאמן הבין. בבית היו גאים בך.',
            effects: { confidence: 4, discipline: 4, coachTrust: -1 },
          },
          {
            id: 'marked',
            baseWeight: 45,
            tone: 'bad',
            preview: '"בסדר" בטון שאומר שזה לא בסדר',
            text: 'המאמן אמר "בסדר" בטון שאומר שזה לא בסדר. בהרכב הבא לא היית.',
            effects: { coachTrust: -6, roleValue: -3, discipline: 3 },
            modifiers: [{ attribute: 'coachTrust', above: 68, multiplier: 0.5 }],
          },
        ],
      },
    ],
  },
  {
    id: 'kids_growth_spurt',
    kicker: 'שלושה סנטימטרים בחודשיים',
    title: 'הגוף משתנה מהר מדי',
    description:
      'צמחת בבת אחת והרגליים לא מקשיבות. כל תנועה מרגישה זרה, והכדור לא נדבק כמו קודם.',
    category: 'development',
    conditions: { bands: ['children', 'teens'], minAge: 12, maxAge: 15 },
    weight: 7,
    oncePerCareer: true,
    choices: [
      {
        id: 'patient',
        label: 'לעבוד על הגוף בסבלנות',
        risk: 'safe',
        outcomes: [
          {
            id: 'adapted',
            baseWeight: 68,
            tone: 'good',
            preview: 'חצי עונה של קואורדינציה, ואז הכול חוזר - רק גבוה יותר',
            text: 'חצי עונה של תרגילי קואורדינציה, ואז פתאום הכול חוזר - רק שעכשיו אתה גבוה יותר.',
            effects: { ability: 2, injuryRisk: -5, confidence: 3, discipline: 4 },
          },
          {
            id: 'slow',
            baseWeight: 32,
            tone: 'neutral',
            preview: 'עונה שלמה של להרגיש לא במקום',
            text: 'לקח יותר זמן ממה שקיווית. עונה שלמה של להרגיש לא במקום.',
            effects: { form: -6, confidence: -4, injuryRisk: -2 },
          },
        ],
      },
      {
        id: 'push_through',
        label: 'לשחק דרך זה',
        risk: 'risky',
        outcomes: [
          {
            id: 'fine',
            baseWeight: 45,
            tone: 'good',
            text: 'התעלמת מהתחושה המוזרה ופשוט המשכת לשחק. הגוף הדביק את עצמו.',
            effects: { ability: 1.5, coachTrust: 3, confidence: 4 },
            modifiers: [{ attribute: 'confidence', above: 65, multiplier: 1.4 }],
          },
          {
            id: 'injury',
            baseWeight: 55,
            tone: 'bad',
            preview: 'משיכה בירך, בדיוק מה שקורה כשלא נותנים לגוף להסתדר',
            text: 'משכת בירך באמצע משחק. הרופא אמר שזה בדיוק מה שקורה כשלא נותנים לגוף להסתדר.',
            effects: { injuryRisk: 12, form: -8, minutesModifier: 0.7, coachTrust: -2 },
            modifiers: [{ attribute: 'injuryRisk', above: 25, multiplier: 1.4 }],
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* נערים                                                             */
  /* ================================================================= */
  {
    id: 'youth_agent',
    kicker: 'שיחת טלפון לסלון',
    title: 'סוכן פונה למשפחה',
    description:
      'סוכן מוכר מתקשר להורים. "אני עובד עם שלושה שחקנים בליגת העל. אני רוצה לייצג את הבן שלכם."',
    category: 'contract',
    conditions: { bands: ['teens', 'u19'], minAbility: 45 },
    weight: 8,
    oncePerCareer: true,
    choices: [
      {
        id: 'sign',
        label: 'לחתום עם הסוכן',
        hint: 'פותח דלתות, מוסיף רעש',
        risk: 'balanced',
        effects: { flags: ['agent_signed'] },
        outcomes: [
          {
            id: 'doors',
            baseWeight: 50,
            tone: 'good',
            preview: 'מחנה אימונים בחו״ל, והשם שלך מתחיל להסתובב',
            text: 'הוא מכניס אותך למחנה אימונים בחו״ל ומדבר עליך בכל מקום. השם שלך מתחיל להסתובב.',
            effects: { reputation: 8, ability: 1, pressure: 5 },
            modifiers: [{ attribute: 'ability', above: 60, multiplier: 1.3 }],
          },
          {
            id: 'noise',
            baseWeight: 35,
            tone: 'bad',
            preview: 'מבטיח הרבה ומגיע מעט, ובמחלקה לא אוהבים את זה',
            text: 'הוא מבטיח הרבה ומגיע מעט. במחלקה לא אוהבים את השיחות שלו עם עיתונאים.',
            effects: { reputation: 3, maccabism: -4, coachTrust: -6 },
          },
          {
            id: 'real_deal',
            baseWeight: 15,
            conditions: { minPotential: 84 },
            tone: 'good',
            preview: 'תוך חודשיים הוא מביא צופה אמיתי למגרש',
            text: 'תוך חודשיים הוא הביא צופה אמיתי למגרש האימונים. פתאום זה מרגיש רציני.',
            effects: { reputation: 13, promotionBoost: 6, confidence: 5, flags: ['first_team_radar'] },
            modifiers: [{ attribute: 'potential', above: 88, multiplier: 1.6 }],
          },
        ],
      },
      {
        id: 'wait',
        label: 'לחכות. קודם כדורגל.',
        risk: 'safe',
        outcomes: [
          {
            id: 'quiet',
            baseWeight: 100,
            tone: 'neutral',
            text: 'ההורים מודים לו בנימוס. אתה ממשיך להתאמן בשקט, בלי אף אחד שמנפח לך את הראש.',
            effects: { pressure: -6, ability: 1.2, discipline: 4, coachTrust: 3 },
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
      'מחלקת נוער של מועדון מתחרה פונה אליך ישירות: "אצלנו אתה משחק 90 דקות כל שבוע."',
    category: 'transfer',
    conditions: { bands: ['teens'], atMaccabi: true, maxRoleValue: 52 },
    weight: 7,
    oncePerCareer: true,
    choices: [
      {
        id: 'stay',
        label: 'להישאר ולהילחם על המקום',
        hint: 'קשה יותר, אבל זה הבית',
        risk: 'balanced',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'won_place',
            baseWeight: 45,
            tone: 'good',
            preview: 'תישאר, ואחרי חצי עונה תחטוף את המקום',
            text: 'אתה נשאר. אחרי חצי עונה אתה חוטף את המקום ממי שהיה לפניך.',
            effects: { maccabism: 8, roleValue: 9, coachTrust: 6, ability: 1.5 },
            modifiers: [
              { attribute: 'coachTrust', above: 60, multiplier: 1.4 },
              { attribute: 'abilityVsLevel', above: 4, multiplier: 1.4 },
            ],
          },
          {
            id: 'still_fighting',
            baseWeight: 55,
            tone: 'neutral',
            preview: 'תישאר ותמשיך להיאבק על דקות',
            text: 'אתה נשאר וממשיך להיאבק על דקות. לא קל, אבל אתה עדיין כאן.',
            effects: { maccabism: 8, ability: 0.8, confidence: -3 },
          },
        ],
      },
      {
        id: 'leave',
        label: 'לעבור. דקות זה מה שחשוב עכשיו.',
        hint: 'תשחק הרבה - אבל תצא מהמסלול',
        risk: 'risky',
        effects: { flags: ['betrayal_moment'] },
        outcomes: [
          {
            id: 'gone',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה משחק כל דקה אפשרית ומתפתח, אבל בחיפה כבר לא סופרים אותך כאחד משלהם.',
            effects: {
              maccabism: -18,
              ability: 2.5,
              transferTo: 'maccabi_netanya',
              flags: ['released_by_maccabi'],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_gym',
    kicker: 'חדר הכושר החדש',
    title: 'תוכנית כוח אישית',
    description:
      'מאמן הכושר בנה לך תוכנית. זה אומר לקום בשש בבוקר, גם בחופש, גם בחורף.',
    category: 'development',
    conditions: { bands: ['teens', 'u19'], minAge: 14 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'commit',
        label: 'לעשות הכול לפי הספר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'transformed',
            baseWeight: 55,
            tone: 'good',
            preview: 'הגוף משתנה תוך עונה, ואתה כבר לא נזרק מהכדור',
            text: 'הגוף שלך משתנה תוך עונה. אתה כבר לא נזרק מהכדור.',
            effects: { ability: 2.6, injuryRisk: -7, discipline: 6, coachTrust: 4 },
            modifiers: [{ attribute: 'discipline', above: 65, multiplier: 1.4 }],
          },
          {
            id: 'partial_gain',
            baseWeight: 33,
            tone: 'neutral',
            preview: 'תתחזק, אבל תגיע לחלק מהאימונים שחוק',
            text: 'אתה מתחזק, אבל מגיע לחלק מהאימונים שחוק.',
            effects: { ability: 1.3, form: -3, injuryRisk: -2 },
          },
          {
            id: 'overtrained',
            baseWeight: 12,
            tone: 'bad',
            preview: 'הגב תופס אותך באמצע ינואר ולא משחרר חודש',
            text: 'הגזמת. הגב תפס אותך באמצע ינואר ולא שחרר חודש.',
            effects: { injuryRisk: 11, form: -7, minutesModifier: 0.75 },
            modifiers: [{ attribute: 'injuryRisk', above: 28, multiplier: 1.5 }],
          },
        ],
      },
      {
        id: 'partial',
        label: 'לעשות את זה בקצב שלי',
        risk: 'safe',
        outcomes: [
          {
            id: 'ok',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה מגיע לרוב האימונים. לא כולם, אבל רוב.',
            effects: { ability: 0.8, injuryRisk: -1, discipline: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_friends',
    kicker: 'סוף שבוע',
    title: 'החברים מבחוץ',
    description: 'כולם יוצאים הערב. יש לך משחק בעשר בבוקר. אף אחד לא יידע חוץ ממך.',
    category: 'discipline',
    conditions: { bands: ['teens', 'u19'], minAge: 14 },
    weight: 7,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'go_out',
        label: 'לצאת. גם זה חלק מהחיים.',
        risk: 'risky',
        outcomes: [
          {
            id: 'got_away',
            baseWeight: 40,
            tone: 'neutral',
            preview: 'ערב מצוין, בוקר פחות, ואף אחד לא אומר כלום',
            text: 'ערב מצוין, בוקר פחות. שיחקת בינוני ואף אחד לא אמר כלום.',
            effects: { discipline: -5, form: -4, pressure: -6 },
          },
          {
            id: 'caught',
            baseWeight: 45,
            tone: 'bad',
            preview: 'המאמן מריח את זה מרחוק, ואתה על הספסל',
            text: 'המאמן מריח את זה מרחוק. אתה מוצא את עצמך בספסל למשחק הבא.',
            effects: { discipline: -8, coachTrust: -9, roleValue: -4 },
            modifiers: [{ attribute: 'discipline', below: 50, multiplier: 1.5 }],
          },
          {
            id: 'trouble',
            baseWeight: 15,
            tone: 'bad',
            preview: 'תמונה מהערב מגיעה לקבוצת ההורים',
            text: 'תמונה מהערב הגיעה לקבוצת הוואטסאפ של ההורים. במועדון עשו מזה עניין.',
            effects: {
              discipline: -12,
              coachTrust: -14,
              roleValue: -7,
              flags: ['discipline_problem'],
            },
            modifiers: [{ attribute: 'discipline', above: 70, multiplier: 0.4 }],
          },
        ],
      },
      {
        id: 'stay_home',
        label: 'להישאר בבית',
        risk: 'safe',
        outcomes: [
          {
            id: 'sharp',
            baseWeight: 100,
            tone: 'good',
            text: 'ישנת שמונה שעות והגעת רענן. במשחק הזה אתה הכי טוב על המגרש.',
            effects: { discipline: 6, form: 6, coachTrust: 3, ability: 0.6 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_captain_band',
    kicker: 'לפני המשחק',
    title: 'הסרט של הקבוצה',
    description: 'המאמן מחזיק את הסרט ומסתכל עליך. "אתה רוצה את זה?"',
    category: 'coach',
    conditions: { bands: ['teens', 'u19'], minRoleValue: 55, minCoachTrust: 58 },
    weight: 8,
    oncePerStage: true,
    choices: [
      {
        id: 'take',
        label: 'לקחת את הסרט',
        hint: 'אחריות - ועיניים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'natural',
            baseWeight: 55,
            tone: 'good',
            text: 'אתה לומד לדבר בחדר הלבשה. זה משנה איך מסתכלים עליך בכל המחלקה.',
            effects: { roleValue: 8, coachTrust: 8, maccabism: 5, promotionBoost: 5, pressure: 5 },
            modifiers: [
              { attribute: 'confidence', above: 62, multiplier: 1.4 },
              { attribute: 'confidence', below: 42, multiplier: 0.5 },
            ],
          },
          {
            id: 'heavy',
            baseWeight: 45,
            tone: 'bad',
            text: 'האחריות התיישבה לך על הכתפיים. במקום לשחק, התחלת לחשוב יותר מדי.',
            effects: { pressure: 12, form: -6, confidence: -5, roleValue: 3 },
            modifiers: [{ attribute: 'confidence', above: 70, multiplier: 0.45 }],
          },
        ],
      },
      {
        id: 'decline',
        label: 'לוותר. אני מדבר במגרש.',
        risk: 'safe',
        outcomes: [
          {
            id: 'focused',
            baseWeight: 70,
            tone: 'neutral',
            text: 'אתה מוריד את הראש וממשיך לעבוד. פחות אחריות, פחות עיניים.',
            effects: { pressure: -7, ability: 1.2, form: 3 },
          },
          {
            id: 'disappointed',
            baseWeight: 30,
            tone: 'bad',
            text: 'המאמן ציפה שתקפוץ על זה. הוא לא אמר כלום, אבל הסרט הלך למישהו אחר.',
            effects: { coachTrust: -5, pressure: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_position_change',
    kicker: 'אחרי אימון טקטי',
    title: 'המאמן רוצה להזיז אותך',
    description:
      'המאמן חושב שהתפקיד שלך על המגרש לא מנצל אותך נכון. הוא רוצה לנסות אותך במקום אחר.',
    category: 'development',
    conditions: { bands: ['teens'], notPositions: ['GK'] },
    weight: 6,
    oncePerCareer: true,
    choices: [
      {
        id: 'try',
        label: 'לנסות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'found_home',
            baseWeight: 48,
            tone: 'good',
            preview: 'משם המשחק נראה אחרת, וישאלו למה לא עשו את זה קודם',
            text: 'משם המשחק נראה אחרת לגמרי. אחרי שלושה משחקים כולם שואלים למה לא עשו את זה קודם.',
            effects: { ability: 2.2, coachTrust: 7, confidence: 5, roleValue: 5 },
          },
          {
            id: 'awkward',
            baseWeight: 37,
            tone: 'bad',
            preview: 'חודשיים של לרוץ בלי לדעת בדיוק לאן',
            text: 'לא הרגשת את המשחק משם. חודשיים של לרוץ בלי לדעת בדיוק לאן.',
            effects: { form: -6, confidence: -5, coachTrust: -2 },
          },
          {
            id: 'versatile',
            baseWeight: 15,
            tone: 'good',
            preview: 'תדע לשחק בשתי עמדות - וזה שווה זהב בסגל',
            text: 'לא הפכת לשחקן אחר, אבל עכשיו אתה יודע לשחק בשתי עמדות. זה שווה זהב בסגל.',
            effects: { coachTrust: 6, roleValue: 4, ability: 1 },
          },
        ],
      },
      {
        id: 'refuse',
        label: 'להגיד שאתה מעדיף להישאר',
        risk: 'risky',
        outcomes: [
          {
            id: 'respected',
            baseWeight: 45,
            tone: 'neutral',
            text: 'המאמן הרים גבה אבל כיבד את זה. נשארת איפה שאתה מרגיש בבית.',
            effects: { confidence: 3, coachTrust: -3 },
            modifiers: [{ attribute: 'coachTrust', above: 70, multiplier: 1.5 }],
          },
          {
            id: 'stubborn',
            baseWeight: 55,
            tone: 'bad',
            preview: 'המאמן לא אוהב שמסבירים לו טקטיקה בגיל הזה',
            text: 'המאמן לא אוהב שחקנים שמסבירים לו על טקטיקה בגיל הזה.',
            effects: { coachTrust: -8, roleValue: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'youth_new_signing',
    kicker: 'הבחור החדש',
    title: 'הביאו מישהו לעמדה שלך',
    description:
      'המחלקה החתימה שחקן חדש מקבוצה אחרת. הוא בדיוק בעמדה שלך, והוא נראה טוב.',
    category: 'competition',
    conditions: { bands: ['teens', 'u19'], minRoleValue: 40 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'raise_level',
        label: 'להעלות הילוך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'kept_place',
            baseWeight: 50,
            tone: 'good',
            text: 'שלושה שבועות של אימונים מטורפים. המאמן לא יכול היה להוציא אותך.',
            effects: { ability: 1.8, coachTrust: 6, roleValue: 5, form: 5 },
            modifiers: [
              { attribute: 'abilityVsLevel', above: 5, multiplier: 1.45 },
              { attribute: 'form', above: 65, multiplier: 1.25 },
            ],
          },
          {
            id: 'lost_place',
            baseWeight: 38,
            tone: 'bad',
            text: 'הוא פשוט היה טוב יותר העונה. אתה חוזר לספסל ומחכה להזדמנות.',
            effects: { roleValue: -8, confidence: -6, coachTrust: -3, minutesModifier: 0.75 },
            modifiers: [{ attribute: 'abilityVsLevel', above: 8, multiplier: 0.45 }],
          },
          {
            id: 'both_played',
            baseWeight: 12,
            tone: 'good',
            text: 'המאמן מצא דרך לשחק עם שניכם. פתאום הקבוצה נראית אחרת.',
            effects: { roleValue: 3, coachTrust: 4, ability: 1.2, confidence: 3 },
          },
        ],
      },
      {
        id: 'sulk',
        label: 'לקחת את זה אישית',
        risk: 'risky',
        outcomes: [
          {
            id: 'bad_energy',
            baseWeight: 65,
            tone: 'bad',
            text: 'חדר ההלבשה הרגיש את המתח, והמאמן פחות אוהב אותך מבעבר.',
            effects: { coachTrust: -9, discipline: -5, form: -4 },
          },
          {
            id: 'fire_lit',
            baseWeight: 35,
            tone: 'good',
            text: 'הכעס דווקא הוציא ממך משהו. שיחקת כאילו יש לך משהו להוכיח, כי היה.',
            effects: { form: 8, ability: 1.4, roleValue: 4, coachTrust: -2 },
            modifiers: [{ attribute: 'confidence', above: 60, multiplier: 1.4 }],
          },
        ],
      },
    ],
  },
  {
    id: 'youth_derby_youth',
    kicker: 'דרבי נוער, יציע מלא',
    title: 'המשחק שכולם מדברים עליו',
    description:
      'דרבי מול הפועל חיפה. הצופים של הבוגרים מגיעים לראות, וההורים מצלמים הכול.',
    category: 'match_moment',
    /*
     * A youth derby against the other Haifa club - only means anything in green.
     *
     * v0.4.6: the comment said "the other Haifa club" and the description said מכבי תל אביב,
     * which is a major rivalry and not a derby. Corrected to the club the rivalry data actually
     * models as Maccabi Haifa's local derby, and gated on it.
     */
    conditions: {
      bands: ['teens', 'u19'],
      minRoleValue: 42,
      clubScope: 'maccabi',
      requiresDerby: true,
    },
    weight: 8,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'take_over',
        label: 'לקחת את המשחק',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'star',
            baseWeight: 30,
            tone: 'good',
            text: 'שלטת. שער, בישול, וכל מי שישב שם רשם לעצמו את השם שלך.',
            effects: {
              ability: 1.5,
              coachTrust: 9,
              reputation: 8,
              confidence: 9,
              promotionBoost: 8,
              flags: ['first_team_radar'],
            },
            modifiers: [
              { attribute: 'form', above: 65, multiplier: 1.4 },
              { attribute: 'abilityVsLevel', above: 6, multiplier: 1.5 },
              { attribute: 'confidence', below: 45, multiplier: 0.55 },
            ],
          },
          {
            id: 'decent',
            baseWeight: 45,
            tone: 'neutral',
            text: 'משחק סביר. לא הצטיינת, לא נעלמת.',
            effects: { confidence: 2, coachTrust: 1, reputation: 2 },
          },
          {
            id: 'froze',
            baseWeight: 25,
            tone: 'bad',
            text: 'הרגליים היו כבדות מהרגע הראשון. הוחלפת בהפסקה.',
            effects: { confidence: -9, coachTrust: -5, form: -6, pressure: 7 },
            modifiers: [
              { attribute: 'confidence', below: 45, multiplier: 1.6 },
              { attribute: 'confidence', above: 70, multiplier: 0.5 },
            ],
          },
        ],
      },
      {
        id: 'simple',
        label: 'לשחק פשוט ולא להסתבך',
        risk: 'safe',
        outcomes: [
          {
            id: 'solid',
            baseWeight: 70,
            tone: 'good',
            text: 'משחק נקי וחכם. המאמן אמר אחר כך שזה בדיוק מה שהוא רצה לראות.',
            effects: { coachTrust: 5, confidence: 3, reputation: 2 },
          },
          {
            id: 'invisible',
            baseWeight: 30,
            tone: 'neutral',
            text: 'לא עשית טעויות. גם לא עשית כלום שנזכור.',
            effects: { coachTrust: -1, confidence: -1 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* נוער                                                              */
  /* ================================================================= */
  {
    id: 'u19_first_senior_training',
    kicker: 'הודעה בקבוצת הוואטסאפ',
    title: 'זימון לאימון הבוגרים',
    description:
      'מאמן הבוגרים ביקש אותך ליום חמישי. אתה עומד בחדר הלבשה שראית רק בטלוויזיה ומחפש איפה לשים את התיק.',
    category: 'promotion',
    conditions: { stages: ['u19', 'youth_a'], minAbility: 52 },
    weight: 13,
    oncePerCareer: true,
    choices: [
      {
        id: 'aggressive',
        label: 'להיכנס חזק. שידעו שהגעת.',
        hint: 'רושם גדול או חדר הלבשה עוין',
        risk: 'risky',
        outcomes: [
          {
            id: 'impressed',
            baseWeight: 40,
            tone: 'good',
            preview: 'תחטוף כדור מהקפטן ולא תתנצל',
            text: 'חטפת כדור מהקפטן ולא התנצלת. אחרי האימון הוא טפח לך על הכתף.',
            effects: {
              coachTrust: 10,
              ability: 1.8,
              confidence: 7,
              promotionBoost: 10,
              flags: ['first_team_radar'],
            },
            modifiers: [
              { attribute: 'ability', above: 62, multiplier: 1.4 },
              { attribute: 'confidence', above: 62, multiplier: 1.3 },
            ],
          },
          {
            id: 'lesson',
            baseWeight: 45,
            tone: 'bad',
            preview: 'חריצה מאוחרת על שחקן מפתח, ושיעור בחדר ההלבשה',
            text: 'נכנסת מאוחר בחריצה על שחקן מפתח. בחדר ההלבשה הסבירו לך מה זה כבוד.',
            effects: { coachTrust: -6, discipline: -4, confidence: -5 },
          },
          {
            id: 'sensation',
            baseWeight: 15,
            conditions: { minPotential: 85 },
            tone: 'good',
            preview: 'לא רק תעמוד בקצב - תהיה מהטובים באימון',
            text: 'לא רק שעמדת בקצב - היית מהטובים באימון. המאמן שאל את מנהל המחלקה בן כמה אתה.',
            effects: {
              coachTrust: 15,
              ability: 2.5,
              reputation: 10,
              confidence: 10,
              promotionBoost: 20,
              flags: ['first_team_radar'],
            },
            modifiers: [{ attribute: 'potential', above: 90, multiplier: 1.7 }],
          },
        ],
      },
      {
        id: 'humble',
        label: 'לשתוק, ללמוד, לרוץ',
        risk: 'safe',
        outcomes: [
          {
            id: 'invited_back',
            baseWeight: 72,
            tone: 'good',
            preview: 'תרוץ הכי הרבה ולא תפתח את הפה, ויבקשו אותך שוב',
            text: 'הבאת את הכדורים, רצת הכי הרבה, ולא פתחת את הפה. ביקשו אותך גם לשבוע הבא.',
            effects: { coachTrust: 7, ability: 2, discipline: 5, promotionBoost: 6 },
          },
          {
            id: 'forgotten',
            baseWeight: 28,
            tone: 'neutral',
            preview: 'תעבור שם בלי שאף אחד ישים לב',
            text: 'עברת שם בלי שאף אחד ממש שם לב. חזרת לנוער עם עוד אימון בקורות החיים.',
            effects: { ability: 1, confidence: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'u19_media',
    kicker: 'כותרת באתר ספורט',
    title: '"הכישרון הגדול ביותר במחלקה"',
    description: 'עיתונאי כתב עליך פסקה שלמה. פתאום כולם יודעים מי אתה, וכולם מצפים.',
    category: 'random',
    conditions: { bands: ['u19', 'teens'], minAbility: 58, minReputation: 15 },
    weight: 7,
    oncePerCareer: true,
    choices: [
      {
        id: 'embrace',
        label: 'לתת ראיון',
        risk: 'risky',
        outcomes: [
          {
            id: 'mature',
            baseWeight: 45,
            tone: 'good',
            text: 'ראיון בוגר וממוקד. אתה נשמע כמו מישהו שאפשר לבנות עליו.',
            effects: { reputation: 9, maccabism: 4, coachTrust: 2, pressure: 5 },
            modifiers: [{ attribute: 'confidence', above: 62, multiplier: 1.35 }],
          },
          {
            id: 'headline',
            baseWeight: 55,
            tone: 'bad',
            text: 'משפט אחד הוצא מהקשרו והפך לכותרת. במועדון לא היו מרוצים.',
            effects: { reputation: 5, pressure: 12, coachTrust: -6, confidence: -4 },
          },
        ],
      },
      {
        id: 'ignore',
        label: 'לא לקרוא. להמשיך לעבוד.',
        risk: 'safe',
        outcomes: [
          {
            id: 'grounded',
            baseWeight: 100,
            tone: 'good',
            text: 'סגרת את הטלפון לשבועיים. הראש נשאר במקום שלו.',
            effects: { pressure: -8, ability: 1.2, form: 4, coachTrust: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'u19_loan_talk',
    kicker: 'שיחה בחדר הווידאו',
    title: 'מדברים איתך על השאלה',
    description:
      'מנהל הספורט מדבר בכנות: "יש קבוצה בליגה הלאומית שרוצה אותך. שם תשחק כל שבוע."',
    category: 'transfer',
    conditions: { stages: ['u19'], minAge: 17, maxRoleValue: 62 },
    weight: 8,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'open',
        label: 'להגיד שאתה פתוח לזה',
        risk: 'balanced',
        effects: { flags: ['wants_loan'] },
        outcomes: [
          {
            id: 'noted',
            baseWeight: 100,
            tone: 'neutral',
            text: 'רשמו את זה. אם ההזדמנות תגיע בקיץ, אתה ראשון ברשימה.',
            effects: { transferChance: 0.3, confidence: 2, coachTrust: 2 },
          },
        ],
      },
      {
        id: 'fight',
        label: 'להישאר ולהילחם כאן',
        risk: 'risky',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'door_opened',
            baseWeight: 40,
            tone: 'good',
            text: 'הישארת, ובינואר נפתחה לך דלת. תפסת אותה בשתי ידיים.',
            effects: { maccabism: 6, roleValue: 8, coachTrust: 6, minutesModifier: 1.25 },
            modifiers: [{ attribute: 'coachTrust', above: 62, multiplier: 1.5 }],
          },
          {
            id: 'benched',
            baseWeight: 60,
            tone: 'bad',
            text: 'עוד חצי עונה של חימומים ארוכים וכניסות בדקה 85.',
            effects: { maccabism: 5, minutesModifier: 0.7, confidence: -6, roleValue: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'u19_contract_talk',
    kicker: 'משרד ההנהלה',
    title: 'מדברים על חוזה מקצועני',
    description:
      'לא סכום גדול, אבל לראשונה כתוב שם "שחקן מקצועני". הסוכן אומר שאפשר לסחוט עוד.',
    category: 'contract',
    conditions: { stages: ['u19'], minAge: 17, minAbility: 55 },
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'sign_now',
        label: 'לחתום מיד',
        hint: 'המועדון יזכור שלא עשית בעיות',
        risk: 'safe',
        effects: { flags: ['loyalty_moment'] },
        outcomes: [
          {
            id: 'signed',
            baseWeight: 100,
            tone: 'good',
            text: 'חתמת באותו יום. במועדון אוהבים שחקנים שלא הופכים כל דבר למשא ומתן.',
            effects: { maccabism: 8, coachTrust: 6, confidence: 5, promotionBoost: 5 },
          },
        ],
      },
      {
        id: 'negotiate',
        label: 'לתת לסוכן לנהל משא ומתן',
        hint: 'תנאים טובים יותר, יחסים קרירים יותר',
        risk: 'risky',
        outcomes: [
          {
            id: 'better_deal',
            baseWeight: 45,
            tone: 'good',
            text: 'הסוכן משיג חוזה ארוך ותנאים מצוינים. ההנהלה חייכה בשיניים חשוקות.',
            effects: { reputation: 5, maccabism: -4, coachTrust: -2 },
            modifiers: [{ attribute: 'reputation', above: 35, multiplier: 1.4 }],
          },
          {
            id: 'dragged',
            baseWeight: 55,
            tone: 'bad',
            text: 'המשא ומתן נמשך חודשיים. המאמן, שלא אוהב הסחות דעת, הוריד אותך לספסל.',
            effects: { maccabism: -6, coachTrust: -9, roleValue: -5, reputation: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'u19_national_youth',
    kicker: 'רשימת הסגל פורסמה',
    title: 'נבחרת הנוער',
    description: 'השם שלך ברשימה. אמא שלך שלחה לך צילום מסך לפני הסוכן.',
    category: 'opportunity',
    conditions: { bands: ['u19', 'teens'], minAbility: 60, minAge: 15 },
    weight: 7,
    oncePerCareer: true,
    choices: [
      {
        id: 'go',
        label: 'לנסוע ולתת הכול',
        risk: 'balanced',
        outcomes: [
          {
            id: 'shone',
            baseWeight: 55,
            tone: 'good',
            text: 'שיחקת 90 דקות והיית מהטובים במגרש. הטלפון של הסוכן לא מפסיק לצלצל.',
            effects: { reputation: 12, confidence: 7, promotionBoost: 6 },
            modifiers: [{ attribute: 'form', above: 62, multiplier: 1.35 }],
          },
          {
            id: 'bench',
            baseWeight: 30,
            tone: 'neutral',
            text: 'ישבת רוב הזמן. עדיין - היית שם.',
            effects: { reputation: 4, confidence: -2 },
          },
          {
            id: 'knock',
            baseWeight: 15,
            tone: 'bad',
            text: 'חטפת מכה בדקה 60 וחזרת למועדון צולע. המאמן לא אהב את זה בכלל.',
            effects: { reputation: 5, injuryRisk: 9, form: -7, coachTrust: -4 },
          },
        ],
      },
      {
        id: 'rest',
        label: 'לבקש מנוחה בגלל עומס',
        risk: 'safe',
        outcomes: [
          {
            id: 'fresh',
            baseWeight: 100,
            tone: 'neutral',
            text: 'המועדון מרוצה, הנבחרת פחות. חזרת לחצי העונה השנייה רענן.',
            effects: { reputation: -4, form: 7, injuryRisk: -4, coachTrust: 4 },
          },
        ],
      },
    ],
  },
];

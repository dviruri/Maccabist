import type { GameEvent } from '../../types';

/**
 * Events the player never asked for.
 *
 * These are the "wow, I didn't expect that" moments: luck that opens a door, luck that slams
 * one, and the handful of genuinely rare highs and lows that should not show up every career.
 * Rare events are throttled further by EVENTS.rarityWeight in balance.ts.
 */

export const SPONTANEOUS_EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* Luck - unexpected openings                                         */
  /* ================================================================= */
  {
    id: 'spon_striker_injured',
    kicker: 'שעה לפני המשחק',
    title: 'ההרכב השתנה ברגע האחרון',
    /*
     * Deliberately does not name a position. This used to say "the starting striker was
     * injured", which a goalkeeper could receive - the exact bug playtesting found. Written
     * generically it works for all six roles without six copies of the same event.
     */
    description:
      'מי שפותח בעמדה שלך נפצע בחימום. המאמן סורק את חדר ההלבשה, עוצר עליך ואומר: "אתה מתחיל."',
    category: 'match_moment',
    conditions: { bands: ['teens', 'u19', 'senior'], maxRoleValue: 70 },
    weight: 9,
    slots: ['mid', 'late'],
    cooldownSeasons: 4,
    choices: [
      {
        id: 'seize',
        label: 'לרוץ על כל כדור',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'took_it',
            baseWeight: 42,
            tone: 'good',
            preview: 'תנצל כל שנייה, וקשה יהיה להוציא אותך מההרכב',
            text: 'ניצלת כל שנייה. מהמשחק הזה והלאה קשה היה להוציא אותך מההרכב.',
            effects: { roleValue: 9, coachTrust: 9, confidence: 8, minutesModifier: 1.2 },
            modifiers: [
              { attribute: 'form', above: 60, multiplier: 1.35 },
              { attribute: 'abilityVsLevel', above: 3, multiplier: 1.3 },
              { attribute: 'confidence', below: 42, multiplier: 0.6 },
            ],
          },
          {
            id: 'ok',
            baseWeight: 38,
            tone: 'neutral',
            preview: 'לא תבזבז את ההזדמנות, אבל גם לא תחטוף אותה',
            text: 'לא בזבזת את ההזדמנות, אבל גם לא חטפת אותה. המאמן אמר "בסדר גמור" והמשיך הלאה.',
            effects: { coachTrust: 3, confidence: 2 },
          },
          {
            id: 'blew_it',
            baseWeight: 20,
            tone: 'bad',
            preview: 'הרבה ריצה, מעט תוצאות - וההזדמנות עוברת',
            text: 'רצת הרבה ועשית מעט. ההזדמנות עברה ואתה יודע את זה.',
            effects: { confidence: -7, coachTrust: -4, form: -4 },
            modifiers: [{ attribute: 'form', below: 45, multiplier: 1.5 }],
          },
        ],
      },
      {
        id: 'safe',
        label: 'לשחק בטוח ולא להיכשל',
        risk: 'safe',
        outcomes: [
          {
            id: 'no_mistakes',
            baseWeight: 65,
            tone: 'neutral',
            preview: 'משחק בלי טעויות ובלי רגעים',
            text: 'משחק בלי טעויות ובלי רגעים. המאמן ידע שאפשר לסמוך עליך - וזה הכול.',
            effects: { coachTrust: 4, confidence: 1 },
          },
          {
            id: 'too_passive',
            baseWeight: 35,
            tone: 'bad',
            preview: 'המאמן ציפה לראות רעב ולא ראה',
            text: 'שיחקת מפוחד. אחרי המשחק המאמן אמר שציפה לראות רעב.',
            effects: { coachTrust: -5, confidence: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'spon_first_team_coach_watching',
    kicker: 'ביציע הקטן, יום שבת',
    title: 'מאמן הבוגרים הגיע לראות',
    description:
      'באמצע החימום מישהו לוחש לך שמאמן הקבוצה הבוגרת יושב ביציע. הוא לא בא בשבילך - אבל הוא כאן.',
    category: 'opportunity',
    /*
     * The first-team coach coming to watch is professional contact, so it needs נוער - or a
     * genuinely extraordinary נערים א׳ player, which is exactly what allowsExceptionalYouth is
     * for. It used to reach נערים ג׳ children.
     */
    conditions: {
      bands: ['teens', 'u19'],
      minAbility: 50,
      requiresProfessionalFootball: true,
      allowsExceptionalYouth: true,
    },
    weight: 8,
    slots: ['mid', 'late'],
    cooldownSeasons: 3,
    choices: [
      {
        id: 'show',
        label: 'לשחק בשביל להרשים',
        risk: 'risky',
        outcomes: [
          {
            id: 'noticed',
            baseWeight: 33,
            tone: 'good',
            text: 'שני כדורים שהוצאת מהכובע נכנסו לו למחברת. הוא שאל עליך בסוף המשחק.',
            effects: {
              reputation: 8,
              coachTrust: 7,
              promotionBoost: 12,
              confidence: 6,
              flags: ['first_team_radar'],
            },
            modifiers: [
              { attribute: 'abilityVsLevel', above: 6, multiplier: 1.5 },
              { attribute: 'potential', above: 84, multiplier: 1.3 },
            ],
          },
          {
            id: 'overplayed',
            baseWeight: 67,
            tone: 'bad',
            text: 'ניסית יותר מדי, איבדת כדורים, והמאמן שלך החליף אותך בהפסקה.',
            effects: { coachTrust: -6, confidence: -6, roleValue: -3 },
            modifiers: [{ attribute: 'confidence', above: 70, multiplier: 0.6 }],
          },
        ],
      },
      {
        id: 'normal',
        label: 'לשחק את המשחק שלי',
        risk: 'balanced',
        outcomes: [
          {
            id: 'solid',
            baseWeight: 60,
            tone: 'good',
            text: 'משחק פשוט, נקי וחכם. הוא לא כתב עליך הרבה, אבל המאמן שלך כן.',
            effects: { coachTrust: 5, ability: 1, reputation: 3 },
          },
          {
            id: 'quiet_impression',
            baseWeight: 40,
            tone: 'good',
            text: 'לא היה שום דבר ראוותני. בדיוק בגלל זה הוא ביקש לראות אותך שוב.',
            effects: { promotionBoost: 7, coachTrust: 4, reputation: 4 },
            modifiers: [{ attribute: 'discipline', above: 65, multiplier: 1.4 }],
          },
        ],
      },
    ],
  },
  {
    id: 'spon_suspension_opening',
    kicker: 'כרטיס אדום בשבוע שעבר',
    title: 'מישהו מושעה, ואתה הבא בתור',
    description:
      'השחקן שלפניך בתור חטף אדום ויושב שלושה משחקים. שלושה משחקים זה בדיוק מספיק כדי לשנות עונה.',
    category: 'opportunity',
    conditions: { bands: ['teens', 'u19', 'senior'], maxRoleValue: 62, minRoleValue: 20 },
    weight: 8,
    slots: ['mid', 'late'],
    cooldownSeasons: 3,
    choices: [
      {
        id: 'grab',
        label: 'לא להחזיר את החולצה',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'kept',
            baseWeight: 40,
            tone: 'good',
            preview: 'שלוש הופעות טובות, וכשהוא חוזר הוא יושב',
            text: 'שלושה משחקים, שלוש הופעות טובות. כשהוא חזר - הוא ישב.',
            effects: { roleValue: 11, coachTrust: 8, confidence: 7, minutesModifier: 1.2 },
            modifiers: [
              { attribute: 'abilityVsLevel', above: 4, multiplier: 1.4 },
              { attribute: 'coachTrust', above: 60, multiplier: 1.25 },
            ],
          },
          {
            id: 'gave_back',
            baseWeight: 60,
            tone: 'neutral',
            preview: 'תשחק בסדר, וכשהוא חוזר הוא חוזר',
            text: 'שיחקת בסדר, אבל כשהוא חזר הוא חזר. ככה זה עובד.',
            effects: { confidence: 1, coachTrust: 1 },
          },
        ],
      },
      {
        id: 'careful',
        label: 'לא להילחץ, פשוט לשחק',
        risk: 'safe',
        outcomes: [
          {
            id: 'steady',
            baseWeight: 70,
            tone: 'good',
            text: 'שלושה משחקים שקטים ובוגרים. המאמן יודע עכשיו שיש לו על מי לסמוך.',
            effects: { coachTrust: 6, roleValue: 3 },
          },
          {
            id: 'forgettable',
            baseWeight: 30,
            tone: 'neutral',
            preview: 'תעבור שם, וזה הכול',
            text: 'עברת שם. זה הכול.',
            effects: { coachTrust: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'spon_foreign_scout',
    kicker: 'איש עם מחברת ביציע',
    title: 'צופה מחו״ל במגרש',
    description:
      'מישהו סיפר שיש צופה של מועדון אירופי במשחק. אולי זה נכון, אולי זו סתם שמועה של הורים.',
    category: 'random',
    conditions: { bands: ['teens', 'u19'], minAbility: 58 },
    weight: 6,
    rarity: 'uncommon',
    slots: ['mid', 'late'],
    cooldownSeasons: 4,
    choices: [
      {
        id: 'focus',
        label: 'להתעלם ולשחק',
        risk: 'safe',
        outcomes: [
          {
            id: 'good_game',
            baseWeight: 60,
            tone: 'good',
            text: 'שיחקת כרגיל, וכרגיל זה היה טוב. השם שלך נרשם אצל מישהו בחו״ל.',
            effects: { reputation: 7, confidence: 3 },
            modifiers: [{ attribute: 'ability', above: 65, multiplier: 1.4 }],
          },
          {
            id: 'rumour',
            baseWeight: 40,
            tone: 'neutral',
            text: 'התברר שזו הייתה שמועה. משחק רגיל, שבת רגילה.',
            effects: { form: 2 },
          },
        ],
      },
      {
        id: 'aware',
        label: 'לשחק בידיעה שמסתכלים',
        risk: 'risky',
        outcomes: [
          {
            id: 'big_impression',
            baseWeight: 30,
            tone: 'good',
            text: 'עשית משחק חיים בדיוק ביום הנכון. הפרטים שלך עברו הלאה.',
            effects: { reputation: 14, confidence: 7, transferChance: 0.15 },
            modifiers: [
              { attribute: 'confidence', above: 62, multiplier: 1.4 },
              { attribute: 'form', above: 62, multiplier: 1.35 },
            ],
          },
          {
            id: 'tight',
            baseWeight: 70,
            tone: 'bad',
            text: 'שיחקת מכווץ. הכדור נדבק לרגל בדיוק כשלא היית צריך.',
            effects: { confidence: -6, form: -4, reputation: 1 },
          },
        ],
      },
    ],
  },
  {
    id: 'spon_last_minute',
    kicker: 'דקה 88',
    title: 'הכדור מגיע אליך',
    description:
      'שוויון, המשחק נגמר עוד רגע, והכדור נופל אליך בדיוק בקצה הרחב. היציע כבר על הרגליים.',
    category: 'match_moment',
    conditions: { bands: ['teens', 'u19', 'senior'], minRoleValue: 38 },
    weight: 8,
    slots: ['late'],
    cooldownSeasons: 2,
    choices: [
      {
        id: 'shoot',
        label: 'לבעוט',
        risk: 'risky',
        outcomes: [
          {
            id: 'scored',
            baseWeight: 38,
            tone: 'good',
            text: 'הכדור נכנס בחיבורים. רצת לפינה בלי לדעת מה אתה עושה, וכל הקבוצה קפצה עליך.',
            effects: {
              confidence: 10,
              coachTrust: 6,
              roleValue: 6,
              reputation: 5,
              maccabism: 4,
              form: 7,
            },
            modifiers: [
              { attribute: 'form', above: 62, multiplier: 1.4 },
              { attribute: 'confidence', above: 65, multiplier: 1.3 },
              { attribute: 'confidence', below: 40, multiplier: 0.6 },
            ],
          },
          {
            id: 'missed',
            baseWeight: 62,
            tone: 'bad',
            text: 'מעל המשקוף. שריקת הסיום, והדרך לחדר ההלבשה ארוכה מאוד.',
            effects: { confidence: -7, pressure: 6, form: -3 },
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
            baseWeight: 52,
            tone: 'good',
            text: 'מסירה מושלמת, והוא לא מחטיא. בחדר ההלבשה כולם יודעים של מי הכדור הזה.',
            effects: { coachTrust: 6, roleValue: 4, confidence: 5, maccabism: 3 },
          },
          {
            id: 'wasted',
            baseWeight: 48,
            tone: 'neutral',
            text: 'הוא בעט לידיים של השוער. אף אחד לא כועס עליך, אבל אף אחד לא מדבר עליך.',
            effects: { confidence: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'spon_formation_change',
    kicker: 'לוח טקטי, בוקר שני',
    title: 'המאמן משנה מערך',
    description:
      'המאמן מצייר משהו חדש על הלוח. בשיטה הזאת העמדה שלך פתאום הופכת למרכזית.',
    category: 'development',
    conditions: { bands: ['teens', 'u19', 'senior'] },
    weight: 6,
    slots: ['early', 'mid'],
    cooldownSeasons: 4,
    choices: [
      {
        id: 'learn',
        label: 'ללמוד את התפקיד לעומק',
        risk: 'balanced',
        outcomes: [
          {
            id: 'mastered',
            baseWeight: 55,
            tone: 'good',
            preview: 'תדע מה יקרה לפני כולם',
            text: 'ישבת עם מאמן הווידאו שעות. במגרש זה נראה כאילו אתה יודע מה יקרה לפני כולם.',
            effects: { ability: 1.8, coachTrust: 8, roleValue: 6 },
            modifiers: [{ attribute: 'discipline', above: 62, multiplier: 1.35 }],
          },
          {
            id: 'confused',
            baseWeight: 45,
            tone: 'bad',
            preview: 'עד שתבין מה רוצים ממך, מישהו אחר יעשה את זה טוב יותר',
            text: 'לקח לך זמן להבין מה רוצים ממך, ובינתיים מישהו אחר עשה את זה טוב יותר.',
            effects: { coachTrust: -4, roleValue: -3, confidence: -3 },
          },
        ],
      },
      {
        id: 'instinct',
        label: 'לשחק לפי האינסטינקט',
        risk: 'risky',
        outcomes: [
          {
            id: 'worked',
            baseWeight: 40,
            tone: 'good',
            preview: 'לא תבין את הלוח, אבל תבין את המשחק',
            text: 'לא הבנת את הלוח, אבל הבנת את המשחק. המאמן ויתר על ההסברים.',
            effects: { ability: 1, confidence: 6, form: 5 },
            modifiers: [{ attribute: 'abilityVsLevel', above: 8, multiplier: 1.5 }],
          },
          {
            id: 'clash',
            baseWeight: 60,
            tone: 'bad',
            preview: 'המאמן צועק עליך מהקווים, ולא נגמר טוב',
            text: 'המאמן צעק עליך שלוש פעמים מהקווים באותו משחק. זה לא נגמר טוב.',
            effects: { coachTrust: -8, confidence: -4 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* Rare breakthroughs                                                 */
  /* ================================================================= */
  {
    id: 'rare_tournament',
    kicker: 'טורניר בינלאומי, חופשת הקיץ',
    title: 'הטורניר של החיים',
    description:
      'המחלקה נסעה לטורניר באירופה מול מועדונים ענקיים. חמישה משחקים בארבעה ימים, וכולם מסתכלים.',
    category: 'rare',
    rarity: 'rare',
    conditions: { bands: ['teens', 'u19'], minAbility: 55, minRoleValue: 45 },
    weight: 10,
    oncePerCareer: true,
    choices: [
      {
        id: 'all_in',
        label: 'לתת את כל מה שיש',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'player_of_tournament',
            baseWeight: 26,
            tone: 'good',
            text: 'שחקן הטורניר. מול מועדונים שאתה מכיר מהטלוויזיה. הסרטון שלך עשה סיבוב שלם ברשת.',
            effects: {
              ability: 3.5,
              coachTrust: 14,
              reputation: 18,
              confidence: 12,
              promotionBoost: 20,
              flags: ['tournament_star', 'first_team_radar'],
              achievement: 'tournament_star',
            },
            modifiers: [
              { attribute: 'potential', above: 85, multiplier: 1.7 },
              { attribute: 'form', above: 62, multiplier: 1.3 },
              { attribute: 'abilityVsLevel', above: 6, multiplier: 1.4 },
            ],
          },
          {
            id: 'good_tournament',
            baseWeight: 48,
            tone: 'good',
            text: 'שיחקת טוב מול רמה שלא הכרת. חזרת שחקן אחר, גם אם אף אחד בחוץ לא שם לב.',
            effects: { ability: 2.2, coachTrust: 6, reputation: 6, confidence: 6 },
          },
          {
            id: 'exposed',
            baseWeight: 26,
            tone: 'bad',
            text: 'הקצב שם היה מעולם אחר. חזרת עם הרבה שאלות על עצמך.',
            effects: { confidence: -10, coachTrust: -3, ability: 0.8 },
            modifiers: [
              { attribute: 'abilityVsLevel', below: 2, multiplier: 1.6 },
              { attribute: 'potential', above: 86, multiplier: 0.5 },
            ],
          },
        ],
      },
      {
        id: 'manage',
        label: 'לנהל את העומס בחוכמה',
        risk: 'safe',
        outcomes: [
          {
            id: 'steady',
            baseWeight: 70,
            tone: 'good',
            text: 'שיחקת בשלושה מהחמישה וחזרת שלם. הצוות הרפואי אהב אותך.',
            effects: { ability: 1.4, injuryRisk: -5, coachTrust: 3, confidence: 3 },
          },
          {
            id: 'missed_moment',
            baseWeight: 30,
            tone: 'neutral',
            text: 'במשחק שישבת בו הקבוצה עשתה היסטוריה. אתה צפית מהספסל.',
            effects: { confidence: -4, coachTrust: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'rare_leap',
    kicker: 'משהו השתנה',
    title: 'הקפיצה',
    description:
      'אתה לא יודע להסביר את זה. הכדור נשמע לך, הגוף מקשיב, והמשחק פתאום איטי יותר.',
    category: 'rare',
    rarity: 'rare',
    conditions: { bands: ['teens', 'u19'], minPotential: 78, minAge: 14 },
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'ride',
        label: 'לרכוב על הגל',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'leap',
            baseWeight: 62,
            tone: 'good',
            text: 'שלושה חודשים שבהם היית הכי טוב במגרש בכל שבת. במחלקה מדברים רק עליך.',
            effects: {
              ability: 5,
              confidence: 10,
              coachTrust: 10,
              form: 10,
              roleValue: 8,
              promotionBoost: 14,
              flags: ['academy_star'],
            },
            modifiers: [
              { attribute: 'potential', above: 86, multiplier: 1.5 },
              { attribute: 'coachTrust', above: 65, multiplier: 1.25 },
            ],
          },
          {
            id: 'faded',
            baseWeight: 38,
            tone: 'neutral',
            text: 'החודש הזה היה מדהים, ואז זה נעלם כמו שהגיע. אבל עכשיו אתה יודע מה יש בך.',
            effects: { ability: 2, confidence: 5, potential: 2 },
          },
        ],
      },
      {
        id: 'ground',
        label: 'לשמור על הרגליים על הקרקע',
        risk: 'safe',
        outcomes: [
          {
            id: 'sustainable',
            baseWeight: 100,
            tone: 'good',
            text: 'לא נתת לזה לעלות לך לראש. הקפיצה הייתה קטנה יותר - אבל היא נשארה.',
            effects: { ability: 3, discipline: 5, confidence: 5, coachTrust: 5 },
          },
        ],
      },
    ],
  },
  {
    id: 'rare_derby_legend',
    kicker: 'דרבי, דקה 90+3',
    title: 'הרגע שלא שוכחים',
    description:
      'דרבי שהמחלקה כולה הגיעה לראות. שוויון, הרגע האחרון, והכדור מגיע אליך בתוך הרחבה.',
    category: 'rare',
    rarity: 'rare',
    /*
     * v0.4.6: this carried no club condition at all, so a boy at any academy in the game could
     * receive "a derby the whole department came to watch". `requiresDerby` ties it to a club
     * that actually has a modelled local rival.
     */
    conditions: {
      bands: ['teens', 'u19'],
      minRoleValue: 50,
      minAbility: 55,
      requiresDerby: true,
    },
    weight: 9,
    oncePerCareer: true,
    slots: ['late'],
    choices: [
      {
        id: 'take_it',
        label: 'לקחת אחריות',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'legend',
            baseWeight: 45,
            tone: 'good',
            text: 'הכנסת אותו. המחלקה ירדה למגרש. את המשחק הזה יזכירו לך עוד שנים.',
            effects: {
              confidence: 14,
              coachTrust: 10,
              maccabism: 10,
              reputation: 9,
              roleValue: 8,
              promotionBoost: 10,
              achievement: 'derby_moment',
              flags: ['fan_favourite'],
            },
            modifiers: [
              { attribute: 'confidence', above: 60, multiplier: 1.4 },
              { attribute: 'form', above: 60, multiplier: 1.3 },
            ],
          },
          {
            id: 'silence',
            baseWeight: 55,
            tone: 'bad',
            text: 'החטאת. השקט של אנשים שהכירו אותך מהילדות היה הדבר הכי רועש ששמעת.',
            effects: { confidence: -12, pressure: 10, form: -6 },
          },
        ],
      },
      {
        id: 'square',
        label: 'להעביר הצידה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'team_goal',
            baseWeight: 55,
            tone: 'good',
            text: 'העברת, והוא סיים. לא השם שלך בכותרת - אבל הניצחון שלך גם.',
            effects: { coachTrust: 7, maccabism: 5, roleValue: 4, confidence: 4 },
          },
          {
            id: 'nothing',
            baseWeight: 45,
            tone: 'neutral',
            text: 'ההעברה הייתה שנייה מאוחר מדי. שריקה. שוויון.',
            effects: { confidence: -3 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* Rare setbacks                                                      */
  /* ================================================================= */
  {
    id: 'rare_serious_injury',
    kicker: 'אימון רגיל, יום שני',
    title: 'הברך מסתובבת',
    description:
      'נחיתה לא נכונה. הרופא מדבר לאט מדי בשביל שזה יהיה משהו קטן. המילה "ניתוח" נאמרה בחדר.',
    category: 'injury',
    // Genuinely rare: a career-shaping injury should not happen to most careers.
    rarity: 'rare',
    conditions: { bands: ['teens', 'u19', 'senior'], minAge: 14 },
    weight: 5,
    cooldownSeasons: 12,
    choices: [
      {
        id: 'rush',
        label: 'לחזור מהר. אין זמן.',
        risk: 'risky',
        outcomes: [
          {
            id: 'made_it',
            baseWeight: 38,
            tone: 'good',
            preview: 'תחזור שלושה שבועות לפני הזמן, והמאמן יעריך את זה',
            text: 'חזרת שלושה שבועות לפני הזמן והמאמן העריך את זה מאוד.',
            effects: {
              coachTrust: 6,
              injuryRisk: 10,
              confidence: 4,
              minutesModifier: 0.85,
              remember: 'major_injury',
            },
            modifiers: [{ attribute: 'injuryRisk', below: 20, multiplier: 1.5 }],
          },
          {
            id: 'relapse',
            baseWeight: 62,
            tone: 'bad',
            preview: 'הברך לא מוכנה - עוד ארבעה חודשים בחוץ',
            text: 'הברך לא הייתה מוכנה. עוד ארבעה חודשים בחוץ.',
            effects: {
              ability: -2.5,
              injuryRisk: 16,
              confidence: -10,
              roleValue: -6,
              minutesModifier: 0.4,
              flags: ['injury_prone'],
              remember: 'major_injury',
              milestone: {
                id: 'major_injury',
                icon: '🩼',
                text: 'פציעה קשה עצרה אותך לחודשים ארוכים',
                major: true,
              },
            },
          },
        ],
      },
      {
        id: 'rehab',
        label: 'שיקום מלא, בלי קיצורי דרך',
        risk: 'safe',
        outcomes: [
          {
            id: 'came_back_strong',
            baseWeight: 72,
            tone: 'good',
            preview: 'חצי שנה של שיקום, ותחזור חזק יותר',
            text: 'חצי שנה בחדר הכושר עם הפיזיותרפיסט. חזרת חזק יותר ממה שהיית.',
            effects: {
              injuryRisk: -10,
              ability: 0.8,
              discipline: 7,
              roleValue: -4,
              minutesModifier: 0.55,
              remember: 'major_injury',
            },
          },
          {
            id: 'long_road',
            baseWeight: 28,
            tone: 'bad',
            preview: 'הגוף חוזר, הראש לוקח יותר זמן',
            text: 'הגוף חזר, הראש לקח יותר זמן. עדיין יש רגעים שאתה חושש להיכנס בכדור.',
            effects: {
              confidence: -8,
              injuryRisk: -4,
              minutesModifier: 0.5,
              coachTrust: -3,
              remember: 'major_injury',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'rare_confidence_crisis',
    kicker: 'שלושה חודשים בלי כלום',
    title: 'משהו נשבר',
    description:
      'אתה מגיע לאימונים ומרגיש שאתה לא יודע לשחק כדורגל. זה לא הגוף. זה הראש.',
    category: 'random',
    rarity: 'uncommon',
    conditions: { bands: ['teens', 'u19', 'senior'], maxConfidence: 48, minAge: 13 },
    weight: 8,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'talk',
        label: 'לדבר עם מישהו',
        risk: 'balanced',
        outcomes: [
          {
            id: 'helped',
            baseWeight: 62,
            tone: 'good',
            preview: 'שעה עם הפסיכולוג של המחלקה, ואפשר לנשום',
            text: 'הפסיכולוג של המחלקה ישב איתך שעה. יצאת משם עם הרגשה שאפשר לנשום.',
            effects: { confidence: 12, pressure: -10, form: 5, coachTrust: 2 },
          },
          {
            id: 'not_yet',
            baseWeight: 38,
            tone: 'neutral',
            preview: 'זה יעזור קצת - לא מספיק, אבל קצת',
            text: 'זה עזר קצת. לא מספיק, אבל קצת.',
            effects: { confidence: 5, pressure: -5 },
          },
        ],
      },
      {
        id: 'alone',
        label: 'לסגור את זה לבד',
        risk: 'risky',
        outcomes: [
          {
            id: 'fought_out',
            baseWeight: 35,
            tone: 'good',
            preview: 'שבועיים לבד אחרי כולם, ואז הכדור חוזר להקשיב',
            text: 'שבועיים של אימונים לבד אחרי כולם, ואז פתאום הכדור חזר להקשיב.',
            effects: { confidence: 10, discipline: 6, form: 6 },
            modifiers: [{ attribute: 'discipline', above: 68, multiplier: 1.6 }],
          },
          {
            id: 'spiral',
            baseWeight: 65,
            tone: 'bad',
            preview: 'זה רק יחמיר - עונה שלמה שבה לא היית אתה',
            text: 'זה רק הלך והחמיר. עונה שלמה שבה לא היית אתה.',
            effects: { confidence: -8, form: -9, coachTrust: -7, roleValue: -6 },
          },
        ],
      },
    ],
  },
  {
    id: 'rare_coach_fallout',
    kicker: 'ויכוח בחדר ההלבשה',
    title: 'התנגשות עם המאמן',
    description:
      'הוחלפת בדקה 55 והראית את זה על הפנים. אחרי המשחק הוא קרא לך והדברים עלו מדרגה.',
    category: 'discipline',
    rarity: 'uncommon',
    conditions: { bands: ['teens', 'u19', 'senior'], minAge: 14, maxCoachTrust: 62 },
    weight: 7,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'apologise',
        label: 'להתנצל למחרת',
        risk: 'safe',
        outcomes: [
          {
            id: 'patched',
            baseWeight: 68,
            tone: 'good',
            preview: '"ככה מתנהג שחקן בוגר" - והוא מעריך את זה',
            text: 'הוא העריך את זה יותר ממה שציפית. "ככה מתנהג שחקן בוגר," הוא אמר.',
            effects: { coachTrust: 9, discipline: 5, confidence: 3 },
          },
          {
            id: 'cold',
            baseWeight: 32,
            tone: 'neutral',
            preview: 'הוא מקבל את ההתנצלות והיחסים נשארים קרירים',
            text: 'הוא קיבל את ההתנצלות אבל היחסים נשארו קרירים.',
            effects: { coachTrust: 2, roleValue: -2 },
          },
        ],
      },
      {
        id: 'stand_ground',
        label: 'לעמוד על שלך',
        risk: 'risky',
        outcomes: [
          {
            id: 'respect',
            baseWeight: 30,
            tone: 'good',
            preview: 'הוא אוהב אופי, ובסוף השיחה אומר שהוא סומך עליך',
            text: 'הוא אוהב שחקנים עם אופי. בסוף השיחה הוא אמר שהוא סומך עליך.',
            effects: { coachTrust: 7, confidence: 7, roleValue: 3 },
            modifiers: [
              { attribute: 'abilityVsLevel', above: 8, multiplier: 1.6 },
              { attribute: 'roleValue', above: 65, multiplier: 1.4 },
            ],
          },
          {
            id: 'frozen_out',
            baseWeight: 70,
            tone: 'bad',
            preview: 'שלושה שבועות בקבוצה השנייה, הודעה ברורה מאוד',
            text: 'שלושה שבועות בקבוצה השנייה. הודעה ברורה מאוד.',
            effects: {
              coachTrust: -14,
              roleValue: -9,
              minutesModifier: 0.6,
              flags: ['discipline_problem'],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'spon_form_slump',
    kicker: 'ארבעה משחקים בלי כלום',
    title: 'שפל',
    description: 'לא נכנס לך כלום, והמאמן מתחיל להסתכל לכיוונים אחרים.',
    category: 'competition',
    conditions: { bands: ['teens', 'u19', 'senior'], maxForm: 48, minRoleValue: 35 },
    weight: 8,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'extra_work',
        label: 'להישאר אחרי אימונים ולבעוט מאה כדורים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'broke_out',
            baseWeight: 58,
            tone: 'good',
            preview: 'הכדור נכנס במשחק החמישי, ואחריו עוד שניים',
            text: 'הכדור נכנס במשחק החמישי, ואחריו עוד שניים. יצאת מזה חזק יותר.',
            effects: { form: 10, confidence: 6, coachTrust: 4, ability: 0.8 },
            modifiers: [{ attribute: 'discipline', above: 62, multiplier: 1.35 }],
          },
          {
            id: 'heavier',
            baseWeight: 42,
            tone: 'bad',
            preview: 'ככל שתנסה יותר, זה ייראה כבד יותר',
            text: 'ככל שניסית יותר, זה נראה כבד יותר.',
            effects: { form: -5, confidence: -6, coachTrust: -3 },
          },
        ],
      },
      {
        id: 'clear_head',
        label: 'לנקות ראש ולהוריד הילוך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'reset',
            baseWeight: 66,
            tone: 'good',
            preview: 'שבועיים בלי לחשוב, וחוזרים לשחק בלי לחשוב',
            text: 'שבועיים בלי לחשוב על זה, וחזרת לשחק בלי לחשוב. זה מה שהיה חסר.',
            effects: { form: 8, pressure: -10, confidence: 5 },
          },
          {
            id: 'still_stuck',
            baseWeight: 34,
            tone: 'neutral',
            preview: 'הראש נרגע, המשחק עוד לא',
            text: 'הראש נרגע, המשחק עוד לא. לוקח זמן.',
            effects: { pressure: -6, form: 2 },
          },
        ],
      },
    ],
  },
];

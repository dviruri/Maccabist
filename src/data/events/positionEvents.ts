import type { GameEvent } from '../../types';

/**
 * Position-specific storylines.
 *
 * Pure data, exactly like every other event file - the engine has no idea these exist and
 * contains no per-position branching. `conditions.positions` does the gating, so a keeper
 * never sees a striker's goal drought and a centre back never gets asked to take a penalty.
 *
 * Each position gets a mix of an opportunity, a pressure moment and a setback, so no position
 * only ever receives good news.
 */

export const POSITION_EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* שוער                                                              */
  /* ================================================================= */
  /*
   * A goalkeeper's derby (v0.4.6, Phase 21).
   *
   * `sen_derby_moment` had no position condition, so a keeper could be told the ball had reached
   * him at the far edge and offered "shoot". Excluding him from it was necessary and not
   * sufficient - a derby is a derby for a goalkeeper too. It is simply a different moment, and
   * the memory it leaves is a save rather than a goal.
   */
  {
    id: 'gk_derby_save',
    kicker: 'דרבי, דקה 90',
    title: 'הכדור הזה או שאתה מציל אותו',
    description:
      'שוויון בדרבי, והם מגיעים בהתקפה אחרונה. הכנף שלהם חופשי בצד, והרחבה מתמלאת.',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      positions: ['GK'],
      bands: ['senior'],
      minRoleValue: 40,
      requiresDerby: true,
    },
    weight: 10,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'come_out',
        label: 'לצאת על הכדור',
        risk: 'risky',
        outcomes: [
          {
            id: 'claimed_it',
            baseWeight: 42,
            tone: 'good',
            preview: 'תצא בזמן ותאסוף את ההרמה מעל שלושה ראשים',
            text: 'יצאת ברגע הנכון ואספת את ההרמה מעל שלושה ראשים. שריקת הסיום, והיציע שר את השם שלך.',
            maccabiRelevance: 'identity',
            effects: {
              reputation: 8,
              maccabism: 7,
              roleValue: 8,
              confidence: 10,
              coachTrust: 7,
              remember: 'derby_hero',
              milestone: {
                id: 'derby_save',
                icon: '🧤',
                text: 'ההצלה שהכריעה דרבי',
                major: true,
              },
            },
            traitModifiers: [{ trait: 'big_game', multiplier: 1.6 }],
          },
          {
            id: 'caught_out',
            baseWeight: 30,
            tone: 'bad',
            preview: 'תצא מוקדם מדי, והשער יישאר ריק מאחוריך',
            text: 'יצאת מוקדם מדי. הכדור עבר מעליך, והשער היה ריק. בדרבי לא שוכחים את זה.',
            effects: { confidence: -12, coachTrust: -9, roleValue: -6, reputation: -5 },
          },
          {
            id: 'scrambled',
            baseWeight: 28,
            tone: 'neutral',
            preview: 'זה ייצא מכוער, אבל הכדור לא ייכנס',
            text: 'לא היה בזה שום דבר יפה. הכדור נגע בך, בבלם, ובקורה - ולא נכנס. 0:0.',
            effects: { confidence: 3, coachTrust: 2 },
          },
        ],
      },
      {
        id: 'hold_line',
        label: 'להישאר על הקו ולחכות לבעיטה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'big_save',
            baseWeight: 46,
            tone: 'good',
            preview: 'תקרא את הבעיטה ותציל אותה על הקו',
            text: 'חיכית, קראת את הבעיטה, והרחקת אותה ברגל. הקהל לא הבין כמה קרוב זה היה.',
            effects: {
              reputation: 6,
              roleValue: 6,
              confidence: 8,
              coachTrust: 5,
              remember: 'derby_hero',
            },
          },
          {
            id: 'beaten',
            baseWeight: 34,
            tone: 'bad',
            preview: 'הבעיטה תיכנס לפינה שאי אפשר להגיע אליה',
            text: 'הבעיטה נכנסה לפינה הרחוקה. אין הרבה מה לעשות עם זאת, וזה עדיין כואב בדרבי.',
            effects: { confidence: -6, coachTrust: -3 },
          },
          {
            id: 'cleared',
            baseWeight: 20,
            tone: 'neutral',
            preview: 'הבלם ינקה את זה לפניך',
            text: 'הבלם הגיע לפניך וניקה. לפעמים העבודה הטובה שלך היא לא לעשות כלום.',
            effects: { coachTrust: 1 },
          },
        ],
      },
    ],
  },
  /*
   * A goalkeeper's bad run (v0.4.6).
   *
   * `spon_form_slump` is a scoring drought - "לא נכנס לך כלום", and the choices are about
   * shooting - so v0.4.6 excluded goalkeepers from it. That was right and it left a hole: a
   * keeper's form goes for exactly the same reasons and looks nothing like a striker's.
   */
  {
    id: 'gk_form_slump',
    kicker: 'שלושה משחקים, שישה ספיגות',
    title: 'הכדורים נכנסים',
    description:
      'אף אחת מהן לא הייתה טעות ברורה, וזה חלק מהבעיה. אתה מתחיל לחשוב לפני שאתה זז.',
    category: 'competition',
    conditions: { positions: ['GK'], bands: ['u19', 'senior'], maxForm: 48, minRoleValue: 35 },
    weight: 9,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'video',
        label: 'לשבת שעות על הווידאו',
        risk: 'balanced',
        outcomes: [
          {
            id: 'found_it',
            baseWeight: 45,
            tone: 'good',
            preview: 'תמצא צעד אחד שאתה עושה מאוחר מדי, ותתקן אותו',
            text: 'מצאת את זה: צעד ראשון מאוחר בחצי שנייה. שבועיים של תיקון, ואתה שוב מגיע לכדורים.',
            effects: { form: 12, confidence: 8, coachTrust: 4, ability: 0.4 },
          },
          {
            id: 'overthinking',
            baseWeight: 32,
            tone: 'bad',
            preview: 'תראה יותר מדי, ותתחיל לחשוב במקום לזוז',
            text: 'ראית יותר מדי. עכשיו אתה חושב על העמידה במקום פשוט לעמוד, וזה איטי יותר.',
            effects: { confidence: -10, form: -6 },
          },
          {
            id: 'nothing_wrong',
            baseWeight: 23,
            tone: 'neutral',
            preview: 'תגלה שלא עשית שום דבר רע - וזה לא מנחם',
            text: 'מאמן השוערים אמר שלא עשית כלום רע. זה נכון, וזה לא מנחם במיוחד.',
            effects: { confidence: 2 },
          },
        ],
      },
      {
        id: 'talk_defence',
        label: 'לדבר עם הבלמים',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'line_holds',
            baseWeight: 48,
            tone: 'good',
            preview: 'הקו יעלה עשרה מטרים, ופתאום אתה מגן על פחות',
            text: 'העליתם את הקו עשרה מטרים. פתאום אתה מגן על שטח קטן יותר, והספיגות נפסקות.',
            effects: { form: 10, coachTrust: 7, roleValue: 4, confidence: 6 },
          },
          {
            id: 'blamed',
            baseWeight: 30,
            tone: 'bad',
            preview: 'הם ישמעו שאתה מאשים אותם',
            text: 'הם שמעו את זה כהאשמה. בחדר ההלבשה נהיה שקט שלוקח חודש להיעלם.',
            effects: { coachTrust: -6, confidence: -6, roleValue: -4 },
          },
          {
            id: 'no_change',
            baseWeight: 22,
            tone: 'neutral',
            preview: 'כולם יסכימו, ואף אחד לא ישנה כלום',
            text: 'כולם הסכימו איתך, ואז שיחקו בדיוק אותו הדבר בשבת.',
            effects: {},
          },
        ],
      },
    ],
  },
  {
    id: 'gk_penalty_save',
    kicker: 'דקה 90, 1:1',
    title: 'פנדל בסוף המשחק',
    description:
      'השופט מצביע על הנקודה הלבנה. אתה הולך לקו, מנקה את היד בגרביים, ומסתכל על הבעיטה שתחליט את המשחק.',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      positions: ['GK'], minAge: 12, minRoleValue: 25,
    },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'read_him',
        label: 'לקרוא אותו ולזוז מאוחר',
        hint: 'אם תקרא נכון - זה שלך',
        risk: 'risky',
        outcomes: [
          {
            id: 'saved',
            baseWeight: 34,
            tone: 'good',
            preview: 'תחכה עד הרגע האחרון, והיד נשארת על הכדור',
            text: 'חיכית, חיכית, וזזת ברגע האחרון. היד נשארת על הכדור והיציע מתפוצץ. גם החלוצים שלך רצים לחבק אותך.',
            effects: {
              reputation: 7,
              roleValue: 7,
              coachTrust: 7,
              confidence: 11,
              form: 6,
              flags: ['fan_favourite'],
            },
            modifiers: [
              { attribute: 'ability', above: 62, multiplier: 1.4 },
              { attribute: 'confidence', above: 65, multiplier: 1.25 },
              { attribute: 'form', below: 40, multiplier: 0.65 },
            ],
          },
          {
            id: 'wrong_way',
            baseWeight: 66,
            tone: 'bad',
            preview: 'תזוז שמאלה, הכדור ילך ימינה',
            text: 'זזת שמאלה. הכדור הלך ימינה. אתה נשאר שוכב על הדשא עוד כמה שניות יותר מהנדרש.',
            effects: { confidence: -6, pressure: 5 },
          },
        ],
      },
      {
        id: 'guess_early',
        label: 'לבחור צד ולעוף',
        risk: 'balanced',
        outcomes: [
          {
            id: 'lucky',
            baseWeight: 30,
            tone: 'good',
            preview: 'ניחוש נכון - אף אחד לא שואל שאלות אחרי הצלה',
            text: 'ניחשת נכון והתעופפת. לא היה בזה שום דבר חכם, אבל אף אחד לא שואל שאלות אחרי הצלה.',
            effects: { reputation: 5, coachTrust: 4, confidence: 8, roleValue: 4 },
          },
          {
            id: 'beaten',
            baseWeight: 70,
            tone: 'bad',
            preview: 'תעוף לפינה אחת והכדור ייכנס בשנייה',
            text: 'עפת לפינה אחת והכדור נכנס בשנייה. המאמן לא אומר כלום, וזה יותר גרוע מאם היה צועק.',
            effects: { confidence: -7, coachTrust: -3, pressure: 5 },
          },
        ],
      },
    ],
  },
  {
    id: 'gk_keeper_competition',
    kicker: 'חדר ההלבשה, תחילת עונה',
    title: 'שוער חדש בקבוצה',
    description:
      'הביאו שוער. גבוה ממך, מבוגר ממך, ועם ניסיון שאין לך. מאמן השוערים אומר ששניכם "תתחרו בהוגנות".',
    category: 'competition',
    conditions: { positions: ['GK'], minAge: 13 },
    weight: 9,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'outwork',
        label: 'להישאר אחרי כל אימון',
        hint: 'העבודה נראית, גם אם לא מיד',
        risk: 'balanced',
        outcomes: [
          {
            id: 'won_shirt',
            baseWeight: 40,
            tone: 'good',
            preview: 'שלושה שבועות של בעיטות אחרי האימון, והמספר אחת שלך',
            text: 'שלושה שבועות של בעיטות אחרי האימון. במשחק הראשון של העונה החולצה עם המספר אחת מחכה לך על הספסל שלך.',
            effects: { ability: 2, coachTrust: 9, roleValue: 8, confidence: 6 },
            modifiers: [
              { attribute: 'discipline', above: 62, multiplier: 1.4 },
              { attribute: 'ability', above: 60, multiplier: 1.3 },
              { attribute: 'coachTrust', below: 35, multiplier: 0.7 },
            ],
          },
          {
            id: 'split',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'שבוע אתה, שבוע הוא - ואף אחד לא מרוצה',
            text: 'מחלקים את העונה ביניכם. שבוע אתה, שבוע הוא. אף אחד לא מרוצה, ואולי זה בדיוק מה שהמאמן רצה.',
            effects: { ability: 1.2, coachTrust: 2, minutesModifier: 0.85, pressure: 5 },
          },
          {
            id: 'benched',
            baseWeight: 25,
            tone: 'bad',
            preview: 'תבלה את העונה בחימום שערים למשחקים שלא תשחק בהם',
            text: 'הוא פשוט יותר טוב ממך כרגע. אתה מבלה את העונה בחימום שערים לפני משחקים שלא תשחק בהם.',
            effects: { roleValue: -9, coachTrust: -5, confidence: -8, minutesModifier: 0.5, ability: 0.8 },
            modifiers: [{ attribute: 'ability', above: 68, multiplier: 0.45 }],
          },
        ],
      },
      {
        id: 'ask_to_leave',
        label: 'לבקש לשחק במקום אחר',
        hint: 'משחקים חשובים משם',
        risk: 'risky',
        outcomes: [
          {
            id: 'loan_out',
            baseWeight: 55,
            tone: 'neutral',
            preview: 'במועדון מבינים - משחקים בגיל הזה שווים יותר מאימונים',
            text: 'במועדון מבינים. משחקים בגיל הזה שווים יותר מאימונים, וזה נרשם כמי שיודע מה הוא צריך.',
            effects: { transferChance: 0.3, confidence: 3 },
          },
          {
            id: 'taken_badly',
            baseWeight: 45,
            tone: 'bad',
            preview: 'מאמן השוערים ישמע ויתור: "שוער לוקח את החולצה"',
            text: 'מאמן השוערים שומע את זה כמו ויתור. "שוער לא מבקש לעבור. שוער לוקח את החולצה."',
            effects: { coachTrust: -9, roleValue: -4, pressure: 6 },
          },
        ],
      },
    ],
  },
  {
    id: 'gk_playing_out',
    kicker: 'אימון טקטי, בוקר קר',
    title: 'המאמן רוצה שתשחק עם הרגליים',
    description:
      'הכדור חוזר אליך, החלוץ נוגח, והמאמן צועק לא להעיף. "אתה מתחיל את המשחק שלנו. לא מסיים אותו."',
    category: 'development',
    conditions: { positions: ['GK'], minAge: 13 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'play_it',
        label: 'לשחק מהיסוד, גם כשלוחצים',
        risk: 'risky',
        outcomes: [
          {
            id: 'comfortable',
            baseWeight: 45,
            tone: 'good',
            preview: 'הבלמים יתחילו לחפש אותך במקום לפחד ממך',
            text: 'אחרי חודש אתה מוציא כדורים שלא ידעת שאתה יכול. הבלמים מתחילים לחפש אותך במקום לפחד ממך.',
            effects: { ability: 2.6, coachTrust: 7, confidence: 6 },
            modifiers: [
              { attribute: 'potential', above: 80, multiplier: 1.35 },
              { attribute: 'confidence', above: 60, multiplier: 1.2 },
            ],
          },
          {
            id: 'costly_error',
            baseWeight: 55,
            tone: 'bad',
            preview: 'מסירה אחת קצרה מדי, וזה 0:1',
            text: 'מסירה אחת קצרה מדי, וזה 0:1. אתה שומע את היציע ולומדים אותך בכל וידאו של היריבות.',
            effects: { confidence: -8, coachTrust: -4, pressure: 7, ability: 1 },
            modifiers: [{ attribute: 'ability', above: 70, multiplier: 0.55 }],
          },
        ],
      },
      {
        id: 'safety_first',
        label: 'להעיף רחוק ולא להסתבך',
        risk: 'safe',
        outcomes: [
          {
            id: 'no_risk',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אף אחד לא יזכור שער שלא ספגת בגלל בעיטה ארוכה. גם אף אחד לא יזכור אותך בתור שוער מודרני.',
            effects: { confidence: 2, ability: 0.4, coachTrust: -3 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* בלם                                                               */
  /* ================================================================= */
  {
    id: 'cb_mark_the_star',
    kicker: 'תדריך לפני משחק',
    title: 'החלוץ שלהם הוא הבעיה שלך',
    description:
      'המאמן מקרין וידאו של החלוץ הכי טוב בליגה, ואז מסתכל עליך. "הוא שלך. כל המשחק. אל תיתן לו לנשום."',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      positions: ['CB'], minAge: 13, minRoleValue: 25,
    },
    weight: 9,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'physical',
        label: 'להיצמד אליו ולא לתת לו רגע',
        risk: 'risky',
        outcomes: [
          {
            id: 'shut_down',
            baseWeight: 42,
            tone: 'good',
            preview: 'הוא יורד בדקה 70 מתוסכל, בלי נגיחה אחת',
            text: 'הוא יורד בדקה 70 מתוסכל, בלי נגיחה אחת. בראיון אחרי המשחק הוא אומר את השם שלך, וזה יותר טוב מכל שער.',
            effects: {
              ability: 1.8,
              reputation: 7,
              coachTrust: 9,
              roleValue: 8,
              confidence: 8,
            },
            modifiers: [
              { attribute: 'ability', above: 62, multiplier: 1.35 },
              { attribute: 'form', above: 62, multiplier: 1.2 },
              { attribute: 'discipline', below: 45, multiplier: 0.6 },
            ],
          },
          {
            id: 'booked_off',
            baseWeight: 33,
            tone: 'bad',
            preview: 'צהוב מוקדם, עבירה טיפשית, והקבוצה נשארת בעשרה',
            text: 'צהוב בדקה 20, ואז עוד עבירה טיפשית. אתה יוצא בדקה 55 והקבוצה נשארת בעשרה.',
            effects: { discipline: -7, coachTrust: -7, confidence: -6, roleValue: -5 },
            modifiers: [{ attribute: 'discipline', above: 70, multiplier: 0.5 }],
          },
          {
            id: 'beaten_twice',
            baseWeight: 25,
            tone: 'bad',
            preview: 'הוא מהיר ממך, וזה נגמר בשני שערים',
            text: 'הוא מהיר ממך, וזה נגמר בשני שערים. בוידאו של יום שני עוצרים את התמונה בדיוק עליך.',
            effects: { confidence: -9, coachTrust: -5, pressure: 7 },
          },
        ],
      },
      {
        id: 'zonal',
        label: 'לשמור על העמדה ולא להיגרר',
        risk: 'balanced',
        outcomes: [
          {
            id: 'solid',
            baseWeight: 62,
            tone: 'good',
            preview: 'הוא נוגע בכדור הרבה ולא עושה כלום',
            text: 'לא היה בזה דרמה. הוא נגע בכדור הרבה, לא עשה כלום, ואתה סיימת משחק בלי לרוץ אחורה אפילו פעם אחת.',
            effects: { ability: 1.2, coachTrust: 5, roleValue: 4, confidence: 4 },
            modifiers: [{ attribute: 'ability', above: 58, multiplier: 1.25 }],
          },
          {
            id: 'one_moment',
            baseWeight: 38,
            tone: 'bad',
            preview: 'רגע אחד של חוסר תשומת לב, וזה ברשת',
            text: 'רגע אחד של חוסר תשומת לב, כדור לגב, וזה נגמר ברשת. משחק שלם נמחק בשלוש שניות.',
            effects: { confidence: -5, coachTrust: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'cb_organise_defence',
    kicker: 'הפסקת חצי, 0:2',
    title: 'ההגנה מתפרקת',
    description:
      'ספגתם שניים ברבע שעה. הקו מבולבל, המגנים צועקים אחד על השני, ואף אחד לא לוקח אחריות.',
    category: 'team',
    conditions: { positions: ['CB'], minAge: 14 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'take_charge',
        label: 'לקחת פיקוד על הקו',
        hint: 'מנהיגות נרשמת',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'leader',
            baseWeight: 44,
            tone: 'good',
            preview: 'הקו יזוז ביחד במחצית השנייה, והמאמן יראה מי עשה את זה',
            text: 'אתה מדבר, וזה עובד. במחצית השנייה הקו זז ביחד ולא ספגתם עוד. המאמן ראה בדיוק מי עשה את זה.',
            effects: {
              coachTrust: 10,
              roleValue: 9,
              confidence: 7,
              reputation: 4,
              flags: ['coach_favourite'],
            },
            modifiers: [
              { attribute: 'roleValue', above: 55, multiplier: 1.4 },
              { attribute: 'age', above: 16, multiplier: 1.25 },
              { attribute: 'confidence', below: 42, multiplier: 0.55 },
            ],
          },
          {
            id: 'ignored',
            baseWeight: 56,
            tone: 'neutral',
            preview: 'שחקן מבוגר ממך יגיד לך לשתוק ולשחק',
            text: 'אתה מנסה לדבר, ושחקן מבוגר ממך אומר לך לשתוק ולשחק. אולי הוא צודק. אולי עוד שנה זה יהיה אחרת.',
            effects: { confidence: -4, pressure: 4, roleValue: 1 },
          },
        ],
      },
      {
        id: 'just_play',
        label: 'לשתוק ולעשות את העבודה שלך',
        risk: 'safe',
        outcomes: [
          {
            id: 'quiet_game',
            baseWeight: 100,
            tone: 'neutral',
            text: 'שיחקת משחק נקי ובלי רעש. לא הצלת את המשחק, אבל גם לא היית חלק מהבלגן.',
            effects: { coachTrust: 2, ability: 0.5 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* מגן                                                               */
  /* ================================================================= */
  {
    id: 'fb_overlap_duty',
    kicker: 'אימון טקטי',
    title: 'המאמן רוצה אותך גבוה',
    description:
      'שיטה חדשה: המגנים עולים כמעט עד קו האמצע. "אתה תרוץ יותר מכולם," אומר המאמן, "וגם תיצור יותר מכולם."',
    category: 'development',
    conditions: { positions: ['FB'], minAge: 13 },
    weight: 9,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'bomb_on',
        label: 'לעלות בכל הזדמנות',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'created',
            baseWeight: 46,
            tone: 'good',
            preview: 'ההרמות מתחילות ליפול, ואתה עם יותר בישולים מהכנפיים',
            text: 'ההרמות שלך מתחילות ליפול בדיוק. עד סוף החודש אתה עם יותר בישולים מהכנפיים.',
            effects: { ability: 2.4, roleValue: 7, coachTrust: 7, confidence: 6, reputation: 3 },
            modifiers: [
              { attribute: 'ability', above: 58, multiplier: 1.3 },
              { attribute: 'form', above: 60, multiplier: 1.2 },
            ],
          },
          {
            id: 'caught_out',
            baseWeight: 54,
            tone: 'bad',
            preview: 'הכנף שלהם ירוץ לחלל שהשארת - שני שערים מהצד שלך',
            text: 'עלית, איבדו את הכדור, והכנף שלהם רץ לחלל שהשארת. שני שערים בשבועיים נכנסים מהצד שלך.',
            effects: { coachTrust: -6, confidence: -6, injuryRisk: 4, ability: 0.9 },
            modifiers: [{ attribute: 'ability', above: 68, multiplier: 0.6 }],
          },
        ],
      },
      {
        id: 'stay_home',
        label: 'להישאר אחורה ולהגן',
        risk: 'safe',
        outcomes: [
          {
            id: 'reliable',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הצד שלך נעול כל המשחק. אף אחד לא כותב על מגן שלא ספג, אבל המאמן יודע.',
            effects: { coachTrust: 4, ability: 0.8, roleValue: 2 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* קשר                                                               */
  /* ================================================================= */
  {
    id: 'cm_tempo_keeper',
    kicker: 'שיחה אחרי אימון',
    title: 'המאמן רוצה שאתה תקבע את הקצב',
    description:
      '"כל הכדורים עוברים דרכך. אם אתה משחק מהר - אנחנו מהירים. אם אתה מאבד - אנחנו רצים אחורה."',
    category: 'coach',
    conditions: { positions: ['CM'], minAge: 13 },
    weight: 9,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'take_it',
        label: 'לקחת את הכדור בכל מצב',
        risk: 'balanced',
        outcomes: [
          {
            id: 'metronome',
            baseWeight: 48,
            tone: 'good',
            preview: 'תקבל בין הקווים ותעביר, ואף אחד לא יחפש כדור בלעדיך',
            text: 'אתה מקבל בין הקווים, מסתובב, ומעביר. אחרי חודש אף אחד בקבוצה לא מחפש כדור בלעדיך.',
            effects: { ability: 2.5, coachTrust: 9, roleValue: 8, confidence: 7 },
            modifiers: [
              { attribute: 'ability', above: 60, multiplier: 1.35 },
              { attribute: 'potential', above: 82, multiplier: 1.25 },
              { attribute: 'confidence', below: 40, multiplier: 0.6 },
            ],
          },
          {
            id: 'overrun',
            baseWeight: 52,
            tone: 'neutral',
            preview: 'תיקח כדור שאסור לקחת, ותלמד את ההבדל בין אמיץ לטיפש',
            text: 'לפעמים אתה לוקח כדור שאסור לקחת. הקהל נאנח, המאמן מסביר, ואתה לומד את ההבדל בין אמיץ לטיפש.',
            effects: { ability: 1.3, confidence: -3, coachTrust: 1 },
          },
        ],
      },
      {
        id: 'simple',
        label: 'לשחק פשוט - מסירה אחת ולזוז',
        risk: 'safe',
        outcomes: [
          {
            id: 'efficient',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אחוזי מסירה מצוינים ואפס סיכון. שחקן טוב לקבוצה, ולא בהכרח שחקן שמישהו בא לראות.',
            effects: { ability: 1, coachTrust: 4, confidence: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'cm_position_shift',
    kicker: 'לוח טקטי, יום חמישי',
    title: 'מזיזים אותך אחורה',
    description:
      'הקשר המגן נפצע. המאמן מסתכל על הסגל, ואז עליך. "אתה מבין משחק. תשחק עמדה אחת אחורה."',
    category: 'development',
    conditions: { positions: ['CM'], minAge: 14 },
    weight: 8,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'embrace',
        label: 'ללמוד את העמדה החדשה',
        hint: 'עמדה שקשה למצוא לה שחקנים',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'new_home',
            baseWeight: 42,
            tone: 'good',
            preview: 'משם רואים את כל המגרש, ותוך חודשיים זו העמדה שלך',
            text: 'מסתבר שמשם אתה רואה את כל המגרש. תוך חודשיים זו העמדה שלך, ופתאום אתה שחקן שקשה להחליף.',
            effects: { ability: 2.8, coachTrust: 10, roleValue: 7, confidence: 6, potential: 1.5 },
            modifiers: [
              { attribute: 'potential', above: 80, multiplier: 1.3 },
              { attribute: 'ability', above: 58, multiplier: 1.25 },
            ],
          },
          {
            id: 'lost',
            baseWeight: 58,
            tone: 'bad',
            preview: 'לא תדע מתי ללחוץ, ויחזירו אותך קדימה - לתפוס',
            text: 'אתה לא מבין מתי ללחוץ ומתי לחכות. שלושה משחקים אחר כך מחזירים אותך קדימה, וגם שם כבר תפוס.',
            effects: { confidence: -7, coachTrust: -4, roleValue: -4, ability: 0.6 },
          },
        ],
      },
      {
        id: 'refuse',
        label: 'להגיד שאתה קשר קדמי',
        risk: 'risky',
        outcomes: [
          {
            id: 'respected',
            baseWeight: 35,
            tone: 'neutral',
            preview: '"בסדר, אז תוכיח לי קדימה" - והרף עולה',
            text: 'המאמן מקבל את זה, בלי התלהבות. "בסדר. אז תוכיח לי קדימה." הרף עלה.',
            effects: { pressure: 6, coachTrust: -2, confidence: 2 },
          },
          {
            id: 'dropped',
            baseWeight: 65,
            tone: 'bad',
            preview: 'מי שאומר לא לעמדה אומר לא להרכב',
            text: 'מי שאומר לא לעמדה, אומר לא להרכב. אתה מגלה את זה מהספסל.',
            effects: { coachTrust: -9, roleValue: -7, minutesModifier: 0.65, confidence: -5 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* כנף                                                               */
  /* ================================================================= */
  {
    id: 'wg_one_on_one',
    kicker: 'קו הצד, דקה 63',
    title: 'אחד על אחד עם המגן',
    description:
      'הכדור אצלך, המגן מולך, והקו הלבן קורא. היציע מתחיל לקום עוד לפני שעשית משהו.',
    category: 'match_moment',
    conditions: {
      // v0.4.8: on the pitch, so he has to be playing.
      requiresAppearance: true,
      positions: ['WG'], minAge: 12,
    },
    weight: 9,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'take_him',
        label: 'לנסות לעבור אותו',
        risk: 'risky',
        outcomes: [
          {
            id: 'destroyed_him',
            baseWeight: 38,
            tone: 'good',
            preview: 'פנימה, החוצה, והוא נשאר בדשא - והיציע קורא בשמך',
            text: 'תנועה אחת פנימה, ואז החוצה, והוא נשאר בדשא. ההרמה שלך נגמרת ברשת והיציע קורא בשמך.',
            effects: {
              ability: 1.8,
              reputation: 8,
              roleValue: 8,
              confidence: 10,
              coachTrust: 5,
              flags: ['fan_favourite'],
            },
            modifiers: [
              { attribute: 'ability', above: 60, multiplier: 1.4 },
              { attribute: 'confidence', above: 65, multiplier: 1.3 },
              { attribute: 'form', below: 42, multiplier: 0.6 },
            ],
          },
          {
            id: 'dispossessed',
            baseWeight: 62,
            tone: 'bad',
            preview: 'הוא לוקח את הכדור בנקיות, והקהל נאנח',
            text: 'הוא לוקח לך את הכדור בנקיות והקהל נאנח. בפעם הבאה שהכדור מגיע אליך, אתה מוסר אחורה.',
            effects: { confidence: -6, coachTrust: -3, pressure: 4 },
          },
        ],
      },
      {
        id: 'early_cross',
        label: 'להרים מוקדם',
        risk: 'balanced',
        outcomes: [
          {
            id: 'good_ball',
            baseWeight: 55,
            tone: 'good',
            preview: 'כדור מדויק לראש של החלוץ - המאמן רואה מי נתן אותו',
            text: 'כדור מדויק לראש של החלוץ. לא כולם ראו מי נתן אותו, אבל המאמן כן.',
            effects: { ability: 1, coachTrust: 5, roleValue: 4, confidence: 4 },
          },
          {
            id: 'cleared',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'הבלם מנקה בראש בלי להתאמץ',
            text: 'הבלם מנקה בראש בלי להתאמץ. החלטה בטוחה, תוצאה אפסית.',
            effects: { confidence: -1, ability: 0.4 },
          },
        ],
      },
    ],
  },
  {
    id: 'wg_final_ball',
    kicker: 'אימון אישי, אחרי כולם',
    title: 'הכדור האחרון לא מגיע',
    description:
      'אתה עובר את המגן כל שבוע, ואז ההרמה נוגעת בבלם הראשון. מאמן הכושר אומר שהבעיה היא לא הרגליים - זו ההחלטה.',
    category: 'development',
    conditions: { positions: ['WG'], minAge: 13 },
    weight: 8,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'extra_work',
        label: 'מאה הרמות ביום אחרי אימון',
        risk: 'balanced',
        outcomes: [
          {
            id: 'clicked',
            baseWeight: 50,
            tone: 'good',
            preview: 'תרים בלי להסתכל ותדע איפה החלוץ יהיה',
            text: 'אחרי שישה שבועות אתה מרים בלי להסתכל ויודע איפה החלוץ יהיה. הבישולים מתחילים להצטבר.',
            effects: { ability: 2.6, coachTrust: 6, confidence: 5, reputation: 3 },
            modifiers: [
              { attribute: 'discipline', above: 60, multiplier: 1.4 },
              { attribute: 'potential', above: 78, multiplier: 1.25 },
            ],
          },
          {
            id: 'still_missing',
            baseWeight: 50,
            tone: 'neutral',
            preview: 'הרגליים משתפרות, ההחלטות פחות',
            text: 'הרגליים משתפרות, ההחלטות פחות. לפעמים זה פשוט לוקח עוד שנה.',
            effects: { ability: 1, confidence: -2 },
          },
        ],
      },
      {
        id: 'keep_dribbling',
        label: 'להמשיך לעשות מה שאתה טוב בו',
        risk: 'safe',
        outcomes: [
          {
            id: 'entertainer',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הקהל אוהב אותך. הסטטיסטיקה פחות. יש שחקנים שכל הקריירה שלהם היא הרגע שלפני ההרמה.',
            effects: { reputation: 3, confidence: 3, coachTrust: -2, ability: 0.5 },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* חלוץ                                                              */
  /* ================================================================= */
  {
    id: 'st_goal_drought',
    kicker: 'שבע מחזורים, אפס שערים',
    title: 'הבצורת',
    description:
      'אתה מגיע למצבים, ולא נכנס. בעיתונות מתחילים לספור, בבית שואלים אם הכול בסדר, ואתה חושב על זה בשינה.',
    category: 'pressure',
    conditions: { positions: ['ST'], minAge: 14, minRoleValue: 30 },
    weight: 10,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'shoot_more',
        label: 'להמשיך לבעוט מכל מצב',
        risk: 'risky',
        outcomes: [
          {
            id: 'broke_it',
            baseWeight: 42,
            tone: 'good',
            preview: 'אחד נכנס, ואז עוד אחד - חלוץ צריך רק אחד',
            text: 'בעיטה במגרש ריק, וזה נכנס. ואז עוד אחד באותו שבוע. חלוץ צריך רק אחד כדי להיזכר מי הוא.',
            effects: { form: 12, confidence: 12, coachTrust: 5, roleValue: 5, reputation: 4 },
            modifiers: [
              { attribute: 'ability', above: 65, multiplier: 1.35 },
              { attribute: 'confidence', above: 55, multiplier: 1.25 },
              { attribute: 'form', below: 35, multiplier: 0.6 },
            ],
          },
          {
            id: 'worse',
            baseWeight: 58,
            tone: 'bad',
            preview: 'כל בעיטה לחוצה מהקודמת, והחלפה בדקה 70',
            text: 'כל בעיטה יותר לחוצה מהקודמת. בדקה 70 המאמן מחליף אותך והיציע לא שותק.',
            effects: { confidence: -10, form: -6, coachTrust: -5, pressure: 9 },
          },
        ],
      },
      {
        id: 'simplify',
        label: 'לחזור ליסודות - לעבוד לקבוצה',
        hint: 'לא הזוהר, אבל יוצא מהראש',
        risk: 'safe',
        outcomes: [
          {
            id: 'assists_first',
            baseWeight: 62,
            tone: 'good',
            preview: 'תפסיק לחשוב על השער, ושני בישולים אחר כך הם חוזרים',
            text: 'הפסקת לחשוב על השער והתחלת לשחק. שני בישולים אחר כך, השערים חוזרים לבד.',
            effects: { form: 7, confidence: 6, coachTrust: 6, ability: 1.2 },
            modifiers: [{ attribute: 'discipline', above: 58, multiplier: 1.3 }],
          },
          {
            id: 'forgotten',
            baseWeight: 38,
            tone: 'neutral',
            preview: 'תעבוד קשה ולא תבקיע - וחלוץ נמדד בשערים',
            text: 'אתה עובד קשה ולא נכנס. חלוץ שלא מבקיע נמדד בסוף בשערים, גם אם עשה הכול נכון.',
            effects: { confidence: -4, coachTrust: 1, roleValue: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'st_hot_streak',
    kicker: 'שלושה משחקים, חמישה שערים',
    title: 'הכול נכנס',
    description:
      'אתה בתקופה שבה הכדור מוצא אותך. הרגל, הראש, הברך - לא משנה. אין תחושה כזאת בשום מקום אחר בעולם.',
    category: 'development',
    conditions: { positions: ['ST'], minAge: 13, minForm: 55 },
    weight: 8,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'ride_it',
        label: 'לרכוב על הגל ולבקש את הכדור',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'season_of_life',
            baseWeight: 48,
            tone: 'good',
            preview: 'תסיים את העונה מלך השערים של הליגה שלך',
            text: 'הבצורת לא באה. אתה מסיים את העונה בתור מלך השערים של הליגה שלך, וכולם יודעים את השם.',
            effects: {
              form: 10,
              confidence: 10,
              reputation: 9,
              roleValue: 8,
              coachTrust: 7,
              ability: 1.5,
              flags: ['first_team_radar'],
            },
            modifiers: [
              { attribute: 'ability', above: 62, multiplier: 1.35 },
              { attribute: 'potential', above: 82, multiplier: 1.3 },
            ],
          },
          {
            id: 'came_down',
            baseWeight: 52,
            tone: 'neutral',
            preview: 'הגל יישבר אחרי שני משחקים - אבל עכשיו אתה יודע שאתה יכול',
            text: 'הגל נשבר אחרי עוד שני משחקים, כמו תמיד. אבל עכשיו אתה יודע שאתה יכול.',
            effects: { confidence: 5, reputation: 3, form: -3, ability: 0.8 },
          },
        ],
      },
      {
        id: 'stay_grounded',
        label: 'לא להתרגש ולהמשיך לעבוד',
        risk: 'safe',
        outcomes: [
          {
            id: 'professional',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה לא קורא את העיתונים ולא עונה לטלפונים. המאמן מציין את זה בפני כל הקבוצה.',
            effects: { coachTrust: 7, discipline: 5, confidence: 4, form: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'st_lost_the_shirt',
    kicker: 'הרכב על הלוח, בלי השם שלך',
    title: 'איבדת את החולצה',
    description:
      'החלוץ החדש הבקיע בשני משחקים רצופים. ביום חמישי אתה מסתכל על הלוח ומחפש את עצמך, ולא מוצא.',
    category: 'competition',
    conditions: { positions: ['ST'], minAge: 15 },
    weight: 9,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'fight',
        label: 'להילחם על המקום באימונים',
        risk: 'balanced',
        outcomes: [
          {
            id: 'took_it_back',
            baseWeight: 40,
            tone: 'good',
            preview: 'שבועיים שבהם אתה הכי טוב במגרש, והמאמן משנה',
            text: 'שבועיים של אימונים שבהם אתה הכי טוב במגרש. המאמן לא אוהב לשנות, אבל הוא משנה.',
            effects: { coachTrust: 8, roleValue: 8, confidence: 7, ability: 1.4 },
            modifiers: [
              { attribute: 'ability', above: 64, multiplier: 1.4 },
              { attribute: 'coachTrust', above: 58, multiplier: 1.3 },
              { attribute: 'confidence', below: 40, multiplier: 0.55 },
            ],
          },
          {
            id: 'still_out',
            baseWeight: 60,
            tone: 'bad',
            preview: 'תעשה הכול נכון וזה לא יספיק - עונה שנמחקת',
            text: 'אתה עושה הכול נכון וזה לא מספיק. עשרים דקות פה, עשרים דקות שם, ועונה שנמחקת.',
            effects: { minutesModifier: 0.6, confidence: -8, roleValue: -5, coachTrust: -2 },
          },
        ],
      },
      {
        id: 'demand_answers',
        label: 'לדרוש הסבר מהמאמן',
        risk: 'risky',
        outcomes: [
          {
            id: 'straight_answer',
            baseWeight: 38,
            tone: 'neutral',
            preview: 'הוא יאמר בפנים מה חסר, ותצא עם רשימה',
            text: 'הוא אומר לך בפנים בדיוק מה חסר. זה לא נעים לשמוע, אבל עכשיו יש לך רשימה.',
            effects: { coachTrust: 2, ability: 1, pressure: 4, confidence: -2 },
            modifiers: [{ attribute: 'coachTrust', above: 60, multiplier: 1.5 }],
          },
          {
            id: 'row',
            baseWeight: 62,
            tone: 'bad',
            preview: 'צעקות במסדרון, ובעיתון יודעים למחרת',
            text: 'זה נגמר בצעקות במסדרון. בקבוצה מדברים על זה, ובעיתון יודעים על זה למחרת.',
            effects: {
              coachTrust: -12,
              discipline: -6,
              roleValue: -6,
              minutesModifier: 0.55,
              flags: ['discipline_problem'],
            },
          },
        ],
      },
    ],
  },
];

import type { GameEvent } from '../../types';

/**
 * The people events (v0.5, Phases 7, 10, 19, 25, 34-39).
 *
 * Agents, managers and personal coaches, as recurring humans rather than mechanics. Three rules
 * hold everywhere in this file:
 *
 *   1. The event UI names the actual person (the DecisionCard header reads career.people), so
 *      the TEXT here says "הסוכן שלך" / "המאמן" and the header says who that is. One source for
 *      the name - the person object - and no string in this file can go stale.
 *   2. Nothing here creates football facts. Effects move relationships, probabilities and
 *      development inputs. Transfers still come from the transfer engine; minutes still come
 *      from the minutes model.
 *   3. Maccabism appears exactly once, tagged 'return', on an explicitly-Maccabi choice. An
 *      agent recommending Ajax is not a Maccabi event (Phase 32).
 *
 * Every gate fails closed: an agent event requires an agent, a specialist event requires the
 * specialist, a GK session requires a goalkeeper.
 */

export const PEOPLE_EVENTS: GameEvent[] = [
  /* ================================================================ */
  /* AGENTS                                                            */
  /* ================================================================ */

  /* ---------------- the first representative (Phase 7) ------------- */
  {
    id: 'ppl_first_agent_family',
    kicker: 'אחרי האימון',
    title: 'מישהו מחכה ליד השער',
    description:
      'איש בשנות החמישים שלו, בלי כרטיס ביקור מבריק. הוא מכיר את אבא שלך מהעבודה, והוא מלווה שני שחקנים צעירים בליגה. "אני לא מבטיח לך אירופה. אני מבטיח שיהיה מישהו שעונה לטלפון."',
    category: 'people',
    conditions: { agentEligibleStage: true, forbidsAgent: true, maxReputation: 30 },
    slots: ['early', 'mid'],
    weight: 16,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'sign',
        risk: 'opportunity',
        label: 'ללחוץ יד. שיהיה מישהו בפינה שלך',
        outcomes: [
          {
            id: 'signed',
            baseWeight: 100,
            tone: 'good',
            preview: 'ייצוג ראשון - סבלני, מגונן, בלי הבטחות גדולות',
            text: 'הוא לא מדבר הרבה, אבל כשמתקשרים ממועדון אחר - יש עכשיו מי שעונה. משהו בקריירה שלך נהיה מסודר יותר.',
            effects: { signAgent: 'family', confidence: 3 },
          },
        ],
      },
      {
        id: 'wait',
        risk: 'safe',
        label: 'עוד מוקדם. לחכות למישהו עם קשרים',
        outcomes: [
          {
            id: 'waited',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'בלי סוכן בינתיים - הדלת נשארת פתוחה למי שיבוא',
            text: 'הוא מהנהן, לא נעלב. "אם תשנה את דעתך, אתה יודע איפה אני." אתה ממשיך לבד בינתיים.',
            effects: {},
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_first_agent_networker',
    kicker: 'שיחת טלפון',
    title: 'סוכן עם קשרים מציע ייצוג',
    description:
      'הוא מדבר מהר ונוקב בשמות של שלושה יושבי ראש שהוא "מדבר איתם כל שבוע". השחקנים שלו באמת משחקים, זה נכון. השאלה אם אתה עוד שם של ילד ברשימה או פרויקט אמיתי.',
    category: 'people',
    conditions: { agentEligibleStage: true, forbidsAgent: true, minReputation: 18 },
    slots: ['early', 'mid'],
    weight: 18,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'sign',
        risk: 'opportunity',
        label: 'לחתום. קשרים פותחים דלתות',
        outcomes: [
          {
            id: 'signed',
            baseWeight: 100,
            tone: 'good',
            preview: 'ייצוג של איש קשרים - יותר טלפונים, יותר אפשרויות בארץ',
            text: 'תוך שבוע הוא כבר הזכיר את השם שלך בשתי שיחות. אתה מרגיש את זה - העולם קצת יותר קטן כשמישהו מחייג בשבילך.',
            effects: { signAgent: 'israel_networker' },
          },
        ],
      },
      {
        id: 'decline',
        risk: 'safe',
        label: 'משהו בדיבור המהיר לא עושה לך טוב',
        outcomes: [
          {
            id: 'declined',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'בלי ייצוג בינתיים - הבחירה במי שלצידך תחכה',
            text: 'אתה מודה לו ומסיים את השיחה. אולי טעות, אולי חוש בריא. הזמן יגיד.',
            effects: {},
          },
        ],
      },
    ],
  },

  {
    id: 'ppl_first_agent_dealmaker',
    kicker: 'הצעה אגרסיבית',
    title: 'סוכן עסקאות רוצה אותך',
    description:
      'הוא לא שואל איך אתה מרגיש. הוא פותח טאבלט עם שלוש עסקאות שהוא סגר החודש. "אני לא מלווה קריירות. אני מזניק אותן. תחליט אם אתה בפנים."',
    category: 'people',
    conditions: { agentEligibleStage: true, forbidsAgent: true, minReputation: 26 },
    slots: ['early', 'mid'],
    weight: 16,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'sign',
        risk: 'opportunity',
        label: 'להזניק. בשביל זה באת',
        outcomes: [
          {
            id: 'signed',
            baseWeight: 100,
            tone: 'good',
            preview: 'ייצוג אגרסיבי - יותר הצעות, יותר סיכון לתפקיד לא נכון',
            text: 'החתימה מהירה כמו הדיבור שלו. עוד באותו שבוע השם שלך כבר מסתובב במקומות חדשים. מהר. אולי מהר מדי.',
            effects: { signAgent: 'dealmaker' },
          },
        ],
      },
      {
        id: 'decline',
        risk: 'safe',
        label: 'קריירה היא לא הזנקה. לוותר',
        outcomes: [
          {
            id: 'declined',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'להישאר בלי ייצוג - הדרך השקטה',
            text: 'הוא סוגר את הטאבלט בלי להתווכח. "כשתשנה את דעתך - אם עוד יהיה לי מקום." הדלת נסגרת בנימוס.',
            effects: {},
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_europe_approach',
    kicker: 'פגישה דיסקרטית',
    title: 'מומחה אירופה מציע לקחת אותך',
    description:
      'סוכן שהשחקנים שלו משחקים בהולנד ובבלגיה ביקש פגישה שקטה. "הסוכן שלך מצוין בשוק שלו," הוא אומר בזהירות. "השוק שלי אחר. תחשוב איפה אתה רוצה לשחק בעוד שלוש שנים."',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['family', 'israel_networker', 'dealmaker'],
      minReputation: 34,
      bands: ['senior'],
      abroad: false,
    },
    slots: ['early'],
    weight: 9,
    oncePerCareer: true,
    choices: [
      {
        id: 'switch_europe',
        risk: 'opportunity',
        label: 'אירופה היא היעד. לעבור אליו',
        outcomes: [
          {
            id: 'europe_rep',
            baseWeight: 100,
            tone: 'good',
            preview: 'ייצוג עם רשת אירופית אמיתית - והקשר הישן נגמר',
            text: 'השיחה עם הסוכן הקודם קשה, כמו כל פרידה מוצדקת. שבוע אחרי, הטלפון הראשון מגיע כבר מהולנד.',
            effects: { signAgent: 'europe_specialist' },
          },
        ],
      },
      {
        id: 'stay_current',
        risk: 'safe',
        label: 'נאמנות שווה יותר מרשת קשרים',
        outcomes: [
          {
            id: 'stayed',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'הקשר הקיים יתחזק - ואירופה תצטרך למצוא דרך אחרת',
            text: 'אתה מספר לסוכן שלך על הפגישה בעצמך. השקיפות הזאת שווה שנה של אמון. אירופה, אם תבוא - תבוא דרככם.',
            effects: { agentRelationship: 10 },
          },
        ],
      },
    ],
  },

  {
    id: 'ppl_agent_outgrown',
    kicker: 'שיחה כנה',
    title: 'הסוכן שלך אומר לך את האמת',
    description:
      'הוא מבקש להיפגש, ומדבר לאט. "אני מלווה אותך מאז שהיית ילד, ואני אוהב את זה. אבל השיחות שמגיעות עכשיו הן לא השיחות שאני יודע לנהל. יש אנשים עם רשת אחרת. אני אומר לך את זה כי אכפת לי - לא כי אני רוצה ללכת."',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['family', 'israel_networker'],
      bands: ['senior'],
      minReputation: 52,
      minAgentRelationship: 55,
      minAge: 22,
    },
    slots: ['early', 'mid'],
    weight: 12,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'take_his_advice',
        label: 'הוא צודק. לעבור למי שמכיר את השוק הזה',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'moved_up',
            baseWeight: 100,
            tone: 'good',
            preview: 'ייצוג עם רשת אירופית - והפרידה נשארת יפה',
            text: 'הוא עצמו מסדר לך את הפגישה. יש משהו נדיר באדם שפותח לך דלת שמוציאה אותך ממנו. אתם נשארים בקשר.',
            effects: { signAgent: 'europe_specialist', reputation: 2 },
          },
        ],
      },
      {
        id: 'stay_with_him',
        label: 'מי שהיה איתי בהתחלה יהיה איתי גם עכשיו',
        risk: 'safe',
        outcomes: [
          {
            id: 'loyalty_held',
            baseWeight: 100,
            tone: 'good',
            preview: 'הקשר יתחזק - ומי שמכיר אותך יעבוד קשה יותר בשבילך',
            text: '"אתה לא הולך לשום מקום," אתה אומר. הוא לא עונה מיד. בחודשים הבאים הוא עובד כמו אדם שיש לו משהו להוכיח - ולפעמים זה שווה יותר מרשת קשרים.',
            effects: { agentRelationship: 14, transferChance: 0.1 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_sustained_europe',
    kicker: 'שלוש פניות בחודשיים',
    title: 'אירופה מתעניינת ברצינות',
    description:
      'זו כבר לא פנייה בודדת. שלושה מועדונים שאלו עליך בחודשיים, ואחד מהם חזר פעמיים. סוכן שמתמחה בשוק הזה שומע את הרעש ומציע להיכנס לתמונה - הוא מדבר על מסלול, לא על עסקה אחת.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['family', 'israel_networker', 'dealmaker'],
      bands: ['senior'],
      abroad: false,
      minAbility: 66,
      minReputation: 48,
      minLastAppearances: 18,
    },
    slots: ['mid', 'late'],
    weight: 12,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'switch_for_europe',
        label: 'אם זה הולך לקרות - שיהיה מי שיודע לנהל את זה',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'specialist_takes_over',
            baseWeight: 70,
            tone: 'good',
            preview: 'ייצוג מתמחה יהפוך את ההתעניינות למשא ומתן אמיתי',
            text: 'הוא נכנס לתמונה ותוך שבועיים ההתעניינות הופכת לשיחות אמיתיות. יש הבדל בין מישהו ששומע על השוק לבין מישהו שגר בו.',
            effects: { signAgent: 'europe_specialist', transferChance: 0.2 },
          },
          {
            id: 'noise_fades',
            baseWeight: 30,
            tone: 'neutral',
            preview: 'לפעמים הרעש נגמר בדיוק כשמחליפים ידיים',
            text: 'החלפת ייצוג באמצע גל התעניינות היא הימור. הפעם הגל שוקע בזמן שהניירת מסתדרת. הרשת נשארת - התזמון היה אכזרי.',
            effects: { signAgent: 'europe_specialist' },
          },
        ],
      },
      {
        id: 'trust_current',
        label: 'שהסוכן שלי ינהל את זה. הוא מכיר אותי',
        risk: 'balanced',
        outcomes: [
          {
            id: 'handled_it',
            baseWeight: 55,
            tone: 'good',
            preview: 'מי שמכיר אותך יודע גם מה לא מתאים לך',
            text: 'הוא עובד מסביב לשעון, שואל שאלות שמומחה שוק לא היה חושב לשאול, ופוסל בשקט שני מועדונים שהיו טועים בשבילך.',
            effects: { agentRelationship: 10, transferChance: 0.14 },
          },
          {
            id: 'out_of_depth',
            baseWeight: 45,
            tone: 'bad',
            preview: 'ונאמנות לא מחליפה מספרי טלפון',
            text: 'הוא עושה כמיטב יכולתו, ורואים שזה לא השוק שלו. שיחה אחת לא נענית בזמן, ועסקה מתפוגגת. הוא מתנצל. זה לא עוזר.',
            effects: { agentRelationship: -8, confidence: -3 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_strategy_pitch',
    kicker: 'פגישה שלא ביקשת',
    title: 'סוכן אחר מציע לך אסטרטגיה אחרת',
    description:
      'הוא מגיע עם מצגת, וזה מרגיש מוזר עד שאתה מקשיב. "אתה מנוהל כמו שחקן שמפחד לטעות. אני הייתי לוקח אותך למקום גדול יותר, מוקדם יותר, גם במחיר של שנה קשה." זו לא אותה קריירה. זו קריירה אחרת.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['family', 'israel_networker', 'europe_specialist'],
      bands: ['senior'],
      minAge: 21,
      maxAge: 28,
      minRoleValue: 48,
      minReputation: 42,
    },
    slots: ['early', 'mid'],
    weight: 11,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'take_the_gamble',
        label: 'אולי באמת שיחקתי אותה בטוח מדי',
        risk: 'risky',
        outcomes: [
          {
            id: 'new_strategy',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'קריירה אגרסיבית יותר - יותר הצעות, פחות ביטחון בתפקיד',
            text: 'החתימה מרגישה כמו קפיצה. תוך חודש מגיעות שיחות שלא היו מגיעות קודם - חלקן מרגשות, חלקן מסוכנות. זאת הייתה הנקודה.',
            effects: { signAgent: 'dealmaker', transferChance: 0.14 },
          },
        ],
      },
      {
        id: 'know_yourself',
        label: 'אתה יודע איך אתה בנוי. להישאר',
        risk: 'safe',
        outcomes: [
          {
            id: 'self_knowledge',
            baseWeight: 100,
            tone: 'good',
            preview: 'לדעת מה מתאים לך שווה יותר ממצגת טובה',
            text: 'אתה מודה לו ומסרב. יש שחקנים שפורחים בכאוס ויש כאלה שנשברים בו, ואתה יודע איזה מהם אתה. הסוכן שלך שומע על הפגישה - ועל התשובה.',
            effects: { agentRelationship: 8, confidence: 4 },
          },
        ],
      },
    ],
  },

  /* ---------------- advice and pressure (Phases 9-10) -------------- */
  {
    id: 'ppl_agent_pushes_move',
    kicker: 'פגישה עם הסוכן',
    title: 'הסוכן שלך דוחף לעבור',
    description:
      '"אתה גדול על המקום הזה," הוא אומר, ולא בפעם הראשונה. "עוד עונה כזאת ואתה נתקע עם התווית של שחקן ליגה קטנה." הוא רוצה שתאשר לו לפתוח דלתות כבר עכשיו.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['dealmaker', 'super_agent'],
      bands: ['senior'],
      minRoleValue: 45,
    },
    slots: ['mid', 'late'],
    weight: 4,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'listen',
        risk: 'opportunity',
        label: 'לתת לו לעבוד. שיביא הצעות',
        outcomes: [
          {
            id: 'doors_open',
            baseWeight: 70,
            tone: 'good',
            preview: 'הסוכן יתחיל לעבוד - סיכוי גבוה יותר להצעות בקיץ',
            text: 'הוא מחייך את החיוך של מי שקיבל אישור. השם שלך מתחיל להסתובב, ואתה מרגיש את זה כבר באימונים.',
            effects: { transferChance: 0.2, agentRelationship: 6, agentAdvice: 'followed' },
          },
          {
            id: 'unsettled',
            baseWeight: 30,
            tone: 'bad',
            preview: 'הרעש עלול להגיע למאמן לפני שמגיעה הצעה',
            text: 'הרעש מגיע למאמן לפני שמגיעה הצעה. "אתה כבר לא כאן?" הוא שואל באימון, ולא מחכה לתשובה.',
            effects: { transferChance: 0.15, coachTrust: -7, agentAdvice: 'followed' },
          },
        ],
      },
      {
        id: 'refuse',
        risk: 'safe',
        label: 'לא עכשיו. יש לך עבודה כאן',
        outcomes: [
          {
            id: 'grounded',
            baseWeight: 75,
            tone: 'neutral',
            preview: 'הסוכן יתאכזב, המאמן יעריך - השקט יישאר',
            text: 'הוא לא מרוצה, אבל הוא רושם לעצמו. אתה חוזר לאימונים עם ראש שקט, וזה שווה משהו.',
            effects: { agentRelationship: -6, agentAdvice: 'rejected', coachTrust: 3 },
          },
          {
            id: 'told_you_so',
            baseWeight: 25,
            tone: 'neutral',
            preview: 'הוא יזכיר לך את זה בהמשך - סוכנים לא שוכחים',
            text: '"בסדר. רק תזכור שאמרתי." סוכנים לא שוכחים שיחות כאלה, וגם אתה לא.',
            effects: { agentRelationship: -9, agentAdvice: 'rejected' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_recommends_staying',
    kicker: 'שיחה בארבע עיניים',
    title: 'הסוכן שלך מציע דווקא להישאר',
    description:
      'דווקא כשקשה, הוא רגוע. "אני יודע שאתה רוצה לברוח. אבל לברוח באמצע עונה רעה זה למכור בזול. תסיים את העונה בגדול - ואז נדבר."',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['family', 'israel_networker'],
      bands: ['senior'],
      maxForm: 45,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'trust_him',
        risk: 'balanced',
        label: 'הוא צודק. להוריד את הראש ולעבוד',
        outcomes: [
          {
            id: 'steadied',
            baseWeight: 72,
            tone: 'good',
            preview: 'ראש נקי לחצי השני - הכושר יכול לחזור',
            text: 'משהו נרגע כשההחלטה מתקבלת. אתה מפסיק לחשב מסלולים ומתחיל לשחק כדורגל.',
            effects: { form: 6, confidence: 4, agentRelationship: 6, agentAdvice: 'followed' },
          },
          {
            id: 'still_stuck',
            baseWeight: 28,
            tone: 'neutral',
            preview: 'ההחלטה נכונה, אבל המגרש יחליט בעצמו',
            text: 'ההחלטה נכונה, אבל הכדורגל לא ממהר להסכים. עוד שבתות קשות לפניך.',
            effects: { agentRelationship: 4, agentAdvice: 'followed' },
          },
        ],
      },
      {
        id: 'push_anyway',
        risk: 'risky',
        label: 'להגיד לו לחפש בכל זאת',
        outcomes: [
          {
            id: 'reluctant_search',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'הוא יחפש בלי אמונה - והשוק ירגיש את זה',
            text: 'הוא יעשה מה שביקשת, אבל בלי האש הרגילה. שוק מרגיש דברים כאלה.',
            effects: { transferChance: 0.12, agentRelationship: -7, agentAdvice: 'rejected' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_finds_loan',
    kicker: 'הטלפון מצלצל',
    title: 'הסוכן מצא לך השאלה',
    description:
      '"יש מועדון שמחפש בדיוק אותך. לא זוהר - אבל תשחק שם כל שבת. בגילך, דקות זה הדבר היחיד שסופרים."',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['israel_networker', 'family'],
      bands: ['senior'],
      maxAge: 23,
      maxRoleValue: 42,
    },
    slots: ['early'],
    weight: 4,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'open_door',
        risk: 'opportunity',
        label: 'שידבר איתם. דקות זה מה שחסר',
        outcomes: [
          {
            id: 'loan_lined_up',
            baseWeight: 100,
            tone: 'good',
            preview: 'סיכוי טוב שהצעת השאלה תגיע בחלון הקרוב',
            text: 'הוא כבר קבע פגישה. אם זה ייסגר - תקבל את הדבר שאף אימון לא נותן: משחקים אמיתיים.',
            effects: { transferChance: 0.22, agentRelationship: 5, agentAdvice: 'followed' },
          },
        ],
      },
      {
        id: 'fight_here',
        risk: 'balanced',
        label: 'להישאר ולהילחם על מקום כאן',
        outcomes: [
          {
            id: 'respected',
            baseWeight: 55,
            tone: 'neutral',
            preview: 'המאמן יראה את ההחלטה - עכשיו צריך לגבות אותה באימונים',
            text: 'המאמן שומע שסירבת להשאלה ומרים גבה. עכשיו כל אימון הוא הצהרה.',
            effects: { coachTrust: 4, agentAdvice: 'rejected' },
          },
          {
            id: 'bench_continues',
            baseWeight: 45,
            tone: 'bad',
            preview: 'הספסל לא הולך לשום מקום - ואתה עלול להישאר עליו',
            text: 'עוד סבב של דקות בודדות מהספסל. ההחלטה להישאר מתחילה להרגיש כמו עיקשות.',
            effects: { confidence: -4, agentRelationship: -4, agentAdvice: 'rejected' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_europe_market_opportunity',
    kicker: 'שדות תעופה',
    title: 'הסוכן פתח לך שוק באירופה',
    description:
      'הוא חוזר מנסיעה עם שם של מועדון ועם עובדה: "הם צפו בך פעמיים. הם רוצים פגישה." זה השוק שהוא מכיר - זה בדיוק בשביל זה בחרת בו.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      agentArchetypes: ['europe_specialist', 'super_agent'],
      bands: ['senior'],
      abroad: false,
      minAbility: 62,
      minReputation: 40,
    },
    slots: ['mid', 'late'],
    weight: 4,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'meet',
        risk: 'opportunity',
        label: 'לטוס לפגישה',
        outcomes: [
          {
            id: 'market_open',
            baseWeight: 78,
            tone: 'good',
            preview: 'השם שלך ייכנס לרשימות בשוק שהסוכן מכיר',
            text: 'הפגישה טובה. שום דבר לא נחתם, אבל השם שלך עכשיו ברשימה שסקאוטים באמת קוראים.',
            effects: {
              transferChance: 0.22,
              reputation: 3,
              agentRelationship: 7,
              agentAdvice: 'followed',
              remember: 'agent_opened_market',
            },
          },
          {
            id: 'not_ready',
            baseWeight: 22,
            tone: 'neutral',
            preview: 'הם יגידו "עוד שנה" - וזה גם מידע',
            text: '"עוד שנה," הם אומרים בנימוס. הסוכן לא מתרגש: "עכשיו הם מכירים אותך. זאת הייתה המטרה."',
            effects: { agentRelationship: 3, agentAdvice: 'followed' },
          },
        ],
      },
      {
        id: 'decline_meet',
        risk: 'safe',
        label: 'הראש שלך כאן עכשיו',
        outcomes: [
          {
            id: 'window_noted',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'ההזדמנות לא תחכה לנצח - אבל הריכוז יישאר שלם',
            text: 'הוא שותק שנייה ארוכה בטלפון. "בסדר. אבל שוקים לא מחכים." אתה חוזר להתרכז בעונה.',
            effects: { agentRelationship: -6, agentAdvice: 'rejected', form: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_conflict',
    kicker: 'טונים עולים',
    title: 'משבר עם הסוכן',
    description:
      'זה מתפוצץ על משהו קטן, כמו תמיד. שיחה שלא חזרה, ציטוט בתקשורת, הרגשה שאתה עוד שם ברשימה. "אם אני לא מספיק טוב בשבילך," הוא אומר, "תגיד את זה עכשיו."',
    category: 'people',
    conditions: { requiresAgent: true, maxAgentRelationship: 45, bands: ['senior'] },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'clear_air',
        risk: 'balanced',
        label: 'לשבת ולדבר את זה עד הסוף',
        outcomes: [
          {
            id: 'mended',
            baseWeight: 62,
            tone: 'good',
            preview: 'שיחה קשה אחת יכולה להציל שנים של קשר',
            text: 'שעתיים בבית קפה, בלי טלפונים. בסוף שניכם עייפים ומחויכים. הקשר יוצא מזה חזק יותר.',
            effects: { agentRelationship: 14 },
          },
          {
            id: 'papered_over',
            baseWeight: 38,
            tone: 'neutral',
            preview: 'אפשר גם רק להדביק את הסדק - זה יחזיק זמן מה',
            text: 'מדברים, מתנצלים, לוחצים ידיים. הסדק עדיין שם, רק מכוסה. בינתיים זה מספיק.',
            effects: { agentRelationship: 6 },
          },
        ],
      },
      {
        id: 'harden',
        label: 'אתה עובד בשבילי. לא ההפך',
        risk: 'risky',
        outcomes: [
          {
            id: 'respect_won',
            baseWeight: 40,
            tone: 'good',
            preview: 'יש סוכנים שמכבדים גבול ברור',
            text: 'הוא שותק, ואז מהנהן לאט. יש אנשים שמכבדים דלת שנטרקת. מסתבר שהוא אחד מהם.',
            effects: { agentRelationship: 8, confidence: 3 },
          },
          {
            id: 'rift_deepens',
            baseWeight: 60,
            tone: 'bad',
            preview: 'או שהקרע יעמיק - וייצוג עם קרע זה ייצוג חצי',
            text: 'השיחה מסתיימת בקור. הוא עדיין הסוכן שלך על הנייר. רק על הנייר.',
            effects: { agentRelationship: -12, pressure: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_loyalty_moment',
    kicker: 'הצעה שאי אפשר לסרב לה?',
    title: 'סוכן־על רוצה אותך',
    description:
      'משרד עם שם שמכירים בכל אירופה מציע לקחת אותך. הסוכן שלך יודע - מישהו דאג שיידע. הוא לא אומר כלום, וזה הכי רועש שהוא היה אי פעם.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      minAgentRelationship: 60,
      minReputation: 62,
      bands: ['senior'],
    },
    slots: ['early', 'mid'],
    weight: 3,
    oncePerCareer: true,
    choices: [
      {
        id: 'stay_loyal',
        risk: 'safe',
        label: 'להישאר עם מי שהיה שם מההתחלה',
        outcomes: [
          {
            id: 'loyalty',
            baseWeight: 100,
            tone: 'good',
            preview: 'נאמנות היא גם מסלול קריירה - והקשר יהפוך לברזל',
            text: 'אתה מתקשר אליו בערב ואומר משפט אחד. הוא שקט רגע ארוך. מהיום הוא ילך בשבילך דרך קיר.',
            effects: {
              agentRelationship: 18,
              remember: 'rejected_elite_agent',
              milestone: { id: 'stayed_loyal_agent', icon: '🤝', text: 'סירבת לסוכן־על ונשארת נאמן', major: false },
            },
          },
        ],
      },
      {
        id: 'go_elite',
        risk: 'opportunity',
        label: 'לעבור למשרד הגדול',
        outcomes: [
          {
            id: 'new_level',
            baseWeight: 70,
            tone: 'good',
            preview: 'שוק רחב יותר, לחץ גדול יותר - קריירה במסלול אחר',
            text: 'החתימה לוקחת חמש דקות. הטלפון הראשון מגיע אחרי שעה, ממדינה שלישית. ברוך הבא לליגה של הגדולים.',
            effects: { signAgent: 'super_agent', reputation: 3 },
          },
          {
            id: 'small_fish',
            baseWeight: 30,
            tone: 'neutral',
            preview: 'או שתגלה שאתה שם קטן ברשימה גדולה',
            text: 'החודשיים הראשונים מלמדים אותך מה זה להיות שם קטן ברשימה גדולה. מתישהו זה ישתלם. כנראה.',
            effects: { signAgent: 'super_agent', confidence: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_fire_agent',
    kicker: 'סוף הדרך?',
    title: 'להחליף ייצוג',
    description:
      'הקשר עם הסוכן שלך כבר תקופה מרגיש כמו נישואים שנגמרו. שיחות קצרות, הבטחות דהויות. סוכן אחר, ענייני ומחובר, רומז שהוא זמין.',
    category: 'people',
    conditions: { requiresAgent: true, maxAgentRelationship: 32, bands: ['senior'] },
    slots: ['early'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'switch',
        risk: 'opportunity',
        label: 'לסיים בכבוד ולעבור',
        outcomes: [
          {
            id: 'fresh_rep',
            baseWeight: 100,
            tone: 'good',
            preview: 'ייצוג חדש וענייני - קשרים ישנים ילכו לאיבוד, חדשים ייפתחו',
            text: 'השיחה קצרה ומכובדת, כמו שסיומים צריכים להיות. למחרת בבוקר מישהו חדש כבר עובד בשבילך.',
            effects: { signAgent: 'israel_networker' },
          },
        ],
      },
      {
        id: 'one_more_chance',
        risk: 'balanced',
        label: 'לתת לקשר עוד הזדמנות',
        outcomes: [
          {
            id: 'rekindled',
            baseWeight: 45,
            tone: 'good',
            preview: 'לפעמים שיחה אחת כנה מחזירה סוכן לחיים',
            text: 'משהו בשיחה מעיר אותו. בשבוע שאחריה הוא עובד כמו בימים הראשונים.',
            effects: { agentRelationship: 12 },
          },
          {
            id: 'same_old',
            baseWeight: 55,
            tone: 'bad',
            preview: 'או שכלום לא ישתנה - ורק בזבזת חצי שנה',
            text: 'שבועיים של מאמץ, ואז הכול חוזר לקדמותו. נתת הזדמנות. היא לא נוצלה.',
            effects: { agentRelationship: -5 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_encourages_return',
    kicker: 'שיחה מהלב',
    title: 'הסוכן מדבר איתך על הביתה',
    description:
      '"תקשיב, אני יודע מה נשאר לך שם," הוא אומר. "שאלו עליך. לא רשמי, אבל שאלו. תגיד לי אם לפתוח את הדלת הזאת - או שהיא נשארת סגורה."',
    category: 'people',
    conditions: {
      requiresAgent: true,
      clubScope: 'formerMaccabi',
      bands: ['senior'],
      minMaccabism: 45,
    },
    slots: ['mid', 'late'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'open_it',
        risk: 'opportunity',
        label: 'תפתח אותה. הלב יודע איפה הוא',
        outcomes: [
          {
            id: 'door_opening',
            baseWeight: 100,
            tone: 'good',
            preview: 'הסוכן יבדוק את הדרך חזרה - בזהירות, בלי כותרות',
            text: 'הוא מהנהן כאילו ידע את התשובה לפני שנשאלה השאלה. "אני אבדוק בשקט. בלי עיתונים." משהו בך כבר אורז.',
            maccabiRelevance: 'return',
            effects: { maccabism: 3, transferChance: 0.2, agentAdvice: 'followed' },
          },
        ],
      },
      {
        id: 'keep_closed',
        risk: 'safe',
        label: 'לא עכשיו. יש עבודה כאן',
        outcomes: [
          {
            id: 'stays_closed',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'הדלת תישאר סגורה - הקריירה כאן תקבל את מלוא הראש',
            text: '"בסדר גמור," הוא אומר, בלי שיפוט. אתה חוזר לענייני היום. הבית יחכה, או שלא.',
            effects: { agentAdvice: 'rejected', form: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_agent_market_reality',
    kicker: 'שיחה של מבוגרים',
    title: 'הסוכן מדבר איתך בכנות',
    description:
      'הוא מגיע בלי חדשות טובות ולא מנסה לייפות. "הטלפונים השתנו. פעם שאלו כמה, עכשיו שואלים בן כמה. אני איתך עד הסוף - אבל בוא נתכנן אותו נכון."',
    category: 'people',
    conditions: { requiresAgent: true, minAge: 31, bands: ['senior'] },
    slots: ['early'],
    weight: 3,
    oncePerCareer: true,
    choices: [
      {
        id: 'plan_together',
        risk: 'balanced',
        label: 'לתכנן יחד את השנים שנשארו',
        outcomes: [
          {
            id: 'clear_eyed',
            baseWeight: 100,
            tone: 'good',
            preview: 'תוכנית אמיתית לסוף קריירה - פחות אשליות, יותר שליטה',
            text: 'אתם יושבים שעה וסוגרים תמונה: מה מחפשים, על מה מוותרים, מתי מפסיקים. יציאה מחדר כזה היא הקלה.',
            effects: { agentRelationship: 8, confidence: 4, pressure: -4 },
          },
        ],
      },
      {
        id: 'not_done_yet',
        risk: 'risky',
        label: 'אתה עוד לא זקן. שיעבוד',
        outcomes: [
          {
            id: 'defiance_works',
            baseWeight: 45,
            tone: 'good',
            preview: 'עקשנות של ותיקים מנצחת לפעמים את לוח השנה',
            text: 'הוא מחייך למרות הכול. "בסדר. נשחק עוד." העקשנות שלך תמיד הייתה חלק מהסחורה.',
            effects: { form: 4, confidence: 4, agentRelationship: 3 },
          },
          {
            id: 'calendar_wins',
            baseWeight: 55,
            tone: 'neutral',
            preview: 'ולפעמים לוח השנה פשוט צודק',
            text: 'הוא עושה מה שביקשת. השוק עונה במה שהשוק עונה. לוח השנה לא מנהל משא ומתן.',
            effects: { pressure: 3 },
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  /* MANAGERS                                                          */
  /* ================================================================ */

  {
    id: 'ppl_mgr_youth_chance',
    kicker: 'אחרי אימון הבוקר',
    title: 'המאמן רואה אותך',
    description:
      'הוא עוצר אותך במסדרון. "אני יודע בן כמה אתה, ולא אכפת לי. מי שטוב - משחק. תהיה מוכן בשבת." זה מאמן שבנה את השם שלו על צעירים. עכשיו תורך.',
    category: 'people',
    conditions: {
      managerArchetypes: ['youth_believer'],
      maxAge: 20,
      requiresProfessionalFootball: true,
      minCoachTrust: 35,
    },
    slots: ['early', 'mid'],
    weight: 5,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'seize',
        risk: 'opportunity',
        label: 'להיות מוכן. יותר ממוכן',
        outcomes: [
          {
            id: 'took_chance',
            baseWeight: 66,
            tone: 'good',
            preview: 'ההזדמנות אמיתית - מי שתופס אותה נכנס לתוכניות',
            text: 'שבת. אתה על הדשא מהדקה הראשונה, והרגליים לא רועדות. אחרי המשחק הוא רק טופח לך על הכתף - וזה שווה נאום שלם.',
            effects: { minutesModifier: 1.18, coachTrust: 8, confidence: 6, roleValue: 6 },
            modifiers: [{ attribute: 'ability', above: 60, multiplier: 1.4 }],
          },
          {
            id: 'not_yet',
            baseWeight: 34,
            tone: 'neutral',
            preview: 'וגם אם לא ילך בשבת - האמון לא נעלם אצל מאמן כזה',
            text: 'המשחק גדול עליך הפעם, וזה נראה. אבל מאמן כזה לא קובר ילד על שבת אחת. "עוד יבוא," הוא אומר. והוא מתכוון.',
            effects: { confidence: -2, coachTrust: 2 },
          },
        ],
      },
      {
        id: 'nerves',
        risk: 'safe',
        label: 'לבקש עוד זמן להתכונן',
        outcomes: [
          {
            id: 'honest_delay',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'כנות על מוכנות נרשמת - ההזדמנות תידחה, לא תבוטל',
            text: '"בסדר," הוא אומר לאט. "אני מעריך שאמרת." ההזדמנות נדחית. אצל מאמן כזה היא לא מתה - אבל היא רשומה.',
            effects: { coachTrust: -2, pressure: -4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_prove_it',
    kicker: 'שיחה במשרד',
    title: 'אצלו קונים אמון במזומן',
    description:
      'המאמן מסתכל עליך מעל הדוחות. "אני לא בונה על הבטחות של ילדים. אני בונה על מה שאני רואה שלושה חודשים ברצף. תראה לי - ותקבל הכול."',
    category: 'people',
    conditions: {
      managerArchetypes: ['conservative'],
      maxCoachTrust: 55,
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    weight: 4,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'grind',
        risk: 'balanced',
        label: 'שלושה חודשים? יהיו לו שישה',
        outcomes: [
          {
            id: 'earned',
            baseWeight: 60,
            tone: 'good',
            preview: 'עבודה עקבית היא המטבע היחיד שהוא סופר',
            text: 'אתה ראשון להגיע ואחרון לצאת, שבוע אחרי שבוע. הוא לא אומר כלום - עד היום שבו השם שלך פשוט מופיע בהרכב.',
            effects: { coachTrust: 9, discipline: 5, form: 3 },
            traitModifiers: [{ trait: 'hard_worker', multiplier: 1.5 }],
          },
          {
            id: 'slow_burn',
            baseWeight: 40,
            tone: 'neutral',
            preview: 'אצל שמרן גם עבודה טובה מבשילה לאט',
            text: 'אתה עושה הכול נכון, והשעון שלו עדיין מטרטר לאט. סבלנות. אצלו הכול מגיע באיחור - כולל הכבוד.',
            effects: { coachTrust: 4, discipline: 3 },
          },
        ],
      },
      {
        id: 'chafe',
        label: 'להגיד לו שכישרון לא מחכה בתור',
        risk: 'risky',
        outcomes: [
          {
            id: 'respect_spark',
            baseWeight: 30,
            tone: 'good',
            preview: 'יש שמרנים שמכבדים חוצפה מגובה ביכולת',
            text: 'הוא מרים גבה, ובפעם הראשונה מסתכל עליך באמת. "מחר תוכיח את המשפט הזה באימון." אתה מוכיח.',
            effects: { coachTrust: 6, confidence: 5 },
          },
          {
            id: 'back_of_line',
            baseWeight: 70,
            tone: 'bad',
            preview: 'ורובם שולחים חצוף לסוף התור',
            text: '"עוד אחד שממהר." הוא חוזר לדוחות. התור שלך התארך עכשיו, לא התקצר.',
            effects: { coachTrust: -6, discipline: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_discipline_demand',
    kicker: 'לוח טקטי',
    title: 'המשבצת לפני הכישרון',
    description:
      'עשרים דקות של וידאו על הפוזיציה שלך בלבד. "אתה עוזב את המשבצת שלוש פעמים בכל מחזור," המאמן אומר. "הכישרון שלך שווה למשבצת רק כשאתה בתוכה."',
    category: 'people',
    conditions: {
      managerArchetypes: ['disciplinarian'],
      requiresProfessionalFootball: true,
      minLastAppearances: 5,
    },
    slots: ['mid'],
    weight: 4,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'comply',
        risk: 'safe',
        label: 'לקבל את המסגרת. לשחק בתוכה',
        outcomes: [
          {
            id: 'structure_pays',
            baseWeight: 68,
            tone: 'good',
            preview: 'משמעת אצל מאמן כזה מתורגמת ישירות לדקות',
            text: 'אתה נשאר במשבצת, והמשחק פתאום פשוט יותר. הוא רואה. אצלו זה כל מה שצריך לראות.',
            effects: { coachTrust: 8, discipline: 6, roleValue: 4 },
          },
          {
            id: 'flair_dimmed',
            baseWeight: 32,
            tone: 'neutral',
            preview: 'אבל משהו מהחופש שלך יישאר מחוץ למגרש',
            text: 'המשבצת מסודרת, והקהל קצת פחות קם מהכיסא. עסקה היא עסקה - ויתרת בה על משהו.',
            effects: { coachTrust: 6, discipline: 4, confidence: -3 },
          },
        ],
      },
      {
        id: 'freedom',
        label: 'לשחק את המשחק שלך',
        risk: 'risky',
        outcomes: [
          {
            id: 'undeniable',
            baseWeight: 35,
            tone: 'good',
            preview: 'אפשר לנצח ויכוח טקטי - עם שער וגם בישול',
            text: 'אתה עוזב את המשבצת, כובש ומבשל. אחרי המשחק הוא רק אומר: "בסדר. המשבצת שלך גדולה יותר משחשבתי."',
            effects: { confidence: 7, reputation: 4, roleValue: 5 },
            modifiers: [{ attribute: 'ability', above: 72, multiplier: 1.6 }],
          },
          {
            id: 'benched_for_it',
            baseWeight: 65,
            tone: 'bad',
            preview: 'אצל קפדן, חריגה בלי תוצאה קונה ספסל',
            text: 'הפעם זה לא מסתדר, ואצל מאמן כזה חריגה בלי תוצאה היא החלטה. שבת הבאה אתה מתחיל מהספסל.',
            effects: { coachTrust: -8, minutesModifier: 0.85, pressure: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_rotation_talk',
    kicker: 'תחילת שבוע',
    title: 'אצלו כולם משחקים',
    description:
      'המאמן מסביר את השיטה למי שרק הגיע: "אף אחד לא משחק שישים משחקים אצלי, ואף אחד לא יושב חודשיים. תהיה מוכן כשקוראים לך - וקוראים לכולם."',
    category: 'people',
    conditions: {
      managerArchetypes: ['rotation'],
      requiresProfessionalFootball: true,
      maxRoleValue: 55,
    },
    slots: ['early'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'embrace',
        risk: 'balanced',
        label: 'שיטה כזאת היא הזדמנות. לנצל כל דקה',
        outcomes: [
          {
            id: 'every_minute',
            baseWeight: 70,
            tone: 'good',
            preview: 'מי שמנצל את הדקות של הרוטציה - קונה מקום',
            text: 'אתה נכנס בכל פעם כאילו זה הסיכוי האחרון, כי אצלו זה גם ככה. אחרי חודש הדקות שלך כבר לא נראות כמו רוטציה.',
            effects: { minutesModifier: 1.1, coachTrust: 6, form: 4 },
          },
          {
            id: 'carousel',
            baseWeight: 30,
            tone: 'neutral',
            preview: 'או שהקרוסלה תמשיך להסתובב - כניסות טובות ובלי קביעות',
            text: 'אתה נכנס טוב, יוצא, מחכה, נכנס שוב. הקרוסלה מסתובבת לכולם. לפחות היא מסתובבת.',
            effects: { form: 2 },
          },
        ],
      },
      {
        id: 'want_permanence',
        risk: 'safe',
        label: 'לבקש ממנו הגדרה קבועה',
        outcomes: [
          {
            id: 'no_promises',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'הוא לא מבטיח קביעות לאף אחד - לפחות תדע את זה בבירור',
            text: '"אין אצלי קבועים. יש אצלי מוכנים." לפחות עכשיו אתה יודע בדיוק איפה אתה חי.',
            effects: { pressure: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_star_pref',
    kicker: 'הרכב על הלוח',
    title: 'שמות לפני רגליים',
    description:
      'ההרכב מתפרסם, ואתה שוב בחוץ. מי שנכנס במקומך הביא איתו שם גדול ועונה חלשה. אצל המאמן הזה, קורות חיים משחקות. לרגליים צריך לחכות בסבלנות.',
    category: 'people',
    conditions: {
      managerArchetypes: ['star_driven'],
      maxReputation: 55,
      requiresProfessionalFootball: true,
      minAbility: 55,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'outplay',
        risk: 'balanced',
        label: 'אין ויכוח עם שמות. יש ויכוח עם מספרים',
        outcomes: [
          {
            id: 'numbers_talk',
            baseWeight: 55,
            tone: 'good',
            preview: 'מספרים טובים בדקות קצרות - הטיעון היחיד שעובד עליו',
            text: 'אתה הופך כל כניסה מהספסל להצהרה. אחרי שלושה משחקים גם מאמן של שמות לא יכול להתעלם מהמספרים.',
            effects: { roleValue: 6, coachTrust: 6, reputation: 4, form: 3 },
          },
          {
            id: 'ceiling_holds',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'התקרה של אלמוני אצל מאמן כזה גבוהה וקשה',
            text: 'אתה עושה הכול נכון, והשם הגדול עדיין מתחיל. יש תקרות שרק זמן או פציעה מזיזות.',
            effects: { form: 2, pressure: 3 },
          },
        ],
      },
      {
        id: 'frustration',
        risk: 'safe',
        label: 'לפרוק את התסכול אצל הסוכן',
        outcomes: [
          {
            id: 'vented',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'פריקה בטלפון עדיפה על פריקה בתקשורת',
            text: 'חצי שעה של תסכול לתוך הטלפון. הסוכן מקשיב, ואז: "גמרת? יופי. עכשיו תחזור לעבוד." בדיוק מה שהיית צריך.',
            effects: { pressure: -5, confidence: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_short_fuse_blowup',
    kicker: 'חדר הלבשה, מחצית',
    title: 'הפתיל הקצר נדלק',
    description:
      'המחצית גרועה והמאמן מתפוצץ - עליך, ספציפית, מול כולם. אצלו הסערות באות מהר והולכות מהר. השאלה היא רק מה אתה עושה בתוך הסערה.',
    category: 'people',
    conditions: {
      managerArchetypes: ['short_fuse'],
      requiresProfessionalFootball: true,
      maxForm: 55,
      requiresAppearance: true,
    },
    slots: ['mid'],
    weight: 4,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'answer_on_pitch',
        risk: 'balanced',
        label: 'לבלוע, ולענות במחצית השנייה',
        outcomes: [
          {
            id: 'stormed_back',
            baseWeight: 55,
            tone: 'good',
            preview: 'אצל פתיל קצר, תגובה במגרש קונה אותו מחדש באותו ערב',
            text: 'אתה יוצא למחצית השנייה עם אש בעיניים ומשנה את המשחק. בסוף הוא מחבק אותך כאילו לא צעק. אצלו זה באמת ככה.',
            effects: { coachTrust: 9, form: 5, confidence: 5 },
            traitModifiers: [{ trait: 'big_game', multiplier: 1.4 }],
          },
          {
            id: 'swallowed_hard',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'גם בליעה בכבוד נרשמת - הסערה תעבור',
            text: 'המחצית השנייה בינונית, אבל התנהגת כמו מקצוען כשצעקו עליך מול כולם. גם את זה רואים.',
            effects: { discipline: 4, pressure: 3 },
          },
        ],
      },
      {
        id: 'answer_back',
        label: 'לענות לו. יש גבול',
        risk: 'risky',
        outcomes: [
          {
            id: 'cleared_air_hot',
            baseWeight: 35,
            tone: 'good',
            preview: 'שני פתילים קצרים מתפוצצים - ולפעמים נגמרים בכבוד',
            text: 'עשר שניות של צעקות הדדיות, ואז שקט משונה - וכבוד חדש. יש מאמנים שאוהבים מי שלא נשבר מולם.',
            effects: { coachTrust: 5, confidence: 5, leadership: 3 },
          },
          {
            id: 'war_declared',
            baseWeight: 65,
            tone: 'bad',
            preview: 'ולפעמים זאת הכרזת מלחמה בבית שלו',
            text: 'צעקת על פתיל קצר בבית שלו. השבועות הקרובים יהיו קרים מאוד, והדקות שלך קצרות מאוד.',
            effects: { coachTrust: -10, minutesModifier: 0.85, remember: 'coach_conflict' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_lost_patience',
    kicker: 'ההרכב בלעדיך',
    title: 'המאמן איבד סבלנות',
    description:
      'שלושה משחקים ברצף מחוץ להרכב, והפעם בלי הסבר. השתיקה שלו אומרת את מה שהוא לא אומר: תורך לשכנע אותו מחדש, או להפסיק לחכות.',
    category: 'people',
    conditions: {
      requiresProfessionalFootball: true,
      maxCoachTrust: 42,
      maxRoleValue: 45,
      minAge: 19,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'training_answer',
        risk: 'balanced',
        label: 'לענות לו במגרש האימונים',
        outcomes: [
          {
            id: 'won_back',
            baseWeight: 52,
            tone: 'good',
            preview: 'שבועיים של אימונים בוערים יכולים לפתוח דלת מחדש',
            text: 'שבועיים שבהם אי אפשר להתעלם ממך באימונים. הוא לא מתנצל - הוא פשוט מחזיר אותך להרכב. זה מספיק.',
            effects: { coachTrust: 8, roleValue: 5, form: 4 },
            traitModifiers: [{ trait: 'hard_worker', multiplier: 1.5 }],
          },
          {
            id: 'door_stays_shut',
            baseWeight: 48,
            tone: 'bad',
            preview: 'ולפעמים הדלת כבר סגורה מבפנים',
            text: 'אתה בוער באימונים והדלת נשארת סגורה. יש מסקנות שמאמן מסיק פעם אחת ולא פותח מחדש.',
            effects: { confidence: -5, transferChance: 0.15 },
          },
        ],
      },
      {
        id: 'agent_call',
        risk: 'opportunity',
        label: 'להרים טלפון לסוכן',
        outcomes: [
          {
            id: 'exit_prepared',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'שיחה אחת - והשוק יתחיל לדעת שאתה זמין',
            text: 'הסוכן לא מופתע. "חיכיתי לטלפון הזה." מהרגע הזה, מישהו בחוץ עובד על תוכנית ב׳.',
            effects: { transferChance: 0.18, agentRelationship: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_earned_trust',
    kicker: 'מסיבת עיתונאים',
    title: 'המאמן מגבה אותך בקול',
    description:
      'שאלה עוקצנית על הטעות שלך מהמחזור שעבר, והמאמן חותך את העיתונאי באמצע: "על השחקן הזה אני לא מקבל שאלות כאלה. הוא ההווה וגם העתיד." מול כולם.',
    category: 'people',
    conditions: {
      requiresProfessionalFootball: true,
      minCoachTrust: 62,
      minForm: 52,
      requiresAppearance: true,
    },
    slots: ['mid', 'late'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'repay',
        risk: 'balanced',
        label: 'גיבוי כזה מחזירים במגרש',
        outcomes: [
          {
            id: 'repaid',
            baseWeight: 74,
            tone: 'good',
            preview: 'גב של מאמן משחרר רגליים - השבתות הקרובות יראו את זה',
            text: 'כשמישהו עומד מאחוריך ככה, הרגליים משוחררות. השבתות הבאות הן מהטובות של העונה שלך.',
            effects: {
              confidence: 7,
              form: 5,
              coachTrust: 4,
              remember: 'manager_showed_faith',
            },
          },
          {
            id: 'pressure_of_faith',
            baseWeight: 26,
            tone: 'neutral',
            preview: 'אמון פומבי הוא גם משקל - לא כולם נושאים אותו מיד',
            text: 'פתאום כל טעות שלך היא גם הטעות שלו, וזה משקל חדש על הכתפיים. ייקח רגע להתרגל אליו.',
            effects: { pressure: 5, coachTrust: 3, remember: 'manager_showed_faith' },
          },
        ],
      },
      {
        id: 'deflect',
        risk: 'safe',
        label: 'להצניע. מילים הן רק מילים',
        outcomes: [
          {
            id: 'kept_small',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'להשאיר את הרעש בחוץ - גם גיבוי פומבי לא משנה את העבודה',
            text: 'אתה מרים כתף בשאלה על זה. "המאמן אמר, אני עובד." יש שקט שמגן על שגרה - ויש בו גם קצת בזבוז של רגע.',
            effects: { pressure: -3, remember: 'manager_showed_faith' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_new_arrival',
    kicker: 'יום ראשון, מגרש האימונים',
    title: 'דף חדש',
    description:
      'מאמן חדש עומד במרכז המגרש ולומד שמות. כל מה שבנית עם הקודם - לטוב ולרע - נשאר עם הקודם. שישים דקות מהאימון הראשון הוא כבר מסתכל לכיוון שלך.',
    category: 'people',
    conditions: { newManagerThisSeason: true, requiresProfessionalFootball: true },
    slots: ['early'],
    weight: 7,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'first_impression',
        risk: 'opportunity',
        label: 'אין הזדמנות שנייה לרושם ראשון',
        outcomes: [
          {
            id: 'impressed',
            baseWeight: 60,
            tone: 'good',
            preview: 'שבוע ראשון חזק אצל מאמן חדש שווה חצי עונה אצל הקודם',
            text: 'אתה נותן שבוע ראשון שאי אפשר לפספס. בדף החדש שלו, השורה הראשונה עליך כבר חיובית.',
            effects: { coachTrust: 8, form: 3, remember: 'new_manager_page' },
          },
          {
            id: 'lost_in_crowd',
            baseWeight: 40,
            tone: 'neutral',
            preview: 'או שתיבלע בהמון - לכולם יש מה להוכיח השבוע',
            text: 'כולם רצים השבוע כאילו זה גמר. בתוך עשרים וחמישה שחקנים רעבים, קשה לבלוט. הדף שלך עוד ריק.',
            effects: { remember: 'new_manager_page' },
          },
        ],
      },
      {
        id: 'wait_and_see',
        risk: 'safe',
        label: 'לתת לו לבוא אליך',
        outcomes: [
          {
            id: 'quiet_read',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'סבלנות היא גם אמירה - אבל דפים חדשים לא נכתבים לבד',
            text: 'אתה עובד רגיל ונותן לו לגלות אותך בקצב שלו. יש בזה ביטחון - ויש בזה הימור.',
            effects: { pressure: -3, remember: 'new_manager_page' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_promise',
    kicker: 'שיחה במשרד',
    title: 'המאמן מבטיח לך הזדמנות',
    description:
      'הוא קורא לך אחרי אימון טוב. "אני רואה מה אתה עושה פה כל בוקר. במחזורים הקרובים תקבל את ההזדמנות שלך. תהיה מוכן - כי אני לא נותן אותה פעמיים."',
    category: 'people',
    conditions: {
      requiresProfessionalFootball: true,
      maxRoleValue: 48,
      minCoachTrust: 48,
      minForm: 50,
    },
    slots: ['early', 'mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'ready',
        risk: 'balanced',
        label: 'להיות מוכן כשזה יגיע',
        outcomes: [
          {
            id: 'delivered',
            baseWeight: 58,
            tone: 'good',
            preview: 'הבטחה של מאמן + מוכנות שלך = דלת שנפתחת באמת',
            text: 'ההזדמנות מגיעה בדיוק כמו שהובטח, ואתה תופס אותה בשתי ידיים. ככה נבנה מקום בהרכב.',
            effects: { minutesModifier: 1.12, roleValue: 6, coachTrust: 5, confidence: 4 },
          },
          {
            id: 'moment_slipped',
            baseWeight: 42,
            tone: 'bad',
            preview: 'הזדמנות אחת היא גם רק הזדמנות אחת',
            text: 'ההזדמנות מגיעה - ומחליקה בין האצבעות. הוא אמר שהוא לא נותן פעמיים, ואתה מגלה שהוא התכוון.',
            effects: { confidence: -5, coachTrust: -3, pressure: 4 },
          },
        ],
      },
      {
        id: 'promise_pressure',
        risk: 'risky',
        label: 'לבקש ממנו בדיוק: מתי, ובאיזה תפקיד',
        outcomes: [
          {
            id: 'pinned_down',
            baseWeight: 45,
            tone: 'good',
            preview: 'הבטחה עם תאריך שווה יותר מהבטחה עם חיוך',
            text: 'הוא מופתע מהישירות - ועונה. "מחזור תשע, בתפקיד שלך." הבטחה עם תאריך היא חוזה. עכשיו יש לך אחד.',
            effects: { coachTrust: 3, confidence: 3, pressure: 3 },
          },
          {
            id: 'pushed_too_hard',
            baseWeight: 55,
            tone: 'neutral',
            preview: 'או שהדחיפה תריח כמו חוסר סבלנות',
            text: '"כשתהיה מוכן," הוא עונה קצר, והשיחה נגמרת קר יותר משהתחילה. יש שאלות ששואלים ברגליים.',
            effects: { coachTrust: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_wants_loan',
    kicker: 'שיחה לא פשוטה',
    title: 'המאמן חושב שהשאלה תעשה לך טוב',
    description:
      '"אני לא יכול להבטיח לך פה את הדקות שאתה צריך השנה," הוא אומר, בלי לייפות. "יש מועדון שישמח לקחת אותך לעונה. תחשוב על זה ברצינות - זה בשבילך, לא נגדך."',
    category: 'people',
    conditions: {
      managerArchetypes: ['conservative', 'star_driven', 'short_fuse'],
      maxAge: 23,
      maxRoleValue: 40,
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'consider',
        risk: 'balanced',
        label: 'הוא כנראה צודק. שיבדקו',
        outcomes: [
          {
            id: 'loan_path',
            baseWeight: 100,
            tone: 'good',
            preview: 'הדלת להשאלה תיפתח - ומי שחוזר מהשאלה טובה חוזר אחר',
            text: 'ההיגיון קשה לעיכול ונכון. אתה מאשר לבדוק, והמנגנון מתחיל לעבוד. שנה של משחקים יכולה לשנות הכול.',
            effects: { transferChance: 0.2, coachTrust: 4 },
          },
        ],
      },
      {
        id: 'refuse_loan',
        label: 'להישאר ולהילחם דווקא כאן',
        risk: 'risky',
        outcomes: [
          {
            id: 'fought_through',
            baseWeight: 38,
            tone: 'good',
            preview: 'סירוב + עבודה משוגעת יכולים לשכתב את התוכנית שלו',
            text: 'אתה נשאר, ועובד כאילו כל אימון הוא ערעור על ההחלטה שלו. עד החורף - הערעור מתקבל.',
            effects: { coachTrust: 6, roleValue: 5, form: 3 },
          },
          {
            id: 'year_on_bench',
            baseWeight: 62,
            tone: 'bad',
            preview: 'או שהתחזית שלו פשוט תתגשם - שנה על הספסל',
            text: 'הוא אמר שאין דקות, והוא ידע מה הוא אומר. שנה ארוכה של דקות בודדות ושבתות מהצד.',
            effects: { minutesModifier: 0.82, confidence: -5 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_blocks_loan',
    kicker: 'תשובה מפתיעה',
    title: 'המאמן חוסם את היציאה שלך',
    description:
      'ביקשת לצאת להשאלה כדי לשחק, והתשובה מגיעה מהר: לא. "אתה בתוכניות שלי יותר משאתה מבין," הוא אומר. "אני צריך אותך כאן, גם כשאתה לא מתחיל."',
    category: 'people',
    conditions: {
      managerArchetypes: ['rotation', 'youth_believer'],
      maxAge: 24,
      maxRoleValue: 45,
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'accept_role',
        risk: 'balanced',
        label: 'אם הוא צריך אותך - להיות שם',
        outcomes: [
          {
            id: 'plans_real',
            baseWeight: 64,
            tone: 'good',
            preview: '"בתוכניות" אצל מאמן כזה זה בדרך כלל אמיתי',
            text: 'מתברר שהוא התכוון. הדקות מגיעות בקצב שלו - לא מעט, ובזמנים שסופרים. היית בתוכנית באמת.',
            effects: { minutesModifier: 1.08, coachTrust: 6, roleValue: 4 },
          },
          {
            id: 'plans_vague',
            baseWeight: 36,
            tone: 'neutral',
            preview: 'ולפעמים "בתוכניות" זה בעיקר משפט יפה',
            text: 'החודשים עוברים ו"בתוכניות" מתגלה כמושג גמיש. נשארת, אבל השאלה אם צדקת עוד פתוחה.',
            effects: { pressure: 3 },
          },
        ],
      },
      {
        id: 'push_out',
        risk: 'risky',
        label: 'להתעקש על היציאה',
        outcomes: [
          {
            id: 'friction',
            baseWeight: 100,
            tone: 'bad',
            preview: 'להתעקש נגד מאמן שרוצה אותך - זה נרשם',
            text: 'ההתעקשות שלך מול מאמן שדווקא רוצה אותך משאירה טעם רע אצל שניכם. היציאה לא קורית, והטעם נשאר.',
            effects: { coachTrust: -6, agentRelationship: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_mgr_debut_callback',
    kicker: 'רגע של פרספקטיבה',
    title: 'האיש שנתן לך את הבכורה',
    description:
      'אחרי כל השנים, המאמן שרשם אותך לראשונה בהרכב בוגרים עדיין כאן לצידך. אחרי האימון הוא מסתכל עליך רגע ארוך. "ידעתי כבר אז," הוא אומר. "רק תיזהר לא לשכוח את הילד ההוא."',
    category: 'people',
    conditions: {
      managerGaveDebut: true,
      requiresProfessionalFootball: true,
      requiresMemory: ['manager_gave_debut'],
      memoryMinSeasonsAgo: 3,
    },
    slots: ['late'],
    weight: 3,
    oncePerCareer: true,
    choices: [
      {
        id: 'gratitude',
        risk: 'balanced',
        label: 'להגיד לו מה הרגע ההוא היה בשבילך',
        outcomes: [
          {
            id: 'bond_deepens',
            baseWeight: 100,
            tone: 'good',
            preview: 'קשר של שנים בין שחקן למאמן - נדיר, ושווה הכול',
            text: 'אתה אומר לו את מה שאף פעם לא נאמר. הוא מחייך את החיוך של אז. קשרים כאלה נדירים בכדורגל - ושווים הכול.',
            effects: {
              coachTrust: 8,
              leadership: 4,
              confidence: 4,
              milestone: { id: 'debut_manager_bond', icon: '🤝', text: 'סגרת מעגל עם המאמן שנתן לך את הבכורה', major: false },
            },
          },
        ],
      },
      {
        id: 'keep_professional',
        risk: 'safe',
        label: 'לשמור על זה מקצועי. העבר זה העבר',
        outcomes: [
          {
            id: 'unsaid',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'יש דברים שנשארים לא נאמרים - וזה גם בסדר',
            text: 'אתה מהנהן ואומר משהו קטן. הרגע עובר. יש מילים שמחכות שנים לצאת ולא יוצאות - והחיים ממשיכים גם ככה.',
            effects: { discipline: 2 },
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  /* PERSONAL COACHES                                                  */
  /* ================================================================ */

  {
    id: 'ppl_pc_choose_focus',
    kicker: 'החלטה על הקריירה',
    title: 'מאמן אישי - במה להשקיע?',
    description:
      'שחקן ותיק בקבוצה נשבע בשם של מאמן אישי שעבד איתו. "ההבדל בין טוב למצוין הוא עשרים דקות ביום עם מישהו שרואה מה חסר לך." יש לך את המספר. השאלה מה אתה בוחר לחזק.',
    category: 'people',
    conditions: {
      forbidsPersonalCoach: true,
      notPositions: ['GK'],
      requiresProfessionalFootball: true,
      minAge: 17,
    },
    slots: ['early'],
    weight: 4,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'technical',
        risk: 'opportunity',
        label: 'מאמן טכני - הרגל החלשה, הנגיעה הראשונה',
        outcomes: [
          {
            id: 'tech_started',
            baseWeight: 100,
            tone: 'good',
            preview: 'עבודה טכנית שבועית - שיפור איטי ואמיתי במיומנות',
            text: 'האימון הראשון צנוע: קיר, כדור, והרגל שאתה פחות אוהב. "עוד חצי שנה," הוא אומר, "לא תרגיש את ההבדל בין הרגליים."',
            effects: { startPersonalCoach: 'technical' },
          },
        ],
      },
      {
        id: 'fitness',
        risk: 'balanced',
        label: 'מאמן כושר - עונה שלמה בלי ליפול',
        outcomes: [
          {
            id: 'fit_started',
            baseWeight: 100,
            tone: 'good',
            preview: 'בסיס גופני - פחות פציעות, יותר עונה',
            text: 'הוא מודד הכול ולא מרשים אותו קלות. "הכישרון שלך שווה בדיוק כמו מספר הדקות שהגוף שלך מחזיק." מתחילים מהבסיס.',
            effects: { startPersonalCoach: 'fitness' },
          },
        ],
      },
      {
        id: 'mental',
        risk: 'balanced',
        label: 'מאמן מנטלי - הראש שמחזיק את הרגליים',
        outcomes: [
          {
            id: 'mental_started',
            baseWeight: 100,
            tone: 'good',
            preview: 'עבודה על הראש - התאוששות מהירה יותר מרגעים קשים',
            text: 'הפגישה הראשונה היא בעיקר שאלות. בסופה הוא אומר: "הרגליים שלך בסדר גמור. בוא נדבר על מה שקורה חמש שניות אחרי טעות."',
            effects: { startPersonalCoach: 'mental' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_choose_focus_gk',
    kicker: 'החלטה על הקריירה',
    title: 'שוער צריך מאמן משלו',
    description:
      'שוער ותיק אומר לך את האמת הפשוטה: "מאמן השוערים של הקבוצה מתחלק בין שלושה. מי שרוצה להיות מספר אחת - צריך מישהו שרואה רק אותו." יש שם שכולם ממליצים עליו.',
    category: 'people',
    conditions: {
      forbidsPersonalCoach: true,
      positions: ['GK'],
      requiresProfessionalFootball: true,
      minAge: 17,
    },
    slots: ['early'],
    weight: 4,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'gk_specialist',
        risk: 'opportunity',
        label: 'מאמן שוערים אישי - יציאות, רגל, אחד על אחד',
        outcomes: [
          {
            id: 'gk_started',
            baseWeight: 100,
            tone: 'good',
            preview: 'עבודה שבועית ייעודית לשוערים - המלאכה מעל הכישרון',
            text: 'האימון הראשון כולו וידאו: היציאות שלך, פריים אחרי פריים. "יש לך ידיים," הוא אומר. "בוא נבנה לך החלטות."',
            effects: { startPersonalCoach: 'goalkeeping' },
          },
        ],
      },
      {
        id: 'gk_mental',
        risk: 'balanced',
        label: 'דווקא מאמן מנטלי - שוער חי לבד עם הטעויות',
        outcomes: [
          {
            id: 'gk_mental_started',
            baseWeight: 100,
            tone: 'good',
            preview: 'הראש של שוער הוא כלי העבודה האמיתי שלו',
            text: '"שוער טועה מול עשרים אלף איש ואין לו למי למסור את הטעות," הוא אומר. "בוא נלמד לחיות שם." זה בדיוק מה שחיפשת.',
            effects: { startPersonalCoach: 'mental' },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_weakness_found',
    kicker: 'וידאו, ערב חול',
    title: 'המאמן האישי מצא משהו',
    description:
      'הוא עוצר את הסרטון ומריץ אחורה, שלוש פעמים. "הנה. אתה רואה מה אתה עושה כאן? זה חוזר אצלך כל משחק." הוא צודק. אף אחד לא שם לב לזה קודם - כולל אתה.',
    category: 'people',
    conditions: { requiresPersonalCoach: true, requiresProfessionalFootball: true },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'extra_work',
        risk: 'opportunity',
        label: 'לתקוף את החולשה - עבודה כפולה',
        outcomes: [
          {
            id: 'weakness_shrinks',
            baseWeight: 62,
            tone: 'good',
            preview: 'חודש של עבודה ממוקדת - והחולשה מתחילה להיסגר',
            text: 'חודש של אותו תרגיל, שוב ושוב, עד שהגוף לומד. במשחקים אתה כבר מרגיש את זה: המקום שהיה חור נהיה קיר.',
            effects: { ability: 1.5, confidence: 3 },
            modifiers: [{ attribute: 'age', below: 24, multiplier: 1.4 }],
          },
          {
            id: 'overload',
            baseWeight: 38,
            tone: 'neutral',
            preview: 'עבודה כפולה היא גם עומס כפול - הגוף ירגיש',
            text: 'הראש רוצה, הגוף שולח חשבון. השיפור מגיע, אבל אתה גורר רגליים כבדות לסופי השבוע.',
            effects: { ability: 0.8, injuryRisk: 5, form: -3 },
          },
        ],
      },
      {
        id: 'steady_plan',
        risk: 'safe',
        label: 'לשלב את זה בתוכנית הקיימת, בלי להגזים',
        outcomes: [
          {
            id: 'steady_gain',
            baseWeight: 100,
            tone: 'good',
            preview: 'תיקון איטי ובטוח בתוך השגרה הקיימת',
            text: 'עשר דקות בכל אימון, בלי דרמה. התיקון מגיע לאט - ובלי לשלם עליו בבריאות.',
            effects: { ability: 0.8, discipline: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_extra_session',
    kicker: 'ערב לפני משחק גדול',
    title: 'אימון נוסף לפני המשחק?',
    description:
      'משחק חשוב בשבת, והמאמן האישי מציע אימון חידוד ביום שישי. "שעה, לא יותר. רק לחדד את מה שעבדנו עליו." הגוף שלך אומר מנוחה. הראש אומר עוד קצת.',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      requiresProfessionalFootball: true,
      requiresAppearance: true,
    },
    slots: ['late'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'session',
        label: 'עוד שעה של חידוד',
        risk: 'risky',
        outcomes: [
          {
            id: 'sharp',
            baseWeight: 55,
            tone: 'good',
            preview: 'חידוד אחרון יכול להיות ההבדל ברגע האחד שיגיע',
            text: 'שעה מדויקת, בלי בזבוז. בשבת, כשהרגע שלך מגיע - הגוף כבר יודע מה לעשות. בדיוק בשביל זה עבדתם.',
            effects: { form: 5, confidence: 4 },
          },
          {
            id: 'legs_heavy',
            baseWeight: 45,
            tone: 'bad',
            preview: 'או שהשעה הזאת תשאיר את הרגליים ביום שישי',
            text: 'ההחלטה הייתה של הראש, אבל בשבת משחקות הרגליים - והן נשארו קצת ביום שישי. פחות רעננות ברגעים שסופרים.',
            effects: { form: -4, injuryRisk: 4 },
          },
        ],
      },
      {
        id: 'rest',
        risk: 'safe',
        label: 'מנוחה. העבודה כבר נעשתה',
        outcomes: [
          {
            id: 'fresh',
            baseWeight: 100,
            tone: 'good',
            preview: 'רעננות בשבת - הדבר שאף אימון נוסף לא קונה',
            text: '"החלטה של מקצוען," הוא אומר, בלי עלבון. בשבת אתה מרגיש את ההבדל: רגליים קלות, ראש שקט.',
            effects: { form: 3, injuryRisk: -2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_rest_advice',
    kicker: 'שיחה רצינית',
    title: 'המאמן האישי דורש עצירה',
    description:
      'הוא רואה את הנתונים שאף אחד אחר לא רואה. "הגוף שלך צועק, ואתה לא מקשיב. שבועיים של הורדת עומס עכשיו - או פציעה אמיתית בחורף. אני לא שואל, אני אומר."',
    category: 'people',
    conditions: { requiresPersonalCoach: true, minLastAppearances: 8, requiresProfessionalFootball: true },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'listen',
        risk: 'opportunity',
        label: 'הוא רואה מה שאתה לא. להאט',
        outcomes: [
          {
            id: 'body_saved',
            baseWeight: 100,
            tone: 'good',
            preview: 'שבועיים חכמים עכשיו במקום חודשיים בטיפולים אחר כך',
            text: 'שבועיים של עומס מדוד. משעמם, בוגר, נכון. בחורף, כשאחרים נופלים - אתה שלם.',
            effects: { injuryRisk: -8, form: 2 },
          },
        ],
      },
      {
        id: 'push_through',
        label: 'אין זמן לעצור באמצע עונה',
        risk: 'risky',
        outcomes: [
          {
            id: 'got_away',
            baseWeight: 45,
            tone: 'neutral',
            preview: 'אפשר לדחוף דרך אזהרות - לפעמים זה עובר בשלום',
            text: 'דחפת, והפעם זה החזיק. הוא שותק במבט של מי שיודע שהוזהרת. פעם הבאה אולי לא.',
            effects: { form: 2, injuryRisk: 3 },
          },
          {
            id: 'body_answers',
            baseWeight: 55,
            tone: 'bad',
            preview: 'או שהגוף יענה בעצמו - והתשובות שלו כואבות',
            text: 'שלושה שבועות אחרי, הגוף עונה בעצמו - בשריר האחורי, באמצע ריצה. הוא לא אומר "אמרתי לך". לא צריך.',
            effects: { injuryChance: 0.5, injuryRisk: 6 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_breakthrough',
    kicker: 'שנתיים של עבודה',
    title: 'פריצת הדרך',
    description:
      'זה קורה באמצע משחק רגיל: המהלך שעבדתם עליו שנתיים יוצא מהרגליים לבד, בלי מחשבה. אחרי המשחק יש לך הודעה ממנו: "ראית? עכשיו זה שלך. לתמיד."',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      minCoachSeasonsTogether: 2,
      requiresProfessionalFootball: true,
      requiresAppearance: true,
    },
    slots: ['mid', 'late'],
    weight: 3,
    oncePerCareer: true,
    choices: [
      {
        id: 'own_it',
        risk: 'balanced',
        label: 'זה של שניכם',
        outcomes: [
          {
            id: 'breakthrough',
            baseWeight: 100,
            tone: 'good',
            preview: 'שנתיים של עבודה שקטה הופכות לחלק ממך',
            text: 'אתה עונה לו: "של שנינו." יש דברים שמגיעים מהר ויש דברים שנבנים בעשרים דקות ביום, שנתיים ברצף. זה מהסוג השני.',
            effects: {
              ability: 2,
              confidence: 6,
              remember: 'personal_coach_breakthrough',
              milestone: { id: 'pc_breakthrough', icon: '📈', text: 'פריצת דרך עם המאמן האישי', major: false },
            },
            modifiers: [{ attribute: 'ability', above: 80, multiplier: 0.5 }],
          },
        ],
      },
      {
        id: 'quiet_pride',
        risk: 'safe',
        label: 'לשמור את זה בפנים. עוד יעד הושג',
        outcomes: [
          {
            id: 'onward',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'לסמן וי ולהמשיך - יש עוד עבודה',
            text: 'אתה עונה בקצרה וכבר חושב על הדבר הבא. הוא מכיר אותך מספיק כדי לא להיעלב. מחר ממשיכים לעבוד.',
            effects: {
              ability: 2,
              remember: 'personal_coach_breakthrough',
            },
            modifiers: [{ attribute: 'ability', above: 80, multiplier: 0.5 }],
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_gk_session',
    kicker: 'מגרש צדדי, שעה מוקדמת',
    title: 'בוקר של יציאות',
    description:
      'שעה לפני שכולם מגיעים, רק אתה, הוא, ומכונת הגבהות. "עשרים כדורים לרחבה. אני רוצה החלטה נכונה בכל אחד - לצאת או להישאר. לא ידיים. החלטות."',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      personalCoachSpecialties: ['goalkeeping'],
      positions: ['GK'],
      requiresProfessionalFootball: true,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'drill',
        risk: 'balanced',
        label: 'עשרים כדורים. עשרים החלטות',
        outcomes: [
          {
            id: 'commanding',
            baseWeight: 72,
            tone: 'good',
            preview: 'רחבה שנשלטת נבנית בבקרים כאלה',
            text: 'שבועיים אחרי, בכדור קרן במשחק צמוד, אתה יוצא בזמן הנכון ולוקח הכול. הבוקר ההוא היה בדיוק בשביל הרגע הזה.',
            effects: { ability: 1.2, confidence: 5 },
            modifiers: [{ attribute: 'ability', above: 80, multiplier: 0.5 }],
          },
          {
            id: 'slow_build',
            baseWeight: 28,
            tone: 'neutral',
            preview: 'החלטות של שוער משתפרות לאט - אבל משתפרות',
            text: 'עדיין יש יציאה מהוססת פה ושם. הוא לא מודאג: "החלטות זה שריר. עוד אלף כדורים."',
            effects: { ability: 0.5, discipline: 2 },
          },
        ],
      },
      {
        id: 'question_method',
        risk: 'safe',
        label: 'לבקש לעבוד דווקא על עצירות',
        outcomes: [
          {
            id: 'own_plan',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'לכוון את העבודה למה שמרגיש לך דחוף יותר',
            text: '"עצירות?" הוא שוקל רגע. "בסדר. אבל היציאות יחכו לנו שם." העבודה טובה - הכיוון פחות ממוקד ממה שהוא רצה.',
            effects: { ability: 0.5, confidence: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_finishing_work',
    kicker: 'אחרי האימון, לבד',
    title: 'עשרים דקות של סיומות',
    description:
      'כל יום אחרי האימון: עשרים דקות, שלושים מצבים בתוך הרחבה. "חלוץ גדול," הוא אומר, "זה לא מי שבועט חזק. זה מי שכבר בעט את הבעיטה הזאת אלף פעם בראש."',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      personalCoachSpecialties: ['finishing'],
      positions: ['ST', 'WG'],
      requiresProfessionalFootball: true,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'thousand_reps',
        risk: 'balanced',
        label: 'אלף חזרות. שיהיה אוטומטי',
        outcomes: [
          {
            id: 'clinical',
            baseWeight: 70,
            tone: 'good',
            preview: 'המצבים הגדולים יתחילו להרגיש כמו עוד חזרה באימון',
            text: 'ואז זה קורה במשחק: אחד על אחד עם השוער, והגוף פשוט עושה את מה שעשה אלף פעם. רשת. זה כבר לא מזל.',
            effects: { ability: 1.2, confidence: 5, form: 3 },
            modifiers: [{ attribute: 'ability', above: 80, multiplier: 0.5 }],
          },
          {
            id: 'reps_accumulate',
            baseWeight: 30,
            tone: 'neutral',
            preview: 'החזרות נאגרות בשקט - הרווח יגיע בהמשך',
            text: 'ההחמצות במשחקים עוד שם, אבל משהו בתנועה כבר אחר. "זה מצטבר," הוא אומר. "חכה."',
            effects: { ability: 0.6 },
          },
        ],
      },
      {
        id: 'game_situations',
        risk: 'opportunity',
        label: 'לבקש מצבים מלוכלכים - לא מעבדה',
        outcomes: [
          {
            id: 'messy_reps',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'כדורים קופצים, מגן על הגב - סיומות מהחיים',
            text: 'הוא בונה לך כאוס: כדורים קופצים, מגן דמיוני על הגב, שיווי משקל שבור. פחות אלגנטי, יותר שבת אחר הצהריים.',
            effects: { ability: 0.7, form: 2 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_mental_reset',
    kicker: 'פגישה דחופה',
    title: 'לבנות את הראש מחדש',
    description:
      'אחרי התקופה הקשה, המאמן המנטלי מפנה לך ערב שלם. "אנחנו לא הולכים לדבר על כדורגל," הוא פותח. "אנחנו הולכים לדבר על מי אתה כשכדורגל לא הולך."',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      personalCoachSpecialties: ['mental'],
      maxConfidence: 42,
      requiresProfessionalFootball: true,
    },
    slots: ['mid'],
    weight: 4,
    cooldownSeasons: 2,
    choices: [
      {
        id: 'open_up',
        risk: 'opportunity',
        label: 'לדבר באמת, בלי מסכות',
        outcomes: [
          {
            id: 'rebuilt',
            baseWeight: 68,
            tone: 'good',
            preview: 'ערב אחד כן יכול להתחיל לסובב תקופה שלמה',
            text: 'אתה יוצא מהפגישה עייף כמו אחרי משחק - ועם משהו שלא היה שם בבוקר: קרקע. מהערב הזה מתחילים לטפס.',
            effects: { confidence: 9, form: 4, pressure: -5 },
          },
          {
            id: 'slow_thaw',
            baseWeight: 32,
            tone: 'neutral',
            preview: 'ראש לא נפתח בפקודה - אבל התהליך התחיל',
            text: 'לא הכול נאמר בערב אחד. אבל משהו זז, והפגישה הבאה כבר נקבעה. גם זאת התחלה.',
            effects: { confidence: 4, pressure: -2 },
          },
        ],
      },
      {
        id: 'small_talk',
        risk: 'safe',
        label: 'לשמור מרחק. אתה מסתדר לבד',
        outcomes: [
          {
            id: 'walls_up',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'אפשר לשלם על פגישה ולא להיות בה',
            text: 'שעה של דיבורים על הכול חוץ מהעיקר. הוא לא לוחץ: "כשתהיה מוכן." הקירות שלך עוד עומדים - וגם המשקל.',
            effects: { pressure: -1 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_pc_change_specialist',
    kicker: 'צומת החלטה',
    title: 'אולי הגיע הזמן לפוקוס אחר',
    description:
      'העבודה עם המאמן האישי הנוכחי מיצתה את עצמה - את מה שהיה לו ללמד, למדת. יש תחומים אחרים שמחכים. השאלה אם לסיים פרק טוב כדי לפתוח חדש.',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      minCoachSeasonsTogether: 2,
      requiresProfessionalFootball: true,
      notPositions: ['GK'],
    },
    slots: ['early'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'to_fitness',
        risk: 'balanced',
        label: 'לעבור לעבודת כושר - הגוף הוא הבסיס',
        outcomes: [
          {
            id: 'fit_switch',
            baseWeight: 100,
            tone: 'good',
            preview: 'פרידה טובה ופוקוס חדש על הגוף',
            text: 'אתם נפרדים בחיבוק ובתודה אמיתית. המאמן החדש פותח מחברת חדשה: "בוא נראה כמה עונות עוד יש בגוף הזה."',
            effects: { startPersonalCoach: 'fitness' },
          },
        ],
      },
      {
        id: 'to_mental',
        risk: 'opportunity',
        label: 'לעבור לעבודה מנטלית - השלב הבא הוא בראש',
        outcomes: [
          {
            id: 'mental_switch',
            baseWeight: 100,
            tone: 'good',
            preview: 'פרידה טובה ופוקוס חדש על הראש',
            text: 'הוא עצמו ממליץ על המאמן המנטלי: "את הרגליים שלך כבר אי אפשר לשפר בהרבה. את הראש - תמיד." מתחילים.',
            effects: { startPersonalCoach: 'mental' },
          },
        ],
      },
      {
        id: 'stay_course',
        risk: 'safe',
        label: 'להישאר. העבודה עוד לא נגמרה',
        outcomes: [
          {
            id: 'stayed',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'המשכיות היא גם בחירה - העומק לפני הרוחב',
            text: '"יש עוד מה לחפור כאן," אתה אומר, והוא מחייך. פרק שני של אותו ספר טוב.',
            effects: { confidence: 2 },
          },
        ],
      },
    ],
  },

  /* ================================================================ */
  /* CROSS-SYSTEM                                                      */
  /* ================================================================ */

  {
    id: 'ppl_cross_agent_vs_manager',
    kicker: 'שני טלפונים, ערב אחד',
    title: 'הסוכן מושך, המאמן מחזיק',
    description:
      'הסוכן: "יש התעניינות אמיתית, אני צריך אור ירוק." שעה אחרי, המאמן: "שמעתי רעשים. אתה מרכזי אצלי - אני צריך לדעת שהראש שלך פה." שניהם מחכים לתשובה.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      requiresProfessionalFootball: true,
      minRoleValue: 50,
      minCoachTrust: 50,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'back_manager',
        risk: 'safe',
        label: 'הראש כאן. להגיד לסוכן להאט',
        outcomes: [
          {
            id: 'trust_deepens',
            baseWeight: 100,
            tone: 'good',
            preview: 'המאמן יקבל את התשובה שרצה - והאמון יעמיק',
            text: 'אתה אומר למאמן משפט אחד ברור, והוא נרגע. הסוכן פחות. אי אפשר לרצות את כולם - אפשר לבחור את מי.',
            effects: { coachTrust: 7, agentRelationship: -6, agentAdvice: 'rejected', form: 2 },
          },
        ],
      },
      {
        id: 'back_agent',
        risk: 'risky',
        label: 'קריירה זה קריירה. שהסוכן יעבוד',
        outcomes: [
          {
            id: 'market_moves',
            baseWeight: 60,
            tone: 'neutral',
            preview: 'השוק יתחיל לזוז - והמאמן ירגיש את זה',
            text: 'הסוכן מקבל אור ירוק ועובד. המאמן לא שומע את זה ממך - אבל מאמנים תמיד שומעים. משהו בקשר מתקרר.',
            effects: { transferChance: 0.18, coachTrust: -5, agentRelationship: 6, agentAdvice: 'followed' },
          },
          {
            id: 'nothing_comes',
            baseWeight: 40,
            tone: 'bad',
            preview: 'ואם לא תגיע הצעה - שילמת באמון על כלום',
            text: 'הקיץ עובר ושום הצעה לא מבשילה. נשארת - עם מאמן שכבר יודע שרצית ללכת. המחיר שולם, הסחורה לא הגיעה.',
            effects: { coachTrust: -7, agentRelationship: -3, agentAdvice: 'followed', pressure: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_cross_pc_vs_mgr',
    kicker: 'שתי תורות',
    title: 'החופש של האחד, המשבצת של השני',
    description:
      'המאמן האישי בנה לך חודשים של אינסטינקטים חופשיים. המאמן בקבוצה דורש משבצת וסדר. באימון היום שני העולמות התנגשו - ואתה באמצע.',
    category: 'people',
    conditions: {
      requiresPersonalCoach: true,
      personalCoachSpecialties: ['technical', 'finishing'],
      managerArchetypes: ['disciplinarian'],
      requiresProfessionalFootball: true,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'synthesis',
        risk: 'opportunity',
        label: 'לחבר: החופש בתוך המשבצת',
        outcomes: [
          {
            id: 'best_of_both',
            baseWeight: 58,
            tone: 'good',
            preview: 'שחקן שמחבר סדר וחופש נהיה שלם משניהם',
            text: 'אתה לומד את הדבר הקשה: להיות חופשי בתוך מסגרת. המאמן מרוצה מהמשמעת, המאמן האישי מהאומץ. שניהם צודקים.',
            effects: { ability: 1, coachTrust: 5, discipline: 3, confidence: 3 },
          },
          {
            id: 'stuck_between',
            baseWeight: 42,
            tone: 'neutral',
            preview: 'או שתיתקע בין שתי תורות - לא פה ולא שם',
            text: 'שבועות של לחשוב פעמיים על כל נגיעה. שני מורים טובים, תלמיד תקוע באמצע. זה יסתדר - אבל לא השבוע.',
            effects: { form: -3, pressure: 3 },
          },
        ],
      },
      {
        id: 'pick_manager',
        risk: 'safe',
        label: 'בשבתות קובע מי שרושם הרכב',
        outcomes: [
          {
            id: 'pragmatic',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'פרגמטיות: המשבצת בשבת, החופש באימונים האישיים',
            text: 'המאמן האישי מקבל את זה בחיוך עקום: "חכם. משעמם, אבל חכם." הדקות שלך מוגנות, החופש מחכה לשעות הקטנות.',
            effects: { coachTrust: 5, discipline: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_cross_agent_reads_manager',
    kicker: 'עין מקצועית',
    title: 'הסוכן מנתח לך את המאמן',
    description:
      'בפגישה החודשית, הסוכן מפתיע אותך בניתוח מדויק של המאמן שלך - איך הוא חושב, את מי הוא משחק, ומה בדיוק הוא צריך לראות ממך. "אני עוקב," הוא מחייך. "זאת העבודה."',
    category: 'people',
    conditions: {
      requiresAgent: true,
      minAgentRelationship: 55,
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'use_read',
        risk: 'opportunity',
        label: 'לתרגם את הניתוח לעבודה במגרש',
        outcomes: [
          {
            id: 'read_pays',
            baseWeight: 64,
            tone: 'good',
            preview: 'להבין מה המאמן צריך לראות - ולהראות לו בדיוק את זה',
            text: 'אתה מתחיל לתת למאמן בדיוק את מה שהסוכן אמר שהוא מחפש. תוך חודש היחס משתנה. מידע טוב שווה זהב.',
            effects: { coachTrust: 6, agentRelationship: 4, roleValue: 3 },
          },
          {
            id: 'read_wrong',
            baseWeight: 36,
            tone: 'neutral',
            preview: 'גם ניתוח טוב הוא רק ניחוש על בן אדם',
            text: 'אתה משחק לפי הניתוח, והמאמן דווקא מרים גבה על השינוי. בני אדם מסובכים יותר מדוחות. חוזרים למקור: להיות אתה.',
            effects: { form: -2 },
          },
        ],
      },
      {
        id: 'play_own_game',
        risk: 'safe',
        label: 'תודה, אבל אתה לא פרויקט ניתוח',
        outcomes: [
          {
            id: 'authentic',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'להישאר אתה - הדרך הארוכה והנקייה',
            text: '"אני משחק את המשחק שלי," אתה אומר. הסוכן מרים ידיים בחיוך. יש משהו נקי בדרך הארוכה.',
            effects: { confidence: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_cross_first_agent_memory',
    kicker: 'הודעה בלתי צפויה',
    title: 'האיש שהאמין ראשון',
    description:
      'אחרי ערב גדול שלך, מגיעה הודעה מהסוכן: "אתה זוכר את היום שחתמנו? ידעתי כבר אז." אתה זוכר. עברתם דרך מאז - שוקים, משברים, חוזים. והוא עוד כאן.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      requiresMemory: ['signed_with_agent'],
      memoryMinSeasonsAgo: 4,
      minAgentRelationship: 65,
      requiresProfessionalFootball: true,
    },
    slots: ['late'],
    weight: 3,
    oncePerCareer: true,
    choices: [
      {
        id: 'remember_together',
        risk: 'balanced',
        label: 'להתקשר במקום לענות בהודעה',
        outcomes: [
          {
            id: 'long_road',
            baseWeight: 100,
            tone: 'good',
            preview: 'שיחה של עשר דקות שסוגרת מעגל של שנים',
            text: 'עשר דקות של שיחה שהיא בעצם סיכום דרך. בסוף הוא אומר: "הדרך עוד ארוכה." ואתה יודע שהוא יהיה בה.',
            effects: {
              agentRelationship: 10,
              confidence: 3,
              milestone: { id: 'agent_long_road', icon: '🤝', text: 'דרך ארוכה עם הסוכן שהאמין ראשון', major: false },
            },
          },
        ],
      },
      {
        id: 'short_reply',
        risk: 'safe',
        label: 'לענות קצר. הערב הזה שלך',
        outcomes: [
          {
            id: 'moment_kept',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'לשמור את הערב לעצמך - השיחה תחכה למחר',
            text: '"זוכר. תודה על הכול." הודעה קצרה, ערב שלך. יש רגעים ששומרים לעצמך - הוא יבין. הוא תמיד הבין.',
            effects: { agentRelationship: 4 },
          },
        ],
      },
    ],
  },
  {
    id: 'ppl_cross_people_at_low',
    kicker: 'התקופה הקשה',
    title: 'מי נשאר כשקשה',
    description:
      'שלושה חודשים רעים, מהסוג שמלמד אותך מי זה מי. הטלפונים מהמעריצים נעלמו. שני אנשים לא נעלמו: הסוכן שלך, שמתקשר בלי סיבה, והמאמן האישי, שמגיע גם כשאין מה לשפר.',
    category: 'people',
    conditions: {
      requiresAgent: true,
      requiresPersonalCoach: true,
      maxForm: 38,
      maxConfidence: 45,
      requiresProfessionalFootball: true,
    },
    slots: ['mid'],
    weight: 3,
    cooldownSeasons: 3,
    choices: [
      {
        id: 'lean_on_them',
        risk: 'balanced',
        label: 'להישען על מי שנשאר',
        outcomes: [
          {
            id: 'carried_through',
            baseWeight: 72,
            tone: 'good',
            preview: 'אנשים טובים הם הדרך היחידה החוצה מתקופות כאלה',
            text: 'אתה נותן להם לעבוד: הסוכן מרחיק את הרעש, המאמן האישי בונה מחדש מהקטן. לאט לאט, הכדורגל חוזר. הם היו הגשר.',
            effects: { confidence: 7, form: 5, agentRelationship: 7, pressure: -4 },
          },
          {
            id: 'still_climbing',
            baseWeight: 28,
            tone: 'neutral',
            preview: 'גם עם גשר טוב, את הדרך הולכים ברגל',
            text: 'הם שם, והדרך עדיין ארוכה. אבל יש הבדל בין ללכת אותה לבד ובין ללכת אותה עם מלווים. ההבדל הזה מחזיק אותך.',
            effects: { confidence: 3, agentRelationship: 4 },
          },
        ],
      },
      {
        id: 'isolate',
        risk: 'risky',
        label: 'להסתגר. לצאת מזה לבד',
        outcomes: [
          {
            id: 'lonely_road',
            baseWeight: 100,
            tone: 'neutral',
            preview: 'הדרך הבודדה - אפשרית, וארוכה יותר',
            text: 'אתה מפסיק לענות ועובד לבד. זה אפשרי. זה גם איטי יותר, וקר יותר. הם מחכים בצד - זה משהו.',
            effects: { confidence: 1, agentRelationship: -4, pressure: 2 },
          },
        ],
      },
    ],
  },
];

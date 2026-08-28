import type { GameEvent } from '../../types';

/**
 * Maccabi's story, happening without the player (v0.4.1).
 *
 * v0.4 only simulated the club the player was standing in, so the moment he left, Maccabi
 * effectively ceased to exist until he came back. These events are what the ambient Maccabi world
 * is *for*: the club wins a title while he is in Portugal, or falls apart while he is at Hapoel
 * Afula, and either way he finds out about it.
 *
 * Deliberately rare and gated on something having actually happened. The rule the brief sets is
 * the right one:
 *
 *   THE PLAYER MAY LEAVE MACCABI. MACCABI NEVER LEAVES THE PLAYER'S STORY.
 *   ...but that does not mean mention Maccabi every season.
 *
 * So every one of these requires a real world event (a title, a relegation, a crisis) plus a long
 * cooldown. They fire when there is something to say and stay quiet otherwise.
 */

export const AMBIENT_MACCABI_EVENTS: GameEvent[] = [
  {
    id: 'amb_they_won_it_without_you',
    kicker: 'הודעה בטלפון',
    title: 'הם אלופים',
    description:
      'הקבוצות שגדלת בהן לא מחכות לך. מכבי חיפה סיימה את העונה אלופה, והקבוצות בוואטסאפ מתפוצצות בלי שאתה שם.',
    category: 'family',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      maccabiSeasonOutcome: ['champion'],
      requiresProfessionalFootball: true,
    },
    /*
     * Maccabi win the league in about a third of seasons, so with ~11 seasons away this would
     * fire in half of all careers at its first weight. The brief's rule is the right one: the
     * connection should feel present, not inserted. Weighted down and cooled off so it lands as
     * a moment rather than an annual bulletin.
     */
    slots: ['early'],
    weight: 13,
    cooldownSeasons: 7,
    choices: [
      {
        id: 'happy_for_them',
        label: 'לשלוח מזל טוב לכולם',
        risk: 'safe',
        outcomes: [
          {
            id: 'still_one_of_them',
            baseWeight: 100,
            tone: 'good',
            text: 'שלושה מהם עונים תוך דקה. אתה לא שם, ואתה כן שם.',
            effects: {
              maccabism: 8,
              confidence: 3,
              remember: 'maccabi_title_without_me',
            },
          },
        ],
      },
      {
        id: 'sting',
        label: 'לסגור את הטלפון',
        risk: 'balanced',
        outcomes: [
          {
            id: 'fuel',
            baseWeight: 55,
            tone: 'good',
            preview: 'זה צורב, ואתה לוקח את זה לאימון',
            text: 'זה צורב, ואתה לוקח את זה לאימון. לפעמים הכי טוב שיקרה לך זה להרגיש שפספסת משהו.',
            effects: {
              form: 6,
              confidence: 4,
              maccabism: -3,
              remember: 'maccabi_title_without_me',
            },
            traitModifiers: [{ trait: 'self_believer', multiplier: 1.5 }],
          },
          {
            id: 'sour',
            baseWeight: 45,
            tone: 'bad',
            preview: 'תחשוב על זה יותר משכדאי, ושבוע שלם ילך',
            text: 'אתה חושב על זה יותר משכדאי. שבוע שלם עובר עליך רע.',
            effects: {
              form: -5,
              confidence: -4,
              pressure: 4,
              remember: 'maccabi_title_without_me',
            },
          },
        ],
      },
    ],
  },

  {
    id: 'amb_the_club_is_falling_apart',
    kicker: 'ידיעות מהבית',
    title: 'משהו קרה שם',
    description:
      'העונה של מכבי חיפה הייתה רעה. באתרים מדברים על שינויים גדולים, ומישהו מהמועדון התקשר לשאול מה המצב שלך.',
    category: 'family',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      // For a club of this size, mid-table is already the crisis - it does not take relegation.
      maccabiSeasonOutcome: ['mid_table', 'lower_table', 'relegation_battle'],
      playedForMaccabi: true,
      requiresProfessionalFootball: true,
      minAge: 24,
    },
    slots: ['early'],
    weight: 30,
    cooldownSeasons: 5,
    choices: [
      {
        id: 'open_door',
        label: 'להגיד שהדלת פתוחה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'noted',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה לא מבטיח כלום, והם לא מציעים כלום. אבל שני הצדדים יודעים עכשיו איפה הם עומדים.',
            effects: {
              maccabism: 9,
              transferChance: 0.12,
              remember: 'maccabi_asked_about_me',
            },
          },
        ],
      },
      {
        id: 'not_my_problem',
        label: '"אני באמצע עונה. זה לא הזמן"',
        risk: 'safe',
        outcomes: [
          {
            id: 'professional',
            baseWeight: 100,
            tone: 'good',
            text: 'אתה סוגר את השיחה ומתמקד במה שיש לך. המאמן שלך היה מאשר.',
            effects: { coachTrust: 4, form: 3, maccabism: -3 },
            traitModifiers: [{ trait: 'professional', multiplier: 1.4 }],
          },
        ],
      },
    ],
  },

  {
    id: 'amb_they_went_down',
    kicker: 'לא האמנת כשראית',
    title: 'מכבי חיפה ירדה ליגה',
    description:
      'המועדון שגידל אותך ירד לליגה הלאומית. אתה קורא את זה שוב ושוב ולא מצליח להפוך את זה למשהו הגיוני.',
    category: 'family',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      maccabiSeasonOutcome: ['relegated'],
      requiresProfessionalFootball: true,
    },
    slots: ['early'],
    weight: 34,
    cooldownSeasons: 8,
    choices: [
      {
        id: 'say_something',
        label: 'לפרסם משהו. הם צריכים לשמוע את זה ממך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'landed',
            baseWeight: 72,
            tone: 'good',
            text: 'הפוסט שלך מתגלגל בכל האתרים. בחיפה זוכרים מי דיבר כשהיה קשה.',
            effects: {
              maccabism: 12,
              reputation: 3,
              flags: ['loyalty_moment'],
              remember: 'maccabi_relegated_while_away',
            },
          },
          {
            id: 'read_wrong',
            baseWeight: 28,
            tone: 'bad',
            text: 'חלק קוראים את זה כרחמים. "איפה היית כשהיינו צריכים אותך?"',
            effects: { maccabism: 4, pressure: 4, remember: 'maccabi_relegated_while_away' },
          },
        ],
      },
      {
        id: 'private',
        label: 'לשלוח הודעה למי שצריך, בשקט',
        risk: 'safe',
        outcomes: [
          {
            id: 'quiet',
            baseWeight: 100,
            tone: 'good',
            text: 'שתי הודעות פרטיות, בלי מצלמות. שני האנשים שקיבלו אותן לא ישכחו.',
            effects: {
              maccabism: 8,
              flags: ['loyalty_moment'],
              remember: 'maccabi_relegated_while_away',
            },
          },
        ],
      },
    ],
  },

  {
    id: 'amb_they_need_your_position',
    kicker: 'שוק ההעברות',
    title: 'הם מחפשים בעמדה שלך',
    description:
      'מכבי חיפה מחפשת שחקן בעמדה שלך, ובעיתונות מזכירים אותך כאופציה. עוד לא התקשרו.',
    category: 'transfer',
    conditions: {
      bands: ['senior'],
      clubScope: 'formerMaccabi',
      playedForMaccabi: true,
      maccabiRelationship: ['son_of_the_club', 'icon', 'beloved', 'respected'],
      requiresProfessionalFootball: true,
      minReputation: 40,
      minRoleValue: 45,
    },
    // Was late-only, which is the rarest slot and left this at 0% despite 18% eligibility.
    slots: ['mid', 'late'],
    weight: 22,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'let_it_be_known',
        label: 'לתת לסוכן לרמוז שאתה פנוי לשיחה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'wheels_turn',
            baseWeight: 100,
            tone: 'neutral',
            text: 'הסוכן עושה טלפון אחד. עכשיו זה תלוי בהם.',
            effects: { maccabism: 6, transferChance: 0.2, remember: 'maccabi_asked_about_me' },
          },
        ],
      },
      {
        id: 'stay_quiet',
        label: 'לא לעשות כלום. אם ירצו, יתקשרו',
        risk: 'safe',
        outcomes: [
          {
            id: 'dignified',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה ממשיך לשחק ולא אומר מילה. יש דרכים להגיד "אני כאן" בלי להגיד כלום.',
            effects: { roleValue: 2, coachTrust: 3 },
          },
        ],
      },
    ],
  },
];

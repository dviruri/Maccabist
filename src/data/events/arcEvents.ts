import type { GameEvent } from '../../types';

/**
 * Story arcs and callbacks - the events that make a career feel continuous.
 *
 * Nothing here is special-cased in the engine. An arc event is an ordinary event whose
 * `conditions.requiresArc` gates it on a storyline the player is already inside, and whose
 * outcomes push that storyline forward with `advanceArc` / `completeArc` / `arcBranch`.
 * Callback events gate on `requiresMemory` instead, with `memoryMinSeasonsAgo` so the
 * reference lands with some distance rather than the following week.
 *
 * The arcs:
 *   older_group        invited up -> thrived/held_own/struggled -> follow-up -> permanent
 *   coach_relationship criticism -> response -> consequence -> repair -> redemption
 *   injury_comeback    injury -> rehab choice -> first match back -> resolution
 *   position_battle    a rival arrives -> the fight -> who wins -> a later rivalry callback
 *   europe_move        a move abroad -> settling or struggling -> fight/loan/home
 */

export const ARC_EVENTS: GameEvent[] = [
  /* ================================================================= */
  /* ARC: playing up an age group                                       */
  /* ================================================================= */
  {
    id: 'arc_older_group_followup',
    kicker: 'חודשים אחרי',
    title: 'המאמן של השנתון מעליך חוזר',
    description:
      'הוא רואה אותך באימון ועוצר. "אני זוכר איך זה נגמר בפעם הקודמת. אתה רוצה לנסות שוב?"',
    category: 'opportunity',
    conditions: {
      requiresArc: { id: 'older_group', minStage: 1, maxStage: 1, minSeasonsSinceStart: 1 },
      bands: ['children', 'teens'],
      maxAge: 16,
    },
    weight: 14,
    choices: [
      {
        id: 'again',
        label: 'הפעם אני מוכן',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'redeemed',
            baseWeight: 42,
            tone: 'good',
            preview: 'הפעם הגוף עומד בזה, ואותו מאמן רואה אותך עומד',
            text: 'הפעם הגוף עומד בזה והראש כבר מכיר את הקצב. אותו מאמן שראה אותך נשבר רואה אותך עומד.',
            effects: {
              ability: 2.6,
              coachTrust: 9,
              confidence: 9,
              olderGroup: 'playing',
              promotionBoost: 8,
              advanceArc: 'older_group',
              arcBranch: 'redeemed',
              remember: 'older_group_success',
            },
            modifiers: [
              { attribute: 'abilityVsLevel', above: 4, multiplier: 1.5 },
              { attribute: 'confidence', above: 60, multiplier: 1.3 },
            ],
            // A player who already coped is likelier to cope again.
            memoryModifiers: [{ memory: 'older_group_failure', multiplier: 0.7 }],
            traitModifiers: [
              { trait: 'hard_worker', multiplier: 1.35 },
              { trait: 'late_bloomer', multiplier: 1.25 },
            ],
          },
          {
            id: 'same_again',
            baseWeight: 58,
            tone: 'bad',
            preview: 'אותו סיפור - ומתחילים לדבר על זה במחלקה',
            text: 'אותו סיפור. אתה עוד לא שם פיזית, וזה מתחיל להיות משהו שמדברים עליו במחלקה.',
            effects: {
              confidence: -7,
              coachTrust: -4,
              advanceArc: 'older_group',
              arcBranch: 'struggled_twice',
              remember: 'older_group_failure',
            },
            modifiers: [{ attribute: 'abilityVsLevel', above: 8, multiplier: 0.4 }],
          },
        ],
      },
      {
        id: 'my_pace',
        label: 'תן לי עוד שנה בשנתון שלי',
        hint: 'לשלוט במקום להיאבק',
        risk: 'safe',
        outcomes: [
          {
            id: 'dominant',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה הכי טוב בקבוצה שלך בפער. זה בונה ביטחון, וזה גם לא מפתח אותך במיוחד.',
            effects: {
              confidence: 6,
              roleValue: 5,
              ability: 0.6,
              completeArc: 'older_group',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'arc_older_group_permanent',
    kicker: 'סוף עונה, שיחה במשרד',
    title: 'להישאר עם המבוגרים',
    description:
      'אחרי חצי עונה עם השנתון מעליך, מנהל המחלקה שואל את השאלה הפשוטה: להישאר שם דרך קבע?',
    category: 'promotion',
    conditions: {
      requiresArc: { id: 'older_group', minStage: 2, branches: ['redeemed', 'thrived'] },
      bands: ['children', 'teens'],
    },
    weight: 16,
    choices: [
      {
        id: 'stay_up',
        label: 'להישאר למעלה',
        risk: 'opportunity',
        outcomes: [
          {
            id: 'promoted',
            baseWeight: 55,
            tone: 'good',
            text: 'הם מעבירים אותך רשמית. שנה שלמה שאתה מרוויח, וכל מי שראה אותך בהתחלה לא מאמין.',
            effects: {
              promotionBoost: 24,
              coachTrust: 8,
              confidence: 7,
              olderGroup: 'playing',
              completeArc: 'older_group',
              remember: 'early_promotion',
              milestone: {
                id: 'older_group_permanent',
                icon: '⬆️',
                text: 'הועברת דרך קבע לשנתון מעליך',
                major: true,
              },
            },
            modifiers: [
              { attribute: 'coachTrust', above: 68, multiplier: 1.4 },
              { attribute: 'abilityVsLevel', above: 5, multiplier: 1.35 },
            ],
          },
          {
            id: 'not_yet',
            baseWeight: 45,
            tone: 'neutral',
            text: 'הם מעדיפים לחכות עוד חצי שנה. לא סירוב - עיכוב.',
            effects: { promotionBoost: 8, olderGroup: 'training', completeArc: 'older_group' },
          },
        ],
      },
      {
        id: 'go_back',
        label: 'לחזור לשנתון שלי',
        risk: 'safe',
        outcomes: [
          {
            id: 'back_down',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אתה חוזר להיות הכי טוב בקבוצה שלך. יש בזה נוחות, ויש בזה גם תקרה.',
            effects: { confidence: 5, roleValue: 6, olderGroup: 'none', completeArc: 'older_group' },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* ARC: the coach relationship                                        */
  /* ================================================================= */
  {
    id: 'arc_coach_criticism',
    kicker: 'אחרי אימון, ליד הספסל',
    title: 'המאמן לא מרוצה ממך',
    description:
      'הוא קורא לך הצידה. בלי לצעוק, וזה איכשהו יותר גרוע. "אני לא רואה אותך עובד. אתה חושב שהמקום שלך מובטח?"',
    category: 'coach',
    conditions: {
      minAge: 13,
      forbidsActiveArc: 'coach_relationship',
      maxCoachTrust: 68,
    },
    weight: 9,
    cooldownSeasons: 5,
    choices: [
      {
        id: 'take_it',
        label: 'לקבל את זה ולעבוד',
        risk: 'balanced',
        outcomes: [
          {
            id: 'responded',
            baseWeight: 58,
            tone: 'good',
            preview: 'לא תענה מילה, ותהיה הראשון להגיע - והוא ישים לב',
            text: 'לא ענית מילה. בשבועיים הבאים היית הראשון להגיע, והוא שם לב לזה בלי להגיד.',
            effects: {
              coachTrust: 7,
              discipline: 5,
              startArc: 'coach_relationship',
              arcBranch: 'responded',
            },
            modifiers: [{ attribute: 'discipline', above: 62, multiplier: 1.4 }],
            traitModifiers: [
              { trait: 'professional', multiplier: 1.5 },
              { trait: 'hard_worker', multiplier: 1.4 },
              { trait: 'hot_headed', multiplier: 0.5 },
            ],
          },
          {
            id: 'went_quiet',
            baseWeight: 42,
            tone: 'bad',
            preview: 'תגיד שאתה מבין ובפנים תיסגר',
            text: 'אמרת שאתה מבין, ובפנים נסגרת. באימונים הבאים אתה שם, אבל לא באמת.',
            effects: {
              confidence: -6,
              coachTrust: -3,
              startArc: 'coach_relationship',
              arcBranch: 'withdrawn',
            },
          },
        ],
      },
      {
        id: 'answer_back',
        label: 'להגיד לו מה אתה חושב',
        risk: 'risky',
        outcomes: [
          {
            id: 'respected',
            baseWeight: 32,
            tone: 'good',
            preview: 'תענה בפנים בלי לצעוק, והוא יאמר "עכשיו תראה לי במגרש"',
            text: 'ענית לו בפנים, בלי לצעוק. הוא הסתכל עליך רגע ואמר "יופי. עכשיו תראה לי במגרש."',
            effects: {
              coachTrust: 5,
              confidence: 6,
              leadership: 5,
              startArc: 'coach_relationship',
              arcBranch: 'confronted',
            },
            modifiers: [{ attribute: 'roleValue', above: 60, multiplier: 1.5 }],
            traitModifiers: [
              { trait: 'leader', multiplier: 1.6 },
              { trait: 'self_believer', multiplier: 1.4 },
            ],
          },
          {
            id: 'blew_up',
            baseWeight: 68,
            tone: 'bad',
            preview: 'זה ייצא חזק מדי, והוא פשוט ילך',
            text: 'זה יצא חזק מדי. הוא לא ענה, פשוט הלך - וזה הרבה יותר גרוע מוויכוח.',
            effects: {
              coachTrust: -12,
              discipline: -5,
              startArc: 'coach_relationship',
              arcBranch: 'conflict',
              remember: 'coach_conflict',
              flags: ['discipline_problem'],
            },
            traitModifiers: [{ trait: 'hot_headed', multiplier: 1.5 }],
          },
        ],
      },
    ],
  },
  {
    id: 'arc_coach_consequence',
    kicker: 'הרכב ליום שבת',
    title: 'אתה מחוץ להרכב',
    description:
      'השם שלך לא על הלוח. אחרי מה שהיה בינך לבין המאמן, אף אחד בחדר לא מופתע - וזה החלק הכי לא נעים.',
    category: 'coach',
    conditions: {
      requiresArc: {
        id: 'coach_relationship',
        minStage: 1,
        maxStage: 1,
        branches: ['conflict', 'withdrawn'],
      },
      minAge: 13,
    },
    weight: 15,
    choices: [
      {
        id: 'work_back',
        label: 'לעבוד בשקט ולחכות להזדמנות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'earned_chance',
            baseWeight: 50,
            tone: 'good',
            preview: 'שלושה שבועות בלי תלונה, וכשמישהו נפצע השם שלך ראשון',
            text: 'שלושה שבועות בלי מילה אחת של תלונה. כשנפצע מישהו, השם שלך היה הראשון שעלה.',
            effects: {
              coachTrust: 6,
              minutesModifier: 1.1,
              advanceArc: 'coach_relationship',
              arcBranch: 'working_back',
            },
            traitModifiers: [
              { trait: 'professional', multiplier: 1.5 },
              { trait: 'hard_worker', multiplier: 1.4 },
            ],
          },
          {
            id: 'forgotten',
            baseWeight: 50,
            tone: 'bad',
            preview: 'שישה שבועות ואתה עדיין מחמם - יש שחקנים שנעלמים ככה',
            text: 'עברו שישה שבועות ואתה עדיין מחמם. יש שחקנים שנעלמים ככה, בלי שאף אחד מחליט.',
            effects: {
              minutesModifier: 0.6,
              confidence: -7,
              roleValue: -6,
              advanceArc: 'coach_relationship',
              arcBranch: 'frozen_out',
              remember: 'lost_starting_role',
            },
          },
        ],
      },
      {
        id: 'ask_to_leave',
        label: 'לבקש לעזוב',
        risk: 'risky',
        outcomes: [
          {
            id: 'move_on',
            baseWeight: 60,
            tone: 'neutral',
            preview: 'תגיד שאתה צריך לשחק, ובמועדון לא יתווכחו',
            text: 'אמרת שאתה צריך לשחק. במועדון לא התווכחו, וזה בעצמו אמר משהו.',
            effects: {
              transferChance: 0.4,
              maccabism: -5,
              completeArc: 'coach_relationship',
              remember: 'forced_transfer',
            },
          },
          {
            id: 'refused',
            baseWeight: 40,
            tone: 'bad',
            preview: 'הם יאמרו לא, וכולם ידעו שביקשת ללכת',
            text: 'הם אמרו לא, ועכשיו כולם יודעים שביקשת ללכת. זה לא נמחק.',
            effects: {
              coachTrust: -7,
              roleValue: -5,
              pressure: 7,
              advanceArc: 'coach_relationship',
              arcBranch: 'frozen_out',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'arc_coach_redemption',
    kicker: 'דקה 61, 0:1',
    title: 'ההזדמנות האחרונה',
    description:
      'הוא מסתובב לספסל ואומר את השם שלך. אחרי כל מה שהיה, זה הרגע שמחליט אם יש לך עתיד כאן.',
    category: 'opportunity',
    conditions: {
      requiresArc: {
        id: 'coach_relationship',
        minStage: 2,
        branches: ['working_back', 'frozen_out'],
      },
    },
    weight: 18,
    choices: [
      {
        id: 'seize',
        label: 'להיכנס ולשנות את המשחק',
        risk: 'risky',
        outcomes: [
          {
            id: 'redemption',
            baseWeight: 40,
            tone: 'good',
            text: 'עשרים דקות שבהן היית הכי טוב על הדשא. בסיום הוא לא אמר כלום - רק טפח לך על הגב, וזה הספיק.',
            effects: {
              coachTrust: 16,
              roleValue: 9,
              confidence: 12,
              form: 8,
              completeArc: 'coach_relationship',
              milestone: {
                id: 'coach_redemption',
                icon: '🤝',
                text: 'חזרת מהקרח והחזרת לעצמך את המאמן',
                major: true,
              },
            },
            modifiers: [
              { attribute: 'ability', above: 60, multiplier: 1.4 },
              { attribute: 'confidence', above: 55, multiplier: 1.3 },
              { attribute: 'form', below: 38, multiplier: 0.6 },
            ],
            traitModifiers: [
              { trait: 'big_game', multiplier: 1.6 },
              { trait: 'self_believer', multiplier: 1.35 },
            ],
          },
          {
            id: 'anonymous',
            baseWeight: 60,
            tone: 'bad',
            text: 'נגעת בכדור אולי שמונה פעמים. לא עשית שום דבר רע, ובדיוק בזה הבעיה.',
            effects: {
              confidence: -6,
              coachTrust: -4,
              minutesModifier: 0.7,
              completeArc: 'coach_relationship',
              remember: 'lost_starting_role',
            },
          },
        ],
      },
      {
        id: 'safe_game',
        label: 'לשחק פשוט ולא לטעות',
        risk: 'safe',
        outcomes: [
          {
            id: 'no_mistakes',
            baseWeight: 100,
            tone: 'neutral',
            text: 'עשרים דקות בלי טעות אחת ובלי רגע אחד שיזכרו. זה מספיק כדי להישאר בסגל.',
            effects: {
              coachTrust: 4,
              confidence: 2,
              completeArc: 'coach_relationship',
            },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* ARC: coming back from a bad injury                                 */
  /* ================================================================= */
  {
    id: 'arc_injury_rehab',
    kicker: 'חדר הכושר, לבד',
    title: 'השיקום',
    description:
      'הקבוצה מתאמנת בחוץ ואתה על אופניים בפנים. הפיזיו נותן לך שתי אפשרויות: לוח זמנים, או סבלנות.',
    /*
     * Deliberately not category 'injury'. This is the rehab story, not a fresh injury, and
     * the anti-repetition rule blocks the injury category in the season straight after an
     * injury - which is exactly the season this needs to fire in.
     */
    category: 'development',
    conditions: {
      requiresMemory: ['major_injury'],
      memoryMaxSeasonsAgo: 2,
      forbidsActiveArc: 'injury_comeback',
      minAge: 14,
    },
    weight: 22,
    choices: [
      {
        id: 'rush',
        label: 'לחזור כמה שיותר מהר',
        risk: 'risky',
        outcomes: [
          {
            id: 'back_early',
            baseWeight: 45,
            tone: 'good',
            text: 'חזרת שלושה שבועות לפני התחזית. המאמן שמח, הפיזיו פחות.',
            effects: {
              minutesModifier: 1.15,
              confidence: 6,
              injuryRisk: 8,
              startArc: 'injury_comeback',
              arcBranch: 'rushed',
            },
            traitModifiers: [{ trait: 'self_believer', multiplier: 1.3 }],
          },
          {
            id: 'setback',
            baseWeight: 55,
            tone: 'bad',
            text: 'שבועיים אחרי החזרה, אותו מקום. הפעם אף אחד לא מדבר על תאריכים.',
            effects: {
              injuryChance: 1,
              injuryRisk: 14,
              confidence: -10,
              minutesModifier: 0.5,
              startArc: 'injury_comeback',
              arcBranch: 'setback',
              flags: ['injury_prone'],
            },
            traitModifiers: [{ trait: 'injury_prone', multiplier: 1.6 }],
          },
        ],
      },
      {
        id: 'patient',
        label: 'לעשות את זה נכון',
        hint: 'תפסיד משחקים, תרוויח קריירה',
        risk: 'safe',
        outcomes: [
          {
            id: 'rebuilt',
            baseWeight: 100,
            tone: 'good',
            text: 'ארבעה חודשים של עבודה משעממת ומדויקת. חזרת חזק יותר ממה שהיית לפני.',
            effects: {
              injuryRisk: -12,
              ability: 1,
              minutesModifier: 0.75,
              discipline: 5,
              startArc: 'injury_comeback',
              arcBranch: 'patient',
            },
            traitModifiers: [{ trait: 'professional', multiplier: 1.3 }],
          },
        ],
      },
    ],
  },
  {
    id: 'arc_injury_first_match',
    kicker: 'המשחק הראשון אחרי',
    title: 'הדו-קרב הראשון',
    description:
      'שבע דקות בפנים, וכדור חצי-חצי מתגלגל בינך לבין המגן שלהם. הרגל שנפצעה היא זו שקרובה יותר לכדור.',
    category: 'match_moment',
    conditions: {
      requiresArc: { id: 'injury_comeback', minStage: 1 },
    },
    weight: 20,
    choices: [
      {
        id: 'go_in',
        label: 'להיכנס',
        risk: 'risky',
        outcomes: [
          {
            id: 'over_it',
            baseWeight: 55,
            tone: 'good',
            text: 'נכנסת בלי לחשוב וקמת בלי לבדוק. מהרגע הזה אתה שחקן שוב, לא מישהו שחוזר מפציעה.',
            effects: {
              confidence: 12,
              form: 8,
              coachTrust: 5,
              completeArc: 'injury_comeback',
              milestone: {
                id: 'injury_comeback_complete',
                icon: '💪',
                text: 'חזרת מהפציעה הקשה',
                major: true,
              },
            },
            modifiers: [{ attribute: 'confidence', above: 55, multiplier: 1.3 }],
            traitModifiers: [{ trait: 'professional', multiplier: 1.25 }],
            memoryModifiers: [{ memory: 'major_injury', multiplier: 0.85 }],
          },
          {
            id: 'flinched',
            baseWeight: 45,
            tone: 'bad',
            text: 'משכת את הרגל ברגע האחרון. הכדור שלהם, והראש שלך יודע בדיוק מה קרה שם.',
            effects: {
              confidence: -9,
              form: -5,
              completeArc: 'injury_comeback',
              remember: 'confidence_crisis',
            },
          },
        ],
      },
      {
        id: 'protect',
        label: 'להישאר על הרגליים',
        risk: 'safe',
        outcomes: [
          {
            id: 'careful',
            baseWeight: 100,
            tone: 'neutral',
            text: 'ויתרת על הכדור. אף אחד לא העיר, אבל אתה יודע שעוד לא חזרת באמת.',
            effects: { confidence: -3, injuryRisk: -4, completeArc: 'injury_comeback' },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* ARC: someone came for your shirt                                   */
  /* ================================================================= */
  {
    id: 'arc_battle_start',
    kicker: 'האימון הראשון של העונה',
    title: 'מישהו חדש בעמדה שלך',
    description:
      'הוא צעיר ממך או יקר ממך, ובשני המקרים הביאו אותו בשביל המקום שלך. בחימום אתם רצים אחד ליד השני ולא מדברים.',
    category: 'competition',
    conditions: {
      minAge: 15,
      forbidsActiveArc: 'position_battle',
      minRoleValue: 30,
    },
    // Low weight and a long cooldown: losing your shirt to a new arrival should be a thing
    // that happens to a career once or twice, not most seasons.
    weight: 5,
    cooldownSeasons: 7,
    choices: [
      {
        id: 'raise_level',
        label: 'להעלות הילוך',
        risk: 'balanced',
        outcomes: [
          {
            id: 'ahead',
            baseWeight: 45,
            tone: 'good',
            preview: 'שבועיים בלי לוותר על כדור, ואתה בהרכב',
            text: 'שבועיים שבהם לא ויתרת על כדור אחד. במשחק הראשון אתה בהרכב והוא על הספסל.',
            effects: {
              coachTrust: 7,
              roleValue: 6,
              form: 5,
              startArc: 'position_battle',
              arcBranch: 'ahead',
            },
            modifiers: [
              { attribute: 'ability', above: 62, multiplier: 1.4 },
              { attribute: 'coachTrust', above: 60, multiplier: 1.3 },
            ],
            traitModifiers: [{ trait: 'hard_worker', multiplier: 1.3 }],
          },
          {
            id: 'behind',
            baseWeight: 55,
            tone: 'bad',
            preview: 'הוא מתחיל טוב יותר, והמאמן פשוט כותב את שמו',
            text: 'הוא פשוט התחיל טוב יותר. המאמן לא הסביר, פשוט כתב את השם שלו.',
            effects: {
              roleValue: -6,
              confidence: -6,
              minutesModifier: 0.75,
              startArc: 'position_battle',
              arcBranch: 'behind',
              remember: 'lost_starting_role',
            },
          },
        ],
      },
      {
        id: 'befriend',
        label: 'להתחבר אליו',
        hint: 'תחרות לא חייבת להיות מלחמה',
        risk: 'safe',
        outcomes: [
          {
            id: 'good_room',
            baseWeight: 100,
            tone: 'neutral',
            text: 'שניכם עובדים ביחד ושניכם משתפרים. גם המאמן וגם חדר ההלבשה רואים את זה.',
            effects: {
              ability: 1,
              leadership: 4,
              discipline: 3,
              startArc: 'position_battle',
              arcBranch: 'friendly',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'arc_battle_resolution',
    kicker: 'אמצע העונה',
    title: 'מי מתחיל',
    description:
      'חצי עונה של השוואות. עכשיו המאמן מקבל החלטה, וכל מי שבחדר יודע שהיא לא זמנית.',
    category: 'competition',
    conditions: {
      requiresArc: { id: 'position_battle', minStage: 1, minSeasonsSinceStart: 1 },
    },
    weight: 18,
    choices: [
      {
        id: 'settle_it',
        label: 'להכריע את זה על המגרש',
        risk: 'balanced',
        outcomes: [
          {
            id: 'won',
            baseWeight: 48,
            tone: 'good',
            preview: 'החולצה שלך, וזה כבר לא נושא לדיון',
            text: 'החולצה שלך, וזה כבר לא נושא לדיון. הוא יושב, ואתה יודע בדיוק איך זה מרגיש.',
            effects: {
              roleValue: 10,
              coachTrust: 8,
              confidence: 9,
              completeArc: 'position_battle',
            },
            modifiers: [
              { attribute: 'ability', above: 64, multiplier: 1.4 },
              { attribute: 'form', above: 62, multiplier: 1.3 },
            ],
            // Winning this fight before makes you likelier to win it again.
            memoryModifiers: [{ memory: 'lost_starting_role', multiplier: 0.8 }],
          },
          {
            id: 'lost',
            baseWeight: 52,
            tone: 'bad',
            preview: 'הוא מקבל את החולצה, ואתה שחקן טוב שיושב',
            text: 'הוא קיבל את החולצה. אתה נשאר שחקן טוב שיושב, וזו עמדה קשה מאוד לצאת ממנה.',
            effects: {
              roleValue: -9,
              coachTrust: -5,
              confidence: -8,
              minutesModifier: 0.6,
              completeArc: 'position_battle',
              remember: 'lost_starting_role',
            },
            modifiers: [{ attribute: 'age', above: 30, multiplier: 1.4 }],
          },
        ],
      },
      {
        id: 'offer_flexibility',
        label: 'להציע למאמן שתשחק בעמדה אחרת',
        hint: 'לוותר על העמדה כדי לא לוותר על הדקות',
        risk: 'balanced',
        outcomes: [
          {
            id: 'useful_everywhere',
            baseWeight: 62,
            tone: 'good',
            preview: 'תאבד את העמדה ותרוויח מקום בהרכב',
            text: 'המאמן אוהב שחקנים שהוא יכול להזיז. אתה מאבד את העמדה ומרוויח מקום בהרכב.',
            effects: {
              coachTrust: 8,
              minutesModifier: 1.1,
              ability: 1.2,
              roleValue: 2,
              completeArc: 'position_battle',
            },
            modifiers: [{ attribute: 'ability', above: 60, multiplier: 1.3 }],
            traitModifiers: [{ trait: 'professional', multiplier: 1.35 }],
          },
          {
            id: 'neither_position',
            baseWeight: 38,
            tone: 'bad',
            preview: 'רב-תכליתי זה לפעמים מילה יפה לשחקן ספסל',
            text: 'בסוף אתה לא באמת שחקן של אף עמדה. שחקן רב-תכליתי זה לפעמים מילה יפה לשחקן ספסל.',
            effects: {
              roleValue: -6,
              confidence: -5,
              completeArc: 'position_battle',
              remember: 'lost_starting_role',
            },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* ARC: the move abroad                                               */
  /* ================================================================= */
  {
    id: 'arc_europe_settling',
    kicker: 'שלושה חודשים בחוץ',
    title: 'החיים במדינה אחרת',
    description:
      'שפה שאתה לא מדבר, אוכל שאתה לא מכיר, ואימונים שבהם אתה מבין חצי ממה שאומרים. הכדורגל הוא החלק הקל.',
    category: 'random',
    conditions: { abroad: true, forbidsActiveArc: 'europe_move', minAge: 18 },
    weight: 14,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'dive_in',
        label: 'ללמוד את השפה ולהיכנס לקבוצה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'settled',
            baseWeight: 55,
            tone: 'good',
            text: 'אחרי חצי שנה אתה צוחק עם החבר׳ה בשפה שלהם. פתאום גם על המגרש הכול מסתדר.',
            effects: {
              confidence: 8,
              form: 6,
              coachTrust: 6,
              ability: 1.4,
              startArc: 'europe_move',
              arcBranch: 'settled',
            },
            traitModifiers: [
              { trait: 'professional', multiplier: 1.35 },
              { trait: 'self_believer', multiplier: 1.25 },
            ],
          },
          {
            id: 'homesick',
            baseWeight: 45,
            tone: 'bad',
            text: 'אתה מדבר עם הבית כל יום ולא מצליח להרגיש שייך. במגרש זה נראה בדיוק ככה.',
            effects: {
              confidence: -8,
              form: -6,
              maccabism: 6,
              startArc: 'europe_move',
              arcBranch: 'struggling',
              remember: 'struggled_abroad',
            },
          },
        ],
      },
      {
        id: 'football_only',
        label: 'להתרכז רק בכדורגל',
        risk: 'safe',
        outcomes: [
          {
            id: 'professional_abroad',
            baseWeight: 100,
            tone: 'neutral',
            text: 'אימון, בית, אימון. לא מאושר ולא אומלל - פשוט עובד.',
            effects: {
              ability: 1,
              maccabism: 3,
              startArc: 'europe_move',
              arcBranch: 'functional',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'arc_europe_struggling',
    kicker: 'חודש בלי דקות',
    title: 'אתה לא משחק בחוץ',
    description:
      'הרחקת אלפי קילומטרים בשביל לשבת. הסוכן שלך אומר שיש שלוש אפשרויות, וכולן לא נוחות.',
    category: 'transfer',
    conditions: {
      requiresArc: { id: 'europe_move', minStage: 1, branches: ['struggling', 'functional'] },
      abroad: true,
      maxLastAppearances: 14,
    },
    weight: 18,
    choices: [
      {
        id: 'fight',
        label: 'להישאר ולהילחם',
        risk: 'risky',
        outcomes: [
          {
            id: 'broke_through',
            baseWeight: 38,
            tone: 'good',
            text: 'חיכית לפציעה של מישהו וכשהיא הגיעה לא ויתרת על המקום. ככה נשארים באירופה.',
            effects: {
              roleValue: 9,
              coachTrust: 9,
              confidence: 10,
              reputation: 6,
              completeArc: 'europe_move',
            },
            modifiers: [
              { attribute: 'ability', above: 70, multiplier: 1.5 },
              { attribute: 'confidence', above: 55, multiplier: 1.3 },
            ],
            traitModifiers: [{ trait: 'hard_worker', multiplier: 1.4 }],
          },
          {
            id: 'wasted_year',
            baseWeight: 62,
            tone: 'bad',
            text: 'עונה שלמה של חימום. בגיל הזה זו לא רק עונה - זו נקודת ציון בקריירה.',
            effects: {
              minutesModifier: 0.5,
              confidence: -9,
              reputation: -5,
              completeArc: 'europe_move',
              remember: 'struggled_abroad',
            },
          },
        ],
      },
      {
        id: 'loan_out',
        label: 'לצאת להשאלה',
        risk: 'balanced',
        outcomes: [
          {
            id: 'playing_again',
            baseWeight: 100,
            tone: 'neutral',
            text: 'קבוצה קטנה יותר, ליגה קטנה יותר, וכל שבת בהרכב. לפעמים זה כל מה שצריך.',
            effects: {
              transferChance: 0.45,
              confidence: 4,
              completeArc: 'europe_move',
            },
          },
        ],
      },
      {
        id: 'go_home',
        label: 'לחזור לישראל',
        risk: 'safe',
        outcomes: [
          {
            id: 'homeward',
            baseWeight: 100,
            tone: 'neutral',
            text: 'ההרפתקה נגמרה מוקדם. יש כאלה שיגידו שנשברת, ויש כאלה שיגידו שהיית מספיק חכם.',
            effects: {
              transferChance: 0.55,
              maccabism: 8,
              confidence: -3,
              completeArc: 'europe_move',
              remember: 'struggled_abroad',
            },
          },
        ],
      },
    ],
  },

  /* ================================================================= */
  /* CALLBACKS - the career referencing itself                          */
  /* ================================================================= */
  {
    id: 'cb_penalty_again',
    kicker: 'דקה 84, שוויון',
    title: 'עוד פנדל',
    description:
      'השופט מצביע על הנקודה. אתה זוכר בדיוק איפה עמדת בפעם הקודמת, ואיך זה נגמר. הכדור אצלך ביד.',
    category: 'match_moment',
    conditions: {
      requiresMemory: ['penalty_miss'],
      memoryMinSeasonsAgo: 1,
      minRoleValue: 40,
      notPositions: ['GK'],
    },
    weight: 13,
    choices: [
      {
        id: 'take_it',
        label: 'לקחת אותו',
        hint: 'מאז אותו פנדל לא ניגשת',
        risk: 'risky',
        outcomes: [
          {
            id: 'buried_it',
            baseWeight: 52,
            tone: 'good',
            text: 'אותה פינה, הפעם בפנים. לא חגגת - רק הסתובבת והסתכלת על הספסל. יש דברים שסוגרים חשבון.',
            effects: {
              confidence: 14,
              reputation: 6,
              roleValue: 6,
              coachTrust: 5,
              remember: 'derby_hero',
              milestone: {
                id: 'penalty_redemption',
                icon: '🎯',
                text: 'סגרת חשבון עם הפנדל שהחמצת',
                major: true,
              },
            },
            modifiers: [
              { attribute: 'confidence', above: 60, multiplier: 1.4 },
              { attribute: 'ability', above: 68, multiplier: 1.3 },
            ],
            traitModifiers: [
              { trait: 'big_game', multiplier: 1.6 },
              { trait: 'self_believer', multiplier: 1.5 },
            ],
          },
          {
            id: 'again',
            baseWeight: 48,
            tone: 'bad',
            text: 'שוב. אתה לא מסתכל לאף אחד בעיניים עד סוף המשחק, ואולי עוד קצת אחרי.',
            effects: {
              confidence: -14,
              pressure: 10,
              roleValue: -4,
              remember: 'penalty_miss',
            },
            traitModifiers: [{ trait: 'self_believer', multiplier: 0.6 }],
          },
        ],
      },
      {
        id: 'let_someone',
        label: 'לתת למישהו אחר',
        risk: 'safe',
        outcomes: [
          {
            id: 'passed_it_on',
            baseWeight: 100,
            tone: 'neutral',
            text: 'מסרת את הכדור לקפטן והתרחקת. אף אחד לא אמר כלום. אתה כן שמעת את זה.',
            effects: { confidence: -4, pressure: -5 },
          },
        ],
      },
    ],
  },
  {
    id: 'cb_old_coach_remembers',
    kicker: 'המאמן החדש בצוות המקצועי',
    title: 'מישהו שמכיר אותך מפעם',
    description:
      'הוא אימן אותך בנערים, ועכשיו הוא חלק מהצוות של הקבוצה הבוגרת. הוא זוכר בדיוק איך הגבת כשהיה קשה.',
    category: 'coach',
    conditions: {
      requiresMemory: ['older_group_failure'],
      memoryMinSeasonsAgo: 3,
      bands: ['u19', 'senior'],
      atMaccabi: true,
    },
    weight: 11,
    oncePerCareer: true,
    choices: [
      {
        id: 'remind_him',
        label: 'להזכיר לו שהשתנית מאז',
        risk: 'balanced',
        outcomes: [
          {
            id: 'saw_it',
            baseWeight: 58,
            tone: 'good',
            text: '"אני יודע," הוא אומר. "ראיתי ילד שנשבר וקם. זה בדיוק מה שאמרתי עליך למעלה."',
            effects: { coachTrust: 10, confidence: 7, flags: ['first_team_radar'] },
            modifiers: [{ attribute: 'ability', above: 62, multiplier: 1.35 }],
            traitModifiers: [
              { trait: 'hard_worker', multiplier: 1.4 },
              { trait: 'late_bloomer', multiplier: 1.35 },
            ],
          },
          {
            id: 'still_the_kid',
            baseWeight: 42,
            tone: 'bad',
            text: 'הוא מחייך בנימוס. בראש שלו אתה עדיין הילד שלא עמד בקצב, וזה ייקח זמן לשנות.',
            effects: { coachTrust: -5, pressure: 5 },
          },
        ],
      },
      {
        id: 'show_him',
        label: 'לא לדבר. פשוט לשחק',
        risk: 'balanced',
        outcomes: [
          {
            id: 'proved_it',
            baseWeight: 62,
            tone: 'good',
            text: 'לא אמרת מילה. אחרי חודש הוא ניגש אליך מיוזמתו ואמר: "טעיתי בך."',
            effects: { coachTrust: 8, confidence: 6, ability: 1, revealTrait: 'hard_worker' },
            traitModifiers: [{ trait: 'professional', multiplier: 1.4 }],
          },
          {
            id: 'unnoticed',
            baseWeight: 38,
            tone: 'neutral',
            text: 'הוא עסוק בקבוצה הבוגרת ואתה עוד לא שם. אולי בעונה הבאה.',
            effects: { pressure: 3 },
          },
        ],
      },
    ],
  },
  {
    id: 'cb_released_return',
    kicker: 'לפני משחק מול מכבי חיפה',
    title: 'לשחק מול המועדון שוויתר עליך',
    description:
      'אותו מגרש אימונים שגדלת בו, אותם צבעים - רק שהפעם אתה בצד השני של המנהרה.',
    category: 'match_moment',
    conditions: {
      requiresMemory: ['released_by_maccabi'],
      memoryMinSeasonsAgo: 1,
      atMaccabi: false,
      abroad: false,
      minRoleValue: 40,
    },
    weight: 12,
    cooldownSeasons: 4,
    choices: [
      {
        id: 'prove_them',
        label: 'להראות להם מה הפסידו',
        risk: 'risky',
        outcomes: [
          {
            id: 'statement',
            baseWeight: 44,
            tone: 'good',
            preview: 'המשחק של העונה מולם, ושואלים למה בכלל שחררו אותך',
            text: 'שיחקת את המשחק של העונה מולם. ביציע הירוק היו כאלה ששאלו למה בכלל שחררו אותך.',
            effects: {
              reputation: 10,
              confidence: 11,
              roleValue: 7,
              transferChance: 0.2,
              milestone: {
                id: 'proved_maccabi_wrong',
                icon: '💥',
                text: 'שיחקת מול מכבי חיפה והוכחת שטעו בך',
                major: true,
              },
            },
            modifiers: [
              { attribute: 'ability', above: 66, multiplier: 1.45 },
              { attribute: 'form', above: 60, multiplier: 1.3 },
            ],
            traitModifiers: [{ trait: 'big_game', multiplier: 1.6 }],
          },
          {
            id: 'tried_too_hard',
            baseWeight: 56,
            tone: 'bad',
            preview: 'תרצה את זה יותר מדי, והחלפה בדקה 65',
            text: 'רצית את זה יותר מדי. משחק עצבני, מסירות ממהרות, והחלפה בדקה 65.',
            effects: { confidence: -7, form: -4, pressure: 7 },
          },
        ],
      },
      {
        id: 'just_a_game',
        label: 'זה עוד משחק',
        risk: 'safe',
        outcomes: [
          {
            id: 'composed',
            baseWeight: 100,
            tone: 'neutral',
            text: 'שיחקת בלי רגש מיותר, ואחרי המשחק לחצת יד למאמן שלא רצה אותך. גדלת.',
            effects: { maccabism: 4, discipline: 4, confidence: 3, leadership: 3 },
          },
        ],
      },
    ],
  },
];

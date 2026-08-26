import type { TraitId } from '../types';

/**
 * The trait vocabulary.
 *
 * Traits are personality, not attributes: one or two per career, hidden at first, and
 * revealed through narrative when the career shows them. `reveal` is the line the game uses
 * when it finally names the thing the player may already have suspected.
 */
export interface TraitDef {
  id: TraitId;
  label: string;
  /** Shown once revealed - short, no numbers. */
  description: string;
  /** The narrative line when the trait is revealed. */
  reveal: string;
  icon: string;
  /** Relative frequency at career creation. */
  weight: number;
}

export const TRAIT_DEFS: readonly TraitDef[] = [
  {
    id: 'professional',
    label: 'מקצוען',
    description: 'ישן, אוכל ומתאמן כמו שצריך. גם כשאף אחד לא מסתכל.',
    reveal: 'במחלקה מתחילים להשתמש בך כדוגמה. אתה השחקן שתמיד מוכן.',
    icon: '🧊',
    weight: 12,
  },
  {
    id: 'leader',
    label: 'מנהיג',
    description: 'מדבר בחדר ההלבשה, וכולם מקשיבים.',
    reveal: 'שמו לב שכשאתה מדבר, הקבוצה נשמעת אחרת. זה לא משהו שמלמדים.',
    icon: '🗣️',
    weight: 10,
  },
  {
    id: 'big_game',
    label: 'שחקן של משחקים גדולים',
    description: 'ככל שהמשחק גדול יותר, אתה טוב יותר.',
    reveal: 'המאמנים מתחילים להבין שאתה שחקן של משחקים גדולים. במשחקי חובה אתה פשוט אחר.',
    icon: '🔥',
    weight: 9,
  },
  {
    id: 'late_bloomer',
    label: 'פריחה מאוחרת',
    description: 'לא היה הכי טוב בשנתון. גם לא סיים ככה.',
    reveal: 'מי שסימן אותך בגיל 14 טעה. הגוף והראש הגיעו מאוחר - אבל הגיעו.',
    icon: '🌱',
    weight: 10,
  },
  {
    id: 'injury_prone',
    label: 'רגיש לפציעות',
    description: 'הגוף לא תמיד מחזיק את מה שהראש רוצה.',
    reveal: 'הרופאים מכירים אותך בשם. זה לא מקרי, וזה משהו שתלמד לחיות איתו.',
    icon: '🩹',
    weight: 8,
  },
  {
    id: 'hot_headed',
    label: 'חם מזג',
    description: 'משחק ברגש. לפעמים ביותר מדי רגש.',
    reveal: 'הצהובים שלך לא באים מחוסר יכולת. אתה פשוט לא יודע לשחק חצי.',
    icon: '🌡️',
    weight: 9,
  },
  {
    id: 'hard_worker',
    label: 'עובד קשה',
    description: 'האחרון שעוזב את המגרש, כל שבוע.',
    reveal: 'אתה תמיד האחרון שנשאר. במחלקה יודעים שאם משהו חסר לך - תעבוד על זה.',
    icon: '⚙️',
    weight: 12,
  },
  {
    id: 'self_believer',
    label: 'ביטחון עצמי',
    description: 'לא מתרגש. גם כשכדאי היה להתרגש.',
    reveal: 'רגעים שמשתקים שחקנים אחרים לא עושים לך כלום. אתה פשוט מאמין.',
    icon: '😤',
    weight: 10,
  },
];

export const TRAITS_BY_ID: Record<TraitId, TraitDef> = Object.fromEntries(
  TRAIT_DEFS.map((t) => [t.id, t]),
) as Record<TraitId, TraitDef>;

export function traitLabel(id: TraitId): string {
  return TRAITS_BY_ID[id].label;
}

import type { Career } from '../types';

/**
 * Lightweight achievement definitions.
 * `check` runs after every simulated season; each achievement can only fire once.
 */
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Celebrations with `major: true` get the big confetti moment. */
  major?: boolean;
  check?: (career: Career) => boolean;
}

export const ACHIEVEMENT_DEFS: AchievementDefinition[] = [
  {
    id: 'first_senior_game',
    name: 'הבכורה',
    description: 'המשחק הראשון בחולצה הירוקה של הבוגרים.',
    icon: '👕',
    major: true,
    check: (c) => c.maccabi.appearances >= 1,
  },
  {
    id: 'first_goal',
    name: 'השער הראשון',
    description: 'רשמת את השם שלך על לוח התוצאות.',
    icon: '⚽',
    check: (c) => c.stats.goals >= 1,
  },
  {
    id: 'fifty_maccabi',
    name: '50 במדים',
    description: '50 הופעות במכבי חיפה.',
    icon: '5️⃣',
    check: (c) => c.maccabi.appearances >= 50,
  },
  {
    id: 'hundred_maccabi',
    name: 'מאה ירוקה',
    description: '100 הופעות במכבי חיפה.',
    icon: '💯',
    major: true,
    check: (c) => c.maccabi.appearances >= 100,
  },
  {
    id: 'two_hundred_maccabi',
    name: 'איש המועדון',
    description: '200 הופעות במכבי חיפה.',
    icon: '🏛️',
    major: true,
    check: (c) => c.maccabi.appearances >= 200,
  },
  {
    id: 'first_championship',
    name: 'אליפות ראשונה',
    description: 'הרמת את הצלחת.',
    icon: '🏆',
    major: true,
    check: (c) => c.maccabi.championships >= 1,
  },
  {
    id: 'triple_championship',
    name: 'שושלת',
    description: 'שלוש אליפויות עם מכבי חיפה.',
    icon: '👑',
    major: true,
    check: (c) => c.maccabi.championships >= 3,
  },
  {
    id: 'captain',
    name: 'הסרט על הזרוע',
    description: 'קפטן מכבי חיפה.',
    icon: '🅲',
    major: true,
    check: (c) => c.maccabi.captainSeasons >= 1,
  },
  {
    id: 'early_promotion',
    name: 'הוקפצת שנתון',
    description: 'דילגת על שלב שלם בסולם של המחלקה.',
    icon: '⬆️',
    major: true,
    check: (c) => c.maccabi.earlyPromotions >= 1,
  },
  {
    id: 'tournament_star',
    name: 'שחקן הטורניר',
    description: 'היית הטוב ביותר בטורניר בינלאומי.',
    icon: '🏅',
    major: true,
  },
  {
    id: 'coach_favourite',
    name: 'המאמן סומך עליך',
    description: 'אמון המאמן 90 ומעלה.',
    icon: '🤝',
    check: (c) => c.coachTrust >= 90,
  },
  {
    id: 'academy_graduate',
    name: 'בוגר האקדמיה',
    description: 'עשית את כל הדרך מטרום ב׳ ועד הבוגרים של מכבי חיפה.',
    icon: '🌱',
    major: true,
    check: (c) => c.maccabi.academyGraduate,
  },
  {
    id: 'derby_moment',
    name: 'הרגע בדרבי',
    description: 'שער שהשתיק אצטדיון שלם.',
    icon: '🔥',
    major: true,
  },
  {
    id: 'elite_ability',
    name: 'רמה אירופית',
    description: 'יכולת 85 ומעלה.',
    icon: '📈',
    check: (c) => c.ability >= 85,
  },
  {
    id: 'world_class',
    name: 'ברמה עולמית',
    description: 'יכולת 92 ומעלה.',
    icon: '🌟',
    major: true,
    check: (c) => c.ability >= 92,
  },
  {
    id: 'full_maccabist',
    name: 'מכביסט אמיתי',
    description: 'מכביסטיות 95 ומעלה.',
    icon: '💚',
    major: true,
    check: (c) => c.maccabism >= 95,
  },
  {
    id: 'europe_adventure',
    name: 'הרפתקה אירופית',
    description: 'חתמת במועדון אירופי.',
    icon: '✈️',
    check: (c) => c.maccabi.everLeft,
  },
  {
    id: 'homecoming',
    name: 'חוזרים הביתה',
    description: 'חזרת למכבי חיפה אחרי שעזבת.',
    icon: '🏠',
    major: true,
    check: (c) => c.maccabi.returned,
  },
  {
    id: 'europe_trophy',
    name: 'תואר בחו״ל',
    description: 'זכית בתואר מחוץ לישראל.',
    icon: '🏅',
    check: (c) => c.trophies.some((t) => t.clubId !== 'maccabi_haifa' && t.weight >= 0.5),
  },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDefinition> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((a) => [a.id, a]),
);

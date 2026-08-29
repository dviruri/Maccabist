import { getClub } from './clubs';
import type { Career, CareerEnding } from '../types';

/** Senior clubs only - the academy and the youth team are not "another shirt". */
function seniorClubCount(career: Career): number {
  const ids = career.seasonHistory
    .map((s) => s.clubId)
    .filter((id) => getClub(id).isSenior === true);
  return new Set(ids).size;
}

export interface EndingDefinition extends CareerEnding {
  /** Higher priority wins when several endings match. */
  priority: number;
  matches: (career: Career, score: number) => boolean;
}

/**
 * Career archetypes shown on the retirement card.
 * Checked from the highest priority down; `fallback` always matches last.
 */
export const ENDINGS: EndingDefinition[] = [
  {
    id: 'green_legend',
    title: 'אגדה ירוקה',
    subtitle: 'השם שלך על הקיר של סמי עופר',
    description:
      'לא עוד שחקן טוב שעבר במועדון. אתה חלק מהסיפור שמספרים לילדים ביציע. שירים, קעקועים, וילדים שנולדו עם השם שלך על הגב.',
    icon: '💚',
    priority: 100,
    matches: (_c, score) => score >= 86,
  },
  {
    id: 'the_symbol',
    title: 'הסמל',
    subtitle: 'קפטן. שנים. בלי לוותר.',
    description:
      'אף פעם לא היית הכי מוכשר בליגה, אבל היית שם בכל עונה, בכל קרב, עם הסרט על הזרוע. במכבי חיפה זוכרים אותך כאיש שהחזיק את המועדון.',
    /*
     * v0.5.1: was U+1F172 - the NEGATIVE SQUARED LATIN CAPITAL LETTER C, presumably chosen as
     * "C for captain". Every major emoji font renders it as a RED tile, so the most Maccabi
     * ending in the game wore the one colour Maccabi's identity does not use, and did it with a
     * Latin letter under a Hebrew title. A shield instead - the same emblem the `one_club_icon`
     * archetype already uses for this exact title, so the two agree.
     *
     * (Only this ending's `description` reaches the poster today - the displayed icon comes from
     * `ARCHETYPES` - but a red glyph left sitting in the data is a red glyph waiting to be
     * rendered by whatever reads this next.)
     */
    icon: '💚',
    priority: 90,
    matches: (c, score) => c.maccabi.captainSeasons >= 4 && c.maccabi.seasons >= 8 && score >= 62,
  },
  {
    id: 'prodigal_son',
    title: 'הבן האובד',
    subtitle: 'עזבת, הצלחת, וחזרת הביתה',
    description:
      'יצאת לאירופה כשכולם אמרו שלא תחזור. חזרת. והיציע קיבל אותך כאילו לא עברת שם אף יום.',
    icon: '🏠',
    priority: 85,
    matches: (c, score) =>
      c.maccabi.everLeft && c.maccabi.returned && c.maccabi.seasonsAfterReturn >= 2 && score >= 52,
  },
  {
    id: 'euro_star',
    title: 'הכוכב האירופי',
    subtitle: 'קריירה ענקית. רק לא כאן.',
    description:
      'עשית קריירה שכל ילד בישראל חולם עליה: אצטדיונים גדולים, ליגות גדולות, כסף גדול. במכבי חיפה עדיין שואלים מה היה קורה אם היית נשאר עוד קצת.',
    icon: '✈️',
    priority: 80,
    matches: (c) => c.peakAbility >= 83 && c.maccabi.everLeft && c.maccabi.seasons <= 6,
  },
  {
    id: 'crowd_favourite',
    title: 'יקיר הקהל',
    subtitle: 'לא הכי טוב. הכי שלנו.',
    description:
      'היו שחקנים טובים ממך. לא היו שחקנים שהיציע אהב יותר. רצת על כל כדור כאילו זה גמר גביע, והקהל החזיר לך באהבה.',
    icon: '📣',
    priority: 70,
    matches: (c, score) => c.maccabism >= 80 && c.maccabi.appearances >= 80 && score >= 42,
  },
  {
    id: 'one_of_us',
    title: 'אחד משלנו',
    subtitle: 'בוגר האקדמיה שהחזיק שנים',
    description:
      'התחלת כילד במגרשי האימונים וסיימת עם מאות משחקים בחולצה. לא כל אחד מצליח לעשות את הדרך הזו עד הסוף.',
    icon: '🌱',
    priority: 60,
    matches: (c, score) => c.maccabi.academyGraduate && c.maccabi.seasons >= 5 && score >= 34,
  },
  {
    id: 'unfulfilled',
    title: 'הבטחה שלא התממשה',
    subtitle: 'כולם ידעו שיש לך את זה',
    description:
      'המאמנים אמרו שאתה הדבר הבא. הפציעות, ההחלטות, המזל - משהו לא הסתדר. הכישרון היה שם. הקריירה פחות.',
    icon: '🌫️',
    priority: 50,
    matches: (c) => c.hidden.potential - c.peakAbility >= 16 && c.peakAbility < 76,
  },
  {
    id: 'journeyman',
    title: 'הנווד',
    subtitle: 'הרבה מדים, מעט בית',
    description:
      'עברת בין מועדונים, שיחקת הרבה כדורגל, והתפרנסת בכבוד. פשוט אף יציע לא הרגיש שאתה שלו.',
    icon: '🧳',
    priority: 40,
    matches: (c) => seniorClubCount(c) >= 4 && c.maccabi.appearances < 70,
  },
  {
    id: 'other_road',
    title: 'הדרך האחרת',
    subtitle: 'לא הסתדר בחיפה. שיחקת בכל זאת.',
    description:
      'החלום היה מגרש אחד, והקריירה קרתה במגרשים אחרים. עשית שנים של כדורגל אמיתי, רק לא מול היציע שגידל אותך.',
    icon: '🛣️',
    priority: 45,
    matches: (c) => c.maccabi.appearances < 45 && c.stats.appearances >= 160,
  },
  {
    id: 'fallback',
    title: 'שחקן כדורגל',
    subtitle: 'קריירה מכובדת',
    description:
      'שיחקת כדורגל מקצועני, לבשת את החולצה של מכבי חיפה, ויש לך סיפורים לספר. לא כל אחד הגיע לשם.',
    icon: '⚽',
    priority: 0,
    matches: () => true,
  },
];

export function resolveEnding(career: Career, score: number): CareerEnding {
  const sorted = [...ENDINGS].sort((a, b) => b.priority - a.priority);
  const match = sorted.find((ending) => ending.matches(career, score)) ?? sorted[sorted.length - 1];
  const { id, title, subtitle, description, icon } = match as EndingDefinition;
  return { id, title, subtitle, description, icon };
}

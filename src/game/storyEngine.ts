/**
 * The career, told as a story.
 *
 * Retirement should say more than "83". This builds a short narrative out of what actually
 * happened - structured templates over career flags, memories and milestones, never an LLM -
 * and picks an archetype from the shape of the career rather than from the Legend Score alone.
 *
 * Pure and deterministic: the same career always produces the same story.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import { TRAITS_BY_ID } from '../data/traits';
import type { Career, TraitId } from '../types';
import { hasMemory, hasTrait } from './memory';

/* ------------------------------------------------------------------ */
/* Archetypes                                                          */
/* ------------------------------------------------------------------ */

export interface Archetype {
  id: string;
  title: string;
  /** One line describing the kind of career this was. */
  subtitle: string;
  icon: string;
}

interface ArchetypeRule extends Archetype {
  /** Higher wins when several match. */
  priority: number;
  matches(career: Career): boolean;
}

const m = (career: Career) => career.maccabi;

/**
 * Ordered by how specific the story is, not by how good the career was - a wrecked knee at 24
 * is a more distinctive story than a solid mid-table career, so it wins the label.
 */
const ARCHETYPES: readonly ArchetypeRule[] = [
  {
    id: 'legend',
    title: 'אגדה ירוקה',
    subtitle: 'שם שלא צריך הסבר בחיפה',
    icon: '👑',
    priority: 100,
    matches: (c) => m(c).appearances >= 300 && m(c).championships >= 2 && m(c).captainSeasons >= 3,
  },
  {
    id: 'one_club_icon',
    title: 'הסמל',
    subtitle: 'מועדון אחד, קריירה שלמה',
    icon: '🛡️',
    priority: 92,
    matches: (c) => !m(c).everLeft && m(c).appearances >= 220 && m(c).academyGraduate,
  },
  {
    id: 'prodigal_son',
    title: 'הבן האובד',
    subtitle: 'יצאת, ראית עולם, וחזרת הביתה',
    icon: '💚',
    priority: 88,
    matches: (c) => m(c).returned && m(c).seasonsAfterReturn >= 3 && m(c).appearances >= 120,
  },
  {
    id: 'redemption',
    title: 'מי שלא רצו',
    subtitle: 'שחררו אותך בגיל 18 - וחזרת בדלת הראשית',
    icon: '🔁',
    priority: 90,
    matches: (c) => hasMemory(c, 'released_by_maccabi') && m(c).returned && m(c).appearances >= 60,
  },
  {
    id: 'european_star',
    title: 'הכוכב האירופי',
    subtitle: 'הכדורגל שלך גדל מחוץ לישראל',
    icon: '🌍',
    priority: 80,
    matches: (c) =>
      c.seasonHistory.filter((s) => getClub(s.clubId).country !== 'ישראל' && s.stats.appearances > 10)
        .length >= 4 && c.peakAbility >= 78,
  },
  {
    id: 'interrupted',
    title: 'הקריירה שנקטעה',
    subtitle: 'הגוף לא נתן לך להגיע לאן שהיית אמור',
    icon: '🩼',
    priority: 86,
    matches: (c) =>
      hasMemory(c, 'major_injury') &&
      c.hidden.potential - c.peakAbility >= 12 &&
      c.seasonHistory.filter((s) => s.stats.injuredGames > 0).length >= 3,
  },
  {
    id: 'late_bloom',
    title: 'הפריחה המאוחרת',
    subtitle: 'אף אחד לא סימן אותך. בסוף כולם ידעו את השם',
    icon: '🌱',
    priority: 84,
    matches: (c) => {
      const at18 = c.seasonHistory.find((s) => s.age === 18);
      return at18 !== undefined && at18.ability <= 60 && c.peakAbility >= 76;
    },
  },
  {
    id: 'unfulfilled',
    title: 'ההבטחה שלא התממשה',
    subtitle: 'הכול היה שם. משהו לא נפתח',
    icon: '🌘',
    priority: 82,
    matches: (c) => c.hidden.potential >= 84 && c.peakAbility <= c.hidden.potential - 16,
  },
  {
    id: 'leader',
    title: 'המנהיג',
    subtitle: 'לא הטוב ביותר. זה שכולם הסתכלו עליו',
    icon: '🗣️',
    priority: 76,
    matches: (c) => m(c).captainSeasons >= 4 && c.hidden.leadership >= 74,
  },
  {
    id: 'fan_favourite',
    title: 'יקיר הקהל',
    subtitle: 'היציע שר את השם שלך, וזה הספיק',
    icon: '📣',
    priority: 70,
    matches: (c) => c.flags.includes('fan_favourite') && m(c).appearances >= 100,
  },
  {
    id: 'professional',
    title: 'המקצוען',
    subtitle: 'חמש עשרה שנה בלי לפספס אימון',
    icon: '🧊',
    priority: 58,
    /*
     * Keyed off the trait, not a discipline threshold. Discipline drifts upward across a long
     * career, so any threshold matched almost everyone and this became the label on 46-48% of
     * careers - a catch-all is worse than a neutral label. A personality archetype should come
     * from personality.
     */
    matches: (c) =>
      c.seasonHistory.length >= 14 && c.stats.appearances >= 150 && hasTrait(c, 'professional'),
  },
  {
    // A full professional career with some Maccabi football in it, but never the main man.
    id: 'solid_pro',
    title: 'שחקן של הליגה',
    subtitle: 'קריירה מלאה, בלי אורות גדולים',
    icon: '🎽',
    priority: 34,
    matches: (c) => c.stats.appearances >= 180 && m(c).appearances >= 25 && m(c).appearances < 100,
  },
  {
    // A full professional career that simply happened somewhere else.
    id: 'other_path',
    title: 'הדרך האחרת',
    subtitle: 'קריירה שלמה - רק לא בחיפה',
    icon: '🚏',
    priority: 32,
    matches: (c) => c.stats.appearances >= 150 && m(c).appearances < 25,
  },
  {
    id: 'journeyman',
    title: 'הנווד',
    subtitle: 'הרבה מועדונים, הרבה חדרי הלבשה',
    icon: '🧳',
    priority: 60,
    matches: (c) => new Set(c.seasonHistory.map((s) => s.clubId)).size >= 5,
  },
  {
    id: 'never_made_it',
    title: 'הדרך האחרת',
    subtitle: 'לא הגעת לשם, אבל שיחקת כדורגל',
    icon: '🚏',
    priority: 20,
    matches: (c) => m(c).appearances < 20,
  },
  {
    id: 'footballer',
    title: 'שחקן כדורגל',
    subtitle: 'קריירה מקצועית, בלי כותרות גדולות',
    icon: '⚽',
    priority: 0,
    matches: () => true,
  },
];

/** The archetype the career earned - from its shape, not from its score. */
export function careerArchetype(career: Career): Archetype {
  let best: ArchetypeRule | null = null;
  for (const rule of ARCHETYPES) {
    if (!rule.matches(career)) continue;
    if (best === null || rule.priority > best.priority) best = rule;
  }
  const chosen = best ?? ARCHETYPES[ARCHETYPES.length - 1]!;
  return { id: chosen.id, title: chosen.title, subtitle: chosen.subtitle, icon: chosen.icon };
}

/* ------------------------------------------------------------------ */
/* The closing narrative                                               */
/* ------------------------------------------------------------------ */

/**
 * Two to four sentences about this specific career, assembled from what happened.
 * Each block contributes at most one line, so the result stays short.
 */
export function careerStory(career: Career): string[] {
  const lines: string[] = [];
  const r = career.maccabi;
  const clubs = new Set(career.seasonHistory.map((s) => s.clubId));
  const abroad = career.seasonHistory.filter(
    (s) => getClub(s.clubId).country !== 'ישראל' && s.stats.appearances > 5,
  );

  /* ---------- how it began ---------- */
  // A single cup appearance is not "all the way to the first team shirt".
  if (r.academyGraduate && r.appearances >= 10) {
    lines.push(
      `התחלת בטרום ב׳ בגיל תשע, ועשית את כל הדרך עד החולצה של הקבוצה הבוגרת של מכבי חיפה.`,
    );
  } else if (hasMemory(career, 'released_by_maccabi')) {
    lines.push(
      'עשית את כל הדרך במחלקת הנוער של מכבי חיפה, ובגיל 18 אמרו לך שזה לא יקרה כאן.',
    );
  } else {
    lines.push('גדלת במחלקת הנוער של מכבי חיפה, ומשם הקריירה לקחה אותך למקום אחר.');
  }

  /* ---------- the middle ---------- */
  if (hasMemory(career, 'major_injury') && career.hidden.potential - career.peakAbility >= 10) {
    lines.push('פציעה אחת בזמן הלא נכון לקחה ממך חלק ממה שהיית אמור להיות.');
  } else if (abroad.length >= 3) {
    const where = getClub(abroad[0]!.clubId).country;
    lines.push(`עברת ל${where} ובנית שם קריירה אמיתית, רחוק מהבית.`);
  } else if (clubs.size >= 5) {
    lines.push('החלפת הרבה מועדונים. בכל אחד מהם היה מישהו ששמח שבאת.');
  } else if (r.appearances >= 150 && !r.everLeft) {
    lines.push('אף פעם לא עזבת. היו הצעות, והיו סיבות להגיד כן, ואמרת לא.');
  }

  /* ---------- the turn ---------- */
  if (r.returned && hasMemory(career, 'released_by_maccabi')) {
    lines.push(
      `חזרת למכבי חיפה בגיל ${r.returnAge} - למועדון שלא רצה אותך - והפעם נשארת ${r.seasonsAfterReturn} עונות.`,
    );
  } else if (r.returned) {
    lines.push(`בגיל ${r.returnAge} חזרת הביתה, וסגרת את המעגל שהתחיל במגרשי האימונים.`);
  } else if (hasMemory(career, 'refused_transfer')) {
    lines.push('סירבת להצעה שהייתה משנה לך את החיים כדי להישאר. בחיפה זוכרים את זה.');
  }

  /* ---------- how it is remembered ---------- */
  if (r.captainSeasons >= 3 && r.championships >= 1) {
    lines.push(
      `${r.captainSeasons} עונות עם הסרט ו-${r.championships} אליפויות. השם שלך נשאר במועדון גם אחרי שהנעליים ירדו.`,
    );
  } else if (r.championships >= 1) {
    lines.push(`הרמת ${r.championships === 1 ? 'אליפות' : `${r.championships} אליפויות`} עם מכבי חיפה.`);
  } else if (r.appearances >= 100) {
    lines.push(`${r.appearances} הופעות בירוק, בלי תואר גדול. גם זו קריירה שרוב האנשים היו רוצים.`);
  } else if (r.appearances > 0 && r.appearances < 25) {
    lines.push(
      `בקבוצה הבוגרת של מכבי חיפה הספקת ${count(r.appearances, 'הופעה אחת', 'הופעות')} בלבד. את השאר עשית במקומות אחרים.`,
    );
  } else if (r.appearances === 0) {
    lines.push('לא שיחקת דקה בקבוצה הבוגרת של מכבי חיפה. שיחקת כדורגל מקצועי, וזה לא מובן מאליו.');
  }

  /* ---------- who you were ---------- */
  const traits = career.traits.map((t) => t.id);
  const traitLine = traitSentence(traits);
  if (traitLine) lines.push(traitLine);

  return lines;
}

function traitSentence(traits: TraitId[]): string | null {
  if (traits.length === 0) return null;
  const labels = traits.map((t) => TRAITS_BY_ID[t].label);
  if (labels.length === 1) {
    return `אם היו צריכים לתאר אותך במילה אחת, היו אומרים: ${labels[0]}.`;
  }
  return `מי שאימן אותך היה מתאר אותך כך: ${labels[0]}, ו${labels[1]}.`;
}

/** Hebrew reads badly with a bare "1" - "הופעה אחת", not "1 הופעות". */
function count(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : `${value} ${plural}`;
}

/** Headline stat line for the retirement card. */
export function careerHeadline(career: Career): string {
  const r = career.maccabi;
  if (r.appearances === 0) return 'קריירה מקצועית מחוץ למכבי חיפה';
  const bits = [count(r.appearances, 'הופעה אחת', 'הופעות')];
  if (r.goals > 0) bits.push(count(r.goals, 'שער אחד', 'שערים'));
  if (r.championships > 0) bits.push(count(r.championships, 'אליפות אחת', 'אליפויות'));
  if (r.captainSeasons > 0) bits.push(count(r.captainSeasons, 'עונה כקפטן', 'עונות כקפטן'));
  return bits.join(' · ');
}

/** True when this career is worth calling out as unusual on the welcome screen. */
export function isUnusualCareer(career: Career): boolean {
  return (
    (career.maccabi.returned && hasMemory(career, 'released_by_maccabi')) ||
    career.maccabi.earlyPromotions >= 2 ||
    (career.hidden.potential <= 72 && career.peakAbility >= 82) ||
    career.currentClubId === MACCABI_ID && career.maccabi.captainSeasons >= 5
  );
}

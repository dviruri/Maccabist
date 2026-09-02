/**
 * Automatic career milestones.
 *
 * Events can write their own milestones, but the big structural beats - first senior
 * appearance, first goal, a first championship, moving abroad, coming home - are not events,
 * they fall out of the season simulation. This checks for them once a season, the same way
 * achievements are checked, so the timeline stays complete without every event having to
 * remember to record one.
 *
 * Deduplicated by id inside addMilestone, so re-checking is free of duplicates.
 */

import { getClub, MACCABI_ID } from '../data/clubs';
import type { Career, Milestone } from '../types';
import { addMilestone } from './progressionEngine';
import { countsForMaccabiLegacy, isInAcademy } from './rules';

interface MilestoneCheck {
  id: string;
  icon: string;
  major: boolean;
  applies(career: Career): boolean;
  text(career: Career): string;
}

const CHECKS: readonly MilestoneCheck[] = [
  {
    id: 'first_senior_appearance',
    icon: '⚽',
    major: true,
    applies: (c) => !isInAcademy(c) && c.stats.appearances > 0,
    text: (c) => `הופעת הבכורה שלך בכדורגל הבוגרים, ב${getClub(c.currentClubId).name}`,
  },
  {
    id: 'maccabi_debut',
    icon: '💚',
    major: true,
    applies: (c) => c.maccabi.appearances > 0,
    text: (c) => `הופעת בכורה בקבוצה הבוגרת של מכבי חיפה, בגיל ${c.maccabi.debutAge ?? c.age}`,
  },
  {
    id: 'first_senior_goal',
    icon: '🥅',
    major: false,
    applies: (c) => !isInAcademy(c) && c.stats.goals > 0,
    text: () => 'השער הראשון שלך בבוגרים',
  },
  {
    id: 'first_championship',
    icon: '🏆',
    major: true,
    applies: (c) => c.trophies.some((t) => t.id === 'championship'),
    text: (c) => {
      const trophy = c.trophies.find((t) => t.id === 'championship');
      return `אליפות ראשונה עם ${trophy?.clubName ?? 'מכבי חיפה'}`;
    },
  },
  {
    id: 'first_cup',
    icon: '🥇',
    major: false,
    applies: (c) => c.trophies.some((t) => t.id === 'cup'),
    text: () => 'גביע המדינה',
  },
  {
    id: 'moved_abroad',
    icon: '🌍',
    major: true,
    applies: (c) => getClub(c.currentClubId).country !== 'ישראל',
    text: (c) => `עברת ל${getClub(c.currentClubId).name}, ${getClub(c.currentClubId).country}`,
  },
  {
    id: 'returned_home',
    icon: '💚',
    major: true,
    applies: (c) => c.maccabi.returned && c.currentClubId === MACCABI_ID,
    text: (c) => `חזרת הביתה למכבי חיפה בגיל ${c.maccabi.returnAge ?? c.age}`,
  },
  {
    id: 'hundred_maccabi_games',
    icon: '💯',
    major: false,
    applies: (c) => c.maccabi.appearances >= 100,
    text: () => '100 הופעות במדי מכבי חיפה',
  },
  {
    id: 'three_hundred_maccabi_games',
    icon: '🏛️',
    major: true,
    applies: (c) => c.maccabi.appearances >= 300,
    text: () => '300 הופעות במדי מכבי חיפה',
  },
  {
    id: 'european_football',
    icon: '✨',
    major: false,
    applies: (c) => c.maccabi.europeanRuns > 0 && countsForMaccabiLegacy(c),
    text: () => 'ערב אירופי בסמי עופר',
  },
];

/** Runs every automatic milestone check. Cheap, and idempotent. */
export function checkMilestones(career: Career): { career: Career; unlocked: Milestone[] } {
  let next = career;
  const before = career.milestones.length;

  for (const check of CHECKS) {
    if (next.milestones.some((m) => m.id === check.id)) continue;
    if (!check.applies(next)) continue;
    next = addMilestone(next, {
      id: check.id,
      icon: check.icon,
      text: check.text(next),
      major: check.major,
    });
  }

  return { career: next, unlocked: next.milestones.slice(before) };
}

/**
 * מדד אגדה - the Legend Score.
 *
 * This is deliberately NOT a measure of how good a footballer you were.
 * It answers a different question: how big a Maccabi Haifa legend did you become?
 * A world-class player who passed through for two seasons should score lower than a
 * long-serving captain who lifted trophies in green.
 *
 * All weights and targets live in balance.ts (LEGEND) so this is easy to rebalance.
 */

import { resolveEnding } from '../data/endings';
import { MACCABI_ID } from '../data/clubs';
import type { Career, CareerEnding, LegendComponent, LegendResult } from '../types';
import { LEGEND } from './balance';
import { clamp, round } from './random';
import { outputScore } from './rules';
import { careerArchetype, careerStory } from './storyEngine';

/** Diminishing-returns curve: fast early progress, slow at the top. */
function ratio(value: number, target: number): number {
  if (target <= 0) return 0;
  return clamp(Math.min(1, value / target) ** 0.85, 0, 1);
}

export function computeLegendComponents(career: Career): LegendComponent[] {
  const m = career.maccabi;
  const w = LEGEND.weights;
  const t = LEGEND.targets;

  const output = outputScore(m.goals, m.assists, career.position, m.cleanSheets);

  const titlePoints = career.trophies
    .filter((trophy) => trophy.clubId === MACCABI_ID)
    .reduce((sum, trophy) => sum + trophy.weight, 0);

  const europePoints = career.trophies
    .filter((trophy) => trophy.clubId !== MACCABI_ID)
    .reduce((sum, trophy) => sum + trophy.weight * 4, 0)
    + career.seasonHistory
      .filter((s) => s.league !== 'ליגת העל' && s.stats.appearances > 12)
      .length * 3
    + Math.max(0, career.peakAbility - 78) * 0.9;

  const components: LegendComponent[] = [
    {
      key: 'appearances',
      label: 'הופעות במכבי',
      points: ratio(m.appearances, t.appearances) * w.appearances,
      max: w.appearances,
      detail: `${m.appearances} הופעות`,
    },
    {
      key: 'output',
      // Not "attacking contribution" - for a keeper or a centre back the contribution is
      // clean sheets, and the label has to be able to mean both.
      label: 'תרומה למשחק',
      points: ratio(output, t.output) * w.output,
      max: w.output,
      detail:
        career.position === 'GK'
          ? `${m.cleanSheets} שערים נקיים`
          : `${m.goals} שערים, ${m.assists} בישולים`,
    },
    {
      key: 'seasons',
      label: 'עונות בירוק',
      points: ratio(m.seasons, t.seasons) * w.seasons,
      max: w.seasons,
      detail: `${m.seasons} עונות`,
    },
    {
      key: 'titles',
      label: 'תארים עם מכבי',
      points: ratio(titlePoints, t.titles) * w.titles,
      max: w.titles,
      detail: `${m.championships} אליפויות, ${m.cups} גביעים`,
    },
    {
      key: 'captain',
      label: 'קפטן',
      points: ratio(m.captainSeasons, t.captain) * w.captain,
      max: w.captain,
      detail: m.captainSeasons > 0 ? `${m.captainSeasons} עונות עם הסרט` : 'לא היית קפטן',
    },
    {
      key: 'academy',
      label: 'בוגר האקדמיה',
      points: m.academyGraduate ? w.academy : 0,
      max: w.academy,
      detail: m.academyGraduate ? 'עשית את כל הדרך מהילדים' : 'לא פרצת מהמחלקה',
    },
    {
      key: 'maccabism',
      label: 'מכביסטיות',
      points: (career.maccabism / 100) * w.maccabism,
      max: w.maccabism,
      detail: `${Math.round(career.maccabism)}/100`,
    },
    {
      key: 'homecoming',
      label: 'החזרה הביתה',
      points: m.returned ? w.homecoming * (0.45 + 0.55 * ratio(m.seasonsAfterReturn, t.homecomingSeasons)) : 0,
      max: w.homecoming,
      detail: m.returned ? `חזרת בגיל ${m.returnAge} ל-${m.seasonsAfterReturn} עונות` : 'לא הייתה חזרה',
    },
    {
      key: 'europe',
      label: 'קריירה באירופה',
      points: ratio(europePoints, t.europe) * w.europe,
      max: w.europe,
      detail: m.everLeft ? 'עשית קריירה גם בחוץ' : 'כל הקריירה בישראל',
    },
  ];

  return components.map((c) => ({ ...c, points: round(c.points, 1) }));
}

export function computeLegendScore(career: Career): LegendResult {
  const components = computeLegendComponents(career);
  let score = components.reduce((sum, c) => sum + c.points, 0);

  // Capped so a career cannot be won or lost on these alone.
  score += Math.min(6, career.maccabi.loyaltyMoments * LEGEND.loyaltyBonus);
  score -= Math.min(14, career.maccabi.betrayalMoments * LEGEND.betrayalPenalty);

  if (career.maccabi.appearances === 0) {
    score = Math.min(score, LEGEND.neverPlayedForMaccabiCap);
  }

  const finalScore = Math.round(clamp(score, 0, 100));

  /*
   * The archetype comes from the shape of the career, not from the score. Two players can
   * both finish on 70 having lived completely different lives - one never left, one built a
   * career in Europe - and the label should say which. resolveEnding stays as the fallback
   * for careers distinctive enough in score terms but not in story terms.
   */
  const archetype = careerArchetype(career);
  const fallback = resolveEnding(career, finalScore);
  const ending: CareerEnding = {
    id: archetype.id,
    title: archetype.title,
    subtitle: archetype.subtitle,
    description: careerStory(career).join(' ') || fallback.description,
    icon: archetype.icon,
  };

  return { score: finalScore, components, ending };
}

import type { AcademyStage, StageBand } from '../types';

/**
 * The Maccabi Haifa academy ladder.
 *
 * This table is the player's identity for the whole youth career - age is secondary.
 * Adding or re-ordering a stage is pure data work; the engine reads `order` and `next`.
 */
export interface AcademyStageConfig {
  id: AcademyStage;
  /** User-facing Hebrew label. */
  label: string;
  band: StageBand;
  order: number;
  /** The age a player normally arrives at this stage. */
  typicalAge: number;
  /** Level of the age group - what the player has to beat to get minutes. */
  quality: number;
  /** How much the stage develops a player. */
  development: number;
  seasonGames: number;
  league: string;
  /** Which club entity backs this stage (for Maccabi legacy bookkeeping). */
  clubId: string;
  /** How many decision points a season at this stage should contain. */
  minEvents: number;
  maxEvents: number;
  /** Younger stages skip the half-way card to keep the pace up. */
  showMidSeason: boolean;
}

const stages: AcademyStageConfig[] = [
  {
    id: 'pre_b',
    label: 'טרום ב׳',
    band: 'children',
    order: 0,
    typicalAge: 9,
    quality: 18,
    development: 76,
    seasonGames: 16,
    league: 'ליגת טרום ב׳',
    clubId: 'maccabi_academy',
    minEvents: 1,
    maxEvents: 1,
    showMidSeason: false,
  },
  {
    id: 'pre_a',
    label: 'טרום א׳',
    band: 'children',
    order: 1,
    typicalAge: 10,
    quality: 23,
    development: 78,
    seasonGames: 18,
    league: 'ליגת טרום א׳',
    clubId: 'maccabi_academy',
    minEvents: 1,
    maxEvents: 1,
    showMidSeason: false,
  },
  {
    id: 'children_c',
    label: 'ילדים ג׳',
    band: 'children',
    order: 2,
    typicalAge: 11,
    quality: 28,
    development: 80,
    seasonGames: 20,
    league: 'ליגת ילדים ג׳',
    clubId: 'maccabi_academy',
    minEvents: 1,
    maxEvents: 2,
    showMidSeason: false,
  },
  {
    id: 'children_b',
    label: 'ילדים ב׳',
    band: 'children',
    order: 3,
    typicalAge: 12,
    quality: 33,
    development: 82,
    seasonGames: 22,
    league: 'ליגת ילדים ב׳',
    clubId: 'maccabi_academy',
    minEvents: 1,
    maxEvents: 2,
    showMidSeason: false,
  },
  {
    id: 'children_a',
    label: 'ילדים א׳',
    band: 'children',
    order: 4,
    typicalAge: 13,
    quality: 38,
    development: 83,
    seasonGames: 24,
    league: 'ליגת ילדים א׳',
    clubId: 'maccabi_academy',
    minEvents: 1,
    maxEvents: 2,
    showMidSeason: false,
  },
  {
    id: 'youth_c',
    label: 'נערים ג׳',
    band: 'teens',
    order: 5,
    typicalAge: 14,
    quality: 45,
    development: 84,
    seasonGames: 26,
    league: 'ליגת נערים ג׳',
    clubId: 'maccabi_academy',
    minEvents: 2,
    maxEvents: 2,
    showMidSeason: true,
  },
  {
    id: 'youth_b',
    label: 'נערים ב׳',
    band: 'teens',
    order: 6,
    typicalAge: 15,
    quality: 51,
    development: 85,
    seasonGames: 28,
    league: 'ליגת נערים ב׳',
    clubId: 'maccabi_academy',
    minEvents: 2,
    maxEvents: 2,
    showMidSeason: true,
  },
  {
    id: 'youth_a',
    label: 'נערים א׳',
    band: 'teens',
    order: 7,
    typicalAge: 16,
    quality: 57,
    development: 85,
    seasonGames: 30,
    league: 'ליגת נערים א׳',
    clubId: 'maccabi_academy',
    minEvents: 2,
    maxEvents: 3,
    showMidSeason: true,
  },
  {
    id: 'u19',
    label: 'נוער',
    band: 'u19',
    order: 8,
    typicalAge: 17,
    quality: 63,
    development: 84,
    seasonGames: 32,
    league: 'ליגת העל לנוער',
    clubId: 'maccabi_youth',
    minEvents: 2,
    maxEvents: 3,
    showMidSeason: true,
  },
  {
    id: 'senior',
    label: 'בוגרים',
    band: 'senior',
    order: 9,
    typicalAge: 18,
    quality: 76,
    development: 66,
    seasonGames: 42,
    league: 'ליגת העל',
    clubId: 'maccabi_haifa',
    minEvents: 1,
    maxEvents: 2,
    showMidSeason: true,
  },
];

export const ACADEMY_STAGES: Record<AcademyStage, AcademyStageConfig> = Object.fromEntries(
  stages.map((s) => [s.id, s]),
) as Record<AcademyStage, AcademyStageConfig>;

/** Ordered ladder, טרום ב׳ first. */
export const STAGE_LADDER: readonly AcademyStage[] = stages.map((s) => s.id);

export const FIRST_STAGE: AcademyStage = 'pre_b';
export const LAST_YOUTH_STAGE: AcademyStage = 'u19';

export function stageConfig(stage: AcademyStage): AcademyStageConfig {
  return ACADEMY_STAGES[stage];
}

export function stageLabel(stage: AcademyStage): string {
  return ACADEMY_STAGES[stage].label;
}

export function stageOrder(stage: AcademyStage): number {
  return ACADEMY_STAGES[stage].order;
}

export function stageBand(stage: AcademyStage): StageBand {
  return ACADEMY_STAGES[stage].band;
}

/** The stage `steps` levels above `stage`, clamped to the top of the ladder. */
export function stageAfter(stage: AcademyStage, steps = 1): AcademyStage {
  const index = Math.min(STAGE_LADDER.length - 1, stageOrder(stage) + steps);
  return STAGE_LADDER[index] as AcademyStage;
}

export function isAcademyStage(stage: AcademyStage): boolean {
  return stage !== 'senior';
}

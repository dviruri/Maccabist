/**
 * Persistence abstraction.
 *
 * The rest of the app talks to `storage`, never to localStorage directly, so this can be
 * swapped for a backend repository (Base44, an API, whatever) without touching the UI.
 */

import type { Career, CareerSummary, MetaProgress } from '../types';

const SCHEMA_VERSION = 1;
const CAREER_KEY = 'maccabist:career:v1';
const META_KEY = 'maccabist:meta:v1';

export interface GameRepository {
  loadCareer(): Career | null;
  saveCareer(career: Career): void;
  clearCareer(): void;
  loadMeta(): MetaProgress;
  saveMeta(meta: MetaProgress): void;
  recordFinishedCareer(career: Career): MetaProgress;
}

export const emptyMeta: MetaProgress = {
  careersPlayed: 0,
  bestLegendScore: 0,
  bestCareer: null,
  totalChampionships: 0,
  recentCareers: [],
};

interface Envelope<T> {
  version: number;
  data: T;
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function read<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed.version !== SCHEMA_VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): void {
  if (!hasStorage()) return;
  try {
    const envelope: Envelope<T> = { version: SCHEMA_VERSION, data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota or private mode - the game keeps working, it just will not resume.
  }
}

export function summariseCareer(career: Career): CareerSummary {
  return {
    id: career.id,
    playerName: career.playerName,
    position: career.position,
    startSeason: career.startSeason,
    endSeason: career.currentSeason,
    legendScore: career.legend?.score ?? 0,
    endingId: career.legend?.ending.id ?? 'fallback',
    endingTitle: career.legend?.ending.title ?? '',
    maccabiAppearances: career.maccabi.appearances,
    championships: career.maccabi.championships,
    finishedAt: Date.now(),
  };
}

function createLocalRepository(): GameRepository {
  return {
    loadCareer: () => read<Career>(CAREER_KEY),
    saveCareer: (career) => write(CAREER_KEY, career),
    clearCareer: () => {
      if (!hasStorage()) return;
      try {
        window.localStorage.removeItem(CAREER_KEY);
      } catch {
        /* ignore */
      }
    },
    loadMeta: () => read<MetaProgress>(META_KEY) ?? { ...emptyMeta },
    saveMeta: (meta) => write(META_KEY, meta),
    recordFinishedCareer(career) {
      const meta = this.loadMeta();
      const summary = summariseCareer(career);
      const score = summary.legendScore;
      const next: MetaProgress = {
        careersPlayed: meta.careersPlayed + 1,
        bestLegendScore: Math.max(meta.bestLegendScore, score),
        bestCareer: score >= meta.bestLegendScore ? summary : meta.bestCareer,
        totalChampionships: meta.totalChampionships + career.maccabi.championships,
        recentCareers: [summary, ...meta.recentCareers].slice(0, 8),
      };
      this.saveMeta(next);
      return next;
    },
  };
}

export const storage: GameRepository = createLocalRepository();

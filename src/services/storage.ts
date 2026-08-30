/**
 * Persistence abstraction.
 *
 * The rest of the app talks to `storage`, never to localStorage directly, so this can be
 * swapped for a backend repository (Base44, an API, whatever) without touching the UI.
 */

import { buildArchivedCareer } from '../game/archive';
import { hydrateCareer, SCHEMA_VERSION } from '../game/careerEngine';
import type { ArchivedCareer, Career, CareerSummary, MetaProgress } from '../types';

const CAREER_KEY = 'maccabist:career:v1';
const META_KEY = 'maccabist:meta:v1';
const ARCHIVE_KEY = 'maccabist:archive:v1';
/** Set when a save from an older schema had to be dropped, so the UI can explain itself. */
const LEGACY_FLAG = 'maccabist:legacy-save-dropped';

/** Meta progression survives schema changes - it is a small, stable shape. */
const META_VERSION = 1;
/** Archive snapshots are self-contained; the version gates the envelope, not the careers. */
const ARCHIVE_VERSION = 1;

export interface GameRepository {
  loadCareer(): Career | null;
  saveCareer(career: Career): void;
  clearCareer(): void;
  /** True when a save existed but belonged to an incompatible older version. */
  hadIncompatibleSave(): boolean;
  acknowledgeIncompatibleSave(): void;
  loadMeta(): MetaProgress;
  saveMeta(meta: MetaProgress): void;
  recordFinishedCareer(career: Career): MetaProgress;
  /** Every finished career, newest first. */
  loadArchive(): ArchivedCareer[];
  /** Freezes a finished career into the archive. Idempotent: saving twice upserts by id. */
  archiveCareer(career: Career): ArchivedCareer[];
  deleteArchivedCareer(archiveId: string): ArchivedCareer[];
  /** Wipes archive AND meta progression. Does NOT touch an active career. */
  resetMetaAndArchive(): void;
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

function readRaw<T>(key: string, expectedVersion: number): { data: T | null; stale: boolean } {
  if (!hasStorage()) return { data: null, stale: false };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { data: null, stale: false };
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed.version !== expectedVersion) return { data: null, stale: true };
    return { data: parsed.data, stale: false };
  } catch {
    // Corrupted JSON is treated exactly like an incompatible save: dropped, never crashed on.
    return { data: null, stale: true };
  }
}

function write<T>(key: string, version: number, data: T): void {
  if (!hasStorage()) return;
  try {
    const envelope: Envelope<T> = { version, data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota or private mode - the game keeps working, it just will not resume.
  }
}

function remove(key: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function markLegacy(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(LEGACY_FLAG, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Basic sanity check. A v0.1 career has no `academyStage`, and a half-written save could be
 * missing anything - either way we refuse it rather than letting the engine crash on it.
 */
function isUsableCareer(career: unknown): career is Career {
  if (!career || typeof career !== 'object') return false;
  const c = career as Partial<Career>;
  return (
    typeof c.id === 'string' &&
    typeof c.academyStage === 'string' &&
    typeof c.coachTrust === 'number' &&
    typeof c.roleValue === 'number' &&
    typeof c.phase === 'string' &&
    Array.isArray(c.seasonHistory) &&
    !!c.hidden &&
    !!c.maccabi
  );
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
    loadCareer() {
      const { data, stale } = readRaw<Career>(CAREER_KEY, SCHEMA_VERSION);
      if (stale) {
        markLegacy();
        remove(CAREER_KEY);
        return null;
      }
      if (!isUsableCareer(data)) {
        if (data !== null) {
          markLegacy();
          remove(CAREER_KEY);
        }
        return null;
      }
      // Saves written before v0.4 have no `world`; fill it in rather than dropping the career.
      return hydrateCareer(data);
    },
    saveCareer: (career) => write(CAREER_KEY, SCHEMA_VERSION, career),
    clearCareer: () => remove(CAREER_KEY),
    hadIncompatibleSave() {
      if (!hasStorage()) return false;
      try {
        return window.localStorage.getItem(LEGACY_FLAG) === '1';
      } catch {
        return false;
      }
    },
    acknowledgeIncompatibleSave: () => remove(LEGACY_FLAG),
    loadMeta: () => readRaw<MetaProgress>(META_KEY, META_VERSION).data ?? { ...emptyMeta },
    saveMeta: (meta) => write(META_KEY, META_VERSION, meta),
    recordFinishedCareer(career) {
      const meta = this.loadMeta();
      /*
       * v0.7: idempotent by career id.
       *
       * The old guard against double-counting was a React ref, which resets on reload - so
       * reopening the app on the retirement screen counted the same career again. The recent
       * list is the durable memory of what was already recorded; a career it knows is a no-op.
       */
      if (meta.recentCareers.some((c) => c.id === career.id)) return meta;
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
    loadArchive() {
      return readRaw<ArchivedCareer[]>(ARCHIVE_KEY, ARCHIVE_VERSION).data ?? [];
    },
    archiveCareer(career) {
      /*
       * Upsert by the career's own id (v0.7, Scenario J). Retiring writes the snapshot;
       * reopening the retirement screen writes the same snapshot over itself. Exactly one
       * entry per career, however many times the app is closed and reopened on that screen.
       */
      const existing = this.loadArchive().filter((a) => a.archiveId !== career.id);
      const next = [buildArchivedCareer(career), ...existing];
      write(ARCHIVE_KEY, ARCHIVE_VERSION, next);
      return next;
    },
    deleteArchivedCareer(archiveId) {
      const next = this.loadArchive().filter((a) => a.archiveId !== archiveId);
      write(ARCHIVE_KEY, ARCHIVE_VERSION, next);
      return next;
    },
    resetMetaAndArchive() {
      // The active career is deliberately untouched: resetting history must not kill a run.
      remove(ARCHIVE_KEY);
      remove(META_KEY);
    },
  };
}

export const storage: GameRepository = createLocalRepository();

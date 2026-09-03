/**
 * Anonymous product analytics (v0.9.6.4).
 *
 * The number the owner will actually quote is the GA4 event count for `career_started`, so most
 * of what follows is about that one event being exactly-once: not on a re-render, not on a
 * refresh, not on a resume, and never retroactively for a save that existed before analytics did.
 *
 * The analytics runtime is replaced rather than mocked, so these drive the same `emit`, consent
 * and dedupe code the browser runs - only the transport and the two storages are swapped for
 * in-memory ones. Nothing here can reach Google.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  __resetAnalyticsForTests,
  __setAnalyticsRuntimeForTests,
  type AnalyticsEventName,
  type AnalyticsParams,
  environmentAllowsAnalytics,
  getConsent,
  needsConsentDecision,
  setConsent,
} from '../src/analytics/analytics';
import {
  reportCareerProgress,
  trackCareerResumed,
  trackCareerStarted,
} from '../src/analytics/events';
import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { createRng } from '../src/game/random';
import { simulateCareer, balancedPolicy } from '../src/game/simulate';
import { openWorldSeason } from '../src/game/worldEngine';
import type { Career } from '../src/types';

interface Sent {
  name: AnalyticsEventName;
  params: AnalyticsParams;
}

/** A whole analytics runtime in memory: real code, no browser, no network. */
function harness(options: { consent?: 'granted' | 'denied'; enabled?: boolean } = {}) {
  const sent: Sent[] = [];
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  let counter = 0;
  __setAnalyticsRuntimeForTests({
    enabled: options.enabled ?? true,
    send: (name, params) => sent.push({ name, params }),
    readLocal: (key) => local.get(key) ?? null,
    writeLocal: (key, value) => void local.set(key, value),
    readSession: (key) => session.get(key) ?? null,
    writeSession: (key, value) => void session.set(key, value),
    randomId: () => `test-${(counter += 1)}`,
  });
  if (options.consent) setConsent(options.consent);
  return {
    sent,
    local,
    session,
    of: (name: AnalyticsEventName) => sent.filter((event) => event.name === name),
  };
}

function career(overrides: Partial<Career> = {}, seed = 7): Career {
  const base = createCareer({ playerName: 'אורי דביר', position: 'ST', seed });
  return { ...base, ...overrides };
}

afterEach(() => {
  __resetAnalyticsForTests();
});

/* ------------------------------------------------------------------ */
/* The career count                                                    */
/* ------------------------------------------------------------------ */

describe('career_started is exactly once per new career', () => {
  it('fires once when a new career is created', () => {
    const h = harness({ consent: 'granted' });
    trackCareerStarted(career());
    expect(h.of('career_started')).toHaveLength(1);
  });

  it('stays at one however many times the same career is reported', () => {
    /* React re-renders, StrictMode double-invokes, a player double-taps the create button. */
    const h = harness({ consent: 'granted' });
    const fresh = career();
    for (let i = 0; i < 5; i += 1) trackCareerStarted(fresh);
    expect(h.of('career_started')).toHaveLength(1);
  });

  it('survives a refresh - the dedupe registry is persistent, not in-memory', () => {
    const h = harness({ consent: 'granted' });
    const fresh = career();
    trackCareerStarted(fresh);

    /* A reload: new runtime, same durable storage. */
    const sentAfterReload: Sent[] = [];
    __setAnalyticsRuntimeForTests({
      enabled: true,
      send: (name, params) => sentAfterReload.push({ name, params }),
      readLocal: (key) => h.local.get(key) ?? null,
      writeLocal: (key, value) => void h.local.set(key, value),
      readSession: () => null,
      writeSession: () => {},
      randomId: () => 'reload',
    });
    trackCareerStarted(fresh);
    expect(sentAfterReload).toHaveLength(0);
  });

  it('a different career is a different count', () => {
    const h = harness({ consent: 'granted' });
    trackCareerStarted(career({}, 1));
    trackCareerStarted(career({}, 2));
    expect(h.of('career_started')).toHaveLength(2);
  });

  it('resuming reports a resume, never a start', () => {
    const h = harness({ consent: 'granted' });
    trackCareerResumed(career());
    expect(h.of('career_started')).toHaveLength(0);
    expect(h.of('career_resumed')).toHaveLength(1);
  });

  it('a pre-v0.9.6.4 save is never backfilled as a new career', () => {
    /*
     * The structural guarantee: the ONLY caller of `trackCareerStarted` is `useGame.startCareer`,
     * which is also the only place `createCareer` is called. Loading, hydrating and resuming
     * cannot reach it. Asserted on the source so a future refactor cannot quietly widen it.
     */
    const useGame = readSource('src/state/useGame.ts');
    expect(useGame).toContain('trackCareerStarted(fresh)');
    expect(useGame.match(/trackCareerStarted/g)).toHaveLength(2); // the import and the one call
    /* And it is not reachable from the progress observer, which is what a loaded save runs. */
    expect(readSource('src/analytics/events.ts')).toContain('export function trackCareerStarted');
    expect(readSource('src/analytics/events.ts')).not.toContain('trackCareerStarted(career)');

    /* Behaviourally: an old career simply progressing never emits one. */
    const h = harness({ consent: 'granted' });
    const old = career({ seasonHistory: [] });
    reportCareerProgress(null, old);
    reportCareerProgress(old, { ...old, age: old.age + 1 });
    expect(h.of('career_started')).toHaveLength(0);
  });

  it('reports a resume once per browser session and again in a new one', () => {
    const h = harness({ consent: 'granted' });
    const saved = career();
    trackCareerResumed(saved);
    trackCareerResumed(saved);
    expect(h.of('career_resumed')).toHaveLength(1);

    /* A new tab: session storage is empty again, durable storage is not. */
    const later: Sent[] = [];
    __setAnalyticsRuntimeForTests({
      enabled: true,
      send: (name, params) => later.push({ name, params }),
      readLocal: (key) => h.local.get(key) ?? null,
      writeLocal: (key, value) => void h.local.set(key, value),
      readSession: () => null,
      writeSession: () => {},
      randomId: () => 'second-session',
    });
    trackCareerResumed(saved);
    expect(later).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

function withSeasons(base: Career, count: number): Career {
  const seasonHistory = Array.from({ length: count }, (_, i) => ({
    season: 2040 + i,
    age: 18 + i,
    academyStage: 'senior' as const,
    clubId: MACCABI_ID,
    clubName: 'מכבי חיפה',
    teamName: 'מכבי חיפה',
    league: 'ליגת העל',
    onLoan: false,
    stats: { appearances: 30, starts: 28, minutes: 2400, goals: 9, assists: 4, cleanSheets: 0, goalsConceded: 0, rating: 70 },
    firstHalf: null,
    ability: 70,
    role: 'starter' as const,
    coachTrust: 70,
    trophies: [],
    captain: false,
    olderGroup: 'none' as const,
  })) as unknown as Career['seasonHistory'];
  return { ...base, seasonHistory };
}

describe('season_completed', () => {
  it('fires once per newly completed season', () => {
    const h = harness({ consent: 'granted' });
    const before = withSeasons(career(), 1);
    reportCareerProgress(before, withSeasons(before, 2));
    expect(h.of('season_completed')).toHaveLength(1);
    expect(h.of('season_completed')[0]!.params.season_number).toBe(2041);
  });

  it('does not fire again when the same state is reported twice', () => {
    const h = harness({ consent: 'granted' });
    const before = withSeasons(career(), 1);
    const after = withSeasons(before, 2);
    reportCareerProgress(before, after);
    reportCareerProgress(before, after);
    expect(h.of('season_completed')).toHaveLength(1);
  });

  it('fires again for the next season', () => {
    const h = harness({ consent: 'granted' });
    const one = withSeasons(career(), 1);
    const two = withSeasons(one, 2);
    reportCareerProgress(one, two);
    reportCareerProgress(two, withSeasons(two, 3));
    expect(h.of('season_completed')).toHaveLength(2);
  });

  it('reports nothing for a career that merely loaded', () => {
    /* The baseline case: no previous state means nothing transitioned. */
    const h = harness({ consent: 'granted' });
    reportCareerProgress(null, withSeasons(career(), 6));
    expect(h.of('season_completed')).toHaveLength(0);
  });
});

describe('senior_debut', () => {
  /*
   * Both states are derived from ONE base career on purpose.
   *
   * `career.id` embeds `Date.now()`, so two separate `createCareer` calls can land on different
   * ids when they straddle a millisecond - and `reportCareerProgress` correctly treats a changed
   * id as a career switch rather than a transition. Building "before" and "after" independently
   * made this block pass alone and fail inside the full suite, which is a flaw in the fixture
   * rather than in the guard: a real transition is always one career evolving.
   */
  const base = career();
  const academy = (): Career => ({ ...base, academyStage: 'youth' as Career['academyStage'] });
  const senior = (appearances: number): Career => ({
    ...base,
    academyStage: 'senior',
    stats: { ...base.stats, appearances },
  });

  it('fires on the first genuine senior appearance', () => {
    const h = harness({ consent: 'granted' });
    reportCareerProgress(academy(), senior(1));
    expect(h.of('senior_debut')).toHaveLength(1);
  });

  it('does not fire again on later appearances', () => {
    const h = harness({ consent: 'granted' });
    reportCareerProgress(academy(), senior(1));
    reportCareerProgress(senior(1), senior(12));
    expect(h.of('senior_debut')).toHaveLength(1);
  });

  it('does not fire for reaching a senior squad without playing', () => {
    /* Senior stage with zero appearances is not a debut. */
    const h = harness({ consent: 'granted' });
    reportCareerProgress(academy(), senior(0));
    expect(h.of('senior_debut')).toHaveLength(0);
  });
});

describe('transfer_completed', () => {
  it('fires when the club actually changes, and names the move type', () => {
    const h = harness({ consent: 'granted' });
    const before = career({ currentClubId: MACCABI_ID, parentClubId: null });
    reportCareerProgress(before, { ...before, currentClubId: 'hapoel_beer_sheva' });
    expect(h.of('transfer_completed')).toHaveLength(1);
    expect(h.of('transfer_completed')[0]!.params.move_type).toBe('permanent');
  });

  it('calls a loan a loan, and a loan return a loan return', () => {
    const h = harness({ consent: 'granted' });
    const home = career({ currentClubId: MACCABI_ID, parentClubId: null });
    const away = { ...home, currentClubId: 'hapoel_haifa', parentClubId: MACCABI_ID };
    reportCareerProgress(home, away);
    reportCareerProgress(away, { ...home, currentSeason: home.currentSeason + 1 });
    expect(h.of('transfer_completed').map((event) => event.params.move_type)).toEqual([
      'loan',
      'loan_return',
    ]);
  });

  it('does not fire when the club is unchanged', () => {
    const h = harness({ consent: 'granted' });
    const before = career();
    reportCareerProgress(before, { ...before, age: before.age + 1 });
    expect(h.of('transfer_completed')).toHaveLength(0);
  });
});

describe('europe_reached', () => {
  it('reports the visible competition once per season, never a future one', () => {
    const h = harness({ consent: 'granted' });
    const base = career({
      academyStage: 'senior',
      currentClubId: MACCABI_ID,
      currentSeason: 2046,
      seasonPoint: 'preseason',
    });
    const withWorld: Career = { ...base, world: openWorldSeason(base, createRng(7)) };

    reportCareerProgress(null, withWorld);
    reportCareerProgress(withWorld, withWorld);
    const events = h.of('europe_reached');
    expect(events.length).toBeLessThanOrEqual(1);
    for (const event of events) {
      /* Whatever it says, it must be a competition the chronology-aware helper exposed. */
      expect(String(event.params.competition)).toMatch(/^uefa_/);
      expect(['qualifying', 'league_phase']).toContain(event.params.entry_stage);
    }
  });

  it('reads the chronology-aware campaign, not the journey scalars', () => {
    const source = readSource('src/analytics/events.ts');
    expect(source).toContain('visibleEuropeanCampaign');
    for (const leak of ['finalCompetition', 'reachedLeaguePhase', 'wonCompetition', 'furthest']) {
      expect(source, `analytics reads ${leak}`).not.toContain(leak);
    }
  });
});

describe('career_completed', () => {
  it('fires once when retirement is committed', () => {
    const h = harness({ consent: 'granted' });
    const before = career({ retired: false });
    const retired = { ...before, retired: true };
    reportCareerProgress(before, retired);
    expect(h.of('career_completed')).toHaveLength(1);
  });

  it('does not fire again when the retirement screen is reopened', () => {
    const h = harness({ consent: 'granted' });
    const before = career({ retired: false });
    const retired = { ...before, retired: true };
    reportCareerProgress(before, retired);
    reportCareerProgress(retired, retired);
    reportCareerProgress(before, retired);
    expect(h.of('career_completed')).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Environment and consent                                             */
/* ------------------------------------------------------------------ */

describe('environments that must never emit', () => {
  it('is off without a window at all - which is how tests run', () => {
    expect(environmentAllowsAnalytics()).toBe(false);
  });

  it('is off on localhost and in every QA harness mode', () => {
    for (const hostname of ['localhost', '127.0.0.1', '::1']) {
      expect(environmentAllowsAnalytics({ hostname, search: '' })).toBe(false);
    }
    for (const flag of ['gallery', 'probe', 'contrast', 'touch', 'crop']) {
      expect(
        environmentAllowsAnalytics({ hostname: 'dviruri.github.io', search: `?${flag}=1` }),
        `${flag} mode still emits`,
      ).toBe(false);
    }
  });

  it('sends nothing at all when the environment is excluded', () => {
    const h = harness({ consent: 'granted', enabled: false });
    trackCareerStarted(career());
    reportCareerProgress(career(), withSeasons(career(), 3));
    expect(h.sent).toHaveLength(0);
  });
});

describe('consent', () => {
  it('sends nothing before the player answers', () => {
    const h = harness();
    expect(getConsent()).toBe('unset');
    expect(needsConsentDecision()).toBe(true);
    trackCareerStarted(career());
    expect(h.sent).toHaveLength(0);
  });

  it('sends nothing when declined, and stops asking', () => {
    const h = harness({ consent: 'denied' });
    trackCareerStarted(career());
    reportCareerProgress(career(), withSeasons(career(), 2));
    expect(h.sent).toHaveLength(0);
    expect(needsConsentDecision()).toBe(false);
  });

  it('sends once granted', () => {
    const h = harness({ consent: 'granted' });
    expect(needsConsentDecision()).toBe(false);
    trackCareerStarted(career());
    expect(h.sent).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Failure safety                                                      */
/* ------------------------------------------------------------------ */

describe('analytics can never break the game', () => {
  it('survives a transport that throws', () => {
    __setAnalyticsRuntimeForTests({
      enabled: true,
      send: () => {
        throw new Error('gtag blocked');
      },
      readLocal: () => 'granted',
      writeLocal: () => {},
      readSession: () => null,
      writeSession: () => {},
      randomId: () => 'x',
    });
    expect(() => trackCareerStarted(career())).not.toThrow();
    expect(() => reportCareerProgress(career(), withSeasons(career(), 2))).not.toThrow();
  });

  it('survives storage that throws in every direction', () => {
    const boom = (): never => {
      throw new Error('localStorage unavailable');
    };
    __setAnalyticsRuntimeForTests({
      enabled: true,
      send: () => {},
      readLocal: boom,
      writeLocal: boom,
      readSession: boom,
      writeSession: boom,
      randomId: boom,
    });
    expect(() => trackCareerStarted(career())).not.toThrow();
    expect(() => trackCareerResumed(career())).not.toThrow();
    expect(() => reportCareerProgress(null, career())).not.toThrow();
    expect(getConsent()).toBe('unset');
  });

  it('does not mutate the career or its rng state', () => {
    const h = harness({ consent: 'granted' });
    const before = career();
    const snapshot = JSON.stringify(before);
    const rngBefore = before.rngState;
    trackCareerStarted(before);
    trackCareerResumed(before);
    reportCareerProgress(before, withSeasons(before, 2));
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(before.rngState).toBe(rngBefore);
    expect(h.sent.length).toBeGreaterThan(0);
  });

  it('never consumes game randomness', () => {
    /* The ids analytics needs come from crypto, never from the simulation stream. */
    const source = readSource('src/analytics/analytics.ts') + readSource('src/analytics/events.ts');
    expect(source).not.toContain('createRng');
    expect(source).not.toContain('rngState');
    expect(source).toContain('crypto.randomUUID');
  });
});

/* ------------------------------------------------------------------ */
/* Privacy                                                             */
/* ------------------------------------------------------------------ */

describe('privacy', () => {
  it('never sends the player-entered name, in any event', () => {
    const h = harness({ consent: 'granted' });
    const named = career({ playerName: 'שם פרטי מאוד מסוים' });
    const senior = {
      ...named,
      academyStage: 'senior' as Career['academyStage'],
      stats: { ...named.stats, appearances: 3 },
    };
    trackCareerStarted(named);
    trackCareerResumed(named);
    reportCareerProgress(named, senior);
    reportCareerProgress(senior, { ...senior, currentClubId: 'hapoel_haifa' });
    reportCareerProgress(senior, withSeasons(senior, 2));
    reportCareerProgress(senior, { ...senior, retired: true });

    expect(h.sent.length).toBeGreaterThan(4);
    for (const event of h.sent) {
      const serialised = JSON.stringify(event.params);
      expect(serialised, `${event.name} leaked the player name`).not.toContain('שם פרטי');
      expect(Object.keys(event.params)).not.toContain('playerName');
      /* Only scalars ever leave - no nested objects, no arrays, no free text. */
      for (const [key, value] of Object.entries(event.params)) {
        expect(['string', 'number', 'boolean'], `${event.name}.${key}`).toContain(typeof value);
      }
    }
  });

  it('the analytics source never reads a name or spreads a career', () => {
    const source = readSource('src/analytics/analytics.ts') + readSource('src/analytics/events.ts');
    expect(source).not.toContain('playerName');
    expect(source).not.toContain('...career');
    expect(source).not.toContain('...c }');
  });

  it('stamps every event with the game version and nothing else implicit', () => {
    const h = harness({ consent: 'granted' });
    trackCareerStarted(career());
    expect(h.sent[0]!.params.game_version).toBeTruthy();
    expect(typeof h.sent[0]!.params.game_version).toBe('string');
  });
});

/* ------------------------------------------------------------------ */
/* Determinism                                                         */
/* ------------------------------------------------------------------ */

describe('determinism', () => {
  it('reporting a whole career changes nothing about the simulation', () => {
    /*
     * The guarantee the seeded regression depends on: analytics observes and never participates.
     * The same seed is simulated twice, once with every transition reported, and the two careers
     * must be byte-identical.
     */
    const run = (report: boolean): Career => {
      let previous: Career | null = null;
      let last: Career | null = null;
      const finished = simulateCareer({
        playerName: 'אורי דביר',
        position: 'CM',
        seed: 4242,
        policy: balancedPolicy,
        onStep: (step: Career) => {
          if (report) reportCareerProgress(previous, step);
          previous = step;
          last = step;
        },
      });
      void last;
      return finished;
    };

    harness({ consent: 'granted' });
    const reported = run(true);
    __resetAnalyticsForTests();
    const quiet = run(false);

    /*
     * `id` and `createdAt` are wall-clock by construction (`career_<seed>_<Date.now()>`), so two
     * runs differ there whatever analytics does. Everything the simulation produces is compared.
     */
    const comparable = (c: Career): string =>
      JSON.stringify({ ...c, id: 'fixed', createdAt: 0 });
    expect(comparable(reported)).toBe(comparable(quiet));
  });
});

/* ------------------------------------------------------------------ */

/**
 * Source with comments blanked out.
 *
 * These guards check what the code DOES, and the notes explaining each rule necessarily name the
 * thing they forbid - the first run flagged the sentence "`playerName` is never read".
 */
function readSource(relative: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  return fs
    .readFileSync(path.resolve(__dirname, '..', relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
}

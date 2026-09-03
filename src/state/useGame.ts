import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  answerEvent,
  beginSeason,
  chooseOffer,
  continueAfterEvent,
  continueAfterMidSeason,
  continueAfterOrigin,
  continueAfterProgression,
  continueAfterRetrial,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
  resolveYouthTransition,
  type NewCareerInput,
  type RetirementDecision,
} from '../game/careerEngine';
import { reportCareerProgress, trackCareerResumed, trackCareerStarted } from '../analytics/events';
import { storage } from '../services/storage';
import type { Career, MetaProgress } from '../types';

export type Screen = 'welcome' | 'create' | 'game' | 'retired' | 'meta';

export interface GameState {
  career: Career | null;
  meta: MetaProgress;
  screen: Screen;
  /** A save from an older version had to be dropped. */
  legacySaveDropped: boolean;
  actions: GameActions;
}

export interface GameActions {
  openCreate(): void;
  backToWelcome(): void;
  /** חדר הגביעים - the career archive and collection (v0.7). */
  openMeta(): void;
  startCareer(input: NewCareerInput): void;
  resumeCareer(): void;
  abandonCareer(): void;
  dismissLegacyNotice(): void;
  nextSeason(): void;
  answer(eventId: string, choiceId: string): void;
  continueEvent(): void;
  continueMidSeason(): void;
  continueSeason(): void;
  continueProgression(): void;
  continueOrigin(): void;
  continueRetrial(): void;
  chooseYouthPath(offerId: string | null): void;
  takeOffer(offerId: string): void;
  refuseOffers(): void;
  retirementChoice(decision: RetirementDecision): void;
  /**
   * Records that a one-time cinematic has been shown (v0.9.6).
   *
   * Goes through the same `step` every gameplay action uses, so it lands in the Career and is
   * persisted by the same effect - which is the whole point. It changes nothing else about the
   * career, and a key already present is a no-op.
   */
  markPresentationSeen(key: string): void;
  /** Escape hatch for the dev panel only. */
  overrideCareer(next: Career): void;
}

export function useGame(): GameState {
  const [career, setCareer] = useState<Career | null>(() => storage.loadCareer());
  const [meta, setMeta] = useState<MetaProgress>(() => storage.loadMeta());
  const [legacySaveDropped, setLegacySaveDropped] = useState(() => storage.hadIncompatibleSave());
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = storage.loadCareer();
    if (!saved) return 'welcome';
    return saved.retired ? 'retired' : 'welcome';
  });
  const recordedRef = useRef<string | null>(null);

  /* Persist on every change - a refresh always resumes exactly where you were. */
  useEffect(() => {
    if (career) storage.saveCareer(career);
  }, [career]);

  /*
   * Anonymous progression analytics (v0.9.6.4).
   *
   * One observer, downstream of every gameplay action, rather than a call in each screen: `career`
   * changes exactly once per engine transition, so this sees each one and no component has to
   * remember to report anything.
   *
   * `previousCareerRef` starts null, and the analytics layer treats a null previous state as a
   * baseline rather than a transition - which is what stops a loaded save reporting a debut it
   * made eight seasons ago. Renders that do not change the career do not re-run this effect, and
   * the persistent dedupe registry covers the ones that do (StrictMode invokes effects twice).
   *
   * Deliberately after the persistence effect and never awaited: nothing here can delay, block or
   * alter a career transition, and `reportCareerProgress` swallows its own failures.
   */
  const previousCareerRef = useRef<Career | null>(null);
  useEffect(() => {
    if (!career) {
      previousCareerRef.current = null;
      return;
    }
    const previous = previousCareerRef.current;
    previousCareerRef.current = career;
    reportCareerProgress(previous, career);
  }, [career]);

  /*
   * Fold a finished career into the meta progression AND the archive exactly once.
   *
   * v0.7: the archive write happens here, at the moment of retirement, not when the user leaves
   * the retirement screen - closing the app on that screen must not lose the career. Both
   * operations are idempotent in storage (keyed by career id), so the ref is only an
   * optimisation; a reload cannot double-count and cannot duplicate an archive entry.
   */
  useEffect(() => {
    if (!career?.retired || recordedRef.current === career.id) return;
    recordedRef.current = career.id;
    storage.archiveCareer(career);
    setMeta(storage.recordFinishedCareer(career));
    setScreen('retired');
  }, [career]);

  const step = useCallback((fn: (current: Career) => Career) => {
    setCareer((current) => (current ? fn(current) : current));
  }, []);

  /*
   * Presentation bookkeeping, kept deliberately dull.
   *
   * No engine call, no RNG, no phase change - it appends a string and nothing else. Marking is
   * idempotent so a double-tap on Continue cannot grow the ledger, and because it flows through
   * `setCareer` the persistence effect writes it immediately: a refresh one frame after Continue
   * lands past the cinematic rather than back inside it.
   */
  const markPresentationSeen = useCallback(
    (key: string) => {
      step((current) =>
        current.seenPresentationKeys?.includes(key)
          ? current
          : { ...current, seenPresentationKeys: [...(current.seenPresentationKeys ?? []), key] },
      );
    },
    [step],
  );

  /**
   * Keeps the loop tight: the pre-season card is worth one click at the very start of a
   * career, but not every summer. After the first season we roll straight into the next one.
   */
  const rollIntoSeason = useCallback((current: Career): Career => {
    if (current.phase !== 'preseason' || current.seasonHistory.length === 0) return current;
    return beginSeason(current);
  }, []);

  const actions = useMemo<GameActions>(
    () => ({
      openCreate: () => setScreen('create'),
      backToWelcome: () => setScreen('welcome'),
      openMeta: () => setScreen('meta'),
      startCareer: (input) => {
        const fresh = createCareer(input);
        recordedRef.current = null;
        storage.saveCareer(fresh);
        /*
         * THE career count (v0.9.6.4). This is the only path in the app that calls
         * `createCareer`, so a resumed or hydrated save can never reach it - which is exactly
         * what makes the GA4 event count trustworthy. Deduped on the career id as well, so a
         * double-tap on the create button cannot report twice.
         */
        trackCareerStarted(fresh);
        setCareer(fresh);
        setScreen('game');
      },
      resumeCareer: () => {
        const saved = storage.loadCareer();
        if (!saved) return;
        /* A resume is not a new career and is counted separately - once per tab session. */
        trackCareerResumed(saved);
        setCareer(saved);
        setScreen(saved.retired ? 'retired' : 'game');
      },
      abandonCareer: () => {
        storage.clearCareer();
        setCareer(null);
        setScreen('welcome');
      },
      dismissLegacyNotice: () => {
        storage.acknowledgeIncompatibleSave();
        setLegacySaveDropped(false);
      },
      nextSeason: () => step(beginSeason),
      answer: (eventId, choiceId) => step((c) => answerEvent(c, eventId, choiceId)),
      continueEvent: () => step(continueAfterEvent),
      continueMidSeason: () => step(continueAfterMidSeason),
      continueSeason: () => step((c) => rollIntoSeason(continueAfterSeason(c))),
      continueProgression: () => step((c) => rollIntoSeason(continueAfterProgression(c))),
      continueOrigin: () => step(continueAfterOrigin),
      continueRetrial: () => step((c) => rollIntoSeason(continueAfterRetrial(c))),
      chooseYouthPath: (offerId) => step((c) => rollIntoSeason(resolveYouthTransition(c, offerId))),
      takeOffer: (offerId) => step((c) => rollIntoSeason(chooseOffer(c, offerId))),
      refuseOffers: () => step((c) => rollIntoSeason(rejectOffers(c))),
      retirementChoice: (decision) =>
        step((c) => rollIntoSeason(decideRetirement(c, decision))),
      markPresentationSeen,
      overrideCareer: (next) => setCareer(next),
    }),
    [step, rollIntoSeason, markPresentationSeen],
  );

  return { career, meta, screen, legacySaveDropped, actions };
}

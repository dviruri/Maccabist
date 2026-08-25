import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  answerEvent,
  beginSeason,
  chooseOffer,
  continueAfterEvent,
  continueAfterMidSeason,
  continueAfterProgression,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
  resolveYouthTransition,
  type NewCareerInput,
  type RetirementDecision,
} from '../game/careerEngine';
import { storage } from '../services/storage';
import type { Career, MetaProgress } from '../types';

export type Screen = 'welcome' | 'create' | 'game' | 'retired';

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
  chooseYouthPath(offerId: string | null): void;
  takeOffer(offerId: string): void;
  refuseOffers(): void;
  retirementChoice(decision: RetirementDecision): void;
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

  /* Fold a finished career into the meta progression exactly once. */
  useEffect(() => {
    if (!career?.retired || recordedRef.current === career.id) return;
    recordedRef.current = career.id;
    setMeta(storage.recordFinishedCareer(career));
    setScreen('retired');
  }, [career]);

  const step = useCallback((fn: (current: Career) => Career) => {
    setCareer((current) => (current ? fn(current) : current));
  }, []);

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
      startCareer: (input) => {
        const fresh = createCareer(input);
        recordedRef.current = null;
        storage.saveCareer(fresh);
        setCareer(fresh);
        setScreen('game');
      },
      resumeCareer: () => {
        const saved = storage.loadCareer();
        if (!saved) return;
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
      chooseYouthPath: (offerId) => step((c) => rollIntoSeason(resolveYouthTransition(c, offerId))),
      takeOffer: (offerId) => step((c) => rollIntoSeason(chooseOffer(c, offerId))),
      refuseOffers: () => step((c) => rollIntoSeason(rejectOffers(c))),
      retirementChoice: (decision) =>
        step((c) => rollIntoSeason(decideRetirement(c, decision))),
      overrideCareer: (next) => setCareer(next),
    }),
    [step, rollIntoSeason],
  );

  return { career, meta, screen, legacySaveDropped, actions };
}

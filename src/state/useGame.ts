import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  answerEvent,
  beginSeason,
  chooseOffer,
  continueAfterEvent,
  continueAfterSeason,
  createCareer,
  decideRetirement,
  rejectOffers,
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
  actions: GameActions;
}

export interface GameActions {
  openCreate(): void;
  backToWelcome(): void;
  startCareer(input: NewCareerInput): void;
  resumeCareer(): void;
  abandonCareer(): void;
  nextSeason(): void;
  answer(eventId: string, choiceId: string): void;
  continueEvent(): void;
  continueSeason(): void;
  takeOffer(offerId: string): void;
  refuseOffers(): void;
  retirementChoice(decision: RetirementDecision): void;
  /** Escape hatch for the dev panel only. */
  overrideCareer(next: Career): void;
}

export function useGame(): GameState {
  const [career, setCareer] = useState<Career | null>(() => storage.loadCareer());
  const [meta, setMeta] = useState<MetaProgress>(() => storage.loadMeta());
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
   * Keeps the loop tight: the "here we go" pre-season card is worth one click at the very
   * start of a career, but not every single summer. After the first season we roll straight
   * into the next set of events.
   */
  const rollIntoSeason = useCallback((current: Career): Career => {
    if (current.phase !== 'preseason' || current.seasonHistory.length === 0) return current;
    const started = beginSeason(current);
    return started.phase === 'preseason' ? continueAfterEvent(started) : started;
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
      nextSeason: () =>
        step((c) => {
          const started = beginSeason(c);
          // No eligible event this year - go straight into the season.
          return started.phase === 'preseason' ? continueAfterEvent(started) : started;
        }),
      answer: (eventId, choiceId) => step((c) => answerEvent(c, eventId, choiceId)),
      continueEvent: () => step(continueAfterEvent),
      continueSeason: () => step((c) => rollIntoSeason(continueAfterSeason(c))),
      takeOffer: (offerId) => step((c) => rollIntoSeason(chooseOffer(c, offerId))),
      refuseOffers: () => step((c) => rollIntoSeason(rejectOffers(c))),
      retirementChoice: (decision) => step((c) => rollIntoSeason(decideRetirement(c, decision))),
      overrideCareer: (next) => setCareer(next),
    }),
    [step, rollIntoSeason],
  );

  return { career, meta, screen, actions };
}

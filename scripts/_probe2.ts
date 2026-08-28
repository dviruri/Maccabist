import { EVENTS_BY_ID } from '../src/data/events';
import { EVENT_POOL } from '../src/data/events';
import { isEventEligible } from '../src/game/eventEngine';
import { leagueContextAt, currentProjection } from '../src/game/leagueEngine';
import { balancedPolicy } from '../src/game/simulate';
import * as CE from '../src/game/careerEngine';
import { createRng } from '../src/game/random';
import type { Career } from '../src/types';

const ev = EVENTS_BY_ID.sen_title_run_in!;
let seniorPre = 0, hasProj = 0, lateTitle = 0, elig = 0, planned = 0;

for (let seed = 1; seed <= 30; seed += 1) {
  let career: Career = CE.createCareer({ playerName: 'p', position: 'CM', seed });
  const rng = createRng((career.seed ^ 0x5bf03635) >>> 0);
  let steps = 0;
  while (!career.retired && steps < 1200) {
    steps += 1;
    if (career.phase === 'preseason' && career.academyStage === 'senior') {
      const after = CE.beginSeason(career);
      seniorPre += 1;
      if (currentProjection(after)) hasProj += 1;
      const ctx = leagueContextAt(after, 'late');
      if (ctx?.titleRace) {
        lateTitle += 1;
        if (isEventEligible(ev, after, 'late')) elig += 1;
      }
      if (after.plannedEvents.some((p) => p.eventId === ev.id)) planned += 1;
      career = after;
      continue;
    }
    switch (career.phase) {
      case 'origin': career = CE.continueAfterOrigin(career); break;
      case 'retrial': career = CE.continueAfterRetrial(career); break;
      case 'preseason': career = CE.beginSeason(career); break;
      case 'event': {
        if (career.lastEventResult) { career = CE.continueAfterEvent(career); break; }
        const id = career.pendingEventIds[0];
        const e = id ? EVENTS_BY_ID[id] : undefined;
        if (!e || !id) { career = CE.continueAfterEvent(career); break; }
        career = CE.answerEvent(career, id, balancedPolicy.pickChoice(e, career, rng)); break;
      }
      case 'mid_season': career = CE.continueAfterMidSeason(career); break;
      case 'season_result': career = CE.continueAfterSeason(career); break;
      case 'progression': career = CE.continueAfterProgression(career); break;
      case 'youth_to_senior': {
        const pick = balancedPolicy.pickOffer(career.pendingOffers, career, rng);
        career = CE.resolveYouthTransition(career, pick ?? career.pendingOffers[0]?.id ?? null); break;
      }
      case 'offseason': {
        const pick = balancedPolicy.pickOffer(career.pendingOffers, career, rng);
        career = pick ? CE.chooseOffer(career, pick) : CE.rejectOffers(career); break;
      }
      case 'retirement_decision':
        career = CE.decideRetirement(career, balancedPolicy.pickRetirement(career, rng)); break;
      default: break;
    }
  }
}
console.log({ seniorPre, hasProj, lateTitle, elig, planned });
console.log('late-slot events in pool:', EVENT_POOL.filter((e) => e.slots?.includes('late')).length);

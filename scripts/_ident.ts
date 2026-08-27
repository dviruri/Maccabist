import { EVENTS_BY_ID } from '../src/data/events';
import { getClub } from '../src/data/clubs';
import * as CE from '../src/game/careerEngine';
import { createRng } from '../src/game/random';
import { levelContext } from '../src/game/rules';
import { balancedPolicy } from '../src/game/simulate';
import type { Career } from '../src/types';

let broken = 0, brokenSeasons = 0, total = 0;
const names = new Set<string>();
for (let seed = 1; seed <= 600; seed += 1) {
  let c: Career = CE.createCareer({ playerName: 'ל', position: 'CM', seed });
  const rng = createRng((c.seed ^ 0x5bf03635) >>> 0);
  let steps = 0, hit = false;
  while (!c.retired && steps < 900) {
    steps += 1;
    if (c.academyStage === 'senior' && getClub(c.currentClubId).isSenior !== true) {
      hit = true; brokenSeasons += 1; names.add(levelContext(c).teamName);
    }
    switch (c.phase) {
      case 'origin': c = CE.continueAfterOrigin(c); break;
      case 'retrial': c = CE.continueAfterRetrial(c); break;
      case 'preseason': c = CE.beginSeason(c); break;
      case 'event': {
        if (c.lastEventResult) { c = CE.continueAfterEvent(c); break; }
        const id = c.pendingEventIds[0];
        if (!id) { c = CE.continueAfterEvent(c); break; }
        c = CE.answerEvent(c, id, balancedPolicy.pickChoice(EVENTS_BY_ID[id]!, c, rng)); break;
      }
      case 'mid_season': c = CE.continueAfterMidSeason(c); break;
      case 'season_result': c = CE.continueAfterSeason(c); break;
      case 'progression': c = CE.continueAfterProgression(c); break;
      case 'offseason': { const p = balancedPolicy.pickOffer(c.pendingOffers, c, rng); c = p ? CE.chooseOffer(c, p) : CE.rejectOffers(c); break; }
      case 'youth_to_senior': c = CE.resolveYouthTransition(c, c.pendingOffers[0]?.id ?? null); break;
      case 'retirement_decision': c = CE.decideRetirement(c, balancedPolicy.pickRetirement(c, rng)); break;
      default: steps = 900;
    }
  }
  total += 1;
  if (hit) broken += 1;
}
console.log(`careers with senior stage at a non-senior club: ${broken}/${total} (${(broken/total*100).toFixed(1)}%)`);
console.log(`affected season-steps: ${brokenSeasons}`);
console.log(`team names shown:`, [...names]);

/**
 * Multi-season world-transition simulation (v0.6.5.1).
 *
 * Careers exercise ONE world history each. This exercises a hundred of them, with nothing but
 * promotion and relegation, because league-size corruption is a property of the world rather
 * than of any career - and the v0.6.5 bug proved it could sit there unnoticed while every
 * career test passed.
 */
import { LEAGUE_SHAPES } from '../src/data/leagueShape';
import { createRng } from '../src/game/random';
import { applySeasonMovements, emptyWorld, leagueMembership } from '../src/game/worldEngine';
import type { WorldState } from '../src/types';

const histories = Number(process.argv.find((a) => a.startsWith('--histories='))?.split('=')[1] ?? 100);
const seasons = Number(process.argv.find((a) => a.startsWith('--seasons='))?.split('=')[1] ?? 30);

let sizeViolations = 0, duplicates = 0, doubleMembership = 0, throws = 0, transitions = 0;

for (let h = 0; h < histories; h += 1) {
  const rng = createRng(1000 + h);
  let world: WorldState = emptyWorld();
  for (let s = 0; s < seasons; s += 1) {
    const pick = (id: string, bottom: boolean): string => {
      const m = leagueMembership(world, id);
      return m[bottom ? m.length - 1 - Math.floor(rng.next() * 2) : Math.floor(rng.next() * 2)] ?? m[0]!;
    };
    try {
      world = applySeasonMovements(world, 2044 + s, [
        { clubId: pick('il_leumit', false), fromLeague: 'il_leumit', toLeague: 'il_premier', reason: 'promoted' },
        { clubId: pick('il_premier', true), fromLeague: 'il_premier', toLeague: 'il_leumit', reason: 'relegated' },
        { clubId: pick(rng.next() < 0.5 ? 'il_alef_north' : 'il_alef_south', false), fromLeague: 'il_alef', toLeague: 'il_leumit', reason: 'promoted' },
        { clubId: pick('il_leumit', true), fromLeague: 'il_leumit', toLeague: 'il_alef', reason: 'relegated' },
      ]);
      transitions += 1;
    } catch { throws += 1; break; }

    const seen = new Map<string, string>();
    for (const [id, shape] of Object.entries(LEAGUE_SHAPES)) {
      const m = leagueMembership(world, id);
      if (m.length !== shape.size) sizeViolations += 1;
      if (new Set(m).size !== m.length) duplicates += 1;
      for (const c of m) { if (seen.has(c)) doubleMembership += 1; seen.set(c, id); }
    }
  }
}

console.log(`
v0.6.5.1 WORLD TRANSITION SIM - ${histories} histories x ${seasons} seasons

  transitions applied          ${transitions}
  league-size violations       ${sizeViolations}
  duplicate clubs in a league  ${duplicates}
  club in two active leagues   ${doubleMembership}
  transitions that threw       ${throws}
`);

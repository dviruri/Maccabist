/*
 * The same-seed regression (added v0.9.3, baseline established in v0.8).
 *
 * Seed 5 with the balanced policy is the career every release since v0.8 has quoted. A
 * presentation release must reproduce it EXACTLY - that is the whole claim - and until now the
 * check lived in a scratch file and a report. It lives here instead.
 *
 *   npx vite-node scripts/sameSeedRegression.ts
 *
 * The v0.8 / v0.9 / v0.9.1 / v0.9.2 / v0.9.3 baseline:
 *
 *   europe history seasons  26
 *   last journey            uefa_europa_league, furthest league_phase, 12 matches
 *   uefa trophies           0
 *   domestic cups           4
 *   championships           4
 *   final ability           82   (peak 86)
 *   legend score            77
 *   retirement age          35   (17 senior seasons)
 *   career totals           702 appearances, 450 goals, 120 assists
 */
import { simulateCareer, balancedPolicy } from '../src/game/simulate';

const c = simulateCareer({ playerName: 'א', position: 'ST', seed: 5, policy: balancedPolicy });
const e = c.world.europe!;
const euroSeasons = c.seasonHistory.filter((r) => r.europe).length;
const j = e.current?.playerJourney;
console.log('european seasons (records with a journey):', euroSeasons);
console.log('europe history seasons:', e.history.length);
console.log('last journey:', j ? `${j.finalCompetition} furthest=${j.furthest} matches=${j.matches}` : 'none');
console.log('uefa trophies:', c.trophies.filter((t) => t.id.startsWith('uefa_')).length);
console.log('domestic cups:', c.trophies.filter((t) => t.id === 'cup' || t.id === 'foreign_cup').length);
console.log('championships:', c.trophies.filter((t) => t.id === 'championship' || t.id === 'foreign_championship').length);
console.log('final ability:', Math.round(c.ability));
console.log('peak ability:', Math.round(c.peakAbility));
console.log('legend score:', c.legend ? Math.round(c.legend.score) : 'n/a');
console.log('retirement age:', c.retirementAge);
console.log('senior seasons:', c.seasonHistory.filter((r) => r.academyStage === 'senior').length);
console.log('appearances:', c.stats.appearances, 'goals:', c.stats.goals, 'assists:', c.stats.assists);

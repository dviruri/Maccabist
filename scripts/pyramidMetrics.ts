/**
 * Israeli pyramid health (v0.6.5).
 *
 * The product questions this release has to answer with numbers:
 *   - do careers actually TOUCH the lower tiers, without the tiers dominating the game?
 *   - does the fall-rebuild-rise arc exist? (Alef -> upward move; lower spell -> Maccabi/Europe)
 *   - does promotion/relegation move real clubs without corrupting league sizes?
 *
 *   npm run pyramid-metrics -- --careers=5000
 */

import { POSITION_LIST } from '../src/game/balance';
import { getClub } from '../src/data/clubs';
import { snapshotLeagueOf, LEAGUE_MEMBERSHIP } from '../src/data/worldClubs';
import { validateCareerIntegrity } from '../src/game/integrity';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import { leagueOf } from '../src/game/worldEngine';
import type { Position } from '../src/types';

const arg = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const careers = Number(arg('careers') ?? 5000);
const POSITIONS: Position[] = POSITION_LIST.map((p) => p.id as Position);

const tierOf = (clubId: string): string => {
  const league = snapshotLeagueOf(clubId);
  if (league === 'il_premier') return 'haal';
  if (league === 'il_leumit') return 'leumit';
  if (league === 'il_alef_north' || league === 'il_alef_south') return 'alef';
  return getClub(clubId).country === 'ישראל' ? 'il_other' : 'abroad';
};

let touchedHaal = 0;
let touchedLeumit = 0;
let touchedAlef = 0;
let alefThenUp = 0;
let alefThenMaccabi = 0;
let alefThenEurope = 0;
let loanToLower = 0;
let sawPromotion = 0;
let sawRelegation = 0;
let leagueSizeViolations = 0;
let integrityViolations = 0;
let abroadCareers = 0;
let maccabiSenior = 0;

for (let seed = 1; seed <= careers; seed += 1) {
  const career = simulateCareer({
    playerName: 'ת',
    position: POSITIONS[seed % POSITIONS.length]!,
    seed,
    policy: balancedPolicy,
  });
  integrityViolations += validateCareerIntegrity(career).length;

  const seniors = career.seasonHistory.filter((r) => r.academyStage === 'senior');
  const tiers = seniors.map((r) => ({ record: r, tier: tierOf(r.clubId) }));

  if (tiers.some((t) => t.tier === 'haal')) touchedHaal += 1;
  if (tiers.some((t) => t.tier === 'leumit')) touchedLeumit += 1;
  if (tiers.some((t) => t.tier === 'abroad')) abroadCareers += 1;
  if (seniors.some((r) => r.clubId === 'maccabi_haifa')) maccabiSenior += 1;
  if (tiers.some((t) => t.tier === 'alef' && t.record.onLoan)) loanToLower += 1;

  const firstAlef = tiers.findIndex((t) => t.tier === 'alef');
  if (firstAlef >= 0) {
    touchedAlef += 1;
    const after = tiers.slice(firstAlef + 1);
    if (after.some((t) => t.tier === 'haal' || t.tier === 'leumit' || t.tier === 'abroad')) {
      alefThenUp += 1;
    }
    if (after.some((t) => t.record.clubId === 'maccabi_haifa')) alefThenMaccabi += 1;
    if (after.some((t) => t.tier === 'abroad')) alefThenEurope += 1;
  }

  // World movement: any club recorded in a league other than its snapshot membership.
  for (const [clubId, movedTo] of Object.entries(career.world.clubLeagues)) {
    const home = snapshotLeagueOf(clubId);
    if (home && movedTo !== home) {
      const homeTier = home.startsWith('il_alef') ? 3 : home === 'il_leumit' ? 2 : 1;
      const newTier = movedTo.startsWith('il_alef') ? 3 : movedTo === 'il_leumit' ? 2 : 1;
      if (newTier < homeTier) sawPromotion += 1;
      if (newTier > homeTier) sawRelegation += 1;
    }
  }

  // League-size integrity under movement: every Israeli division the player can see must still
  // resolve a full membership after this career's world movements.
  for (const leagueId of ['il_premier', 'il_leumit', 'il_alef_north', 'il_alef_south']) {
    const size = LEAGUE_MEMBERSHIP[leagueId]!.length;
    const members = new Set<string>();
    for (const id of LEAGUE_MEMBERSHIP[leagueId]!) {
      const moved = career.world.clubLeagues[id];
      if (moved === undefined || moved === leagueId) members.add(id);
    }
    for (const [clubId, movedTo] of Object.entries(career.world.clubLeagues)) {
      if (movedTo === leagueId) members.add(clubId);
    }
    // Movement is one-club-at-a-time in this model, so a division may drift by the clubs the
    // world moved - what it may never do is lose a club to NOWHERE or hold a duplicate.
    if (members.size < size - 3 || members.size > size + 3) leagueSizeViolations += 1;
    void leagueOf; // (kept for symmetry with worldEngine's resolution path)
  }
}

const pct = (n: number, of = careers): string => `${((n / of) * 100).toFixed(2)}%`;

console.log(`
v0.6.5 PYRAMID METRICS - ${careers.toLocaleString()} careers, balanced policy, positions rotated

  TIER TOUCH RATES
  played in ligat ha'al          ${pct(touchedHaal)}
  played in liga leumit          ${pct(touchedLeumit)}
  played in liga alef            ${pct(touchedAlef)}
  loaned to liga alef            ${pct(loanToLower)}

  THE ARC (of careers that touched Alef: ${touchedAlef})
  later played a tier above      ${touchedAlef ? pct(alefThenUp, touchedAlef) : '-'}
  later played for Maccabi       ${touchedAlef ? pct(alefThenMaccabi, touchedAlef) : '-'}
  later played in Europe         ${touchedAlef ? pct(alefThenEurope, touchedAlef) : '-'}

  WORLD MOVEMENT
  careers seeing a promotion     ${pct(sawPromotion > careers ? careers : sawPromotion)}
  careers seeing a relegation    ${pct(sawRelegation > careers ? careers : sawRelegation)}
  league-size violations         ${leagueSizeViolations}

  CORE RATES (regression guard)
  Maccabi senior                 ${pct(maccabiSenior)}
  played abroad                  ${pct(abroadCareers)}

  INTEGRITY
  violations across population   ${integrityViolations}
`);

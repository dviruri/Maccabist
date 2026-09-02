/*
 * The release-candidate football invariant audit (v0.9.6, Phase 8).
 *
 * The point is to find IMPOSSIBLE states, not unlikely ones. A career that wins nine titles is
 * surprising; a career with -3 appearances, or two records for the same season, or a European
 * trophy it never played a match for, is broken - and only the second kind is a release blocker.
 *
 * Every position and both origin paths are exercised across a deterministic seed matrix, and each
 * career is walked beat by beat rather than only inspected at retirement, because most of these
 * invariants are about states the game passes THROUGH.
 *
 *   npm run rc:audit            240 careers
 *   npm run rc:audit -- 1000    more
 */
import { getClub, MACCABI_ID } from '../src/data/clubs';
import { sameFootballIdentity } from '../src/data/clubVisuals';
import { QUALIFYING_GRAPH, UEFA_COMPETITIONS } from '../src/data/uefa';
import { cupFinalOpponent } from '../src/game/cupEngine';
import { activeFixture, knownCupFinal } from '../src/game/fixture';
import { matchContext } from '../src/game/matchEngine';
import { buildMatchday } from '../src/game/matchdayPresenter';
import { europeReveal, revealedSteps } from '../src/game/europePresentation';
import { balancedPolicy, ambitiousPolicy, simulateCareer } from '../src/game/simulate';
import { resolveCharacterAsset } from '../src/lib/assetSelector';
import { GOALKEEPER_COLOURS } from '../src/ui/kit';
import type { Career, Position } from '../src/types';

const careers = Number(process.argv[2] ?? 240);
const POSITIONS: Position[] = ['GK', 'CB', 'FB', 'CM', 'WG', 'ST'];

interface Violation {
  group: string;
  detail: string;
  seed: number;
}
const violations: Violation[] = [];
const fail = (group: string, seed: number, detail: string): void => {
  violations.push({ group, detail, seed });
};

/* What the audit actually looked at, so "0 violations" can be shown to be non-vacuous. */
const counts = {
  careers: 0,
  beats: 0,
  fixtures: 0,
  matchdays: 0,
  seasonRecords: 0,
  cupFinals: 0,
  europeanJourneys: 0,
  gkAssets: 0,
  offers: 0,
};

const finite = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n);

for (let i = 0; i < careers; i += 1) {
  const seed = 20000 + i;
  const position = POSITIONS[i % POSITIONS.length]!;
  /* Both policies, so the transfer-hungry path and the loyal path are both exercised. */
  const policy = i % 2 === 0 ? balancedPolicy : ambitiousPolicy;
  counts.careers += 1;

  let previousClub: string | null = null;

  simulateCareer({
    playerName: 'אורי דביר',
    position,
    seed,
    policy,
    onStep: (career: Career) => {
      counts.beats += 1;

      /* ---------------- Identity ---------------- */
      try {
        getClub(career.currentClubId);
      } catch {
        fail('identity', seed, `currentClubId does not resolve: ${career.currentClubId}`);
      }

      const fixture = activeFixture(career);
      if (fixture) {
        counts.fixtures += 1;
        if (sameFootballIdentity(fixture.playerClubId, fixture.opponentClubId)) {
          fail('identity', seed, `self fixture: ${fixture.playerClubId} vs ${fixture.opponentClubId}`);
        }
        if (fixture.kind !== 'league' && fixture.kind !== 'cup_final') {
          fail('identity', seed, `unexpected fixture kind ${fixture.kind}`);
        }
        /* Home and away must be the two clubs, in some order - never a third club or a repeat. */
        const sides = [fixture.homeClubId, fixture.awayClubId].sort();
        const pair = [fixture.playerClubId, fixture.opponentClubId].sort();
        if (sides[0] !== pair[0] || sides[1] !== pair[1]) {
          fail('identity', seed, `incoherent sides: ${sides.join('/')} vs ${pair.join('/')}`);
        }
      }

      const context = matchContext(career);
      if (context && sameFootballIdentity(context.opponentClubId, career.currentClubId)) {
        fail('identity', seed, `self league context: ${context.opponentClubId}`);
      }

      /* ---------------- Season history ---------------- */
      const seasons = career.seasonHistory.map((r) => r.season);
      for (let n = 1; n < seasons.length; n += 1) {
        if (seasons[n]! <= seasons[n - 1]!) {
          fail('history', seed, `seasons not strictly increasing: ${seasons[n - 1]} then ${seasons[n]}`);
        }
      }
      if (new Set(seasons).size !== seasons.length) {
        fail('history', seed, 'duplicate season record');
      }
      if (!finite(career.age) || career.age < 8 || career.age > 60) {
        fail('history', seed, `impossible age ${career.age}`);
      }

      /* ---------------- Statistics ---------------- */
      for (const record of career.seasonHistory) {
        counts.seasonRecords += 1;
        const s = record.stats;
        for (const [key, value] of Object.entries(s)) {
          if (!finite(value)) fail('stats', seed, `${key} is ${String(value)} in ${record.season}`);
        }
        for (const key of ['appearances', 'goals', 'assists', 'cleanSheets', 'starts'] as const) {
          if ((s[key] ?? 0) < 0) fail('stats', seed, `negative ${key} in ${record.season}`);
        }
        if (s.starts > s.appearances) {
          fail('stats', seed, `starts ${s.starts} > appearances ${s.appearances} in ${record.season}`);
        }
        /*
         * A season with no appearances has no football output of ANY kind (v0.9.6.1).
         *
         * v0.9.6 covered goals and assists. The defensive rolls have the same unconditional noise
         * floor, so a player who never started could still record a clean sheet or concede a goal.
         */
        if (s.appearances === 0) {
          for (const key of ['goals', 'assists', 'cleanSheets', 'goalsConceded'] as const) {
            if ((s[key] ?? 0) > 0) {
              fail('stats', seed, `${key}=${s[key]} with zero appearances in ${record.season}`);
            }
          }
        }
      }
      if (!finite(career.ability) || career.ability < 0 || career.ability > 100) {
        fail('stats', seed, `ability out of range: ${career.ability}`);
      }

      /* ---------------- Position logic ---------------- */
      const asset = resolveCharacterAsset({
        age: career.age,
        position: career.position,
        clubId: career.currentClubId,
        seed: career.seed,
        season: career.currentSeason,
      });
      if (career.position === 'GK') {
        counts.gkAssets += 1;
        if (asset.role !== 'goalkeeper') fail('position', seed, 'GK rendered as outfield art');
        if (!GOALKEEPER_COLOURS.includes(asset.colour as never)) {
          fail('position', seed, `GK colour not in palette: ${asset.colour}`);
        }
      } else if (asset.role !== 'outfield') {
        fail('position', seed, `${career.position} rendered as goalkeeper art`);
      }

      const matchday = buildMatchday(career);
      if (matchday) {
        counts.matchdays += 1;
        if (!finite(matchday.scoreFor) || !finite(matchday.scoreAgainst)) {
          fail('matchday', seed, 'non-finite score');
        }
        if (matchday.scoreFor < 0 || matchday.scoreAgainst < 0) {
          fail('matchday', seed, 'negative score');
        }
        /* A keeper never scores in the presented match; an outfielder never records a save. */
        const kinds = matchday.moments.map((m) => m.kind);
        if (career.position === 'GK' && kinds.includes('player_goal')) {
          fail('position', seed, 'goalkeeper scored in the presented match');
        }
        if (career.position !== 'GK' && kinds.includes('save')) {
          fail('position', seed, 'outfielder recorded a save moment');
        }
        /* He cannot have a moment in a match he did not play. */
        if (!matchday.played && kinds.some((k) => k === 'player_goal' || k === 'player_assist')) {
          fail('matchday', seed, 'player moment in a match he did not play');
        }
      }

      /* ---------------- Cup ---------------- */
      const cup = career.world.cup;
      if (cup && cup.season === career.currentSeason) {
        const opponent = cupFinalOpponent(career);
        if (opponent) {
          counts.cupFinals += 1;
          if (sameFootballIdentity(opponent, cup.clubId)) {
            fail('cup', seed, `cup final against own identity: ${opponent}`);
          }
        }
        /* A known final must not be playable before settlement. */
        const known = knownCupFinal(career);
        if (known && career.phase !== 'season_result' && fixture?.kind === 'cup_final') {
          fail('cup', seed, 'cup final playable outside settlement');
        }
        /* The cup state and the trophy list must agree about a win. */
        const wonCup = career.trophies.some(
          (t) => t.season === cup.season && (t.id === 'cup' || t.id === 'youth_cup' || t.id === 'foreign_cup'),
        );
        if (wonCup && cup.run !== 'winners') {
          fail('cup', seed, `trophy recorded for ${cup.season} but run is ${cup.run}`);
        }
      }

      /* ---------------- Europe ---------------- */
      const journey = career.world.europe?.current?.playerJourney;
      if (journey && journey.clubId === career.currentClubId) {
        counts.europeanJourneys += 1;

        /* Qualifying continuity: consecutive named rounds must be one graph hop apart. */
        const stages = journey.steps.flatMap((step) =>
          step.kind === 'tie' && step.tie.stage in QUALIFYING_GRAPH
            ? [step.tie.stage]
            : step.kind === 'bye'
              ? [step.stage]
              : [],
        );
        for (let n = 1; n < stages.length; n += 1) {
          const node = QUALIFYING_GRAPH[stages[n - 1]!]!;
          if (node.winTo !== stages[n] && node.loseTo !== stages[n]) {
            fail('europe', seed, `silent qualifying hop ${stages[n - 1]} -> ${stages[n]}`);
          }
        }
        /* A tie is never against the club itself. */
        for (const step of journey.steps) {
          if (step.kind !== 'tie') continue;
          if (sameFootballIdentity(step.tie.opponentId, journey.clubId)) {
            fail('europe', seed, `European self tie: ${step.tie.opponentId}`);
          }
        }
        /* A trophy requires having actually gone through the competition. */
        if (journey.wonCompetition) {
          if (!journey.reachedLeaguePhase) {
            fail('europe', seed, 'European trophy without reaching the league phase');
          }
          if (journey.wonCompetition !== journey.finalCompetition) {
            fail('europe', seed, 'won a competition the journey did not end in');
          }
          if (!(journey.finalCompetition in UEFA_COMPETITIONS)) {
            fail('europe', seed, `unknown competition ${journey.finalCompetition}`);
          }
        }
        /* Chronology: nothing beyond the current reveal may be visible. */
        const reveal = europeReveal(career);
        if (reveal !== 'full') {
          for (const step of revealedSteps(career, journey)) {
            if (step.kind === 'league_phase' || step.kind === 'champion') {
              fail('europe', seed, `${step.kind} exposed at reveal=${reveal}`);
            }
          }
        }
      }

      /* ---------------- Transfers ---------------- */
      for (const offer of career.pendingOffers) {
        counts.offers += 1;
        /*
         * `contract` and `promotion` are legitimately from the player's own identity: a new deal
         * at the same club, and the academy-to-senior step, which crosses career entities inside
         * one football club. Everything else would be an offer to transfer to yourself.
         */
        if (
          sameFootballIdentity(offer.clubId, career.currentClubId) &&
          offer.kind !== 'contract' &&
          offer.kind !== 'promotion'
        ) {
          fail('transfer', seed, `offer from own identity: ${offer.kind} ${offer.clubId}`);
        }
      }
      /* The keeper's shirt may only change when the club actually changed. */
      if (career.position === 'GK' && previousClub !== null && previousClub === career.currentClubId) {
        const before = resolveCharacterAsset({
          age: career.age,
          position: 'GK',
          clubId: previousClub,
          seed: career.seed,
          season: career.currentSeason - 1,
        }).colour;
        if (before !== asset.colour) {
          fail('transfer', seed, `GK shirt changed without a transfer at ${career.currentClubId}`);
        }
      }
      previousClub = career.currentClubId;
    },
  });
}

/* ---------------- Determinism ---------------- */
const fingerprint = (seed: number, position: Position): string => {
  let last: Career | null = null;
  simulateCareer({
    playerName: 'אורי דביר',
    position,
    seed,
    policy: balancedPolicy,
    onStep: (c) => {
      last = c;
    },
  });
  const c = last!;
  return JSON.stringify({
    age: c.retirementAge,
    ability: c.ability,
    trophies: c.trophies.map((t) => [t.id, t.season]),
    seasons: c.seasonHistory.map((s) => [s.season, s.clubId, s.stats.appearances, s.stats.goals]),
  });
};

let determinismChecked = 0;
for (let i = 0; i < 20; i += 1) {
  const seed = 31000 + i;
  const position = POSITIONS[i % POSITIONS.length]!;
  determinismChecked += 1;
  if (fingerprint(seed, position) !== fingerprint(seed, position)) {
    fail('determinism', seed, 'the same seed produced two different careers');
  }
}

/* ---------------- Report ---------------- */
console.log(`careers            ${counts.careers}  (${POSITIONS.join(', ')}, two policies)`);
console.log(`beats walked       ${counts.beats}`);
console.log(`fixtures           ${counts.fixtures}`);
console.log(`matchdays          ${counts.matchdays}`);
console.log(`season records     ${counts.seasonRecords}`);
console.log(`cup finals         ${counts.cupFinals}`);
console.log(`european journeys  ${counts.europeanJourneys}`);
console.log(`goalkeeper assets  ${counts.gkAssets}`);
console.log(`pending offers     ${counts.offers}`);
console.log(`determinism pairs  ${determinismChecked}`);
console.log('');

if (violations.length === 0) {
  console.log('RC INVARIANT VIOLATIONS: 0');
} else {
  console.log(`RC INVARIANT VIOLATIONS: ${violations.length}`);
  const byGroup = new Map<string, Violation[]>();
  for (const v of violations) {
    byGroup.set(v.group, [...(byGroup.get(v.group) ?? []), v]);
  }
  for (const [group, list] of byGroup) {
    console.log(`\n  ${group}  (${list.length})`);
    for (const v of [...new Set(list.map((x) => x.detail))].slice(0, 6)) {
      console.log(`    ${v}`);
    }
  }
  process.exitCode = 1;
}

void MACCABI_ID;

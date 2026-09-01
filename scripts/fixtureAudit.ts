/*
 * The self-opponent audit (v0.9.5.1).
 *
 * A playtest produced **מכבי חיפה vs מכבי חיפה**. A club cannot play itself, and the failure was
 * not a display bug: the two sides were genuinely different career entities - `maccabi_youth` and
 * `maccabi_haifa` - which share one football identity through `crestOwnerId` and therefore render
 * with the same name, crest and colours. Every generator checked `a !== b` and waved it through.
 *
 * Reading the code found two such paths. This exists because reading cannot prove there is not a
 * third: the invariant is a property of what the game would SHOW at each beat, across a whole
 * career, in every competition. So this walks thousands of real beats and looks at each one.
 *
 * What it checks, per beat:
 *
 *   activeFixture      the presentation boundary - what the player would actually see
 *   matchContext       the league opponent, including the derby / vsMaccabi / former-club paths
 *   cupFinalOpponent   the domestic cup draw
 *   europe journey     every stored European tie for the watched club
 *
 * Expected result: 0 violations. Any number above zero is a shipped impossibility.
 *
 *   npm run fixture:audit            600 careers
 *   npm run fixture:audit -- 2000    more
 */
import { MACCABI_ACADEMY_ID, MACCABI_ID, MACCABI_YOUTH_ID } from '../src/data/clubs';
import { sameFootballIdentity } from '../src/data/clubVisuals';
import { clubDisplayName } from '../src/game/identity';
import { activeFixture } from '../src/game/fixture';
import { cupFinalOpponent } from '../src/game/cupEngine';
import { matchContext } from '../src/game/matchEngine';
import { balancedPolicy, simulateCareer } from '../src/game/simulate';
import type { Career, Position } from '../src/types';

const careers = Number(process.argv[2] ?? 600);

interface Violation {
  source: string;
  seed: number;
  season: number;
  playerClubId: string;
  opponentClubId: string;
  shownAs: string;
}

const violations: Violation[] = [];
let beats = 0;
let fixtures = 0;
let contexts = 0;
let cupFinals = 0;
let euroTies = 0;

function check(
  source: string,
  career: Career,
  opponentClubId: string | null | undefined,
  playerClubId = career.currentClubId,
): void {
  if (!opponentClubId) return;
  if (!sameFootballIdentity(playerClubId, opponentClubId)) return;
  violations.push({
    source,
    seed: career.seed,
    season: career.currentSeason,
    playerClubId,
    opponentClubId,
    /* What the player would have READ, which is the whole reason this is a bug and not a curiosity. */
    shownAs: `${clubDisplayName(playerClubId)} vs ${clubDisplayName(opponentClubId)}`,
  });
}

const POSITIONS: Position[] = ['ST', 'CM', 'GK', 'CB', 'WG'];

for (let i = 0; i < careers; i += 1) {
  const seed = 1000 + i;
  simulateCareer({
    playerName: 'אורי דביר',
    position: POSITIONS[i % POSITIONS.length]!,
    seed,
    policy: balancedPolicy,
    onStep: (career) => {
      beats += 1;

      /* 1. What the screens would render. The boundary that matters most. */
      const fixture = activeFixture(career);
      if (fixture) {
        fixtures += 1;
        check(`activeFixture:${fixture.kind}`, career, fixture.opponentClubId, fixture.playerClubId);
      }

      /*
       * 2. The league context directly, including the paths an EVENT can force. A `vsMaccabi`
       *    event at a Maccabi club, or a derby whose rival table entry is the club's own parent,
       *    are exactly the requirements that bypass an ordinary weighted pick.
       */
      for (const require of [
        undefined,
        { derby: true },
        { maccabi: true },
        { formerClub: true },
      ] as const) {
        const context = matchContext(career, undefined, require);
        if (!context) continue;
        contexts += 1;
        check(`matchContext:${require ? Object.keys(require)[0] : 'plain'}`, career, context.opponentClubId);
      }

      /* 3. The domestic cup draw, whenever a final is committed. */
      const cup = cupFinalOpponent(career);
      if (cup) {
        cupFinals += 1;
        check('cupFinal', career, cup);
      }

      /* 4. Every stored European tie for the club being watched. */
      const journey = career.world.europe?.current?.playerJourney;
      if (journey && journey.clubId === career.currentClubId) {
        for (const step of journey.steps) {
          if (step.kind !== 'tie') continue;
          euroTies += 1;
          check(`europeTie:${step.tie.stage}`, career, step.tie.opponentId, journey.clubId);
        }
      }
    },
  });
}

/*
 * The synthetic half. The simulated careers above are realistic but they do not guarantee that a
 * player is ever standing in the youth setup at the moment a `vsMaccabi` event asks for a fixture
 * - and that pairing is the one that actually shipped. So the three Maccabi entities are asked
 * about each other directly.
 */
const IDENTITY_PAIRS: [string, string][] = [
  [MACCABI_ID, MACCABI_ID],
  [MACCABI_ID, MACCABI_YOUTH_ID],
  [MACCABI_ID, MACCABI_ACADEMY_ID],
  [MACCABI_YOUTH_ID, MACCABI_ACADEMY_ID],
];
let identityChecks = 0;
for (const [a, b] of IDENTITY_PAIRS) {
  identityChecks += 1;
  if (!sameFootballIdentity(a, b)) {
    violations.push({
      source: 'sameFootballIdentity',
      seed: -1,
      season: -1,
      playerClubId: a,
      opponentClubId: b,
      shownAs: `${clubDisplayName(a)} / ${clubDisplayName(b)} not recognised as one identity`,
    });
  }
}

console.log(`careers            ${careers}`);
console.log(`beats walked       ${beats}`);
console.log(`fixtures presented ${fixtures}`);
console.log(`match contexts     ${contexts}`);
console.log(`cup finals         ${cupFinals}`);
console.log(`european ties      ${euroTies}`);
console.log(`identity pairs     ${identityChecks}`);
console.log('');

if (violations.length === 0) {
  console.log('SELF-OPPONENT VIOLATIONS: 0');
} else {
  console.log(`SELF-OPPONENT VIOLATIONS: ${violations.length}`);
  const bySource = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = bySource.get(v.source) ?? [];
    list.push(v);
    bySource.set(v.source, list);
  }
  for (const [source, list] of bySource) {
    console.log(`\n  ${source}  (${list.length})`);
    for (const v of list.slice(0, 5)) {
      console.log(`    seed ${v.seed} ${v.season}: ${v.playerClubId} vs ${v.opponentClubId}  -> "${v.shownAs}"`);
    }
  }
  process.exitCode = 1;
}

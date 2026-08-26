/**
 * Headless balancing harness.
 *
 *   npm run simulate                 # 2,000 careers per strategy (quick check)
 *   npm run simulate:large           # 20,000 careers per strategy (the real run)
 *   npm run simulate -- --careers=5000 --policy=balanced
 *
 * Prints the metrics the balance guardrails are written against, plus a luck-validation
 * check that the same decisions on different seeds really do produce different careers.
 * Developer tooling only - nothing here is ever imported by the app.
 */

import { POSITION_LIST } from '../src/game/balance';
import {
  ambitiousPolicy,
  balancedPolicy,
  loyalPolicy,
  randomPolicy,
  riskTakerPolicy,
  simulateBatch,
  simulateCareer,
  simulatePaired,
  type BatchResult,
  type CareerPolicy,
} from '../src/game/simulate';
import type { Position } from '../src/types';

const POLICIES: Record<string, CareerPolicy> = {
  balanced: balancedPolicy,
  loyalist: loyalPolicy,
  ambitious: ambitiousPolicy,
  riskTaker: riskTakerPolicy,
  random: randomPolicy,
};

/* ------------------------------------------------------------------ */
/* Args                                                                */
/* ------------------------------------------------------------------ */

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split('=')[1];
}

const careersPerPolicy = Number(arg('careers') ?? 2000);
const onlyPolicy = arg('policy');
const positionsMode = arg('positions') ?? 'rotate';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const num = (value: number, decimals = 1): string => value.toFixed(decimals);
const pad = (text: string, width: number): string => text.padEnd(width);
const padStart = (text: string, width: number): string => text.padStart(width);

function row(label: string, value: string): void {
  console.log(`  ${pad(label, 34)}${padStart(value, 10)}`);
}

function heading(text: string): void {
  console.log(`\n${text}`);
  console.log('-'.repeat(Math.max(text.length, 46)));
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

function reportBatch(name: string, result: BatchResult): void {
  heading(`STRATEGY: ${name}  (${result.count.toLocaleString()} careers)`);

  row('reached Maccabi senior team', pct(result.reachedMaccabiSeniors));
  row('failed to reach senior team', pct(result.failedToReachMaccabiSeniors));
  row('academy graduate (נוער → בוגרים)', pct(result.academyGraduates));
  row('not kept at end of נוער', pct(result.releasedFromAcademy));
  row('squeezed out of the first team', pct(result.releasedFromSeniorTeam));
  row('early academy promotion', pct(result.earlyPromotion));
  row('played/trained with older group', pct(result.playedWithOlderGroup));
  row('became regular starter', pct(result.reachedStarter));
  row('became key player', pct(result.reachedKeyPlayer));
  row('became captain', pct(result.captain));
  row('played abroad', pct(result.leftForEurope));
  row('returned to Maccabi', pct(result.returnedToMaccabi));
  row('saw a rare event', pct(result.rareBreakthrough));
  row('avg peak ability', num(result.averagePeakAbility));
  row('avg Legend Score', num(result.averageLegendScore));
  row('median Legend Score', num(result.legendMedian));
  row('Legend Score std dev', num(result.legendStdDev, 2));
  row('avg Maccabi appearances', num(result.averageMaccabiAppearances));
  row('avg career seasons', num(result.averageCareerSeasons));
  row('avg retirement age', num(result.averageRetirementAge));

  console.log('\n  Legend Score distribution');
  for (const [label, count] of Object.entries(result.legendDistribution)) {
    const share = count / result.count;
    const bar = '#'.repeat(Math.round(share * 50));
    console.log(`    ${pad(label, 8)}${padStart(pct(share), 7)}  ${bar}`);
  }

  console.log('\n  Story systems (v0.3)');
  row('careers carrying a memory', pct(result.withMemories));
  row('careers running a story arc', pct(result.withStoryArcs));
  row('avg milestones per career', num(result.averageMilestones));
  row('avg traits revealed', num(result.averageTraitsRevealed, 2));

  console.log('\n  Recovery');
  row('careers that hit a slump', pct(result.recovery.careersWithSlump));
  row('slumps recovered within 3 seasons', pct(result.recovery.recoveryRate));
  row('avg seasons to recover', num(result.recovery.averageSeasonsToRecover, 2));

  console.log('\n  Origin (v0.3.1)');
  row('scouted straight into Maccabi', pct(result.origin.scoutedDirectly));
  row('passed the Maccabi trials', pct(result.origin.trialAccepted));
  row('rejected at the trials', pct(result.origin.trialRejected));
  console.log('    of those rejected at nine:');
  row('  later invited back', pct(result.origin.rejectedLaterInvited));
  row('  later joined Maccabi', pct(result.origin.rejectedLaterJoinedMaccabi));
  row('  never joined Maccabi', pct(result.origin.rejectedNeverJoinedMaccabi));
  row('  reached senior football', pct(result.origin.rejectedReachedSeniorFootball));
  row('  played for Maccabi seniors', pct(result.origin.rejectedPlayedForMaccabiSeniors));
  row('  played abroad', pct(result.origin.rejectedPlayedAbroad));

  console.log('\n  Cohort invariants (must be zero)');
  row('INVALID natural-stage repeats', String(result.origin.invalidNaturalStageRepeats));
  row('registered behind own cohort', String(result.origin.registeredBehindCohort));
  row('legal "cohort caught up"', String(result.origin.cohortCaughtUp));
  row('full early promotions', String(result.origin.fullEarlyPromotions));

  console.log('\n  Academy ladder');
  row('normal promotion', pct(result.academy.normalPromotionShare));
  row('early promotion (skipped a level)', pct(result.academy.earlyPromotionShare));
  // v0.3.1: this can only be a legal case now - the cohort catching up, or a נוער hold.
  row('same age group again (legal)', pct(result.academy.repeatedYearShare));
  row('avg age leaving the academy', num(result.academy.averageAgeLeavingAcademy));
  row('avg seasons in the academy', num(result.academy.averageAcademySeasons));

  console.log('\n  Repetition');
  row('avg events per career', num(result.repetition.averageEventsPerCareer));
  row('avg repeated events', num(result.repetition.averageRepeatedEvents, 2));
  row('avg longest same-category run', num(result.repetition.averageLongestCategoryRun, 2));
  row('worst same-category run', String(result.repetition.worstCategoryRun));
  row('identical event sequences', pct(result.repetition.duplicateSequenceShare));
  row('distinct events used', String(result.repetition.distinctEventsUsed));

  console.log('\n  By position');
  console.log(`    ${pad('pos', 8)}${padStart('peak', 8)}${padStart('legend', 8)}${padStart('seniors', 9)}`);
  for (const position of POSITION_LIST) {
    const stats = result.byPosition[position.id];
    if (!stats) continue;
    console.log(
      `    ${pad(position.label, 8)}${padStart(num(stats.peakAbility), 8)}${padStart(
        num(stats.legend),
        8,
      )}${padStart(pct(stats.reachedSeniors), 9)}`,
    );
  }

  const topEndings = Object.entries(result.endings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  console.log('\n  Most common endings');
  for (const [title, count] of topEndings) {
    console.log(`    ${pad(title, 30)}${padStart(pct(count / result.count), 8)}`);
  }
}

/* ------------------------------------------------------------------ */
/* Matched-seed comparison                                             */
/* ------------------------------------------------------------------ */

/**
 * The decisions-vs-luck question. Every strategy plays the same seeds, so any difference
 * between them is decision quality rather than a kinder random universe.
 */
function reportPaired(seeds: number): void {
  heading(`MATCHED-SEED COMPARISON  (${seeds.toLocaleString()} seeds x ${Object.keys(POLICIES).length} strategies)`);

  const result = simulatePaired(seeds, POLICIES, {
    playerName: 'סימולציה',
    position: 'CM',
    rotatePositions: true,
  });

  console.log(
    `  ${pad('strategy', 12)}${padStart('mean', 8)}${padStart('median', 8)}${padStart('sd', 7)}` +
      `${padStart('peak', 7)}${padStart('seniors', 9)}${padStart('beats base', 12)}${padStart('vs base', 9)}`,
  );
  console.log('  ' + '-'.repeat(72));
  for (const name of Object.keys(POLICIES)) {
    console.log(
      `  ${pad(name, 12)}` +
        padStart(num(result.meanByStrategy[name] ?? 0), 8) +
        padStart(num(result.medianByStrategy[name] ?? 0), 8) +
        padStart(num(result.stdDevByStrategy[name] ?? 0), 7) +
        padStart(num(result.peakAbilityByStrategy[name] ?? 0), 7) +
        padStart(pct(result.reachedSeniorsByStrategy[name] ?? 0), 9) +
        padStart(pct(result.winRateVsBaseline[name] ?? 0), 12) +
        padStart((result.meanDeltaVsBaseline[name] ?? 0).toFixed(1), 9),
    );
  }

  console.log(`\n  baseline strategy                 ${result.baseline}`);
  console.log(`  seed-driven spread (sd, one strategy)   ${num(result.baselineSeedStdDev, 2)}`);
  console.log(`  decision-driven spread (same seed)      ${num(result.meanWithinSeedSpread, 2)}`);
  console.log(
    '  "beats base" is measured seed-by-seed, so 50% would mean decisions do not matter.',
  );
}

/* ------------------------------------------------------------------ */
/* Luck validation                                                     */
/* ------------------------------------------------------------------ */

/**
 * The two properties the whole design rests on: a seed is reproducible, and the same
 * decisions on a different seed tell a different story.
 */
function reportLuck(): void {
  heading('LUCK VALIDATION');

  const sameSeedA = simulateCareer({ playerName: 'לוק', position: 'CM', seed: 17384920, policy: balancedPolicy });
  const sameSeedB = simulateCareer({ playerName: 'לוק', position: 'CM', seed: 17384920, policy: balancedPolicy });
  const reproducible =
    sameSeedA.legend?.score === sameSeedB.legend?.score &&
    sameSeedA.maccabi.appearances === sameSeedB.maccabi.appearances &&
    sameSeedA.peakAbility === sameSeedB.peakAbility &&
    sameSeedA.eventsHistory.length === sameSeedB.eventsHistory.length;
  row('same seed reproduces career', reproducible ? 'PASS' : 'FAIL');

  const scores: number[] = [];
  const peaks: number[] = [];
  const stageDepth = new Set<string>();
  for (let seed = 1; seed <= 400; seed += 1) {
    const career = simulateCareer({ playerName: 'לוק', position: 'CM', seed, policy: balancedPolicy });
    scores.push(career.legend?.score ?? 0);
    peaks.push(career.peakAbility);
    stageDepth.add(career.legend?.ending.id ?? 'none');
  }
  const distinctScores = new Set(scores).size;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length);
  const peakMin = Math.min(...peaks);
  const peakMax = Math.max(...peaks);

  row('distinct Legend Scores / 400 seeds', String(distinctScores));
  row('Legend Score range', `${min}-${max}`);
  row('Legend Score std dev', num(sd, 2));
  row('peak ability range', `${num(peakMin)}-${num(peakMax)}`);
  row('distinct endings reached', String(stageDepth.size));
  row('different seeds diverge', distinctScores > 20 && sd > 5 ? 'PASS' : 'FAIL');
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const started = Date.now();
  const names = onlyPolicy ? [onlyPolicy] : Object.keys(POLICIES);

  console.log('MACCABIST - career simulation');
  console.log(`${careersPerPolicy.toLocaleString()} careers per strategy, ${names.length} strategies`);

  let total = 0;
  for (const name of names) {
    const policy = POLICIES[name];
    if (!policy) {
      console.error(`Unknown policy: ${name}. Known: ${Object.keys(POLICIES).join(', ')}`);
      process.exitCode = 1;
      return;
    }

    // Rotating positions keeps every batch representative of the whole game rather than
    // measuring one position's quirks.
    const position: Position | undefined =
      positionsMode === 'rotate' ? undefined : (positionsMode as Position);

    const result = simulateBatch(careersPerPolicy, {
      playerName: 'סימולציה',
      position: position ?? 'CM',
      policy,
      rotatePositions: positionsMode === 'rotate',
    });
    reportBatch(name, result);
    total += careersPerPolicy;
  }

  if (!onlyPolicy) reportPaired(Number(arg('paired') ?? Math.min(careersPerPolicy, 3000)));
  reportLuck();

  const seconds = (Date.now() - started) / 1000;
  console.log(
    `\nSimulated ${total.toLocaleString()} careers in ${seconds.toFixed(1)}s ` +
      `(${Math.round(total / Math.max(seconds, 0.001)).toLocaleString()} careers/sec)`,
  );
}

main();

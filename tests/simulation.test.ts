import { describe, expect, it } from 'vitest';

import {
  balancedPolicy,
  findRecoveries,
  loyalPolicy,
  randomPolicy,
  simulateBatch,
  simulateCareer,
  simulatePaired,
} from '../src/game/simulate';

describe('headless simulation', () => {
  it('plays a full career from the academy to retirement', () => {
    const career = simulateCareer({ playerName: 'סימולציה', position: 'CM', seed: 4242 });
    expect(career.retired).toBe(true);
    expect(career.legend).not.toBeNull();
    /*
     * A believable range, not one seed's answer.
     *
     * This asserted >= 33, which was this particular seed's retirement age until the v0.4.5.1
     * rating change moved its trajectory and it ended at 31. 31 is a perfectly legitimate
     * outcome - the longevity model puts 1.8% of outfield careers in the 29-31 band - so the
     * assertion was pinning an incidental fact about seed 4242 rather than a property of the game.
     */
    expect(career.age).toBeGreaterThanOrEqual(28);
    expect(career.age).toBeLessThanOrEqual(43);
    expect(career.seasonHistory.length).toBeGreaterThan(10);
  });

  it('is reproducible for a fixed seed', () => {
    const a = simulateCareer({ playerName: 'א', position: 'ST', seed: 99 });
    const b = simulateCareer({ playerName: 'א', position: 'ST', seed: 99 });
    expect(a.legend?.score).toBe(b.legend?.score);
    expect(a.maccabi.appearances).toBe(b.maccabi.appearances);
    expect(a.seasonHistory.length).toBe(b.seasonHistory.length);
  });

  it('produces different careers for different seeds', () => {
    const scores = new Set(
      [1, 2, 3, 4, 5, 6].map(
        (seed) => simulateCareer({ playerName: 'ב', position: 'WG', seed }).legend?.score,
      ),
    );
    expect(scores.size).toBeGreaterThan(2);
  });

  it('rewards the loyal policy with a higher average legend score', () => {
    const random = simulateBatch(60, { playerName: 'ר', position: 'CM', policy: randomPolicy });
    const loyal = simulateBatch(60, { playerName: 'ל', position: 'CM', policy: loyalPolicy });
    expect(loyal.averageLegendScore).toBeGreaterThan(random.averageLegendScore);
  });

  it('runs the story systems in real careers', () => {
    let withMemory = 0;
    let withArc = 0;
    let withMilestones = 0;
    let traitsRevealed = 0;
    const N = 60;

    for (let seed = 1; seed <= N; seed += 1) {
      const career = simulateCareer({ playerName: 'ס', position: 'CM', seed, policy: balancedPolicy });
      if (career.memories.length > 0) withMemory += 1;
      if (career.completedArcs.length > 0 || career.arcs.length > 0) withArc += 1;
      if (career.milestones.length >= 3) withMilestones += 1;
      traitsRevealed += career.traits.filter((t) => t.revealed).length;
    }

    // These are the systems that make a career feel continuous - they must actually fire.
    expect(withMemory / N).toBeGreaterThan(0.8);
    expect(withArc / N).toBeGreaterThan(0.5);
    expect(withMilestones / N).toBeGreaterThan(0.8);
    expect(traitsRevealed / N).toBeGreaterThan(0.5);
  });

  it('advances and completes story arcs through the real game loop', () => {
    let sawCompletedArc = false;
    let sawMultiStageArc = false;

    for (let seed = 1; seed <= 80 && !(sawCompletedArc && sawMultiStageArc); seed += 1) {
      const career = simulateCareer({ playerName: 'ס', position: 'ST', seed, policy: balancedPolicy });
      if (career.completedArcs.length > 0) sawCompletedArc = true;
      // An arc that got past its opening event proves the staging works end to end.
      if (career.arcs.some((arc) => arc.stage >= 2)) sawMultiStageArc = true;
    }

    expect(sawCompletedArc).toBe(true);
    expect(sawMultiStageArc).toBe(true);
  });

  it('gives careers that recover from a slump, and careers that do not', () => {
    let slumps = 0;
    let recovered = 0;
    for (let seed = 1; seed <= 150; seed += 1) {
      const career = simulateCareer({ playerName: 'ס', position: 'CB', seed, policy: balancedPolicy });
      const result = findRecoveries(career);
      slumps += result.slumps;
      recovered += result.recovered;
    }

    expect(slumps).toBeGreaterThan(0);
    const rate = recovered / slumps;
    // Neither "one bad season ends you" nor "nothing has consequences".
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.95);
  });

  it('makes decision strategy matter on matched seeds', () => {
    const result = simulatePaired(
      120,
      { balanced: balancedPolicy, random: randomPolicy },
      { playerName: 'ס', position: 'CM', rotatePositions: true },
      'random',
    );

    // Thinking about decisions should beat not thinking, well clear of a coin flip.
    expect(result.winRateVsBaseline.balanced).toBeGreaterThan(0.6);
    expect(result.meanByStrategy.balanced ?? 0).toBeGreaterThan(result.meanByStrategy.random ?? 0);
    /*
     * ...and decisions should move outcomes about as much as the seed does.
     *
     * Until v0.5 this was a strict `>`. v0.5 deliberately added a luck axis the player does not
     * choose - WHO manages you - and the brief requires that axis to be meaningful ("youth-
     * believer manager should meaningfully increase opportunity probability", Phase 53). Seed
     * variance therefore rose by design, and forcing it back down would mean making the
     * archetypes cosmetic, which is the failure mode the brief names explicitly.
     *
     * The bar is now: decision spread stays within 15% of seed luck, AND the win rate above
     * keeps decisions well clear of a coin flip. Measured at the change: spread 20.9 against
     * stddev 22.3 with people, 22.9 against 20.4 without them - the whole gap is the people
     * axis, tuned down three times (weights, factor ranges, academy scoping) before this
     * threshold moved at all.
     */
    expect(result.meanWithinSeedSpread).toBeGreaterThan(result.baselineSeedStdDev * 0.85);
  });

  it('keeps every career inside sane bounds', () => {
    const batch = simulateBatch(80, { playerName: 'ג', position: 'CB', policy: randomPolicy });
    expect(batch.averageLegendScore).toBeGreaterThan(5);
    expect(batch.averageLegendScore).toBeLessThan(95);
    expect(batch.averagePeakAbility).toBeGreaterThan(35);
    expect(Object.keys(batch.endings).length).toBeGreaterThan(1);
  });
});

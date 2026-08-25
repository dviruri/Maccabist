import { describe, expect, it } from 'vitest';

import { loyalPolicy, randomPolicy, simulateBatch, simulateCareer } from '../src/game/simulate';

describe('headless simulation', () => {
  it('plays a full career from the academy to retirement', () => {
    const career = simulateCareer({ playerName: 'סימולציה', position: 'CM', seed: 4242 });
    expect(career.retired).toBe(true);
    expect(career.legend).not.toBeNull();
    expect(career.age).toBeGreaterThanOrEqual(33);
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

  it('keeps every career inside sane bounds', () => {
    const batch = simulateBatch(80, { playerName: 'ג', position: 'CB', policy: randomPolicy });
    expect(batch.averageLegendScore).toBeGreaterThan(5);
    expect(batch.averageLegendScore).toBeLessThan(95);
    expect(batch.averagePeakAbility).toBeGreaterThan(35);
    expect(Object.keys(batch.endings).length).toBeGreaterThan(1);
  });
});

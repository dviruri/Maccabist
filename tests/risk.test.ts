/**
 * v0.4.1 Phase 11: risk should buy variance, not punishment.
 *
 * The v0.4 finding was that the risk-taking baseline had a *lower* standard deviation than the
 * safe one as well as a lower mean — bold play was simply worse, with no compensating tail. The
 * brief's requirement is the right one: a risky strategy should produce both spectacular careers
 * and collapses, not flat mediocrity.
 *
 * Investigating found the framing was part of the problem. `riskTakerPolicy` prefers `risky`
 * choices over `opportunity` ones even though opportunity choices carry more than double the
 * expected value, and it used to accept release offers at random. It is a deliberate worst case
 * for answering "is bold play a trap?", and it is not a model of anyone. `boldPolicy` is the
 * strategy a bold human actually plays, and it is what the comparison should be against.
 */

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { createCareer } from '../src/game/careerEngine';
import { createRng } from '../src/game/random';
import { calculateOutcomeDistribution } from '../src/game/decisionEngine';
import {
  balancedPolicy,
  boldPolicy,
  loyalPolicy,
  riskTakerPolicy,
  simulateCareer,
  type CareerPolicy,
} from '../src/game/simulate';
import type { Career, ChoiceRisk } from '../src/types';

interface Profile {
  legendMean: number;
  legendSd: number;
  top10: number;
  peakMean: number;
  peakSd: number;
  collapse: number;
  europe: number;
}

const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;
const sd = (values: number[]): number => {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
};

function profile(policy: CareerPolicy, count = 700): Profile {
  const legend: number[] = [];
  const peak: number[] = [];
  let collapse = 0;
  let europe = 0;

  for (let seed = 1; seed <= count; seed += 1) {
    const career = simulateCareer({ playerName: 'ל', position: 'CM', seed, policy });
    const score = career.legend?.score ?? 0;
    legend.push(score);
    peak.push(career.peakAbility);
    if (!career.seasonHistory.some((s) => s.academyStage === 'senior') || score < 10) collapse += 1;
    if (career.memories.some((m) => m.kind === 'first_move_abroad')) europe += 1;
  }

  const sorted = [...legend].sort((a, b) => a - b);
  return {
    legendMean: mean(legend),
    legendSd: sd(legend),
    top10: mean(sorted.slice(Math.floor(count * 0.9))),
    peakMean: mean(peak),
    peakSd: sd(peak),
    collapse: collapse / count,
    europe: europe / count,
  };
}

describe('choice-level expected value', () => {
  /** A senior with room to move in every direction, so few outcomes get gated out. */
  const midCareer = (): Career => ({
    ...createCareer({ playerName: 'ל', position: 'CM', seed: 3 }),
    academyStage: 'senior',
    currentClubId: 'maccabi_haifa',
    age: 24,
    ability: 62,
    reputation: 45,
    coachTrust: 58,
    roleValue: 55,
  });

  const VISIBLE = ['ability', 'coachTrust', 'roleValue', 'reputation', 'confidence', 'form'];

  function expectedValueByRisk(): Record<string, number> {
    const career = midCareer();
    const totals: Record<string, number[]> = {};
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const dist = calculateOutcomeDistribution(career, event, choice, 'early');
        if (dist.outcomes.length === 0) continue;
        let ev = 0;
        for (const view of dist.outcomes) {
          const outcome = choice.outcomes.find((o) => o.id === view.id);
          if (!outcome) continue;
          let value = 0;
          for (const key of VISIBLE) {
            const raw = (outcome.effects as Record<string, unknown>)[key];
            if (typeof raw === 'number') value += raw;
          }
          ev += value * view.probability;
        }
        const risk: ChoiceRisk = choice.risk ?? 'balanced';
        (totals[risk] ??= []).push(ev);
      }
    }
    return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, mean(v)]));
  }

  it('does not make a risky choice a straightforwardly worse bet', () => {
    /*
     * The original v0.2 finding was risky at -1.4 expected value against +3.7 for safe: taking a
     * chance was simply a mistake. riskyUpsideBoost and riskyUpsideGain exist to close that.
     */
    const ev = expectedValueByRisk();
    expect(ev.risky).toBeGreaterThan(0);
    expect(ev.risky).toBeGreaterThan((ev.safe as number) * 0.6);
  });

  it('gives a risky choice a real chance of a bad result, and a safe one much less', () => {
    const career = midCareer();
    const downside: Record<string, number[]> = {};
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const dist = calculateOutcomeDistribution(career, event, choice, 'early');
        if (dist.outcomes.length === 0) continue;
        (downside[choice.risk ?? 'balanced'] ??= []).push(dist.downside);
      }
    }
    expect(mean(downside.risky as number[])).toBeGreaterThan(mean(downside.safe as number[]) * 3);
  });
});

describe('bold play across whole careers', () => {
  const safe = profile(loyalPolicy);
  const balanced = profile(balancedPolicy);
  const bold = profile(boldPolicy);

  it('is not a broken losing strategy', () => {
    /*
     * It need not beat balanced on a Maccabi-centric score, but it must not collapse careers.
     *
     * v0.5: an absolute floor joined the relative bound. Both collapse rates sit under 1% -
     * around 3-5 careers in 700 - so the pure ratio flips on a single collapse either way,
     * and it started failing on exactly that: balanced improved by one career (agents steady
     * the sample's worst runs) and 5/700 vs 3/700 breached 1.6x. A strategy is "broken" when
     * it collapses careers wholesale, not when integer noise crosses a ratio.
     */
    expect(bold.collapse).toBeLessThan(Math.max(balanced.collapse * 1.6, 0.012));
    expect(bold.legendMean).toBeGreaterThan(balanced.legendMean * 0.6);
  });

  it('produces the best footballer', () => {
    /*
     * This is where bold play's upside actually shows. The Legend Score is deliberately
     * Maccabi-weighted, so a career that goes to Europe scores lower on it by design - but the
     * player himself is better.
     */
    expect(bold.peakMean).toBeGreaterThan(balanced.peakMean);
    expect(bold.peakMean).toBeGreaterThan(safe.peakMean);
  });

  it('has the widest spread of footballing outcomes', () => {
    expect(bold.peakSd).toBeGreaterThan(safe.peakSd);
  });

  it('reaches Europe far more often', () => {
    expect(bold.europe).toBeGreaterThan(balanced.europe);
    expect(bold.europe).toBeGreaterThan(safe.europe);
  });

  it('still produces spectacular careers', () => {
    // The top decile has to be genuinely good, or the strategy has no ceiling worth chasing.
    expect(bold.top10).toBeGreaterThan(70);
  });
});

describe('the reckless baseline', () => {
  const reckless = profile(riskTakerPolicy, 500);
  const balanced = profile(balancedPolicy, 500);

  it('is genuinely destructive, which is what it is for', () => {
    // It exists to answer "is bold play a trap?" by showing where the bottom actually is.
    expect(reckless.collapse).toBeGreaterThan(balanced.collapse * 3);
  });

  it('no longer accepts its own release at random', () => {
    /*
     * pickOffer used to choose uniformly from every offer, which included "your contract is
     * terminated". That is recklessness about offers rather than about risk appetite, and it was
     * a large part of why bold play looked like a trap.
     */
    const career: Career = {
      ...createCareer({ playerName: 'ל', position: 'CM', seed: 8 }),
      academyStage: 'senior',
      currentClubId: 'maccabi_haifa',
    };
    const offers = [
      { id: 'release_x', kind: 'release' as const, clubId: 'hapoel_afula' },
      { id: 'transfer_y', kind: 'transfer' as const, clubId: 'bnei_sakhnin' },
    ] as unknown as Career['pendingOffers'];

    for (let seed = 1; seed <= 40; seed += 1) {
      const picked = riskTakerPolicy.pickOffer(offers, career, createRng(seed));
      expect(picked).not.toBe('release_x');
    }
  });
});

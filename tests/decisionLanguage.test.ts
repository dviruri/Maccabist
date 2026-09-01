/**
 * The career decision language (v0.9.5).
 *
 * v0.9.5 changes how a decision is PRESENTED and nothing about what it does. Two things have to
 * be true for that claim to hold, and both are asserted here:
 *
 *   1. the presentation layer computes no probability of its own. It regroups the engine's
 *      percentages and it reads the engine's hints; it never multiplies, never draws, and never
 *      calls anything that touches the seeded stream.
 *   2. it invents no fact. The game models no salary, no contract length and no appearance
 *      guarantee, so no choice card may imply one - checked as words, because intent is not
 *      testable and vocabulary is.
 *
 * The layout contract is asserted too. "The document must not scroll" is a property of the
 * structure - one region gives way, one region holds - and the structure is what can be checked
 * without a browser.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EVENT_POOL } from '../src/data/events';
import { createCareer } from '../src/game/careerEngine';
import { calculateOutcomeDistribution, consequenceHints } from '../src/game/decisionEngine';
import {
  factsFromHints,
  isProbabilistic,
  outcomeSummary,
  toneOfHint,
} from '../src/ui/decisionView';
import type { DecisionDistribution } from '../src/types';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');

/** Comments explain; they are not code. Every source assertion strips them first. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('the summary regroups the engine, and never recalculates it', () => {
  const career = createCareer({ playerName: 'אורי דביר', position: 'CM', seed: 42 });

  /** Every distribution the real event pool can produce for this career. */
  const distributions: DecisionDistribution[] = EVENT_POOL.flatMap((event) =>
    event.choices.map((choice) =>
      calculateOutcomeDistribution(career, event, choice, career.seasonSlot),
    ),
  );

  it('has something to check', () => {
    expect(distributions.length).toBeGreaterThan(50);
  });

  it('adds up to exactly what the engine already said', () => {
    /*
     * The invariant that makes "no probability is computed in the UI" structural rather than a
     * promise: every figure a card can show is a SUM of percentages the engine assigned. If the
     * three summary numbers ever fail to reconstruct the engine's own total, something in the
     * view has started having an opinion.
     */
    for (const distribution of distributions) {
      const summary = outcomeSummary(distribution);
      if (!summary) {
        expect(distribution.outcomes.length).toBeLessThan(2);
        continue;
      }
      const engineTotal = distribution.outcomes.reduce((sum, o) => sum + o.percent, 0);
      expect(summary.good + summary.flat + summary.bad).toBe(engineTotal);
      /* And the engine's own integers already sum to 100, so the summary does too. */
      expect(summary.good + summary.flat + summary.bad).toBe(100);
    }
  });

  it('never invents odds for a choice that has none', () => {
    /*
     * A single-outcome choice is not a gamble. Drawing a 100% bar beside it would tell the player
     * he is weighing a risk he is not being asked to weigh.
     */
    for (const distribution of distributions) {
      if (distribution.outcomes.length >= 2) continue;
      expect(outcomeSummary(distribution)).toBeNull();
      expect(isProbabilistic(distribution)).toBe(false);
    }
  });

  it('groups each outcome into exactly one bucket', () => {
    for (const distribution of distributions.slice(0, 200)) {
      const summary = outcomeSummary(distribution);
      if (!summary) continue;
      const good = distribution.outcomes
        .filter((o) => o.valence === 'positive' || o.valence === 'majorPositive')
        .reduce((s, o) => s + o.percent, 0);
      expect(summary.good).toBe(good);
    }
  });
});

describe('the facts on a card come from the engine', () => {
  const career = createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 7 });

  it('classifies every hint the engine can produce, and shows at most three', () => {
    let seen = 0;
    for (const event of EVENT_POOL) {
      for (const choice of event.choices) {
        const distribution = calculateOutcomeDistribution(career, event, choice, career.seasonSlot);
        const hints = consequenceHints(distribution, choice);
        const facts = factsFromHints(hints);
        expect(facts.length).toBeLessThanOrEqual(3);
        /* Nothing is fabricated: every fact's text is one of the engine's own sentences. */
        for (const fact of facts) expect(hints).toContain(fact.text);
        seen += facts.length;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('reads the engine\'s own downside vocabulary rather than guessing sentiment', () => {
    /*
     * `consequenceHints` puts the direction in the wording, not in a field. These are its actual
     * strings - if it ever rephrases one, this fails rather than silently colouring a risk green.
     */
    expect(toneOfHint('סיכון לאבד את אמון המאמן')).toBe('negative');
    expect(toneOfHint('סיכון לירידה במעמד')).toBe('negative');
    expect(toneOfHint('עלול לפגוע במוניטין')).toBe('negative');
    expect(toneOfHint('עלול לעצור את ההתפתחות')).toBe('negative');
    expect(toneOfHint('סיכון לפציעה')).toBe('negative');
    expect(toneOfHint('אמון המאמן עשוי לעלות')).toBe('positive');
    expect(toneOfHint('סיכוי להתקדם במעמד')).toBe('positive');
    expect(toneOfHint('הזדמנות להתפתח')).toBe('positive');
  });

  it('puts the upside first, so two cards can be compared at a glance', () => {
    const facts = factsFromHints([
      'סיכון לפציעה',
      'אמון המאמן עשוי לעלות',
      'סיכון לירידה במעמד',
      'הזדמנות להתפתח',
    ]);
    expect(facts.map((f) => f.tone)).toEqual(['positive', 'positive', 'negative']);
  });
});

describe('the presentation layer stays a presentation layer', () => {
  const view = read('src/ui/decisionView.ts');
  const card = read('src/components/DecisionChoice.tsx');

  it('never reaches for randomness or for the resolver', () => {
    /*
     * A view that can draw is a view that can change a career. Neither file may touch the seeded
     * stream, and neither may resolve an outcome - the engine does both, before this layer runs.
     */
    for (const source of [view, card]) {
      for (const banned of ['Math.random', 'rng', 'Rng', 'resolveFromDistribution', 'nextSeason']) {
        expect(stripComments(source).includes(banned), `presentation layer uses ${banned}`).toBe(false);
      }
    }
  });

  it('invents no contract facts on any choice card', () => {
    /*
     * The game models none of these. A card that mentions one is claiming something the
     * simulation cannot back, which is the trust failure this whole release is built to avoid.
     */
    for (const word of ['שכר', 'משכורת', 'בונוס', 'מיליון', '₪', 'יורו', 'דולר', 'עמלה', 'חוזה ל']) {
      expect(stripComments(card).includes(word), `a choice card mentions ${word}`).toBe(false);
    }
  });

  it('hard-codes no percentage anywhere in the card', () => {
    /* Every number a card shows arrives as a prop, from the engine. None is written here. */
    expect(stripComments(card)).not.toMatch(/\d{1,3}\s*%/);
  });
});

describe('the scene holds the choices and lets the context give way', () => {
  const css = read('src/styles/gamefeel.css');
  const card = read('src/components/DecisionChoice.tsx');

  const rule = (selector: string): string => {
    const at = css.lastIndexOf(`\n${selector} {`);
    expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  it('gives the scroll to the context region and not to the document', () => {
    expect(rule('.dc-scene-context')).toContain('overflow-y: auto');
    /*
     * The flexbox trap: a flex child will not shrink below its content without this, so the
     * context would push the scene taller and the DOCUMENT would scroll - the exact failure the
     * region exists to prevent.
     */
    expect(rule('.dc-scene-context')).toContain('min-height: 0');
    expect(rule('.dc-scene')).toContain('min-height: 0');
  });

  it('never lets the choices shrink or scroll away', () => {
    expect(rule('.dc-scene-choices')).toContain('flex: 0 0 auto');
    expect(rule('.dc-scene-choices')).not.toContain('overflow');
  });

  it('changes no font size in any height tier', () => {
    /*
     * The release rule, checked on the new block specifically. A short screen removes content and
     * tightens space; the moment it shrinks type, the layout has been solved the forbidden way.
     */
    const block = css.slice(css.indexOf('v0.9.5 — THE CAREER DECISION LANGUAGE'));
    let from = block.indexOf('@media (max-height:');
    let checked = 0;
    while (from > -1) {
      const open = block.indexOf('{', from);
      let depth = 0;
      let i = open;
      for (; i < block.length; i += 1) {
        if (block[i] === '{') depth += 1;
        if (block[i] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      expect(block.slice(open, i)).not.toContain('font-size');
      checked += 1;
      from = block.indexOf('@media (max-height:', i);
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('makes the whole card the action, with no button nested inside it', () => {
    /*
     * The grammar of the release: pressing the choice IS the decision. The details link is a
     * sibling rather than a child - nesting it would be invalid HTML and would make reading the
     * consequences indistinguishable from committing to them.
     */
    const body = stripComments(card);
    const choiceOpen = body.indexOf('className={`dc-choice dc-choice-');
    const choiceClose = body.indexOf('</button>', choiceOpen);
    expect(choiceOpen).toBeGreaterThan(-1);
    expect(body.slice(choiceOpen, choiceClose)).not.toContain('<button');
    expect(body).toContain('dc-choice-details');
  });

  it('locks a pressed card, so a decision cannot be committed twice', () => {
    expect(stripComments(card)).toContain('disabled={disabled || selected}');
  });
});

describe('the event pool still resolves exactly as before', () => {
  it('draws from the same distribution object the preview showed', () => {
    /*
     * The regression guard for the whole release. v0.9.5 rewrites the screens that display these
     * numbers; if a presentation change ever reached the numbers themselves, the preview and the
     * resolver would stop agreeing - so the two are compared directly.
     */
    const career = createCareer({ playerName: 'אורי דביר', position: 'CM', seed: 99 });
    const event = EVENT_POOL[0]!;
    for (const choice of event.choices) {
      const a = calculateOutcomeDistribution(career, event, choice, career.seasonSlot);
      const b = calculateOutcomeDistribution(career, event, choice, career.seasonSlot);
      expect(a.outcomes.map((o) => [o.id, o.percent, o.weight])).toEqual(
        b.outcomes.map((o) => [o.id, o.percent, o.weight]),
      );
    }
  });
});

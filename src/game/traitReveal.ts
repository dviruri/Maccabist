/**
 * Trait discovery.
 *
 * Traits are hidden at birth and are meant to be *discovered* - "המאמנים מתחילים להבין שאתה
 * שחקן של משחקים גדולים" lands far better than a character sheet handed to a nine year old.
 *
 * Events can reveal a trait directly, but most reveals should come from the career actually
 * demonstrating the thing. Each rule below asks: has this player now shown it? Checked once a
 * season, and reveals are one-way.
 */

import type { Career, TraitId } from '../types';
import { hasTrait } from './memory';
import { revealTrait } from './progressionEngine';
import { isInAcademy } from './rules';

interface RevealRule {
  trait: TraitId;
  /** Has the career now shown this trait clearly enough to name it? */
  shown(career: Career): boolean;
}

const RULES: readonly RevealRule[] = [
  {
    // Kept improving when everyone else plateaued.
    trait: 'late_bloomer',
    shown: (c) => c.age >= 22 && c.ability >= 62 && c.seasonHistory.some((s) => s.age === 18 && s.ability < 58),
  },
  {
    // Turns up in the games that matter.
    trait: 'big_game',
    shown: (c) => c.trophies.length >= 2 || c.maccabi.europeanRuns >= 1,
  },
  {
    // The body keeps interrupting.
    trait: 'injury_prone',
    shown: (c) => c.seasonHistory.filter((s) => s.stats.injuredGames > 0).length >= 3,
  },
  {
    // Never off the rails, season after season.
    trait: 'professional',
    shown: (c) => c.hidden.discipline >= 72 && c.seasonHistory.length >= 6,
  },
  {
    // Kept finding the referee.
    trait: 'hot_headed',
    shown: (c) => c.hidden.discipline <= 38 && c.seasonHistory.length >= 4,
  },
  {
    // Outworked a ceiling.
    trait: 'hard_worker',
    shown: (c) => c.seasonHistory.length >= 5 && c.ability > c.hidden.potential - 6,
  },
  {
    // The dressing room turned to him.
    trait: 'leader',
    shown: (c) => c.hidden.leadership >= 70 || c.captain,
  },
  {
    // Never looked like the moment was too big.
    trait: 'self_believer',
    shown: (c) => c.hidden.confidence >= 78 && c.seasonHistory.length >= 5,
  },
];

/**
 * Reveals any trait the player has actually demonstrated. Cheap and idempotent, so it can be
 * called every season end.
 */
export function checkTraitReveals(career: Career): Career {
  // Nothing is named while the player is still a child - it would give the game away.
  if (isInAcademy(career) && career.age < 14) return career;

  let next = career;
  for (const rule of RULES) {
    if (!hasTrait(next, rule.trait)) continue;
    const trait = next.traits.find((t) => t.id === rule.trait);
    if (!trait || trait.revealed) continue;
    if (!rule.shown(next)) continue;
    next = revealTrait(next, rule.trait);
  }
  return next;
}

/**
 * A player whose traits never surfaced at all reads as characterless by retirement, so
 * anything still hidden is named at the end - quietly, as part of the closing story.
 */
export function revealRemainingTraits(career: Career): Career {
  let next = career;
  for (const trait of career.traits) {
    if (trait.revealed) continue;
    next = revealTrait(next, trait.id);
  }
  return next;
}

/** Used by the retirement narrative - the traits that shaped the career. */
export function shapingTraits(career: Career): TraitId[] {
  return career.traits.map((t) => t.id);
}

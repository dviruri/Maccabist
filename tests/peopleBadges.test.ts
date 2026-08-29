/**
 * The legacy emblem, and the people history that must not vanish (v0.5.1, Scenarios H and J).
 *
 * The badge bug had a root cause worth pinning rather than patching: the emblem's colour was
 * whatever the platform's emoji font decided. U+1F6E1 (shield) is grey on Apple and RED in
 * Segoe UI Emoji, so on Windows the most Maccabi ending in the game - "הסמל" - wore the one
 * colour this club's identity refuses. These tests forbid the whole class.
 */

import { describe, expect, it } from 'vitest';

import { ENDINGS } from '../src/data/endings';
import { ARCHETYPES } from '../src/game/storyEngine';
import {
  LEGACY_ARCHETYPE_ICONS,
  LEGACY_RANK_ICONS,
  LEGACY_RANK_LABELS,
} from '../src/game/maccabiLegacy';
import { MACCABI_ID } from '../src/data/clubs';
import { createCareer } from '../src/game/careerEngine';
import { validateCareerIntegrity } from '../src/game/integrity';
import { endManagerTenure, installManager, startPersonalCoach } from '../src/game/peopleEngine';
import type { Career } from '../src/types';

/** Glyphs that a major emoji font renders red or orange. None may carry prestige. */
const RED_RENDERING_GLYPHS = [
  '\u{1F6E1}', // shield - RED in Segoe UI Emoji, which is what the playtest saw
  '\u{1F172}', // negative squared latin capital C - a red tile in every font
  '\u{1F534}', // red circle
  '\u{1F7E5}', // red square
  '\u{2764}', // red heart
  '\u{1F6D1}', // stop sign
  '\u{1F4CD}', // round pushpin
];

describe('v0.5.1 J. the legacy badge is brand-consistent', () => {
  it('gives the one-club archetype a green emblem', () => {
    /*
     * v0.6.1: this pinned the TITLE. That title moved to its single authority
     * (`maccabiLegacyRank`), so the test now pins the archetype by id - the property it always
     * meant to protect - and the title assertion moved to the authority test below.
     */
    const oneClub = ARCHETYPES.find((a) => a.id === 'one_club_icon');
    expect(oneClub?.icon).toBe('\u{1F49A}');
  });

  it('keeps the Maccabi Legacy emblems red-free too (v0.6.1)', () => {
    for (const [rank, icon] of Object.entries(LEGACY_RANK_ICONS)) {
      for (const glyph of RED_RENDERING_GLYPHS) {
        expect(icon, `rank ${rank}`).not.toContain(glyph);
      }
    }
    for (const [id, icon] of Object.entries(LEGACY_ARCHETYPE_ICONS)) {
      for (const glyph of RED_RENDERING_GLYPHS) {
        expect(icon, `archetype ${id}`).not.toContain(glyph);
      }
    }
  });

  it('makes Maccabi Legacy the sole authority for the prestige titles (v0.6.1, B2)', () => {
    const SYMBOL = LEGACY_RANK_LABELS.symbol;
    const GREEN_LEGEND = LEGACY_RANK_LABELS.green_legend;

    // No other system may award either title.
    for (const archetype of ARCHETYPES) {
      expect(archetype.title, `storyEngine ${archetype.id}`).not.toBe(SYMBOL);
      expect(archetype.title, `storyEngine ${archetype.id}`).not.toBe(GREEN_LEGEND);
    }
    for (const ending of ENDINGS) {
      expect(ending.title, `ending ${ending.id}`).not.toBe(SYMBOL);
      expect(ending.title, `ending ${ending.id}`).not.toBe(GREEN_LEGEND);
    }
  });

  it('keeps every emblem distinct, so two endings never look alike', () => {
    const icons = ARCHETYPES.map((a) => a.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe('v0.5.1 H. a former personal coach stays part of the story', () => {
  function keeperAt(seed: number): Career {
    const base = createCareer({ playerName: 'ת', position: 'GK', seed });
    const senior: Career = {
      ...base,
      academyStage: 'senior',
      currentClubId: MACCABI_ID,
      age: 21,
      ability: 64,
    };
    return installManager(endManagerTenure(senior, true));
  }

  it('keeps the old specialist, with his id and specialty, after a change', () => {
    let career = startPersonalCoach(keeperAt(12), 'goalkeeping');
    const first = career.people!.personalCoach!.person;

    // Four seasons together, then the focus moves on.
    career = { ...career, currentSeason: career.currentSeason + 4 };
    career = startPersonalCoach(career, 'mental');

    expect(career.people?.personalCoach?.specialty).toBe('mental');

    const former = career.people?.personalCoachHistory ?? [];
    expect(former).toHaveLength(1);
    expect(former[0]?.person.id).toBe(first.id);
    expect(former[0]?.person.name).toBe(first.name);
    expect(former[0]?.specialty).toBe('goalkeeping');
    expect(former[0]?.endedSeason).toBeDefined();

    // And the person references still resolve - nothing orphaned.
    expect(validateCareerIntegrity(career)).toEqual([]);
  });
});

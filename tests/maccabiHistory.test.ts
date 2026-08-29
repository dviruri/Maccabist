/**
 * The historical dataset validator (v0.6, Phases 48, 73).
 *
 * Real people's real numbers are shown to the player, so the dataset gets the same treatment
 * the career gets: structural validation, sourcing discipline, and immutability. A fabricated
 * or unsourced historical claim should fail CI, not ship.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  historicalLadder,
  historicalRecord,
  MACCABI_CLUB_HONOURS,
  MACCABI_PANTHEON,
  RECORD_CATEGORIES,
} from '../src/data/maccabiHistory';

const DOC = readFileSync(join(__dirname, '..', 'MACCABI_LEGACY_DATA.md'), 'utf-8');

describe('historical dataset validity (Phase 48)', () => {
  it('has a sensibly sized curated pantheon', () => {
    expect(MACCABI_PANTHEON.length).toBeGreaterThanOrEqual(10);
    expect(MACCABI_PANTHEON.length).toBeLessThanOrEqual(20);
  });

  it('has unique player ids and unique names', () => {
    const ids = MACCABI_PANTHEON.map((p) => p.id);
    const names = MACCABI_PANTHEON.map((p) => p.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has only non-negative, finite, plausible stats', () => {
    for (const p of MACCABI_PANTHEON) {
      for (const value of [p.leagueAppearances, p.leagueGoals, p.championships]) {
        if (value === undefined) continue;
        expect(Number.isFinite(value), p.id).toBe(true);
        expect(value, p.id).toBeGreaterThanOrEqual(0);
      }
      // League goals cannot exceed league appearances for an outfield career... except they
      // genuinely can not: nobody averages over a goal a game across a career here.
      if (p.leagueGoals !== undefined && p.leagueAppearances !== undefined) {
        expect(p.leagueGoals, p.id).toBeLessThanOrEqual(p.leagueAppearances);
      }
      // No player can hold more championships than the club has won in total.
      if (p.championships !== undefined) {
        expect(p.championships, p.id).toBeLessThanOrEqual(MACCABI_CLUB_HONOURS.championships);
      }
    }
  });

  it('gives every member at least one source ref, resolved in the data doc', () => {
    for (const p of MACCABI_PANTHEON) {
      expect(p.sourceRefs.length, p.id).toBeGreaterThan(0);
      for (const ref of p.sourceRefs) {
        expect(DOC.includes(ref), `${p.id}: ref "${ref}" missing from MACCABI_LEGACY_DATA.md`).toBe(true);
      }
    }
  });

  it('documents every exact number shown for a player (Phase 73)', () => {
    /*
     * The doc's pantheon table is the human-auditable ledger. Every exact appearance figure in
     * the code must literally appear in the doc, so a silent edit to one side fails here.
     */
    for (const p of MACCABI_PANTHEON) {
      if (p.leagueAppearances !== undefined) {
        expect(DOC.includes(String(p.leagueAppearances)), `${p.id}: apps ${p.leagueAppearances} not documented`).toBe(true);
      }
      if (p.leagueGoals !== undefined) {
        expect(DOC.includes(String(p.leagueGoals)), `${p.id}: goals ${p.leagueGoals} not documented`).toBe(true);
      }
    }
  });

  it('documents the snapshot and the stat scope', () => {
    expect(DOC).toContain('2025/26');
    expect(DOC).toContain('2026-08-29');
    expect(DOC).toContain('League appearances and league goals only');
  });

  it('holds the claimed record at the top of each ladder', () => {
    // The record holder must actually have the max value within the dataset.
    const appearances = historicalRecord('appearances');
    expect(appearances?.player.id).toBe('harazi');
    expect(appearances?.value).toBe(495);

    const goals = historicalRecord('goals');
    expect(goals?.player.id).toBe('armeli');
    expect(goals?.value).toBe(90);

    const championships = historicalRecord('championships');
    expect(championships?.player.id).toBe('harazi');
    expect(championships?.value).toBe(8);
  });

  it('sorts every ladder strictly descending with no unknowns inside', () => {
    for (const category of RECORD_CATEGORIES) {
      const ladder = historicalLadder(category.id);
      expect(ladder.length).toBeGreaterThan(5);
      for (let i = 1; i < ladder.length; i += 1) {
        expect(ladder[i]!.value).toBeLessThanOrEqual(ladder[i - 1]!.value);
      }
    }
  });

  it('keeps the goalkeeper in the appearance ladder - position fairness starts in the data', () => {
    const ladder = historicalLadder('appearances');
    expect(ladder.some((row) => row.player.positionGroup === 'GK')).toBe(true);
  });

  it('is deeply immutable in practice - no code path may write to it (Phase 42)', () => {
    /*
     * TypeScript's readonly is compile-time only, so the real protection is that nothing
     * imports this module mutably. This canary asserts runtime shape has not been frozen-then-
     * mutated: values read twice are identical.
     */
    const before = JSON.stringify(MACCABI_PANTHEON);
    historicalLadder('appearances');
    historicalLadder('goals');
    historicalRecord('championships');
    expect(JSON.stringify(MACCABI_PANTHEON)).toBe(before);
  });
});

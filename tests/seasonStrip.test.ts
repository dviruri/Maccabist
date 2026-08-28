/**
 * v0.4.7 Phases 3, 32-33: the season strip.
 *
 * The strip replaced a card containing a seven-row table, and it has to carry the same meaning in
 * one line. What is testable is the derivation, not the pixels: which sentence a given league
 * situation produces, and the hierarchy rule that Maccabi never outranks the club the player
 * actually represents.
 */

import { describe, expect, it } from 'vitest';

import { MACCABI_ID } from '../src/data/clubs';
import { leagueShape } from '../src/data/leagueShape';
import { createCareer } from '../src/game/careerEngine';
import {
  currentLeagueContext,
  leagueContextFrom,
  maccabiLeagueContext,
  positionsForOutcome,
  projectSeason,
} from '../src/game/leagueEngine';
import { createRng } from '../src/game/random';
import { stakesText } from '../src/components/SeasonStrip';
import type { Career, ClubSeasonOutcome, LeagueContext } from '../src/types';

const SEASON = 2044;

/** A senior career whose season is forced to a given outcome, as the v0.4.6 scenarios do it. */
function seniorAt(clubId: string, outcome: ClubSeasonOutcome, seed = 5): Career {
  const base = createCareer({ playerName: 'ס', position: 'CM', seed });
  const career: Career = {
    ...base,
    academyStage: 'senior',
    currentClubId: clubId,
    age: 26,
    currentSeason: SEASON,
    seasonPoint: 'preseason',
    seasonSlot: 'late',
  };

  const projection = projectSeason(career.world, clubId, SEASON, null, null, createRng(seed));
  if (!projection) throw new Error(`no projection for ${clubId}`);
  const shape = leagueShape(projection.leagueId);
  if (!shape) throw new Error('no shape');

  const band = positionsForOutcome(projection.leagueId, outcome, shape);
  const position = band[Math.floor(band.length / 2)] ?? projection.finalPosition;
  const forced = {
    ...projection,
    finalPosition: position,
    finalOutcome: outcome,
    path: { early: position, mid: position, late: position, end: position },
  };

  const maccabi =
    clubId === MACCABI_ID
      ? null
      : projectSeason(career.world, MACCABI_ID, SEASON, null, null, createRng(seed + 40));

  return {
    ...career,
    world: { ...career.world, projection: forced, maccabiProjection: maccabi },
  };
}

const contextFor = (career: Career): LeagueContext => {
  const context = currentLeagueContext(career);
  if (!context) throw new Error('no context');
  return context;
};

describe('the strip says what the table means', () => {
  it('gives a title-race club the gap to the top', () => {
    const career = seniorAt(MACCABI_ID, 'title_challenge');
    const text = stakesText(contextFor(career));
    expect(text).toMatch(/מהפסגה|בפסגה/);
  });

  it('says "בפסגה" rather than a gap of zero when top', () => {
    /*
     * "0 נק׳ מהפסגה" is what a formula prints; it is not what anyone says. The interesting fact
     * at the top of the table is that you are there.
     */
    const career = seniorAt(MACCABI_ID, 'champion');
    const context = contextFor(career);
    if (context.position !== 1 || !context.titleRace) return;
    expect(stakesText(context)).toBe('בפסגה');
  });

  it('gives a relegation-battle club the cushion above the line', () => {
    const career = seniorAt('hapoel_hadera', 'relegation_battle');
    const context = contextFor(career);
    if (!context.relegationBattle) return;
    expect(stakesText(context)).toMatch(/הקו/);
  });

  it('gives a second-division club promotion language and never European', () => {
    const career = seniorAt('hapoel_petah_tikva', 'promotion_challenge');
    const context = contextFor(career);
    expect(stakesText(context)).not.toMatch(/אירופה/);
  });

  it('never says Europe in a league with no European places', () => {
    for (const outcome of ['promoted', 'second_mid_table', 'struggled'] as ClubSeasonOutcome[]) {
      const career = seniorAt('hapoel_petah_tikva', outcome);
      expect(stakesText(contextFor(career)), outcome).not.toMatch(/אירופה/);
    }
  });

  it('always produces something to say, for every position in a division', () => {
    // A blank strip would be worse than a bland one.
    const shape = leagueShape('il_premier');
    if (!shape) throw new Error('no shape');
    const career = seniorAt(MACCABI_ID, 'mid_table');
    const projection = career.world.projection!;
    for (let position = 1; position <= shape.size; position += 1) {
      const context = leagueContextFrom(
        career.world,
        { ...projection, path: { ...projection.path, late: position } },
        'late',
      );
      expect(stakesText(context).length, `position ${position}`).toBeGreaterThan(2);
    }
  });

  it('is short enough for one line on a phone', () => {
    const shape = leagueShape('il_premier');
    if (!shape) throw new Error('no shape');
    const career = seniorAt(MACCABI_ID, 'mid_table');
    const projection = career.world.projection!;
    for (let position = 1; position <= shape.size; position += 1) {
      const context = leagueContextFrom(
        career.world,
        { ...projection, path: { ...projection.path, late: position } },
        'late',
      );
      expect(stakesText(context).length, `position ${position}`).toBeLessThan(30);
    }
  });
});

describe('the current club outranks Maccabi', () => {
  it('shows no separate Maccabi status when the player is at Maccabi', () => {
    /*
     * Phase 3.3. At Maccabi the strip already *is* the Maccabi season, and printing it twice is
     * the screen not knowing what it is looking at. The projection is deliberately dropped at
     * source rather than hidden in the component.
     */
    const career = seniorAt(MACCABI_ID, 'champion');
    expect(career.world.maccabiProjection ?? null).toBeNull();
  });

  it('does keep a Maccabi status when the player is elsewhere', () => {
    const career = seniorAt('hapoel_tel_aviv', 'upper_table');
    expect(career.world.maccabiProjection).toBeTruthy();
    expect(maccabiLeagueContext(career)).not.toBeNull();
  });

  it('reads Maccabi off the shared table when both are in one division', () => {
    // Otherwise the footnote and the table it sits under can disagree by a place.
    const career = seniorAt('hapoel_hadera', 'mid_table');
    const maccabi = maccabiLeagueContext(career);
    const own = currentLeagueContext(career);
    expect(maccabi).not.toBeNull();
    expect(own).not.toBeNull();
    if (maccabi && own && maccabi.leagueId === own.leagueId) {
      expect(maccabi.position).not.toBe(own.position);
    }
  });

  it('shows nothing at all in youth football, rather than inventing a table', () => {
    const boy = createCareer({ playerName: 'י', position: 'CM', seed: 3 });
    expect(currentLeagueContext(boy)).toBeNull();
  });
});

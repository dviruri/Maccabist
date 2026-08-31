/**
 * Parent-club crest inheritance (v0.9.1, Phase 4).
 *
 * A Maccabi Haifa youth team must not look like an unrelated club. Branding is inherited;
 * sporting identity is not - the youth side keeps its own league, table and history.
 */

import { describe, expect, it } from 'vitest';

import { CLUBS, MACCABI_ACADEMY_ID, MACCABI_ID, MACCABI_YOUTH_ID, getClub } from '../src/data/clubs';
import { clubVisual, crestOwnerOf, getClubCrest } from '../src/data/clubVisuals';
import { LEAGUE_MEMBERSHIP } from '../src/data/worldClubs';

describe('branding is inherited', () => {
  it('the Maccabi Haifa academy and youth sides wear the senior crest', () => {
    for (const youthId of [MACCABI_ACADEMY_ID, MACCABI_YOUTH_ID]) {
      expect(crestOwnerOf(youthId)).toBe(MACCABI_ID);
      expect(getClubCrest(youthId)).toBe(getClubCrest(MACCABI_ID));
    }
  });

  it('inherits colours and initials too, not just the file', () => {
    const senior = clubVisual(MACCABI_ID);
    const youth = clubVisual(MACCABI_YOUTH_ID);
    expect(youth.primary).toBe(senior.primary);
    expect(youth.secondary).toBe(senior.secondary);
    expect(youth.initials).toBe(senior.initials);
  });

  it('external youth sides with a real senior parent inherit from it', () => {
    for (const [youthId, parentId] of [
      ['youth_hapoel_haifa', 'hapoel_haifa'],
      ['youth_maccabi_netanya', 'maccabi_netanya'],
      ['youth_hapoel_afula', 'hapoel_afula'],
    ] as const) {
      expect(crestOwnerOf(youthId)).toBe(parentId);
      expect(getClubCrest(youthId)).toBe(getClubCrest(parentId));
      expect(clubVisual(youthId).initials).toBe(clubVisual(parentId).initials);
    }
  });

  it('standalone regional academies keep their own identity', () => {
    // No senior parent exists in the world for these, so inheriting would be a lie.
    for (const id of ['youth_krayot', 'youth_tzafon']) {
      expect(crestOwnerOf(id)).toBe(id);
    }
  });

  it('every senior club still owns its own branding', () => {
    for (const id of LEAGUE_MEMBERSHIP.il_premier ?? []) {
      expect(crestOwnerOf(id)).toBe(id);
    }
  });

  it('inheritance is one hop - a parent never itself defers', () => {
    for (const club of Object.values(CLUBS)) {
      const owner = club.crestOwnerId;
      if (!owner) continue;
      expect(CLUBS[owner]?.crestOwnerId, `${club.id} -> ${owner}`).toBeUndefined();
    }
  });
});

describe('sporting identity is NOT inherited', () => {
  it('a youth side keeps its own id, name, league and tier', () => {
    const youth = getClub(MACCABI_YOUTH_ID);
    const senior = getClub(MACCABI_ID);
    expect(youth.id).not.toBe(senior.id);
    expect(youth.name).not.toBe(senior.name);
    expect(youth.league).not.toBe(senior.league);
    expect(youth.tier).toBe('youth');
  });

  it('no youth side is smuggled into a senior league table', () => {
    const members = Object.values(LEAGUE_MEMBERSHIP).flat();
    for (const id of [MACCABI_ACADEMY_ID, MACCABI_YOUTH_ID, 'youth_hapoel_haifa']) {
      expect(members).not.toContain(id);
    }
  });
});

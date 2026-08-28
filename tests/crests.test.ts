/**
 * v0.4.7 Phases 13-20, 38, 47: club crests.
 *
 * No real crest is bundled — CLUB_CRESTS.md records why, and it is a licensing finding rather than
 * a technical one. What these tests protect is the architecture around that decision: every club
 * resolves to a badge, nothing is ever fetched from someone else's server, and if a real asset is
 * added later a wrong path degrades to the generated badge rather than to a broken image.
 */

import { describe, expect, it } from 'vitest';

import { ALL_CLUBS, MACCABI_ID } from '../src/data/clubs';
import { CLUB_VISUALS, clubVisual, getClubCrest, hasRealCrest, initialsFor } from '../src/data/clubVisuals';
import { defaultLeagueFor } from '../src/data/leagues';
import { LEAGUE_SHAPES } from '../src/data/leagueShape';

/** The clubs a career can actually be at, which is what has to have an identity. */
const SENIOR_CLUBS = ALL_CLUBS.filter((c) => c.tier !== 'academy' && c.tier !== 'youth');

describe('every club has a visual identity', () => {
  it('resolves a badge for every modelled club', () => {
    for (const club of ALL_CLUBS) {
      const visual = clubVisual(club.id, club.name);
      expect(visual.primary, club.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.secondary, club.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.initials.length, club.id).toBeGreaterThan(0);
    }
  });

  it('declares colours for every senior club rather than hashing them', () => {
    /*
     * v0.4.7 closed this gap for the thirteen European clubs. Before that a career abroad had a
     * badge whose colour was derived from the club id, which meant nothing.
     */
    const undeclared = SENIOR_CLUBS.filter((c) => CLUB_VISUALS[c.id] === undefined).map((c) => c.id);
    expect(undeclared).toEqual([]);
  });

  it('declares colours for every Israeli league club', () => {
    const israeli = SENIOR_CLUBS.filter((c) => c.country === 'ישראל');
    expect(israeli.length).toBeGreaterThanOrEqual(20);
    for (const club of israeli) {
      expect(CLUB_VISUALS[club.id], club.id).toBeDefined();
    }
  });

  it('covers both Israeli divisions', () => {
    const byLeague = new Map<string, number>();
    for (const club of SENIOR_CLUBS) {
      const league = defaultLeagueFor(club.tier, club.country);
      byLeague.set(league, (byLeague.get(league) ?? 0) + 1);
    }
    expect(byLeague.get('il_premier')).toBeGreaterThanOrEqual(10);
    expect(byLeague.get('il_leumit')).toBeGreaterThanOrEqual(10);
  });
});

describe('the fallback badge never fails', () => {
  it('handles a club id with no record at all', () => {
    const visual = clubVisual('a_club_that_does_not_exist');
    expect(visual.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(visual.initials.length).toBeGreaterThan(0);
  });

  it('handles a filler club, which has a name but no Club record', () => {
    const shape = LEAGUE_SHAPES.il_premier;
    const filler = shape?.others[0];
    expect(filler).toBeDefined();
    const visual = clubVisual(`filler_il_premier_${filler?.name}`, filler?.name);
    expect(visual.initials).not.toBe('?');
  });

  it('is deterministic, so a badge never changes between screens', () => {
    /*
     * The property that matters for a filler club: the table, the transfer offer and the season
     * summary all draw the same id, and a badge that changed colour between them would be worse
     * than no badge.
     */
    const first = clubVisual('filler_x_some_club', 'הפועל עכו');
    for (let i = 0; i < 20; i += 1) {
      expect(clubVisual('filler_x_some_club', 'הפועל עכו')).toEqual(first);
    }
  });

  it('builds Hebrew initials from movement and place', () => {
    // Hebrew club names are "<movement> <place>", and the place identifies the club.
    expect(initialsFor('הפועל עכו')).toContain('ה');
    expect(initialsFor('מכבי יפו')).toContain('מ');
    expect(initialsFor('')).toBe('?');
  });

  it('never returns an empty string for a single-word name', () => {
    expect(initialsFor('פורטו').length).toBeGreaterThan(0);
  });
});

describe('no crest is ever loaded from someone else’s server', () => {
  it('ships no real crest assets at all', () => {
    /*
     * The current state, asserted so it is a deliberate decision rather than a drift. If this
     * fails, someone added an asset - which is fine, and CLUB_CRESTS.md §3 must be updated with
     * its source and licence in the same change.
     */
    const withAssets = Object.keys(CLUB_VISUALS).filter((id) => hasRealCrest(id));
    expect(withAssets).toEqual([]);
  });

  it('never resolves an external URL, even if one is put in the field', () => {
    // getClubCrest fails closed. A hotlink would make the game's appearance depend on someone
    // else's server and licence, so an http(s) value degrades to the generated badge.
    for (const value of [
      'https://upload.wikimedia.org/whatever.svg',
      'http://example.com/crest.png',
      'HTTPS://EXAMPLE.COM/crest.svg',
    ]) {
      const stub = { primary: '#000000', secondary: '#ffffff', initials: 'X', asset: value };
      CLUB_VISUALS.__test_club__ = stub;
      expect(getClubCrest('__test_club__'), value).toBeNull();
    }
    delete CLUB_VISUALS.__test_club__;
  });

  it('resolves a local path through the app base, so it works on GitHub Pages', () => {
    CLUB_VISUALS.__test_club__ = {
      primary: '#000000',
      secondary: '#ffffff',
      initials: 'X',
      asset: 'club-crests/x.svg',
    };
    const resolved = getClubCrest('__test_club__');
    expect(resolved).toContain('club-crests/x.svg');
    expect(resolved).not.toMatch(/^https?:/);
    delete CLUB_VISUALS.__test_club__;
  });

  it('returns null for a club with no asset', () => {
    expect(getClubCrest(MACCABI_ID)).toBeNull();
    expect(hasRealCrest(MACCABI_ID)).toBe(false);
  });
});

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
import { CREST_MANIFEST } from '../src/data/clubCrests.generated';
import { CLUB_VISUALS, clubVisual, getClubCrest, hasRealCrest, initialsFor } from '../src/data/clubVisuals';
import { defaultLeagueFor } from '../src/data/leagues';
import { worldClubById } from '../src/data/worldClubs';

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
     *
     * v0.6.4: colours now come from either place - `CLUB_VISUALS` for the hand-tuned clubs, or
     * the club's own `WorldClub` record, which declares them alongside its membership. What
     * matters is that no senior club falls through to the id hash, so the check is on the
     * resolved visual rather than on which table it came from.
     */
    const undeclared = SENIOR_CLUBS.filter(
      (c) => CLUB_VISUALS[c.id] === undefined && worldClubById(c.id)?.colors === undefined,
    ).map((c) => c.id);
    expect(undeclared).toEqual([]);
  });

  it('declares colours for every Israeli league club', () => {
    const israeli = SENIOR_CLUBS.filter((c) => c.country === 'ישראל');
    expect(israeli.length).toBeGreaterThanOrEqual(20);
    for (const club of israeli) {
      const declared = CLUB_VISUALS[club.id] ?? worldClubById(club.id)?.colors;
      expect(declared, club.id).toBeDefined();
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

  it('handles an id with a name but no record at all', () => {
    /*
     * v0.6.4 removed filler clubs entirely - every division member is a real Club now. The
     * property this was really protecting still matters: an unknown id plus a name must still
     * produce a readable badge, because a very old save can carry one.
     */
    const visual = clubVisual('some_unknown_club', 'הפועל עכו');
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
  it('ships real crest assets only through the provenanced manifest', () => {
    /*
     * v0.4.7 asserted zero real assets, with a comment saying a failure means someone added one
     * and must document it. v0.6.3 did exactly that: assets now exist, ingested by the importer
     * under the PD/CC0-only licence gate and documented in CLUB_ASSETS.md. The deliberate state
     * asserted now is: no HAND-declared asset on any ClubVisual - every real crest arrives via
     * the generated manifest, where its provenance lives. crestPipeline.test.ts validates the
     * manifest itself.
     */
    const handDeclared = Object.entries(CLUB_VISUALS).filter(([, v]) => v.asset !== undefined);
    expect(handDeclared.map(([id]) => id)).toEqual([]);

    // And every asset-bearing club is manifest-backed, not scattered.
    for (const id of Object.keys(CLUB_VISUALS).filter((clubId) => hasRealCrest(clubId))) {
      expect(CREST_MANIFEST[id], `${id} has an asset with no manifest entry`).toBeDefined();
    }
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

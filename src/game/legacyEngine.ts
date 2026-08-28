import type { Career, LegacyStatus, SeasonRecord } from '../types';
import { LEGACY } from './balance';
import { maccabiRelationship } from './maccabiEngine';
import { MACCABI_ID } from '../data/clubs';

/**
 * What a club's supporters think you are (v0.4.5.1).
 *
 * This exists because `icon` was the top rung of the squad-role ladder, which meant it was awarded
 * for being better than your teammates. Measured before the split: **91% of careers reached
 * `icon`**, 55.3% of all senior seasons were played at it, it arrived after 3.8 seasons and 94
 * appearances, and only 12.6% of those "icons" had ever captained the side. "סמל" was the default
 * state of anyone competent.
 *
 * Squad role and legacy are different questions:
 *
 *   SQUAD ROLE   how much you play          squad -> rotation -> starter -> key -> star
 *   LEGACY       what you mean to the club  none -> fan_favourite -> icon -> legend
 *
 * A player can be his club's best footballer in his first season. He cannot be its symbol in his
 * first season, because being a symbol is made of time and of things that happened.
 *
 * So legacy is computed **only from history at the current club** — seasons, appearances,
 * captaincy, trophies — and never from ability. There is deliberately no ability term at all: not
 * a small one, not a weighted one. That is the whole point of the split.
 */

/** Everything the player has actually done at one club. */
export interface ClubTenure {
  clubId: string;
  seasons: number;
  appearances: number;
  captainSeasons: number;
  trophies: number;
}

/**
 * What he has done at a given club.
 *
 * Loan seasons are excluded: a spell somewhere else is not tenure, and a player on loan is not
 * becoming that club's symbol however well he plays.
 */
export function tenureAt(career: Career, clubId: string): ClubTenure {
  const seasons = career.seasonHistory.filter(
    (s: SeasonRecord) => s.clubId === clubId && s.academyStage === 'senior' && !s.onLoan,
  );

  return {
    clubId,
    seasons: seasons.length,
    appearances: seasons.reduce((total, s) => total + s.stats.appearances, 0),
    captainSeasons: seasons.filter((s) => s.captain).length,
    trophies: career.trophies.filter((t) => t.clubId === clubId).length,
  };
}

/**
 * The player's standing with the supporters of the club he is at now.
 *
 * Each rung needs time *and* something to show for it. The achievement clause is deliberately an
 * OR - a one-club servant who never won anything is still an icon, and so is a captain, and so is
 * a player who won things - but the time and appearance floors are ANDs, so none of it can be
 * short-circuited by being good.
 */
export function legacyStatus(career: Career): LegacyStatus {
  if (career.academyStage !== 'senior') return 'none';
  // On loan you are a guest, whatever your record at the parent club.
  if (career.parentClubId !== null) return 'none';

  return legacyFromTenure(tenureAt(career, career.currentClubId), career);
}

export function legacyFromTenure(tenure: ClubTenure, career: Career): LegacyStatus {
  const l = LEGACY;
  const decorated =
    tenure.trophies >= l.iconTrophies || tenure.captainSeasons >= l.iconCaptainSeasons;

  /*
   * At Maccabi the supporters' own memory has a say. It cannot *create* a legacy - the seasons and
   * appearances still have to be there - but a player the stand has taken to reaches the top rung
   * where an equally long-serving stranger would not.
   */
  const adored =
    tenure.clubId === MACCABI_ID &&
    ['son_of_the_club', 'icon', 'beloved'].includes(maccabiRelationship(career));

  if (
    tenure.seasons >= l.legendSeasons &&
    tenure.appearances >= l.legendAppearances &&
    (tenure.trophies >= l.legendTrophies || tenure.captainSeasons >= l.legendCaptainSeasons || adored)
  ) {
    return 'legend';
  }

  if (tenure.seasons >= l.iconSeasons && tenure.appearances >= l.iconAppearances && decorated) {
    return 'icon';
  }

  if (tenure.seasons >= l.favouriteSeasons && tenure.appearances >= l.favouriteAppearances) {
    return 'fan_favourite';
  }

  return 'none';
}

export const LEGACY_LABELS: Record<LegacyStatus, string> = {
  none: '',
  fan_favourite: 'אהוב על הקהל',
  icon: 'סמל המועדון',
  legend: 'אגדת המועדון',
};

export const LEGACY_ICONS: Record<LegacyStatus, string> = {
  none: '',
  fan_favourite: '💚',
  icon: '🛡️',
  legend: '👑',
};

/** Whether there is anything to show. Keeps the UI from rendering an empty badge. */
export function hasLegacy(status: LegacyStatus): boolean {
  return status !== 'none';
}

import type { ClubTier } from '../types';

/**
 * Lightweight league definitions (v0.4).
 *
 * This is deliberately not a database. It is the smallest coherent ecosystem that lets a
 * career ladder mean something: two Israeli divisions so a career can be rebuilt, a handful of
 * realistic European stepping stones, and an elite tier at the top. Adding a country later is
 * a data edit, not an engine change.
 *
 * The dimensions that actually drive gameplay are quality (how hard it is to hold a place),
 * prestige (what playing here does for your name), visibility (whether European scouts see
 * you) and development (how much a season here improves you).
 */

export interface League {
  id: string;
  name: string;
  country: string;
  /** 1 = top division of that country, 2 = second division. */
  tier: number;
  /** Typical squad strength, on the same 0-100 scale as club quality. */
  quality: number;
  /** What playing here does for a reputation. */
  prestige: number;
  /** How likely bigger clubs abroad are to notice you here. */
  visibility: number;
  /** How much a season here develops a young player. */
  development: number;
  /** Where a relegated club from this league lands, if anywhere. */
  relegatesTo?: string;
  /** Where a promoted club from this league lands. */
  promotesTo?: string;
}

export const LEAGUES: readonly League[] = [
  /* ---------------- Israel ---------------- */
  {
    id: 'il_premier',
    name: 'ליגת העל',
    country: 'ישראל',
    tier: 1,
    quality: 62,
    prestige: 40,
    visibility: 34,
    development: 62,
    relegatesTo: 'il_leumit',
  },
  {
    id: 'il_leumit',
    name: 'הליגה הלאומית',
    country: 'ישראל',
    tier: 2,
    /**
     * Was 42, which sat *above* both of its own clubs (40 and 36) - so nobody in the second
     * division was ever a promotion contender and the promotion-race events were unreachable.
     * A division's quality should be the level its clubs play at, not an aspiration.
     */
    quality: 37,
    prestige: 16,
    visibility: 12,
    development: 52,
    promotesTo: 'il_premier',
  },

  /* ---------------- European stepping stones ---------------- */
  {
    id: 'be_pro',
    name: 'ליגת העל הבלגית',
    country: 'בלגיה',
    tier: 1,
    quality: 68,
    prestige: 58,
    visibility: 72,
    development: 74,
  },
  {
    id: 'nl_eredivisie',
    name: 'האירדיוויזי',
    country: 'הולנד',
    tier: 1,
    quality: 70,
    prestige: 62,
    visibility: 76,
    development: 78,
  },
  {
    id: 'at_bundesliga',
    name: 'הבונדסליגה האוסטרית',
    country: 'אוסטריה',
    tier: 1,
    quality: 66,
    prestige: 52,
    visibility: 64,
    development: 70,
  },
  {
    id: 'gr_superleague',
    name: 'הסופר ליג היוונית',
    country: 'יוון',
    tier: 1,
    quality: 66,
    prestige: 50,
    visibility: 56,
    development: 60,
  },
  {
    id: 'cy_first',
    name: 'הליגה הקפריסאית',
    country: 'קפריסין',
    tier: 1,
    quality: 54,
    prestige: 30,
    visibility: 34,
    development: 52,
  },
  {
    id: 'pt_primeira',
    name: 'הליגה הפורטוגלית',
    country: 'פורטוגל',
    tier: 1,
    quality: 76,
    prestige: 72,
    visibility: 82,
    development: 78,
  },

  /* ---------------- The top of the game ---------------- */
  {
    id: 'euro_elite',
    name: 'ליגה אירופית מובילה',
    country: 'אירופה',
    tier: 1,
    quality: 84,
    prestige: 88,
    visibility: 94,
    development: 70,
  },
  {
    id: 'euro_strong',
    name: 'ליגה אירופית חזקה',
    country: 'אירופה',
    tier: 1,
    quality: 77,
    prestige: 76,
    visibility: 84,
    development: 74,
  },

  /* ---------------- Youth ---------------- */
  {
    id: 'il_youth',
    name: 'מחלקות הנוער',
    country: 'ישראל',
    tier: 1,
    quality: 40,
    prestige: 10,
    visibility: 8,
    development: 80,
  },
];

export const LEAGUES_BY_ID: Record<string, League> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l]),
);

export function getLeague(id: string): League {
  const league = LEAGUES_BY_ID[id];
  if (!league) throw new Error(`Unknown league: ${id}`);
  return league;
}

/**
 * Where a club sits by default, before any promotion or relegation.
 *
 * Derived from the club tier and country the club data already carries, so leagues did not
 * require re-describing 24 clubs. Runtime movement lives in the career's world state.
 */
export function defaultLeagueFor(tier: ClubTier, country: string): string {
  switch (tier) {
    case 'academy':
    case 'youth':
      return 'il_youth';
    case 'israeli_top':
    case 'israeli_mid':
      return 'il_premier';
    case 'israeli_low':
      return 'il_leumit';
    case 'euro_top':
      return 'euro_elite';
    case 'euro_mid':
      return 'euro_strong';
    case 'euro_dev':
      return EURO_DEV_LEAGUES[country] ?? 'be_pro';
    default:
      return 'il_premier';
  }
}

/** The stepping-stone leagues, by the country the club data already declares. */
const EURO_DEV_LEAGUES: Record<string, string> = {
  בלגיה: 'be_pro',
  הולנד: 'nl_eredivisie',
  אוסטריה: 'at_bundesliga',
  יוון: 'gr_superleague',
  קפריסין: 'cy_first',
  פורטוגל: 'pt_primeira',
};

/** Leagues ordered by how far up the game they sit - used for "is this a step up?". */
export function leagueLevel(league: League): number {
  return league.quality * 0.6 + league.prestige * 0.4;
}

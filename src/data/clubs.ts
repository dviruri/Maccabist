import type { Club, ClubTier } from '../types';
import { EXTERNAL_YOUTH_CLUBS } from './youthClubs';
import { getLeague } from './leagues';
import { leagueShape } from './leagueShape';
import { WORLD_CLUBS, isInactiveClub, snapshotLeagueOf } from './worldClubs';

/**
 * Compact club dataset for the MVP.
 * Adding clubs is pure data work - no engine change is needed, the transfer engine
 * picks destinations by tier + weighted eligibility.
 */

export const MACCABI_ACADEMY_ID = 'maccabi_academy';
export const MACCABI_YOUTH_ID = 'maccabi_youth';
export const MACCABI_ID = 'maccabi_haifa';

const clubList: Club[] = [
  /* ---------------- Maccabi Haifa pathway ---------------- */
  {
    id: MACCABI_ACADEMY_ID,
    name: 'מכבי חיפה - מחלקת ילדים',
    shortName: 'מכבי חיפה ילדים',
    country: 'ישראל',
    league: 'ליגת הילדים',
    quality: 30,
    prestige: 8,
    development: 78,
    tier: 'academy',
    titleChance: 0.2,
    cupChance: 0.12,
    europeChance: 0,
    isMaccabi: true,
    seasonGames: 24,
  },
  {
    id: MACCABI_YOUTH_ID,
    name: 'מכבי חיפה - נוער',
    shortName: 'מכבי חיפה נוער',
    country: 'ישראל',
    league: 'ליגת העל לנוער',
    quality: 46,
    prestige: 16,
    development: 82,
    tier: 'youth',
    titleChance: 0.24,
    cupChance: 0.16,
    europeChance: 0.05,
    isMaccabi: true,
    seasonGames: 30,
  },
  {
    id: MACCABI_ID,
    name: 'מכבי חיפה',
    shortName: 'מכבי חיפה',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 76,
    prestige: 56,
    development: 66,
    tier: 'israeli_top',
    titleChance: 0.34,
    cupChance: 0.24,
    europeChance: 0.22,
    isMaccabi: true,
    isSenior: true,
    seasonGames: 42,
  },

  /* ---------------- Israeli top flight ---------------- */
  {
    id: 'maccabi_tel_aviv',
    name: 'מכבי תל אביב',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 75,
    prestige: 54,
    development: 64,
    tier: 'israeli_top',
    titleChance: 0.3,
    cupChance: 0.22,
    europeChance: 0.2,
    isSenior: true,
    seasonGames: 42,
  },
  {
    id: 'hapoel_beer_sheva',
    name: 'הפועל באר שבע',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 72,
    prestige: 48,
    development: 62,
    tier: 'israeli_top',
    titleChance: 0.18,
    cupChance: 0.2,
    europeChance: 0.16,
    isSenior: true,
    seasonGames: 42,
  },
  {
    id: 'beitar_jerusalem',
    name: 'בית"ר ירושלים',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 66,
    prestige: 44,
    development: 56,
    tier: 'israeli_top',
    titleChance: 0.07,
    cupChance: 0.16,
    europeChance: 0.07,
    isSenior: true,
    seasonGames: 40,
  },
  {
    id: 'hapoel_tel_aviv',
    name: 'הפועל תל אביב',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 62,
    prestige: 38,
    development: 58,
    tier: 'israeli_top',
    titleChance: 0.04,
    cupChance: 0.13,
    europeChance: 0.05,
    isSenior: true,
    seasonGames: 40,
  },

  /* ---------------- Israeli mid / development ---------------- */
  {
    id: 'maccabi_netanya',
    name: 'מכבי נתניה',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 56,
    prestige: 28,
    development: 62,
    tier: 'israeli_mid',
    titleChance: 0.01,
    cupChance: 0.07,
    europeChance: 0.02,
    isSenior: true,
    seasonGames: 38,
  },
  {
    id: 'bnei_sakhnin',
    name: 'בני סכנין',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 52,
    prestige: 24,
    development: 58,
    tier: 'israeli_mid',
    titleChance: 0.005,
    cupChance: 0.06,
    europeChance: 0.01,
    isSenior: true,
    seasonGames: 38,
  },
  {
    id: 'ironi_kiryat_shmona',
    name: 'עירוני קרית שמונה',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 50,
    prestige: 22,
    development: 60,
    tier: 'israeli_mid',
    titleChance: 0.005,
    cupChance: 0.05,
    europeChance: 0.01,
    isSenior: true,
    seasonGames: 38,
  },
  /*
   * v0.4.6: Maccabi Haifa's actual derby opponent.
   *
   * The derby is the most-used match label in the game and the club it is played against was not
   * in the dataset - so a "derby" event had no opponent to name and no rivalry to check against.
   * Modelled rather than left as a table filler precisely because the rivalry system needs a real
   * club id on the other side of it.
   */
  {
    id: 'hapoel_haifa',
    name: 'הפועל חיפה',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 51,
    prestige: 22,
    development: 57,
    tier: 'israeli_mid',
    titleChance: 0.004,
    cupChance: 0.05,
    europeChance: 0.01,
    isSenior: true,
    seasonGames: 36,
  },
  {
    // v0.6.5: two relegations since this record was tuned; now the strongest club in Alef South.
    id: 'hapoel_hadera',
    name: 'הפועל חדרה',
    country: 'ישראל',
    league: 'ליגת העל',
    quality: 36,
    prestige: 18,
    development: 56,
    tier: 'israeli_alef',
    titleChance: 0.002,
    cupChance: 0.04,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'hapoel_petah_tikva',
    name: 'הפועל פתח תקווה',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 40,
    prestige: 12,
    development: 50,
    tier: 'israeli_low',
    titleChance: 0.08,
    cupChance: 0.02,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'hapoel_afula',
    name: 'הפועל עפולה',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 36,
    prestige: 9,
    development: 46,
    tier: 'israeli_low',
    titleChance: 0.05,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },

  /* ---------------- The second division (v0.4.1) ---------------- */
  {
    id: 'hapoel_ramat_gan',
    name: 'הפועל רמת גן',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 42,
    prestige: 14,
    development: 50,
    tier: 'israeli_low',
    titleChance: 0.09,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    // v0.6.5: relegated from Leumit 2025/26; the benchmark club of Alef North.
    id: 'hapoel_nof_hagalil',
    name: 'הפועל נוף הגליל',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 34,
    prestige: 10,
    development: 47,
    tier: 'israeli_alef',
    titleChance: 0.05,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'maccabi_herzliya',
    name: 'מכבי הרצליה',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 41,
    prestige: 12,
    development: 52,
    tier: 'israeli_low',
    titleChance: 0.08,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'hapoel_kfar_saba',
    name: 'הפועל כפר סבא',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 43,
    prestige: 16,
    development: 49,
    tier: 'israeli_low',
    titleChance: 0.1,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'hapoel_rishon',
    name: 'הפועל ראשון לציון',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 40,
    prestige: 11,
    development: 48,
    tier: 'israeli_low',
    titleChance: 0.05,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'sektzia_nes_tziona',
    name: 'סקציה נס ציונה',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 34,
    prestige: 8,
    development: 44,
    tier: 'israeli_low',
    titleChance: 0.03,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    // v0.6.5: a 2025/26 Alef North member; quality reflects the tier it actually plays in.
    id: 'hapoel_umm_al_fahm',
    name: 'הפועל אום אל פחם',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 28,
    prestige: 7,
    development: 45,
    tier: 'israeli_alef',
    titleChance: 0.03,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },
  {
    id: 'maccabi_kabilio_jaffa',
    name: 'מכבי קביליו יפו',
    country: 'ישראל',
    league: 'ליגה לאומית',
    quality: 32,
    prestige: 7,
    development: 43,
    tier: 'israeli_low',
    titleChance: 0.02,
    cupChance: 0.01,
    europeChance: 0,
    isSenior: true,
    seasonGames: 36,
  },

  /* ---------------- Europe: developmental ---------------- */
  {
    id: 'sturm_graz',
    name: 'שטורם גראץ',
    country: 'אוסטריה',
    league: 'הליגה האוסטרית',
    quality: 66,
    prestige: 52,
    development: 74,
    tier: 'euro_dev',
    titleChance: 0.18,
    cupChance: 0.18,
    europeChance: 0.12,
    isSenior: true,
    seasonGames: 44,
  },
  {
    id: 'union_sg',
    name: 'יוניון סן ז\'ילואז',
    country: 'בלגיה',
    league: 'הליגה הבלגית',
    quality: 68,
    prestige: 54,
    development: 76,
    tier: 'euro_dev',
    titleChance: 0.16,
    cupChance: 0.14,
    europeChance: 0.14,
    isSenior: true,
    seasonGames: 46,
  },
  {
    id: 'az_alkmaar',
    name: 'אלקמאר',
    country: 'הולנד',
    league: 'הארדיוויזי',
    quality: 70,
    prestige: 58,
    development: 80,
    tier: 'euro_dev',
    titleChance: 0.08,
    cupChance: 0.14,
    europeChance: 0.16,
    isSenior: true,
    seasonGames: 46,
  },
  {
    id: 'paok',
    name: 'פאוק סלוניקי',
    country: 'יוון',
    league: 'הליגה היוונית',
    quality: 69,
    prestige: 53,
    development: 66,
    tier: 'euro_dev',
    titleChance: 0.22,
    cupChance: 0.2,
    europeChance: 0.14,
    isSenior: true,
    seasonGames: 46,
  },

  /* ---------------- Europe: mid ---------------- */
  {
    id: 'werder_bremen',
    name: 'ורדר ברמן',
    country: 'גרמניה',
    league: 'בונדסליגה',
    quality: 74,
    prestige: 70,
    development: 70,
    tier: 'euro_mid',
    titleChance: 0.01,
    cupChance: 0.06,
    europeChance: 0.08,
    isSenior: true,
    seasonGames: 40,
  },
  {
    id: 'getafe',
    name: 'חטאפה',
    country: 'ספרד',
    league: 'לה ליגה',
    quality: 73,
    prestige: 71,
    development: 66,
    tier: 'euro_mid',
    titleChance: 0.005,
    cupChance: 0.05,
    europeChance: 0.07,
    isSenior: true,
    seasonGames: 42,
  },
  {
    id: 'bologna',
    name: 'בולוניה',
    country: 'איטליה',
    league: 'סרייה A',
    quality: 76,
    prestige: 74,
    development: 70,
    tier: 'euro_mid',
    titleChance: 0.01,
    cupChance: 0.07,
    europeChance: 0.12,
    isSenior: true,
    seasonGames: 44,
  },
  {
    id: 'brighton',
    name: 'בראיטון',
    country: 'אנגליה',
    league: 'פרמייר ליג',
    quality: 78,
    prestige: 80,
    development: 74,
    tier: 'euro_mid',
    titleChance: 0.005,
    cupChance: 0.05,
    europeChance: 0.12,
    isSenior: true,
    seasonGames: 44,
  },
  {
    id: 'benfica',
    name: 'בנפיקה',
    country: 'פורטוגל',
    league: 'הליגה הפורטוגזית',
    quality: 80,
    prestige: 78,
    development: 72,
    tier: 'euro_mid',
    titleChance: 0.3,
    cupChance: 0.24,
    europeChance: 0.2,
    isSenior: true,
    seasonGames: 48,
  },

  /* ---------------- Europe: top ---------------- */
  {
    id: 'napoli',
    name: 'נאפולי',
    country: 'איטליה',
    league: 'סרייה A',
    quality: 85,
    prestige: 88,
    development: 68,
    tier: 'euro_top',
    titleChance: 0.16,
    cupChance: 0.12,
    europeChance: 0.28,
    isSenior: true,
    seasonGames: 48,
  },
  {
    id: 'dortmund',
    name: 'בורוסיה דורטמונד',
    country: 'גרמניה',
    league: 'בונדסליגה',
    quality: 86,
    prestige: 90,
    development: 76,
    tier: 'euro_top',
    titleChance: 0.14,
    cupChance: 0.18,
    europeChance: 0.34,
    isSenior: true,
    seasonGames: 48,
  },
  {
    id: 'atletico',
    name: 'אתלטיקו מדריד',
    country: 'ספרד',
    league: 'לה ליגה',
    quality: 88,
    prestige: 92,
    development: 66,
    tier: 'euro_top',
    titleChance: 0.14,
    cupChance: 0.12,
    europeChance: 0.35,
    isSenior: true,
    seasonGames: 50,
  },
  {
    id: 'tottenham',
    name: 'טוטנהאם',
    country: 'אנגליה',
    league: 'פרמייר ליג',
    quality: 86,
    prestige: 93,
    development: 70,
    tier: 'euro_top',
    titleChance: 0.05,
    cupChance: 0.12,
    europeChance: 0.3,
    isSenior: true,
    seasonGames: 50,
  },
];

/**
 * Lookup includes the external youth academies (v0.3.1) so a player Maccabi turned down has a
 * resolvable club, but `ALL_CLUBS` deliberately does not - it drives transfer destinations,
 * and nobody signs a professional contract with an under-11 side.
 */
/* ------------------------------------------------------------------ */
/* The rest of the football world (v0.6.4)                             */
/* ------------------------------------------------------------------ */

/**
 * Turns every `WorldClub` into a real `Club`.
 *
 * This is the v0.6.4 unification. Before it, `worldClubs.ts` held ~150 clubs that appeared in
 * league tables but were invisible to the transfer market - so a Serie A table full of Inter,
 * Milan and Juventus offered exactly two possible destinations. Now there is one club identity
 * per club and one pool, and what keeps the elite clubs rare is eligibility rather than a second
 * class of object.
 *
 * The hand-tuned records above are NOT regenerated: their ids are save data and their numbers
 * were balanced across five versions. A world club whose id already exists here is skipped.
 *
 * The derived football fields come from the club's league and its own quality, because those are
 * the two facts the dataset actually carries. Title and cup chances scale with how far above the
 * division the squad sits; European qualification follows the same curve against the league's own
 * `europePlaces`. Nothing here is hand-tuned per club, which is deliberate - 150 hand-tuned
 * numbers would be 150 things to get wrong and no more truthful than one honest formula.
 */
function deriveWorldClubs(existing: readonly Club[]): Club[] {
  const known = new Set(existing.map((club) => club.id));
  const derived: Club[] = [];

  for (const world of WORLD_CLUBS) {
    if (known.has(world.id)) continue;
    const leagueId = snapshotLeagueOf(world.id);
    const league = leagueId ? getLeague(leagueId) : null;

    /*
     * An inactive club still needs a Club record so `getClub` resolves it for an old save's
     * history. It is filed under its country's shape with no competitive chances at all, and
     * `isInactiveClub` keeps it out of every table, market and cup draw regardless.
     */
    const country = league?.country ?? 'ישראל';
    const isIsraeli = country === 'ישראל';
    const strength = world.quality - (league?.quality ?? 60);

    derived.push({
      id: world.id,
      name: world.name,
      country,
      league: league?.name ?? 'ללא ליגה',
      quality: world.quality,
      prestige: world.prestige ?? Math.round((league?.prestige ?? 20) * 0.5 + world.quality * 0.35),
      development: Math.round(clampNumber(52 + strength * 0.7, 45, 82)),
      tier: tierFor(world.quality, isIsraeli, leagueId),
      titleChance: world.inactive ? 0 : chanceCurve(strength, 0.34, 9),
      cupChance: world.inactive ? 0 : chanceCurve(strength, 0.26, 14),
      europeChance:
        world.inactive || !leagueId || (leagueShape(leagueId)?.europePlaces ?? 0) === 0
          ? 0
          : chanceCurve(strength, 0.34, 13),
      isSenior: true,
      seasonGames: seasonGamesFor(world.quality, isIsraeli, leagueId),
    });
  }
  return derived;
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * How likely a competitive outcome is, given how far above its division a squad sits.
 *
 * A logistic-ish curve rather than a threshold: the best club in a league is a strong favourite,
 * a mid-table club has a real if small chance, and a promoted side is not quite zero. `spread`
 * sets how sharply the curve separates them.
 */
function chanceCurve(strength: number, peak: number, spread: number): number {
  return Math.round(peak * (1 / (1 + Math.exp(-strength / spread))) * 1000) / 1000;
}

function tierFor(quality: number, isIsraeli: boolean, leagueId: string | null): ClubTier {
  if (isIsraeli) {
    if (leagueId === 'il_alef_north' || leagueId === 'il_alef_south') return 'israeli_alef';
    if (leagueId === 'il_leumit') return 'israeli_low';
    return quality >= 60 ? 'israeli_top' : 'israeli_mid';
  }
  if (quality >= 82) return 'euro_top';
  if (quality >= 68) return 'euro_mid';
  return 'euro_dev';
}

/**
 * Matches played in a season, all competitions.
 *
 * The same shape the hand-tuned records use: a league fixture count, plus cup football, plus more
 * European nights the stronger the club is. v0.6.1 established that these are all-competition
 * figures, and the historical benchmarks depend on them staying that way.
 */
function seasonGamesFor(quality: number, isIsraeli: boolean, leagueId: string | null): number {
  /*
   * v0.6.5.1: the league portion is DERIVED from the division's real size, not a literal.
   *
   * v0.6.5 hardcoded 31 for Liga Alef from a 16-club assumption. The official snapshot has 18
   * clubs per district - a double round-robin of 34 matches - so a Liga Alef starter was being
   * capped as if three fixtures of his season did not exist, which silently deflated
   * appearances, minutes and every projection built on them.
   *
   * `leagueFixtures` is now the authority: (size - 1) * 2. Ligat Ha'Al is the one league that
   * genuinely plays more than its round-robin, because of the championship/relegation playoff
   * round, and that allowance is stated here rather than buried in a constant.
   */
  const size = leagueId ? (leagueShape(leagueId)?.size ?? 0) : 0;
  const roundRobin = size > 1 ? (size - 1) * 2 : 30;
  const playoff = leagueId === 'il_premier' ? 7 : 0;
  const cup = isIsraeli ? 2 : 3;
  const europe = quality >= 82 ? 12 : quality >= 74 ? 8 : quality >= 66 ? 4 : 0;
  return roundRobin + playoff + cup + europe;
}

const worldDerivedClubs = deriveWorldClubs(clubList);

/** Every club the game knows: hand-tuned, derived from the world dataset, and youth. */
const fullClubList: readonly Club[] = [...clubList, ...worldDerivedClubs];

export const CLUBS: Record<string, Club> = Object.fromEntries(
  [...fullClubList, ...EXTERNAL_YOUTH_CLUBS].map((club) => [club.id, club]),
);

export const ALL_CLUBS: readonly Club[] = fullClubList;

/**
 * The clubs that can actually be played for this snapshot.
 *
 * `ALL_CLUBS` includes inactive identities so an old save's history still resolves. Anything
 * choosing a destination, drawing a table or picking a cup opponent wants this instead.
 */
export const ACTIVE_CLUBS: readonly Club[] = fullClubList.filter(
  (club) => !isInactiveClub(club.id),
);

export function getClub(id: string): Club {
  const club = CLUBS[id];
  if (!club) throw new Error(`Unknown club: ${id}`);
  return club;
}

export function clubsByTier(tier: ClubTier): Club[] {
  return clubList.filter((club) => club.tier === tier);
}

export function isMaccabiClub(id: string): boolean {
  return CLUBS[id]?.isMaccabi === true;
}

export function isMaccabiSenior(id: string): boolean {
  return id === MACCABI_ID;
}

export function isAbroad(id: string): boolean {
  const club = CLUBS[id];
  return !!club && club.country !== 'ישראל';
}

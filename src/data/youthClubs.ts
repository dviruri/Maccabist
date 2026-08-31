import type { Club } from '../types';

/**
 * Youth academies for a player Maccabi turned down at nine.
 *
 * A deliberately small, believable set rather than a database - the full football world is a
 * later phase. These are academy-tier entries used only while the player is a child; once he
 * reaches senior football the ordinary club list in clubs.ts takes over.
 *
 * Quality sits a little below Maccabi's academy, so a good player stands out here - which is
 * exactly what has to happen for Maccabi to come back for him.
 */
export const EXTERNAL_YOUTH_CLUBS: readonly Club[] = [
  {
    id: 'youth_hapoel_haifa',
    crestOwnerId: 'hapoel_haifa',
    name: 'הפועל חיפה',
    country: 'ישראל',
    league: 'מחלקת נוער',
    quality: 30,
    prestige: 12,
    development: 72,
    tier: 'academy',
    titleChance: 0.12,
    cupChance: 0.1,
    europeChance: 0,
    seasonGames: 20,
  },
  {
    id: 'youth_maccabi_netanya',
    crestOwnerId: 'maccabi_netanya',
    name: 'מכבי נתניה',
    country: 'ישראל',
    league: 'מחלקת נוער',
    quality: 28,
    prestige: 11,
    development: 70,
    tier: 'academy',
    titleChance: 0.1,
    cupChance: 0.1,
    europeChance: 0,
    seasonGames: 20,
  },
  {
    // Standalone regional academies: no senior parent in the world, so no inherited branding.
    id: 'youth_krayot',
    name: 'בית״ר קריות',
    country: 'ישראל',
    league: 'מחלקת נוער',
    quality: 22,
    prestige: 7,
    development: 64,
    tier: 'academy',
    titleChance: 0.08,
    cupChance: 0.08,
    europeChance: 0,
    seasonGames: 18,
  },
  {
    id: 'youth_tzafon',
    name: 'עירוני הצפון',
    country: 'ישראל',
    league: 'מחלקת נוער',
    quality: 20,
    prestige: 6,
    development: 62,
    tier: 'academy',
    titleChance: 0.08,
    cupChance: 0.06,
    europeChance: 0,
    seasonGames: 18,
  },
  {
    id: 'youth_hapoel_afula',
    crestOwnerId: 'hapoel_afula',
    name: 'הפועל עפולה',
    country: 'ישראל',
    league: 'מחלקת נוער',
    quality: 24,
    prestige: 8,
    development: 66,
    tier: 'academy',
    titleChance: 0.09,
    cupChance: 0.08,
    europeChance: 0,
    seasonGames: 20,
  },
];

export const EXTERNAL_YOUTH_CLUB_IDS: readonly string[] = EXTERNAL_YOUTH_CLUBS.map((c) => c.id);

export function isExternalYouthClub(clubId: string): boolean {
  return EXTERNAL_YOUTH_CLUB_IDS.includes(clubId);
}

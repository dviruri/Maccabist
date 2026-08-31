/**
 * Club visual identity (v0.4.6).
 *
 * A league table of fourteen text rows is a spreadsheet. A crest beside each one is a football
 * world. But the brief is explicit and so is the law: **no official club crest is reproduced
 * here.** Nothing is downloaded, nothing is embedded, and no external image URL is depended on.
 *
 * What this provides instead is an original geometric badge per club, built from the two things
 * that are facts rather than artwork — the club's colours and its initials. Maccabi Haifa's badge
 * is green because Maccabi Haifa play in green, not because anyone copied anything.
 *
 * The architecture is deliberately one indirection away from real assets: every club resolves to
 * a `ClubVisual`, and a licensed image could later be added as an optional `asset` field on that
 * record without touching a single component.
 */

import { CLUBS } from './clubs';
import { worldClubById } from './worldClubs';
import { importedCrestAsset } from './clubCrests.generated';

export interface ClubVisual {
  /** Primary colour, used for the badge field. */
  primary: string;
  /** Secondary colour, used for the badge's stripe and border. */
  secondary: string;
  /** One or two characters. Hebrew initials read better than a transliteration. */
  initials: string;
  /**
   * A real crest image, if one is ever added (v0.4.7).
   *
   * Still empty for every club, and CLUB_CRESTS.md records why: Israeli club crests are pictorial
   * works hosted on Wikipedia under `Template:Non-free logo` with fair-use rationales that
   * explicitly exclude icon use, they are absent from Commons, and they are trademarks besides.
   * None of that is a licence to bundle them in a game.
   *
   * `getClubCrest` reads this field, so dropping a file in and adding a path here is the whole
   * integration - no component changes.
   */
  asset?: string;
}

/**
 * Colours are the clubs' own and are used as plain facts, the same way their names are. The
 * shapes they are rendered into are this project's.
 */
export const CLUB_VISUALS: Record<string, ClubVisual> = {
  maccabi_haifa: { primary: '#0fa64a', secondary: '#ffffff', initials: 'מ״ח' },
  maccabi_academy: { primary: '#0fa64a', secondary: '#ffffff', initials: 'מ״ח' },
  maccabi_youth: { primary: '#0fa64a', secondary: '#ffffff', initials: 'מ״ח' },
  hapoel_haifa: { primary: '#c8102e', secondary: '#ffffff', initials: 'ה״ח' },
  maccabi_tel_aviv: { primary: '#f4d03f', secondary: '#1b4f9c', initials: 'מת״א' },
  hapoel_tel_aviv: { primary: '#c8102e', secondary: '#ffffff', initials: 'הת״א' },
  hapoel_beer_sheva: { primary: '#c8102e', secondary: '#1b1b1b', initials: 'הב״ש' },
  beitar_jerusalem: { primary: '#f4d03f', secondary: '#1b1b1b', initials: 'בי״ם' },
  maccabi_netanya: { primary: '#f4d03f', secondary: '#1b4f9c', initials: 'מ״נ' },
  bnei_sakhnin: { primary: '#c8102e', secondary: '#ffffff', initials: 'ב״ס' },
  ironi_kiryat_shmona: { primary: '#1b4f9c', secondary: '#ffffff', initials: 'ק״ש' },
  hapoel_hadera: { primary: '#7b2d8e', secondary: '#ffffff', initials: 'ה״ח' },
  hapoel_petah_tikva: { primary: '#1b4f9c', secondary: '#ffffff', initials: 'הפ״ת' },
  hapoel_afula: { primary: '#3aa655', secondary: '#ffffff', initials: 'ה״ע' },
  hapoel_ramat_gan: { primary: '#c8102e', secondary: '#1b1b1b', initials: 'הר״ג' },
  hapoel_nof_hagalil: { primary: '#e07b28', secondary: '#ffffff', initials: 'הנ״ג' },
  maccabi_herzliya: { primary: '#1b4f9c', secondary: '#f4d03f', initials: 'מ״ה' },
  hapoel_kfar_saba: { primary: '#3aa655', secondary: '#ffffff', initials: 'הכ״ס' },
  hapoel_rishon: { primary: '#c8102e', secondary: '#f4d03f', initials: 'ה״ר' },
  sektzia_nes_tziona: { primary: '#1b4f9c', secondary: '#ffffff', initials: 'נ״צ' },
  hapoel_umm_al_fahm: { primary: '#3aa655', secondary: '#1b1b1b', initials: 'או״פ' },
  maccabi_kabilio_jaffa: { primary: '#e07b28', secondary: '#1b1b1b', initials: 'מ״י' },

  /*
   * The European clubs the transfer engine actually sends players to (v0.4.7).
   *
   * These were falling through to the hash palette, so a career abroad had a badge whose colour
   * meant nothing. Club colours are facts about a club, used the same way its name is; the shield
   * they are drawn into is this project's. Latin initials, because that is how these clubs are
   * abbreviated and a Hebrew transliteration of "PAOK" helps nobody.
   */
  sturm_graz: { primary: '#000000', secondary: '#ffffff', initials: 'STU' },
  union_sg: { primary: '#f4d03f', secondary: '#1b4f9c', initials: 'USG' },
  az_alkmaar: { primary: '#c8102e', secondary: '#ffffff', initials: 'AZ' },
  paok: { primary: '#1b1b1b', secondary: '#ffffff', initials: 'PAOK' },
  werder_bremen: { primary: '#1d8f4e', secondary: '#ffffff', initials: 'SVW' },
  dortmund: { primary: '#f4d03f', secondary: '#1b1b1b', initials: 'BVB' },
  getafe: { primary: '#1b4f9c', secondary: '#ffffff', initials: 'GET' },
  atletico: { primary: '#c8102e', secondary: '#ffffff', initials: 'ATM' },
  bologna: { primary: '#8f2a24', secondary: '#1b4f9c', initials: 'BOL' },
  napoli: { primary: '#12a0d7', secondary: '#ffffff', initials: 'NAP' },
  brighton: { primary: '#1b4f9c', secondary: '#ffffff', initials: 'BHA' },
  tottenham: { primary: '#ffffff', secondary: '#1b2c5b', initials: 'TOT' },
  benfica: { primary: '#c8102e', secondary: '#ffffff', initials: 'SLB' },
};

/**
 * A palette for clubs with no declared colours, chosen by name.
 *
 * Deterministic rather than random: the same club always gets the same badge, in the table and in
 * a transfer offer and in the season summary. A filler club whose badge changed between screens
 * would be worse than no badge at all.
 */
const FALLBACK_COLOURS: readonly string[] = [
  '#1b4f9c',
  '#c8102e',
  '#3aa655',
  '#7b2d8e',
  '#e07b28',
  '#0d7f7f',
  '#8c6d1f',
  '#4a5568',
];

function hashOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

/**
 * Initials for a club with no declared ones.
 *
 * Hebrew club names are almost always "<movement> <place>" — הפועל עכו, מכבי יפו — so the useful
 * initials are the first letter of each word, and the place is the part that identifies the club.
 * Latin names fall back to their first two characters.
 */
export function initialsFor(name: string): string {
  const words = name.split(/[\s־-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2);
  const first = words[0]![0] ?? '';
  const last = words[words.length - 1]!.slice(0, 2);
  return `${first}״${last[0] ?? ''}`;
}

/**
 * Whose branding this club wears (v0.9.1).
 *
 * The single rule: a club with a `crestOwnerId` wears that club's crest and colours; every other
 * club wears its own. One hop only - a parent is always a real senior club, so there is no chain
 * to follow and no cycle to guard against.
 *
 * Deliberately branding-only. `LEAGUE_MEMBERSHIP`, tables, age groups and career history all keep
 * reading the club's own id: the youth team remains its own football entity.
 */
export function crestOwnerOf(clubId: string): string {
  // CLUBS already contains the external youth clubs, so one lookup covers every entity.
  return CLUBS[clubId]?.crestOwnerId ?? clubId;
}

/**
 * The visual identity for any club id, including filler clubs that have no Club record.
 *
 * Never returns null and never returns a broken image, because there is no image — a badge is
 * drawn from these values. That is the whole reason the system is built this way.
 */
export function clubVisual(clubId: string, name?: string): ClubVisual {
  /*
   * v0.9.1: branding inheritance. A youth or academy side wearing a parent club's crest must
   * also wear its colours and initials - a Maccabi Haifa youth team with the senior crest but a
   * hash-generated purple badge beside it would be the same inconsistency in a smaller place.
   * Resolved first, so every branch below sees the owner's id.
   */
  const owner = crestOwnerOf(clubId);
  if (owner !== clubId) return clubVisual(owner, name);

  const declared = CLUB_VISUALS[clubId];
  if (declared) return declared;

  /*
   * A world club (v0.6.3, unified in v0.6.4). Colours and initials are declared in worldClubs.ts
   * alongside its membership - one truth per club - and merged with any imported crest asset
   * here, so ClubCrest needs no second lookup.
   */
  const worldClub = worldClubById(clubId);
  if (worldClub) {
    return {
      primary: worldClub.colors?.primary ?? FALLBACK_COLOURS[hashOf(clubId) % FALLBACK_COLOURS.length]!,
      secondary: worldClub.colors?.secondary ?? '#ffffff',
      initials: worldClub.initials ?? initialsFor(worldClub.name),
      asset: importedCrestAsset(clubId) ?? undefined,
    };
  }

  const label = name ?? clubId;
  const hash = hashOf(clubId);
  return {
    primary: FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length] as string,
    secondary: '#ffffff',
    initials: initialsFor(label),
  };
}

/* ------------------------------------------------------------------ */
/* The one place a crest file is named (v0.4.7, Phase 16)              */
/* ------------------------------------------------------------------ */

/**
 * The crest image for a club, or null when there is none.
 *
 * Centralised on purpose. A file path scattered across the table, the transfer card, the match
 * strip and the hub is four places to forget when an asset is added or removed - and removability
 * matters here, because CLUB_CRESTS.md records that the real crests are non-free and trademarked.
 * If an asset ever has to come out, it comes out of one record.
 *
 * Returns a repo-local path only. Nothing here may return an external URL: hotlinking a crest
 * would make the game's appearance depend on someone else's server and licence.
 */
export function getClubCrest(clubId: string): string | null {
  // v0.9.1: a club that wears a parent's branding resolves the parent's crest file.
  const owner = crestOwnerOf(clubId);
  // v0.6.3: a hand-declared asset wins; otherwise the importer's manifest is consulted.
  const asset = CLUB_VISUALS[owner]?.asset ?? importedCrestAsset(owner) ?? undefined;
  if (!asset) return null;
  if (/^https?:/i.test(asset)) {
    /*
     * Fail closed rather than render it. An external URL in this field is a mistake, and falling
     * back to the generated badge is strictly better than shipping a hotlink.
     */
    return null;
  }
  // Vite serves public/ from BASE_URL, which is /Maccabist/ on Pages and / in dev.
  return `${import.meta.env.BASE_URL}${asset.replace(/^\//, '')}`;
}

/** True when a club has a real crest asset. Used by tests and by the coverage report. */
export function hasRealCrest(clubId: string): boolean {
  return getClubCrest(clubId) !== null;
}

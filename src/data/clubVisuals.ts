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

export interface ClubVisual {
  /** Primary colour, used for the badge field. */
  primary: string;
  /** Secondary colour, used for the badge's stripe and border. */
  secondary: string;
  /** One or two characters. Hebrew initials read better than a transliteration. */
  initials: string;
  /**
   * Where a licensed or original crest image would go, if one is ever added. Nothing reads this
   * yet; it exists so that adding artwork later is a data edit rather than a component rewrite.
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
 * The visual identity for any club id, including filler clubs that have no Club record.
 *
 * Never returns null and never returns a broken image, because there is no image — a badge is
 * drawn from these values. That is the whole reason the system is built this way.
 */
export function clubVisual(clubId: string, name?: string): ClubVisual {
  const declared = CLUB_VISUALS[clubId];
  if (declared) return declared;

  const label = name ?? clubId;
  const hash = hashOf(clubId);
  return {
    primary: FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length] as string,
    secondary: '#ffffff',
    initials: initialsFor(label),
  };
}

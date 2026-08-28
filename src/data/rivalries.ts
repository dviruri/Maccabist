/**
 * Who actually hates whom (v0.4.6).
 *
 * "Derby" was being used as a synonym for "important match". `rare_derby_legend` described a
 * derby the whole academy came to watch and carried no club condition at all, so a boy at Hapoel
 * Afula's youth team could receive it; `sen_derby_moment` named a derby with no opponent on the
 * other side of it. Neither is fixable by editing the string — the game had no model of a
 * rivalry, so nothing could be checked.
 *
 * A rivalry is a fact about a *pair* of clubs. It is declared once here and read through
 * `rivalryBetween`, and an event may use the word דרבי only when that lookup returns one.
 *
 * Deliberately short. Only rivalries between clubs the game actually models are listed, because
 * a rivalry with a club that has no id is a rivalry no event can name. A second division with no
 * modelled derbies is the honest state of this dataset, not an omission to paper over.
 */

export type RivalryType =
  /** Same city. The one that earns the word דרבי. */
  | 'localDerby'
  /** Decades of history, different cities. */
  | 'historicRivalry'
  /** Modern, built on titles rather than geography. */
  | 'majorRivalry';

export type RivalryIntensity = 'high' | 'medium';

export interface Rivalry {
  clubs: readonly [string, string];
  type: RivalryType;
  intensity: RivalryIntensity;
  /** What this fixture is called, when it is called anything. */
  name: string;
}

export const RIVALRIES: readonly Rivalry[] = [
  {
    clubs: ['maccabi_haifa', 'hapoel_haifa'],
    type: 'localDerby',
    intensity: 'high',
    name: 'דרבי חיפה',
  },
  {
    clubs: ['maccabi_tel_aviv', 'hapoel_tel_aviv'],
    type: 'localDerby',
    intensity: 'high',
    name: 'דרבי תל אביב',
  },
  {
    clubs: ['maccabi_haifa', 'maccabi_tel_aviv'],
    type: 'majorRivalry',
    intensity: 'high',
    name: 'הקלאסיקו הישראלי',
  },
  {
    clubs: ['maccabi_haifa', 'hapoel_beer_sheva'],
    type: 'majorRivalry',
    intensity: 'medium',
    name: 'מאבק הצמרת',
  },
  {
    clubs: ['beitar_jerusalem', 'hapoel_tel_aviv'],
    type: 'historicRivalry',
    intensity: 'high',
    name: 'יריבות היסטורית',
  },
  {
    clubs: ['beitar_jerusalem', 'maccabi_tel_aviv'],
    type: 'historicRivalry',
    intensity: 'medium',
    name: 'יריבות היסטורית',
  },
];

/** The rivalry between two clubs, or null. Order-independent. */
export function rivalryBetween(a: string, b: string): Rivalry | null {
  return (
    RIVALRIES.find(
      (r) => (r.clubs[0] === a && r.clubs[1] === b) || (r.clubs[0] === b && r.clubs[1] === a),
    ) ?? null
  );
}

/** Everyone this club has a rivalry with. */
export function rivalsOf(clubId: string): Rivalry[] {
  return RIVALRIES.filter((r) => r.clubs[0] === clubId || r.clubs[1] === clubId);
}

/** The other club in a rivalry. */
export function otherClub(rivalry: Rivalry, clubId: string): string {
  return rivalry.clubs[0] === clubId ? rivalry.clubs[1] : rivalry.clubs[0];
}

/**
 * Does this club have a derby at all?
 *
 * The narrow question the word deserves. A club can have a fierce historic rivalry and still have
 * no derby, because a derby is about geography — and most clubs in this world have neither.
 */
export function hasDerby(clubId: string): boolean {
  return rivalsOf(clubId).some((r) => r.type === 'localDerby');
}

/** This club's derby opponent, if it has one. */
export function derbyRival(clubId: string): string | null {
  const derby = rivalsOf(clubId).find((r) => r.type === 'localDerby');
  return derby ? otherClub(derby, clubId) : null;
}

/**
 * Which senior club an academy or youth side belongs to, for rivalry purposes.
 *
 * A Maccabi Haifa youth team plays the Haifa derby. The club id it carries is `maccabi_academy`,
 * which has no rivalries of its own, so without this mapping every academy derby event would be
 * silently ineligible - the opposite failure from the one v0.4.6 is fixing, and just as wrong.
 */
const RIVALRY_PARENT: Record<string, string> = {
  maccabi_academy: 'maccabi_haifa',
  maccabi_youth: 'maccabi_haifa',
};

export function rivalryClubOf(clubId: string): string {
  return RIVALRY_PARENT[clubId] ?? clubId;
}

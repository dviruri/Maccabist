/**
 * The real Maccabi Haifa historical benchmark dataset (v0.6, rebuilt at the correct scope in
 * v0.6.1).
 *
 * ============================ THE SCOPE CORRECTION ============================
 *
 * v0.6 benchmarked against LEAGUE-ONLY historical totals, on the stated belief that the game's
 * `SeasonRecord.stats.appearances` was league-scope. That belief was wrong, and the code says so
 * plainly:
 *
 *   `seasonGames` differs BETWEEN CLUBS IN THE SAME LEAGUE - 42 for Maccabi Tel Aviv and
 *   Maccabi Haifa, 36 for Hapoel Haifa and Hapoel Kfar Saba - and tracks `europeChance`
 *   exactly. League fixtures are identical for every club in a league, so a club-specific,
 *   Europe-correlated number cannot be a league count. AZ Alkmaar settles it: the Eredivisie
 *   plays 34 league matches and the game gives AZ 46.
 *
 * So the game models ALL COMPETITIVE SENIOR MATCHES, and every benchmark here is now an
 * all-competition total. The practical difference is not cosmetic - measured over 4,000
 * simulated careers, 12.2% would have beaten the old league-scope appearance record (495) while
 * 1.1% beat the correct all-competition one (717). An all-time club record should be rare.
 *
 * SOURCE: one table, one declared scope - English Wikipedia's List of Maccabi Haifa F.C.
 * players, whose own note reads "Appearances and goals are for first-team competitive matches
 * only; friendly matches are excluded". Using ONE table for every member is what makes A3's
 * "no mixed scope in one ranking" structural rather than aspirational.
 *
 * CROSS-CHECKED against the club's OFFICIAL record book (mhaifafc.com "המוזיאון הירוק - ספר
 * השיאים"), which publishes per-competition splits: Harazi 494 league + 64 cup + 93 Toto, which
 * with European ties corroborates the 717 all-competition figure. (v0.6's documentation claimed
 * the official site publishes no structured historical statistics. It does; that claim is
 * corrected in MACCABI_LEGACY_DATA.md.)
 *
 * HISTORICAL SNAPSHOT: end of the completed 2025/26 season. Static and immutable - the game
 * never invents fictional historical players to defend records in the 2026-2030 gap (Phase 41).
 *
 * A value the sources do not state reliably is `undefined`, never a guess: championships are
 * recorded only where a player's own honours section states them, which is why most pre-1983
 * figures carry none - the club's first championship was 1983/84.
 *
 * No photographs, no likenesses - names, eras and numbers only.
 */

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';

/**
 * What a number counts (v0.6.1, A3). Declared on the category rather than assumed, so a future
 * league-scope metric cannot silently join an all-competition ranking.
 */
export type MetricScope = 'all_competitive';

export interface MaccabiHistoricalPlayer {
  id: string;
  /** Hebrew display name. */
  name: string;
  positionGroup: PositionGroup;
  /** Years at Maccabi Haifa, for display. Includes every spell. */
  era: string;
  /** ALL-COMPETITION senior appearances for Maccabi Haifa, across every spell. */
  appearances?: number;
  /** ALL-COMPETITION senior goals for Maccabi Haifa, across every spell. */
  goals?: number;
  /** Israeli championships won while at Maccabi Haifa. undefined = not reliably sourced. */
  championships?: number;
  /** Served as club captain, per the sources. */
  captain?: boolean;
  /** One line of who this was, for the record book. */
  note: string;
  /** Source reference ids, resolved in MACCABI_LEGACY_DATA.md. */
  sourceRefs: string[];
}

/**
 * Nineteen figures spanning 1951 to 2016. Broader than v0.6's twelve, because one
 * all-competition table covers the historic era consistently - where the per-player league
 * tables that v0.6 relied on simply do not exist for the 1950s and 60s, which is why those
 * players had to be omitted then.
 */
export const MACCABI_PANTHEON: readonly MaccabiHistoricalPlayer[] = [
  {
    id: 'harazi',
    name: 'אלון חרזי',
    positionGroup: 'DF',
    era: '1991–2009',
    appearances: 717,
    goals: 42,
    championships: 8,
    captain: true,
    note: 'שיא ההופעות של המועדון. שמונה אליפויות - יותר מכל שחקן אחר בירוק.',
    sourceRefs: ['wiki-players', 'official-records', 'wiki-harazi'],
  },
  {
    id: 'katan',
    name: 'יניב קטן',
    positionGroup: 'FW',
    era: '1998–2005, 2006–2014',
    appearances: 557,
    goals: 94,
    championships: 6,
    captain: true,
    note: 'קפטן, בוגר המחלקה, שתי תקופות - וסיפור של מועדון אחד.',
    sourceRefs: ['wiki-players', 'wiki-katan'],
  },
  {
    id: 'benado',
    name: 'אריק בנאדו',
    positionGroup: 'DF',
    era: '1991–1994, 1996–2006, 2010–2011',
    appearances: 522,
    goals: 13,
    championships: 5,
    captain: true,
    note: 'בלם וקפטן, שלוש תקופות במועדון.',
    sourceRefs: ['wiki-players', 'wiki-benado'],
  },
  {
    id: 'aharoni',
    name: 'איתן אהרוני',
    positionGroup: 'DF',
    era: '1979–1994',
    appearances: 478,
    goals: 12,
    championships: 5,
    note: 'המגן של שנות השמונים, מהאליפות הראשונה ועד 1994.',
    sourceRefs: ['wiki-players', 'wiki-aharoni'],
  },
  {
    id: 'davidovich',
    name: 'ניר דוידוביץ׳',
    positionGroup: 'GK',
    era: '1995–2013',
    appearances: 460,
    goals: 0,
    championships: 7,
    note: 'שוער של מועדון אחד. שבע אליפויות בין הקורות.',
    sourceRefs: ['wiki-players', 'wiki-davidovich'],
  },
  {
    id: 'schwager',
    name: 'ישעיהו שוגר',
    positionGroup: 'DF',
    era: '1963–1976',
    appearances: 410,
    goals: 17,
    note: 'בלם של שלושה עשורים מוקדמים, הרבה לפני האליפות הראשונה.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'atar',
    name: 'ראובן עטר',
    positionGroup: 'MF',
    era: '1986–1994, 1996–1997, 2000–2002',
    appearances: 375,
    goals: 102,
    championships: 5,
    note: 'שלוש תקופות, חמש אליפויות, ורגל שמאל שזוכרים.',
    sourceRefs: ['wiki-players', 'wiki-atar'],
  },
  {
    id: 'gershgoren',
    name: 'אהרון גרשגורן',
    positionGroup: 'MF',
    era: '1964–1978',
    appearances: 371,
    goals: 36,
    note: 'ארבע עשרה עונות בקישור, בדור שקדם לתארים.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'kramer',
    name: 'יוסי קרמר',
    positionGroup: 'MF',
    era: '1974–1990',
    appearances: 371,
    goals: 9,
    note: 'שש עשרה עונות בירוק, מהמדבר ועד האליפויות הראשונות.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'boccoli',
    name: 'גוסטבו בוקולי',
    positionGroup: 'MF',
    era: '2004–2015',
    appearances: 364,
    goals: 37,
    championships: 4,
    note: 'אחת עשרה עונות של קשר זר שהפך לבן בית.',
    sourceRefs: ['wiki-players', 'wiki-boccoli'],
  },
  {
    id: 'maman',
    name: 'ברוך ממן',
    positionGroup: 'MF',
    era: '1974–1987',
    appearances: 364,
    goals: 53,
    note: 'קשר שמאלי שליווה את המועדון אל האליפות הראשונה.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'shmulevich_rom',
    name: 'דני שמולביץ־רום',
    positionGroup: 'FW',
    era: '1958–1971',
    appearances: 326,
    goals: 98,
    note: 'שיאן ההבקעות בגביע המדינה - 20 שערים.',
    sourceRefs: ['wiki-players', 'official-records'],
  },
  {
    id: 'almani',
    name: 'אשר אלמני',
    positionGroup: 'MF',
    era: '1952–1968',
    appearances: 307,
    goals: 50,
    note: 'שש עשרה עונות בירוק בשנות החמישים והשישים.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'berkovic',
    name: 'אייל ברקוביץ׳',
    positionGroup: 'MF',
    era: '1990–1996',
    appearances: 276,
    goals: 50,
    championships: 2,
    note: 'קשר יצירתי שהמריא מחיפה לפרמייר ליג.',
    sourceRefs: ['wiki-players', 'wiki-berkovic'],
  },
  {
    id: 'menchel',
    name: 'אברהם מנצ׳ל',
    positionGroup: 'MF',
    era: '1952–1964',
    appearances: 257,
    goals: 83,
    note: 'כנף ימנית מהדור המייסד.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'gershoni',
    name: 'יחזקאל גרשוני',
    positionGroup: 'GK',
    era: '1958–1973',
    appearances: 238,
    goals: 0,
    note: 'חמש עשרה עונות בשער, בדור שלפני התארים.',
    sourceRefs: ['wiki-players'],
  },
  {
    id: 'armeli',
    name: 'זאהי ארמלי',
    positionGroup: 'FW',
    era: '1982–1992',
    appearances: 233,
    goals: 119,
    championships: 3,
    note: 'מלך השערים של המועדון בכל הזמנים.',
    sourceRefs: ['wiki-players', 'official-records', 'wiki-armeli'],
  },
  {
    id: 'benayoun',
    name: 'יוסי בניון',
    positionGroup: 'MF',
    era: '1998–2002, 2014–2016',
    appearances: 210,
    goals: 70,
    championships: 2,
    captain: true,
    note: 'הוביל שתי אליפויות, יצא לכבוש את אירופה, וחזר לסיים עם גביע המדינה.',
    sourceRefs: ['wiki-players', 'wiki-benayoun'],
  },
  {
    id: 'mizrahi',
    name: 'אלון מזרחי',
    positionGroup: 'FW',
    era: '1993–1994, 1994–1999',
    appearances: 129,
    goals: 97,
    championships: 1,
    note: '28 שערי ליגה בעונה אחת - שיא שעדיין עומד.',
    sourceRefs: ['wiki-players', 'official-records', 'wiki-mizrahi'],
  },
];

/* ------------------------------------------------------------------ */
/* Club-level facts                                                    */
/* ------------------------------------------------------------------ */

/**
 * Club honours at the snapshot. 15 championships (1983-84 through 2022-23), 6 State Cups,
 * per the club page on the access date - i.e. through the completed 2025/26 season.
 */
export const MACCABI_CLUB_HONOURS = {
  championships: 15,
  stateCups: 6,
  sourceRefs: ['wiki-club'],
} as const;

/** Single-season league goals record: 28 (Alon Mizrahi 1993-94, Shlomi Arbeitman 2009-10). */
export const SINGLE_SEASON_GOALS_RECORD = {
  value: 28,
  holders: 'אלון מזרחי (1993/94), שלומי ארביטמן (2009/10)',
  sourceRefs: ['wiki-club'],
} as const;

/* ------------------------------------------------------------------ */
/* Record categories                                                   */
/* ------------------------------------------------------------------ */

export type RecordCategoryId = 'appearances' | 'goals' | 'championships';

export interface RecordCategory {
  id: RecordCategoryId;
  label: string;
  /** What the number means, honestly - shown to the player. */
  definition: string;
  /**
   * The scope this metric is measured in (v0.6.1, A3). Every category declares it, and a test
   * asserts the whole ranking shares one - so a league-scope number can never silently join an
   * all-competition ladder.
   */
  scope: MetricScope;
  /** Read the comparable value off a historical player, or null when unknown. */
  read: (p: MaccabiHistoricalPlayer) => number | null;
}

export const RECORD_CATEGORIES: readonly RecordCategory[] = [
  {
    id: 'appearances',
    label: 'הופעות במכבי',
    definition: 'כל המשחקים הרשמיים בקבוצת הבוגרים - ליגה, גביע ואירופה',
    scope: 'all_competitive',
    read: (p) => p.appearances ?? null,
  },
  {
    id: 'goals',
    label: 'שערים במכבי',
    definition: 'כל השערים במשחקים רשמיים במדי מכבי חיפה',
    scope: 'all_competitive',
    read: (p) => p.goals ?? null,
  },
  {
    id: 'championships',
    label: 'אליפויות עם מכבי',
    definition: 'אליפויות שנלקחו בזמן ששיחק במועדון',
    scope: 'all_competitive',
    read: (p) => p.championships ?? null,
  },
];

/** The pantheon sorted for one category, best first, unknowns excluded. */
export function historicalLadder(
  category: RecordCategoryId,
): Array<{ player: MaccabiHistoricalPlayer; value: number }> {
  const cat = RECORD_CATEGORIES.find((c) => c.id === category);
  if (!cat) return [];
  return MACCABI_PANTHEON
    .map((player) => ({ player, value: cat.read(player) }))
    .filter((row): row is { player: MaccabiHistoricalPlayer; value: number } => row.value !== null)
    .sort((a, b) => b.value - a.value);
}

/** The historical record for a category - the top of the ladder. */
export function historicalRecord(
  category: RecordCategoryId,
): { player: MaccabiHistoricalPlayer; value: number } | null {
  return historicalLadder(category)[0] ?? null;
}

/**
 * The real Maccabi Haifa historical benchmark dataset (v0.6).
 *
 * REAL PEOPLE, REAL NUMBERS, ONE SCOPE. Every figure here is a league-scope total taken from the
 * player's own career-statistics table (English Wikipedia, accessed 2026-08-29), because that is
 * the scope the game itself simulates: `SeasonRecord.stats.appearances` is derived from the
 * club's league fixture count. Comparing the player's league appearances against a legend's
 * all-competition total would be the exact lie Phase 5 of the brief forbids.
 *
 * HISTORICAL SNAPSHOT: end of the completed 2025/26 season, as reflected by the sources on the
 * access date. The in-game career begins in 2030/31; this baseline is static and immutable. The
 * game does NOT invent fictional historical players who improve these records later - the
 * comparison is always "the history books as they stood" vs "your career" (Phase 41).
 *
 * A value the sources do not state reliably is `undefined`, never a guess. Full sourcing,
 * definitions and known discrepancies live in MACCABI_LEGACY_DATA.md - notably the club-page
 * "419" vs career-table "495" for Harazi's appearances, resolved in favour of the career-table
 * scope used consistently for every member of this dataset.
 *
 * No photographs, no likenesses - names, eras and numbers only (Phase 70).
 */

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';

export interface MaccabiHistoricalPlayer {
  id: string;
  /** Hebrew display name. */
  name: string;
  positionGroup: PositionGroup;
  /** Years at Maccabi Haifa, for display ("1991–2009"). */
  era: string;
  /** League appearances for Maccabi Haifa. undefined = not reliably sourced. */
  leagueAppearances?: number;
  /** League goals for Maccabi Haifa. undefined = not reliably sourced. */
  leagueGoals?: number;
  /** Israeli championships won while at Maccabi Haifa. undefined = not reliably sourced. */
  championships?: number;
  /** Served as club captain, per the sources. */
  captain?: boolean;
  /** One line of who this was, for the record book. */
  note: string;
  /** Source reference ids, resolved in MACCABI_LEGACY_DATA.md. */
  sourceRefs: string[];
}

export const MACCABI_PANTHEON: readonly MaccabiHistoricalPlayer[] = [
  {
    id: 'harazi',
    name: 'אלון חרזי',
    positionGroup: 'DF',
    era: '1990–2009',
    leagueAppearances: 495,
    leagueGoals: 29,
    championships: 8,
    captain: true,
    note: 'שיא ההופעות בליגה. שמונה אליפויות בירוק - יותר מכל שחקן אחר.',
    sourceRefs: ['wiki-harazi', 'wiki-club'],
  },
  {
    id: 'katan',
    name: 'יניב קטן',
    positionGroup: 'FW',
    era: '1998–2014',
    leagueAppearances: 464,
    leagueGoals: 80,
    championships: 6,
    captain: true,
    note: 'קפטן, בוגר המחלקה, שתי תקופות וסיפור של מועדון אחד.',
    sourceRefs: ['wiki-katan'],
  },
  {
    id: 'boccoli',
    name: 'גוסטבו בוקולי',
    positionGroup: 'MF',
    era: '2004–2015',
    leagueAppearances: 434,
    leagueGoals: 39,
    championships: 4,
    note: 'אחת עשרה עונות של קשר זר שהפך לבן בית.',
    sourceRefs: ['wiki-boccoli'],
  },
  {
    id: 'benado',
    name: 'אריק בנאדו',
    positionGroup: 'DF',
    era: '1991–2011',
    leagueAppearances: 400,
    leagueGoals: 9,
    championships: 5,
    captain: true,
    note: 'בלם וקפטן, שלוש תקופות במועדון.',
    sourceRefs: ['wiki-benado'],
  },
  {
    id: 'davidovich',
    name: 'ניר דוידוביץ׳',
    positionGroup: 'GK',
    era: '1994–2013',
    leagueAppearances: 385,
    leagueGoals: 0,
    championships: 7,
    note: 'שוער של מועדון אחד. שבע אליפויות בין הקורות.',
    sourceRefs: ['wiki-davidovich'],
  },
  {
    id: 'aharoni',
    name: 'איתן אהרוני',
    positionGroup: 'DF',
    era: '1979–1994',
    leagueAppearances: 368,
    leagueGoals: 7,
    championships: 5,
    note: 'המגן של שנות השמונים, מהאליפות הראשונה ועד 1994.',
    sourceRefs: ['wiki-aharoni'],
  },
  {
    id: 'atar',
    name: 'ראובן עטר',
    positionGroup: 'MF',
    era: '1986–2002',
    leagueAppearances: 198,
    leagueGoals: 49,
    championships: 5,
    note: 'שלוש תקופות, חמש אליפויות, רגל שמאל שזוכרים.',
    sourceRefs: ['wiki-atar'],
  },
  {
    id: 'armeli',
    name: 'זאהי ארמלי',
    positionGroup: 'FW',
    era: '1982–1989',
    leagueAppearances: 179,
    leagueGoals: 90,
    championships: 3,
    note: 'מלך השערים של המועדון: 90 שערי ליגה.',
    sourceRefs: ['wiki-armeli', 'wiki-club'],
  },
  {
    id: 'benayoun',
    name: 'יוסי בניון',
    positionGroup: 'MF',
    era: '1998–2002',
    leagueAppearances: 130,
    leagueGoals: 55,
    championships: 2,
    note: 'הוביל שתי אליפויות ויצא לכבוש את אירופה.',
    sourceRefs: ['wiki-benayoun'],
  },
  {
    id: 'berkovic',
    name: 'אייל ברקוביץ׳',
    positionGroup: 'MF',
    era: '1989–1996',
    leagueAppearances: 128,
    leagueGoals: 25,
    championships: 2,
    note: 'קשר יצירתי שהמריא מחיפה לפרמייר ליג.',
    sourceRefs: ['wiki-berkovic'],
  },
  {
    id: 'mizrahi',
    name: 'אלון מזרחי',
    positionGroup: 'FW',
    era: '1993–1999',
    leagueAppearances: 91,
    leagueGoals: 63,
    championships: 1,
    note: '28 שערים בעונה אחת - שיא שעדיין עומד.',
    sourceRefs: ['wiki-mizrahi', 'wiki-club'],
  },
  {
    id: 'revivo',
    name: 'חיים רביבו',
    positionGroup: 'MF',
    era: '1994–1996',
    leagueAppearances: 57,
    leagueGoals: 45,
    championships: 0,
    note: 'שתי עונות, שני תארי מלך שערים, ומשם לספרד.',
    sourceRefs: ['wiki-revivo'],
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
  /** What the number means, honestly. */
  definition: string;
  /** Read the comparable value off a historical player, or null when unknown. */
  read: (p: MaccabiHistoricalPlayer) => number | null;
}

export const RECORD_CATEGORIES: readonly RecordCategory[] = [
  {
    id: 'appearances',
    label: 'הופעות ליגה במכבי',
    definition: 'הופעות ליגה בלבד, בקבוצת הבוגרים של מכבי חיפה',
    read: (p) => p.leagueAppearances ?? null,
  },
  {
    id: 'goals',
    label: 'שערי ליגה במכבי',
    definition: 'שערי ליגה בלבד, במדי מכבי חיפה',
    read: (p) => p.leagueGoals ?? null,
  },
  {
    id: 'championships',
    label: 'אליפויות עם מכבי',
    definition: 'אליפויות שנלקחו בזמן ששיחק במועדון',
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

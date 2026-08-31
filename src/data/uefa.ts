/**
 * The UEFA club competition system, as data (v0.8).
 *
 * Three principles, all structural:
 *
 * 1. **Europe is a connected graph, not three lotteries.** Every qualifying node declares where
 *    a winner goes AND where a loser goes. Losing a Champions League qualifier is not the end
 *    of Europe - it is a route into the Europa League, and losing there routes into the
 *    Conference League. The graph below is the single authority for those transitions; gameplay
 *    code walks it and never hardwires "UCL loss → UEL" anywhere.
 *
 * 2. **Qualification policy is per-association data.** There is no generic rule that makes
 *    every league qualify the same way, and there is deliberately no silent fallback: an
 *    association without an explicit entry in ACCESS_RULES sends nobody to Europe. Israel's
 *    policy is the brief's baseline: champion → Champions League *qualifying*, cup winner →
 *    Europa League route, 2nd and 3rd → Conference route.
 *
 * 3. **Format baseline is the post-2024 UEFA structure** (the "Swiss model", per the official
 *    2024/25 UEFA competition regulations): a 36-club league phase per competition - 8 matches
 *    in the Champions League and Europa League, 6 in the Conference League - with positions
 *    1-8 advancing directly to the Round of 16, 9-24 into a knockout play-off, 25-36
 *    eliminated. Two-legged ties in qualifying and knockouts, single-match final, no away-goals
 *    rule. The game world is set decades ahead, so none of this is tied to a calendar year -
 *    it is the configured format of this world's Europe, adjustable here without touching the
 *    engine.
 *
 * Documented simplifications live where they are made; the honest summary is in V08_REPORT.md.
 */

import type { UefaCompetitionId } from '../types';

/* ------------------------------------------------------------------ */
/* Competitions                                                        */
/* ------------------------------------------------------------------ */

export interface UefaCompetition {
  id: UefaCompetitionId;
  /** Hebrew presentation name. IDs are stable; names are display. */
  name: string;
  shortName: string;
  /** League-phase size and matches per club - the post-2024 format. */
  leaguePhaseSize: 36;
  leaguePhaseMatches: 8 | 6;
  /** Prestige order, 1 highest. Drives trophy weight and UI hierarchy. */
  tier: 1 | 2 | 3;
}

/**
 * "ב" + a competition name, with correct Hebrew: the definite ה assimilates into the
 * preposition (בַּ), so it is "בליגה האירופית" and "בקונפרנס ליג" - never "בהליגה". Found by a
 * v0.9 screenshot; the v0.8 milestone text carried the same slip.
 */
export function inCompetition(name: string): string {
  return name.startsWith('ה') ? `ב${name.slice(1)}` : `ב${name}`;
}

export const UEFA_COMPETITIONS: Record<UefaCompetitionId, UefaCompetition> = {
  uefa_champions_league: {
    id: 'uefa_champions_league',
    name: 'ליגת האלופות',
    shortName: 'ליגת האלופות',
    leaguePhaseSize: 36,
    leaguePhaseMatches: 8,
    tier: 1,
  },
  uefa_europa_league: {
    id: 'uefa_europa_league',
    name: 'הליגה האירופית',
    shortName: 'הליגה האירופית',
    leaguePhaseSize: 36,
    leaguePhaseMatches: 8,
    tier: 2,
  },
  uefa_conference_league: {
    id: 'uefa_conference_league',
    name: 'הקונפרנס ליג',
    shortName: 'קונפרנס ליג',
    leaguePhaseSize: 36,
    leaguePhaseMatches: 6,
    tier: 3,
  },
};

/* ------------------------------------------------------------------ */
/* The qualification graph                                             */
/* ------------------------------------------------------------------ */

/**
 * A node is one qualifying round in one competition on one path. 'league_phase:<id>' and 'out'
 * are the two terminal destinations. The engine walks this table; it contains the entire
 * drop-down system, which makes it auditable in one screen.
 */
export interface QualifyingNode {
  id: string;
  competition: UefaCompetitionId;
  /** Round label for the UI, in Hebrew. */
  label: string;
  /** Where a winner goes: another node id, or 'league_phase'. */
  winTo: string;
  /**
   * Where a LOSER goes: another node id (the drop-down), 'league_phase' of a lower
   * competition (the late-stage parachute), or 'out'. This field IS the connected-Europe
   * design - the round matters, which is why every node declares its own destination.
   */
  loseTo: string;
}

export const LEAGUE_PHASE = 'league_phase';
export const OUT = 'out';

/**
 * Post-2024 routing, champions path and league path.
 *
 * The shape mirrors the official access-list behaviour: early Champions League qualifying
 * losers fall toward the Conference, mid-round losers into Europa qualifying, play-off losers
 * straight into the Europa league phase - and Europa qualifying losers fall into the
 * Conference the same way. Losing late is worth more than losing early, which is exactly the
 * incentive the real system creates.
 */
export const QUALIFYING_GRAPH: Record<string, QualifyingNode> = {
  /* ---- Champions League, champions path ---- */
  ucl_q1: {
    id: 'ucl_q1',
    competition: 'uefa_champions_league',
    label: 'מוקדמות ליגת האלופות — סיבוב ראשון',
    winTo: 'ucl_q2',
    loseTo: 'uecl_q2',
  },
  ucl_q2: {
    id: 'ucl_q2',
    competition: 'uefa_champions_league',
    label: 'מוקדמות ליגת האלופות — סיבוב שני',
    winTo: 'ucl_q3',
    loseTo: 'uel_q3',
  },
  ucl_q3: {
    id: 'ucl_q3',
    competition: 'uefa_champions_league',
    label: 'מוקדמות ליגת האלופות — סיבוב שלישי',
    winTo: 'ucl_po',
    loseTo: 'uel_po',
  },
  ucl_po: {
    id: 'ucl_po',
    competition: 'uefa_champions_league',
    label: 'פלייאוף ליגת האלופות',
    winTo: LEAGUE_PHASE,
    loseTo: 'uel_lp_drop',
  },

  /* ---- Europa League ---- */
  uel_q1: {
    id: 'uel_q1',
    competition: 'uefa_europa_league',
    label: 'מוקדמות הליגה האירופית — סיבוב ראשון',
    winTo: 'uel_q2',
    loseTo: 'uecl_q2',
  },
  uel_q2: {
    id: 'uel_q2',
    competition: 'uefa_europa_league',
    label: 'מוקדמות הליגה האירופית — סיבוב שני',
    winTo: 'uel_q3',
    loseTo: 'uecl_q3',
  },
  uel_q3: {
    id: 'uel_q3',
    competition: 'uefa_europa_league',
    label: 'מוקדמות הליגה האירופית — סיבוב שלישי',
    winTo: 'uel_po',
    loseTo: 'uecl_po',
  },
  uel_po: {
    id: 'uel_po',
    competition: 'uefa_europa_league',
    label: 'פלייאוף הליגה האירופית',
    winTo: LEAGUE_PHASE,
    loseTo: 'uecl_lp_drop',
  },

  /* ---- Conference League ---- */
  uecl_q1: {
    id: 'uecl_q1',
    competition: 'uefa_conference_league',
    label: 'מוקדמות הקונפרנס ליג — סיבוב ראשון',
    winTo: 'uecl_q2',
    loseTo: OUT,
  },
  uecl_q2: {
    id: 'uecl_q2',
    competition: 'uefa_conference_league',
    label: 'מוקדמות הקונפרנס ליג — סיבוב שני',
    winTo: 'uecl_q3',
    loseTo: OUT,
  },
  uecl_q3: {
    id: 'uecl_q3',
    competition: 'uefa_conference_league',
    label: 'מוקדמות הקונפרנס ליג — סיבוב שלישי',
    winTo: 'uecl_po',
    loseTo: OUT,
  },
  uecl_po: {
    id: 'uecl_po',
    competition: 'uefa_conference_league',
    label: 'פלייאוף הקונפרנס ליג',
    winTo: LEAGUE_PHASE,
    loseTo: OUT,
  },
};

/**
 * The two "parachute" pseudo-nodes: a play-off loser does not play another tie, it lands
 * directly in the lower competition's league phase. Kept as node ids so the graph stays a
 * closed system the engine (and the tests) can walk mechanically.
 */
export const LP_DROP_TARGETS: Record<string, UefaCompetitionId> = {
  uel_lp_drop: 'uefa_europa_league',
  uecl_lp_drop: 'uefa_conference_league',
};

/** Round order inside each competition's qualifying, for scheduling the summer. */
export const QUALIFYING_ORDER: readonly string[] = [
  'ucl_q1',
  'uecl_q1',
  'uel_q1',
  'ucl_q2',
  'uel_q2',
  'uecl_q2',
  'ucl_q3',
  'uel_q3',
  'uecl_q3',
  'ucl_po',
  'uel_po',
  'uecl_po',
];

/* ------------------------------------------------------------------ */
/* Association access rules                                            */
/* ------------------------------------------------------------------ */

/** Why a club holds a European slot. Drives redistribution priority and the UI copy. */
export type UefaEntryReason = 'champion' | 'cup_winner' | 'league_position' | 'titleholder';

export interface AccessSlot {
  /** Which domestic result earns the slot. */
  source: 'champion' | 'cup_winner' | { position: number };
  /** Graph node the club enters at, or LEAGUE_PHASE for direct entry. */
  entry: string;
  competition: UefaCompetitionId;
}

export interface AssociationAccess {
  /** The modeled league(s) whose table produces the qualifiers. First entry is the top flight. */
  leagueId: string;
  /** Ordered by slot priority - earlier slots win redistribution conflicts. */
  slots: AccessSlot[];
  /**
   * Where a slot vacated by a duplicate (cup winner already qualified by position) goes: the
   * next league position not already holding a European place. This is the common real-world
   * redistribution and the only one modeled; anything more exotic is out of scope.
   */
  redistribute: 'next_league_position';
}

/**
 * Per-association policy. Every association that can send a club to Europe is listed
 * explicitly - by design there is NO default entry for an unlisted league.
 *
 * The bands reflect access-list reality without cloning every administrative exception:
 * top-coefficient associations enter the league phases directly, mid associations enter late
 * qualifying, developing associations - Israel among them - start at the bottom of the
 * champions path. Israel's block is the brief's required baseline, stated verbatim in data:
 * champion → UCL qualifying, cup winner → UEL qualifying, 2nd and 3rd → UECL qualifying.
 */
export const ACCESS_RULES: Record<string, AssociationAccess> = {
  /* ---- Israel: the required baseline ---- */
  ישראל: {
    leagueId: 'il_premier',
    slots: [
      { source: 'champion', entry: 'ucl_q1', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_q1', competition: 'uefa_europa_league' },
      { source: { position: 2 }, entry: 'uecl_q2', competition: 'uefa_conference_league' },
      { source: { position: 3 }, entry: 'uecl_q1', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },

  /* ---- Elite associations: direct league-phase entries ---- */
  אנגליה: {
    leagueId: 'en_premier',
    slots: [
      { source: 'champion', entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 3 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 4 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 5 }, entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 6 }, entry: 'uecl_po', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  ספרד: {
    leagueId: 'es_laliga',
    slots: [
      { source: 'champion', entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 3 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 4 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 5 }, entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 6 }, entry: 'uecl_po', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  איטליה: {
    leagueId: 'it_seriea',
    slots: [
      { source: 'champion', entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 3 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 4 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 5 }, entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 6 }, entry: 'uecl_po', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  גרמניה: {
    leagueId: 'de_bundesliga',
    slots: [
      { source: 'champion', entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 3 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 4 }, entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 5 }, entry: LEAGUE_PHASE, competition: 'uefa_europa_league' },
      { source: { position: 6 }, entry: 'uecl_po', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },

  /* ---- Strong associations: champion direct, the rest via late qualifying ---- */
  פורטוגל: {
    leagueId: 'pt_primeira',
    slots: [
      { source: 'champion', entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: 'ucl_q3', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_po', competition: 'uefa_europa_league' },
      { source: { position: 3 }, entry: 'uecl_po', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  הולנד: {
    leagueId: 'nl_eredivisie',
    slots: [
      { source: 'champion', entry: LEAGUE_PHASE, competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: 'ucl_q3', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_po', competition: 'uefa_europa_league' },
      { source: { position: 3 }, entry: 'uecl_po', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  בלגיה: {
    leagueId: 'be_pro',
    slots: [
      { source: 'champion', entry: 'ucl_po', competition: 'uefa_champions_league' },
      { source: { position: 2 }, entry: 'ucl_q3', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_po', competition: 'uefa_europa_league' },
      { source: { position: 3 }, entry: 'uecl_q3', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },

  /* ---- Mid associations: qualifying from round two/three ---- */
  אוסטריה: {
    leagueId: 'at_bundesliga',
    slots: [
      { source: 'champion', entry: 'ucl_q2', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_q3', competition: 'uefa_europa_league' },
      { source: { position: 2 }, entry: 'uecl_q3', competition: 'uefa_conference_league' },
      { source: { position: 3 }, entry: 'uecl_q2', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  יוון: {
    leagueId: 'gr_superleague',
    slots: [
      { source: 'champion', entry: 'ucl_q2', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_q3', competition: 'uefa_europa_league' },
      { source: { position: 2 }, entry: 'uecl_q3', competition: 'uefa_conference_league' },
      { source: { position: 3 }, entry: 'uecl_q2', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
  קפריסין: {
    leagueId: 'cy_first',
    slots: [
      { source: 'champion', entry: 'ucl_q1', competition: 'uefa_champions_league' },
      { source: 'cup_winner', entry: 'uel_q1', competition: 'uefa_europa_league' },
      { source: { position: 2 }, entry: 'uecl_q2', competition: 'uefa_conference_league' },
      { source: { position: 3 }, entry: 'uecl_q1', competition: 'uefa_conference_league' },
    ],
    redistribute: 'next_league_position',
  },
};

/* ------------------------------------------------------------------ */
/* Titleholder access                                                  */
/* ------------------------------------------------------------------ */

/**
 * The modern titleholder routes: winning Europe buys next season's entry one tier up (or the
 * same tier, for the Champions League itself). Applied before domestic slots, and subject to
 * the same one-club-one-route rule - a titleholder who also qualified domestically takes the
 * better entry and the domestic slot is redistributed.
 */
export const TITLEHOLDER_ENTRY: Record<UefaCompetitionId, { competition: UefaCompetitionId; entry: string }> = {
  uefa_champions_league: { competition: 'uefa_champions_league', entry: LEAGUE_PHASE },
  uefa_europa_league: { competition: 'uefa_champions_league', entry: LEAGUE_PHASE },
  uefa_conference_league: { competition: 'uefa_europa_league', entry: LEAGUE_PHASE },
};

/* ------------------------------------------------------------------ */
/* The European field                                                  */
/* ------------------------------------------------------------------ */

/**
 * Clubs from associations the game does not model domestically, so that qualifying rounds and
 * league phases hold a believable, coherent field rather than the same eleven leagues meeting
 * themselves. These are competition entities only: not signable, not in CLUBS, no domestic
 * season - they exist so that Ludogorets can knock you out of a qualifier.
 *
 * `entry` is where each enters the summer. Entries are spread across the graph the way the
 * access list spreads real associations: French and other top clubs straight into league
 * phases, mid-Europe into late qualifying, small-association champions into round one.
 * `coefficient` seeds their European reputation; the world's own results move it afterwards.
 */
export interface FieldClub {
  id: string;
  name: string;
  country: string;
  quality: number;
  coefficient: number;
  entry: string;
  competition: UefaCompetitionId;
}

const F = (
  id: string,
  name: string,
  country: string,
  quality: number,
  coefficient: number,
  entry: string,
  competition: UefaCompetitionId,
): FieldClub => ({ id, name, country, quality, coefficient, entry, competition });

export const EUROPEAN_FIELD: readonly FieldClub[] = [
  /* France - unmodeled domestically, but Europe without it would be absurd. */
  F('fld_psg', 'פריז סן־ז׳רמן', 'צרפת', 88, 95, LEAGUE_PHASE, 'uefa_champions_league'),
  F('fld_marseille', 'מארסיי', 'צרפת', 80, 62, LEAGUE_PHASE, 'uefa_champions_league'),
  F('fld_monaco', 'מונאקו', 'צרפת', 79, 58, LEAGUE_PHASE, 'uefa_champions_league'),
  F('fld_lille', 'ליל', 'צרפת', 76, 48, LEAGUE_PHASE, 'uefa_europa_league'),
  F('fld_lyon', 'ליון', 'צרפת', 75, 46, LEAGUE_PHASE, 'uefa_europa_league'),
  F('fld_nice', 'ניס', 'צרפת', 73, 38, 'uecl_po', 'uefa_conference_league'),

  /* Top clubs of strong unmodeled associations - league-phase regulars. */
  F('fld_celtic', 'סלטיק', 'סקוטלנד', 76, 52, LEAGUE_PHASE, 'uefa_champions_league'),
  F('fld_rangers', 'ריינג׳רס', 'סקוטלנד', 73, 46, LEAGUE_PHASE, 'uefa_europa_league'),
  F('fld_galatasaray', 'גלאטסראיי', 'טורקיה', 78, 54, LEAGUE_PHASE, 'uefa_champions_league'),
  F('fld_fenerbahce', 'פנרבחצ׳ה', 'טורקיה', 77, 52, LEAGUE_PHASE, 'uefa_europa_league'),
  F('fld_besiktas', 'בשיקטש', 'טורקיה', 74, 40, 'uecl_po', 'uefa_conference_league'),
  F('fld_shakhtar', 'שחטאר דונייצק', 'אוקראינה', 76, 56, LEAGUE_PHASE, 'uefa_champions_league'),
  F('fld_dynamo_kyiv', 'דינמו קייב', 'אוקראינה', 72, 42, 'uel_po', 'uefa_europa_league'),
  F('fld_copenhagen', 'קופנהגן', 'דנמרק', 73, 44, 'ucl_po', 'uefa_champions_league'),
  F('fld_midtjylland', 'מיטיולן', 'דנמרק', 71, 36, 'uel_q3', 'uefa_europa_league'),
  F('fld_yb', 'יאנג בויז', 'שווייץ', 72, 40, 'ucl_po', 'uefa_champions_league'),
  F('fld_basel', 'באזל', 'שווייץ', 70, 34, 'uecl_q3', 'uefa_conference_league'),
  F('fld_slavia', 'סלביה פראג', 'צ׳כיה', 73, 42, 'ucl_q3', 'uefa_champions_league'),
  F('fld_sparta', 'ספרטה פראג', 'צ׳כיה', 72, 38, 'uel_q3', 'uefa_europa_league'),
  F('fld_rb_salzburg2', 'שטורם וינה', 'אוסטריה', 66, 20, 'uecl_q2', 'uefa_conference_league'),

  /* Champions-path qualifying: smaller-association champions and cup winners. */
  F('fld_zagreb', 'דינמו זאגרב', 'קרואטיה', 72, 44, 'ucl_q2', 'uefa_champions_league'),
  F('fld_hajduk', 'האידוק ספליט', 'קרואטיה', 68, 24, 'uecl_q2', 'uefa_conference_league'),
  F('fld_red_star', 'הכוכב האדום', 'סרביה', 72, 42, 'ucl_q2', 'uefa_champions_league'),
  F('fld_partizan', 'פרטיזן בלגרד', 'סרביה', 68, 26, 'uecl_q2', 'uefa_conference_league'),
  F('fld_legia', 'לגיה ורשה', 'פולין', 70, 32, 'uel_q2', 'uefa_europa_league'),
  F('fld_lech', 'לך פוזנן', 'פולין', 68, 26, 'uecl_q2', 'uefa_conference_league'),
  F('fld_olimpija', 'אולימפיה ליובליאנה', 'סלובניה', 63, 14, 'ucl_q1', 'uefa_champions_league'),
  F('fld_ludogorets', 'לודוגורץ', 'בולגריה', 68, 30, 'ucl_q1', 'uefa_champions_league'),
  F('fld_cska_sofia', 'צסק״א סופיה', 'בולגריה', 63, 14, 'uecl_q1', 'uefa_conference_league'),
  F('fld_ferencvaros', 'פרנצווארוש', 'הונגריה', 69, 32, 'ucl_q1', 'uefa_champions_league'),
  F('fld_cluj', 'קלוז׳', 'רומניה', 66, 22, 'uel_q2', 'uefa_europa_league'),
  F('fld_fcsb', 'סטאווה בוקרשט', 'רומניה', 68, 28, 'ucl_q1', 'uefa_champions_league'),
  F('fld_slovan', 'סלובאן ברטיסלבה', 'סלובקיה', 64, 18, 'ucl_q1', 'uefa_champions_league'),
  F('fld_qarabag', 'קרבאח', 'אזרבייג׳ן', 66, 26, 'ucl_q1', 'uefa_champions_league'),
  F('fld_astana', 'אסטנה', 'קזחסטן', 62, 14, 'ucl_q1', 'uefa_champions_league'),
  F('fld_sheriff', 'שריף טירספול', 'מולדובה', 62, 16, 'ucl_q1', 'uefa_champions_league'),
  F('fld_flora', 'פלורה טאלין', 'אסטוניה', 57, 8, 'ucl_q1', 'uefa_champions_league'),
  F('fld_riga', 'ריגה', 'לטביה', 58, 8, 'uecl_q1', 'uefa_conference_league'),
  F('fld_hjk', 'הלסינקי', 'פינלנד', 61, 12, 'ucl_q1', 'uefa_champions_league'),
  F('fld_bodo', 'בודה/גלימט', 'נורווגיה', 71, 36, 'ucl_q2', 'uefa_champions_league'),
  F('fld_molde', 'מולדה', 'נורווגיה', 67, 24, 'uecl_q3', 'uefa_conference_league'),
  F('fld_malmo', 'מאלמה', 'שוודיה', 68, 28, 'ucl_q2', 'uefa_champions_league'),
  F('fld_hacken', 'הקן', 'שוודיה', 65, 18, 'uel_q2', 'uefa_europa_league'),
  F('fld_apoel2', 'אריס לימסול', 'קפריסין', 63, 14, 'uecl_q1', 'uefa_conference_league'),
  F('fld_shamrock', 'שמרוק רוברס', 'אירלנד', 60, 12, 'ucl_q1', 'uefa_champions_league'),
  F('fld_tns', 'הניו סיינטס', 'ויילס', 55, 6, 'ucl_q1', 'uefa_champions_league'),
  F('fld_lincoln', 'לינקולן רד אימפס', 'גיברלטר', 52, 5, 'ucl_q1', 'uefa_champions_league'),
  F('fld_breidablik', 'בריידבליק', 'איסלנד', 58, 8, 'uecl_q1', 'uefa_conference_league'),
  F('fld_zalgiris', 'ז׳לגיריס וילנה', 'ליטא', 59, 10, 'ucl_q1', 'uefa_champions_league'),
  F('fld_ballkani', 'באלקאני', 'קוסובו', 56, 8, 'uecl_q1', 'uefa_conference_league'),
  F('fld_pyunik', 'פיוניק ירוואן', 'ארמניה', 57, 8, 'ucl_q1', 'uefa_champions_league'),
  F('fld_tirana', 'טיראנה', 'אלבניה', 56, 7, 'uecl_q1', 'uefa_conference_league'),
];

export const FIELD_BY_ID: ReadonlyMap<string, FieldClub> = new Map(
  EUROPEAN_FIELD.map((club) => [club.id, club]),
);

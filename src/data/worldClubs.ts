/**
 * The football world's club membership (v0.6.3).
 *
 * ## Why this file exists
 *
 * Real playtesting in Italy showed a league table whose bottom half read "קבוצה 8", "קבוצה 9",
 * "קבוצה 10". The cause was structural: `LeagueShape.others` listed eight named clubs for a
 * twenty-club division, and `membership()` in leagueEngine padded the difference with generated
 * placeholders at runtime. The data *looked* clean; the table it produced did not.
 *
 * After v0.6.3 the rule is: **every user-visible league carries its complete, named membership,
 * and nothing at runtime may invent a club.** This file is the single source of that membership.
 * `leagueShape.ts` reads it; `leagueEngine.membership()` consumes it and throws rather than pads.
 *
 * ## What a TableClub is - and is not
 *
 * A `TableClub` is a named, identified club that fills the division around the modelled `Club`
 * records: it has an id, a name, a strength, and (where declared) colours. It appears in league
 * tables, as a match opponent, and as a cup finalist.
 *
 * It is deliberately NOT a `Club`. It never signs the player, never makes a transfer offer, and
 * never appears in `ALL_CLUBS` - which is exactly what keeps v0.6.3's promise that adding a
 * hundred named clubs does not move a single transfer probability. The market draws from
 * `ALL_CLUBS`; `ALL_CLUBS` is untouched; therefore the market is untouched, by construction
 * rather than by re-tuning.
 *
 * ## The snapshot
 *
 * Club membership is a fact about a season, so it has to be pinned to one. This dataset is the
 * **2025/26 European season** - the most recent season whose full memberships could be verified
 * end to end - and is versioned below as `2026.1`. The game's fictional 2030s seasons play out
 * against this stylised present; the snapshot is not updated per real-world season and there is
 * no live data dependency. Known deviations from earlier data (Vitesse, Boavista, a duplicate
 * Maccabi Jaffa) are corrected here and documented in WORLD_DATA.md.
 *
 * Club names and colours are used as facts, the same way the modelled clubs' are. No crest,
 * badge or club artwork lives in this file - visual identity resolves through
 * `clubVisuals.ts` -> `ClubCrest`, which draws a generated badge unless a properly-provenanced
 * local asset exists (see scripts/importClubCrests.ts).
 */

export const WORLD_DATA_VERSION = '2026.1';

export interface TableClub {
  /** Stable semantic id. Save-safe: table clubs are derived-only and never persisted. */
  id: string;
  /** Hebrew display name, as it appears in the table. */
  name: string;
  /** Same 0-100 scale as `Club.quality`. */
  quality: number;
  /** Declared club colours, where confidently known. Omitted -> deterministic palette. */
  colors?: { primary: string; secondary: string };
  /** Latin initials where that is how the club is actually abbreviated. */
  initials?: string;
  /**
   * Wikidata QID, for the crest importer (v0.6.3 C4). Importer metadata, never runtime.
   *
   * Deliberately not hand-filled: a wrong QID is precisely the silent-wrong-crest failure C6
   * exists to prevent. The importer resolves and verifies ids itself (label match + instance-of
   * check) and records them in the generated manifest, where their provenance is inspectable.
   */
  wikidata?: string;
}

const c = (primary: string, secondary: string): { primary: string; secondary: string } => ({
  primary,
  secondary,
});

/* ================================================================== */
/* Israel                                                              */
/* ================================================================== */

/**
 * ליגת העל: 10 modelled clubs + these 4 = 14.
 *
 * v0.6.3 correction: the old list said "nine modelled clubs plus five" - but ten Club records
 * map here, so the old membership held 15 names for 14 places and silently dropped the weakest.
 * The completeness invariant is exact equality precisely to make that impossible.
 */
const IL_PREMIER_CLUBS: TableClub[] = [
  { id: 'hapoel_jerusalem_fc', name: 'הפועל ירושלים', quality: 54, colors: c('#c8102e', '#1b1b1b') },
  { id: 'ms_ashdod', name: 'מ.ס אשדוד', quality: 49, colors: c('#f4d03f', '#c8102e') },
  { id: 'maccabi_bnei_raina', name: 'מכבי בני ריינה', quality: 46, colors: c('#1b4f9c', '#ffffff') },
  { id: 'ironi_tiberias', name: 'עירוני טבריה', quality: 45, colors: c('#c8102e', '#1b4f9c') },
];

/**
 * הליגה הלאומית: 10 modelled clubs + these 6 = 16.
 *
 * v0.6.3 correction: this list used to contain "מכבי יפו" - which is the same club as the
 * modelled `maccabi_kabilio_jaffa` ("מכבי קביליו יפו"), so the division could show one real club
 * twice. Replaced with מ.ס כפר קאסם, a real Leumit club not otherwise modelled.
 */
const IL_LEUMIT_CLUBS: TableClub[] = [
  { id: 'hapoel_acre', name: 'הפועל עכו', quality: 38, colors: c('#1b4f9c', '#ffffff') },
  { id: 'hapoel_kfar_shalem', name: 'הפועל כפר שלם', quality: 34, colors: c('#e07b28', '#1b1b1b') },
  { id: 'ms_kafr_qasim', name: 'מ.ס כפר קאסם', quality: 33, colors: c('#3aa655', '#ffffff') },
  { id: 'hapoel_raanana', name: 'הפועל רעננה', quality: 33, colors: c('#1b4f9c', '#f4d03f') },
  { id: 'shimshon_tel_aviv', name: 'שמשון תל אביב', quality: 31, colors: c('#1b1b1b', '#f4d03f') },
  { id: 'hapoel_beit_shean', name: 'הפועל בית שאן', quality: 30, colors: c('#c8102e', '#ffffff') },
];

/* ================================================================== */
/* Belgium - 16                                                        */
/* ================================================================== */

/** union_sg is modelled; these 15 complete the Pro League. */
const BE_PRO_CLUBS: TableClub[] = [
  { id: 'club_brugge', name: 'קלאב ברוז׳', quality: 76, colors: c('#1b4f9c', '#1b1b1b'), initials: 'CLU' },
  { id: 'anderlecht', name: 'אנדרלכט', quality: 73, colors: c('#7b2d8e', '#ffffff'), initials: 'AND' },
  { id: 'genk', name: 'גנק', quality: 71, colors: c('#1b4f9c', '#ffffff'), initials: 'GNK' },
  { id: 'gent', name: 'חנט', quality: 70, colors: c('#1b4f9c', '#ffffff'), initials: 'GNT' },
  { id: 'antwerp', name: 'אנטוורפן', quality: 69, colors: c('#c8102e', '#ffffff'), initials: 'ANT' },
  { id: 'standard_liege', name: 'סטנדרד ליאז׳', quality: 64, colors: c('#c8102e', '#ffffff'), initials: 'STA' },
  { id: 'charleroi', name: 'שארלרואה', quality: 62, colors: c('#1b1b1b', '#ffffff'), initials: 'CHA' },
  { id: 'kv_mechelen', name: 'מכלן', quality: 60, colors: c('#f4d03f', '#c8102e'), initials: 'MEC' },
  { id: 'cercle_brugge', name: 'סרקל ברוז׳', quality: 59, colors: c('#3aa655', '#1b1b1b'), initials: 'CER' },
  { id: 'westerlo', name: 'וסטרלו', quality: 58, colors: c('#f4d03f', '#1b4f9c'), initials: 'WES' },
  { id: 'oh_leuven', name: 'לוון', quality: 57, colors: c('#ffffff', '#1b1b1b'), initials: 'OHL' },
  { id: 'sint_truiden', name: 'סינט טרויידן', quality: 56, colors: c('#f4d03f', '#1b4f9c'), initials: 'STV' },
  { id: 'zulte_waregem', name: 'זולטה וארחם', quality: 53, colors: c('#c8102e', '#3aa655'), initials: 'ZWA' },
  { id: 'dender', name: 'דנדר', quality: 52, colors: c('#1b4f9c', '#ffffff'), initials: 'DEN' },
  { id: 'la_louviere', name: 'לה לוביירה', quality: 51, colors: c('#3aa655', '#ffffff'), initials: 'LLO' },
];

/* ================================================================== */
/* Netherlands - 18                                                    */
/* ================================================================== */

/**
 * az_alkmaar is modelled; these 17 complete the Eredivisie.
 *
 * v0.6.3 correction: the old list contained Vitesse, which is not in the top flight in the
 * 2025/26 snapshot. Replaced by the clubs that actually are.
 */
const NL_EREDIVISIE_CLUBS: TableClub[] = [
  { id: 'ajax', name: 'איאקס', quality: 82, colors: c('#c8102e', '#ffffff'), initials: 'AJA' },
  { id: 'psv', name: 'איינדהובן', quality: 81, colors: c('#c8102e', '#ffffff'), initials: 'PSV' },
  { id: 'feyenoord', name: 'פיינורד', quality: 79, colors: c('#c8102e', '#1b1b1b'), initials: 'FEY' },
  { id: 'twente', name: 'טוונטה', quality: 72, colors: c('#c8102e', '#ffffff'), initials: 'TWE' },
  { id: 'fc_utrecht', name: 'אוטרכט', quality: 69, colors: c('#c8102e', '#ffffff'), initials: 'UTR' },
  { id: 'nec_nijmegen', name: 'ניימיכן', quality: 64, colors: c('#c8102e', '#3aa655'), initials: 'NEC' },
  { id: 'sparta_rotterdam', name: 'ספרטה רוטרדם', quality: 63, colors: c('#c8102e', '#ffffff'), initials: 'SPA' },
  { id: 'fc_groningen', name: 'חרונינגן', quality: 62, colors: c('#3aa655', '#ffffff'), initials: 'GRO' },
  { id: 'heerenveen', name: 'הירנפין', quality: 62, colors: c('#1b4f9c', '#ffffff'), initials: 'HEE' },
  { id: 'go_ahead_eagles', name: 'חו אהד איגלס', quality: 61, colors: c('#c8102e', '#f4d03f'), initials: 'GAE' },
  { id: 'fortuna_sittard', name: 'פורטונה סיטארד', quality: 58, colors: c('#f4d03f', '#3aa655'), initials: 'FOR' },
  { id: 'nac_breda', name: 'ברדה', quality: 58, colors: c('#f4d03f', '#1b1b1b'), initials: 'NAC' },
  { id: 'pec_zwolle', name: 'זבולה', quality: 57, colors: c('#1b4f9c', '#ffffff'), initials: 'PEC' },
  { id: 'heracles', name: 'הרקלס אלמלו', quality: 56, colors: c('#1b1b1b', '#ffffff'), initials: 'HER' },
  { id: 'excelsior', name: 'אקסלסיור', quality: 55, colors: c('#c8102e', '#1b1b1b'), initials: 'EXC' },
  { id: 'volendam', name: 'פולנדם', quality: 53, colors: c('#e07b28', '#1b1b1b'), initials: 'VOL' },
  { id: 'telstar', name: 'טלסטאר', quality: 51, colors: c('#ffffff', '#1b1b1b'), initials: 'TEL' },
];

/* ================================================================== */
/* Austria - 12                                                        */
/* ================================================================== */

/** sturm_graz is modelled; these 11 complete the Austrian Bundesliga. */
const AT_BUNDESLIGA_CLUBS: TableClub[] = [
  { id: 'rb_salzburg', name: 'רד בול זלצבורג', quality: 78, colors: c('#c8102e', '#ffffff'), initials: 'RBS' },
  { id: 'rapid_wien', name: 'ראפיד וינה', quality: 67, colors: c('#3aa655', '#ffffff'), initials: 'RAP' },
  { id: 'lask', name: 'לאסק לינץ', quality: 66, colors: c('#1b1b1b', '#ffffff'), initials: 'LASK' },
  { id: 'austria_wien', name: 'אוסטריה וינה', quality: 64, colors: c('#7b2d8e', '#ffffff'), initials: 'FAK' },
  { id: 'wolfsberger', name: 'וולפסברגר', quality: 62, colors: c('#1b1b1b', '#ffffff'), initials: 'WAC' },
  { id: 'hartberg', name: 'הרטברג', quality: 58, colors: c('#1b4f9c', '#c8102e'), initials: 'HTB' },
  { id: 'wsg_tirol', name: 'טירול', quality: 55, colors: c('#3aa655', '#ffffff'), initials: 'WSG' },
  { id: 'grazer_ak', name: 'גראצר', quality: 55, colors: c('#c8102e', '#ffffff'), initials: 'GAK' },
  { id: 'blau_weiss_linz', name: 'בלאו וייס לינץ', quality: 54, colors: c('#1b4f9c', '#ffffff'), initials: 'BWL' },
  { id: 'altach', name: 'אלטאך', quality: 53, colors: c('#1b1b1b', '#f4d03f'), initials: 'ALT' },
  { id: 'sv_ried', name: 'ריד', quality: 52, colors: c('#3aa655', '#1b1b1b'), initials: 'RIE' },
];

/* ================================================================== */
/* Greece - 14                                                         */
/* ================================================================== */

/** paok is modelled; these 13 complete the Super League. */
const GR_SUPERLEAGUE_CLUBS: TableClub[] = [
  { id: 'olympiacos', name: 'אולימפיאקוס', quality: 78, colors: c('#c8102e', '#ffffff'), initials: 'OLY' },
  { id: 'panathinaikos', name: 'פנאתינייקוס', quality: 74, colors: c('#3aa655', '#ffffff'), initials: 'PAO' },
  { id: 'aek_athens', name: 'AEK אתונה', quality: 72, colors: c('#f4d03f', '#1b1b1b'), initials: 'AEK' },
  { id: 'aris_thessaloniki', name: 'אריס סלוניקי', quality: 65, colors: c('#f4d03f', '#1b1b1b'), initials: 'ARI' },
  { id: 'ofi_crete', name: 'אופי כרתים', quality: 60, colors: c('#1b1b1b', '#ffffff'), initials: 'OFI' },
  { id: 'volos', name: 'וולוס', quality: 57, colors: c('#c8102e', '#ffffff'), initials: 'VOL' },
  { id: 'atromitos', name: 'אטרומיטוס', quality: 56, colors: c('#1b4f9c', '#ffffff'), initials: 'ATR' },
  { id: 'asteras_tripolis', name: 'אסטרס טריפוליס', quality: 55, colors: c('#f4d03f', '#1b4f9c'), initials: 'AST' },
  { id: 'panetolikos', name: 'פאנטוליקוס', quality: 54, colors: c('#f4d03f', '#1b4f9c'), initials: 'PAN' },
  { id: 'panserraikos', name: 'פנסראיקוס', quality: 53, colors: c('#c8102e', '#ffffff'), initials: 'PSE' },
  { id: 'levadiakos', name: 'לבאדיאקוס', quality: 53, colors: c('#3aa655', '#ffffff'), initials: 'LEV' },
  { id: 'kifisia', name: 'קיפיסיה', quality: 52, colors: c('#c8102e', '#1b4f9c'), initials: 'KIF' },
  { id: 'larissa', name: 'לאריסה', quality: 51, colors: c('#8f2a24', '#ffffff'), initials: 'AEL' },
];

/* ================================================================== */
/* Cyprus - 12                                                         */
/* ================================================================== */

/** No modelled club; these 12 are the whole division. */
const CY_FIRST_CLUBS: TableClub[] = [
  { id: 'pafos_fc', name: 'פאפוס', quality: 61, colors: c('#1b4f9c', '#f4d03f'), initials: 'PAF' },
  { id: 'apoel', name: 'אפואל ניקוסיה', quality: 60, colors: c('#f4d03f', '#1b4f9c'), initials: 'APO' },
  { id: 'aek_larnaca', name: 'AEK לרנקה', quality: 59, colors: c('#f4d03f', '#3aa655'), initials: 'AEK' },
  { id: 'omonia_nicosia', name: 'אומוניה ניקוסיה', quality: 58, colors: c('#3aa655', '#ffffff'), initials: 'OMO' },
  { id: 'apollon_limassol', name: 'אפולון לימסול', quality: 57, colors: c('#1b4f9c', '#ffffff'), initials: 'APL' },
  { id: 'aris_limassol', name: 'אריס לימסול', quality: 55, colors: c('#3aa655', '#1b1b1b'), initials: 'ARL' },
  { id: 'ael_limassol', name: 'AEL לימסול', quality: 54, colors: c('#f4d03f', '#1b4f9c'), initials: 'AEL' },
  { id: 'anorthosis', name: 'אנורתוזיס', quality: 51, colors: c('#1b4f9c', '#ffffff'), initials: 'ANO' },
  { id: 'nea_salamina', name: 'נאה סלמינה', quality: 48, colors: c('#c8102e', '#ffffff'), initials: 'NSA' },
  { id: 'ethnikos_achna', name: 'אתניקוס אחנה', quality: 47, colors: c('#f4d03f', '#3aa655'), initials: 'ETH' },
  { id: 'doxa_katokopias', name: 'דוקסה', quality: 46, colors: c('#3aa655', '#ffffff'), initials: 'DOX' },
  { id: 'omonia_aradippou', name: 'אומוניה ארדיפו', quality: 45, colors: c('#c8102e', '#3aa655'), initials: 'OAR' },
];

/* ================================================================== */
/* Portugal - 18                                                       */
/* ================================================================== */

/**
 * benfica is modelled; these 17 complete the Primeira Liga.
 *
 * v0.6.3 correction: the old list contained Boavista, which is not in the top flight in the
 * 2025/26 snapshot.
 */
const PT_PRIMEIRA_CLUBS: TableClub[] = [
  { id: 'porto', name: 'פורטו', quality: 84, colors: c('#1b4f9c', '#ffffff'), initials: 'POR' },
  { id: 'sporting_cp', name: 'ספורטינג ליסבון', quality: 83, colors: c('#3aa655', '#ffffff'), initials: 'SCP' },
  { id: 'braga', name: 'בראגה', quality: 76, colors: c('#c8102e', '#ffffff'), initials: 'BRA' },
  { id: 'vitoria_guimaraes', name: 'ויטוריה גימאראש', quality: 70, colors: c('#ffffff', '#1b1b1b'), initials: 'VIT' },
  { id: 'famalicao', name: 'פמליקאו', quality: 66, colors: c('#1b4f9c', '#ffffff'), initials: 'FAM' },
  { id: 'gil_vicente', name: 'ז׳יל ויסנטה', quality: 63, colors: c('#c8102e', '#1b4f9c'), initials: 'GIL' },
  { id: 'estoril', name: 'אשטוריל', quality: 63, colors: c('#f4d03f', '#1b4f9c'), initials: 'EST' },
  { id: 'santa_clara', name: 'סנטה קלרה', quality: 63, colors: c('#c8102e', '#ffffff'), initials: 'SCL' },
  { id: 'arouca', name: 'ארוקה', quality: 62, colors: c('#f4d03f', '#1b4f9c'), initials: 'ARO' },
  { id: 'moreirense', name: 'מוריירנסה', quality: 62, colors: c('#3aa655', '#ffffff'), initials: 'MOR' },
  { id: 'casa_pia', name: 'קאזה פיה', quality: 61, colors: c('#1b1b1b', '#ffffff'), initials: 'CPI' },
  { id: 'rio_ave', name: 'ריו אבה', quality: 61, colors: c('#3aa655', '#ffffff'), initials: 'RAV' },
  { id: 'nacional', name: 'נסיונל מדיירה', quality: 58, colors: c('#1b1b1b', '#ffffff'), initials: 'NAC' },
  { id: 'estrela_amadora', name: 'אשטרלה אמדורה', quality: 57, colors: c('#c8102e', '#3aa655'), initials: 'EAM' },
  { id: 'avs', name: 'אבש', quality: 56, colors: c('#c8102e', '#ffffff'), initials: 'AVS' },
  { id: 'tondela', name: 'טונדלה', quality: 55, colors: c('#f4d03f', '#3aa655'), initials: 'TON' },
  { id: 'alverca', name: 'אלברקה', quality: 54, colors: c('#c8102e', '#ffffff'), initials: 'ALV' },
];

/* ================================================================== */
/* Germany - 18                                                        */
/* ================================================================== */

/** dortmund and werder_bremen are modelled; these 16 complete the Bundesliga. */
const DE_BUNDESLIGA_CLUBS: TableClub[] = [
  { id: 'bayern_munich', name: 'באיירן מינכן', quality: 92, colors: c('#c8102e', '#ffffff'), initials: 'FCB' },
  { id: 'leverkusen', name: 'לברקוזן', quality: 85, colors: c('#c8102e', '#1b1b1b'), initials: 'B04' },
  { id: 'rb_leipzig', name: 'לייפציג', quality: 84, colors: c('#c8102e', '#ffffff'), initials: 'RBL' },
  { id: 'stuttgart', name: 'שטוטגרט', quality: 78, colors: c('#ffffff', '#c8102e'), initials: 'VFB' },
  { id: 'eintracht_frankfurt', name: 'פרנקפורט', quality: 77, colors: c('#c8102e', '#1b1b1b'), initials: 'SGE' },
  { id: 'freiburg', name: 'פרייבורג', quality: 73, colors: c('#c8102e', '#ffffff'), initials: 'SCF' },
  { id: 'mainz', name: 'מיינץ', quality: 73, colors: c('#c8102e', '#ffffff'), initials: 'M05' },
  { id: 'gladbach', name: 'מנשנגלדבאך', quality: 72, colors: c('#ffffff', '#3aa655'), initials: 'BMG' },
  { id: 'union_berlin', name: 'אוניון ברלין', quality: 71, colors: c('#c8102e', '#f4d03f'), initials: 'FCU' },
  { id: 'wolfsburg', name: 'וולפסבורג', quality: 71, colors: c('#3aa655', '#ffffff'), initials: 'WOB' },
  { id: 'hoffenheim', name: 'הופנהיים', quality: 70, colors: c('#1b4f9c', '#ffffff'), initials: 'TSG' },
  { id: 'hamburg', name: 'המבורג', quality: 69, colors: c('#1b4f9c', '#ffffff'), initials: 'HSV' },
  { id: 'augsburg', name: 'אאוגסבורג', quality: 68, colors: c('#c8102e', '#3aa655'), initials: 'FCA' },
  { id: 'koln', name: 'קלן', quality: 67, colors: c('#c8102e', '#ffffff'), initials: 'KOE' },
  { id: 'st_pauli', name: 'סנט פאולי', quality: 65, colors: c('#8c6d1f', '#c8102e'), initials: 'STP' },
  { id: 'heidenheim', name: 'היידנהיים', quality: 63, colors: c('#c8102e', '#1b4f9c'), initials: 'HDH' },
];

/* ================================================================== */
/* Spain - 20                                                          */
/* ================================================================== */

/** atletico and getafe are modelled; these 18 complete La Liga. */
const ES_LALIGA_CLUBS: TableClub[] = [
  { id: 'real_madrid', name: 'ריאל מדריד', quality: 94, colors: c('#ffffff', '#f4d03f'), initials: 'RMA' },
  { id: 'barcelona', name: 'ברצלונה', quality: 92, colors: c('#1b4f9c', '#8f2a24'), initials: 'BAR' },
  { id: 'sevilla', name: 'סביליה', quality: 80, colors: c('#ffffff', '#c8102e'), initials: 'SEV' },
  { id: 'real_sociedad', name: 'ריאל סוסיאדד', quality: 79, colors: c('#1b4f9c', '#ffffff'), initials: 'RSO' },
  { id: 'athletic_bilbao', name: 'אתלטיק בילבאו', quality: 79, colors: c('#c8102e', '#ffffff'), initials: 'ATH' },
  { id: 'villarreal', name: 'ויאריאל', quality: 78, colors: c('#f4d03f', '#1b4f9c'), initials: 'VIL' },
  { id: 'real_betis', name: 'ריאל בטיס', quality: 76, colors: c('#3aa655', '#ffffff'), initials: 'BET' },
  { id: 'valencia', name: 'ולנסיה', quality: 74, colors: c('#ffffff', '#e07b28'), initials: 'VAL' },
  { id: 'celta_vigo', name: 'סלטה ויגו', quality: 72, colors: c('#12a0d7', '#ffffff'), initials: 'CEL' },
  { id: 'girona', name: 'ג׳ירונה', quality: 72, colors: c('#c8102e', '#ffffff'), initials: 'GIR' },
  { id: 'rayo_vallecano', name: 'ראיו וייקאנו', quality: 71, colors: c('#ffffff', '#c8102e'), initials: 'RAY' },
  { id: 'osasuna', name: 'אוסאסונה', quality: 70, colors: c('#c8102e', '#1b4f9c'), initials: 'OSA' },
  { id: 'mallorca', name: 'מיורקה', quality: 69, colors: c('#c8102e', '#1b1b1b'), initials: 'MLL' },
  { id: 'espanyol', name: 'אספניול', quality: 67, colors: c('#1b4f9c', '#ffffff'), initials: 'ESP' },
  { id: 'alaves', name: 'אלאבס', quality: 66, colors: c('#1b4f9c', '#ffffff'), initials: 'ALA' },
  { id: 'elche', name: 'אלצ׳ה', quality: 63, colors: c('#3aa655', '#ffffff'), initials: 'ELC' },
  { id: 'levante', name: 'לבאנטה', quality: 62, colors: c('#1b4f9c', '#8f2a24'), initials: 'LEV' },
  { id: 'real_oviedo', name: 'ריאל אוביידו', quality: 61, colors: c('#1b4f9c', '#ffffff'), initials: 'OVI' },
];

/* ================================================================== */
/* Italy - 20                                                          */
/* ================================================================== */

/** napoli and bologna are modelled; these 18 complete Serie A. */
const IT_SERIEA_CLUBS: TableClub[] = [
  { id: 'inter_milan', name: 'אינטר', quality: 90, colors: c('#1b4f9c', '#1b1b1b'), initials: 'INT' },
  { id: 'ac_milan', name: 'מילאן', quality: 87, colors: c('#c8102e', '#1b1b1b'), initials: 'MIL' },
  { id: 'juventus', name: 'יובנטוס', quality: 87, colors: c('#1b1b1b', '#ffffff'), initials: 'JUV' },
  { id: 'atalanta', name: 'אטלנטה', quality: 83, colors: c('#1b4f9c', '#1b1b1b'), initials: 'ATA' },
  { id: 'as_roma', name: 'רומא', quality: 82, colors: c('#8f2a24', '#f4d03f'), initials: 'ROM' },
  { id: 'lazio', name: 'לאציו', quality: 80, colors: c('#12a0d7', '#ffffff'), initials: 'LAZ' },
  { id: 'fiorentina', name: 'פיורנטינה', quality: 77, colors: c('#7b2d8e', '#ffffff'), initials: 'FIO' },
  { id: 'torino', name: 'טורינו', quality: 72, colors: c('#8f2a24', '#ffffff'), initials: 'TOR' },
  { id: 'como', name: 'קומו', quality: 70, colors: c('#1b4f9c', '#ffffff'), initials: 'COM' },
  { id: 'udinese', name: 'אודינזה', quality: 68, colors: c('#1b1b1b', '#ffffff'), initials: 'UDI' },
  { id: 'genoa', name: 'ג׳נואה', quality: 67, colors: c('#c8102e', '#1b4f9c'), initials: 'GEN' },
  { id: 'sassuolo', name: 'סאסואולו', quality: 65, colors: c('#3aa655', '#1b1b1b'), initials: 'SAS' },
  { id: 'parma', name: 'פארמה', quality: 64, colors: c('#f4d03f', '#1b4f9c'), initials: 'PAR' },
  { id: 'cagliari', name: 'קליארי', quality: 63, colors: c('#c8102e', '#1b4f9c'), initials: 'CAG' },
  { id: 'lecce', name: 'לצ׳ה', quality: 62, colors: c('#f4d03f', '#c8102e'), initials: 'LEC' },
  { id: 'hellas_verona', name: 'ורונה', quality: 61, colors: c('#f4d03f', '#1b4f9c'), initials: 'VER' },
  { id: 'cremonese', name: 'קרמונזה', quality: 58, colors: c('#c8102e', '#8c6d1f'), initials: 'CRE' },
  { id: 'pisa', name: 'פיזה', quality: 57, colors: c('#1b4f9c', '#1b1b1b'), initials: 'PIS' },
];

/* ================================================================== */
/* England - 20                                                        */
/* ================================================================== */

/** tottenham and brighton are modelled; these 18 complete the Premier League. */
const EN_PREMIER_CLUBS: TableClub[] = [
  { id: 'man_city', name: 'מנצ׳סטר סיטי', quality: 95, colors: c('#12a0d7', '#ffffff'), initials: 'MCI' },
  { id: 'liverpool', name: 'ליברפול', quality: 92, colors: c('#c8102e', '#ffffff'), initials: 'LIV' },
  { id: 'arsenal', name: 'ארסנל', quality: 91, colors: c('#c8102e', '#ffffff'), initials: 'ARS' },
  { id: 'chelsea', name: 'צ׳לסי', quality: 86, colors: c('#1b4f9c', '#ffffff'), initials: 'CHE' },
  { id: 'man_united', name: 'מנצ׳סטר יונייטד', quality: 84, colors: c('#c8102e', '#1b1b1b'), initials: 'MUN' },
  { id: 'aston_villa', name: 'אסטון וילה', quality: 82, colors: c('#8f2a24', '#12a0d7'), initials: 'AVL' },
  { id: 'newcastle', name: 'ניוקאסל', quality: 81, colors: c('#1b1b1b', '#ffffff'), initials: 'NEW' },
  { id: 'crystal_palace', name: 'קריסטל פאלאס', quality: 78, colors: c('#1b4f9c', '#c8102e'), initials: 'CRY' },
  { id: 'west_ham', name: 'ווסטהאם', quality: 77, colors: c('#8f2a24', '#12a0d7'), initials: 'WHU' },
  { id: 'nottingham_forest', name: 'נוטינגהאם פורסט', quality: 77, colors: c('#c8102e', '#ffffff'), initials: 'NFO' },
  { id: 'bournemouth', name: 'בורנמות׳', quality: 76, colors: c('#c8102e', '#1b1b1b'), initials: 'BOU' },
  { id: 'fulham', name: 'פולהאם', quality: 75, colors: c('#ffffff', '#1b1b1b'), initials: 'FUL' },
  { id: 'brentford', name: 'ברנטפורד', quality: 74, colors: c('#c8102e', '#ffffff'), initials: 'BRE' },
  { id: 'everton', name: 'אברטון', quality: 74, colors: c('#1b4f9c', '#ffffff'), initials: 'EVE' },
  { id: 'wolves', name: 'וולבס', quality: 72, colors: c('#e07b28', '#1b1b1b'), initials: 'WOL' },
  { id: 'leeds', name: 'לידס', quality: 71, colors: c('#ffffff', '#f4d03f'), initials: 'LEE' },
  { id: 'sunderland', name: 'סנדרלנד', quality: 69, colors: c('#c8102e', '#ffffff'), initials: 'SUN' },
  { id: 'burnley', name: 'ברנלי', quality: 68, colors: c('#8f2a24', '#12a0d7'), initials: 'BUR' },
];

/* ================================================================== */
/* Assembled memberships                                               */
/* ================================================================== */

/**
 * The named clubs that complete each division around its modelled `Club` records.
 *
 * The completeness invariant - modelled clubs mapping to the league + this list == the league's
 * declared size, exactly - is enforced by `tests/worldData.test.ts` over every entry here, so a
 * new league that ships short fails the build rather than padding at runtime.
 */
export const TABLE_CLUBS_BY_LEAGUE: Record<string, readonly TableClub[]> = {
  il_premier: IL_PREMIER_CLUBS,
  il_leumit: IL_LEUMIT_CLUBS,
  be_pro: BE_PRO_CLUBS,
  nl_eredivisie: NL_EREDIVISIE_CLUBS,
  at_bundesliga: AT_BUNDESLIGA_CLUBS,
  gr_superleague: GR_SUPERLEAGUE_CLUBS,
  cy_first: CY_FIRST_CLUBS,
  pt_primeira: PT_PRIMEIRA_CLUBS,
  de_bundesliga: DE_BUNDESLIGA_CLUBS,
  es_laliga: ES_LALIGA_CLUBS,
  it_seriea: IT_SERIEA_CLUBS,
  en_premier: EN_PREMIER_CLUBS,
};

/**
 * Named stand-ins for the one dynamic case: an Israeli division short a club because promotion
 * or relegation moved a modelled club out of it mid-career.
 *
 * The world records division changes only for clubs it models (see `applyPromotionRelegation`),
 * and only the Israeli leagues declare promotion/relegation paths - so a European division can
 * never be short, and an Israeli one can be short by at most the couple of clubs the world has
 * moved. These are real clubs, deliberately NOT members of any division's main list, so a
 * reserve never appears in two tables at once.
 */
export const RESERVE_CLUBS_BY_LEAGUE: Record<string, readonly TableClub[]> = {
  il_premier: [
    { id: 'bnei_yehuda', name: 'בני יהודה', quality: 44, colors: c('#e07b28', '#1b1b1b') },
    { id: 'maccabi_petah_tikva', name: 'מכבי פתח תקווה', quality: 45, colors: c('#1b4f9c', '#ffffff') },
    { id: 'hapoel_holon', name: 'הפועל חולון', quality: 42, colors: c('#c8102e', '#f4d03f') },
  ],
  il_leumit: [
    { id: 'ironi_modiin', name: 'עירוני מודיעין', quality: 29, colors: c('#1b4f9c', '#e07b28') },
    { id: 'hapoel_herzliya', name: 'הפועל הרצליה', quality: 28, colors: c('#c8102e', '#ffffff') },
    { id: 'maccabi_ahi_nazareth', name: 'מכבי אחי נצרת', quality: 30, colors: c('#1b4f9c', '#ffffff') },
  ],
};

/* ================================================================== */
/* Lookups                                                             */
/* ================================================================== */

const ALL_TABLE_CLUBS: readonly TableClub[] = [
  ...Object.values(TABLE_CLUBS_BY_LEAGUE).flat(),
  ...Object.values(RESERVE_CLUBS_BY_LEAGUE).flat(),
];

const TABLE_CLUBS_BY_ID: ReadonlyMap<string, TableClub> = new Map(
  ALL_TABLE_CLUBS.map((club) => [club.id, club]),
);

/** Which league each table club belongs to, for country/league resolution. */
const LEAGUE_BY_TABLE_CLUB: ReadonlyMap<string, string> = new Map(
  Object.entries(TABLE_CLUBS_BY_LEAGUE).flatMap(([leagueId, clubs]) =>
    clubs.map((club) => [club.id, leagueId] as [string, string]),
  ),
);

/** A table club by id, or null - never a throw, because callers hold mixed id kinds. */
export function tableClubById(id: string): TableClub | null {
  return TABLE_CLUBS_BY_ID.get(id) ?? null;
}

/** The league a table club's membership places it in, or null for a reserve. */
export function tableClubLeague(id: string): string | null {
  return LEAGUE_BY_TABLE_CLUB.get(id) ?? null;
}

/** Every table club, for validators and the crest importer. */
export function allTableClubs(): readonly TableClub[] {
  return ALL_TABLE_CLUBS;
}

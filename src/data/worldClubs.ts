/**
 * The football world: membership, identity and football profile (v0.6.4).
 *
 * ## What changed in v0.6.4
 *
 * v0.6.3 fixed placeholder clubs by adding ~150 `TableClub`s - named, identified division members
 * that could never sign the player. That removed "קבוצה 8" but created a different problem: a
 * Serie A table full of Inter, Milan and Juventus in which only Bologna and Napoli could ever
 * make an offer. Most of the world was scenery.
 *
 * v0.6.4 removes the distinction. There is now ONE club identity per club, and every club in an
 * active modelled division is a real career destination when football conditions allow. What
 * keeps Inter aspirational is eligibility - ability, reputation, level fit, position need,
 * expected role - not a second class of object the market cannot see.
 *
 * ## The two tables here
 *
 * `LEAGUE_MEMBERSHIP` is the authoritative answer to "who plays in this division". It lists club
 * ids, complete, per league - and `tests/worldData.test.ts` fails the build if a division's list
 * is not exactly its declared size. Nothing at runtime may invent a member.
 *
 * `WORLD_CLUBS` carries identity and football profile for every club that does NOT have a
 * hand-tuned record in `clubs.ts`. Those hand-tuned records (the Maccabi pathway, the derby
 * rival, the original European stepping stones) keep their ids and their values - ids are save
 * data, and those numbers were balanced across five versions.
 *
 * `ALL_CLUBS` = hand-modelled + derived-from-here. One pool, one identity, one market.
 *
 * ## The snapshot
 *
 * **2026/27**, verified per league against the competition's own season article by
 * `scripts/auditLeagues.mjs` (bounded-retry, reproducible; raw output in `league-audit.json`).
 * Every modelled league's 2026/27 membership was determined at audit time. Where a club left the
 * modelled divisions entirely it is kept as an INACTIVE identity rather than deleted, because old
 * saves reference it and historical truth is not ours to rewrite.
 *
 * Club names and colours are used as facts. No crest artwork lives here - visual identity
 * resolves through `clubVisuals.ts` -> `ClubCrest`.
 */

export const WORLD_DATA_VERSION = '2026.2';

/** The season every membership list below describes. */
export const WORLD_SNAPSHOT_SEASON = '2026/27';

export interface WorldClub {
  /** Stable semantic id. Save data - never renamed. */
  id: string;
  /** Hebrew display name. */
  name: string;
  /** Squad strength, 0-100, the same scale as `Club.quality`. */
  quality: number;
  /** Reputation gain from playing here, 0-100. Defaults to a league-derived value. */
  prestige?: number;
  colors?: { primary: string; secondary: string };
  /** Latin initials where that is how the club is actually abbreviated. */
  initials?: string;
  /**
   * A club whose identity is preserved but which plays in no modelled division.
   *
   * Real clubs that dropped below the second tier in the snapshot season. They keep their id,
   * name and colours so an old save's history still renders honestly, and they appear in no
   * table, no market and no cup draw. See `INACTIVE_CLUBS`.
   */
  inactive?: true;
  /** Why this club cannot be a career destination, when that is deliberate. */
  notPlayableReason?: string;
}

const c = (primary: string, secondary: string): { primary: string; secondary: string } => ({
  primary,
  secondary,
});

/* ================================================================== */
/* Israel                                                              */
/* ================================================================== */

/**
 * ליגת העל 2026/27, fourteen clubs.
 *
 * v0.6.4 corrections against the snapshot, every one of which v0.6.3 had wrong:
 *   - Hapoel Petah Tikva, Hapoel Ramat Gan and Maccabi Petah Tikva are top-flight now. v0.6.3
 *     had the first two in Liga Leumit and the third as an unused reserve.
 *   - Hapoel Hadera was modelled as a top-flight club. It is in neither modelled division.
 *   - F.C. Ashdod and Maccabi Bnei Reineh were relegated to Liga Leumit.
 *   - Hapoel Ramat HaSharon is not a top-flight club at all.
 */
const IL_PREMIER_MEMBERS = [
  'maccabi_haifa',
  'maccabi_tel_aviv',
  'hapoel_beer_sheva',
  'beitar_jerusalem',
  'hapoel_tel_aviv',
  'maccabi_netanya',
  'hapoel_jerusalem_fc',
  'bnei_sakhnin',
  'hapoel_haifa',
  'ironi_kiryat_shmona',
  'maccabi_petah_tikva',
  'ironi_tiberias',
  'hapoel_ramat_gan',
  'hapoel_petah_tikva',
];

/** הליגה הלאומית 2026/27, sixteen clubs. */
const IL_LEUMIT_MEMBERS = [
  'hapoel_kfar_saba',
  'maccabi_herzliya',
  'hapoel_rishon',
  'bnei_yehuda',
  'ms_ashdod',
  'maccabi_bnei_raina',
  'hapoel_afula',
  'hapoel_acre',
  'maccabi_kabilio_jaffa',
  'ms_kafr_qasim',
  'hapoel_raanana',
  'hapoel_kfar_shalem',
  'ironi_modiin',
  'maccabi_ahi_nazareth',
  'maccabi_kiryat_gat',
  'ms_kiryat_yam',
];

const IL_CLUBS: WorldClub[] = [
  // Top flight, no hand-tuned record in clubs.ts
  { id: 'hapoel_jerusalem_fc', name: 'הפועל ירושלים', quality: 54, prestige: 24, colors: c('#c8102e', '#1b1b1b') },
  { id: 'ironi_tiberias', name: 'עירוני טבריה', quality: 45, prestige: 16, colors: c('#c8102e', '#1b4f9c') },
  { id: 'maccabi_petah_tikva', name: 'מכבי פתח תקווה', quality: 46, prestige: 18, colors: c('#1b4f9c', '#ffffff') },
  // Liga Leumit
  { id: 'bnei_yehuda', name: 'בני יהודה', quality: 42, prestige: 15, colors: c('#e07b28', '#1b1b1b') },
  { id: 'ms_ashdod', name: 'מ.ס אשדוד', quality: 44, prestige: 15, colors: c('#f4d03f', '#c8102e') },
  { id: 'maccabi_bnei_raina', name: 'מכבי בני ריינה', quality: 41, prestige: 13, colors: c('#1b4f9c', '#ffffff') },
  { id: 'hapoel_acre', name: 'הפועל עכו', quality: 38, prestige: 12, colors: c('#1b4f9c', '#ffffff') },
  { id: 'ms_kafr_qasim', name: 'מ.ס כפר קאסם', quality: 34, prestige: 11, colors: c('#3aa655', '#ffffff') },
  { id: 'hapoel_raanana', name: 'הפועל רעננה', quality: 33, prestige: 11, colors: c('#1b4f9c', '#f4d03f') },
  { id: 'hapoel_kfar_shalem', name: 'הפועל כפר שלם', quality: 32, prestige: 10, colors: c('#e07b28', '#1b1b1b') },
  { id: 'ironi_modiin', name: 'עירוני מודיעין', quality: 31, prestige: 10, colors: c('#1b4f9c', '#e07b28') },
  { id: 'maccabi_ahi_nazareth', name: 'מכבי אחי נצרת', quality: 30, prestige: 10, colors: c('#1b4f9c', '#ffffff') },
  { id: 'maccabi_kiryat_gat', name: 'מכבי קרית גת', quality: 30, prestige: 10, colors: c('#c8102e', '#f4d03f') },
  { id: 'ms_kiryat_yam', name: 'מ.ס קרית ים', quality: 29, prestige: 9, colors: c('#1b4f9c', '#f4d03f') },
];

/* ================================================================== */
/* Italy - Serie A, 20                                                 */
/* ================================================================== */

const IT_SERIEA_MEMBERS = [
  'inter_milan', 'ac_milan', 'juventus', 'napoli', 'atalanta', 'as_roma', 'lazio', 'fiorentina',
  'bologna', 'torino', 'como', 'udinese', 'genoa', 'sassuolo', 'parma', 'cagliari', 'lecce',
  'monza', 'venezia', 'frosinone',
];

const IT_CLUBS: WorldClub[] = [
  { id: 'inter_milan', name: 'אינטר', quality: 90, prestige: 90, colors: c('#1b4f9c', '#1b1b1b'), initials: 'INT' },
  { id: 'ac_milan', name: 'מילאן', quality: 87, prestige: 89, colors: c('#c8102e', '#1b1b1b'), initials: 'MIL' },
  { id: 'juventus', name: 'יובנטוס', quality: 87, prestige: 90, colors: c('#1b1b1b', '#ffffff'), initials: 'JUV' },
  { id: 'atalanta', name: 'אטלנטה', quality: 83, prestige: 78, colors: c('#1b4f9c', '#1b1b1b'), initials: 'ATA' },
  { id: 'as_roma', name: 'רומא', quality: 82, prestige: 82, colors: c('#8f2a24', '#f4d03f'), initials: 'ROM' },
  { id: 'lazio', name: 'לאציו', quality: 80, prestige: 78, colors: c('#12a0d7', '#ffffff'), initials: 'LAZ' },
  { id: 'fiorentina', name: 'פיורנטינה', quality: 77, prestige: 74, colors: c('#7b2d8e', '#ffffff'), initials: 'FIO' },
  { id: 'torino', name: 'טורינו', quality: 72, prestige: 66, colors: c('#8f2a24', '#ffffff'), initials: 'TOR' },
  { id: 'como', name: 'קומו', quality: 70, prestige: 60, colors: c('#1b4f9c', '#ffffff'), initials: 'COM' },
  { id: 'udinese', name: 'אודינזה', quality: 68, prestige: 60, colors: c('#1b1b1b', '#ffffff'), initials: 'UDI' },
  { id: 'genoa', name: 'ג׳נואה', quality: 67, prestige: 60, colors: c('#c8102e', '#1b4f9c'), initials: 'GEN' },
  { id: 'sassuolo', name: 'סאסואולו', quality: 65, prestige: 56, colors: c('#3aa655', '#1b1b1b'), initials: 'SAS' },
  { id: 'parma', name: 'פארמה', quality: 64, prestige: 58, colors: c('#f4d03f', '#1b4f9c'), initials: 'PAR' },
  { id: 'cagliari', name: 'קליארי', quality: 63, prestige: 55, colors: c('#c8102e', '#1b4f9c'), initials: 'CAG' },
  { id: 'lecce', name: 'לצ׳ה', quality: 62, prestige: 53, colors: c('#f4d03f', '#c8102e'), initials: 'LEC' },
  { id: 'monza', name: 'מונצה', quality: 61, prestige: 53, colors: c('#c8102e', '#ffffff'), initials: 'MON' },
  { id: 'venezia', name: 'ונציה', quality: 59, prestige: 52, colors: c('#1b1b1b', '#f4d03f'), initials: 'VEN' },
  { id: 'frosinone', name: 'פרוזינונה', quality: 58, prestige: 50, colors: c('#1b4f9c', '#f4d03f'), initials: 'FRO' },
];

/* ================================================================== */
/* England - Premier League, 20                                        */
/* ================================================================== */

const EN_PREMIER_MEMBERS = [
  'man_city', 'liverpool', 'arsenal', 'chelsea', 'man_united', 'tottenham', 'aston_villa',
  'newcastle', 'brighton', 'crystal_palace', 'nottingham_forest', 'bournemouth', 'fulham',
  'brentford', 'everton', 'leeds', 'sunderland', 'ipswich_town', 'coventry_city', 'hull_city',
];

const EN_CLUBS: WorldClub[] = [
  { id: 'man_city', name: 'מנצ׳סטר סיטי', quality: 95, prestige: 95, colors: c('#12a0d7', '#ffffff'), initials: 'MCI' },
  { id: 'liverpool', name: 'ליברפול', quality: 92, prestige: 95, colors: c('#c8102e', '#ffffff'), initials: 'LIV' },
  { id: 'arsenal', name: 'ארסנל', quality: 91, prestige: 93, colors: c('#c8102e', '#ffffff'), initials: 'ARS' },
  { id: 'chelsea', name: 'צ׳לסי', quality: 86, prestige: 90, colors: c('#1b4f9c', '#ffffff'), initials: 'CHE' },
  { id: 'man_united', name: 'מנצ׳סטר יונייטד', quality: 84, prestige: 93, colors: c('#c8102e', '#1b1b1b'), initials: 'MUN' },
  { id: 'aston_villa', name: 'אסטון וילה', quality: 82, prestige: 78, colors: c('#8f2a24', '#12a0d7'), initials: 'AVL' },
  { id: 'newcastle', name: 'ניוקאסל', quality: 81, prestige: 78, colors: c('#1b1b1b', '#ffffff'), initials: 'NEW' },
  { id: 'crystal_palace', name: 'קריסטל פאלאס', quality: 78, prestige: 68, colors: c('#1b4f9c', '#c8102e'), initials: 'CRY' },
  { id: 'nottingham_forest', name: 'נוטינגהאם פורסט', quality: 77, prestige: 68, colors: c('#c8102e', '#ffffff'), initials: 'NFO' },
  { id: 'bournemouth', name: 'בורנמות׳', quality: 76, prestige: 65, colors: c('#c8102e', '#1b1b1b'), initials: 'BOU' },
  { id: 'fulham', name: 'פולהאם', quality: 75, prestige: 66, colors: c('#ffffff', '#1b1b1b'), initials: 'FUL' },
  { id: 'brentford', name: 'ברנטפורד', quality: 74, prestige: 63, colors: c('#c8102e', '#ffffff'), initials: 'BRE' },
  { id: 'everton', name: 'אברטון', quality: 74, prestige: 70, colors: c('#1b4f9c', '#ffffff'), initials: 'EVE' },
  { id: 'leeds', name: 'לידס', quality: 71, prestige: 68, colors: c('#ffffff', '#f4d03f'), initials: 'LEE' },
  { id: 'sunderland', name: 'סנדרלנד', quality: 69, prestige: 62, colors: c('#c8102e', '#ffffff'), initials: 'SUN' },
  { id: 'ipswich_town', name: 'איפסוויץ׳', quality: 67, prestige: 58, colors: c('#1b4f9c', '#ffffff'), initials: 'IPS' },
  { id: 'coventry_city', name: 'קובנטרי סיטי', quality: 66, prestige: 56, colors: c('#12a0d7', '#ffffff'), initials: 'COV' },
  { id: 'hull_city', name: 'האל סיטי', quality: 65, prestige: 55, colors: c('#e07b28', '#1b1b1b'), initials: 'HUL' },
];

/* ================================================================== */
/* Spain - La Liga, 20                                                 */
/* ================================================================== */

const ES_LALIGA_MEMBERS = [
  'real_madrid', 'barcelona', 'atletico', 'athletic_bilbao', 'villarreal', 'real_sociedad',
  'real_betis', 'sevilla', 'valencia', 'celta_vigo', 'rayo_vallecano', 'osasuna', 'espanyol',
  'getafe', 'alaves', 'elche', 'levante', 'malaga', 'deportivo_la_coruna', 'racing_santander',
];

const ES_CLUBS: WorldClub[] = [
  { id: 'real_madrid', name: 'ריאל מדריד', quality: 94, prestige: 97, colors: c('#ffffff', '#f4d03f'), initials: 'RMA' },
  { id: 'barcelona', name: 'ברצלונה', quality: 92, prestige: 96, colors: c('#1b4f9c', '#8f2a24'), initials: 'BAR' },
  { id: 'athletic_bilbao', name: 'אתלטיק בילבאו', quality: 79, prestige: 76, colors: c('#c8102e', '#ffffff'), initials: 'ATH' },
  { id: 'real_sociedad', name: 'ריאל סוסיאדד', quality: 79, prestige: 74, colors: c('#1b4f9c', '#ffffff'), initials: 'RSO' },
  { id: 'villarreal', name: 'ויאריאל', quality: 78, prestige: 74, colors: c('#f4d03f', '#1b4f9c'), initials: 'VIL' },
  { id: 'sevilla', name: 'סביליה', quality: 78, prestige: 78, colors: c('#ffffff', '#c8102e'), initials: 'SEV' },
  { id: 'real_betis', name: 'ריאל בטיס', quality: 76, prestige: 72, colors: c('#3aa655', '#ffffff'), initials: 'BET' },
  { id: 'valencia', name: 'ולנסיה', quality: 74, prestige: 74, colors: c('#ffffff', '#e07b28'), initials: 'VAL' },
  { id: 'celta_vigo', name: 'סלטה ויגו', quality: 72, prestige: 64, colors: c('#12a0d7', '#ffffff'), initials: 'CEL' },
  { id: 'rayo_vallecano', name: 'ראיו וייקאנו', quality: 71, prestige: 60, colors: c('#ffffff', '#c8102e'), initials: 'RAY' },
  { id: 'osasuna', name: 'אוסאסונה', quality: 70, prestige: 60, colors: c('#c8102e', '#1b4f9c'), initials: 'OSA' },
  { id: 'espanyol', name: 'אספניול', quality: 67, prestige: 60, colors: c('#1b4f9c', '#ffffff'), initials: 'ESP' },
  { id: 'alaves', name: 'אלאבס', quality: 66, prestige: 56, colors: c('#1b4f9c', '#ffffff'), initials: 'ALA' },
  { id: 'elche', name: 'אלצ׳ה', quality: 63, prestige: 53, colors: c('#3aa655', '#ffffff'), initials: 'ELC' },
  { id: 'levante', name: 'לבאנטה', quality: 62, prestige: 53, colors: c('#1b4f9c', '#8f2a24'), initials: 'LEV' },
  { id: 'malaga', name: 'מלאגה', quality: 62, prestige: 57, colors: c('#12a0d7', '#ffffff'), initials: 'MAL' },
  { id: 'deportivo_la_coruna', name: 'דפורטיבו לה קורוניה', quality: 61, prestige: 58, colors: c('#1b4f9c', '#ffffff'), initials: 'DEP' },
  { id: 'racing_santander', name: 'ראסינג סנטנדר', quality: 60, prestige: 52, colors: c('#ffffff', '#3aa655'), initials: 'RAC' },
];

/* ================================================================== */
/* Germany - Bundesliga, 18                                            */
/* ================================================================== */

const DE_BUNDESLIGA_MEMBERS = [
  'bayern_munich', 'leverkusen', 'rb_leipzig', 'dortmund', 'stuttgart', 'eintracht_frankfurt',
  'freiburg', 'mainz', 'gladbach', 'union_berlin', 'hoffenheim', 'werder_bremen', 'hamburg',
  'augsburg', 'koln', 'schalke', 'sc_paderborn', 'elversberg',
];

const DE_CLUBS: WorldClub[] = [
  { id: 'bayern_munich', name: 'באיירן מינכן', quality: 92, prestige: 95, colors: c('#c8102e', '#ffffff'), initials: 'FCB' },
  { id: 'leverkusen', name: 'לברקוזן', quality: 85, prestige: 82, colors: c('#c8102e', '#1b1b1b'), initials: 'B04' },
  { id: 'rb_leipzig', name: 'לייפציג', quality: 84, prestige: 78, colors: c('#c8102e', '#ffffff'), initials: 'RBL' },
  { id: 'stuttgart', name: 'שטוטגרט', quality: 78, prestige: 72, colors: c('#ffffff', '#c8102e'), initials: 'VFB' },
  { id: 'eintracht_frankfurt', name: 'פרנקפורט', quality: 77, prestige: 74, colors: c('#c8102e', '#1b1b1b'), initials: 'SGE' },
  { id: 'freiburg', name: 'פרייבורג', quality: 73, prestige: 66, colors: c('#c8102e', '#ffffff'), initials: 'SCF' },
  { id: 'mainz', name: 'מיינץ', quality: 73, prestige: 63, colors: c('#c8102e', '#ffffff'), initials: 'M05' },
  { id: 'gladbach', name: 'מנשנגלדבאך', quality: 72, prestige: 70, colors: c('#ffffff', '#3aa655'), initials: 'BMG' },
  { id: 'union_berlin', name: 'אוניון ברלין', quality: 71, prestige: 63, colors: c('#c8102e', '#f4d03f'), initials: 'FCU' },
  { id: 'hoffenheim', name: 'הופנהיים', quality: 70, prestige: 62, colors: c('#1b4f9c', '#ffffff'), initials: 'TSG' },
  { id: 'hamburg', name: 'המבורג', quality: 69, prestige: 70, colors: c('#1b4f9c', '#ffffff'), initials: 'HSV' },
  { id: 'augsburg', name: 'אאוגסבורג', quality: 68, prestige: 60, colors: c('#c8102e', '#3aa655'), initials: 'FCA' },
  { id: 'koln', name: 'קלן', quality: 67, prestige: 66, colors: c('#c8102e', '#ffffff'), initials: 'KOE' },
  { id: 'schalke', name: 'שאלקה 04', quality: 66, prestige: 72, colors: c('#1b4f9c', '#ffffff'), initials: 'S04' },
  { id: 'sc_paderborn', name: 'פאדרבורן', quality: 62, prestige: 52, colors: c('#1b4f9c', '#1b1b1b'), initials: 'SCP' },
  { id: 'elversberg', name: 'אלברסברג', quality: 61, prestige: 48, colors: c('#c8102e', '#ffffff'), initials: 'SVE' },
];

/* ================================================================== */
/* Netherlands - Eredivisie, 18                                        */
/* ================================================================== */

const NL_EREDIVISIE_MEMBERS = [
  'ajax', 'psv', 'feyenoord', 'az_alkmaar', 'twente', 'fc_utrecht', 'nec_nijmegen',
  'go_ahead_eagles', 'sparta_rotterdam', 'fc_groningen', 'heerenveen', 'fortuna_sittard',
  'pec_zwolle', 'excelsior', 'telstar', 'willem_ii', 'ado_den_haag', 'cambuur',
];

const NL_CLUBS: WorldClub[] = [
  { id: 'ajax', name: 'איאקס', quality: 82, prestige: 84, colors: c('#c8102e', '#ffffff'), initials: 'AJA' },
  { id: 'psv', name: 'איינדהובן', quality: 81, prestige: 80, colors: c('#c8102e', '#ffffff'), initials: 'PSV' },
  { id: 'feyenoord', name: 'פיינורד', quality: 79, prestige: 78, colors: c('#c8102e', '#1b1b1b'), initials: 'FEY' },
  { id: 'twente', name: 'טוונטה', quality: 72, prestige: 64, colors: c('#c8102e', '#ffffff'), initials: 'TWE' },
  { id: 'fc_utrecht', name: 'אוטרכט', quality: 69, prestige: 60, colors: c('#c8102e', '#ffffff'), initials: 'UTR' },
  { id: 'nec_nijmegen', name: 'ניימיכן', quality: 64, prestige: 55, colors: c('#c8102e', '#3aa655'), initials: 'NEC' },
  { id: 'go_ahead_eagles', name: 'חו אהד איגלס', quality: 63, prestige: 54, colors: c('#c8102e', '#f4d03f'), initials: 'GAE' },
  { id: 'sparta_rotterdam', name: 'ספרטה רוטרדם', quality: 62, prestige: 54, colors: c('#c8102e', '#ffffff'), initials: 'SPA' },
  { id: 'fc_groningen', name: 'חרונינגן', quality: 62, prestige: 55, colors: c('#3aa655', '#ffffff'), initials: 'GRO' },
  { id: 'heerenveen', name: 'הירנפין', quality: 61, prestige: 54, colors: c('#1b4f9c', '#ffffff'), initials: 'HEE' },
  { id: 'fortuna_sittard', name: 'פורטונה סיטארד', quality: 58, prestige: 50, colors: c('#f4d03f', '#3aa655'), initials: 'FOR' },
  { id: 'pec_zwolle', name: 'זבולה', quality: 57, prestige: 49, colors: c('#1b4f9c', '#ffffff'), initials: 'PEC' },
  { id: 'willem_ii', name: 'וילם השני', quality: 56, prestige: 50, colors: c('#c8102e', '#1b4f9c'), initials: 'WIL' },
  { id: 'excelsior', name: 'אקסלסיור', quality: 55, prestige: 47, colors: c('#c8102e', '#1b1b1b'), initials: 'EXC' },
  { id: 'ado_den_haag', name: 'אדו האג', quality: 55, prestige: 50, colors: c('#f4d03f', '#3aa655'), initials: 'ADO' },
  { id: 'cambuur', name: 'קמבור', quality: 53, prestige: 45, colors: c('#f4d03f', '#1b4f9c'), initials: 'CAM' },
  { id: 'telstar', name: 'טלסטאר', quality: 52, prestige: 44, colors: c('#ffffff', '#1b1b1b'), initials: 'TEL' },
];

/* ================================================================== */
/* Belgium - Pro League, 18 (expanded from 16 for 2026/27)             */
/* ================================================================== */

const BE_PRO_MEMBERS = [
  'club_brugge', 'anderlecht', 'genk', 'gent', 'antwerp', 'union_sg', 'standard_liege',
  'charleroi', 'kv_mechelen', 'cercle_brugge', 'westerlo', 'oh_leuven', 'sint_truiden',
  'zulte_waregem', 'la_louviere', 'kortrijk', 'beveren', 'lommel',
];

const BE_CLUBS: WorldClub[] = [
  { id: 'club_brugge', name: 'קלאב ברוז׳', quality: 76, prestige: 70, colors: c('#1b4f9c', '#1b1b1b'), initials: 'CLU' },
  { id: 'anderlecht', name: 'אנדרלכט', quality: 73, prestige: 72, colors: c('#7b2d8e', '#ffffff'), initials: 'AND' },
  { id: 'genk', name: 'גנק', quality: 71, prestige: 64, colors: c('#1b4f9c', '#ffffff'), initials: 'GNK' },
  { id: 'gent', name: 'חנט', quality: 70, prestige: 62, colors: c('#1b4f9c', '#ffffff'), initials: 'GNT' },
  { id: 'antwerp', name: 'אנטוורפן', quality: 69, prestige: 62, colors: c('#c8102e', '#ffffff'), initials: 'ANT' },
  { id: 'standard_liege', name: 'סטנדרד ליאז׳', quality: 64, prestige: 62, colors: c('#c8102e', '#ffffff'), initials: 'STA' },
  { id: 'charleroi', name: 'שארלרואה', quality: 62, prestige: 52, colors: c('#1b1b1b', '#ffffff'), initials: 'CHA' },
  { id: 'kv_mechelen', name: 'מכלן', quality: 60, prestige: 50, colors: c('#f4d03f', '#c8102e'), initials: 'MEC' },
  { id: 'cercle_brugge', name: 'סרקל ברוז׳', quality: 59, prestige: 48, colors: c('#3aa655', '#1b1b1b'), initials: 'CER' },
  { id: 'westerlo', name: 'וסטרלו', quality: 58, prestige: 46, colors: c('#f4d03f', '#1b4f9c'), initials: 'WES' },
  { id: 'oh_leuven', name: 'לוון', quality: 57, prestige: 46, colors: c('#ffffff', '#1b1b1b'), initials: 'OHL' },
  { id: 'sint_truiden', name: 'סינט טרויידן', quality: 56, prestige: 45, colors: c('#f4d03f', '#1b4f9c'), initials: 'STV' },
  { id: 'kortrijk', name: 'קורטרייק', quality: 54, prestige: 45, colors: c('#c8102e', '#ffffff'), initials: 'KOR' },
  { id: 'zulte_waregem', name: 'זולטה וארחם', quality: 53, prestige: 44, colors: c('#c8102e', '#3aa655'), initials: 'ZWA' },
  { id: 'beveren', name: 'בברן', quality: 52, prestige: 43, colors: c('#f4d03f', '#1b4f9c'), initials: 'BEV' },
  { id: 'la_louviere', name: 'לה לוביירה', quality: 51, prestige: 42, colors: c('#3aa655', '#ffffff'), initials: 'LLO' },
  { id: 'lommel', name: 'לומל', quality: 50, prestige: 41, colors: c('#1b4f9c', '#ffffff'), initials: 'LOM' },
];

/* ================================================================== */
/* Portugal - Primeira Liga, 18                                        */
/* ================================================================== */

const PT_PRIMEIRA_MEMBERS = [
  'benfica', 'porto', 'sporting_cp', 'braga', 'vitoria_guimaraes', 'famalicao', 'santa_clara',
  'gil_vicente', 'estoril', 'moreirense', 'arouca', 'casa_pia', 'rio_ave', 'nacional',
  'estrela_amadora', 'alverca', 'maritimo', 'academico_viseu',
];

const PT_CLUBS: WorldClub[] = [
  { id: 'porto', name: 'פורטו', quality: 84, prestige: 86, colors: c('#1b4f9c', '#ffffff'), initials: 'POR' },
  { id: 'sporting_cp', name: 'ספורטינג ליסבון', quality: 83, prestige: 85, colors: c('#3aa655', '#ffffff'), initials: 'SCP' },
  { id: 'braga', name: 'בראגה', quality: 76, prestige: 70, colors: c('#c8102e', '#ffffff'), initials: 'BRA' },
  { id: 'vitoria_guimaraes', name: 'ויטוריה גימאראש', quality: 70, prestige: 62, colors: c('#ffffff', '#1b1b1b'), initials: 'VIT' },
  { id: 'famalicao', name: 'פמליקאו', quality: 66, prestige: 54, colors: c('#1b4f9c', '#ffffff'), initials: 'FAM' },
  { id: 'santa_clara', name: 'סנטה קלרה', quality: 63, prestige: 52, colors: c('#c8102e', '#ffffff'), initials: 'SCL' },
  { id: 'gil_vicente', name: 'ז׳יל ויסנטה', quality: 63, prestige: 52, colors: c('#c8102e', '#1b4f9c'), initials: 'GIL' },
  { id: 'estoril', name: 'אשטוריל', quality: 63, prestige: 52, colors: c('#f4d03f', '#1b4f9c'), initials: 'EST' },
  { id: 'moreirense', name: 'מוריירנסה', quality: 62, prestige: 51, colors: c('#3aa655', '#ffffff'), initials: 'MOR' },
  { id: 'arouca', name: 'ארוקה', quality: 62, prestige: 50, colors: c('#f4d03f', '#1b4f9c'), initials: 'ARO' },
  { id: 'casa_pia', name: 'קאזה פיה', quality: 61, prestige: 49, colors: c('#1b1b1b', '#ffffff'), initials: 'CPI' },
  { id: 'rio_ave', name: 'ריו אבה', quality: 61, prestige: 50, colors: c('#3aa655', '#ffffff'), initials: 'RAV' },
  { id: 'nacional', name: 'נסיונל מדיירה', quality: 58, prestige: 48, colors: c('#1b1b1b', '#ffffff'), initials: 'NAC' },
  { id: 'estrela_amadora', name: 'אשטרלה אמדורה', quality: 57, prestige: 47, colors: c('#c8102e', '#3aa655'), initials: 'EAM' },
  { id: 'maritimo', name: 'מריטימו', quality: 57, prestige: 50, colors: c('#3aa655', '#c8102e'), initials: 'MAR' },
  { id: 'alverca', name: 'אלברקה', quality: 55, prestige: 45, colors: c('#c8102e', '#ffffff'), initials: 'ALV' },
  { id: 'academico_viseu', name: 'אקדמיקו ויזאו', quality: 54, prestige: 44, colors: c('#1b4f9c', '#ffffff'), initials: 'AVI' },
];

/* ================================================================== */
/* Austria - Bundesliga, 12                                            */
/* ================================================================== */

const AT_BUNDESLIGA_MEMBERS = [
  'rb_salzburg', 'sturm_graz', 'rapid_wien', 'lask', 'austria_wien', 'wolfsberger',
  'hartberg', 'grazer_ak', 'altach', 'wsg_tirol', 'sv_ried', 'austria_lustenau',
];

const AT_CLUBS: WorldClub[] = [
  { id: 'rb_salzburg', name: 'רד בול זלצבורג', quality: 78, prestige: 72, colors: c('#c8102e', '#ffffff'), initials: 'RBS' },
  { id: 'rapid_wien', name: 'ראפיד וינה', quality: 67, prestige: 62, colors: c('#3aa655', '#ffffff'), initials: 'RAP' },
  { id: 'lask', name: 'לאסק לינץ', quality: 66, prestige: 56, colors: c('#1b1b1b', '#ffffff'), initials: 'LASK' },
  { id: 'austria_wien', name: 'אוסטריה וינה', quality: 64, prestige: 60, colors: c('#7b2d8e', '#ffffff'), initials: 'FAK' },
  { id: 'wolfsberger', name: 'וולפסברגר', quality: 62, prestige: 50, colors: c('#1b1b1b', '#ffffff'), initials: 'WAC' },
  { id: 'hartberg', name: 'הרטברג', quality: 58, prestige: 46, colors: c('#1b4f9c', '#c8102e'), initials: 'HTB' },
  { id: 'grazer_ak', name: 'גראצר', quality: 55, prestige: 46, colors: c('#c8102e', '#ffffff'), initials: 'GAK' },
  { id: 'wsg_tirol', name: 'טירול', quality: 55, prestige: 44, colors: c('#3aa655', '#ffffff'), initials: 'WSG' },
  { id: 'altach', name: 'אלטאך', quality: 53, prestige: 43, colors: c('#1b1b1b', '#f4d03f'), initials: 'ALT' },
  { id: 'sv_ried', name: 'ריד', quality: 52, prestige: 42, colors: c('#3aa655', '#1b1b1b'), initials: 'RIE' },
  { id: 'austria_lustenau', name: 'אוסטריה לוסטנאו', quality: 50, prestige: 40, colors: c('#3aa655', '#ffffff'), initials: 'ALU' },
];

/* ================================================================== */
/* Greece - Super League, 14                                           */
/* ================================================================== */

const GR_SUPERLEAGUE_MEMBERS = [
  'olympiacos', 'panathinaikos', 'paok', 'aek_athens', 'aris_thessaloniki', 'ofi_crete',
  'atromitos', 'asteras_tripolis', 'volos', 'panetolikos', 'levadiakos', 'kifisia',
  'iraklis', 'kalamata',
];

const GR_CLUBS: WorldClub[] = [
  { id: 'olympiacos', name: 'אולימפיאקוס', quality: 78, prestige: 72, colors: c('#c8102e', '#ffffff'), initials: 'OLY' },
  { id: 'panathinaikos', name: 'פנאתינייקוס', quality: 74, prestige: 70, colors: c('#3aa655', '#ffffff'), initials: 'PAO' },
  { id: 'aek_athens', name: 'AEK אתונה', quality: 72, prestige: 68, colors: c('#f4d03f', '#1b1b1b'), initials: 'AEK' },
  { id: 'aris_thessaloniki', name: 'אריס סלוניקי', quality: 65, prestige: 56, colors: c('#f4d03f', '#1b1b1b'), initials: 'ARI' },
  { id: 'ofi_crete', name: 'אופי כרתים', quality: 60, prestige: 50, colors: c('#1b1b1b', '#ffffff'), initials: 'OFI' },
  { id: 'atromitos', name: 'אטרומיטוס', quality: 56, prestige: 47, colors: c('#1b4f9c', '#ffffff'), initials: 'ATR' },
  { id: 'asteras_tripolis', name: 'אסטרס טריפוליס', quality: 55, prestige: 46, colors: c('#f4d03f', '#1b4f9c'), initials: 'AST' },
  { id: 'volos', name: 'וולוס', quality: 55, prestige: 45, colors: c('#c8102e', '#ffffff'), initials: 'VOL' },
  { id: 'panetolikos', name: 'פאנטוליקוס', quality: 54, prestige: 44, colors: c('#f4d03f', '#1b4f9c'), initials: 'PAN' },
  { id: 'levadiakos', name: 'לבאדיאקוס', quality: 53, prestige: 43, colors: c('#3aa655', '#ffffff'), initials: 'LEV' },
  { id: 'kifisia', name: 'קיפיסיה', quality: 52, prestige: 42, colors: c('#c8102e', '#1b4f9c'), initials: 'KIF' },
  { id: 'iraklis', name: 'הרקליס', quality: 52, prestige: 45, colors: c('#12a0d7', '#ffffff'), initials: 'IRA' },
  { id: 'kalamata', name: 'קלמטה', quality: 50, prestige: 41, colors: c('#1b1b1b', '#ffffff'), initials: 'KAL' },
];

/* ================================================================== */
/* Cyprus - First Division, 14 (v0.6.3 modelled it as 12)              */
/* ================================================================== */

const CY_FIRST_MEMBERS = [
  'pafos_fc', 'apoel', 'omonia_nicosia', 'aek_larnaca', 'apollon_limassol', 'aris_limassol',
  'ael_limassol', 'anorthosis', 'olympiakos_nicosia', 'omonia_aradippou', 'nea_salamina',
  'karmiotissa', 'krasava_eny', 'omonia_29m',
];

const CY_CLUBS: WorldClub[] = [
  { id: 'pafos_fc', name: 'פאפוס', quality: 61, prestige: 50, colors: c('#1b4f9c', '#f4d03f'), initials: 'PAF' },
  { id: 'apoel', name: 'אפואל ניקוסיה', quality: 60, prestige: 54, colors: c('#f4d03f', '#1b4f9c'), initials: 'APO' },
  { id: 'omonia_nicosia', name: 'אומוניה ניקוסיה', quality: 59, prestige: 52, colors: c('#3aa655', '#ffffff'), initials: 'OMO' },
  { id: 'aek_larnaca', name: 'AEK לרנקה', quality: 58, prestige: 48, colors: c('#f4d03f', '#3aa655'), initials: 'AEK' },
  { id: 'apollon_limassol', name: 'אפולון לימסול', quality: 57, prestige: 47, colors: c('#1b4f9c', '#ffffff'), initials: 'APL' },
  { id: 'aris_limassol', name: 'אריס לימסול', quality: 55, prestige: 45, colors: c('#3aa655', '#1b1b1b'), initials: 'ARL' },
  { id: 'ael_limassol', name: 'AEL לימסול', quality: 54, prestige: 45, colors: c('#f4d03f', '#1b4f9c'), initials: 'AEL' },
  { id: 'anorthosis', name: 'אנורתוזיס', quality: 52, prestige: 45, colors: c('#1b4f9c', '#ffffff'), initials: 'ANO' },
  { id: 'olympiakos_nicosia', name: 'אולימפיאקוס ניקוסיה', quality: 48, prestige: 40, colors: c('#3aa655', '#ffffff'), initials: 'OLN' },
  { id: 'nea_salamina', name: 'נאה סלמינה', quality: 47, prestige: 40, colors: c('#c8102e', '#ffffff'), initials: 'NSA' },
  { id: 'omonia_aradippou', name: 'אומוניה ארדיפו', quality: 46, prestige: 38, colors: c('#c8102e', '#3aa655'), initials: 'OAR' },
  { id: 'karmiotissa', name: 'קרמיוטיסה', quality: 45, prestige: 36, colors: c('#1b4f9c', '#f4d03f'), initials: 'KAR' },
  { id: 'krasava_eny', name: 'קראסאבה', quality: 44, prestige: 35, colors: c('#c8102e', '#1b1b1b'), initials: 'KRA' },
  { id: 'omonia_29m', name: 'אומוניה 29 במאי', quality: 43, prestige: 35, colors: c('#3aa655', '#1b1b1b'), initials: 'O29' },
];

/* ================================================================== */
/* Inactive identities (A5, A6)                                        */
/* ================================================================== */

/**
 * Real clubs that are no longer in a modelled division.
 *
 * They dropped below the second tier in the snapshot season, and Maccabist models two Israeli
 * divisions and one top flight per European country. Their identity is preserved rather than
 * deleted for one reason: **old saves reference them**, and a career that really did play for
 * הפועל חדרה in 2038 must keep saying so. They appear in no table, no market and no cup draw;
 * `getClub` still resolves their name and colours so history renders honestly.
 *
 * Four clubs with full hand-tuned `Club` records in clubs.ts are also inactive now
 * (hapoel_hadera, hapoel_nof_hagalil, sektzia_nes_tziona, hapoel_umm_al_fahm). Their records
 * stay exactly as they were; `INACTIVE_CLUB_IDS` below is what removes them from play.
 */
export const INACTIVE_CLUBS: WorldClub[] = [
  /* Israeli clubs that fell below Liga Leumit, or were never top-flight. */
  { id: 'hapoel_ramat_hasharon', name: 'הפועל רמת השרון', quality: 40, colors: c('#1b4f9c', '#f4d03f'), inactive: true, notPlayableReason: 'not a member of either modelled Israeli division in 2026/27' },
  { id: 'shimshon_tel_aviv', name: 'שמשון תל אביב', quality: 31, colors: c('#1b1b1b', '#f4d03f'), inactive: true, notPlayableReason: 'below Liga Leumit in 2026/27' },
  { id: 'hapoel_beit_shean', name: 'הפועל בית שאן', quality: 30, colors: c('#c8102e', '#ffffff'), inactive: true, notPlayableReason: 'below Liga Leumit in 2026/27' },
  { id: 'hapoel_holon', name: 'הפועל חולון', quality: 42, colors: c('#c8102e', '#f4d03f'), inactive: true, notPlayableReason: 'below Liga Leumit in 2026/27' },
  { id: 'boavista', name: 'בואוויסטה', quality: 62, colors: c('#1b1b1b', '#ffffff'), inactive: true, notPlayableReason: 'not in the Primeira Liga in 2026/27' },
  { id: 'vitesse', name: 'ויטסה', quality: 62, colors: c('#f4d03f', '#1b1b1b'), inactive: true, notPlayableReason: 'not in the Eredivisie in 2026/27' },

  /*
   * Every club v0.6.3 carried that the 2026/27 snapshot relegated out of a modelled division.
   *
   * Deleting them would have been the easy move and the wrong one. A v0.6.3 career really did
   * play for Hellas Verona or West Ham, and several of them already have imported crest assets -
   * so their identity, colours and badge stay exactly as they were, and only their PLACE is
   * gone. This is the whole of A5/A6 in one list.
   */
  { id: 'avs', name: 'אבש', quality: 56, colors: c('#c8102e', '#ffffff'), initials: 'AVS', inactive: true },
  { id: 'blau_weiss_linz', name: 'בלאו וייס לינץ', quality: 54, colors: c('#1b4f9c', '#ffffff'), initials: 'BWL', inactive: true },
  { id: 'burnley', name: 'ברנלי', quality: 68, colors: c('#8f2a24', '#12a0d7'), initials: 'BUR', inactive: true },
  { id: 'cremonese', name: 'קרמונזה', quality: 58, colors: c('#c8102e', '#8c6d1f'), initials: 'CRE', inactive: true },
  { id: 'dender', name: 'דנדר', quality: 52, colors: c('#1b4f9c', '#ffffff'), initials: 'DEN', inactive: true },
  { id: 'doxa_katokopias', name: 'דוקסה', quality: 46, colors: c('#3aa655', '#ffffff'), initials: 'DOX', inactive: true },
  { id: 'ethnikos_achna', name: 'אתניקוס אחנה', quality: 47, colors: c('#f4d03f', '#3aa655'), initials: 'ETH', inactive: true },
  { id: 'girona', name: 'ג׳ירונה', quality: 72, colors: c('#c8102e', '#ffffff'), initials: 'GIR', inactive: true },
  { id: 'hapoel_herzliya', name: 'הפועל הרצליה', quality: 28, colors: c('#c8102e', '#ffffff'), inactive: true },
  { id: 'heidenheim', name: 'היידנהיים', quality: 63, colors: c('#c8102e', '#1b4f9c'), initials: 'HDH', inactive: true },
  { id: 'hellas_verona', name: 'ורונה', quality: 61, colors: c('#f4d03f', '#1b4f9c'), initials: 'VER', inactive: true },
  { id: 'heracles', name: 'הרקלס אלמלו', quality: 56, colors: c('#1b1b1b', '#ffffff'), initials: 'HER', inactive: true },
  { id: 'larissa', name: 'לאריסה', quality: 51, colors: c('#8f2a24', '#ffffff'), initials: 'AEL', inactive: true },
  { id: 'mallorca', name: 'מיורקה', quality: 69, colors: c('#c8102e', '#1b1b1b'), initials: 'MLL', inactive: true },
  { id: 'nac_breda', name: 'ברדה', quality: 58, colors: c('#f4d03f', '#1b1b1b'), initials: 'NAC', inactive: true },
  { id: 'panserraikos', name: 'פנסראיקוס', quality: 53, colors: c('#c8102e', '#ffffff'), initials: 'PSE', inactive: true },
  { id: 'pisa', name: 'פיזה', quality: 57, colors: c('#1b4f9c', '#1b1b1b'), initials: 'PIS', inactive: true },
  { id: 'real_oviedo', name: 'ריאל אוביידו', quality: 61, colors: c('#1b4f9c', '#ffffff'), initials: 'OVI', inactive: true },
  { id: 'st_pauli', name: 'סנט פאולי', quality: 65, colors: c('#8c6d1f', '#c8102e'), initials: 'STP', inactive: true },
  { id: 'tondela', name: 'טונדלה', quality: 55, colors: c('#f4d03f', '#3aa655'), initials: 'TON', inactive: true },
  { id: 'volendam', name: 'פולנדם', quality: 53, colors: c('#e07b28', '#1b1b1b'), initials: 'VOL', inactive: true },
  { id: 'west_ham', name: 'ווסטהאם', quality: 77, colors: c('#8f2a24', '#12a0d7'), initials: 'WHU', inactive: true },
  { id: 'wolfsburg', name: 'וולפסבורג', quality: 71, colors: c('#3aa655', '#ffffff'), initials: 'WOB', inactive: true },
  { id: 'wolves', name: 'וולבס', quality: 72, colors: c('#e07b28', '#1b1b1b'), initials: 'WOL', inactive: true },
];

/**
 * Hand-modelled clubs in `clubs.ts` that the 2026/27 snapshot puts outside both modelled Israeli
 * divisions. Their `Club` records are untouched - this list is what keeps them out of tables and
 * out of the market while their identity, name and history stay intact.
 */
export const INACTIVE_CLUB_IDS: readonly string[] = [
  'hapoel_hadera',
  'hapoel_nof_hagalil',
  'sektzia_nes_tziona',
  'hapoel_umm_al_fahm',
];

/* ================================================================== */
/* Assembled                                                           */
/* ================================================================== */

/**
 * Who plays in each division this snapshot. The authoritative membership.
 *
 * Complete and exact: `tests/worldData.test.ts` asserts each list's length equals the league's
 * declared size and that every id resolves to a real club. Nothing at runtime may add a member.
 */
export const LEAGUE_MEMBERSHIP: Record<string, readonly string[]> = {
  il_premier: IL_PREMIER_MEMBERS,
  il_leumit: IL_LEUMIT_MEMBERS,
  it_seriea: IT_SERIEA_MEMBERS,
  en_premier: EN_PREMIER_MEMBERS,
  es_laliga: ES_LALIGA_MEMBERS,
  de_bundesliga: DE_BUNDESLIGA_MEMBERS,
  nl_eredivisie: NL_EREDIVISIE_MEMBERS,
  be_pro: BE_PRO_MEMBERS,
  pt_primeira: PT_PRIMEIRA_MEMBERS,
  at_bundesliga: AT_BUNDESLIGA_MEMBERS,
  gr_superleague: GR_SUPERLEAGUE_MEMBERS,
  cy_first: CY_FIRST_MEMBERS,
};

/**
 * Identity and football profile for every club without a hand-tuned record in `clubs.ts`.
 *
 * `clubs.ts` keeps the Maccabi pathway, the derby rival and the original European stepping
 * stones - ids are save data and those numbers were balanced over five versions, so they are not
 * regenerated here. Everything else in the world lives in this list and becomes a real `Club`
 * through `deriveWorldClubs()` in clubs.ts.
 */
export const WORLD_CLUBS: readonly WorldClub[] = [
  ...IL_CLUBS,
  ...IT_CLUBS,
  ...EN_CLUBS,
  ...ES_CLUBS,
  ...DE_CLUBS,
  ...NL_CLUBS,
  ...BE_CLUBS,
  ...PT_CLUBS,
  ...AT_CLUBS,
  ...GR_CLUBS,
  ...CY_CLUBS,
  ...INACTIVE_CLUBS,
];

const WORLD_CLUBS_BY_ID: ReadonlyMap<string, WorldClub> = new Map(
  WORLD_CLUBS.map((club) => [club.id, club]),
);

/** Which league each club's membership places it in, before any in-career movement. */
const LEAGUE_BY_CLUB: ReadonlyMap<string, string> = new Map(
  Object.entries(LEAGUE_MEMBERSHIP).flatMap(([leagueId, ids]) =>
    ids.map((id) => [id, leagueId] as [string, string]),
  ),
);

const INACTIVE_IDS: ReadonlySet<string> = new Set([
  ...INACTIVE_CLUBS.map((club) => club.id),
  ...INACTIVE_CLUB_IDS,
]);

/** A world club by id, or null - never a throw, because callers hold mixed id kinds. */
export function worldClubById(id: string): WorldClub | null {
  return WORLD_CLUBS_BY_ID.get(id) ?? null;
}

/** The league a club's snapshot membership places it in, or null for an inactive club. */
export function snapshotLeagueOf(id: string): string | null {
  return LEAGUE_BY_CLUB.get(id) ?? null;
}

/** Every club id in an active modelled division. */
export function activeClubIds(): readonly string[] {
  return [...LEAGUE_BY_CLUB.keys()];
}

/**
 * True for a club whose identity is preserved but which plays nowhere modelled.
 *
 * The one gate that keeps a relegated-out-of-scope club out of tables, markets and cup draws
 * while leaving its name readable in a career that really did play there.
 */
export function isInactiveClub(id: string): boolean {
  return INACTIVE_IDS.has(id);
}

/**
 * Importer identity seeds (v0.6.3, C5).
 *
 * The world dataset speaks Hebrew; the providers speak English. This file is the bridge: for
 * every club the importer is allowed to attempt, its English name, the aliases it is actually
 * known by, and the country the resolved entity must belong to. The importer treats these as
 * *search* input - never as proof. A candidate is accepted only when it passes the verification
 * in `importClubCrests.ts` (label/alias match + instance-of football club + country match), and
 * anything short of that is reported as unresolved rather than guessed (C6).
 *
 * ## Israel (v0.6.4, D1)
 *
 * v0.6.3 excluded Israeli clubs outright, on v0.4.7's finding that their crests are pictorial
 * non-free works absent from Commons. That finding may well still hold - but a blanket skip
 * asserts it about thirty clubs without checking any of them, and the pipeline now exists to
 * check. Every active Israeli club is seeded here and goes through the identical gauntlet:
 * entity verification, asset-role classification, PD/CC0-only licence gate. Whatever comes back
 * is reported honestly, including "nothing", which is a measurement rather than an assumption.
 *
 * Israeli transliteration varies a lot (Petah Tikva / Petach Tikva / Petah Tiqwa), so these
 * seeds carry more aliases than the European ones.
 */

export interface CrestSeed {
  /** Internal club id - a modelled Club or a TableClub. */
  clubId: string;
  /** Primary English search name. */
  english: string;
  /** Other names the club is genuinely known by (C5). */
  aliases?: string[];
  /** Country key into COUNTRY_QIDS - the resolved entity's P17 must match. */
  country: CountryKey;
  /**
   * Manual-review override (C6): filled only after a human inspected an ambiguous search and
   * chose the right entity. The importer still verifies it before using it.
   */
  wikidata?: string;
}

export type CountryKey =
  | 'israel'
  | 'italy'
  | 'spain'
  | 'england'
  | 'germany'
  | 'netherlands'
  | 'belgium'
  | 'austria'
  | 'greece'
  | 'cyprus'
  | 'portugal';

/** Wikidata QIDs a club's P17 (country) may resolve to, per country. */
export const COUNTRY_QIDS: Record<CountryKey, readonly string[]> = {
  israel: ['Q801'],
  italy: ['Q38'],
  spain: ['Q29'],
  // English clubs carry England or the United Kingdom, inconsistently.
  england: ['Q21', 'Q145'],
  germany: ['Q183'],
  netherlands: ['Q55'],
  belgium: ['Q31'],
  austria: ['Q40'],
  greece: ['Q41'],
  cyprus: ['Q229'],
  portugal: ['Q45'],
};

export const CREST_SEEDS: readonly CrestSeed[] = [
  /* ---------------- Israel (v0.6.4: no longer skipped) ---------------- */
  { clubId: 'maccabi_haifa', english: 'Maccabi Haifa F.C.', aliases: ['Maccabi Haifa', 'Maccabi Haifa FC'], country: 'israel' },
  { clubId: 'maccabi_tel_aviv', english: 'Maccabi Tel Aviv F.C.', aliases: ['Maccabi Tel Aviv', 'Maccabi Tel-Aviv'], country: 'israel' },
  { clubId: 'hapoel_beer_sheva', english: "Hapoel Be'er Sheva F.C.", aliases: ["Hapoel Be'er Sheva", 'Hapoel Beer Sheva', 'Hapoel Beersheba'], country: 'israel' },
  { clubId: 'beitar_jerusalem', english: 'Beitar Jerusalem F.C.', aliases: ['Beitar Jerusalem', 'Beitar Yerushalayim'], country: 'israel' },
  { clubId: 'hapoel_tel_aviv', english: 'Hapoel Tel Aviv F.C.', aliases: ['Hapoel Tel Aviv', 'Hapoel Tel-Aviv'], country: 'israel' },
  { clubId: 'maccabi_netanya', english: 'Maccabi Netanya F.C.', aliases: ['Maccabi Netanya', 'Maccabi Nethanya'], country: 'israel' },
  { clubId: 'hapoel_jerusalem_fc', english: 'Hapoel Jerusalem F.C.', aliases: ['Hapoel Jerusalem'], country: 'israel' },
  { clubId: 'bnei_sakhnin', english: 'Bnei Sakhnin F.C.', aliases: ['Bnei Sakhnin', 'Bnei Sachnin'], country: 'israel' },
  { clubId: 'hapoel_haifa', english: 'Hapoel Haifa F.C.', aliases: ['Hapoel Haifa'], country: 'israel' },
  { clubId: 'ironi_kiryat_shmona', english: 'Hapoel Ironi Kiryat Shmona F.C.', aliases: ['Ironi Kiryat Shmona', 'Hapoel Kiryat Shmona'], country: 'israel' },
  { clubId: 'maccabi_petah_tikva', english: 'Maccabi Petah Tikva F.C.', aliases: ['Maccabi Petah Tikva', 'Maccabi Petach Tikva', 'Maccabi Petah Tiqwa'], country: 'israel' },
  { clubId: 'ironi_tiberias', english: 'Ironi Tiberias F.C.', aliases: ['Ironi Tiberias', 'Ironi Tveria'], country: 'israel' },
  { clubId: 'hapoel_ramat_gan', english: 'Hapoel Ramat Gan Givatayim F.C.', aliases: ['Hapoel Ramat Gan', 'Hapoel Ramat-Gan'], country: 'israel' },
  { clubId: 'hapoel_petah_tikva', english: 'Hapoel Petah Tikva F.C.', aliases: ['Hapoel Petah Tikva', 'Hapoel Petach Tikva', 'Hapoel Petah Tiqwa'], country: 'israel' },
  { clubId: 'hapoel_kfar_saba', english: 'Hapoel Kfar Saba F.C.', aliases: ['Hapoel Kfar Saba', 'Hapoel Kfar-Saba', 'Hapoel Kfar Sava'], country: 'israel' },
  { clubId: 'maccabi_herzliya', english: 'Maccabi Herzliya F.C.', aliases: ['Maccabi Herzliya', 'Maccabi Hertzliya'], country: 'israel' },
  { clubId: 'hapoel_rishon', english: 'Hapoel Rishon LeZion F.C.', aliases: ['Hapoel Rishon LeZion', 'Hapoel Rishon Lezion'], country: 'israel' },
  { clubId: 'bnei_yehuda', english: 'Bnei Yehuda Tel Aviv F.C.', aliases: ['Bnei Yehuda', 'Bnei Yehuda Tel Aviv'], country: 'israel' },
  { clubId: 'ms_ashdod', english: 'F.C. Ashdod', aliases: ['FC Ashdod', 'Moadon Sport Ashdod'], country: 'israel' },
  { clubId: 'maccabi_bnei_raina', english: 'Maccabi Bnei Reineh F.C.', aliases: ['Maccabi Bnei Reineh', 'Maccabi Bnei Raina'], country: 'israel' },
  { clubId: 'hapoel_afula', english: 'Hapoel Afula F.C.', aliases: ['Hapoel Afula'], country: 'israel' },
  { clubId: 'hapoel_acre', english: 'Hapoel Acre F.C.', aliases: ['Hapoel Acre', 'Hapoel Akko'], country: 'israel' },
  { clubId: 'maccabi_kabilio_jaffa', english: 'Maccabi Kabilio Jaffa F.C.', aliases: ['Maccabi Jaffa', 'Maccabi Kabilio Jaffa', 'Maccabi Yafo'], country: 'israel' },
  { clubId: 'ms_kafr_qasim', english: 'F.C. Kafr Qasim', aliases: ['Kafr Qasim', 'Maccabi Kafr Qasim'], country: 'israel' },
  { clubId: 'hapoel_raanana', english: "Hapoel Ra'anana A.F.C.", aliases: ["Hapoel Ra'anana", 'Hapoel Raanana'], country: 'israel' },
  { clubId: 'hapoel_kfar_shalem', english: 'Hapoel Kfar Shalem F.C.', aliases: ['Hapoel Kfar Shalem'], country: 'israel' },
  { clubId: 'ironi_modiin', english: "Hapoel Ironi Modi'in F.C.", aliases: ["Ironi Modi'in", 'Ironi Modiin'], country: 'israel' },
  { clubId: 'maccabi_ahi_nazareth', english: 'Maccabi Ahi Nazareth F.C.', aliases: ['Maccabi Akhi Nazareth', 'Ahi Nazareth'], country: 'israel' },
  { clubId: 'maccabi_kiryat_gat', english: 'Maccabi Kiryat Gat F.C.', aliases: ['Maccabi Kiryat Gat'], country: 'israel' },
  { clubId: 'ms_kiryat_yam', english: 'F.C. Kiryat Yam', aliases: ['Kiryat Yam', 'Hapoel Kiryat Yam'], country: 'israel' },

  /* ---------------- Italy ---------------- */
  {
    // Search finds two verifiable "Inter Milan" entities; reviewed 2026-08-29, Q631 is the
    // men's club (the other is the women's section, itself a football club in Italy).
    clubId: 'inter_milan', english: 'Inter Milan', aliases: ['FC Internazionale Milano', 'Internazionale', 'Inter'], country: 'italy', wikidata: 'Q631',
  },
  { clubId: 'ac_milan', english: 'AC Milan', aliases: ['Milan', 'Associazione Calcio Milan'], country: 'italy' },
  { clubId: 'juventus', english: 'Juventus FC', aliases: ['Juventus'], country: 'italy' },
  { clubId: 'atalanta', english: 'Atalanta BC', aliases: ['Atalanta'], country: 'italy' },
  { clubId: 'as_roma', english: 'AS Roma', aliases: ['Roma'], country: 'italy' },
  { clubId: 'lazio', english: 'SS Lazio', aliases: ['Lazio'], country: 'italy' },
  { clubId: 'fiorentina', english: 'ACF Fiorentina', aliases: ['Fiorentina'], country: 'italy' },
  { clubId: 'torino', english: 'Torino FC', aliases: ['Torino'], country: 'italy' },
  { clubId: 'como', english: 'Como 1907', aliases: ['Calcio Como', 'Como'], country: 'italy' },
  { clubId: 'udinese', english: 'Udinese Calcio', aliases: ['Udinese'], country: 'italy' },
  { clubId: 'genoa', english: 'Genoa CFC', aliases: ['Genoa'], country: 'italy' },
  { clubId: 'sassuolo', english: 'US Sassuolo Calcio', aliases: ['Sassuolo'], country: 'italy' },
  { clubId: 'parma', english: 'Parma Calcio 1913', aliases: ['Parma'], country: 'italy' },
  { clubId: 'cagliari', english: 'Cagliari Calcio', aliases: ['Cagliari'], country: 'italy' },
  { clubId: 'lecce', english: 'US Lecce', aliases: ['Lecce'], country: 'italy' },
  { clubId: 'hellas_verona', english: 'Hellas Verona FC', aliases: ['Hellas Verona', 'Verona'], country: 'italy' },
  { clubId: 'cremonese', english: 'US Cremonese', aliases: ['Cremonese'], country: 'italy' },
  { clubId: 'pisa', english: 'Pisa SC', aliases: ['AC Pisa 1909', 'Pisa'], country: 'italy' },
  { clubId: 'napoli', english: 'SSC Napoli', aliases: ['Napoli'], country: 'italy' },
  { clubId: 'bologna', english: 'Bologna FC 1909', aliases: ['Bologna'], country: 'italy' },

  /* ---------------- Spain ---------------- */
  { clubId: 'real_madrid', english: 'Real Madrid CF', aliases: ['Real Madrid'], country: 'spain' },
  { clubId: 'barcelona', english: 'FC Barcelona', aliases: ['Barcelona'], country: 'spain' },
  { clubId: 'sevilla', english: 'Sevilla FC', aliases: ['Sevilla'], country: 'spain' },
  { clubId: 'real_sociedad', english: 'Real Sociedad', country: 'spain' },
  { clubId: 'athletic_bilbao', english: 'Athletic Bilbao', aliases: ['Athletic Club'], country: 'spain', wikidata: 'Q8687' /* reviewed 2026-08-29: men's club; search also surfaced Athletic Bilbao B */ },
  { clubId: 'villarreal', english: 'Villarreal CF', aliases: ['Villarreal'], country: 'spain' },
  { clubId: 'real_betis', english: 'Real Betis', aliases: ['Real Betis Balompié'], country: 'spain' },
  { clubId: 'valencia', english: 'Valencia CF', aliases: ['Valencia'], country: 'spain' },
  { clubId: 'celta_vigo', english: 'RC Celta de Vigo', aliases: ['Celta Vigo', 'Celta de Vigo'], country: 'spain' },
  { clubId: 'girona', english: 'Girona FC', aliases: ['Girona'], country: 'spain' },
  { clubId: 'rayo_vallecano', english: 'Rayo Vallecano', country: 'spain' },
  { clubId: 'osasuna', english: 'CA Osasuna', aliases: ['Osasuna'], country: 'spain' },
  { clubId: 'mallorca', english: 'RCD Mallorca', aliases: ['Mallorca'], country: 'spain' },
  { clubId: 'espanyol', english: 'RCD Espanyol', aliases: ['Espanyol'], country: 'spain' },
  { clubId: 'alaves', english: 'Deportivo Alavés', aliases: ['Alaves', 'Alavés'], country: 'spain' },
  { clubId: 'elche', english: 'Elche CF', aliases: ['Elche'], country: 'spain' },
  { clubId: 'levante', english: 'Levante UD', aliases: ['Levante'], country: 'spain' },
  { clubId: 'real_oviedo', english: 'Real Oviedo', country: 'spain' },
  { clubId: 'atletico', english: 'Atlético Madrid', aliases: ['Atletico Madrid', 'Club Atlético de Madrid'], country: 'spain' },
  { clubId: 'getafe', english: 'Getafe CF', aliases: ['Getafe'], country: 'spain' },

  /* ---------------- England ---------------- */
  { clubId: 'man_city', english: 'Manchester City FC', aliases: ['Manchester City'], country: 'england' },
  { clubId: 'liverpool', english: 'Liverpool FC', aliases: ['Liverpool F.C.'], country: 'england' },
  { clubId: 'arsenal', english: 'Arsenal FC', aliases: ['Arsenal'], country: 'england' },
  { clubId: 'chelsea', english: 'Chelsea FC', aliases: ['Chelsea'], country: 'england' },
  { clubId: 'man_united', english: 'Manchester United FC', aliases: ['Manchester United'], country: 'england' },
  { clubId: 'aston_villa', english: 'Aston Villa FC', aliases: ['Aston Villa'], country: 'england' },
  { clubId: 'newcastle', english: 'Newcastle United FC', aliases: ['Newcastle United'], country: 'england' },
  { clubId: 'crystal_palace', english: 'Crystal Palace FC', aliases: ['Crystal Palace'], country: 'england' },
  { clubId: 'west_ham', english: 'West Ham United FC', aliases: ['West Ham United', 'West Ham'], country: 'england' },
  { clubId: 'nottingham_forest', english: 'Nottingham Forest FC', aliases: ['Nottingham Forest'], country: 'england' },
  { clubId: 'bournemouth', english: 'AFC Bournemouth', aliases: ['Bournemouth'], country: 'england' },
  { clubId: 'fulham', english: 'Fulham FC', aliases: ['Fulham'], country: 'england' },
  { clubId: 'brentford', english: 'Brentford FC', aliases: ['Brentford'], country: 'england' },
  { clubId: 'everton', english: 'Everton FC', aliases: ['Everton'], country: 'england' },
  { clubId: 'wolves', english: 'Wolverhampton Wanderers FC', aliases: ['Wolverhampton Wanderers', 'Wolves'], country: 'england' },
  { clubId: 'leeds', english: 'Leeds United FC', aliases: ['Leeds United'], country: 'england' },
  { clubId: 'sunderland', english: 'Sunderland AFC', aliases: ['Sunderland'], country: 'england' },
  { clubId: 'burnley', english: 'Burnley FC', aliases: ['Burnley'], country: 'england' },
  { clubId: 'tottenham', english: 'Tottenham Hotspur FC', aliases: ['Tottenham Hotspur', 'Spurs'], country: 'england' },
  { clubId: 'brighton', english: 'Brighton & Hove Albion FC', aliases: ['Brighton and Hove Albion', 'Brighton'], country: 'england' },

  /* ---------------- Germany ---------------- */
  { clubId: 'bayern_munich', english: 'FC Bayern Munich', aliases: ['Bayern Munich', 'Bayern München'], country: 'germany' },
  { clubId: 'leverkusen', english: 'Bayer 04 Leverkusen', aliases: ['Bayer Leverkusen'], country: 'germany' },
  /*
   * rb_leipzig and porto: reviewed 2026-08-29 and deliberately NOT resolved. Both searches were
   * ambiguous, and on inspection the men's-club entities carry unusable P154 data - Leipzig's
   * "logo" is a match photograph, Porto's a derived JPG crop. Image safety (no photos, no
   * low-quality raster logo crops) rules both out regardless of licence, so they keep the
   * generated badge and stay listed under known-missing.
   */
  { clubId: 'rb_leipzig', english: 'RB Leipzig', country: 'germany' },
  { clubId: 'stuttgart', english: 'VfB Stuttgart', country: 'germany' },
  { clubId: 'eintracht_frankfurt', english: 'Eintracht Frankfurt', country: 'germany' },
  { clubId: 'freiburg', english: 'SC Freiburg', country: 'germany' },
  { clubId: 'mainz', english: '1. FSV Mainz 05', aliases: ['Mainz 05'], country: 'germany' },
  { clubId: 'gladbach', english: 'Borussia Mönchengladbach', aliases: ['Borussia Monchengladbach', 'Gladbach'], country: 'germany', wikidata: 'Q101959' /* reviewed 2026-08-29: men's club; search also surfaced the women's team */ },
  { clubId: 'union_berlin', english: '1. FC Union Berlin', aliases: ['Union Berlin'], country: 'germany' },
  { clubId: 'wolfsburg', english: 'VfL Wolfsburg', country: 'germany', wikidata: 'Q101859' /* reviewed 2026-08-29: football club; search also surfaced the parent sports club */ },
  { clubId: 'hoffenheim', english: 'TSG 1899 Hoffenheim', aliases: ['TSG Hoffenheim', 'Hoffenheim'], country: 'germany' },
  { clubId: 'hamburg', english: 'Hamburger SV', aliases: ['Hamburg', 'HSV'], country: 'germany' },
  { clubId: 'augsburg', english: 'FC Augsburg', country: 'germany' },
  { clubId: 'koln', english: '1. FC Köln', aliases: ['1. FC Koln', 'FC Cologne'], country: 'germany' },
  { clubId: 'st_pauli', english: 'FC St. Pauli', aliases: ['St. Pauli'], country: 'germany' },
  { clubId: 'heidenheim', english: '1. FC Heidenheim', aliases: ['Heidenheim'], country: 'germany' },
  { clubId: 'dortmund', english: 'Borussia Dortmund', country: 'germany', wikidata: 'Q41420' /* reviewed 2026-08-29: the club; search also surfaced the women's team */ },
  { clubId: 'werder_bremen', english: 'SV Werder Bremen', aliases: ['Werder Bremen'], country: 'germany' },

  /* ---------------- Netherlands ---------------- */
  { clubId: 'ajax', english: 'AFC Ajax', aliases: ['Ajax', 'Ajax Amsterdam'], country: 'netherlands' },
  { clubId: 'psv', english: 'PSV Eindhoven', aliases: ['PSV'], country: 'netherlands' },
  { clubId: 'feyenoord', english: 'Feyenoord', aliases: ['Feyenoord Rotterdam'], country: 'netherlands' },
  { clubId: 'twente', english: 'FC Twente', country: 'netherlands' },
  { clubId: 'fc_utrecht', english: 'FC Utrecht', country: 'netherlands' },
  { clubId: 'nec_nijmegen', english: 'NEC Nijmegen', aliases: ['N.E.C.'], country: 'netherlands' },
  { clubId: 'sparta_rotterdam', english: 'Sparta Rotterdam', country: 'netherlands' },
  { clubId: 'fc_groningen', english: 'FC Groningen', country: 'netherlands' },
  { clubId: 'heerenveen', english: 'SC Heerenveen', country: 'netherlands' },
  { clubId: 'go_ahead_eagles', english: 'Go Ahead Eagles', country: 'netherlands' },
  { clubId: 'fortuna_sittard', english: 'Fortuna Sittard', country: 'netherlands', wikidata: 'Q854167' /* reviewed 2026-08-29: men's club; search also surfaced Fortuna Sittard Vrouwen */ },
  { clubId: 'nac_breda', english: 'NAC Breda', country: 'netherlands' },
  { clubId: 'pec_zwolle', english: 'PEC Zwolle', country: 'netherlands' },
  { clubId: 'heracles', english: 'Heracles Almelo', country: 'netherlands' },
  { clubId: 'excelsior', english: 'Excelsior Rotterdam', aliases: ['SBV Excelsior'], country: 'netherlands' },
  { clubId: 'volendam', english: 'FC Volendam', country: 'netherlands' },
  { clubId: 'telstar', english: 'SC Telstar', aliases: ['Telstar'], country: 'netherlands' },
  { clubId: 'az_alkmaar', english: 'AZ Alkmaar', aliases: ['AZ'], country: 'netherlands' },

  /* ---------------- Belgium ---------------- */
  { clubId: 'club_brugge', english: 'Club Brugge KV', aliases: ['Club Brugge', 'Club Bruges'], country: 'belgium' },
  { clubId: 'anderlecht', english: 'RSC Anderlecht', aliases: ['Anderlecht'], country: 'belgium' },
  { clubId: 'genk', english: 'KRC Genk', aliases: ['Racing Genk', 'Genk'], country: 'belgium' },
  { clubId: 'gent', english: 'KAA Gent', aliases: ['Gent', 'Ghent'], country: 'belgium' },
  { clubId: 'antwerp', english: 'Royal Antwerp FC', aliases: ['Royal Antwerp', 'Antwerp'], country: 'belgium' },
  { clubId: 'standard_liege', english: 'Standard Liège', aliases: ['Standard Liege'], country: 'belgium' },
  { clubId: 'charleroi', english: 'R. Charleroi SC', aliases: ['Sporting Charleroi', 'Charleroi'], country: 'belgium' },
  { clubId: 'kv_mechelen', english: 'KV Mechelen', aliases: ['Mechelen'], country: 'belgium' },
  { clubId: 'cercle_brugge', english: 'Cercle Brugge KSV', aliases: ['Cercle Brugge'], country: 'belgium' },
  { clubId: 'westerlo', english: 'KVC Westerlo', aliases: ['Westerlo'], country: 'belgium' },
  { clubId: 'oh_leuven', english: 'Oud-Heverlee Leuven', aliases: ['OH Leuven'], country: 'belgium' },
  { clubId: 'sint_truiden', english: 'Sint-Truidense VV', aliases: ['Sint-Truiden', 'STVV'], country: 'belgium' },
  { clubId: 'zulte_waregem', english: 'SV Zulte Waregem', aliases: ['Zulte Waregem'], country: 'belgium' },
  { clubId: 'dender', english: 'FCV Dender EH', aliases: ['Dender'], country: 'belgium' },
  { clubId: 'la_louviere', english: 'RAAL La Louvière', aliases: ['RAAL La Louviere', 'La Louviere'], country: 'belgium' },
  { clubId: 'union_sg', english: 'Union Saint-Gilloise', aliases: ['Royale Union Saint-Gilloise', 'Union SG'], country: 'belgium' },

  /* ---------------- Austria ---------------- */
  { clubId: 'rb_salzburg', english: 'FC Red Bull Salzburg', aliases: ['Red Bull Salzburg', 'RB Salzburg'], country: 'austria' },
  { clubId: 'rapid_wien', english: 'SK Rapid Wien', aliases: ['Rapid Vienna', 'Rapid Wien'], country: 'austria' },
  { clubId: 'lask', english: 'LASK', aliases: ['LASK Linz'], country: 'austria' },
  { clubId: 'austria_wien', english: 'FK Austria Wien', aliases: ['Austria Vienna', 'Austria Wien'], country: 'austria' },
  { clubId: 'wolfsberger', english: 'Wolfsberger AC', country: 'austria' },
  { clubId: 'hartberg', english: 'TSV Hartberg', country: 'austria' },
  { clubId: 'wsg_tirol', english: 'WSG Tirol', country: 'austria' },
  { clubId: 'grazer_ak', english: 'Grazer AK', country: 'austria' },
  { clubId: 'blau_weiss_linz', english: 'FC Blau-Weiß Linz', aliases: ['Blau-Weiss Linz'], country: 'austria' },
  { clubId: 'altach', english: 'SCR Altach', aliases: ['SC Rheindorf Altach'], country: 'austria' },
  { clubId: 'sv_ried', english: 'SV Ried', country: 'austria' },
  { clubId: 'sturm_graz', english: 'SK Sturm Graz', aliases: ['Sturm Graz'], country: 'austria', wikidata: 'Q124007617' /* reviewed 2026-08-29: men's club; search also surfaced SK Sturm Graz Women */ },

  /* ---------------- Greece ---------------- */
  { clubId: 'olympiacos', english: 'Olympiacos FC', aliases: ['Olympiacos', 'Olympiakos'], country: 'greece' },
  { clubId: 'panathinaikos', english: 'Panathinaikos FC', aliases: ['Panathinaikos'], country: 'greece' },
  { clubId: 'aek_athens', english: 'AEK Athens FC', aliases: ['AEK Athens'], country: 'greece' },
  { clubId: 'aris_thessaloniki', english: 'Aris Thessaloniki FC', aliases: ['Aris Thessaloniki', 'Aris'], country: 'greece' },
  { clubId: 'ofi_crete', english: 'OFI Crete FC', aliases: ['OFI Crete', 'OFI'], country: 'greece' },
  { clubId: 'volos', english: 'Volos FC', aliases: ['Volos NFC'], country: 'greece' },
  { clubId: 'atromitos', english: 'Atromitos FC', aliases: ['Atromitos'], country: 'greece' },
  { clubId: 'asteras_tripolis', english: 'Asteras Tripolis FC', aliases: ['Asteras Tripolis'], country: 'greece' },
  { clubId: 'panetolikos', english: 'Panetolikos FC', aliases: ['Panetolikos'], country: 'greece' },
  { clubId: 'panserraikos', english: 'Panserraikos FC', aliases: ['Panserraikos'], country: 'greece' },
  { clubId: 'levadiakos', english: 'Levadiakos FC', aliases: ['Levadiakos'], country: 'greece' },
  { clubId: 'kifisia', english: 'Kifisia FC', aliases: ['AE Kifisia'], country: 'greece' },
  { clubId: 'larissa', english: 'AEL Larissa', aliases: ['Athlitiki Enosi Larissa'], country: 'greece' },
  { clubId: 'paok', english: 'PAOK FC', aliases: ['PAOK Thessaloniki', 'PAOK'], country: 'greece' },

  /* ---------------- Cyprus ---------------- */
  { clubId: 'pafos_fc', english: 'Pafos FC', country: 'cyprus' },
  { clubId: 'apoel', english: 'APOEL FC', aliases: ['APOEL Nicosia', 'APOEL'], country: 'cyprus' },
  { clubId: 'aek_larnaca', english: 'AEK Larnaca FC', aliases: ['AEK Larnaca'], country: 'cyprus' },
  { clubId: 'omonia_nicosia', english: 'AC Omonia', aliases: ['Omonia Nicosia', 'Omonoia'], country: 'cyprus' },
  { clubId: 'apollon_limassol', english: 'Apollon Limassol', country: 'cyprus' },
  { clubId: 'aris_limassol', english: 'Aris Limassol', country: 'cyprus', wikidata: 'Q367788' /* reviewed 2026-08-29: the football club; search also surfaced the multi-sport club */ },
  { clubId: 'ael_limassol', english: 'AEL Limassol', country: 'cyprus' },
  { clubId: 'anorthosis', english: 'Anorthosis Famagusta FC', aliases: ['Anorthosis Famagusta', 'Anorthosis'], country: 'cyprus' },
  { clubId: 'nea_salamina', english: 'Nea Salamis Famagusta FC', aliases: ['Nea Salamina'], country: 'cyprus' },
  { clubId: 'ethnikos_achna', english: 'Ethnikos Achna FC', aliases: ['Ethnikos Achna'], country: 'cyprus' },
  { clubId: 'doxa_katokopias', english: 'Doxa Katokopias FC', aliases: ['Doxa Katokopias'], country: 'cyprus' },
  { clubId: 'omonia_aradippou', english: 'Omonia Aradippou', country: 'cyprus' },

  /* ---------------- Portugal ---------------- */
  { clubId: 'porto', english: 'FC Porto', aliases: ['Porto'], country: 'portugal' },
  { clubId: 'sporting_cp', english: 'Sporting CP', aliases: ['Sporting Lisbon', 'Sporting Clube de Portugal'], country: 'portugal' },
  { clubId: 'braga', english: 'SC Braga', aliases: ['Sporting Braga', 'Braga'], country: 'portugal' },
  { clubId: 'vitoria_guimaraes', english: 'Vitória SC', aliases: ['Vitoria de Guimaraes', 'Vitória de Guimarães'], country: 'portugal' },
  { clubId: 'famalicao', english: 'FC Famalicão', aliases: ['Famalicao'], country: 'portugal' },
  { clubId: 'gil_vicente', english: 'Gil Vicente FC', aliases: ['Gil Vicente'], country: 'portugal' },
  { clubId: 'estoril', english: 'GD Estoril Praia', aliases: ['Estoril Praia', 'Estoril'], country: 'portugal' },
  { clubId: 'santa_clara', english: 'CD Santa Clara', aliases: ['Santa Clara'], country: 'portugal' },
  { clubId: 'arouca', english: 'FC Arouca', aliases: ['Arouca'], country: 'portugal' },
  { clubId: 'moreirense', english: 'Moreirense FC', aliases: ['Moreirense'], country: 'portugal' },
  { clubId: 'casa_pia', english: 'Casa Pia AC', aliases: ['Casa Pia'], country: 'portugal' },
  { clubId: 'rio_ave', english: 'Rio Ave FC', aliases: ['Rio Ave'], country: 'portugal' },
  { clubId: 'nacional', english: 'CD Nacional', aliases: ['Nacional da Madeira'], country: 'portugal', wikidata: 'Q216459' /* reviewed 2026-08-29: the football club; search also surfaced the sports club */ },
  { clubId: 'estrela_amadora', english: 'CF Estrela da Amadora', aliases: ['Estrela da Amadora'], country: 'portugal' },
  { clubId: 'avs', english: 'AVS Futebol SAD', aliases: ['AVS'], country: 'portugal' },
  { clubId: 'tondela', english: 'CD Tondela', aliases: ['Tondela'], country: 'portugal' },
  { clubId: 'alverca', english: 'FC Alverca', aliases: ['Alverca'], country: 'portugal' },
  { clubId: 'benfica', english: 'SL Benfica', aliases: ['Benfica'], country: 'portugal' },

  /* ------- v0.6.4: clubs the 2026/27 snapshot promoted into a modelled division ------- */
  { clubId: 'monza', english: 'AC Monza', aliases: ['Monza'], country: 'italy' },
  { clubId: 'venezia', english: 'Venezia FC', aliases: ['Venezia'], country: 'italy' },
  { clubId: 'frosinone', english: 'Frosinone Calcio', aliases: ['Frosinone'], country: 'italy' },
  { clubId: 'coventry_city', english: 'Coventry City F.C.', aliases: ['Coventry City'], country: 'england' },
  { clubId: 'hull_city', english: 'Hull City A.F.C.', aliases: ['Hull City'], country: 'england' },
  { clubId: 'ipswich_town', english: 'Ipswich Town F.C.', aliases: ['Ipswich Town'], country: 'england' },
  { clubId: 'malaga', english: 'Malaga CF', aliases: ['Malaga', 'Málaga CF'], country: 'spain' },
  { clubId: 'deportivo_la_coruna', english: 'Deportivo de La Coruna', aliases: ['Deportivo La Coruna', 'Deportivo'], country: 'spain' },
  { clubId: 'racing_santander', english: 'Racing de Santander', aliases: ['Racing Santander'], country: 'spain' },
  { clubId: 'schalke', english: 'FC Schalke 04', aliases: ['Schalke 04', 'Schalke'], country: 'germany' },
  { clubId: 'sc_paderborn', english: 'SC Paderborn 07', aliases: ['SC Paderborn', 'Paderborn'], country: 'germany' },
  { clubId: 'elversberg', english: 'SV 07 Elversberg', aliases: ['SV Elversberg', 'Elversberg'], country: 'germany' },
  { clubId: 'ado_den_haag', english: 'ADO Den Haag', aliases: ['Den Haag'], country: 'netherlands' },
  { clubId: 'cambuur', english: 'SC Cambuur', aliases: ['Cambuur'], country: 'netherlands' },
  { clubId: 'willem_ii', english: 'Willem II', aliases: ['Willem II Tilburg'], country: 'netherlands' },
  { clubId: 'kortrijk', english: 'K.V. Kortrijk', aliases: ['KV Kortrijk', 'Kortrijk'], country: 'belgium' },
  { clubId: 'beveren', english: 'S.K. Beveren', aliases: ['SK Beveren', 'Waasland-Beveren', 'Beveren'], country: 'belgium' },
  { clubId: 'lommel', english: 'Lommel S.K.', aliases: ['Lommel SK', 'Lommel'], country: 'belgium' },
  { clubId: 'maritimo', english: 'C.S. Maritimo', aliases: ['Maritimo', 'CS Maritimo'], country: 'portugal' },
  { clubId: 'academico_viseu', english: 'Academico de Viseu F.C.', aliases: ['Academico de Viseu', 'Academico Viseu'], country: 'portugal' },
  { clubId: 'austria_lustenau', english: 'SC Austria Lustenau', aliases: ['Austria Lustenau'], country: 'austria' },
  { clubId: 'iraklis', english: 'Iraklis F.C.', aliases: ['Iraklis Thessaloniki', 'Iraklis'], country: 'greece' },
  { clubId: 'kalamata', english: 'Kalamata F.C.', aliases: ['PS Kalamata', 'Kalamata'], country: 'greece' },
  { clubId: 'karmiotissa', english: 'Karmiotissa FC', aliases: ['Karmiotissa Polemidion', 'Karmiotissa'], country: 'cyprus' },
  { clubId: 'krasava_eny', english: 'Krasava ENY Ypsonas', aliases: ['Krasava', 'ENY Ypsonas'], country: 'cyprus' },
  { clubId: 'omonia_29m', english: 'Omonia 29M', aliases: ['Omonoia 29 Maiou', 'Omonia 29 Maiou'], country: 'cyprus' },
  { clubId: 'olympiakos_nicosia', english: 'Olympiakos Nicosia', aliases: ['Olympiakos Nicosia FC'], country: 'cyprus' },
];

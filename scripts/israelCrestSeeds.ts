/**
 * Israeli crest seeds (v0.6.5, Checkpoint E).
 *
 * One entry per ACTIVE Israeli club - every club in ליגת העל, הליגה הלאומית and both Liga Alef
 * districts. The hard rule this release enforces is that every one of them resolves a real
 * crest, so unlike the European seeds there is no "attempt if listed" semantics: this list IS
 * the checklist, and `tests/israelCrests.test.ts` fails while any club on it lacks one.
 *
 * `english` and `aliases` drive TheSportsDB search (which speaks English and mixes sports -
 * the importer accepts only strSport === 'Soccer' with country Israel and a verified name
 * match). `hebrew` aliases drive the Hebrew-Wikipedia fallback, where most lower-league clubs
 * actually live. Transliteration variants matter: Petah/Petach, Kiryat/Qiryat, Kfar Saba/Kfar
 * Sava, Acre/Akko.
 */

export interface IsraelCrestSeed {
  clubId: string;
  /** Primary English search name for TheSportsDB. */
  english: string;
  aliases?: string[];
  /** Hebrew article-name candidates for the Wikipedia fallback, most specific first. */
  hebrew: string[];
}

export const ISRAEL_CREST_SEEDS: readonly IsraelCrestSeed[] = [
  /* ---------------- ליגת העל ---------------- */
  { clubId: 'maccabi_haifa', english: 'Maccabi Haifa', aliases: ['Maccabi Haifa FC'], hebrew: ['מכבי חיפה (כדורגל)'] },
  { clubId: 'maccabi_tel_aviv', english: 'Maccabi Tel Aviv', aliases: ['Maccabi Tel-Aviv'], hebrew: ['מכבי תל אביב (כדורגל)'] },
  { clubId: 'hapoel_beer_sheva', english: "Hapoel Be'er Sheva", aliases: ['Hapoel Beer Sheva', 'Hapoel Beersheba'], hebrew: ['הפועל באר שבע (כדורגל)'] },
  { clubId: 'beitar_jerusalem', english: 'Beitar Jerusalem', hebrew: ['בית"ר ירושלים (כדורגל)', 'בית"ר ירושלים'] },
  { clubId: 'hapoel_tel_aviv', english: 'Hapoel Tel Aviv', aliases: ['Hapoel Tel-Aviv'], hebrew: ['הפועל תל אביב (כדורגל)'] },
  { clubId: 'maccabi_netanya', english: 'Maccabi Netanya', hebrew: ['מכבי נתניה'] },
  { clubId: 'hapoel_jerusalem_fc', english: 'Hapoel Jerusalem FC', aliases: ['Hapoel Jerusalem'], hebrew: ['הפועל ירושלים (כדורגל)'] },
  { clubId: 'bnei_sakhnin', english: 'Bnei Sakhnin', aliases: ['Bnei Sachnin', 'Hapoel Bnei Sakhnin'], hebrew: ['הפועל בני סכנין', 'בני סכנין'] },
  { clubId: 'hapoel_haifa', english: 'Hapoel Haifa', hebrew: ['הפועל חיפה (כדורגל)'] },
  { clubId: 'ironi_kiryat_shmona', english: 'Hapoel Ironi Kiryat Shmona', aliases: ['Ironi Kiryat Shmona', 'Kiryat Shmona'], hebrew: ['הפועל עירוני קריית שמונה'] },
  { clubId: 'maccabi_petah_tikva', english: 'Maccabi Petah Tikva', aliases: ['Maccabi Petach Tikva', 'Maccabi Petah Tiqwa'], hebrew: ['מכבי פתח תקווה'] },
  { clubId: 'ironi_tiberias', english: 'Ironi Tiberias', aliases: ['Ironi Tveria'], hebrew: ['עירוני טבריה'] },
  { clubId: 'hapoel_ramat_gan', english: 'Hapoel Ramat Gan', aliases: ['Hapoel Ramat Gan Givatayim', 'Hapoel Ramat-Gan'], hebrew: ['הפועל רמת גן גבעתיים', 'הפועל רמת גן'] },
  { clubId: 'hapoel_petah_tikva', english: 'Hapoel Petah Tikva', aliases: ['Hapoel Petach Tikva', 'Hapoel Petah Tiqwa'], hebrew: ['הפועל פתח תקווה'] },

  /* ---------------- הליגה הלאומית ---------------- */
  { clubId: 'hapoel_kfar_saba', english: 'Hapoel Kfar Saba', aliases: ['Hapoel Kfar-Saba', 'Hapoel Kfar Sava'], hebrew: ['הפועל כפר סבא'] },
  { clubId: 'maccabi_herzliya', english: 'Maccabi Herzliya', aliases: ['Maccabi Hertzliya'], hebrew: ['מכבי הרצליה'] },
  { clubId: 'hapoel_rishon', english: 'Hapoel Rishon LeZion', aliases: ['Hapoel Rishon Lezion'], hebrew: ['הפועל ראשון לציון'] },
  { clubId: 'bnei_yehuda', english: 'Bnei Yehuda Tel Aviv', aliases: ['Bnei Yehuda'], hebrew: ['בני יהודה תל אביב'] },
  { clubId: 'ms_ashdod', english: 'FC Ashdod', aliases: ['F.C. Ashdod', 'Moadon Sport Ashdod'], hebrew: ['מועדון ספורט אשדוד', 'מ.ס. אשדוד'] },
  { clubId: 'maccabi_bnei_raina', english: 'Maccabi Bnei Reineh', aliases: ['Maccabi Bnei Raina'], hebrew: ['מכבי בני ריינה'] },
  { clubId: 'hapoel_afula', english: 'Hapoel Afula', hebrew: ['הפועל עפולה'] },
  { clubId: 'hapoel_acre', english: 'Hapoel Acre', aliases: ['Hapoel Akko'], hebrew: ['הפועל עכו'] },
  { clubId: 'maccabi_kabilio_jaffa', english: 'Maccabi Kabilio Jaffa', aliases: ['Maccabi Jaffa', 'Maccabi Yafo'], hebrew: ['מכבי קביליו יפו', 'מכבי יפו'] },
  { clubId: 'ms_kafr_qasim', english: 'FC Kafr Qasim', aliases: ['Kafr Qasim', 'F.C. Kafr Qasim'], hebrew: ['מ.ס. כפר קאסם'] },
  { clubId: 'hapoel_raanana', english: "Hapoel Ra'anana", aliases: ['Hapoel Raanana'], hebrew: ['הפועל רעננה'] },
  { clubId: 'hapoel_kfar_shalem', english: 'Hapoel Kfar Shalem', hebrew: ['הפועל כפר שלם'] },
  { clubId: 'ironi_modiin', english: "Hapoel Ironi Modi'in", aliases: ["Ironi Modi'in", 'Ironi Modiin'], hebrew: ['עירוני מודיעין', 'הפועל עירוני מודיעין'] },
  { clubId: 'maccabi_ahi_nazareth', english: 'Maccabi Ahi Nazareth', aliases: ['Maccabi Akhi Nazareth', 'Ahi Nazareth'], hebrew: ['מכבי אחי נצרת'] },
  { clubId: 'maccabi_kiryat_gat', english: 'Maccabi Kiryat Gat', aliases: ['Maccabi Qiryat Gat'], hebrew: ['מכבי קריית גת', 'מכבי עירוני קריית גת'] },
  { clubId: 'ms_kiryat_yam', english: 'FC Kiryat Yam', aliases: ['Kiryat Yam', 'Hapoel Kiryat Yam'], hebrew: ['מ.ס. קריית ים'] },

  /* ---------------- ליגה א׳ צפון ---------------- */
  { clubId: 'hapoel_nof_hagalil', english: 'Hapoel Nof HaGalil', aliases: ['Hapoel Nazareth Illit'], hebrew: ['הפועל נוף הגליל'] },
  { clubId: 'ms_tira', english: 'Maccabi Tira', aliases: ['MS Tira', 'F.C. Tira'], hebrew: ['מ.ס. טירה'] },
  { clubId: 'maccabi_ata_bialik', english: 'Maccabi Ata Bialik', hebrew: ['מכבי עירוני קריית אתא ביאליק' /* reviewed 2026-08-30: the 2020 merger club, plays Liga Alef */, 'מכבי אתא ביאליק'] },
  { clubId: 'hapoel_karmiel', english: 'Hapoel Ironi Karmiel', aliases: ['Hapoel Karmiel'], hebrew: ['הפועל עירוני כרמיאל', 'הפועל כרמיאל'] },
  { clubId: 'maccabi_neve_shaanan', english: "Maccabi Neve Sha'anan", aliases: ['Maccabi Neve Shaanan'], hebrew: ['מכבי נווה שאנן'] },
  { clubId: 'hapoel_umm_al_fahm', english: 'Hapoel Umm al-Fahm', aliases: ['Hapoel Umm al Fahm'], hebrew: ['הפועל אום אל-פחם'] },
  { clubId: 'hapoel_baqa_al_gharbiyye', english: 'Hapoel Baqa al-Gharbiyye', aliases: ['Hapoel Baka al-Garbiya'], hebrew: ['הפועל באקה אל-גרבייה' /* reviewed: article intro confirms ליגה א' צפון */, 'הפועל בקה אל-גרביה'] },
  { clubId: 'hapoel_beit_shean', english: "Hapoel Beit She'an", aliases: ['Hapoel Beit Shean'], hebrew: ['הפועל בית שאן'] },
  { clubId: 'tzeirei_umm_al_fahm', english: 'Tzeirei Umm al-Fahm', aliases: ['Maccabi Tzeirei Umm al-Fahm'], hebrew: ['מכבי אום אל-פחם' /* reviewed: article states ידועה גם כצעירי אום אל-פחם, plays ליגה א' צפון */, 'צעירי אום אל-פחם'] },
  { clubId: 'ironi_nesher', english: 'Ironi Nesher', hebrew: ['עירוני נשר', 'מכבי עירוני נשר'] },
  { clubId: 'hapoel_migdal_haemek', english: 'Hapoel Migdal HaEmek', hebrew: ['הפועל מגדל העמק (כדורגל)', 'הפועל מגדל העמק'] },
  { clubId: 'tzeirei_tamra', english: 'Tzeirei Tamra', aliases: ['MK Tzeirei Tamra'], hebrew: ['צעירי טמרה', 'מ.כ. צעירי טמרה'] },
  { clubId: 'hapoel_arraba', english: 'Hapoel Ironi Arraba', aliases: ['Hapoel Arraba'], hebrew: ['הפועל עראבה', 'הפועל עירוני עראבה'] },
  { clubId: 'maccabi_nujeidat', english: 'Maccabi Nujeidat', aliases: ["Maccabi Nujeidat Bu'eine"], hebrew: ['מכבי נוג\'ידאת', 'מכבי נוג׳ידאת בועיינה'] },
  { clubId: 'hapoel_tirat_carmel', english: 'Hapoel Tirat Carmel', aliases: ['Hapoel Tirat HaCarmel'], hebrew: ['הפועל טירת הכרמל', 'הפועל טירת כרמל'] },
  { clubId: 'hapoel_bnei_musmus', english: 'Hapoel Bnei Musmus', aliases: ['Bnei Musmus'], hebrew: ['הפועל בני מוסמוס'] },
  // v0.6.5.1: promoted from Liga Bet as the division expanded to 18.
  { clubId: 'beitar_nahariya', english: 'Beitar Nahariya', aliases: ['Beitar Nahariyya'], hebrew: ['בית"ר נהריה'] },
  {
    clubId: 'hapoel_bnei_jatt',
    english: 'Hapoel Bnei Jatt',
    aliases: ['Hapoel Ihud Bnei Jatt', 'Bnei Jatt'],
    hebrew: ["הפועל איחוד בני ג'ת", "הפועל בני ג'ת"],
  },

  /* ---------------- ליגה א׳ דרום ---------------- */
  { clubId: 'hapoel_hadera', english: 'Hapoel Hadera', hebrew: ['הפועל חדרה'] },
  { clubId: 'mk_jerusalem', english: 'MK Jerusalem', aliases: ['Moadon Kaduregel Jerusalem', 'Jerusalem FC'], hebrew: ['מ.כ. ירושלים'] },
  { clubId: 'ms_dimona', english: 'MS Dimona', aliases: ['Maccabi Dimona', 'Hapoel Dimona'], hebrew: ['מ.ס. דימונה', 'עירוני דימונה'] },
  { clubId: 'maccabi_yavne', english: 'Maccabi Yavne', hebrew: ['מכבי יבנה'] },
  { clubId: 'maccabi_kiryat_malakhi', english: 'Maccabi Kiryat Malakhi', aliases: ['Maccabi Ironi Kiryat Malakhi'], hebrew: ['מכבי קריית מלאכי', 'מכבי עירוני קריית מלאכי'] },
  { clubId: 'hapoel_ramat_hasharon', english: 'Hapoel Ramat HaSharon', aliases: ['Hapoel Nir Ramat HaSharon'], hebrew: ['הפועל ניר רמת השרון', 'הפועל רמת השרון'] },
  { clubId: 'shimshon_tel_aviv', english: 'Shimshon Tel Aviv', aliases: ['Shimshon Tel-Aviv'], hebrew: ['שמשון תל אביב'] },
  { clubId: 'hapoel_marmorek', english: 'Hapoel Marmorek', aliases: ['Hapoel Marmorek Rehovot'], hebrew: ['הפועל מרמורק'] },
  { clubId: 'tzeirei_tira', english: 'Tzeirei Tira', aliases: ['MK Tzeirei Tira'], hebrew: ['צעירי טירה', 'מ.כ. צעירי טירה'] },
  { clubId: 'hapoel_herzliya', english: 'Hapoel Herzliya', aliases: ['Hapoel Hertzliya'], hebrew: ['הפועל הרצליה'] },
  { clubId: 'mk_kfar_saba', english: 'MK Kfar Saba', aliases: ['Moadon Kaduregel Kfar Saba'], hebrew: ['מ.כ. כפר סבא'] },
  { clubId: 'mk_holon_yirmiyahu', english: 'MK Holon Yirmiyahu', aliases: ['MK Holon'], hebrew: ['מ.כ. חולון ירמיהו', 'מ.כ. חולון'] },
  { clubId: 'hapoel_azor', english: 'Hapoel Azor', hebrew: ['הפועל אזור'] },
  { clubId: 'maccabi_ironi_ashdod', english: 'Maccabi Ironi Ashdod', aliases: ['Maccabi Ashdod'], hebrew: ['מכבי עירוני אשדוד', 'מכבי אשדוד'] },
  // v0.6.5.1: promoted from Liga Bet as the division expanded to 18.
  { clubId: 'hapoel_mahane_yehuda', english: 'Hapoel Mahane Yehuda', aliases: ['Hapoel Mahane Yehuda Jerusalem'], hebrew: ['הפועל מחנה יהודה'] },
  { clubId: 'ironi_beit_shemesh', english: 'Ironi Beit Shemesh', aliases: ['Hapoel Beit Shemesh'], hebrew: ['עירוני בית שמש', 'הפועל בית שמש'] },
  { clubId: 'mk_sderot', english: 'MK Sderot', aliases: ['Hapoel Sderot', 'Maccabi Sderot'], hebrew: ['מ.כ. שדרות', 'הפועל שדרות'] },
  { clubId: 'nordia_jerusalem', english: 'AS Nordia Jerusalem', aliases: ['Nordia Jerusalem'], hebrew: ['בית"ר נורדיה ירושלים' /* reviewed: IFA registry name א.ס. נורדיה ירושלים confirmed in article intro */, 'נורדיה ירושלים'] },
];

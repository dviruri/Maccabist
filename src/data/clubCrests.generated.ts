/**
 * GENERATED FILE - written by `scripts/importClubCrests.ts`. Do not edit by hand.
 *
 * The central crest manifest (v0.6.3, C12). One entry per club that has a verified, locally
 * stored crest asset; every other club falls through to the generated badge in ClubCrest. Paths
 * are repo-local under `public/club-crests/` - the runtime never touches an external URL, and
 * `getClubCrest` fails closed on anything that looks like one.
 *
 * Provenance for every entry - provider, source page, licence tag, retrieval date - lives in the
 * sibling `public/club-crests/manifest.json` and is summarised in CLUB_ASSETS.md. An entry only
 * appears here when the importer verified the source file's licence tag against its allow-list
 * (public-domain / CC0 family). Trademark rights are a separate matter from copyright and are
 * documented, not claimed.
 */

export interface CrestManifestEntry {
  /** Repo-local path under public/, e.g. "club-crests/inter_milan.svg". */
  asset: string;
  /** Provider the asset was resolved through. */
  provider: 'wikimedia' | 'thesportsdb' | 'hewiki';
  /** Licence short-name (free-media regime) or a licence-status sentence (referential). */
  license: string;
  /**
   * Which ingestion regime the asset came through (v0.6.5).
   *
   *  - 'free-media': the European pipeline - Commons files whose own licence tag is in the
   *    PD/CC0 family, validated against that allow-list.
   *  - 'referential': the Israeli pipeline - non-free club marks ingested at the project
   *    owner's explicit direction, used to identify clubs the game names as facts, with full
   *    per-asset provenance and never a claim of free licensing. See CLUB_ASSETS.md.
   */
  regime: 'free-media' | 'referential';
}
export const CREST_MANIFEST: Record<string, CrestManifestEntry> = {
  ac_milan: { asset: 'club-crests/ac_milan.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  academico_viseu: { asset: 'club-crests/academico_viseu.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  altach: { asset: 'club-crests/altach.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  apoel: { asset: 'club-crests/apoel.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  atalanta: { asset: 'club-crests/atalanta.png', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  austria_lustenau: { asset: 'club-crests/austria_lustenau.svg', provider: 'wikimedia', license: "CC0", regime: 'free-media' },
  austria_wien: { asset: 'club-crests/austria_wien.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  az_alkmaar: { asset: 'club-crests/az_alkmaar.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  bayern_munich: { asset: 'club-crests/bayern_munich.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  beitar_jerusalem: { asset: 'club-crests/beitar_jerusalem.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  bnei_sakhnin: { asset: 'club-crests/bnei_sakhnin.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  bnei_yehuda: { asset: 'club-crests/bnei_yehuda.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  bologna: { asset: 'club-crests/bologna.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  cercle_brugge: { asset: 'club-crests/cercle_brugge.png', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  como: { asset: 'club-crests/como.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  dortmund: { asset: 'club-crests/dortmund.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  elversberg: { asset: 'club-crests/elversberg.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  estrela_amadora: { asset: 'club-crests/estrela_amadora.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  excelsior: { asset: 'club-crests/excelsior.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  fc_utrecht: { asset: 'club-crests/fc_utrecht.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  fiorentina: { asset: 'club-crests/fiorentina.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  genk: { asset: 'club-crests/genk.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  gladbach: { asset: 'club-crests/gladbach.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  hamburg: { asset: 'club-crests/hamburg.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  hapoel_acre: { asset: 'club-crests/hapoel_acre.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_afula: { asset: 'club-crests/hapoel_afula.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_azor: { asset: 'club-crests/hapoel_azor.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_baqa_al_gharbiyye: { asset: 'club-crests/hapoel_baqa_al_gharbiyye.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_beer_sheva: { asset: 'club-crests/hapoel_beer_sheva.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_beit_shean: { asset: 'club-crests/hapoel_beit_shean.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_hadera: { asset: 'club-crests/hapoel_hadera.svg', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_haifa: { asset: 'club-crests/hapoel_haifa.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_herzliya: { asset: 'club-crests/hapoel_herzliya.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_jerusalem_fc: { asset: 'club-crests/hapoel_jerusalem_fc.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_karmiel: { asset: 'club-crests/hapoel_karmiel.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_kfar_saba: { asset: 'club-crests/hapoel_kfar_saba.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_kfar_shalem: { asset: 'club-crests/hapoel_kfar_shalem.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_marmorek: { asset: 'club-crests/hapoel_marmorek.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_migdal_haemek: { asset: 'club-crests/hapoel_migdal_haemek.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_nof_hagalil: { asset: 'club-crests/hapoel_nof_hagalil.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_petah_tikva: { asset: 'club-crests/hapoel_petah_tikva.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_raanana: { asset: 'club-crests/hapoel_raanana.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_ramat_gan: { asset: 'club-crests/hapoel_ramat_gan.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_ramat_hasharon: { asset: 'club-crests/hapoel_ramat_hasharon.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_rishon: { asset: 'club-crests/hapoel_rishon.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_tel_aviv: { asset: 'club-crests/hapoel_tel_aviv.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_tirat_carmel: { asset: 'club-crests/hapoel_tirat_carmel.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  hapoel_umm_al_fahm: { asset: 'club-crests/hapoel_umm_al_fahm.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  heidenheim: { asset: 'club-crests/heidenheim.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  hoffenheim: { asset: 'club-crests/hoffenheim.png', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  inter_milan: { asset: 'club-crests/inter_milan.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  ironi_kiryat_shmona: { asset: 'club-crests/ironi_kiryat_shmona.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ironi_modiin: { asset: 'club-crests/ironi_modiin.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ironi_nesher: { asset: 'club-crests/ironi_nesher.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ironi_tiberias: { asset: 'club-crests/ironi_tiberias.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  lask: { asset: 'club-crests/lask.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  lazio: { asset: 'club-crests/lazio.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  levadiakos: { asset: 'club-crests/levadiakos.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  leverkusen: { asset: 'club-crests/leverkusen.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  liverpool: { asset: 'club-crests/liverpool.png', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  maccabi_ahi_nazareth: { asset: 'club-crests/maccabi_ahi_nazareth.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_ata_bialik: { asset: 'club-crests/maccabi_ata_bialik.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_bnei_raina: { asset: 'club-crests/maccabi_bnei_raina.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_haifa: { asset: 'club-crests/maccabi_haifa.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_herzliya: { asset: 'club-crests/maccabi_herzliya.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_ironi_ashdod: { asset: 'club-crests/maccabi_ironi_ashdod.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_kabilio_jaffa: { asset: 'club-crests/maccabi_kabilio_jaffa.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_kiryat_gat: { asset: 'club-crests/maccabi_kiryat_gat.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_kiryat_malakhi: { asset: 'club-crests/maccabi_kiryat_malakhi.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_netanya: { asset: 'club-crests/maccabi_netanya.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_petah_tikva: { asset: 'club-crests/maccabi_petah_tikva.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_tel_aviv: { asset: 'club-crests/maccabi_tel_aviv.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  maccabi_yavne: { asset: 'club-crests/maccabi_yavne.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  mainz: { asset: 'club-crests/mainz.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  mk_holon_yirmiyahu: { asset: 'club-crests/mk_holon_yirmiyahu.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  mk_jerusalem: { asset: 'club-crests/mk_jerusalem.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  monza: { asset: 'club-crests/monza.png', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  ms_ashdod: { asset: 'club-crests/ms_ashdod.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ms_dimona: { asset: 'club-crests/ms_dimona.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ms_kafr_qasim: { asset: 'club-crests/ms_kafr_qasim.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ms_kiryat_yam: { asset: 'club-crests/ms_kiryat_yam.png', provider: 'thesportsdb', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  ms_tira: { asset: 'club-crests/ms_tira.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  nac_breda: { asset: 'club-crests/nac_breda.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  napoli: { asset: 'club-crests/napoli.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  nordia_jerusalem: { asset: 'club-crests/nordia_jerusalem.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  oh_leuven: { asset: 'club-crests/oh_leuven.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  panathinaikos: { asset: 'club-crests/panathinaikos.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  parma: { asset: 'club-crests/parma.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  pec_zwolle: { asset: 'club-crests/pec_zwolle.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  pisa: { asset: 'club-crests/pisa.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  rapid_wien: { asset: 'club-crests/rapid_wien.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  shimshon_tel_aviv: { asset: 'club-crests/shimshon_tel_aviv.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  sturm_graz: { asset: 'club-crests/sturm_graz.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  stuttgart: { asset: 'club-crests/stuttgart.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  sv_ried: { asset: 'club-crests/sv_ried.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  tondela: { asset: 'club-crests/tondela.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  tzeirei_umm_al_fahm: { asset: 'club-crests/tzeirei_umm_al_fahm.png', provider: 'hewiki', license: "non-free club mark; referential use at project-owner direction (v0.6.5 hard rule); not claimed as freely licensed", regime: 'referential' },
  udinese: { asset: 'club-crests/udinese.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  werder_bremen: { asset: 'club-crests/werder_bremen.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
  wolfsburg: { asset: 'club-crests/wolfsburg.svg', provider: 'wikimedia', license: "Public domain", regime: 'free-media' },
};

/** The local asset path for a club's imported crest, or null when it has none. */
export function importedCrestAsset(clubId: string): string | null {
  return CREST_MANIFEST[clubId]?.asset ?? null;
}

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
  provider: 'wikimedia';
  /** Licence short-name recorded from the source at retrieval time. */
  license: string;
}
export const CREST_MANIFEST: Record<string, CrestManifestEntry> = {
  ac_milan: { asset: 'club-crests/ac_milan.svg', provider: 'wikimedia', license: "Public domain" },
  academico_viseu: { asset: 'club-crests/academico_viseu.svg', provider: 'wikimedia', license: "Public domain" },
  altach: { asset: 'club-crests/altach.svg', provider: 'wikimedia', license: "Public domain" },
  apoel: { asset: 'club-crests/apoel.svg', provider: 'wikimedia', license: "Public domain" },
  atalanta: { asset: 'club-crests/atalanta.png', provider: 'wikimedia', license: "Public domain" },
  austria_lustenau: { asset: 'club-crests/austria_lustenau.svg', provider: 'wikimedia', license: "CC0" },
  austria_wien: { asset: 'club-crests/austria_wien.svg', provider: 'wikimedia', license: "Public domain" },
  az_alkmaar: { asset: 'club-crests/az_alkmaar.svg', provider: 'wikimedia', license: "Public domain" },
  bayern_munich: { asset: 'club-crests/bayern_munich.svg', provider: 'wikimedia', license: "Public domain" },
  bologna: { asset: 'club-crests/bologna.svg', provider: 'wikimedia', license: "Public domain" },
  cercle_brugge: { asset: 'club-crests/cercle_brugge.png', provider: 'wikimedia', license: "Public domain" },
  como: { asset: 'club-crests/como.svg', provider: 'wikimedia', license: "Public domain" },
  dortmund: { asset: 'club-crests/dortmund.svg', provider: 'wikimedia', license: "Public domain" },
  elversberg: { asset: 'club-crests/elversberg.svg', provider: 'wikimedia', license: "Public domain" },
  estrela_amadora: { asset: 'club-crests/estrela_amadora.svg', provider: 'wikimedia', license: "Public domain" },
  excelsior: { asset: 'club-crests/excelsior.svg', provider: 'wikimedia', license: "Public domain" },
  fc_utrecht: { asset: 'club-crests/fc_utrecht.svg', provider: 'wikimedia', license: "Public domain" },
  fiorentina: { asset: 'club-crests/fiorentina.svg', provider: 'wikimedia', license: "Public domain" },
  genk: { asset: 'club-crests/genk.svg', provider: 'wikimedia', license: "Public domain" },
  gladbach: { asset: 'club-crests/gladbach.svg', provider: 'wikimedia', license: "Public domain" },
  hamburg: { asset: 'club-crests/hamburg.svg', provider: 'wikimedia', license: "Public domain" },
  heidenheim: { asset: 'club-crests/heidenheim.svg', provider: 'wikimedia', license: "Public domain" },
  hoffenheim: { asset: 'club-crests/hoffenheim.png', provider: 'wikimedia', license: "Public domain" },
  inter_milan: { asset: 'club-crests/inter_milan.svg', provider: 'wikimedia', license: "Public domain" },
  lask: { asset: 'club-crests/lask.svg', provider: 'wikimedia', license: "Public domain" },
  lazio: { asset: 'club-crests/lazio.svg', provider: 'wikimedia', license: "Public domain" },
  levadiakos: { asset: 'club-crests/levadiakos.svg', provider: 'wikimedia', license: "Public domain" },
  leverkusen: { asset: 'club-crests/leverkusen.svg', provider: 'wikimedia', license: "Public domain" },
  liverpool: { asset: 'club-crests/liverpool.png', provider: 'wikimedia', license: "Public domain" },
  mainz: { asset: 'club-crests/mainz.svg', provider: 'wikimedia', license: "Public domain" },
  monza: { asset: 'club-crests/monza.png', provider: 'wikimedia', license: "Public domain" },
  nac_breda: { asset: 'club-crests/nac_breda.svg', provider: 'wikimedia', license: "Public domain" },
  napoli: { asset: 'club-crests/napoli.svg', provider: 'wikimedia', license: "Public domain" },
  oh_leuven: { asset: 'club-crests/oh_leuven.svg', provider: 'wikimedia', license: "Public domain" },
  panathinaikos: { asset: 'club-crests/panathinaikos.svg', provider: 'wikimedia', license: "Public domain" },
  parma: { asset: 'club-crests/parma.svg', provider: 'wikimedia', license: "Public domain" },
  pec_zwolle: { asset: 'club-crests/pec_zwolle.svg', provider: 'wikimedia', license: "Public domain" },
  pisa: { asset: 'club-crests/pisa.svg', provider: 'wikimedia', license: "Public domain" },
  rapid_wien: { asset: 'club-crests/rapid_wien.svg', provider: 'wikimedia', license: "Public domain" },
  sturm_graz: { asset: 'club-crests/sturm_graz.svg', provider: 'wikimedia', license: "Public domain" },
  stuttgart: { asset: 'club-crests/stuttgart.svg', provider: 'wikimedia', license: "Public domain" },
  sv_ried: { asset: 'club-crests/sv_ried.svg', provider: 'wikimedia', license: "Public domain" },
  tondela: { asset: 'club-crests/tondela.svg', provider: 'wikimedia', license: "Public domain" },
  udinese: { asset: 'club-crests/udinese.svg', provider: 'wikimedia', license: "Public domain" },
  werder_bremen: { asset: 'club-crests/werder_bremen.svg', provider: 'wikimedia', license: "Public domain" },
  wolfsburg: { asset: 'club-crests/wolfsburg.svg', provider: 'wikimedia', license: "Public domain" },
};

/** The local asset path for a club's imported crest, or null when it has none. */
export function importedCrestAsset(clubId: string): string | null {
  return CREST_MANIFEST[clubId]?.asset ?? null;
}

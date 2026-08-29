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

export const CREST_MANIFEST: Record<string, CrestManifestEntry> = {};

/** The local asset path for a club's imported crest, or null when it has none. */
export function importedCrestAsset(clubId: string): string | null {
  return CREST_MANIFEST[clubId]?.asset ?? null;
}

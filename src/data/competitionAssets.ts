import type { UefaCompetitionId } from '../types';

/**
 * The competition asset layer (v0.8).
 *
 * UEFA's official competition logos are trademarks distributed through UEFA's media channels
 * under press/editorial terms; redistribution rights for an open repository could not be
 * confirmed, so per the project rule no unauthorized asset is silently pulled. This layer is
 * the substitution point: drop a legitimately licensed file into `public/competitions/` and
 * name it here, and every surface - qualification cards, standings, season summary, trophy
 * room, archive, poster - switches from the original drawn mark to the official asset with no
 * further code change.
 *
 * Exact substitution targets, when licensing is ever confirmed:
 *   uefa_champions_league  → the official UCL "starball" lockup (UEFA Media Downloads)
 *   uefa_europa_league     → the official UEL emblem
 *   uefa_conference_league → the official UECL emblem
 */
const COMPETITION_ASSETS: Record<UefaCompetitionId, string | null> = {
  uefa_champions_league: null,
  uefa_europa_league: null,
  uefa_conference_league: null,
};

/** The locally served asset for a competition, or null - callers then render the drawn mark. */
export function getCompetitionAsset(competition: UefaCompetitionId): string | null {
  const asset = COMPETITION_ASSETS[competition];
  return asset ? `${import.meta.env.BASE_URL}${asset}` : null;
}

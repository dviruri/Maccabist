import { clubDisplayName } from './identity';
import { sameFootballIdentity } from '../data/clubVisuals';
import { currentPhase, currentTable } from './leagueEngine';
import { matchContext } from './matchEngine';
import { levelContext } from './rules';
import type { Career, MatchContext } from '../types';

/**
 * THE presentation fixture (v0.9.1, Phase 1).
 *
 * ## The bug this exists to make impossible
 *
 * v0.9 let two screens answer the same question independently: the career home derived a "next
 * match" from the nearest table rival, while the matchday derived its opponent from
 * `matchContext`. Both were deterministic and both were reasonable - and they disagreed, so
 * playtesting saw Maccabi Netanya on the home screen and Maccabi Tel Aviv after kickoff. That is
 * the same class of defect this codebase has been removing since v0.4.8: two systems answering
 * one question, with the disagreement shown to the player.
 *
 * From here there is ONE answer. Every presentation surface - home hero, scoreboard, crests,
 * timeline, summary - reads `activeFixture(career)`. Nothing derives an opponent itself.
 *
 * ## Why this is not a fixture engine
 *
 * Maccabist simulates seasons, not calendars, and v0.9.1 is not the release that changes that.
 * A fixture here is the current BEAT's match: one deterministic pairing derived from state that
 * already exists (the projection's table seed and the season phase, via `matchContext`), stable
 * for as long as the beat is, and replaced when the beat advances. No fixture list is invented.
 *
 * ## Priority: stored competitions always win
 *
 * A cup final and a European tie are real stored facts with real named opponents. They outrank
 * the generic league beat, because presenting a generic league opponent while the engine holds
 * a committed cup final would be the same lie in a different costume.
 *
 * ## Known is not active (v0.9.2)
 *
 * A cup final is COMMITTED at preseason - the engine decides the run and the opponent then - so
 * the club can know in November who it would meet in the final. v0.9.1 treated committed as
 * playable and the final turned up mid-season, ahead of ordinary league football. It is now
 * gated by season sequencing:
 *
 *   early / mid season   → league beat (or an active European tie)
 *   final season beat    → the domestic cup final, if the club reached it
 *   after that           → settlement, ceremonies, summary
 *
 * `knownCupFinal` exposes the committed final for the home screen to TEASE - "גמר הגביע מחכה
 * בסיום העונה" - without `activeFixture` ever claiming it is today's match. The domestic cup
 * final is always the last playable match of a season.
 */

/**
 * What kinds of match the game can present truthfully (v0.9.6).
 *
 * `'european'` was removed rather than left unreachable. A European tie has a REAL stored result
 * and the matchday presenter invents one, so the two contradicted each other; the type is now what
 * enforces that Europe cannot become a fixture, instead of a branch nobody happens to take.
 */
export type FixtureKind = 'league' | 'cup_final';

export interface PresentationFixture {
  /** Stable identity for this beat's match - the reveal/dedupe key every screen shares. */
  id: string;
  kind: FixtureKind;
  season: number;
  /** Hebrew competition label for headers. */
  competition: string;
  playerClubId: string;
  playerClubName: string;
  opponentClubId: string;
  opponentName: string;
  home: boolean;
  homeClubId: string;
  awayClubId: string;
  /** Round or stage label where one exists (cup final, European stage). */
  stage?: string;
  /** The league match context, when this beat is a league match - carries table facts. */
  context: MatchContext | null;
  /** The player club's own table position when known - the other half of "מקום 1 נגד מקום 2". */
  playerPosition: number | null;
  /** Opponent's table position when known. */
  opponentPosition: number | null;
  /** Points between the clubs when both are in the same table. */
  pointsGap: number | null;
}

/**
 * The current beat's fixture, or null when there is nothing to present (academy football with
 * no table, a settled season, a career with no projection).
 *
 * Deterministic in the career: the same career state always yields the same fixture, which is
 * exactly what makes the home/matchday invariant testable.
 */
/**
 * The committed cup final, whenever it is known - which may be months before it is played.
 *
 * Presentation may say it is coming; only `activeFixture` decides whether it is on today.
 */
export function knownCupFinal(career: Career): { opponentId: string; opponentName: string; competition: string } | null {
  const cup = career.world.cup;
  if (!cup || cup.season !== career.currentSeason || !cup.finalOpponentId) return null;
  if (cup.run !== 'winners' && cup.run !== 'runner_up') return null;
  return {
    opponentId: cup.finalOpponentId,
    opponentName: clubDisplayName(cup.finalOpponentId),
    competition: cup.trophyId === 'youth_cup' ? 'גביע הנוער' : 'גביע המדינה',
  };
}

/**
 * The last playable beat of the season.
 *
 * Settlement is where the season's football has finished and its story is told, so the final is
 * played here - after the league campaign, before the ceremonies and the summary.
 */
export function isFinalSeasonBeat(career: Career): boolean {
  return career.phase === 'season_result' && career.seasonPoint === 'season_end';
}

/**
 * The last line of defence (v0.9.5.1).
 *
 * Every generator that can choose an opponent now filters on `sameFootballIdentity`, so nothing
 * should ever reach here holding a club playing itself. This exists for the case those fixes
 * cannot reach: a fixture read back out of STORED state written by an older build - a cup final
 * drawn before this patch, a European tie already in a save.
 *
 * It fails CLOSED. It does not rename the opponent to something plausible, because a renamed
 * opponent is a lie the player cannot detect; it returns null, and the beat renders without a
 * fixture. Losing a fixture is a visible absence. Presenting מכבי חיפה vs מכבי חיפה is corrupt
 * football truth wearing a correct-looking face, and that is worse.
 */
function isSelfFixture(fixture: PresentationFixture): boolean {
  return sameFootballIdentity(fixture.playerClubId, fixture.opponentClubId);
}

export function activeFixture(career: Career): PresentationFixture | null {
  const playerClubId = career.currentClubId;
  const playerClubName = clubDisplayName(playerClubId);
  const season = career.currentSeason;

  const build = (
    partial: Omit<PresentationFixture, 'playerClubId' | 'playerClubName' | 'season' | 'homeClubId' | 'awayClubId'>,
  ): PresentationFixture | null => {
    const fixture: PresentationFixture = {
      ...partial,
      season,
      playerClubId,
      playerClubName,
      homeClubId: partial.home ? playerClubId : partial.opponentClubId,
      awayClubId: partial.home ? partial.opponentClubId : playerClubId,
    };
    /* Fail closed rather than present a club against itself - see `isSelfFixture`. */
    return isSelfFixture(fixture) ? null : fixture;
  };

  /*
   * ---- 1. The domestic cup final - ONLY at the final beat (v0.9.2) ----
   *
   * Known earlier, played last. Everything before this point in the season belongs to the
   * league and to Europe.
   */
  const final = knownCupFinal(career);
  if (final && isFinalSeasonBeat(career)) {
    return build({
      id: `cup_final_${season}`,
      kind: 'cup_final',
      competition: final.competition,
      opponentClubId: final.opponentId,
      opponentName: final.opponentName,
      // A final is played at a neutral venue - neither club is at home.
      home: false,
      stage: 'הגמר',
      context: null,
      playerPosition: null,
      opponentPosition: null,
      pointsGap: null,
    });
  }

  /*
   * ---- 2. Europe is NOT presented as a playable fixture (v0.9.6, Phase 3) ----
   *
   * There used to be a branch here that returned a knockout tie out of the stored European
   * journey. It produced two untruths and had to go.
   *
   * FABRICATED SCORES. `buildMatchday` is a representative presenter: it has no per-match team
   * results to work from, so it invents a plausible scoreline with `presentScore` and seeds it on
   * the fixture id. That is honest for a league beat, where no stored result exists to contradict
   * it. A European tie is the opposite case - `journey.steps` already contains the REAL legs and
   * the REAL aggregate. So the Europe card could say the club went through 4-1 while the matchday
   * screen showed 2-0, from the same save, on the same night.
   *
   * WRONG TIME. The branch also had no chronology. The knockout step exists from the moment the
   * European season is simulated, which is the first preseason beat - so the home screen offered a
   * February knockout tie as "the next match" in July, complete with a "לילה אירופי" caption.
   *
   * v0.9.6 does not build a European calendar to fix this; that is a real feature and inventing a
   * partial one would be a third untruth. It removes the claim instead. Europe stays fully visible
   * in its own card, where the stored journey is rendered as what it is - a record - and the
   * playable matchday remains the two fixtures the game can actually tell the truth about: the
   * representative domestic league match, and the stored domestic cup final whose result
   * `world.cup.run` already fixes.
   */

  /*
   * ---- 3. The league beat ----
   *
   * Not at the final beat: if the club reached the final, the final is the match; if it did not,
   * the season's football is simply over and settlement follows with no extra fixture. Either
   * way no league match may appear after the cup final.
   */
  if (isFinalSeasonBeat(career)) return null;
  const context = matchContext(career, currentPhase(career));
  if (!context) return null;
  const table = currentTable(career);
  const playerPosition = table?.rows.find((row) => row.clubId === playerClubId)?.position ?? null;
  return build({
    id: `league_${season}_${currentPhase(career)}_${context.opponentClubId}`,
    kind: 'league',
    competition: context.isDerby && context.rivalryName ? context.rivalryName : levelContext(career).league,
    opponentClubId: context.opponentClubId,
    opponentName: context.opponentName,
    home: context.home,
    context,
    playerPosition,
    opponentPosition: context.opponentPosition,
    pointsGap: context.pointsGap,
  });
}

/*
 * The European stage labels lived here for the fixture branch v0.9.6 removed. They are not
 * orphaned duplicates - `components/EuropeCards.tsx` has always had its own, and that is where
 * European stages are named now that Europe is a record rather than a fixture.
 */

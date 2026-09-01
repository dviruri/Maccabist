import { ACTIVE_CLUBS, getClub } from '../data/clubs';
import { sameFootballIdentity } from '../data/clubVisuals';
import { rivalryBetween } from '../data/rivalries';
import { levelContext } from './rules';
import { clamp, type Rng } from './random';
import type { Career, CupRun, CupSeasonState } from '../types';

/**
 * The cup, as an authoritative season fact (v0.6.2, Target 4).
 *
 * ## Why this exists
 *
 * Before this, the cup was a single `rng.chance(cupChance * contribution)` at season *end*, and
 * `sen_cup_final` - an event titled "גמר גביע המדינה" - carried no cup condition at all. The two
 * had nothing to do with each other, so the game could tell a player he decided the cup final and
 * was carried off the pitch, then hand him no cup; or hand him a cup in a season where he was
 * never told a final was played. That is exactly the class of contradiction v0.4.8 set out to
 * remove from the league, left standing in the cup.
 *
 * The fix is the same one the league title got: **the run is committed at preseason, and every
 * other system reads it.** The event asks "did we reach a final?", the trophy asks "did we win
 * it?", and the integrity validator asks whether the two agree.
 *
 * ## Why preseason
 *
 * `planSeason` picks the whole year's events at preseason, so anything an event gates on must
 * already be true then - the same constraint that moved the league projection in v0.4.6. A cup run
 * decided in May cannot gate an event chosen in August.
 *
 * ## Why this is not a bracket
 *
 * There is no draw, no rounds, no opponents beyond the final, and no fixture list. A bracket is
 * explicitly out of scope, and it would not buy anything: the only questions the game actually
 * asks are "was there a final?", "who was it against?" and "did we win it?".
 */

/* ------------------------------------------------------------------ */
/* Calibration                                                         */
/* ------------------------------------------------------------------ */

/**
 * How much likelier reaching a final is than winning the cup.
 *
 * This is the one number that had to be chosen rather than derived, and it is chosen so the
 * marginal win rate stays what v0.6.1 rolled. Winning is decomposed into reaching a final and
 * then winning it:
 *
 *     P(win) = P(final) x P(win | final)
 *            = (winChance x REACH_FINAL_MULTIPLE) x (winChance / (winChance x REACH_FINAL_MULTIPLE))
 *            = winChance
 *
 * So the multiple cancels, and 2.4 only sets how often a player *sees* a final he does not win.
 * At Maccabi (cupChance 0.24) that is a final in roughly half of seasons, which is about right for
 * the strongest club in a 20-club knockout.
 */
const REACH_FINAL_MULTIPLE = 2.4;

/** Above this, "reaching the final" stops meaning anything. */
const MAX_REACH_FINAL = 0.85;

/* ------------------------------------------------------------------ */
/* Projecting the run                                                  */
/* ------------------------------------------------------------------ */

/**
 * How far the club goes in the cup this season, decided before a ball is kicked.
 *
 * The strength term is the same expression `rollTrophies` used - `0.75 + (ability - quality)/90`,
 * clamped - read at preseason rather than at season end. It drifts a little from the old value
 * (a player gains a point or two of ability across a year), and the v0.6.2 simulation measures
 * that drift rather than assuming it away.
 */
export function projectCup(career: Career, rng: Rng): CupSeasonState {
  const level = levelContext(career);
  const club = career.currentClubId;
  const strength = clamp(0.75 + (career.ability - level.quality) / 90, 0.7, 1.35);
  const winChance = clamp(level.cupChance * strength, 0, 1);
  const reachFinal = clamp(winChance * REACH_FINAL_MULTIPLE, 0, MAX_REACH_FINAL);
  const trophyId = cupTrophyId(career);

  if (!rng.chance(reachFinal)) {
    return {
      season: career.currentSeason,
      clubId: club,
      trophyId,
      run: earlyExit(rng),
      finalOpponentId: null,
    };
  }

  // Conditional on having got there. See REACH_FINAL_MULTIPLE for why this keeps P(win) exact.
  const won = reachFinal > 0 && rng.chance(clamp(winChance / reachFinal, 0, 1));
  return {
    season: career.currentSeason,
    clubId: club,
    trophyId,
    run: won ? 'winners' : 'runner_up',
    finalOpponentId: drawFinalOpponent(career, rng),
  };
}

/**
 * How far a club that did not reach the final got.
 *
 * Pure flavour - nothing gates on it - but a cup run that is either "final" or nothing would make
 * the competition feel binary, and the season summary can say where it actually ended.
 */
function earlyExit(rng: Rng): CupRun {
  const roll = rng.next();
  if (roll < 0.55) return 'early_exit';
  if (roll < 0.85) return 'quarter_final';
  return 'semi_final';
}

/**
 * Which trophy this club's cup produces.
 *
 * Read from the same two facts `rollTrophies` used - academy or not, Israeli or not - so the cup
 * state and the trophy list can never disagree about which competition was won. An age group
 * plays for a youth cup; that is a different competition, not the State Cup decided differently.
 */
function cupTrophyId(career: Career): CupSeasonState['trophyId'] {
  const level = levelContext(career);
  if (level.isAcademy) return 'youth_cup';
  return getClub(career.currentClubId).country === 'ישראל' ? 'cup' : 'foreign_cup';
}

/**
 * Who they meet in the final.
 *
 * A real club from the same country, weighted towards the stronger ones - a final is not a flat
 * draw from the whole pyramid. Nothing is forced and nothing is forbidden: if the draw produces
 * the club's actual local rival, the final genuinely *is* a derby and `rivalryBetween` will say so
 * on its own. That is the only way a cup final is allowed to become a derby (Part 1).
 */
function drawFinalOpponent(career: Career, rng: Rng): string | null {
  const own = getClub(career.currentClubId);

  /*
   * v0.6.4: the pool is every ACTIVE club of the same country.
   *
   * v0.6.3 had to union two collections here because half the football world could not be a
   * `Club`. Now it can, so this is one filter - and `ACTIVE_CLUBS` is the right list rather than
   * `ALL_CLUBS`, because a club that dropped out of the modelled divisions is not in the cup.
   */
  /*
   * The pool matches the COMPETITION (v0.9.6, Phase 7).
   *
   * `cupTrophyId` already decides that an academy or youth player is in a youth cup rather than
   * the State Cup. The pool did not follow: it excluded academy and youth tiers unconditionally,
   * so a youth cup final was drawn from SENIOR first teams. Maccabi Haifa's under-19s facing a
   * senior top-flight club is not a competition that exists.
   *
   * v0.9.5.1 fixed the identity half of this - the youth side could draw its own parent - but
   * left the age half, and recorded it as a known limitation. This is that half.
   */
  const ageGroup = levelContext(career).isAcademy;
  const candidates = ACTIVE_CLUBS.filter(
    (club) =>
      /*
       * v0.9.5.1: identity, not id. `club.id !== own.id` let a youth side draw its own parent,
       * and `maccabi_youth` vs `maccabi_haifa` both render as "מכבי חיפה".
       */
      !sameFootballIdentity(club.id, own.id) &&
      club.country === own.country &&
      (ageGroup
        ? club.tier === 'academy' || club.tier === 'youth'
        : club.tier !== 'academy' && club.tier !== 'youth'),
  );

  /*
   * The draw is taken BEFORE the pool is inspected, and that ordering is deliberate.
   *
   * `projectCup` has already decided whether the cup was won; this only names who it was won
   * against. If an empty pool returned early it would consume one fewer value than a full one,
   * so the size of a candidate list would silently shift every later roll in the career. Drawing
   * first makes consumption constant: exactly one value, whatever the competition.
   */
  const roll = rng.next();
  if (candidates.length === 0) {
    /*
     * No age-appropriate opponent is modelled. The world contains exactly two academy/youth clubs
     * and both are Maccabi Haifa's own identity, so for a youth cup there is genuinely nobody to
     * name - and naming a senior club instead is the invented fact this phase removes. The cup
     * run itself is unaffected: it was decided above, and `knownCupFinal` simply has no fixture
     * to offer, which is the honest shape of "the game does not model this final's opponent".
     */
    return null;
  }

  const weights = candidates.map((club) => Math.max(1, club.quality - 40) ** 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  let pick = roll * total;
  for (let i = 0; i < candidates.length; i += 1) {
    pick -= weights[i]!;
    if (pick <= 0) return candidates[i]!.id;
  }
  return candidates[candidates.length - 1]!.id;
}

/* ------------------------------------------------------------------ */
/* Reading it                                                          */
/* ------------------------------------------------------------------ */

/**
 * This season's cup state, or null.
 *
 * Null for a save written before v0.6.2, for a season the state does not belong to, and for a club
 * the player has since left. Every consumer treats null as "no cup claim is supported", which is
 * the fail-closed answer: an old save loses cup-final events for the season in progress rather
 * than being handed a final it never played.
 */
export function currentCup(career: Career): CupSeasonState | null {
  const cup = career.world.cup;
  if (!cup) return null;
  if (cup.season !== career.currentSeason) return null;
  if (cup.clubId !== career.currentClubId) return null;
  return cup;
}

/** Did the club reach a final this season? The only gate a cup-final event may use. */
export function reachedCupFinal(career: Career): boolean {
  const run = currentCup(career)?.run;
  return run === 'winners' || run === 'runner_up';
}

/** Did the club win the cup this season? The only thing that may produce a cup trophy. */
export function wonCupThisSeason(career: Career): boolean {
  return currentCup(career)?.run === 'winners';
}

/** The opponent in this season's final, or null when there was none. */
export function cupFinalOpponent(career: Career): string | null {
  const cup = currentCup(career);
  return reachedCupFinal(career) ? (cup?.finalOpponentId ?? null) : null;
}

/**
 * Is this season's cup final a real derby?
 *
 * Asks `rivalryBetween` about the two clubs that are actually in the final. It is not a synonym
 * for "big final" and no event can assert it.
 */
export function isCupFinalDerby(career: Career): boolean {
  const opponent = cupFinalOpponent(career);
  if (!opponent) return false;
  return rivalryBetween(career.currentClubId, opponent)?.type === 'localDerby';
}

/** Hebrew label for how far the run went, for the season summary. */
export function cupRunLabel(run: CupRun): string {
  switch (run) {
    case 'winners':
      return 'זכייה בגביע המדינה';
    case 'runner_up':
      return 'הפסד בגמר הגביע';
    case 'semi_final':
      return 'הפסד בחצי גמר הגביע';
    case 'quarter_final':
      return 'הפסד ברבע גמר הגביע';
    default:
      return 'הדחה מוקדמת בגביע';
  }
}

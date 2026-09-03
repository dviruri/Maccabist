import { activeFixture, type PresentationFixture } from './fixture';
import { withHebrewPrefix } from './identity';
import { createRng, clamp, type Rng } from './random';
import { countLabel } from './hebrew';
import type { Career, Position } from '../types';

/**
 * The matchday presenter (v0.9, Phase 3).
 *
 * PRESENTATION ONLY. The engine simulates half-seasons; this builds ONE representative match -
 * the round's headline fixture - out of facts the engine already produced, so the player can
 * live a matchday instead of reading an aggregate. The rules that keep it honest:
 *
 *   - The opponent is `matchContext`'s - the same deterministic real-club pairing events use.
 *   - The player's on-pitch moments never exceed his REAL half stats: a goal moment exists only
 *     if he actually scored this half, an assist only if he assisted, a clean-sheet note only if
 *     the presented score conceded nothing AND he has a real clean sheet this half. Zero
 *     appearances this half means the bench, honestly - that is its own story.
 *   - Goalkeeper matchdays are goalkeeper matchdays: saves and conceded goals, never striker
 *     moments. No penalty saves are ever invented - the stats cannot verify one.
 *   - The team score is presentation (no per-match team results exist to contradict), seeded
 *     and biased by the sides' real table standing.
 *
 * The rng is `career.seed ^ season ^ 'matchday'` - fully isolated. Rendering a matchday
 * consumes nothing from the simulation stream and can never move a career.
 */

export type MatchMomentKind =
  | 'kickoff'
  | 'sub_on'
  | 'chance'
  | 'player_goal'
  | 'player_assist'
  | 'team_goal'
  | 'conceded'
  | 'save'
  | 'big_save'
  | 'booking'
  | 'half_time'
  | 'full_time';

export interface MatchMoment {
  minute: number;
  kind: MatchMomentKind;
  text: string;
  /** The player's own moments get the visual weight. */
  big: boolean;
}

export interface MatchdayPresentation {
  /** THE fixture (v0.9.1) - the same object the career home rendered. */
  fixture: PresentationFixture;
  competitionLabel: string;
  /** Did the player take the pitch in this presentation - from real participation. */
  played: boolean;
  started: boolean;
  /** The minute a substitute came on. Null when he started, or never played (v0.9.6.6). */
  enteredAt: number | null;
  scoreFor: number;
  scoreAgainst: number;
  moments: MatchMoment[];
  /** The real half-stats line that anchors the presentation to truth. */
  factsLine: string;
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function minuteRun(rng: Rng, count: number, from: number, to: number): number[] {
  const minutes = new Set<number>();
  while (minutes.size < count) minutes.add(rng.int(from, to));
  return [...minutes].sort((a, b) => a - b);
}

/**
 * When a substitute comes on (v0.9.6.6).
 *
 * 46-75 is narrow on purpose. Earlier than half time would be inventing an injury or a tactical
 * disaster the aggregate stats say nothing about; later than 75 leaves no room for the substitute
 * to then do the thing his real half-stats say he did. Both ends are presentation judgements, not
 * simulation - the engine has no per-match minutes to contradict.
 */
const SUB_ON_FROM = 46;
const SUB_ON_TO = 75;

/**
 * Where the player is, and from which minute he may own a moment.
 *
 * One source of truth so the invariant is structural rather than repeated: every generator below
 * reads `firstMomentMinute` instead of asking `if (!started)` for itself.
 */
interface PlayerMatchAvailability {
  played: boolean;
  started: boolean;
  /** The minute he came off the bench. Null when he started, or never played. */
  enteredAt: number | null;
  /**
   * The earliest minute a player-owned moment may occupy. Null when he never played, so there is
   * no legal minute at all. For a substitute this is strictly AFTER the entry, so the timeline
   * reads "57' he comes on / 68' he scores" rather than both landing on the same minute.
   */
  firstMomentMinute: number | null;
}

function availabilityOf(rng: Rng, played: boolean, started: boolean): PlayerMatchAvailability {
  if (!played) return { played, started, enteredAt: null, firstMomentMinute: null };
  if (started) return { played, started, enteredAt: null, firstMomentMinute: 1 };
  const enteredAt = rng.int(SUB_ON_FROM, SUB_ON_TO);
  return { played, started, enteredAt, firstMomentMinute: enteredAt + 1 };
}

/**
 * The first free minute at or after a random point in [from, to], scanning forward and wrapping.
 *
 * Deterministic and always terminates: a retry loop could in principle keep colliding, and this
 * cannot, which matters because the caller needs a guarantee rather than a very high probability.
 */
function freeMinuteIn(rng: Rng, taken: Set<number>, from: number, to: number): number | null {
  const span = to - from + 1;
  if (span <= 0) return null;
  const start = rng.int(from, to);
  for (let step = 0; step < span; step += 1) {
    const candidate = from + ((start - from + step) % span);
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Team scoring minutes, guaranteed to contain enough of them after the player came on.
 *
 * The presented score is a projection of aggregate half-stats, not a stored match result, so when
 * an initially drawn minute lands before the substitute was on the pitch the honest fix is to move
 * the minute rather than to drop his real goal. The COUNT never changes, so the scoreboard and the
 * timeline still reconcile exactly.
 */
function scoringMinutes(
  rng: Rng,
  count: number,
  from: number,
  needed: number,
): number[] {
  const minutes = minuteRun(rng, count, 8, 88);
  if (needed <= 0 || from <= 8) return minutes;
  const shortfall = needed - minutes.filter((minute) => minute >= from).length;
  if (shortfall <= 0) return minutes;

  const taken = new Set(minutes);
  const moved = [...minutes];
  let remaining = shortfall;
  /* The earliest minutes are the ones he demonstrably had no part in, so those are the ones to move. */
  for (let i = 0; i < moved.length && remaining > 0; i += 1) {
    if (moved[i]! >= from) continue;
    const candidate = freeMinuteIn(rng, taken, from, 88);
    if (candidate === null) break;
    taken.delete(moved[i]!);
    taken.add(candidate);
    moved[i] = candidate;
    remaining -= 1;
  }
  return moved.sort((a, b) => a - b);
}

/** A plausible one-match score, seeded, leaning on the real table gap. */
function presentScore(rng: Rng, fixture: PresentationFixture): { scoreFor: number; scoreAgainst: number } {
  /*
   * The strength read is the real one: opponent's table position against the gap in points -
   * both live facts from the same table events use. Leading the head-to-head standing tilts
   * the presented score the way the season is actually tilted.
   */
  const gap = fixture.pointsGap ?? 0;
  const edge = clamp(gap / 12, -0.8, 0.8);
  const home = fixture.home ? 0.2 : -0.1;
  const mean = 1.35 + 0.55 * (edge + home);
  const draw = (m: number): number => {
    const u = rng.next();
    if (u < Math.exp(-m)) return 0;
    if (u < Math.exp(-m) * (1 + m)) return 1;
    if (u < Math.exp(-m) * (1 + m + (m * m) / 2)) return 2;
    return rng.chance(0.4) ? 3 : 2;
  };
  return { scoreFor: draw(mean), scoreAgainst: draw(2.7 - mean) };
}

const OUTFIELD_CHANCE_TEXT = [
  'כמעט! הכדור חולף סנטימטרים מהמסגרת',
  'מהלך יפה נעצר ברגע האחרון',
  'הקהל כבר קם - והשוער מציל',
];

const SAVE_TEXT = ['עצירה חשובה', 'יציאה נכונה סוגרת זווית', 'הגנה על הקו'];
const BIG_SAVE_TEXT = ['הצלה גדולה! בעיטה חזקה נעצרת', 'הצלה מטורפת מטווח קצר'];

/**
 * Builds the mid-season matchday from the first half the engine ACTUALLY simulated.
 * Deterministic per (seed, season); returns null where there is no senior match to present.
 */
export function buildMatchday(career: Career): MatchdayPresentation | null {
  /*
   * v0.9.1: the opponent is no longer this module's opinion. `activeFixture` decided it, the
   * home screen already showed it, and the reveal below only tells its story.
   */
  const fixture = activeFixture(career);
  if (!fixture) return null;

  /*
   * Which football anchors this match (v0.9.2).
   *
   * A league beat is told from the first half the engine simulated. The cup final is played at
   * settlement, so it is anchored to the SETTLED season - and its result is not a presentation
   * choice at all: `world.cup.run` already says whether the club won or lost that final, and the
   * scoreline below is made to agree with it.
   */
  const isCupFinal = fixture.kind === 'cup_final';
  const half = isCupFinal ? (career.lastSeasonRecord?.stats ?? career.firstHalfStats) : career.firstHalfStats;
  if (!half) return null;
  if (!isCupFinal && career.seasonPoint !== 'midseason') return null;

  // Seeded on the FIXTURE identity, so the same match always tells the same story - and a
  // different beat's match gets its own.
  const rng = createRng(
    (career.seed ^ Math.imul(career.currentSeason, 2654435761) ^ hashString(fixture.id)) >>> 0,
  );
  const played = half.appearances > 0;
  const started = half.starts > 0 && rng.chance(clamp(half.starts / Math.max(1, half.appearances), 0, 1));
  const position: Position = career.position;
  const isKeeper = position === 'GK';

  let { scoreFor, scoreAgainst } = presentScore(rng, fixture);


  /* A keeper with a real clean sheet this half gets one honest clean-sheet night sometimes. */
  if (isKeeper && played && half.cleanSheets > 0 && rng.chance(0.6)) scoreAgainst = 0;
  /* An outfielder who actually scored this half scores in the presented match - his real goal. */
  const showPlayerGoal = !isKeeper && played && half.goals > 0;
  const showPlayerAssist = !isKeeper && played && half.assists > 0 && rng.chance(0.7);
  if (showPlayerGoal && scoreFor === 0) scoreFor = 1;
  if (showPlayerAssist && scoreFor < (showPlayerGoal ? 2 : 1)) scoreFor = showPlayerGoal ? 2 : 1;

  /*
   * The final's result is a stored fact, so the reveal is made to tell it - and this runs LAST,
   * after the player's own goals have moved the score. Applied earlier, the goal adjustments
   * above could push a lost final back to a draw, which is how the first version of this shipped
   * a 2:2 "defeat". A cup won ends with the club ahead; a final lost ends behind.
   */
  if (isCupFinal) {
    const won = career.world.cup?.run === 'winners';
    if (won && scoreFor <= scoreAgainst) scoreFor = scoreAgainst + 1;
    else if (!won && scoreFor >= scoreAgainst) scoreAgainst = scoreFor + 1;
  }

  /*
   * v0.9.3: a goal moment NAMES the club it went to.
   *
   * "שער לקבוצה שלנו" / "שער ליריבה" were correct but relative, so a reader had to remember
   * which side of the board he was on to know who had just scored. The timeline is now as
   * unambiguous as the scoreboard: the club is written out, and both come from the same fixture.
   */
  const goalFor = withHebrewPrefix('ל', fixture.playerClubName);
  const goalAgainst = withHebrewPrefix('ל', fixture.opponentName);

  const moments: MatchMoment[] = [{ minute: 1, kind: 'kickoff', text: 'שריקת פתיחה', big: false }];

  /*
   * When the player is actually on the pitch (v0.9.6.6).
   *
   * The presenter knew `played` and `started` and stopped there, so a player shown as starting on
   * the bench could be given a goal in the 24th minute - the contradiction beta testing found.
   * Reproduced before the fix across 60 careers: 222 of 229 bench matchdays carried a
   * player-owned moment with no substitution at all, the earliest at minute 8.
   *
   * Everything below reads `availability` rather than testing `started` for itself.
   */
  const availability = availabilityOf(rng, played, started);
  const availableFrom = availability.firstMomentMinute;
  if (availability.enteredAt !== null) {
    /* No partner and no shirt number: the game does not know who came off, so it does not say. */
    moments.push({
      minute: availability.enteredAt,
      kind: 'sub_on',
      text: 'אתה נכנס מהספסל',
      big: true,
    });
  }

  /*
   * Distribute the goals across the ninety, then weave the player's own moments in.
   *
   * A substitute's own goal and assist must land on team goals scored AFTER he came on, so the
   * minutes are drawn with that requirement rather than corrected afterwards - moving a label
   * alone would leave the scoreline and the timeline telling different stories.
   */
  const ownedGoals = (showPlayerGoal ? 1 : 0) + (showPlayerAssist ? 1 : 0);
  const goalMinutes = scoringMinutes(rng, scoreFor, availableFrom ?? 8, ownedGoals);
  const concededMinutes = minuteRun(rng, scoreAgainst, 8, 88);

  /* Chosen up front, from the minutes he could legally have been part of. */
  const eligibleGoals = goalMinutes.filter((minute) => availableFrom !== null && minute >= availableFrom);
  const playerGoalMinute = showPlayerGoal ? (eligibleGoals[0] ?? null) : null;
  const playerAssistMinute = showPlayerAssist
    ? (eligibleGoals.find((minute) => minute !== playerGoalMinute) ?? null)
    : null;

  for (const minute of goalMinutes) {
    if (minute === playerGoalMinute) {
      moments.push({ minute, kind: 'player_goal', text: `שער שלך! ${career.playerName} כובש`, big: true });
    } else if (minute === playerAssistMinute) {
      moments.push({ minute, kind: 'player_assist', text: 'בישול שלך - והכדור בפנים', big: true });
    } else {
      moments.push({ minute, kind: 'team_goal', text: `שער ${goalFor}`, big: false });
    }
  }
  for (const minute of concededMinutes) {
    moments.push({ minute, kind: 'conceded', text: `שער ${goalAgainst}`, big: false });
  }

  /* Colour, position-aware. A benched player watches - the match happens without his moments. */
  if (played && availableFrom !== null) {
    if (isKeeper) {
      /* A substitute keeper's saves start after he is between the posts, not from the tenth minute. */
      for (const minute of minuteRun(rng, rng.int(1, 2), Math.max(10, availableFrom), 85)) {
        const big = rng.chance(0.45);
        moments.push({
          minute,
          kind: big ? 'big_save' : 'save',
          text: big ? rng.pick(BIG_SAVE_TEXT) : rng.pick(SAVE_TEXT),
          big,
        });
      }
    } else if (!showPlayerGoal && rng.chance(0.7)) {
      moments.push({
        minute: rng.int(Math.max(15, availableFrom), 80),
        kind: 'chance',
        text: rng.pick(OUTFIELD_CHANCE_TEXT),
        big: false,
      });
    }
  }

  moments.push({ minute: 45, kind: 'half_time', text: 'מחצית', big: false });
  moments.push({ minute: 90, kind: 'full_time', text: 'שריקת סיום', big: false });
  /*
   * Same-minute order: kickoff first, then a substitution, then everything else. Without the
   * `sub_on` rank a team goal drawn on the entry minute could print above it, which reads as the
   * player having been involved before he was on.
   */
  const rank = (kind: MatchMomentKind): number => (kind === 'kickoff' ? 0 : kind === 'sub_on' ? 1 : 2);
  moments.sort((a, b) => a.minute - b.minute || rank(a.kind) - rank(b.kind));

  /* Both are labels before a colon, so both are bare - it read "בסיבוב הראשון: ..." beside "העונה: ...". */
  const period = isCupFinal ? 'העונה' : 'הסיבוב הראשון';
  const factsLine = isKeeper
    ? `${period}: ${countLabel(half.appearances, 'הופעה אחת', 'הופעות')} · ${countLabel(half.cleanSheets, 'שער נקי אחד', 'שערים נקיים')}`
    : `${period}: ${countLabel(half.appearances, 'הופעה אחת', 'הופעות')} · ${countLabel(half.goals, 'שער אחד', 'שערים')} · ${countLabel(half.assists, 'בישול אחד', 'בישולים')}`;

  return {
    fixture,
    competitionLabel: fixture.competition,
    played,
    started,
    enteredAt: availability.enteredAt,
    scoreFor,
    scoreAgainst,
    moments,
    factsLine,
  };
}

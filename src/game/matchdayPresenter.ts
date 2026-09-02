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

  /* Distribute the goals across the ninety, then weave the player's own moments in. */
  const goalMinutes = minuteRun(rng, scoreFor, 8, 88);
  const concededMinutes = minuteRun(rng, scoreAgainst, 8, 88);
  let playerGoalMinute: number | null = null;
  let playerAssistMinute: number | null = null;
  goalMinutes.forEach((minute, index) => {
    if (showPlayerGoal && index === 0) {
      playerGoalMinute = minute;
      moments.push({ minute, kind: 'player_goal', text: `שער שלך! ${career.playerName} כובש`, big: true });
    } else if (showPlayerAssist && playerAssistMinute === null && minute !== playerGoalMinute) {
      playerAssistMinute = minute;
      moments.push({ minute, kind: 'player_assist', text: 'בישול שלך - והכדור בפנים', big: true });
    } else {
      moments.push({ minute, kind: 'team_goal', text: `שער ${goalFor}`, big: false });
    }
  });
  for (const minute of concededMinutes) {
    moments.push({ minute, kind: 'conceded', text: `שער ${goalAgainst}`, big: false });
  }

  /* Colour, position-aware. A benched player watches - the match happens without his moments. */
  if (played) {
    if (isKeeper) {
      for (const minute of minuteRun(rng, rng.int(1, 2), 10, 85)) {
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
        minute: rng.int(15, 80),
        kind: 'chance',
        text: rng.pick(OUTFIELD_CHANCE_TEXT),
        big: false,
      });
    }
  }

  moments.push({ minute: 45, kind: 'half_time', text: 'מחצית', big: false });
  moments.push({ minute: 90, kind: 'full_time', text: 'שריקת סיום', big: false });
  moments.sort((a, b) => a.minute - b.minute || (a.kind === 'kickoff' ? -1 : 0));

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
    scoreFor,
    scoreAgainst,
    moments,
    factsLine,
  };
}

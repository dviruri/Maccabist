import { getLeague } from '../data/leagues';
import { trophyIcon } from '../data/trophies';
import { LEGACY_MILESTONES } from '../game/maccabiLegacy';
import type { Milestone, Career, SeasonRecord, SeasonStats } from '../types';
import { cupRunLabel } from '../game/cupEngine';
import { seasonFixtures } from '../game/leagueTruth';
import { levelContext } from '../game/rules';
import { teamDisplayFor, teamDisplayLine } from '../game/identity';
import { clubSeasonFor, isBadSeason, isGoodSeason } from '../game/worldEngine';
import { headlineTitle, roleTextOf, seasonLabel } from '../ui/format';
import { Chip, DeltaList, Ltr, NumberBox } from './primitives';
import { StageLadder } from './StageLadder';
import { situationText } from './LeagueTableCard';
import { currentLeagueContext } from '../game/leagueEngine';

/** Which numbers matter depends on where you play. */
function StatBoxes({
  career,
  stats,
  teamGames,
}: {
  career: Career;
  stats: SeasonStats;
  /** How many matches the team played, so appearances have a denominator. */
  teamGames?: number;
}): JSX.Element {
  const isKeeper = career.position === 'GK';
  const isDefender = career.position === 'CB' || career.position === 'FB';

  return (
    <div className="numbers">
      {/*
        "משחקים: 5" reads as though the whole season was five matches. Showing the team's
        fixture count alongside makes it clear that five appearances out of twenty-two is a
        squad player's season, not a short season.
      */}
      <NumberBox
        value={stats.appearances}
        label={teamGames ? `הופעות מתוך ${teamGames}` : 'הופעות'}
      />
      <NumberBox value={stats.starts} label="בהרכב" />
      {isKeeper ? (
        <>
          <NumberBox value={stats.cleanSheets} label="שערים נקיים" />
          <NumberBox value={stats.goalsConceded} label="ספג" />
        </>
      ) : (
        <>
          <NumberBox value={stats.goals} label="שערים" />
          <NumberBox value={stats.assists} label="בישולים" />
          {isDefender && <NumberBox value={stats.cleanSheets} label="נקיים" />}
        </>
      )}
    </div>
  );
}

/** Coach's read at the half-way point - it colours what the mid-season event will be. */
function coachVerdict(career: Career, stats: SeasonStats): string {
  if (career.coachTrust >= 72) return 'המאמן מרוצה מאוד מההתקדמות שלך';
  if (career.coachTrust >= 55) return 'המאמן מרוצה מההתקדמות שלך';
  if (career.coachTrust >= 40) return 'המאמן עוד לא החליט מה הוא חושב עליך';
  if (stats.appearances < 4) return 'המקום שלך בסגל בסכנה';
  return 'המקום שלך בהרכב בסכנה';
}

/**
 * How the club itself did (v0.4).
 *
 * A career happens inside a season that belongs to a team, and until now the player could win
 * promotion or be relegated without ever being told. Looked up by season rather than taking the
 * latest entry, so an academy season - which has no club season - shows nothing instead of last
 * year's finish.
 */
function ClubSeasonLine({ career, season }: { career: Career; season: number }): JSX.Element | null {
  const result = clubSeasonFor(career, season);
  if (!result) return null;

  const league = getLeague(result.leagueId);
  const tone = isGoodSeason(result.outcome) ? 'gold' : isBadSeason(result.outcome) ? 'warn' : 'plain';

  return (
    <div className="row-between">
      <div className="faint">
        {league.name}
        {/*
          v0.4.6: the actual finishing position, not only the category. "מקום 4" is what a
          supporter would say; "חלק עליון בטבלה" is what a database would.
        */}
        {result.finalPosition !== undefined && (
          <span className="season-finish">
            {' · מקום '}
            <Ltr>{result.finalPosition}</Ltr>
          </span>
        )}
      </div>
      <Chip tone={tone}>{result.label}</Chip>
    </div>
  );
}

/**
 * Where the club stands right now, mid-season (v0.4.6, Phase 37).
 *
 * The same `leagueContext` the events are gated on, so a player told he is in a title race is
 * being told the thing that decides which events he can receive.
 */
function LeagueStanding({ career }: { career: Career }): JSX.Element | null {
  const context = currentLeagueContext(career);
  if (!context) return null;

  return (
    <div className="standing-line">
      <span className="standing-pos">
        מקום <Ltr>{context.position}</Ltr>
      </span>
      <span className="standing-text">{situationText(context)}</span>
    </div>
  );
}

interface MidProps {
  career: Career;
  onContinue: () => void;
}

export function MidSeasonCard({ career, onContinue }: MidProps): JSX.Element | null {
  const stats = career.firstHalfStats;
  if (!stats) return null;

  return (
    <article className="card event-card">
      <div className="stack">
        <div className="kicker">מחצית עונה</div>
        <h2 className="card-title">
          {headlineTitle(career)} · <Ltr>{seasonLabel(career.currentSeason)}</Ltr>
        </h2>

        {/*
          Half-way through, the table is half the story (v0.4.6, Phase 37). Shown above the
          player's own numbers because "we are second, four off the top" is the context his
          twelve appearances happened inside.
        */}
        <LeagueStanding career={career} />

        <StatBoxes career={career} stats={stats} teamGames={Math.round(levelContext(career).seasonGames / 2)} />

        <p className="card-body" style={{ marginTop: 2 }}>
          {coachVerdict(career, stats)}.
        </p>

        <button type="button" className="btn btn-primary" onClick={onContinue}>
          להמשך העונה
        </button>
      </div>
    </article>
  );
}

interface SeasonProps {
  career: Career;
  onContinue: () => void;
}


/** The legacy milestones announced in a given season, straight off the timeline (v0.6). */
function legacyMoments(career: Career, season: number): Milestone[] {
  const legacyIds = new Set(LEGACY_MILESTONES.map((m) => m.id));
  return career.milestones.filter((m) => m.season === season && legacyIds.has(m.id));
}

export function SeasonResultCard({ career, onContinue }: SeasonProps): JSX.Element | null {
  const record = career.lastSeasonRecord;
  if (!record) return null;

  const barelyPlayed = record.stats.appearances < 5 && record.age >= 16;

  /*
   * The season summary is a chapter ending (v0.4.5).
   *
   * The v0.4 version was a card with a heading and four number boxes. This leads with the season
   * as a poster line, then the club's own result, then the player's — because "we won the league"
   * is the headline and "I played 27 times" is the detail underneath it.
   */
  return (
    <article className="card season-card">
      <div className="stack">
        <div className="season-head">
          <div className="season-year">
            <Ltr>{seasonLabel(record.season)}</Ltr>
          </div>
          {/*
            Rendered from the record's own club and stage through the identity module (v0.4.1),
            so a past season keeps the wording that was correct at the time and a first-team
            season never reads as an academy one.
          */}
          <div className="season-team">
            {teamDisplayLine(teamDisplayFor(record.clubId, record.academyStage, record.onLoan))}
          </div>
          <Chip tone="plain">{roleTextOf(record.role, record.captain)}</Chip>
        </div>

        <ClubSeasonLine career={career} season={record.season} />

        {/*
          v0.6.5.2: the minutes denominator is THIS season's schedule. It used to be the player's
          current level, so scrolling back through history re-scored every old season against
          wherever he happens to play today.
        */}
        <StatBoxes career={career} stats={record.stats} teamGames={seasonFixtures(record, career.world)} />

        {/*
          מורשת מכבי (v0.6, Phase 29): when this season crossed a legacy milestone, one compact
          line says so. Selected from the timeline the engine already wrote - the summary
          renders the fact, it never computes thresholds itself.
        */}
        {legacyMoments(career, record.season).map((moment) => (
          <p key={moment.id} className="season-legacy-line">
            {moment.icon} <b>מורשת מכבי:</b> {moment.text}
          </p>
        ))}

        {record.stats.injuredGames > 0 && (
          <p className="faint">
            🩹 פספסת <Ltr>{record.stats.injuredGames}</Ltr> משחקים בגלל פציעה.
          </p>
        )}
        {barelyPlayed && record.stats.injuredGames === 0 && (
          <p className="faint">כמעט ולא ראית דקות העונה. זה מתחיל להיות בעיה.</p>
        )}

        {record.trophies.length > 0 && (
          <div className="stack-sm">
            {record.trophies.map((trophy, i) => (
              <div
                key={trophy.id}
                className="trophy-line"
                style={{ animationDelay: `${180 + i * 120}ms` }}
              >
                <span aria-hidden>{trophyIcon(trophy.id)}</span>
                {trophy.name}!
              </div>
            ))}
          </div>
        )}

        {/*
          The cup, when it did not end in a trophy (v0.6.2).
          A won cup is already on the trophy line above; what was missing was everything else. The
          cup run is now an authoritative season fact, so a lost final can finally be reported -
          and a player who was told he played a final gets told how it ended.
        */}
        <CupRunLine career={career} record={record} />

        <SeasonMemories career={career} season={record.season} />

        {career.lastSeasonDeltas.length > 0 && (
          <div className="stack-sm">
            <div className="kicker">התקדמות</div>
            <DeltaList deltas={career.lastSeasonDeltas} />
          </div>
        )}

        <button type="button" className="btn btn-primary" onClick={onContinue}>
          המשך
        </button>
      </div>
    </article>
  );
}

/**
 * What you will remember from this season (v0.4.5.1).
 *
 * The numbers say 27 appearances and 9 goals; they do not say that one of them was your first
 * for the first team. The season card ended without ever mentioning the things the career will
 * still be talking about in fifteen years.
 *
 * Built from milestones rather than from `career.memories`. Milestones are already the engine's
 * own judgement of what mattered, and they already carry written Hebrew - reading the memory log
 * instead would have meant inventing a display string for all fifty-odd MemoryKinds, most of
 * which are gating flags rather than moments a player would recount.
 */
function SeasonMemories({ career, season }: { career: Career; season: number }): JSX.Element | null {
  const moments = career.milestones.filter((m) => m.season === season);
  if (moments.length === 0) return null;

  return (
    <div className="stack-sm">
      <div className="kicker">מה שתזכור מהעונה</div>
      <ul className="season-memories">
        {moments.map((moment) => (
          <li key={moment.id} className={`season-memory${moment.major ? ' is-major' : ''}`}>
            <span className="season-memory-icon" aria-hidden>
              {moment.icon}
            </span>
            <span>{moment.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ProgressionProps {
  career: Career;
  onContinue: () => void;
}

/** The academy ladder moment - promotion, a jumped year, or a season standing still. */
/**
 * How the cup ended, when it did not end with a trophy.
 *
 * Read straight off `world.cup`, matched to the record's own season and club rather than through
 * `currentCup` - the summary is shown at season end, when "current" is about to mean the next one.
 * An early exit says nothing: a club going out in the second round is not news.
 */
function CupRunLine({ career, record }: { career: Career; record: SeasonRecord }): JSX.Element | null {
  const cup = career.world.cup;
  if (!cup || cup.season !== record.season || cup.clubId !== record.clubId) return null;
  if (cup.run === 'winners' || cup.run === 'early_exit') return null;
  return <p className="faint">🥈 {cupRunLabel(cup.run)}.</p>;
}

export function ProgressionCard({ career, onContinue }: ProgressionProps): JSX.Element | null {
  const progression = career.lastProgression;
  if (!progression) return null;

  return (
    <article className={`card promotion-card tone-${progression.kind}`}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="promotion-icon" aria-hidden>
          {progression.icon}
        </div>
        <h2 className="promotion-title">{progression.title}</h2>
        <p className="card-body">{progression.detail}</p>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          לעונה הבאה
        </button>
      </div>
    </article>
  );
}

interface YouthProps {
  career: Career;
  onChoose: (offerId: string | null) => void;
}

/** נוער → בוגרים. The single biggest fork in the youth career. */
export function YouthTransitionCard({ career, onChoose }: YouthProps): JSX.Element | null {
  const verdict = career.lastProgression;
  if (!verdict) return null;
  const offers = career.pendingOffers;

  return (
    <article className={`card promotion-card tone-${verdict.kind}`}>
      <div className="stack">
        <div style={{ textAlign: 'center' }}>
          <div className="promotion-icon" aria-hidden>
            {verdict.icon}
          </div>
          <div className="kicker" style={{ marginTop: 6 }}>
            סוף הדרך בנוער
          </div>
          <h2 className="promotion-title">{verdict.title}</h2>
        </div>
        <p className="card-body">{verdict.detail}</p>

        {/*
          The ladder, one last time. Reaching בוגרים lights every rung including the one at the
          end, which is the payoff for ten seasons of climbing; another year in נוער shows him
          still one rung short, which is the honest version of the same picture. A released
          player gets no ladder - the road stopped, and drawing it would be cruel and wrong.
        */}
        {verdict.kind !== 'released' && (
          <div className="promotion-ladder">
            <StageLadder from={verdict.fromStage} to={verdict.toStage} />
          </div>
        )}

        {offers.length > 0 ? (
          <div className="stack-sm">
            {offers.map((offer) => (
              <button
                key={offer.id}
                type="button"
                className="btn btn-choice"
                onClick={() => onChoose(offer.id)}
              >
                <span>{offer.acceptLabel}</span>
                <span className="hint">
                  {offer.clubName} · {offer.league}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => onChoose(null)}>
            להמשיך
          </button>
        )}
      </div>
    </article>
  );
}

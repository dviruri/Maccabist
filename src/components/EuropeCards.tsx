import { getCompetitionAsset } from '../data/competitionAssets';
import { QUALIFYING_GRAPH, LEAGUE_PHASE, LP_DROP_TARGETS, UEFA_COMPETITIONS, inCompetition } from '../data/uefa';
import type { Career, EuropeanJourney, EuropeanStep, EuropeanTie, UefaCompetitionId } from '../types';
import { nextSeasonRoute } from '../game/europeStatus';
import { CinematicBackdrop } from './gamefeel';
import { CompetitionMark } from './honorIcons';
import { Ltr } from './primitives';

/**
 * The European journey, rendered (v0.8).
 *
 * The journey IS the feature: זכינו באליפות → אנחנו במוקדמות → הודחנו, ירדנו לאירופית → עברנו
 * שלב → שלב הליגה → מקום 14 → פלייאוף → שמינית גמר. These components tell that story - the
 * qualifying card leads with what winning and losing MEAN (the fall-down destination is the
 * drama of a qualifier), the summary tells the whole season in stage lines, and nothing here
 * renders background fixtures the player has no stake in.
 */

const STAGE_LABELS: Record<string, string> = {
  ko_playoff: 'פלייאוף הנוקאאוט',
  r16: 'שמינית הגמר',
  qf: 'רבע הגמר',
  sf: 'חצי הגמר',
  final: 'הגמר',
};

function stageLabel(stage: string, competition: UefaCompetitionId): string {
  return QUALIFYING_GRAPH[stage]?.label ?? STAGE_LABELS[stage] ?? UEFA_COMPETITIONS[competition].name;
}

function destinationLabel(dest: string, competition: UefaCompetitionId): string {
  if (dest === 'out') return 'הקיץ האירופי נגמר';
  if (dest === LEAGUE_PHASE) return `שלב הליגה של ${UEFA_COMPETITIONS[competition].name}`;
  const drop = LP_DROP_TARGETS[dest];
  if (drop) return `שלב הליגה של ${UEFA_COMPETITIONS[drop].name}`;
  const node = QUALIFYING_GRAPH[dest];
  return node ? node.label : dest;
}

function CompetitionBadge({ competition, size = 20 }: { competition: UefaCompetitionId; size?: number }): JSX.Element {
  const asset = getCompetitionAsset(competition);
  if (asset) {
    return <img className="euro-mark" src={asset} width={size} height={size} alt="" aria-hidden />;
  }
  return <CompetitionMark competition={competition} size={size} />;
}

function TieLine({ tie }: { tie: EuropeanTie }): JSX.Element {
  return (
    <div className={`euro-tie${tie.won ? ' euro-tie-won' : ' euro-tie-lost'}`}>
      <div className="euro-tie-head">
        <span className="euro-tie-stage">{stageLabel(tie.stage, tie.competition)}</span>
        <span className={`euro-tie-verdict${tie.won ? ' euro-up' : ''}`}>{tie.won ? 'עלינו' : 'הודחנו'}</span>
      </div>
      <div className="euro-tie-body">
        <span className="euro-tie-opponent">מול {tie.opponentName}</span>
        <span className="euro-tie-agg">
          <Ltr>
            {tie.aggFor}–{tie.aggAgainst}
          </Ltr>
          {tie.legs.length > 1 ? ' סה״כ' : ''}
          {tie.decidedBy === 'extra_time' ? ' (הארכה)' : tie.decidedBy === 'penalties' ? ' (פנדלים)' : ''}
        </span>
      </div>
    </div>
  );
}

/**
 * The preseason Europe card: where the club stands after the summer of qualifying.
 *
 * Qualifying is summer football, so its ties are shown resolved here - and every qualifying
 * line carries the fact that makes qualifiers dramatic: where defeat sends you. The card ends
 * with the honest state of the autumn: a league phase, or a summer that ended.
 */
export function EuropeCard({
  career,
  onOpenStandings,
}: {
  career: Career;
  /** Opens the 36-club league-phase table (v0.9.1). Absent in previews. */
  onOpenStandings?: () => void;
}): JSX.Element | null {
  const journey = career.world.europe?.current?.playerJourney;
  if (!journey || journey.season !== career.currentSeason || journey.clubId !== career.currentClubId) {
    return null;
  }

  const entered = journey.steps.find(
    (step): step is Extract<EuropeanStep, { kind: 'entered' }> => step.kind === 'entered',
  );
  const nextRoute = nextSeasonRoute(career, career.currentClubId);
  const qualifyingSteps = journey.steps.filter(
    (step) => (step.kind === 'tie' && step.tie.stage in QUALIFYING_GRAPH) || step.kind === 'dropped',
  );

  return (
    /*
     * v0.9: European nights get the europe-night stadium behind the glass - the same journey
     * facts, under floodlights. Tier still drives the border (gold for the Champions League).
     */
    <CinematicBackdrop backdrop="europe-night" className="gf-euro-scene">
      <section className={`card euro-card euro-${UEFA_COMPETITIONS[journey.finalCompetition].tier} gf-euro-card`}>
      <div className="euro-head">
        <CompetitionBadge competition={journey.finalCompetition} size={26} />
        <div className="euro-head-text">
          {/* v0.9.1: explicitly THIS season, and the competition is the journey's current one -
              a club that dropped to the Conference League reads Conference League here. */}
          <div className="kicker">אירופה העונה</div>
          <div className="euro-title">{UEFA_COMPETITIONS[journey.finalCompetition].name}</div>
        </div>
      </div>

      {entered && entered.entry !== LEAGUE_PHASE && (
        <p className="euro-entry-line">
          {/* The distinction that must never blur: qualifying, not the league phase. */}
          נכנסנו ל{QUALIFYING_GRAPH[entered.entry]?.label ?? entered.entry}
          {entered.reason === 'champion' && ' כאלופת ישראל'}
          {entered.reason === 'cup_winner' && ' כמחזיקת הגביע'}
          {entered.reason === 'titleholder' && ' כמחזיקת התואר האירופי'}
        </p>
      )}
      {entered && entered.entry === LEAGUE_PHASE && (
        <p className="euro-entry-line">מקום ישיר בשלב הליגה</p>
      )}

      {qualifyingSteps.map((step, index) =>
        step.kind === 'tie' ? (
          <TieLine key={index} tie={step.tie} />
        ) : step.kind === 'dropped' ? (
          <p key={index} className="euro-drop-line">
            ← ירדנו ל{step.toEntry === LEAGUE_PHASE ? `שלב הליגה של ${UEFA_COMPETITIONS[step.to].name}` : (QUALIFYING_GRAPH[step.toEntry]?.label ?? UEFA_COMPETITIONS[step.to].name)}
          </p>
        ) : null,
      )}

      {journey.reachedLeaguePhase ? (
        <p className="euro-state-line euro-up">בשלב הליגה של {UEFA_COMPETITIONS[journey.finalCompetition].name} — העונה האירופית לפנינו</p>
      ) : (
        <p className="euro-state-line">העונה האירופית הסתיימה בקיץ. הליגה מחכה.</p>
      )}

      {/*
        v0.9.1: next season's earned route is a DIFFERENT fact and is labelled as one. It comes
        from the v0.8 resolver's own nextEntries, so the access rules are never re-derived here.
      */}
      {journey.reachedLeaguePhase && onOpenStandings && career.world.europe?.current?.standings && (
        <button type="button" className="euro-standings-link" onClick={onOpenStandings}>
          לטבלת שלב הליגה ›
        </button>
      )}

      {nextRoute && (
        <p className="euro-next-line">
          אירופה בעונה הבאה: {nextRoute.inLeaguePhase ? `${nextRoute.competitionName} — שלב הליגה` : nextRoute.stage}
        </p>
      )}
      </section>
    </CinematicBackdrop>
  );
}

/**
 * The whole journey as season-summary story lines - the record the archive keeps, told in the
 * order it happened, ending in a standing, an exit, or a trophy.
 */
export function EuropeJourneySummary({ journey }: { journey: EuropeanJourney }): JSX.Element {
  return (
    <div className="euro-journey">
      {journey.steps.map((step, index) => {
        switch (step.kind) {
          case 'entered':
            return (
              <div key={index} className="euro-journey-line euro-journey-entered">
                <CompetitionBadge competition={step.competition} size={16} />
                {step.entry === LEAGUE_PHASE
                  ? `${UEFA_COMPETITIONS[step.competition].name} — שלב הליגה`
                  : (QUALIFYING_GRAPH[step.entry]?.label ?? UEFA_COMPETITIONS[step.competition].name)}
              </div>
            );
          case 'tie':
            return <TieLine key={index} tie={step.tie} />;
          case 'dropped':
            return (
              <div key={index} className="euro-journey-line euro-drop-line">
                ← {destinationLabel(step.toEntry === LEAGUE_PHASE ? LEAGUE_PHASE : step.toEntry, step.to)}
              </div>
            );
          case 'league_phase':
            return (
              <div key={index} className="euro-journey-line">
                <CompetitionBadge competition={step.competition} size={16} />
                שלב הליגה — מקום <Ltr>{step.position}</Ltr> (<Ltr>{step.points}</Ltr> נק׳,{' '}
                <Ltr>{`${step.won}-${step.drawn}-${step.lost}`}</Ltr>)
                {step.position <= 8
                  ? ' — ישירות לשמינית הגמר'
                  : step.position <= 24
                    ? ' — לפלייאוף הנוקאאוט'
                    : ' — סוף הדרך האירופית'}
              </div>
            );
          case 'champion':
            return (
              <div key={index} className="euro-journey-line euro-champion-line">
                <CompetitionBadge competition={step.competition} size={18} />
                🏆 זכייה {inCompetition(UEFA_COMPETITIONS[step.competition].name)}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

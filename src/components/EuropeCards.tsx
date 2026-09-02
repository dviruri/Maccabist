import {
  europeReveal,
  mayShowLeaguePhaseTable,
  revealedSteps,
  visibleEuropeanCampaign,
} from '../game/europePresentation';
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

  const nextRoute = nextSeasonRoute(career, career.currentClubId);
  const reveal = europeReveal(career);
  /*
   * EVERYTHING this card renders comes from `shown`, never from `journey.steps` (v0.9.6).
   *
   * Two rules meet here. Byes belong in the qualifying story - without them it renders the rounds
   * that had a MATCH and silently omits the one the club was given, so Q1 is followed by Q3. And
   * nothing may be rendered that the player has not lived through, which is what `revealedSteps`
   * decides. Reading the raw journey for even one field - the entry, say - is how a component
   * starts having its own opinion about chronology.
   */
  /*
   * v0.9.6.1: the header, the badge and the tier styling all come from the VISIBLE campaign.
   *
   * They used to read `journey.finalCompetition` - a future-complete field - so this card could
   * print "הקונפרנס ליג" at the top while its own entry line three rows below said
   * "נכנסנו למוקדמות ליגת האלופות". One card, two competitions, at preseason.
   */
  const visible = visibleEuropeanCampaign(career, career.currentClubId);
  /*
   * Fail closed rather than fall back. Inside this block the journey exists and belongs to this
   * club, so the resolver cannot legitimately return null - and a `?? journey.finalCompetition`
   * fallback would quietly reintroduce the future-complete read this phase removed, in the one
   * branch nobody tests.
   */
  if (!visible) return null;
  const shown = revealedSteps(career, journey);
  const entered = shown.find(
    (step): step is Extract<EuropeanStep, { kind: 'entered' }> => step.kind === 'entered',
  );
  const qualifyingSteps = shown.filter(
    (step) =>
      (step.kind === 'tie' && step.tie.stage in QUALIFYING_GRAPH) ||
      step.kind === 'dropped' ||
      step.kind === 'bye',
  );

  return (
    /*
     * v0.9: European nights get the europe-night stadium behind the glass - the same journey
     * facts, under floodlights. Tier still drives the border (gold for the Champions League).
     */
    <CinematicBackdrop backdrop="europe-night" className="gf-euro-scene">
      <section className={`card euro-card euro-${UEFA_COMPETITIONS[visible.competition].tier} gf-euro-card`}>
      <div className="euro-head">
        <CompetitionBadge competition={visible.competition} size={26} />
        <div className="euro-head-text">
          {/* v0.9.1: explicitly THIS season, and the competition is the journey's current one -
              a club that dropped to the Conference League reads Conference League here. */}
          <div className="kicker">אירופה העונה</div>
          <div className="euro-title">{visible.competitionName}</div>
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
        ) : step.kind === 'bye' ? (
          <ByeLine key={index} stage={step.stage} />
        ) : step.kind === 'dropped' ? (
          <p key={index} className="euro-drop-line">
            ← ירדנו ל{step.toEntry === LEAGUE_PHASE ? `שלב הליגה של ${UEFA_COMPETITIONS[step.to].name}` : (QUALIFYING_GRAPH[step.toEntry]?.label ?? UEFA_COMPETITIONS[step.to].name)}
          </p>
        ) : null,
      )}

      {/*
        v0.9.6: the state line is chronology-aware.

        Before the season starts there is nothing to report and the entry line above has already
        said where the club came in. Once qualifying is history it may say the club is through and
        that the league phase is UNDER WAY - it may not say where it finished, because it has not.
        Only at settlement does the completed shape of the season become sayable.
      */}
      {reveal === 'entry' ? null : reveal === 'qualifying' ? (
        visible.inLeaguePhase ? (
          <p className="euro-state-line euro-up">
            העפלנו לשלב הליגה של {visible.competitionName} — שלב הליגה בעיצומו
          </p>
        ) : visible.eliminated ? (
          /*
           * Keyed on `eliminated`, not on `!inLeaguePhase` (v0.9.6.2). The two happen to coincide
           * at this reveal - by midseason qualifying is history, so a club is either through or
           * out - but they are different claims, and the feed shipped a season of "Europe is
           * over" to clubs still playing qualifiers by treating one as the other.
           */
          <p className="euro-state-line">
            הודחנו ב{visible.stageShort}. העונה האירופית הסתיימה בקיץ.
          </p>
        ) : (
          <p className="euro-state-line">העונה האירופית הסתיימה בקיץ. הליגה מחכה.</p>
        )
      ) : (
        /*
         * v0.9.6.1: at FULL reveal the season is over, so it is described in the past tense.
         *
         * This branch used to say "בשלב הליגה של X — העונה האירופית לפנינו" - "the European season
         * is ahead of us" - on a settled season that had already finished. Chronologically
         * impossible, and the one place in the card that still spoke as though the future were
         * coming.
         *
         * Every fact below is one the journey already records: the trophy, the furthest knockout
         * stage reached, or the league phase. Nothing new is invented.
         */
        <p className={`euro-state-line${journey.wonCompetition ? ' euro-up' : ''}`}>
          {journey.wonCompetition
            ? `זכינו ב${UEFA_COMPETITIONS[journey.wonCompetition].name}!`
            : KNOCKOUT_TITLES[journey.furthest]
              ? `${UEFA_COMPETITIONS[journey.finalCompetition].name} — הגענו ל${KNOCKOUT_TITLES[journey.furthest]}`
              : journey.reachedLeaguePhase
                ? `סיימנו את שלב הליגה של ${UEFA_COMPETITIONS[journey.finalCompetition].name}`
                : 'העונה האירופית הסתיימה בקיץ.'}
        </p>
      )}

      {/*
        v0.9.1: next season's earned route is a DIFFERENT fact and is labelled as one. It comes
        from the v0.8 resolver's own nextEntries, so the access rules are never re-derived here.
      */}
      {/* The table is a RESULT, so the link to it only exists once the table belongs to the past. */}
      {mayShowLeaguePhaseTable(career) && journey.reachedLeaguePhase && onOpenStandings && career.world.europe?.current?.standings && (
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
 * The furthest knockout round a campaign reached, for the settled state line. The same vocabulary
 * `CareerMoments` uses, so the card and the season's moments cannot describe one run two ways.
 */
const KNOCKOUT_TITLES: Record<string, string> = {
  final: 'הגמר',
  sf: 'חצי הגמר',
  qf: 'רבע הגמר',
  r16: 'שמינית הגמר',
  ko_playoff: 'פלייאוף הנוקאאוט',
};

/**
 * A round walked through rather than played (v0.9.6).
 *
 * Names the round and says what happened, which is nothing: an odd field, and the club with the
 * best coefficient goes straight to the next round. No opponent, no score, no legs - a bye has
 * none of those, and drawing an empty scoreline would be inventing a match.
 */
function ByeLine({ stage }: { stage: string }): JSX.Element {
  return (
    <div className="euro-journey-line euro-bye-line">
      <span className="euro-bye-stage">{QUALIFYING_GRAPH[stage]?.label ?? stage}</span>
      <span className="euro-bye-note">מעבר אוטומטי</span>
    </div>
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
          case 'bye':
            return <ByeLine key={index} stage={step.stage} />;
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

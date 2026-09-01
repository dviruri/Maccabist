import { deriveCareerFeed, type FeedItem } from '../game/careerFeed';
import { getPersonArt } from '../ui/playerArt';
import { activeFixture, knownCupFinal } from '../game/fixture';
import { revealedFurthest, revealedSteps } from '../game/europePresentation';
import { currentCampaign } from '../game/europeStatus';
import { currentLeagueContext } from '../game/leagueEngine';
import { isInAcademy } from '../game/rules';
import { seasonPhaseSteps } from '../ui/format';
import type { Career } from '../types';
import { ClubCrest } from './ClubCrest';
import { CinematicBackdrop, PlayerHero } from './gamefeel';
import { stakesText } from './SeasonStrip';
import { Ltr } from './primitives';

/**
 * The cinematic career home (v0.9, Phase 2 · rebuilt v0.9.3, Phase 2).
 *
 * The concept's four questions, answered in order: WHO AM I (the hero) → WHERE AM I (the status
 * row) → WHAT IS NEXT (the fixture strip) → WHAT IS HAPPENING (one or two feed lines).
 *
 * ## v0.9.3: a screen, not a page
 *
 * v0.9.2 got the composition right and the LENGTH wrong. Home was a hero, then a next-match
 * card, then a four-item feed, then a league strip, then a full Europe card, then the season's
 * phase view - a document containing every state of the game at once. Measured at 390x844 it
 * wanted 1096px, so a third of it lived below the fold.
 *
 * So this screen summarises and nothing else. The league is one tappable chip instead of a
 * strip; Europe is one tappable chip instead of a card; the feed is the two most relevant lines
 * with עוד for the rest. Everything removed already had a destination - the table sheet, the
 * Europe sheet, the story sheet - so nothing was deleted and nothing is duplicated.
 *
 * ## The honesty rule that shaped this file
 *
 * The engine simulates seasons, not a fixture calendar - there is no literal "next match"
 * object. So the fixture strip shows the season's next REAL chapter, derived from state that
 * actually exists: a pending cup final names the real final opponent the cup state committed
 * to; a European knockout names the real tie from the stored journey; otherwise the league beat
 * shows the player's actual table position against the nearest real rival. Nothing invents a
 * kickoff time the game does not model; the timing line speaks in season phases, which are real.
 *
 * The feed is deterministic templates over live state - coach lines from the actual role and
 * trust, agent lines from actual pending offers, media lines from actual mid-season form, Europe
 * lines from the actual journey. No rng is consumed; the same state renders the same feed.
 */

/* ------------------------------------------------------------------ */
/* Where am I                                                          */
/* ------------------------------------------------------------------ */

/**
 * The situation, in chips (v0.9.3).
 *
 * What replaced `SeasonStrip` and the `EuropeCard` on the home screen. Each chip is the ONE fact
 * a player needs in order to read his own season - the table position and what it means, the
 * competition he is actually in - and a tap onto the screen that holds the rest. The strip and
 * the card still exist, unchanged, inside those sheets.
 *
 * `stakesText` is imported from `SeasonStrip` rather than reimplemented, so the chip and the
 * strip can never say different things about the same table.
 */
function HomeStatusRow({
  career,
  showEurope,
  onOpenTable,
  onOpenEurope,
}: {
  career: Career;
  /**
   * False when the contextual slot below is already showing Europe (v0.9.4). Otherwise the screen
   * says "הקונפרנס ליג" in a chip and "הקונפרנס ליג · מקום 12" in a panel three rows later, which
   * is the same fact twice on a screen whose whole point is that it says each thing once.
   */
  showEurope: boolean;
  onOpenTable: () => void;
  onOpenEurope: () => void;
}): JSX.Element | null {
  const league = currentLeagueContext(career);
  /* The club's LIVE campaign, which follows drop-downs - never its starting entry (v0.9.1). */
  const europe = showEurope ? currentCampaign(career, career.currentClubId) : null;
  /* Academy football has no table; the season's shape is still real and worth one word. */
  const phase = league ? null : seasonPhaseSteps(career).find((step) => step.current)?.label ?? null;

  if (!league && !europe && !phase) return null;

  return (
    <div className="gf-status">
      {league && (
        <button type="button" className="gf-chip gf-chip-tap" onClick={onOpenTable}>
          <span className="gf-chip-value">
            <Ltr>{league.position}</Ltr>
          </span>
          <span className="gf-chip-text">{stakesText(league)}</span>
        </button>
      )}
      {europe && (
        <button type="button" className="gf-chip gf-chip-tap gf-chip-euro" onClick={onOpenEurope}>
          <span className="gf-chip-text">{europe.competitionName}</span>
        </button>
      )}
      {/* the season's shape, when there is no table to read it from */}
      {phase && (
        <span className="gf-chip">
          <span className="gf-chip-text">{phase}</span>
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What is next                                                        */
/* ------------------------------------------------------------------ */

/**
 * The next-match strip, rendered from THE fixture (v0.9.1, compacted v0.9.3).
 *
 * v0.9 derived its own opponent here - the nearest table rival - while the matchday derived a
 * different one. Both are gone: `activeFixture` is the single answer, so the crest the player
 * sees on the home screen is the crest he sees after kickoff, always.
 *
 * v0.9.3 turned it from a tall bordered card into one row: competition above, crest VS crest,
 * and the stake in a single line under it. Same facts, roughly half the height.
 */
function NextChapterStrip({ career }: { career: Career }): JSX.Element | null {
  const fixture = activeFixture(career);
  const teasedFinal = knownCupFinal(career);
  if (!fixture) return null;

  const caption =
    fixture.kind === 'cup_final'
      ? 'משחק אחד על תואר'
      : fixture.kind === 'european'
        ? 'לילה אירופי'
        : fixture.playerPosition !== null && fixture.opponentPosition !== null
          ? `מקום ${fixture.playerPosition} נגד מקום ${fixture.opponentPosition}`
          : fixture.opponentPosition !== null
            ? `היריבה במקום ${fixture.opponentPosition}`
            : fixture.home
              ? 'בבית'
              : 'בחוץ';

  const timing =
    fixture.kind === 'cup_final'
      ? 'גמר'
      : fixture.kind === 'european'
        ? 'באביב'
        : career.seasonPoint === 'preseason'
          ? 'פתיחת העונה'
          : career.seasonPoint === 'midseason'
            ? 'המחזור הבא'
            : 'סיום העונה';

  return (
    <div className={`gf-next${fixture.kind === 'european' ? ' gf-next-euro' : ''}`}>
      <div className="gf-next-head">
        <span className="gf-next-title">המשחק הבא</span>
        <span className="gf-next-when">{timing}</span>
      </div>
      <div className="gf-next-clubs">
        <div className="gf-next-club">
          <ClubCrest clubId={fixture.playerClubId} name={fixture.playerClubName} size="large" />
          <span>{fixture.playerClubName}</span>
        </div>
        <span className="gf-next-vs" aria-hidden>
          VS
        </span>
        <div className="gf-next-club">
          <ClubCrest clubId={fixture.opponentClubId} name={fixture.opponentName} size="large" />
          <span>{fixture.opponentName}</span>
        </div>
      </div>
      <div className="gf-next-caption">
        {fixture.competition}
        {fixture.stage ? ` · ${fixture.stage}` : ''}
        {` · ${fixture.home ? 'בבית' : 'בחוץ'} · ${caption}`}
      </div>
      {/*
        v0.9.2: the cup final is committed early and played last. It may be TEASED here - the
        club knows who it would meet - but the fixture above stays the season's actual next
        match, because known is not active.
      */}
      {teasedFinal && fixture.kind !== 'cup_final' && (
        <div className="gf-next-tease">
          🏆 {teasedFinal.competition}: {teasedFinal.opponentName} — בסיום העונה
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What is happening                                                   */
/* ------------------------------------------------------------------ */

/**
 * The season's European situation, compact (v0.9.4, Phase 1).
 *
 * What the brief asked for and nothing more: the competition he is actually in, where he is in it,
 * and a way to the rest. The full journey - the entry route, every qualifying round, the drop-downs,
 * next season's route, the 36-club table - lives in the Europe sheet, which is a scrolling
 * destination and can afford all of it.
 *
 * Every value is the v0.9.1 separation's: `currentCampaign` follows the recorded journey, so a club
 * that fell from the Champions League to the Conference League reads Conference League. Next
 * season's route is not shown here at all, because it is not a present fact.
 */
function EuropeContext({
  career,
  onOpenEurope,
}: {
  career: Career;
  onOpenEurope: () => void;
}): JSX.Element | null {
  const campaign = currentCampaign(career, career.currentClubId);
  if (!campaign) return null;
  const journey = career.world.europe?.current?.playerJourney;
  /*
   * v0.9.6: what the player has LIVED THROUGH, not what the engine has already simulated.
   *
   * This line used to read the `league_phase` step straight out of the stored journey and print
   * its position - so at the first preseason beat, before a single European match had been
   * played, the home screen announced the club's FINAL European standing. The engine runs the
   * whole continental season up front, which is correct for determinism and catastrophic as a
   * source of truth for a screen.
   *
   * `europePresentation` is now the only thing that decides what may be said, and it says
   * nothing about a result until the result belongs to the past.
   */
  const revealed = journey ? revealedSteps(career, journey) : [];
  const phase = revealed.find((step) => step.kind === 'league_phase');
  const furthest = journey ? revealedFurthest(career, journey) : null;
  const where =
    phase && phase.kind === 'league_phase'
      ? `מקום ${phase.position}`
      : furthest && furthest !== 'entry'
        ? EURO_STAGE_TEXT[furthest] ?? campaign.stage
        : campaign.stage;

  return (
    /*
     * The whole panel is the button, not just the "לפרטים" inside it. On a very short screen the
     * head row is what gives way (see the height tiers in gamefeel.css), and a panel whose only
     * route to the detail lived in that row would become a dead end at 320x568.
     */
    <button type="button" className="gf-context gf-context-euro" onClick={onOpenEurope}>
      <span className="gf-context-head">
        <span className="gf-context-title">אירופה</span>
        <span className="gf-context-more">לפרטים ›</span>
      </span>
      <span className="gf-context-line">
        {campaign.competitionName} · {where}
      </span>
    </button>
  );
}

/** Hebrew for the journey's own furthest-stage codes. Presentation of a stored fact, not a rule. */
const EURO_STAGE_TEXT: Record<string, string> = {
  league_phase: 'שלב הליגה',
  ko_playoff: 'פלייאוף הנוקאאוט',
  r16: 'שמינית הגמר',
  qf: 'רבע הגמר',
  sf: 'חצי הגמר',
  final: 'הגמר',
  winner: 'אלופת אירופה',
};

/**
 * מה קורה עכשיו. The derivation lives in `game/careerFeed.ts` (v0.9.1) - contextual pools with
 * deterministic dedupe, already returned in priority order: the agent's business first, then
 * the coach, then the club, then media colour.
 *
 * v0.9.3 shows at most TWO of them. Four message cards were 250px of the home screen and the
 * fourth was never the reason anyone opened the game; the rest is one tap away under עוד, which
 * opens the story sheet the full feed already lives in.
 */
function FeedLine({ item }: { item: FeedItem }): JSX.Element {
  return (
    <div className="gf-feed-item">
      <img className="gf-feed-face" src={getPersonArt(item.role)} alt="" aria-hidden loading="lazy" />
      <div className="gf-feed-body">
        <span className="gf-feed-role">{item.roleLabel}</span>
        <p className="gf-feed-text">{item.text}</p>
      </div>
    </div>
  );
}

function CareerFeed({ career, onOpenFeed }: { career: Career; onOpenFeed: () => void }): JSX.Element | null {
  const items = deriveCareerFeed(career);
  if (items.length === 0) return null;
  const shown = items.slice(0, 2);
  return (
    /*
     * `gf-feed-home` scopes the short-viewport rules to THIS feed. Without it, the height media
     * query that drops the second line on a 568px screen would also silently truncate the full
     * feed inside the story sheet, which is a scrolling destination and wants all of it.
     */
    <div className="gf-feed gf-feed-home">
      {shown.map((item, index) => (
        <FeedLine key={index} item={item} />
      ))}
      {items.length > shown.length && (
        <button type="button" className="gf-feed-more" onClick={onOpenFeed}>
          עוד ›
        </button>
      )}
    </div>
  );
}

/**
 * The whole feed, for the story destination (v0.9.3, Phase 6).
 *
 * The home shows two lines and offers עוד; this is what עוד opens onto. Same derivation, same
 * markup - the lines are not re-derived or re-worded anywhere, so the two lines on the home
 * screen are literally the first two of these.
 */
export function CareerFeedFull({ career }: { career: Career }): JSX.Element | null {
  const items = deriveCareerFeed(career);
  if (items.length === 0) return null;
  return (
    <div className="gf-feed">
      {items.map((item, index) => (
        <FeedLine key={index} item={item} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

/**
 * ONE contextual panel (v0.9.4, Phase 1).
 *
 * v0.9.3's home stacked the feed under the next match under the status chips. That fits, but it is
 * still three things competing for the same answer to one question - what matters right now - and
 * the brief is explicit that this space should hold exactly one strong panel.
 *
 * So the space is a slot with a priority, and every state in it is a REAL fact:
 *
 *   1. an offer on the table       `pendingOffers` - the most urgent thing a career can have
 *   2. Europe, when it is live     a recorded campaign this season
 *   3. the people around him       the top one or two feed lines, agent first
 *
 * Only the winner renders. Nothing is lost: an offer becomes its own full screen at the offseason
 * beat, Europe's full journey is one tap away, and the whole feed is one tap away under עוד and
 * under הסיפור.
 */
export type HomeContext = 'offer' | 'europe' | 'feed';

/** Which state the slot will show. Exported so the chips above it can avoid repeating it. */
export function homeContextOf(career: Career): HomeContext {
  if (career.pendingOffers.length > 0) return 'offer';
  if (currentCampaign(career, career.currentClubId)) return 'europe';
  return 'feed';
}

function CurrentContextSlot({
  career,
  context,
  onOpenEurope,
  onOpenFeed,
  onOpenPeople,
}: {
  career: Career;
  context: HomeContext;
  onOpenEurope: () => void;
  onOpenFeed: () => void;
  onOpenPeople: () => void;
}): JSX.Element | null {
  /*
   * An offer that has arrived but is not yet the active beat. The decision itself owns the whole
   * screen when the offseason comes; this is the warning that it is coming.
   */
  if (context === 'offer' && career.pendingOffers.length > 0) {
    const count = career.pendingOffers.length;
    return (
      <button type="button" className="gf-context gf-context-urgent" onClick={onOpenPeople}>
        <span className="gf-context-head">
          <span className="gf-context-title">החלטה מחכה</span>
          <span className="gf-context-more">הסוכן ›</span>
        </span>
        <span className="gf-context-line">
          {count === 1
            ? `הצעה אחת על השולחן: ${career.pendingOffers[0]!.clubName}`
            : `${count} הצעות על השולחן`}
        </span>
      </button>
    );
  }

  if (context === 'europe') return <EuropeContext career={career} onOpenEurope={onOpenEurope} />;

  return <CareerFeed career={career} onOpenFeed={onOpenFeed} />;
}

/**
 * The home screen. `focused` collapses it to the compact hero while a decision or event is
 * active - the meta must never push the choice below the fold.
 */
export function CareerHomeScene({
  career,
  focused,
  onOpenCareer,
  onOpenTable,
  onOpenEurope,
  onOpenFeed,
  onOpenPeople,
}: {
  career: Career;
  focused: boolean;
  onOpenCareer: () => void;
  onOpenTable: () => void;
  onOpenEurope: () => void;
  onOpenFeed: () => void;
  onOpenPeople: () => void;
}): JSX.Element {
  const context = homeContextOf(career);
  return (
    <CinematicBackdrop backdrop={isInAcademy(career) ? 'training' : 'home-dark'}>
      <button type="button" className="gf-hero-tap" onClick={onOpenCareer} aria-label="פרטי הקריירה">
        <PlayerHero career={career} compact={focused} />
      </button>
      {!focused && (
        <>
          <HomeStatusRow
            career={career}
            showEurope={context !== 'europe'}
            onOpenTable={onOpenTable}
            onOpenEurope={onOpenEurope}
          />
          <NextChapterStrip career={career} />
          <CurrentContextSlot
            career={career}
            context={context}
            onOpenEurope={onOpenEurope}
            onOpenFeed={onOpenFeed}
            onOpenPeople={onOpenPeople}
          />
        </>
      )}
    </CinematicBackdrop>
  );
}

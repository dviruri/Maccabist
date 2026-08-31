import { QUALIFYING_GRAPH, UEFA_COMPETITIONS } from '../data/uefa';
import { rivalryBetween } from '../data/rivalries';
import { stageConfig } from '../data/academy';
import { clubDisplayName } from '../game/identity';
import { currentTable } from '../game/leagueEngine';
import { isInAcademy } from '../game/rules';
import type { Career, EuropeanStep } from '../types';
import { getPersonArt, type PersonRole } from '../ui/playerArt';
import { ClubCrest } from './ClubCrest';
import { CinematicBackdrop, GameSectionTitle, PlayerHero } from './gamefeel';

/**
 * The cinematic career home (v0.9, Phase 2).
 *
 * The concept's four questions, answered in order: WHO AM I (the hero) → WHERE AM I (club in
 * the hero) → WHAT IS NEXT (the next-chapter fixture hero) → WHAT IS HAPPENING (the feed).
 *
 * ## The honesty rule that shaped this file
 *
 * The engine simulates seasons, not a fixture calendar - there is no literal "next match"
 * object. So the fixture hero shows the season's next REAL chapter, derived from state that
 * actually exists: a pending cup final names the real final opponent the cup state committed
 * to; a European knockout names the real tie from the stored journey; otherwise the league
 * hero shows the player's actual table position against the nearest real rival - "מקום 1 נגד
 * מקום 2", which is the concept's own caption. Nothing invents a kickoff time the game does
 * not model; the timing line speaks in season phases, which are real.
 *
 * The feed is deterministic templates over live state - coach lines from the actual role and
 * trust, agent lines from actual pending offers, media lines from actual mid-season form,
 * Europe lines from the actual journey. No rng is consumed; the same state renders the same
 * feed.
 */

/* ------------------------------------------------------------------ */
/* The next chapter                                                    */
/* ------------------------------------------------------------------ */

interface NextChapter {
  kicker: string;
  homeId: string;
  homeName: string;
  awayId: string;
  awayName: string;
  caption: string;
  timing: string;
  euro?: boolean;
}

/** The season's next real chapter, in priority order: cup final → European tie → league rival. */
export function deriveNextChapter(career: Career): NextChapter | null {
  const clubId = career.currentClubId;
  const clubName = clubDisplayName(clubId);

  /* A cup final the state has committed to, not yet settled. */
  const cup = career.world.cup;
  if (
    cup &&
    cup.season === career.currentSeason &&
    cup.finalOpponentId &&
    (cup.run === 'winners' || cup.run === 'runner_up') &&
    career.seasonPoint !== 'season_end'
  ) {
    return {
      kicker: cup.trophyId === 'youth_cup' ? 'גביע הנוער — הגמר' : 'גביע המדינה — הגמר',
      homeId: clubId,
      homeName: clubName,
      awayId: cup.finalOpponentId,
      awayName: clubDisplayName(cup.finalOpponentId),
      caption: 'משחק אחד על תואר',
      timing: career.seasonPoint === 'midseason' ? 'בהמשך העונה' : 'לקראת סוף העונה',
    };
  }

  /* A European knockout tie from the stored journey - a real opponent, a real stage. */
  const journey = career.world.europe?.current?.playerJourney;
  if (journey && journey.season === career.currentSeason && journey.clubId === clubId) {
    const knockout = journey.steps.find(
      (step): step is Extract<EuropeanStep, { kind: 'tie' }> =>
        step.kind === 'tie' && !(step.tie.stage in QUALIFYING_GRAPH),
    );
    if (knockout && career.seasonPoint !== 'season_end') {
      return {
        kicker: UEFA_COMPETITIONS[knockout.tie.competition].name,
        homeId: clubId,
        homeName: clubName,
        awayId: knockout.tie.opponentId,
        awayName: knockout.tie.opponentName,
        caption: 'לילה אירופי',
        timing: 'באביב',
        euro: true,
      };
    }
  }

  /* The league: the player's real position against the nearest real rival in the same table. */
  const table = currentTable(career);
  if (table) {
    const row = table.rows.find((r) => r.clubId === clubId);
    if (row) {
      const rival =
        table.rows.find((r) => r.position === row.position - 1) ??
        table.rows.find((r) => r.position === row.position + 1);
      if (rival) {
        const derby = rivalryBetween(clubId, rival.clubId);
        return {
          kicker: derby ? derby.name : 'המשחק הגדול הבא',
          homeId: clubId,
          homeName: clubName,
          awayId: rival.clubId,
          awayName: rival.name,
          caption: `מקום ${row.position} נגד מקום ${rival.position}`,
          timing:
            career.seasonPoint === 'preseason'
              ? 'פתיחת העונה'
              : career.seasonPoint === 'midseason'
                ? 'בהמשך המחזור'
                : 'סיום העונה',
        };
      }
    }
  }

  return null;
}

function NextChapterHero({ career }: { career: Career }): JSX.Element | null {
  const next = deriveNextChapter(career);
  if (!next) return null;
  return (
    <div className={`gf-next${next.euro ? ' gf-next-euro' : ''}`}>
      <div className="gf-next-title">המשחק הבא</div>
      <div className="gf-kicker">{next.kicker}</div>
      <div className="gf-next-clubs">
        <div className="gf-next-club">
          <ClubCrest clubId={next.homeId} name={next.homeName} size="large" />
          <span>{next.homeName}</span>
        </div>
        <span className="gf-next-vs" aria-hidden>
          VS
        </span>
        <div className="gf-next-club">
          <ClubCrest clubId={next.awayId} name={next.awayName} size="large" />
          <span>{next.awayName}</span>
        </div>
      </div>
      <div className="gf-next-caption">{next.caption}</div>
      <div className="gf-next-timing">{next.timing}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The feed                                                            */
/* ------------------------------------------------------------------ */

interface FeedItem {
  role: PersonRole;
  roleLabel: string;
  text: string;
}

/**
 * מה קורה עכשיו בקריירה - deterministic templates over real state, newest concern first.
 * Nothing here is an outcome: the coach line reads the actual role, the agent line reads
 * actual pending offers, the media line reads actual mid-season form. Four items at most.
 */
export function deriveCareerFeed(career: Career): FeedItem[] {
  const items: FeedItem[] = [];

  /* Agent: real pending offers speak first. */
  const offers = career.pendingOffers;
  if (offers.length > 0) {
    const foreign = offers.find((offer) => offer.country && offer.country !== 'ישראל');
    items.push({
      role: 'agent',
      roleLabel: 'הסוכן',
      text: foreign
        ? `יש עניין ממועדון ב${foreign.country}.`
        : offers.length > 1
          ? `${offers.length} הצעות על השולחן. צריך לדבר.`
          : 'יש הצעה על השולחן. צריך לדבר.',
    });
  }

  /* Coach: the actual role, as the coach would say it. */
  if (!isInAcademy(career)) {
    const trusted = career.coachTrust >= 55;
    const line =
      career.role === 'star' || career.role === 'icon'
        ? 'הקבוצה נבנית סביבך.'
        : career.role === 'key'
          ? 'אתה מהראשונים בהרכב.'
          : career.role === 'starter'
            ? 'אתה פותח בשבת.'
            : career.role === 'rotation'
              ? trusted
                ? 'תקבל דקות. תהיה מוכן.'
                : 'אתה נלחם על מקום. תוכיח באימונים.'
              : 'אתה צריך להילחם על כל דקה.';
    items.push({ role: 'coach', roleLabel: 'המאמן', text: `המאמן: ${line}` });
  } else {
    items.push({
      role: 'coach',
      roleLabel: 'המאמן',
      text: `המאמן: ${stageConfig(career.academyStage).label} — תמשיך לעבוד, רואים אותך.`,
    });
  }

  /* Media: real mid-season form only - no invented headlines. */
  const half = career.firstHalfStats;
  if (half && half.appearances >= 5) {
    if (career.position === 'GK' && half.cleanSheets >= 3) {
      items.push({
        role: 'journalist',
        roleLabel: 'התקשורת',
        text: `התקשורת: ${half.cleanSheets} שערים נקיים בסיבוב הראשון. השוער הצעיר מושך עניין.`,
      });
    } else if (half.goals >= 5) {
      items.push({
        role: 'journalist',
        roleLabel: 'התקשורת',
        text: `התקשורת: ${half.goals} שערים כבר העונה. מדברים עליך.`,
      });
    } else if (half.rating >= 66) {
      items.push({
        role: 'journalist',
        roleLabel: 'התקשורת',
        text: 'התקשורת: אחרי עוד תצוגה חזקה, השם שלך עולה.',
      });
    }
  }

  /* Europe: the actual journey state. */
  const journey = career.world.europe?.current?.playerJourney;
  if (journey && journey.season === career.currentSeason && journey.clubId === career.currentClubId) {
    items.push({
      role: 'club-director',
      roleLabel: 'המועדון',
      text: journey.reachedLeaguePhase
        ? `המועדון: עונה אירופית ב${UEFA_COMPETITIONS[journey.finalCompetition].name}.`
        : 'המועדון: הקיץ האירופי נגמר מוקדם. הליגה היא הכול עכשיו.',
    });
  }

  /* The most recent major milestone keeps the story warm. */
  if (items.length < 4) {
    const milestone = [...career.milestones].reverse().find((m) => m.major && m.season >= career.currentSeason - 1);
    if (milestone) {
      items.push({ role: 'scout', roleLabel: 'מסביב', text: milestone.text });
    }
  }

  return items.slice(0, 4);
}

function CareerFeed({ career }: { career: Career }): JSX.Element | null {
  const items = deriveCareerFeed(career);
  if (items.length === 0) return null;
  return (
    <div className="gf-feed">
      <GameSectionTitle>מה קורה עכשיו בקריירה</GameSectionTitle>
      {items.map((item, index) => (
        <div key={index} className="gf-feed-item">
          <img className="gf-feed-face" src={getPersonArt(item.role)} alt="" aria-hidden loading="lazy" />
          <div className="gf-feed-body">
            <span className="gf-feed-role">{item.roleLabel}</span>
            <p className="gf-feed-text">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The scene                                                           */
/* ------------------------------------------------------------------ */

/**
 * The home scene at the top of the play screen. `focused` collapses it to the compact hero
 * while a decision or event is active - the meta must never push the choice below the fold.
 */
export function CareerHomeScene({
  career,
  focused,
  onOpenCareer,
}: {
  career: Career;
  focused: boolean;
  onOpenCareer: () => void;
}): JSX.Element {
  return (
    <CinematicBackdrop backdrop={isInAcademy(career) ? 'training' : 'home-dark'}>
      <button type="button" className="gf-hero-tap" onClick={onOpenCareer} aria-label="פרטי הקריירה">
        <PlayerHero career={career} compact={focused} />
      </button>
      {!focused && (
        <>
          <NextChapterHero career={career} />
          <CareerFeed career={career} />
        </>
      )}
    </CinematicBackdrop>
  );
}

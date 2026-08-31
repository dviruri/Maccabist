import { UEFA_COMPETITIONS, inCompetition } from '../data/uefa';
import { getClub } from '../data/clubs';
import { clubDisplayName } from '../game/identity';
import type { BackdropId } from '../ui/playerArt';
import type { Career, EuropeanJourney, UefaCompetitionId } from '../types';
import { getTrophyArt, type TrophyArtId } from '../ui/playerArt';
import { seasonLabel } from '../ui/format';
import { ClubCrest } from './ClubCrest';
import { MomentShell, type MomentOverlay } from './gamefeel';

/**
 * Big career moments (v0.9, Phase 6 · rebuilt v0.9.4, Phase 4).
 *
 * A championship must not look like another card. When the settled season contains a REAL major
 * event, it opens as a full-screen scene - and since v0.9.4 the person celebrating in that scene is
 * the career player: his age band, his position, his club's colours, through `PlayerRender`.
 *
 * ## Why the pack's moment images are no longer the primary visual
 *
 * `moments/championship.webp` and its siblings are complete scenes with a GENERIC FOOTBALLER
 * painted into them. v0.9.3 kept them as background atmosphere behind the career player, dimmed
 * and defocused - and that was still two footballers on one screen, which is worse than one wrong
 * one. There is no reliable way to remove a figure from a raster image.
 *
 * So a moment is composed instead, from layers that contain no people:
 *
 *   backdrop   an empty stadium - trophy ceremony, European night, matchday crowd, home dark
 *   overlay    confetti, star lights, smoke
 *   object     a trophy, which is a transparent object and not a scene
 *   player     PlayerRender, who is the only person on the screen
 *
 * The field is called `object` rather than `art` on purpose: the type will not accept a scene.
 *
 * ## Every trigger is a stored fact
 *
 * A typed trophy, the settled record's own European journey, the world's own relegation outcome,
 * the deduped first-league-phase milestone. Nothing here is rolled, invented, or inferred from
 * narrative text - if the fact is not in state, the moment does not exist. Order is prestige: a
 * European trophy outranks the championship, which outranks the cup; relegation comes last and
 * gets no confetti and no celebration pose, because a moment system that only celebrates is a
 * liar.
 */

export interface CareerMoment {
  key: string;
  backdrop: BackdropId;
  overlay?: MomentOverlay;
  /**
   * A trophy or award: a transparent OBJECT with no person in it. Never a moment scene - see the
   * note above about why two footballers on one screen is worse than one wrong one.
   */
  object?: string;
  kicker: string;
  title: string;
  subtitle: string;
  /** Club whose crest belongs on the moment, when the moment is about arriving somewhere. */
  clubId?: string;
  /**
   * Whose colours he wears in this moment (v0.9.4). Usually the club of the season being settled,
   * which is not always his current one - a championship won before a summer move is still that
   * club's championship.
   */
  kitClubId: string;
  /** His age at the moment, so a youth milestone shows the youth character and not the adult. */
  age?: number;
  /**
   * How the career player should be drawn.
   *
   * `celebration` for a night he celebrates, `hero` for one he does not - a relegation moment with
   * a celebrating player would be the moment system lying, which is the same reason relegation
   * never gets confetti. `none` for a moment he is not visually part of.
   */
  mood: 'celebration' | 'hero' | 'none';
}

/**
 * The arrival at a new club (v0.9.1) - shown once, at the first preseason AFTER a move.
 *
 * Derived from a fact the career already carries: the last senior season was played somewhere else.
 * Nothing about the transfer is invented - no salary, no shirt number, no contract length, because
 * the game models none of them; the ceremony names the club, the league and the season.
 *
 * v0.9.4: and he is already wearing the NEW club's colours. That is the point of the scene - the
 * decision screen showed him in the shirt he was still in, and this is the reveal.
 */
export function deriveArrivalMoment(career: Career): CareerMoment | null {
  if (career.phase !== 'preseason' || isAcademyStage(career.academyStage)) return null;
  const lastSenior = [...career.seasonHistory].reverse().find((r) => r.academyStage === 'senior');
  if (!lastSenior || lastSenior.clubId === career.currentClubId) return null;
  const clubName = clubDisplayName(career.currentClubId);
  return {
    key: `arrival_${career.currentClubId}_${career.currentSeason}`,
    backdrop: 'neutral-night',
    overlay: 'green-smoke',
    kicker: `${seasonLabel(career.currentSeason)} · ${levelOf(career)}`,
    title: `${career.playerName} ב${clubName}`,
    subtitle: 'פרק חדש מתחיל.',
    clubId: career.currentClubId,
    kitClubId: career.currentClubId,
    age: career.age,
    mood: 'celebration',
  };
}

/** The first senior debut, from the milestone the engine stamps at settlement. */
export function deriveDebutMoment(career: Career): CareerMoment | null {
  const debut = career.milestones.find((m) => m.id === 'senior_debut');
  if (!debut) return null;
  const record = career.seasonHistory.find((r) => r.season === debut.season);
  return {
    key: `debut_${debut.season}`,
    backdrop: 'matchday-crowd',
    kicker: `${seasonLabel(debut.season)} · ${record ? record.clubName : ''}`,
    title: 'הופעת הבכורה בבוגרים',
    subtitle: 'הרגע שכל ילד במחלקת הנוער חולם עליו.',
    clubId: record?.clubId,
    kitClubId: record?.clubId ?? career.currentClubId,
    /* His age THEN, not now: a debut at eighteen shows the teen character for ever after. */
    age: debut.age,
    mood: 'celebration',
  };
}

function isAcademyStage(stage: string): boolean {
  return stage !== 'senior';
}

function levelOf(career: Career): string {
  try {
    return getClub(career.currentClubId).league;
  } catch {
    return '';
  }
}

const UEFA_TROPHY_ART: Record<UefaCompetitionId, TrophyArtId> = {
  uefa_champions_league: 'champions-generic',
  uefa_europa_league: 'europa-generic',
  uefa_conference_league: 'conference-generic',
};

/** The knockout stages worth a scene of their own, deepest first. */
const KNOCKOUT_TITLES: Record<string, string> = {
  final: 'גמר אירופי!',
  sf: 'חצי גמר אירופי!',
  qf: 'רבע גמר אירופי!',
  r16: 'שמינית הגמר באירופה!',
  ko_playoff: 'פלייאוף הנוקאאוט',
};

/** The settled season's major moments, in prestige order. Pure derivation from stored facts. */
export function deriveSeasonMoments(career: Career): CareerMoment[] {
  const record = career.lastSeasonRecord;
  if (!record || record.season !== career.currentSeason) return [];
  const moments: CareerMoment[] = [];
  const clubName = clubDisplayName(record.clubId);
  const season = seasonLabel(record.season);
  /* Everything below is that season's club and that season's age, not today's. */
  const era = { kitClubId: record.clubId, age: record.age } as const;

  /* European trophy - the rarest thing a career can hold. From the typed trophy itself. */
  for (const trophy of record.trophies) {
    if (trophy.id.startsWith('uefa_')) {
      const competition = trophy.id as UefaCompetitionId;
      moments.push({
        key: `uefa_${trophy.id}_${record.season}`,
        backdrop: 'europe-night',
        overlay: 'star-lights',
        object: getTrophyArt(UEFA_TROPHY_ART[competition]),
        kicker: `${season} · ${clubName}`,
        title: `זכייה ${inCompetition(UEFA_COMPETITIONS[competition].name)}!`,
        subtitle: 'הלילה הזה ייכנס להיסטוריה.',
        ...era,
        mood: 'celebration',
      });
    }
  }

  if (record.trophies.some((t) => t.id === 'championship' || t.id === 'foreign_championship')) {
    moments.push({
      key: `championship_${record.season}`,
      backdrop: 'trophy-ceremony',
      overlay: 'confetti-gold',
      object: getTrophyArt('league'),
      kicker: `${season} · ${clubName}`,
      title: 'אלופים!',
      subtitle: 'עונה שלמה של עבודה - וזה הרגע.',
      ...era,
      mood: 'celebration',
    });
  }

  if (record.trophies.some((t) => t.id === 'cup' || t.id === 'foreign_cup')) {
    moments.push({
      key: `cup_${record.season}`,
      backdrop: 'trophy-ceremony',
      overlay: 'confetti-green',
      object: getTrophyArt('cup'),
      kicker: `${season} · ${clubName}`,
      title: 'הגביע שלנו!',
      subtitle: 'משחק אחד, תואר אחד, זיכרון לכל החיים.',
      ...era,
      mood: 'celebration',
    });
  }

  /*
   * The European nights (v0.9.4). Both read the SETTLED RECORD's own journey - historical truth,
   * stored at settlement - rather than the live world state, so a moment about 2044 stays about
   * 2044 whatever later seasons do.
   */
  const journey: EuropeanJourney | undefined = record.europe;

  /* Qualification: the first league phase a career ever reaches. The engine dedupes the milestone. */
  const firstLeaguePhase = career.milestones.find(
    (m) => m.id === 'first_european_league_phase' && m.season === record.season,
  );
  if (firstLeaguePhase && journey?.reachedLeaguePhase) {
    moments.push({
      key: `europe_lp_${record.season}`,
      backdrop: 'europe-night',
      overlay: 'confetti-green',
      kicker: `${season} · ${clubName}`,
      title: 'העפלנו לשלב הליגה!',
      subtitle: `${UEFA_COMPETITIONS[journey.finalCompetition].name} — לילות אירופיים אמיתיים.`,
      ...era,
      mood: 'celebration',
    });
  }

  /*
   * The knockout. Suppressed when he actually WON the thing, because the trophy moment above is
   * the same night told better - two scenes for one evening is the mistake this phase removes.
   */
  if (journey && !journey.wonCompetition && KNOCKOUT_TITLES[journey.furthest]) {
    moments.push({
      key: `europe_ko_${record.season}_${journey.furthest}`,
      backdrop: 'europe-night',
      overlay: 'star-lights',
      kicker: `${season} · ${UEFA_COMPETITIONS[journey.finalCompetition].name}`,
      title: KNOCKOUT_TITLES[journey.furthest]!,
      subtitle: `${clubName} בנוקאאוט האירופי.`,
      ...era,
      mood: 'celebration',
    });
  }

  /* Relegation: the world's own outcome. A dark moment, presented as one. */
  const relegated = career.world.clubSeasons.some(
    (entry) => entry.season === record.season && entry.clubId === record.clubId && entry.outcome === 'relegated',
  );
  if (relegated) {
    moments.push({
      key: `relegation_${record.season}`,
      backdrop: 'home-dark',
      kicker: `${season} · ${clubName}`,
      title: 'ירידת ליגה.',
      subtitle: 'ערב קשה. מה שתעשה מחר יגדיר אותך.',
      ...era,
      /* No celebration pose on a relegation night, for the same reason there is no confetti. */
      mood: 'hero',
    });
  }

  return moments;
}

export function CareerMomentScreen({
  career,
  moment,
  onContinue,
}: {
  /**
   * The career the moment belongs to. Needed for one reason: to draw the PLAYER - his position and
   * his seed, with the moment supplying the age and the club it happened at.
   */
  career: Career;
  moment: CareerMoment;
  onContinue: () => void;
}): JSX.Element {
  return (
    <MomentShell
      backdrop={moment.backdrop}
      overlay={moment.overlay}
      object={moment.object}
      player={
        moment.mood === 'none'
          ? undefined
          : {
              age: moment.age ?? career.age,
              position: career.position,
              clubId: moment.kitClubId,
              seed: career.seed,
              season: career.currentSeason,
              context: moment.mood,
            }
      }
      kicker={moment.kicker}
      title={moment.title}
      subtitle={moment.subtitle}
      onContinue={onContinue}
    >
      {moment.clubId && (
        <div className="gf-moment-crest">
          <ClubCrest clubId={moment.clubId} size="large" />
        </div>
      )}
    </MomentShell>
  );
}

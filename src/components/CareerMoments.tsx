import { UEFA_COMPETITIONS, inCompetition } from '../data/uefa';
import { getClub } from '../data/clubs';
import { clubDisplayName } from '../game/identity';
import type { Career, UefaCompetitionId } from '../types';
import {
  getCareerPlayerArt,
  getMomentArt,
  getTransferArt,
  getTrophyArt,
  type TrophyArtId,
} from '../ui/playerArt';
import { seasonLabel } from '../ui/format';
import { ClubCrest } from './ClubCrest';
import { MomentShell } from './gamefeel';

/**
 * Big career moments (v0.9, Phase 6).
 *
 * A championship must not look like another card. When the settled season contains a REAL major
 * event, the season-summary beat opens with a full-screen moment for it - trophy-ceremony
 * backdrop, the pack's art, confetti where confetti is earned - and only then hands over to the
 * numbers.
 *
 * Every trigger is a stored fact on the settled record or the world: a typed trophy, the stored
 * European journey, the world's own relegation outcome, the deduped first-league-phase
 * milestone. Nothing here is rolled, invented, or inferred from narrative text - if the fact is
 * not in state, the moment does not exist. Order is prestige: a European trophy outranks the
 * championship, which outranks the cup; relegation comes last and gets no confetti, because a
 * moment system that only celebrates is a liar.
 */

export interface CareerMoment {
  key: string;
  backdrop: 'trophy-ceremony' | 'europe-night' | 'home-dark' | 'neutral-night' | 'training' | 'matchday-crowd';
  overlay?: 'confetti-gold' | 'confetti-green' | 'star-lights' | 'green-smoke';
  art: string;
  kicker: string;
  title: string;
  subtitle: string;
  /** Club whose crest belongs on the moment, when the moment is about arriving somewhere. */
  clubId?: string;
  /**
   * How the career player should be drawn on this moment (v0.9.3, Phase 5).
   *
   * `celebration` for a night he celebrates, `hero` for one he does not - a relegation moment
   * with a celebrating player would be the moment system lying, which is the same reason
   * relegation never gets confetti. `none` for a moment he is not visually part of.
   */
  mood: 'celebration' | 'hero' | 'none';
}

/**
 * The arrival at a new club (v0.9.1) - shown once, at the first preseason AFTER a move.
 *
 * Derived from a fact the career already carries: the last senior season was played somewhere
 * else. Nothing about the transfer is invented - no salary, no shirt number, no contract
 * length, because the game models none of them; the ceremony names the club, the league and
 * the season, which are all real.
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
    art: getTransferArt('press-presentation'),
    kicker: `${seasonLabel(career.currentSeason)} · ${levelOf(career)}`,
    title: `${career.playerName} ב${clubName}`,
    subtitle: 'פרק חדש מתחיל.',
    clubId: career.currentClubId,
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
    art: getMomentArt('debut'),
    kicker: `${seasonLabel(debut.season)} · ${record ? record.clubName : ''}`,
    title: 'הופעת הבכורה בבוגרים',
    subtitle: 'הרגע שכל ילד במחלקת הנוער חולם עליו.',
    clubId: record?.clubId,
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

/** The settled season's major moments, in prestige order. Pure derivation from stored facts. */
export function deriveSeasonMoments(career: Career): CareerMoment[] {
  const record = career.lastSeasonRecord;
  if (!record || record.season !== career.currentSeason) return [];
  const moments: CareerMoment[] = [];
  const clubName = clubDisplayName(record.clubId);
  const season = seasonLabel(record.season);

  /* European trophy - the rarest thing a career can hold. From the typed trophy itself. */
  for (const trophy of record.trophies) {
    if (trophy.id.startsWith('uefa_')) {
      const competition = trophy.id as UefaCompetitionId;
      moments.push({
        key: `uefa_${trophy.id}_${record.season}`,
        backdrop: 'europe-night',
        overlay: 'star-lights',
        art: getTrophyArt(UEFA_TROPHY_ART[competition]),
        kicker: `${season} · ${clubName}`,
        title: `זכייה ${inCompetition(UEFA_COMPETITIONS[competition].name)}!`,
        subtitle: 'הלילה הזה ייכנס להיסטוריה.',
        mood: 'celebration',
      });
    }
  }

  if (record.trophies.some((t) => t.id === 'championship' || t.id === 'foreign_championship')) {
    moments.push({
      key: `championship_${record.season}`,
      backdrop: 'trophy-ceremony',
      overlay: 'confetti-gold',
      art: getMomentArt('championship'),
      kicker: `${season} · ${clubName}`,
      title: 'אלופים!',
      subtitle: 'עונה שלמה של עבודה - וזה הרגע.',
      mood: 'celebration',
    });
  }

  if (record.trophies.some((t) => t.id === 'cup' || t.id === 'foreign_cup')) {
    moments.push({
      key: `cup_${record.season}`,
      backdrop: 'trophy-ceremony',
      overlay: 'confetti-green',
      art: getMomentArt('cup-win'),
      kicker: `${season} · ${clubName}`,
      title: 'הגביע שלנו!',
      subtitle: 'משחק אחד, תואר אחד, זיכרון לכל החיים.',
      mood: 'celebration',
    });
  }

  /* First league phase ever: the deduped milestone carries the fact and the season. */
  const firstLeaguePhase = career.milestones.find(
    (m) => m.id === 'first_european_league_phase' && m.season === record.season,
  );
  if (firstLeaguePhase && record.europe?.reachedLeaguePhase) {
    moments.push({
      key: `europe_lp_${record.season}`,
      backdrop: 'europe-night',
      overlay: 'confetti-green',
      art: getMomentArt('europe-qualification'),
      kicker: `${season} · ${clubName}`,
      title: 'שלב הליגה האירופי!',
      subtitle: `${UEFA_COMPETITIONS[record.europe.finalCompetition].name} — לילות אירופיים אמיתיים.`,
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
      art: getMomentArt('relegation'),
      kicker: `${season} · ${clubName}`,
      title: 'ירידת ליגה.',
      subtitle: 'ערב קשה. מה שתעשה מחר יגדיר אותך.',
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
   * The career the moment belongs to (v0.9.3, Phase 5). Needed for one reason: to draw the
   * PLAYER, resolved from his real age and position, instead of leaving the pack's generic
   * figure to stand in for him on his own biggest night.
   */
  career: Career;
  moment: CareerMoment;
  onContinue: () => void;
}): JSX.Element {
  return (
    <MomentShell
      backdrop={moment.backdrop}
      overlay={moment.overlay}
      art={moment.art}
      playerArt={
        moment.mood === 'none'
          ? undefined
          : getCareerPlayerArt({ age: career.age, position: career.position, context: moment.mood })
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

import { UEFA_COMPETITIONS, inCompetition } from '../data/uefa';
import { clubDisplayName } from '../game/identity';
import type { Career, UefaCompetitionId } from '../types';
import { getMomentArt, getTrophyArt, type TrophyArtId } from '../ui/playerArt';
import { seasonLabel } from '../ui/format';
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
  backdrop: 'trophy-ceremony' | 'europe-night' | 'home-dark';
  overlay?: 'confetti-gold' | 'confetti-green' | 'star-lights';
  art: string;
  kicker: string;
  title: string;
  subtitle: string;
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
    });
  }

  return moments;
}

export function CareerMomentScreen({
  moment,
  onContinue,
}: {
  moment: CareerMoment;
  onContinue: () => void;
}): JSX.Element {
  return (
    <MomentShell
      backdrop={moment.backdrop}
      overlay={moment.overlay}
      art={moment.art}
      kicker={moment.kicker}
      title={moment.title}
      subtitle={moment.subtitle}
      onContinue={onContinue}
    />
  );
}

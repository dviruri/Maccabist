import type { ArchivedSeason, IndividualHonor, Trophy } from '../types';
import { seasonLabel } from '../ui/format';
import { ClubCrest } from './ClubCrest';
import { Ltr } from './primitives';

/**
 * מסע הקריירה (v0.9, Phase 5) - the concept's life-story timeline.
 *
 * A vertical line of club ERAS: node, crest, club, season range, the age it began at, and the
 * era's biggest facts (trophies, honors) as small gold marks. Eras are derived from the season
 * rows themselves - club id, season, age - which every archive generation since v0.7 carries,
 * so old archived careers render without any new field. A return to a former club is a NEW era,
 * which is exactly what the story wants ("חזרת" is a chapter, not a footnote).
 */

export interface CareerEra {
  clubId: string;
  clubName: string;
  fromSeason: number;
  toSeason: number;
  ageAtStart: number;
  seasons: number;
  isReturn: boolean;
  trophies: number;
  academy: boolean;
}

export function deriveEras(seasons: readonly ArchivedSeason[]): CareerEra[] {
  const eras: CareerEra[] = [];
  const visited = new Set<string>();
  for (const season of seasons) {
    const last = eras[eras.length - 1];
    const academy = season.academyStage !== 'senior';
    if (last && last.clubId === season.clubId && last.academy === academy) {
      last.toSeason = season.season;
      last.seasons += 1;
      last.trophies += season.trophies.length;
      continue;
    }
    eras.push({
      clubId: season.clubId,
      clubName: season.clubName,
      fromSeason: season.season,
      toSeason: season.season,
      ageAtStart: season.age,
      seasons: 1,
      isReturn: visited.has(season.clubId),
      trophies: season.trophies.length,
      academy,
    });
    visited.add(season.clubId);
  }
  return eras;
}

export function JourneyTimeline({
  seasons,
  honors = [],
}: {
  seasons: readonly ArchivedSeason[];
  honors?: readonly IndividualHonor[];
}): JSX.Element | null {
  const eras = deriveEras(seasons);
  if (eras.length === 0) return null;

  const honorsIn = (era: CareerEra): number =>
    honors.filter((honor) => honor.season >= era.fromSeason && honor.season <= era.toSeason).length;

  return (
    <div className="gf-journey">
      {eras.map((era, index) => {
        const eraHonors = honorsIn(era);
        return (
          <div key={index} className="gf-journey-row">
            <div className="gf-journey-rail" aria-hidden>
              <span className="gf-journey-node" />
              {index < eras.length - 1 && <span className="gf-journey-line" />}
            </div>
            <div className="gf-journey-age">
              גיל <Ltr>{era.ageAtStart}</Ltr>
            </div>
            <div className={`gf-journey-card${era.academy ? ' gf-journey-academy' : ''}`}>
              <ClubCrest clubId={era.clubId} name={era.clubName} size="medium" />
              <div className="gf-journey-body">
                <div className="gf-journey-club">
                  {era.clubName}
                  {era.academy && <span className="gf-journey-tag">אקדמיה</span>}
                  {era.isReturn && <span className="gf-journey-tag gf-journey-return">חזרה הביתה</span>}
                </div>
                <div className="gf-journey-range">
                  <Ltr>
                    {era.fromSeason === era.toSeason
                      ? seasonLabel(era.fromSeason)
                      : `${era.fromSeason}–${era.toSeason + 1}`}
                  </Ltr>
                  {' · '}
                  {era.seasons === 1 ? 'עונה אחת' : `${era.seasons} עונות`}
                </div>
                {(era.trophies > 0 || eraHonors > 0) && (
                  <div className="gf-journey-marks">
                    {era.trophies > 0 && (
                      <span className="gf-journey-mark">
                        🏆 <Ltr>{era.trophies}</Ltr>
                      </span>
                    )}
                    {eraHonors > 0 && (
                      <span className="gf-journey-mark">
                        🥇 <Ltr>{eraHonors}</Ltr>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * חדר הגביעים (v0.9): the concept's trophy showcase - big art cards, one per silverware kind,
 * counted, with the seasons behind them. Derived from the same typed trophies and stored honors
 * as the v0.7 cabinet; the cabinet's expandable rows remain the detail view underneath.
 */
export function TrophyShowcase({
  trophies,
  honors,
}: {
  trophies: readonly Trophy[];
  honors: readonly IndividualHonor[];
}): JSX.Element | null {
  const cards: { art: string; label: string; count: number; caption: string; euro?: boolean }[] = [];
  const base = `${import.meta.env.BASE_URL}assets/gamefeel`;

  const push = (
    matches: readonly { season: number }[],
    art: string,
    label: string,
    euro = false,
  ): void => {
    if (matches.length === 0) return;
    const seasons = [...matches].sort((a, b) => a.season - b.season);
    const caption =
      seasons.length === 1
        ? seasonLabel(seasons[0]!.season)
        : `${seasonLabel(seasons[0]!.season)} … ${seasonLabel(seasons[seasons.length - 1]!.season)}`;
    cards.push({ art, label, count: matches.length, caption, euro });
  };

  /* European silverware leads - the rarest thing in any career. */
  push(
    trophies.filter((t) => t.id === 'uefa_champions_league' || t.id === 'champions_league'),
    `${base}/trophies/trophy-champions-generic.png`,
    'ליגת האלופות',
    true,
  );
  push(trophies.filter((t) => t.id === 'uefa_europa_league'), `${base}/trophies/trophy-europa-generic.png`, 'הליגה האירופית', true);
  push(
    trophies.filter((t) => t.id === 'uefa_conference_league'),
    `${base}/trophies/trophy-conference-generic.png`,
    'הקונפרנס ליג',
    true,
  );
  push(
    trophies.filter((t) => t.id === 'championship' || t.id === 'foreign_championship'),
    `${base}/trophies/trophy-league.png`,
    'אליפות',
  );
  push(
    trophies.filter((t) => t.id === 'cup' || t.id === 'foreign_cup' || t.id === 'super_cup'),
    `${base}/trophies/trophy-cup.png`,
    'גביע',
  );

  const AWARD_ART: Record<IndividualHonor['type'], { art: string; label: string }> = {
    top_scorer: { art: `${base}/awards/award-top-scorer.png`, label: 'מלך השערים' },
    assists_leader: { art: `${base}/awards/award-assists.png`, label: 'מלך הבישולים' },
    player_of_season: { art: `${base}/awards/award-player-season.png`, label: 'שחקן העונה' },
    goalkeeper_of_season: { art: `${base}/awards/award-goalkeeper-season.png`, label: 'שוער העונה' },
    young_player_of_season: { art: `${base}/awards/award-young-player.png`, label: 'השחקן הצעיר' },
  };
  for (const type of Object.keys(AWARD_ART) as IndividualHonor['type'][]) {
    push(
      honors.filter((h) => h.type === type),
      AWARD_ART[type].art,
      AWARD_ART[type].label,
    );
  }

  if (cards.length === 0) return null;
  return (
    <div className="gf-showcase" role="list">
      {cards.map((card, index) => (
        <div key={index} className={`gf-showcase-card${card.euro ? ' gf-showcase-euro' : ''}`} role="listitem">
          <img className="gf-showcase-art" src={card.art} alt="" aria-hidden loading="lazy" />
          <div className="gf-showcase-label">{card.label}</div>
          <div className="gf-showcase-caption">
            {card.count > 1 && (
              <span className="gf-showcase-count">
                <Ltr>{`×${card.count}`}</Ltr>{' '}
              </span>
            )}
            <Ltr>{card.caption}</Ltr>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';

import { HONOR_LABELS, honorStatLabel } from '../game/honorsEngine';
import type { ArchivedSeason, IndividualHonor, Position } from '../types';
import { seasonLabel } from '../ui/format';
import { ClubCrest } from './ClubCrest';
import { HonorIcon, TrophyKindIcon, trophyIconKind } from './honorIcons';
import { Ltr } from './primitives';

/**
 * Season Card v2 (v0.7, Checkpoint D).
 *
 * One season, recognizable at a glance: crest, club, league, then the performance - and only
 * then, behind a tap, the detail. The hierarchy is deliberate (D3): primary is where and how
 * good, secondary is the numbers, tertiary is the story.
 *
 * Works from `ArchivedSeason`, which a live `SeasonRecord` satisfies structurally - so the
 * in-game history sheet and the Career Archive render through the same card and cannot drift.
 *
 * A mid-season transfer is displayed honestly (D2): the header shows the route
 * (מכבי חיפה ← דורטמונד), the expanded view shows each spell's own numbers, and the totals sit
 * below them. The card never pretends the whole season happened at the closing club.
 */

const ROLE_TEXT: Record<string, string> = {
  squad: 'שחקן סגל',
  rotation: 'שחקן רוטציה',
  starter: 'שחקן הרכב',
  key: 'שחקן מפתח',
  star: 'כוכב הקבוצה',
  icon: 'האיש של הקהל',
};

function StatCell({ value, label }: { value: number | string; label: string }): JSX.Element {
  return (
    <div className="scv2-stat">
      <div className="scv2-stat-value">
        <Ltr>{value}</Ltr>
      </div>
      <div className="scv2-stat-label">{label}</div>
    </div>
  );
}

/** The two or three numbers this position is actually judged by. */
function primaryStats(season: ArchivedSeason, position: Position): JSX.Element {
  const s = season.stats;
  return (
    <div className="scv2-stats">
      <StatCell value={s.appearances} label="הופעות" />
      {position === 'GK' ? (
        <StatCell value={s.cleanSheets} label="שערים נקיים" />
      ) : (
        <>
          <StatCell value={s.goals} label="שערים" />
          <StatCell value={s.assists} label="בישולים" />
        </>
      )}
      {position === 'CB' || position === 'FB' ? (
        <StatCell value={Math.round(s.rating)} label="ציון" />
      ) : null}
    </div>
  );
}

export function SeasonCardV2({
  season,
  position,
  honors = [],
  abilityBefore,
}: {
  season: ArchivedSeason;
  position: Position;
  /** This season's honors, already filtered by the caller. */
  honors?: IndividualHonor[];
  /** Ability at the season's start, when the caller knows it - renders the delta. */
  abilityBefore?: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const youth = season.academyStage !== 'senior';
  const moved = (season.segments?.length ?? 0) > 1;
  const segments = season.segments ?? [];
  const delta = abilityBefore !== undefined ? season.ability - abilityBefore : null;

  return (
    <article className={`scv2${youth ? ' scv2-youth' : ''}`}>
      <button
        type="button"
        className="scv2-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="scv2-crests" aria-hidden>
          {moved ? (
            <>
              <ClubCrest clubId={segments[0]!.clubId} name={segments[0]!.clubName} size="small" />
              <span className="scv2-route-arrow">←</span>
              <ClubCrest clubId={season.clubId} name={season.clubName} size="small" />
            </>
          ) : (
            <ClubCrest clubId={season.clubId} name={season.clubName} size="medium" />
          )}
        </div>
        <div className="scv2-title">
          <div className="scv2-club">
            {moved ? `${segments[0]!.clubName} ← ${season.clubName}` : youth ? season.teamName : season.clubName}
          </div>
          <div className="scv2-sub">
            <Ltr>{seasonLabel(season.season)}</Ltr> · {season.league}
            {season.onLoan ? ' · בהשאלה' : ''}
          </div>
        </div>
        <div className="scv2-badges">
          {season.captain && <span className="scv2-captain" title="קפטן">C</span>}
          {season.trophies.map((t, i) => (
            <span key={`${t.id}_${i}`} className="scv2-trophy" title={t.name}>
              <TrophyKindIcon kind={trophyIconKind(t.id)} size={16} />
            </span>
          ))}
          {honors.map((h, i) => (
            <span key={`${h.type}_${i}`} className="scv2-honor" title={HONOR_LABELS[h.type]}>
              <HonorIcon type={h.type} size={16} />
            </span>
          ))}
        </div>
      </button>

      {primaryStats(season, position)}

      {(honors.length > 0 || season.trophies.length > 0) && (
        <div className="scv2-honor-lines">
          {season.trophies.map((t, i) => (
            <span key={`t${i}`} className="scv2-line-chip scv2-line-gold">
              <TrophyKindIcon kind={trophyIconKind(t.id)} size={13} /> {t.name}
            </span>
          ))}
          {honors.map((h, i) => (
            <span key={`h${i}`} className="scv2-line-chip scv2-line-gold">
              <HonorIcon type={h.type} size={13} /> {HONOR_LABELS[h.type]}
              {honorStatLabel(h) ? ` · ${honorStatLabel(h)}` : ''}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="scv2-detail">
          <div className="scv2-detail-row">
            <span>{ROLE_TEXT[season.role] ?? season.role}</span>
            {delta !== null && (
              <span className={delta >= 0 ? 'scv2-up' : 'scv2-down'}>
                יכולת <Ltr>{abilityBefore}</Ltr> ← <Ltr>{season.ability}</Ltr>
              </span>
            )}
            {delta === null && (
              <span>
                יכולת <Ltr>{season.ability}</Ltr>
              </span>
            )}
            {season.teamGames !== undefined && (
              <span>
                <Ltr>{season.stats.appearances}</Ltr>/<Ltr>{season.teamGames}</Ltr> משחקים
              </span>
            )}
          </div>

          {/* D2: each spell's own football, then the totals - never all of it under one badge. */}
          {moved && (
            <div className="scv2-segments">
              {segments.map((segment, i) => (
                <div key={i} className="scv2-segment">
                  <ClubCrest clubId={segment.clubId} name={segment.clubName} size="xs" />
                  <span className="scv2-segment-club">{segment.clubName}</span>
                  <span className="scv2-segment-stats">
                    <Ltr>{segment.stats.appearances}</Ltr> הופ׳
                    {position === 'GK' ? (
                      <>
                        {' · '}
                        <Ltr>{segment.stats.cleanSheets}</Ltr> נקיים
                      </>
                    ) : (
                      <>
                        {' · '}
                        <Ltr>{segment.stats.goals}</Ltr> שערים · <Ltr>{segment.stats.assists}</Ltr> בישולים
                      </>
                    )}
                  </span>
                </div>
              ))}
              <div className="scv2-segment scv2-segment-total">
                <span className="scv2-segment-club">סה״כ העונה</span>
                <span className="scv2-segment-stats">
                  <Ltr>{season.stats.appearances}</Ltr> הופ׳ · <Ltr>{season.stats.goals}</Ltr> שערים ·{' '}
                  <Ltr>{season.stats.assists}</Ltr> בישולים
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * The career as a journey (D5): season cards in chronological order with era breaks where the
 * club changed. Not a spreadsheet - each row is the season card, already visual.
 */
export function CareerJourney({
  seasons,
  position,
  honors,
}: {
  seasons: readonly ArchivedSeason[];
  position: Position;
  honors: readonly IndividualHonor[];
}): JSX.Element {
  let previousAbility: number | undefined;
  let previousClub: string | null = null;
  const rows: JSX.Element[] = [];

  for (const season of seasons) {
    const isNewEra = season.academyStage === 'senior' && season.clubId !== previousClub;
    if (isNewEra) {
      rows.push(
        <div key={`era_${season.season}`} className="journey-era">
          <ClubCrest clubId={season.clubId} name={season.clubName} size="small" />
          <span>{season.clubName}</span>
        </div>,
      );
      previousClub = season.clubId;
    }
    rows.push(
      <SeasonCardV2
        key={season.season}
        season={season}
        position={position}
        honors={honors.filter((h) => h.season === season.season)}
        abilityBefore={previousAbility}
      />,
    );
    previousAbility = season.ability;
  }

  return <div className="journey">{rows}</div>;
}

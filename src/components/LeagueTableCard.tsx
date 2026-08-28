import { useState } from 'react';

import { MACCABI_ID } from '../data/clubs';
import { getLeague } from '../data/leagues';
import { leagueShape } from '../data/leagueShape';
import {
  currentLeagueContext,
  currentTable,
  maccabiLeagueContext,
} from '../game/leagueEngine';
import type { Career, LeagueContext, LeagueTable, TableRow } from '../types';
import { Ltr } from './primitives';
import { ClubCrest } from './ClubCrest';

/**
 * מצב הליגה — where the club stands, right now (v0.4.6).
 *
 * The question this answers is the one the game could not answer before: *what is my club
 * actually fighting for?* Everything shown here comes from the live projection, which is also
 * what event eligibility reads — so if the panel says "title race", a title-race event can fire,
 * and if it does not, one cannot. The player is looking at the same state the engine is.
 *
 * Mobile-first and deliberately not a Football Manager table. Four columns — position, crest,
 * club, points — with the zones marked by *label as well as colour*, because a red row means
 * nothing to someone who cannot see red.
 *
 * Collapsed it shows the rows that matter: the top, the player's neighbours, and Maccabi. That is
 * usually seven or eight rows out of fourteen, which fits on a phone without scrolling.
 */
export function LeagueTableCard({
  career,
  defaultOpen = false,
  inSheet = false,
}: {
  career: Career;
  defaultOpen?: boolean;
  /**
   * Suppresses this card's own league heading (v0.4.7).
   *
   * Inside the table sheet the sheet's own header already names the league and the round, so
   * printing them again immediately below is the screen saying the same thing twice. The
   * situation line stays either way - "6 נקודות ממקומות אירופה" is the context Phase 26 asks for
   * at the top of the sheet, not a repetition.
   */
  inSheet?: boolean;
}): JSX.Element | null {
  const [full, setFull] = useState(defaultOpen);

  const table = currentTable(career);
  const context = currentLeagueContext(career);
  if (!table || !context) return null;

  const league = getLeague(table.leagueId);
  const shape = leagueShape(table.leagueId);
  const rows = full ? table.rows : condense(table, context, career.currentClubId);

  return (
    <section className="card-flat table-card">
      {!inSheet && (
        <header className="table-head">
          <div>
            <div className="kicker">מצב הליגה</div>
            <h3 className="table-league">{league.name}</h3>
          </div>
          <div className="table-played">
            מחזור <Ltr>{context.played}</Ltr>
          </div>
        </header>
      )}

      <SituationLine context={context} />

      <ol className="table-rows">
        {rows.map((row, index) => (
          <TableRowLine
            key={row.clubId}
            row={row}
            zone={zoneOf(row.position, shape)}
            isPlayer={row.clubId === career.currentClubId}
            isMaccabi={row.clubId === MACCABI_ID && row.clubId !== career.currentClubId}
            /* A gap in the numbers means rows were skipped, and should look like it. */
            gapBefore={index > 0 && row.position - (rows[index - 1]?.position ?? 0) > 1}
          />
        ))}
      </ol>

      {table.rows.length > rows.length && (
        <button type="button" className="table-more" onClick={() => setFull(true)}>
          לטבלה המלאה
        </button>
      )}
      {full && table.rows.length > 8 && (
        <button type="button" className="table-more" onClick={() => setFull(false)}>
          לתצוגה מקוצרת
        </button>
      )}

      <MaccabiStatus career={career} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* What the season is about                                            */
/* ------------------------------------------------------------------ */

/**
 * One line saying why this season matters.
 *
 * Written from the gap rather than from the label where possible — "four points off the top"
 * tells a player more than "title race", and it is the number the events are gated on.
 */
function SituationLine({ context }: { context: LeagueContext }): JSX.Element {
  return (
    <div className="table-situation">
      <span className="table-position">
        מקום <Ltr>{context.position}</Ltr>
      </span>
      <span className="table-situation-text">{situationText(context)}</span>
    </div>
  );
}

export function situationText(context: LeagueContext): string {
  const n = (value: number): string => String(Math.abs(Math.round(value)));

  if (context.championClinched) return 'האליפות כבר בכיס';
  if (context.promotionClinched) return 'העלייה כבר מובטחת';
  if (context.relegationConfirmed) return 'הירידה כבר סופית';

  if (context.titleRace) {
    return context.position === 1
      ? 'בראש הטבלה, ומחזיקים'
      : `${n(context.pointsFromTop)} נקודות מהפסגה`;
  }
  if (context.promotionRace && context.pointsFromPromotion !== null) {
    return context.pointsFromPromotion <= 0
      ? 'בתוך מקומות העלייה'
      : `${n(context.pointsFromPromotion)} נקודות ממקומות העלייה`;
  }
  if (context.relegationBattle && context.pointsFromSafety !== null) {
    return context.pointsFromSafety >= 0
      ? `${n(context.pointsFromSafety)} נקודות מעל הקו האדום`
      : `${n(context.pointsFromSafety)} נקודות מתחת לקו האדום`;
  }
  if (context.europeRace && context.pointsFromEurope !== null) {
    return context.pointsFromEurope <= 0
      ? 'בתוך מקומות אירופה'
      : `${n(context.pointsFromEurope)} נקודות ממקומות אירופה`;
  }
  if (context.overperforming) return 'מעל למה שציפו מהקבוצה הזאת';
  if (context.underperforming) return 'מתחת למה שציפו מהקבוצה הזאת';
  return 'עונה שקטה באמצע הטבלה';
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

type Zone = 'title' | 'europe' | 'promotion' | 'relegation' | 'none';

function zoneOf(position: number, shape: ReturnType<typeof leagueShape>): Zone {
  if (!shape) return 'none';
  if (shape.promotionPlaces > 0 && position <= shape.promotionPlaces) return 'promotion';
  if (position === 1) return 'title';
  if (shape.europePlaces > 0 && position <= shape.europePlaces) return 'europe';
  if (shape.relegationPlaces > 0 && position > shape.size - shape.relegationPlaces) {
    return 'relegation';
  }
  return 'none';
}

/** Colour alone never carries the meaning - every zone that matters also says what it is. */
const ZONE_LABELS: Record<Zone, string | null> = {
  title: 'אליפות',
  europe: 'אירופה',
  promotion: 'עלייה',
  relegation: 'ירידה',
  none: null,
};

function TableRowLine({
  row,
  zone,
  isPlayer,
  isMaccabi,
  gapBefore,
}: {
  row: TableRow;
  zone: Zone;
  isPlayer: boolean;
  isMaccabi: boolean;
  gapBefore: boolean;
}): JSX.Element {
  const classes = [
    'table-row',
    `zone-${zone}`,
    isPlayer ? 'is-player' : '',
    isMaccabi ? 'is-maccabi' : '',
    gapBefore ? 'has-gap' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <span className="table-pos">
        <Ltr>{row.position}</Ltr>
      </span>
      <ClubCrest clubId={row.clubId} name={row.name} size="small" />
      <span className="table-club">{row.name}</span>
      {ZONE_LABELS[zone] && <span className="table-zone">{ZONE_LABELS[zone]}</span>}
      <span className="table-pts">
        <Ltr>{row.points}</Ltr>
      </span>
    </li>
  );
}

/**
 * The rows worth showing on a phone: the top of the table, the player's neighbours, the bottom
 * if it is relevant to him, and Maccabi wherever they are.
 */
function condense(table: LeagueTable, context: LeagueContext, clubId: string): TableRow[] {
  const keep = new Set<number>([1, 2, 3]);
  for (let p = context.position - 1; p <= context.position + 1; p += 1) keep.add(p);

  const shape = leagueShape(table.leagueId);
  if (shape && context.position > shape.size - shape.relegationPlaces - 3) {
    for (let p = shape.size - shape.relegationPlaces; p <= shape.size; p += 1) keep.add(p);
  }

  const maccabi = table.rows.find((r) => r.clubId === MACCABI_ID);
  if (maccabi) keep.add(maccabi.position);
  const self = table.rows.find((r) => r.clubId === clubId);
  if (self) keep.add(self.position);

  return table.rows.filter((r) => keep.has(r.position));
}

/* ------------------------------------------------------------------ */
/* Maccabi, from wherever he is                                        */
/* ------------------------------------------------------------------ */

/**
 * Where Maccabi are, when the player is not there.
 *
 * Deliberately a footnote rather than a second table. The product invariant is that the current
 * club owns the live narrative and Maccabi is the thread running beside it — putting them level
 * with each other on this screen would say the opposite. When the player *is* at Maccabi this
 * renders nothing, because the table above is already about them.
 */
export function MaccabiStatus({ career }: { career: Career }): JSX.Element | null {
  if (career.currentClubId === MACCABI_ID) return null;
  const status = maccabiLeagueContext(career);
  if (!status) return null;

  const league = getLeague(status.leagueId);

  return (
    <div className="maccabi-status">
      <ClubCrest clubId={MACCABI_ID} size="small" />
      <span className="maccabi-status-name">מכבי חיפה</span>
      <span className="maccabi-status-league">{league.name}</span>
      <span className="maccabi-status-pos">
        מקום <Ltr>{status.position}</Ltr>
      </span>
    </div>
  );
}

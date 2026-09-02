import { mayShowLeaguePhaseTable, visibleEuropeanCampaign } from '../game/europePresentation';
import { UEFA_COMPETITIONS } from '../data/uefa';
import type { Career, UefaCompetitionId } from '../types';
import { ClubCrest } from './ClubCrest';
import { CompetitionMark } from './honorIcons';
import { Ltr } from './primitives';

/**
 * The European league-phase table (v0.9.1, Phase 6e).
 *
 * The v0.9 report deferred this; it exists now. A drill-down DATA screen, deliberately not
 * cinematic - the compact Europe card remains the story, this is the 36 rows behind it, exactly
 * as the v0.8 engine finished them.
 *
 * Qualification zones are the post-2024 format's own: 1-8 straight to the round of 16, 9-24 to
 * the knockout play-off, 25-36 out. The player's club is highlighted. Nothing is recomputed
 * here - the rows are the engine's, recorded when the season was simulated.
 */

const ZONES = [
  { limit: 8, className: 'euro-zone-direct', label: 'ישירות לשמינית הגמר' },
  { limit: 24, className: 'euro-zone-playoff', label: 'פלייאוף הנוקאאוט' },
  { limit: 36, className: 'euro-zone-out', label: 'מחוץ לתחרות' },
] as const;

function zoneOf(position: number): (typeof ZONES)[number] {
  return ZONES.find((zone) => position <= zone.limit) ?? ZONES[2];
}

export function EuropeStandings({ career }: { career: Career }): JSX.Element {
  const current = career.world.europe?.current;
  const standings = current?.standings;
  const playerClubId = career.currentClubId;

  if (!standings) {
    return (
      <p className="card-body">
        אין טבלת שלב ליגה לעונה הזאת. היא נשמרת מהעונה הבאה ואילך.
      </p>
    );
  }

  /*
   * v0.9.6: the sheet refuses to open the future.
   *
   * The link that reaches this is already gated, but the sheet is reachable by other routes and a
   * stored table is a FINAL table - the engine computed it when the season began. Guarding here
   * too means no path can reach it early, and the wording says which it is rather than pretending
   * the data does not exist.
   */
  if (!mayShowLeaguePhaseTable(career)) {
    return <p className="card-body">שלב הליגה בעיצומו. הטבלה תיפתח בסיכום העונה.</p>;
  }

  /* The competition the player's club is actually in leads; the others follow. */
  const order: UefaCompetitionId[] = ['uefa_champions_league', 'uefa_europa_league', 'uefa_conference_league'];
  /*
   * Which competition leads the sheet - from the VISIBLE campaign, not `finalCompetition`
   * (v0.9.6.1). This sheet only opens at full reveal, where the two agree, but reading the
   * future-complete field here would be the same mistake in a place it happens not to show.
   */
  const mine = visibleEuropeanCampaign(career, playerClubId)?.competition;
  const sorted = mine ? [mine, ...order.filter((id) => id !== mine)] : order;

  return (
    <div className="stack">
      {sorted.map((competition) => {
        const rows = standings[competition] ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={competition} className="card-flat euro-standings">
            <div className="euro-standings-head">
              <CompetitionMark competition={competition} size={20} />
              <h3>{UEFA_COMPETITIONS[competition].name}</h3>
              <span className="euro-standings-sub">
                <Ltr>{rows.length}</Ltr> קבוצות · <Ltr>{UEFA_COMPETITIONS[competition].leaguePhaseMatches}</Ltr>{' '}
                משחקים
              </span>
            </div>

            {/* Controlled horizontal scroll INSIDE the table only - the page never scrolls. */}
            <div className="euro-standings-scroll">
              <table className="euro-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">קבוצה</th>
                    <th scope="col">מש׳</th>
                    <th scope="col">נצ׳</th>
                    <th scope="col">תי׳</th>
                    <th scope="col">הפ׳</th>
                    <th scope="col">שע׳</th>
                    <th scope="col">הפר׳</th>
                    <th scope="col">נק׳</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const zone = zoneOf(row.position);
                    const isPlayer = row.clubId === playerClubId;
                    return (
                      <tr
                        key={row.clubId}
                        className={`${zone.className}${isPlayer ? ' euro-row-player' : ''}`}
                      >
                        <td className="euro-pos">
                          <Ltr>{row.position}</Ltr>
                        </td>
                        <td className="euro-club">
                          <ClubCrest clubId={row.clubId} name={row.name} size="xs" />
                          <span>{row.name}</span>
                        </td>
                        <td>
                          <Ltr>{row.played}</Ltr>
                        </td>
                        <td>
                          <Ltr>{row.won}</Ltr>
                        </td>
                        <td>
                          <Ltr>{row.drawn}</Ltr>
                        </td>
                        <td>
                          <Ltr>{row.lost}</Ltr>
                        </td>
                        <td>
                          <Ltr>
                            {row.goalsFor}:{row.goalsAgainst}
                          </Ltr>
                        </td>
                        <td>
                          <Ltr>{row.goalsFor - row.goalsAgainst}</Ltr>
                        </td>
                        <td className="euro-pts">
                          <Ltr>{row.points}</Ltr>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="euro-legend">
              {ZONES.map((zone) => (
                <span key={zone.className} className={`euro-legend-item ${zone.className}`}>
                  {zone.label}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

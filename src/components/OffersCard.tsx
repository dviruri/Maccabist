import { EXPECTED_ROLE_LABELS } from '../game/marketEngine';
import type { MoveDirection, TransferOffer } from '../types';
import { ClubCrest } from './ClubCrest';
import { Chip } from './primitives';

interface Props {
  offers: TransferOffer[];
  onAccept: (offerId: string) => void;
  onDecline: () => void;
  /**
   * The club he would be leaving, for a loan (v0.4.7, Phase 29).
   *
   * Optional, because a transfer does not need it - the destination is the whole story there. A
   * loan is a direction, and the club he stays contracted to is the half of it the offer was not
   * saying.
   */
  fromClub?: string;
}

const KIND_LABEL: Record<TransferOffer['kind'], string> = {
  transfer: 'הצעת העברה',
  loan: 'הצעת השאלה',
  return_home: 'חזרה הביתה',
  contract: 'חוזה',
  release: 'סוף דרך',
  promotion: 'עלייה לבוגרים',
};

/*
 * Every band, named (v0.4.5).
 *
 * This read `direction === 'up' ? 'צעד קדימה' : 'צעד אחורה'`, written when MoveDirection had three
 * values. v0.4.1 added major_up and major_down, and the comparison silently became false for them
 * - so an offer from Napoli to a Maccabi player was labelled "צעד אחורה" while its own hints said
 * "ליגה חזקה יותר". TypeScript could not catch it because the comparison stayed valid.
 *
 * A Record over the union does: adding a band now fails the build until it is given a label.
 */
export const DIRECTION_LABELS: Record<MoveDirection, string | null> = {
  major_up: 'קפיצת מדרגה',
  up: 'צעד קדימה',
  // A sideways move is not worth a badge - the expected role is the story there.
  lateral: null,
  down: 'צעד אחורה',
  major_down: 'ירידת מדרגה',
};

export const DIRECTION_TONES: Record<MoveDirection, 'gold' | 'green' | 'warn' | 'plain'> = {
  major_up: 'gold',
  up: 'green',
  lateral: 'plain',
  down: 'warn',
  major_down: 'warn',
};

export function OffersCard({ offers, onAccept, onDecline, fromClub }: Props): JSX.Element {
  const mandatory = offers.some((offer) => offer.mandatory);

  return (
    <article className="card">
      <div className="stack">
        <div className="kicker">חלון ההעברות</div>
        <h2 className="card-title">
          {mandatory ? 'זה קורה, בין אם תרצה ובין אם לא' : 'יש מה להחליט'}
        </h2>

        {offers.map((offer, i) => (
          <div
            key={offer.id}
            className={`offer ${offer.kind === 'return_home' || offer.kind === 'promotion' ? 'offer-home' : ''}`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="stack-sm">
              {/*
                Crest, club, where, and what he would be signing to be - in one header row
                (v0.4.7, Phase 28). The card used to open with a five-line paragraph before the
                player reached anything he could act on, which on a phone is a wall between him
                and the decision. The prose is still here; it is one tap down.
              */}
              <div className="offer-head">
                <ClubCrest clubId={offer.clubId} name={offer.clubName} size="medium" />
                <div className="offer-head-lines">
                  <div className="offer-club">
                    {/*
                      A loan says where he is leaving from as well as where he is going (Phase 29).
                      "Kfar Saba" alone is a destination; "Maccabi → Kfar Saba" is a decision, and
                      it is the direction that makes it one.
                    */}
                    {offer.kind === 'loan' && fromClub && (
                      <span className="offer-from">
                        {fromClub}
                        <span className="offer-arrow" aria-hidden>
                          {' → '}
                        </span>
                      </span>
                    )}
                    {offer.clubName}
                  </div>
                  <div className="offer-meta">
                    {KIND_LABEL[offer.kind]} · {offer.country} · {offer.league}
                  </div>
                </div>
              </div>

              <div className="offer-title">{offer.title}</div>

              {/*
                What he would be signing to be, and a few qualitative notes (v0.4). Never a
                percentage: joining a bigger club as a backup should be a decision the player
                has to weigh, not one he can read the odds off.
              */}
              {(offer.expectedRole || offer.direction) && (
                <div className="offer-tags">
                  {offer.expectedRole && (
                    <Chip tone="plain">{EXPECTED_ROLE_LABELS[offer.expectedRole]}</Chip>
                  )}
                  {offer.direction && DIRECTION_LABELS[offer.direction] && (
                    <Chip tone={DIRECTION_TONES[offer.direction]}>
                      {DIRECTION_LABELS[offer.direction]}
                    </Chip>
                  )}
                </div>
              )}
              {offer.hints && offer.hints.length > 0 && (
                <ul className="offer-hints">
                  {offer.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              )}

              {/*
                The prose, one tap down (Phase 28). It is the part that makes a move feel like a
                move - a stadium, a language, a squad - and it is also the part a player does not
                need in order to weigh role against level. `details` is a native disclosure, so it
                is keyboard-accessible and needs no state.
              */}
              <details className="offer-more">
                <summary>עוד על המועדון</summary>
                <p className="card-body">{offer.description}</p>
              </details>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onAccept(offer.id)}
              >
                {offer.acceptLabel}
              </button>
            </div>
          </div>
        ))}

        {!mandatory && (
          <button type="button" className="btn btn-ghost" onClick={onDecline}>
            {offers.length === 1 ? offers[0]!.declineLabel || 'להישאר' : 'להישאר איפה שאני'}
          </button>
        )}
      </div>
    </article>
  );
}

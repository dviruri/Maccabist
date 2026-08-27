import { EXPECTED_ROLE_LABELS } from '../game/marketEngine';
import type { TransferOffer } from '../types';
import { Chip } from './primitives';

interface Props {
  offers: TransferOffer[];
  onAccept: (offerId: string) => void;
  onDecline: () => void;
}

const KIND_LABEL: Record<TransferOffer['kind'], string> = {
  transfer: 'הצעת העברה',
  loan: 'הצעת השאלה',
  return_home: 'חזרה הביתה',
  contract: 'חוזה',
  release: 'סוף דרך',
  promotion: 'עלייה לבוגרים',
};

export function OffersCard({ offers, onAccept, onDecline }: Props): JSX.Element {
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
              <div className="offer-meta">
                {KIND_LABEL[offer.kind]} · {offer.country} · {offer.league}
              </div>
              <div className="offer-title">{offer.title}</div>
              <p className="card-body">{offer.description}</p>

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
                  {offer.direction && offer.direction !== 'lateral' && (
                    <Chip tone={offer.direction === 'up' ? 'gold' : 'warn'}>
                      {offer.direction === 'up' ? 'צעד קדימה' : 'צעד אחורה'}
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

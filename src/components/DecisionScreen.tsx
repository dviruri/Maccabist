import { useState } from 'react';

import { europeanStatusLine } from '../game/europeStatus';
import { EXPECTED_ROLE_LABELS } from '../game/marketEngine';
import type { Career, TransferOffer } from '../types';
import { roleText } from '../ui/format';
import { getPersonArt } from '../ui/playerArt';
import { ClubCrest } from './ClubCrest';
import { CinematicBackdrop, GameButton } from './gamefeel';
import { DIRECTION_LABELS } from './OffersCard';
import { Ltr } from './primitives';

/**
 * החלטה בקריירה (v0.9, Phase 4).
 *
 * The concept's full-screen decision: an offer is a life event, not a list row. One offer owns
 * the screen at a time - club hero, the real facts the offer carries, the agent's read, and a
 * stay-vs-go split that ends in two big buttons.
 *
 * Honesty boundaries, kept hard:
 *   - Every fact rendered exists on the offer or in world state: league, country, kind,
 *     expected role (the engine's own qualitative bands), move direction, the offer's own
 *     hints, and the destination's LIVE European entry from the v0.8 state. No salary, no
 *     contract years, no appearance guarantees - the game does not model them, so the screen
 *     does not claim them.
 *   - The agent's line phrases the offer's real `direction` in the voice of the actual signed
 *     agent; no agent, no panel. It is a reading of a fact, not a promise.
 *   - Decline semantics are the engine's: one decision declines the summer's offers, exactly
 *     as before. Presentation changed; the choice did not.
 */

const KIND_LABEL: Record<TransferOffer['kind'], string> = {
  transfer: 'הצעת העברה',
  loan: 'הצעת השאלה',
  return_home: 'חזרה הביתה',
  contract: 'חוזה',
  release: 'סוף דרך',
  promotion: 'עלייה לבוגרים',
};

/** The agent phrases the offer's real direction - his voice, the engine's fact. */
function agentLine(direction: TransferOffer['direction']): string {
  switch (direction) {
    case 'major_up':
      return 'הצעות כאלה לא חוזרות פעמיים. זו קפיצת מדרגה אמיתית.';
    case 'up':
      return 'זה צעד קדימה. שווה לשקול ברצינות.';
    case 'down':
      return 'זו ירידה ברמה - אבל לפעמים דקות משחק שוות יותר.';
    case 'major_down':
      return 'תבין מה אתה מוותר עליו לפני שאתה חותם.';
    default:
      return 'מהלך צידי. השאלה היא מה אתה מחפש עכשיו.';
  }
}


function FactRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="gf-dec-fact">
      <span className="gf-dec-fact-label">{label}</span>
      <span className="gf-dec-fact-value">{value}</span>
    </div>
  );
}

export function DecisionScreen({
  career,
  offers,
  onAccept,
  onDecline,
  fromClub,
}: {
  career: Career;
  offers: TransferOffer[];
  onAccept: (offerId: string) => void;
  onDecline: () => void;
  fromClub: string;
}): JSX.Element {
  const [index, setIndex] = useState(0);
  const offer = offers[Math.min(index, offers.length - 1)]!;
  const mandatory = offers.some((o) => o.mandatory);
  const agent = career.people?.agent;
  // v0.9.1: current campaign vs next-season route, never conflated (see game/europeStatus).
  const europe = europeanStatusLine(career, offer.clubId);
  const direction = offer.direction ? DIRECTION_LABELS[offer.direction] : null;

  return (
    <CinematicBackdrop backdrop="neutral-night" className="gf-decision">
      <div className="gf-dec-header">
        <div className="gf-kicker">החלטה בקריירה</div>
        <div className="gf-dec-kind">{KIND_LABEL[offer.kind]}</div>
      </div>

      {/* the offer as a headline, in the offer's own words - real engine copy */}
      <div className="gf-dec-hero">
        <ClubCrest clubId={offer.clubId} name={offer.clubName} size="large" className="gf-dec-crest" />
        <h1 className="gf-dec-title">{offer.title}</h1>
        <p className="gf-dec-desc">{offer.description}</p>
      </div>

      <div className="gf-glass gf-dec-facts">
        <FactRow label="מסגרת" value={offer.league} />
        <FactRow label="מדינה" value={offer.country} />
        {offer.expectedRole && <FactRow label="תפקיד צפוי" value={EXPECTED_ROLE_LABELS[offer.expectedRole]} />}
        {europe && <FactRow label="אירופה" value={europe} />}
        {direction && <FactRow label="כיוון" value={direction} />}
      </div>

      {agent && (
        <div className="gf-glass gf-dec-agent">
          <img className="gf-feed-face" src={getPersonArt('agent')} alt="" aria-hidden loading="lazy" />
          <div className="gf-feed-body">
            <span className="gf-feed-role">{agent.person.name} חושב:</span>
            <p className="gf-feed-text">{agentLine(offer.direction)}</p>
          </div>
        </div>
      )}

      {/* stay vs go: the offer's own hints against the life he already has */}
      <div className="gf-dec-vs">
        <div className="gf-dec-side gf-dec-side-go">
          <div className="gf-dec-side-title">{offer.clubName}</div>
          {(offer.hints ?? []).slice(0, 2).map((hint, i) => (
            <div key={i} className="gf-dec-point">
              {hint}
            </div>
          ))}
          {(offer.hints ?? []).length === 0 && <div className="gf-dec-point">{offer.league}</div>}
        </div>
        <span className="gf-next-vs" aria-hidden>
          VS
        </span>
        <div className="gf-dec-side gf-dec-side-stay">
          <div className="gf-dec-side-title">{fromClub}</div>
          <div className="gf-dec-point">{roleText(career)}</div>
          <div className="gf-dec-point">הבית המוכר</div>
        </div>
      </div>

      <div className="gf-dec-actions">
        <GameButton onClick={() => onAccept(offer.id)}>{offer.acceptLabel || 'לחתום'}</GameButton>
        {!mandatory && (
          <GameButton tone="ghost" onClick={onDecline}>
            {offers.length > 1 ? 'לדחות את כל ההצעות' : offer.declineLabel || 'להישאר'}
          </GameButton>
        )}
      </div>

      {offers.length > 1 && (
        <div className="gf-dec-pager" role="group" aria-label="הצעות נוספות">
          <button
            type="button"
            className="gf-dec-page-btn"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ‹ הקודמת
          </button>
          <span className="gf-dec-page-count">
            <Ltr>
              {index + 1}/{offers.length}
            </Ltr>
          </span>
          <button
            type="button"
            className="gf-dec-page-btn"
            disabled={index >= offers.length - 1}
            onClick={() => setIndex((i) => Math.min(offers.length - 1, i + 1))}
          >
            הבאה ›
          </button>
        </div>
      )}

      <p className="gf-dec-footnote">הבחירה תשפיע על הקריירה שלך</p>
    </CinematicBackdrop>
  );
}

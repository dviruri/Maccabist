import { useState } from 'react';

import { europeanStatusLine } from '../game/europeStatus';
import { withHebrewPrefix } from '../game/identity';
import { EXPECTED_ROLE_LABELS } from '../game/marketEngine';
import type { Career, TransferOffer } from '../types';
import { roleText } from '../ui/format';
import { getPersonArt } from '../ui/playerArt';
import { ClubCrest } from './ClubCrest';
import { CinematicBackdrop, GameButton } from './gamefeel';
import { PlayerRender } from './PlayerRender';
import { DIRECTION_LABELS } from './OffersCard';
import { Sheet } from './Sheet';

/**
 * החלטה בקריירה (v0.9, Phase 4 · rebuilt v0.9.3, Phase 4).
 *
 * An offer is a life event, not a list row. One offer owns the screen at a time - the
 * destination's crest and name, a large headline, the player himself, the few facts that
 * actually decide it, his agent's read, and a stay-versus-go split that ends in two big buttons.
 *
 * ## v0.9.3
 *
 * v0.9.2 had the right elements in a page-shaped stack: header, hero, prose, a facts TABLE, an
 * agent panel, a comparison, actions, a pager and a footnote - nine blocks, and at 320x568 the
 * buttons were 250px below the fold. Three things changed.
 *
 *   The facts stopped being a table. Three or four rows of label-plus-value dominated a screen
 *   whose subject is a choice; they are now one chip line, with everything else behind
 *   פרטי ההצעה - a real bottom sheet, so nothing was deleted.
 *
 *   Paging became dots. `1/3` with two text buttons read like a data grid; ● ○ ○ reads like a
 *   card you can move between, and the arrows stayed for anyone who wants an explicit target.
 *
 *   The buttons say what they do. "לחתום" and "להישאר" became "עוברים ל<club>" and "נשארים",
 *   derived from the real destination, unless the engine supplied its own labels - in which case
 *   the engine's wording wins, because those labels are how a mandatory move or a release
 *   phrases itself.
 *
 * ## Honesty boundaries, kept hard
 *
 *   - Every fact rendered exists on the offer or in world state: league, country, kind, expected
 *     role (the engine's own qualitative bands), move direction, the offer's own hints, and the
 *     destination's LIVE European entry from the v0.8 state. No salary, no contract years, no
 *     appearance guarantees - the game does not model them, so the screen does not claim them.
 *   - The agent's line phrases the offer's real `direction` in the voice of the actual signed
 *     agent; no agent, no panel. It is a reading of a fact, not a promise.
 *   - The stay side is the player's real current standing (`roleText`), not an invented benefit.
 *   - Decline semantics are the engine's: one decision declines the summer's offers, exactly as
 *     before. Presentation changed; the choice did not.
 *   - Neither button is styled as recommended. The agent may have an opinion; the layout may not.
 */

const KIND_LABEL: Record<TransferOffer['kind'], string> = {
  transfer: 'הצעת העברה',
  loan: 'הצעת השאלה',
  return_home: 'חזרה הביתה',
  contract: 'חוזה',
  release: 'סוף דרך',
  promotion: 'עלייה לבוגרים',
};

/**
 * Whose wording the buttons use (v0.9.3).
 *
 * A move has a destination, so "עוברים לטורינו" beats "לחתום" - it says what pressing it does.
 * A contract, a release or a forced promotion does not: there is nowhere to move to, and the
 * engine's own labels are how those beats phrase themselves. So deriving applies to exactly the
 * kinds where a destination exists, and the engine keeps the rest.
 */
const DERIVES_DESTINATION: ReadonlySet<TransferOffer['kind']> = new Set<TransferOffer['kind']>([
  'transfer',
  'loan',
  'return_home',
]);

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
  const [details, setDetails] = useState(false);

  const offer = offers[Math.min(index, offers.length - 1)]!;
  const mandatory = offers.some((o) => o.mandatory);
  const agent = career.people?.agent;
  // v0.9.1: current campaign vs next-season route, never conflated (see game/europeStatus).
  const europe = europeanStatusLine(career, offer.clubId);
  const direction = offer.direction ? DIRECTION_LABELS[offer.direction] : null;

  /* The three or four facts that actually decide it. Chips, not a table. */
  const facts = [
    offer.league,
    offer.expectedRole ? EXPECTED_ROLE_LABELS[offer.expectedRole] : null,
    europe,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <div className="gf-decision-screen">
      <CinematicBackdrop backdrop="neutral-night" className="gf-decision">
        <div className="gf-dec-header">
          <div className="gf-kicker">החלטה בקריירה</div>
          <div className="gf-dec-kind">{KIND_LABEL[offer.kind]}</div>
        </div>

        {/*
          ---- the detail region ----

          Its own element so a very short viewport can give IT the scroll while the header above
          and the two buttons below stay put. At 320x568 the whole offer cannot fit; scrolling to
          the agent's line is better than hiding it, and the choice itself never moves.
        */}
        <div className="gf-dec-body">
          {/*
            The destination leads: crest, name, where in the world. Then the headline, then the
            player himself as an upper-body crop on the left - the home hero's technique.
          */}
          <div className="gf-dec-hero">
          {/*
            His CURRENT club's colours, not the offer's (v0.9.4).

            He has not signed anything. Putting him in Torino's shirt while he is still deciding
            whether to join Torino would tell him the decision was already made - and the arrival
            ceremony, which fires after he accepts, is where the new shirt is supposed to land.
          */}
          <PlayerRender
            className="gf-dec-art"
            age={career.age}
            position={career.position}
            clubId={career.currentClubId}
            seed={career.seed}
            season={career.currentSeason}
          />
          <div className="gf-dec-headline">
            {/*
              No separate club line here: the crest names the club and so does the headline, and
              printing it three times above one choice is the page habit this release is removing.
            */}
            <ClubCrest clubId={offer.clubId} name={offer.clubName} size="large" className="gf-dec-crest" />
            <div className="gf-dec-where">
              {offer.league} · {offer.country}
            </div>
            <h1 className="gf-dec-title">{offer.title}</h1>
          </div>
        </div>

        <div className="gf-dec-chips">
          {facts.map((fact) => (
            <span key={fact} className="gf-chip">
              <span className="gf-chip-text">{fact}</span>
            </span>
          ))}
          <button type="button" className="gf-chip gf-chip-tap gf-dec-more" onClick={() => setDetails(true)}>
            <span className="gf-chip-text">פרטי ההצעה ›</span>
          </button>
        </div>

        {/*
          The offer's own words. Moved to the details sheet on the first pass of this phase, which
          left a 150px hole between the comparison and the buttons and made the screen read as
          unfinished - and prose IS the emotional part of an offer. It is back, at body size.
        */}
        {/*
          The offer's own words, clamped to three lines - and TAPPABLE, because a clamp ends in an
          ellipsis and an ellipsis has to lead somewhere. It opens the same sheet the chip above
          does, which is where the full text lives.
        */}
        <button type="button" className="gf-dec-desc" onClick={() => setDetails(true)}>
          {offer.description}
        </button>

        {agent && (
          <div className="gf-dec-agent">
            <img className="gf-feed-face" src={getPersonArt('agent')} alt="" aria-hidden loading="lazy" />
            <div className="gf-feed-body">
              <span className="gf-feed-role">{agent.person.name} חושב:</span>
              <p className="gf-feed-text">{agentLine(offer.direction)}</p>
            </div>
          </div>
        )}

        {/* stay vs go: the offer's own hints against the standing he already has */}
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

        </div>

        <div className="gf-dec-actions">
          <GameButton onClick={() => onAccept(offer.id)}>
            {DERIVES_DESTINATION.has(offer.kind)
              ? `עוברים ${withHebrewPrefix('ל', offer.clubName)}`
              : offer.acceptLabel || 'לחתום'}
          </GameButton>
          {!mandatory && (
            <GameButton tone="ghost" onClick={onDecline}>
              {offers.length > 1
                ? 'דוחים את כל ההצעות'
                : DERIVES_DESTINATION.has(offer.kind)
                  ? 'נשארים'
                  : offer.declineLabel || 'נשארים'}
            </GameButton>
          )}
        </div>

        {/*
          Paging as dots plus arrows (v0.9.3). Each offer owns the screen; this is how you move
          between them, and the state is the index alone - nothing about an offer is lost by
          paging past it.
        */}
        {offers.length > 1 && (
          <div className="gf-dec-pager" role="group" aria-label="הצעות נוספות">
            <button
              type="button"
              className="gf-dec-page-btn"
              disabled={index === 0}
              aria-label="ההצעה הקודמת"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              ‹
            </button>
            <div className="gf-dec-dots">
              {offers.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  className={`gf-dec-dot${i === index ? ' gf-dec-dot-on' : ''}`}
                  aria-label={`הצעה ${i + 1} מתוך ${offers.length}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="gf-dec-page-btn"
              disabled={index >= offers.length - 1}
              aria-label="ההצעה הבאה"
              onClick={() => setIndex((i) => Math.min(offers.length - 1, i + 1))}
            >
              ›
            </button>
          </div>
        )}
      </CinematicBackdrop>

      {/*
        Everything the screen did not need in order to make the choice. A real sheet, scrollable,
        so the detail is available without being in the way - the offer's own words included.
      */}
      <Sheet open={details} title="פרטי ההצעה" subtitle={offer.clubName} onClose={() => setDetails(false)}>
        <div className="stack">
          <p className="card-body">{offer.description}</p>
          <div className="gf-glass gf-dec-facts">
            <FactRow label="מסגרת" value={offer.league} />
            <FactRow label="מדינה" value={offer.country} />
            <FactRow label="סוג" value={KIND_LABEL[offer.kind]} />
            {offer.expectedRole && (
              <FactRow label="תפקיד צפוי" value={EXPECTED_ROLE_LABELS[offer.expectedRole]} />
            )}
            {direction && <FactRow label="כיוון" value={direction} />}
            {europe && <FactRow label="אירופה" value={europe} />}
            {offer.leagueLevel !== undefined && (
              <FactRow label="רמת הליגה" value={`${Math.round(offer.leagueLevel)}/100`} />
            )}
          </div>
          {(offer.hints ?? []).length > 0 && (
            <div className="gf-glass">
              {(offer.hints ?? []).map((hint, i) => (
                <div key={i} className="gf-dec-point">
                  {hint}
                </div>
              ))}
            </div>
          )}
          {/*
            No line about what the game does not model. The first version of this footnote said
            "no salary, no contract length" - honest, but it put those words on the decision
            screen, and the test that forbids inventing them flagged its own disclaimer.
          */}
          <p className="gf-dec-footnote">הבחירה תשפיע על הקריירה שלך</p>
        </div>
      </Sheet>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="gf-dec-fact">
      <span className="gf-dec-fact-label">{label}</span>
      {/* NOT wrapped in <Ltr>: these values are Hebrew, and forcing LTR on Hebrew reverses it.
          The one numeric row passes its own <Ltr> in. */}
      <span className="gf-dec-fact-value">{value}</span>
    </div>
  );
}

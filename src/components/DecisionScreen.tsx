import { useState } from 'react';

import { europeanStatusLine } from '../game/europeStatus';
import { withHebrewPrefix } from '../game/identity';
import { EXPECTED_ROLE_LABELS } from '../game/marketEngine';
import type { Career, ExpectedRole, MoveDirection, TransferOffer } from '../types';
import type { ChoiceFact } from '../ui/decisionView';
import { roleText } from '../ui/format';
import { getPersonArt } from '../ui/playerArt';
import { ClubCrest } from './ClubCrest';
import { DecisionChoiceCard, DecisionChoices, DecisionHead, DecisionScene } from './DecisionChoice';
import { CinematicBackdrop } from './gamefeel';
import { PlayerRender } from './PlayerRender';
import { DIRECTION_LABELS } from './OffersCard';
import { Sheet } from './Sheet';

/**
 * החלטה בקריירה (v0.9, Phase 4 · rebuilt v0.9.3 · rebuilt again v0.9.5).
 *
 * ## What v0.9.5 changed
 *
 * v0.9.3 had the right facts in the wrong grammar. The screen was: destination hero, chips,
 * description, agent panel, a stay-versus-go comparison - and then, separately, two generic
 * buttons at the bottom. The player read a comparison, then had to map it onto a verb. That is a
 * form, and it is why an offer never felt like something that had happened to him.
 *
 * Now the comparison IS the choice. The two sides of the dilemma are two cards, each carrying the
 * facts that make it what it is, and pressing one commits. There is no VS strip and no button
 * row, because the stay side and the go side are the buttons.
 *
 * Everything the engine does is untouched: `onAccept(offer.id)`, `onDecline()`, mandatory
 * semantics, and the decline-declines-everything rule for a summer with several offers.
 *
 * ## Honesty boundaries, kept hard
 *
 *   - Every fact on a card exists on the offer or in world state: league, country, kind, expected
 *     role (the engine's own qualitative bands), move direction, the offer's own hints, and the
 *     destination's LIVE European entry from the v0.8 state. No salary, no contract years, no
 *     appearance guarantees - the game does not model them, so the screen does not claim them.
 *   - A move is not automatically the good option. `factsForMove` colours the direction as the
 *     engine reported it, so a step down reads as a step down, and an expected role of גיבוי is a
 *     red line on the card that offers it rather than a neutral chip somewhere else.
 *   - The stay card carries his real current standing (`roleText`), never an invented benefit.
 *     The game does not model guaranteed minutes, so the stay card does not promise them.
 *   - The agent's line phrases the offer's real `direction` in the voice of the actual signed
 *     agent; no agent, no line. It is a reading of a fact, not a promise.
 *   - Neither card is styled as recommended. The agent may have an opinion; the layout may not.
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
 * Whose wording the move card uses (v0.9.3, kept).
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

/**
 * How the engine's own move direction reads on a card.
 *
 * A transfer is not automatically an improvement, and the previous screen quietly implied it was
 * by putting the destination on the "go" side of a comparison and nothing negative anywhere. The
 * direction is a field on the offer; this only chooses which colour states it.
 */
const DIRECTION_TONE: Record<MoveDirection, ChoiceFact['tone']> = {
  major_up: 'positive',
  up: 'positive',
  lateral: 'neutral',
  down: 'negative',
  major_down: 'negative',
};

/**
 * How an expected role reads.
 *
 * The bands are the engine's (`EXPECTED_ROLE_LABELS`); the tone is the honest reading of them. A
 * player told he is going somewhere as גיבוי should see that in red on the card that offers it -
 * that is the tradeoff he is being asked to weigh, and burying it in a neutral chip was the old
 * screen's way of not quite saying it.
 */
const ROLE_TONE: Record<ExpectedRole, ChoiceFact['tone']> = {
  star: 'positive',
  key: 'positive',
  starter: 'positive',
  rotation: 'negative',
  backup: 'negative',
  project: 'neutral',
};

/**
 * The facts that make the MOVE what it is. At most three - the rest is in the sheet.
 *
 * Exported because the youth-to-senior fork presents the same kind of object - a TransferOffer
 * the player is being asked to take - and should read it the same way. Two copies of "which of
 * an offer's fields belong on a card, and what colour is each" is two places to disagree about
 * whether rotation is a warning.
 */
export function factsForMove(offer: TransferOffer, europe: string | null): ChoiceFact[] {
  const facts: ChoiceFact[] = [];

  const direction = offer.direction ? DIRECTION_LABELS[offer.direction] : null;
  if (offer.direction && direction) {
    facts.push({ tone: DIRECTION_TONE[offer.direction], text: direction });
  }
  /* The destination's live European entry, from world state - never a guess about next season. */
  if (europe) facts.push({ tone: 'positive', text: europe });
  if (offer.expectedRole) {
    facts.push({
      tone: ROLE_TONE[offer.expectedRole],
      text: `תפקיד צפוי: ${EXPECTED_ROLE_LABELS[offer.expectedRole]}`,
    });
  }
  /*
   * The offer's own hints fill any remaining room, as neutral: the engine writes them as
   * qualitative notes without a direction, so colouring them would be this file's opinion.
   */
  for (const hint of offer.hints ?? []) {
    if (facts.length >= 3) break;
    facts.push({ tone: 'neutral', text: hint });
  }
  /* A move with nothing else to say still has a destination league. */
  if (facts.length === 0) facts.push({ tone: 'neutral', text: offer.league });

  return facts.slice(0, 3);
}

/**
 * The facts that make STAYING what it is - all of them read off current career state.
 *
 * Deliberately short. There is no engine fact that says staying is safe, so the card does not say
 * it; what it can honestly say is where he is and what he currently is there.
 */
function factsForStay(career: Career, fromClub: string, declinesAll: boolean): ChoiceFact[] {
  const facts: ChoiceFact[] = [{ tone: 'positive', text: roleText(career) }];
  facts.push({ tone: 'neutral', text: `נשאר ${withHebrewPrefix('ב', fromClub)}` });
  /*
   * The engine's decline semantics, stated on the card that performs them (v0.9.5).
   *
   * With several offers on the table, `onDecline()` turns down the whole summer and not just the
   * one being looked at. The old screen said this in the button's label only when it happened to
   * be the visible offer; saying it as a consequence line is the honest version, because it IS a
   * consequence of pressing this card.
   */
  if (declinesAll) facts.push({ tone: 'negative', text: 'דוחה את כל ההצעות שעל השולחן' });
  return facts;
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
  /*
   * Double-commit protection (v0.9.5). The card locks the moment it is pressed, so a second tap
   * during the phase transition cannot accept an offer twice or accept and then decline.
   */
  const [committed, setCommitted] = useState<'move' | 'stay' | null>(null);

  const offer = offers[Math.min(index, offers.length - 1)]!;
  const mandatory = offers.some((o) => o.mandatory);
  const agent = career.people?.agent;
  // v0.9.1: current campaign vs next-season route, never conflated (see game/europeStatus).
  const europe = europeanStatusLine(career, offer.clubId);
  const direction = offer.direction ? DIRECTION_LABELS[offer.direction] : null;
  const declinesAll = offers.length > 1;

  const moveTitle = DERIVES_DESTINATION.has(offer.kind)
    ? `עוברים ${withHebrewPrefix('ל', offer.clubName)}`
    : offer.acceptLabel || 'לחתום';
  const stayTitle = DERIVES_DESTINATION.has(offer.kind)
    ? `נשארים ${withHebrewPrefix('ב', fromClub)}`
    : offer.declineLabel || 'נשארים';

  return (
    <div className="gf-decision-screen">
      <CinematicBackdrop backdrop="neutral-night" className="gf-decision">
        <DecisionScene
          head={
            <DecisionHead
              kicker={KIND_LABEL[offer.kind]}
              title={offer.title}
              media={
                /*
                  The destination leads: crest, name, where in the world - then the player himself
                  as an upper-body crop beside it, the home hero's technique. It is `media` and not
                  a child so it renders ABOVE the headline; the agent's read stays a child, because
                  he is commenting on a question that has already been asked.
                */
                <div className="gf-dec-hero">
                {/*
                  His CURRENT club's colours, not the offer's (v0.9.4, unchanged in v0.9.5).

                  He has not signed anything. Putting him in Torino's shirt while he is still
                  deciding whether to join Torino would tell him the decision was already made -
                  and the arrival ceremony, which fires after he accepts, is where the new shirt
                  is supposed to land.
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
                  <ClubCrest
                    clubId={offer.clubId}
                    name={offer.clubName}
                    size="large"
                    className="gf-dec-crest"
                  />
                  <div className="gf-dec-where">
                    {offer.league} · {offer.country}
                  </div>
                  </div>
                </div>
              }
            />
          }
          context={
            <>
              {/*
                The offer's own words, clamped - and tappable, because a clamp ends in an ellipsis
                and an ellipsis has to lead somewhere. It opens the sheet with the full text.
              */}
              <button type="button" className="gf-dec-desc" onClick={() => setDetails(true)}>
                {offer.description}
              </button>

              {agent && (
                <div className="gf-dec-agent">
                  <img
                    className="gf-feed-face"
                    src={getPersonArt('agent')}
                    alt=""
                    aria-hidden
                    loading="lazy"
                  />
                  <div className="gf-feed-body">
                    <span className="gf-feed-role">{agent.person.name} חושב:</span>
                    <p className="gf-feed-text">{agentLine(offer.direction)}</p>
                  </div>
                </div>
              )}
            </>
          }
          choices={
            /*
              A mandatory offer renders ONE card. There is no stay side because there is no stay:
              drawing a second card for visual symmetry would offer a choice the engine will not
              honour, which is worse than an asymmetric screen.
            */
            <DecisionChoices count={mandatory ? 1 : 2}>
              <DecisionChoiceCard
                title={moveTitle}
                subtitle={offer.clubName}
                icon={<ClubCrest clubId={offer.clubId} name={offer.clubName} size="small" />}
                facts={factsForMove(offer, europe)}
                onChoose={() => {
                  if (committed) return;
                  setCommitted('move');
                  onAccept(offer.id);
                }}
                selected={committed === 'move'}
                disabled={committed !== null && committed !== 'move'}
                onDetails={() => setDetails(true)}
                detailsLabel="פרטי ההצעה ›"
              />
              {!mandatory && (
                <DecisionChoiceCard
                  title={stayTitle}
                  subtitle={declinesAll ? 'דוחים את כל ההצעות' : fromClub}
                  icon={<ClubCrest clubId={career.currentClubId} name={fromClub} size="small" />}
                  facts={factsForStay(career, fromClub, declinesAll)}
                  tone="quiet"
                  onChoose={() => {
                    if (committed) return;
                    setCommitted('stay');
                    onDecline();
                  }}
                  selected={committed === 'stay'}
                  disabled={committed !== null && committed !== 'stay'}
                />
              )}
            </DecisionChoices>
          }
          footer={
            /*
              Paging as dots plus arrows (v0.9.3, kept). Each offer owns the screen; this is how
              you move between them, and the state is the index alone - nothing about an offer is
              lost by paging past it. Locked once a choice is committed.
            */
            offers.length > 1 ? (
              <div className="gf-dec-pager" role="group" aria-label="הצעות נוספות">
                <button
                  type="button"
                  className="gf-dec-page-btn"
                  disabled={index === 0 || committed !== null}
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
                      disabled={committed !== null}
                      onClick={() => setIndex(i)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="gf-dec-page-btn"
                  disabled={index >= offers.length - 1 || committed !== null}
                  aria-label="ההצעה הבאה"
                  onClick={() => setIndex((i) => Math.min(offers.length - 1, i + 1))}
                >
                  ›
                </button>
              </div>
            ) : undefined
          }
        />
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

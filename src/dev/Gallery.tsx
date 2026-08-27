import { EVENTS_BY_ID } from '../data/events';
import { MACCABI_ACADEMY_ID, MACCABI_ID } from '../data/clubs';
import { DecisionCard, OutcomeReveal } from '../components/DecisionCard';
import { OutcomeCard } from '../components/EventCard';
import { OffersCard } from '../components/OffersCard';
import { PlayerHub } from '../components/PlayerHub';
import { SeasonResultCard } from '../components/SeasonCards';
import { calculateOutcomeDistribution } from '../game/decisionEngine';
import { createCareer } from '../game/careerEngine';
import { resolveEventChoice } from '../game/eventEngine';
import { createRng } from '../game/random';
import { generateOffers } from '../game/transferEngine';
import { recordMaccabiSeason } from '../game/worldEngine';
import type { Career, SeasonRecord } from '../types';

/**
 * A component gallery, for looking at screens (v0.4.5).
 *
 * The game is a single-page app with no routes, so there is no way to point a headless browser at
 * "the season summary" — you would have to play thirty seasons in a browser to see one. This
 * renders each screen from a fixture career instead, which is what makes the visual pass
 * verifiable rather than assumed.
 *
 * Reached only via `?gallery=1`. Not linked from anywhere, and it renders nothing the player can
 * reach by accident. It builds its fixtures with the real engine, so a gallery screen that looks
 * wrong is a real bug rather than a mock drifting from the game.
 */

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const base = (over: Partial<Career> = {}): Career => ({
  ...createCareer({ playerName: 'אורי דביר', position: 'CM', seed: 42 }),
  ...over,
});

const seasonRecord = (over: Partial<SeasonRecord> = {}): SeasonRecord => ({
  season: 2044,
  age: 23,
  academyStage: 'senior',
  clubId: MACCABI_ID,
  clubName: 'מכבי חיפה',
  teamName: 'מכבי חיפה',
  league: 'ליגת העל',
  onLoan: false,
  stats: {
    appearances: 31,
    starts: 27,
    goals: 9,
    assists: 6,
    cleanSheets: 0,
    goalsConceded: 0,
    rating: 74,
    injuredGames: 2,
  },
  firstHalf: null,
  ability: 78,
  role: 'key',
  coachTrust: 74,
  trophies: [],
  captain: false,
  olderGroup: 'none',
  ...over,
});

/** A senior Maccabi player at his peak. */
const seniorAtMaccabi = (): Career => {
  const career = base({
    academyStage: 'senior',
    currentClubId: MACCABI_ID,
    age: 24,
    ability: 78,
    coachTrust: 81,
    maccabism: 72,
    reputation: 63,
    roleValue: 74,
    role: 'key',
    currentSeason: 2045,
  });
  return {
    ...career,
    lastSeasonRecord: seasonRecord(),
    seasonHistory: [seasonRecord()],
    maccabi: { ...career.maccabi, appearances: 96, seasons: 3, academyGraduate: true, academySeasons: 9 },
  };
};

/** A boy in the academy. */
const academyBoy = (): Career =>
  base({
    academyStage: 'children_a',
    currentClubId: MACCABI_ACADEMY_ID,
    age: 12,
    ability: 41,
    coachTrust: 63,
    maccabism: 68,
    reputation: 14,
    roleValue: 58,
    role: 'starter',
    currentSeason: 2034,
  });

/** Abroad, on loan, and a former Maccabi player. */
const abroadOnLoan = (): Career => {
  const career = base({
    academyStage: 'senior',
    currentClubId: 'hapoel_kfar_saba',
    parentClubId: MACCABI_ID,
    loanSeasonsLeft: 1,
    age: 20,
    ability: 64,
    coachTrust: 58,
    maccabism: 80,
    reputation: 31,
    roleValue: 55,
    role: 'starter',
    currentSeason: 2041,
  });
  return {
    ...career,
    maccabi: { ...career.maccabi, appearances: 8, seasons: 1, academyGraduate: true, academySeasons: 9 },
  };
};

/** A former Maccabi player playing in Portugal. */
const inEurope = (): Career => {
  const career = base({
    academyStage: 'senior',
    currentClubId: 'benfica',
    age: 27,
    ability: 84,
    coachTrust: 70,
    maccabism: 66,
    reputation: 81,
    roleValue: 78,
    role: 'star',
    currentSeason: 2048,
  });
  const withHistory: Career = {
    ...career,
    maccabi: {
      ...career.maccabi,
      appearances: 174,
      seasons: 6,
      championships: 2,
      academyGraduate: true,
      academySeasons: 9,
      everLeft: true,
    },
    seasonHistory: [seasonRecord({ clubId: MACCABI_ID })],
  };
  return { ...withHistory, world: recordMaccabiSeason(withHistory, createRng(7)) };
};

/* ------------------------------------------------------------------ */
/* Frame                                                              */
/* ------------------------------------------------------------------ */

function Frame({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="gallery-frame">
      <div className="gallery-label">{title}</div>
      {children}
    </section>
  );
}

const noop = (): void => undefined;

/* ------------------------------------------------------------------ */
/* Gallery                                                            */
/* ------------------------------------------------------------------ */

/** True when the URL asks for the gallery. Dev tooling, never part of gameplay. */
export function isGalleryRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('gallery') === '1';
}

export function Gallery(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  const only = params.get('only');
  /*
   * An explicit width, because headless Chrome's --window-size does not reliably become the CSS
   * viewport - it laid out wider and cropped the screenshot, which looks exactly like an overflow
   * bug and sent me chasing one that was not there. Forcing the width here means a screenshot at
   * ?w=360 really is the 360px layout.
   */
  const width = params.get('w');

  const senior = seniorAtMaccabi();
  const euro = inEurope();
  const decisionEvent = EVENTS_BY_ID.sen_derby_moment;
  const decisionCareer = { ...senior, seasonSlot: 'late' as const };

  const revealOutcomes =
    decisionEvent && decisionEvent.choices[0]
      ? calculateOutcomeDistribution(decisionCareer, decisionEvent, decisionEvent.choices[0], 'late')
          .outcomes
      : [];

  const resolved =
    decisionEvent && decisionEvent.choices[0]
      ? resolveEventChoice(
          decisionCareer,
          decisionEvent.id,
          decisionEvent.choices[0].id,
          createRng(3),
          'late',
        )
      : null;

  const offerCareer = { ...senior, ability: 80, reputation: 72 };
  const offers = generateOffers(offerCareer, createRng(11));

  const screens: Array<[string, JSX.Element]> = [
    ['hub-senior', <PlayerHub career={senior} />],
    ['hub-academy', <PlayerHub career={academyBoy()} />],
    ['hub-loan', <PlayerHub career={abroadOnLoan()} />],
    ['hub-europe', <PlayerHub career={euro} />],
    [
      'decision',
      decisionEvent ? (
        <DecisionCard career={decisionCareer} event={decisionEvent} onChoose={noop} />
      ) : (
        <div />
      ),
    ],
    ['reveal', <OutcomeReveal outcomes={revealOutcomes} onDone={noop} />],
    [
      'outcome',
      resolved?.result ? (
        <OutcomeCard result={resolved.result} onContinue={noop} continueLabel="המשך" />
      ) : (
        <div />
      ),
    ],
    ['season', <SeasonResultCard career={senior} onContinue={noop} />],
    [
      'offers',
      offers.length > 0 ? (
        <OffersCard offers={offers} onAccept={noop} onDecline={noop} />
      ) : (
        <div className="faint">no offers generated for this fixture</div>
      ),
    ],
  ];

  const shown = only ? screens.filter(([name]) => name === only) : screens;

  /*
   * Wrapped in `.app` exactly as the real game is, so a gallery screenshot reproduces the real
   * layout constraints. Rendering the shell bare made the card look fine at 900px and overflow at
   * 390px, which is precisely the class of bug this tool exists to catch.
   */
  return (
    <div className="app gallery-app">
      {/*
        Pin the whole document to the requested width. Constraining only the app was not enough:
        the document is RTL, so a 390px app inside a wider viewport sits against the right edge and
        a 390px screenshot captures its left half. Sizing html/body means the screenshot is the
        layout.
      */}
      {width && (
        <style>{`
          html, body { width: ${width}px; max-width: ${width}px; overflow-x: hidden; }
          /*
            Pinned to the visual left. The document is RTL, so a narrow body inside a wider
            headless viewport sits against the right edge and the screenshot captures empty space
            plus half the layout. Absolute positioning is direction-agnostic.
          */
          body { position: absolute; left: 0; top: 0; margin: 0; }
        `}</style>
      )}
      <div className="shell gallery">
        {!only && <div className="gallery-title">MACCABIST — component gallery</div>}
        {shown.map(([name, node]) => (
          <Frame key={name} title={name}>
            {node}
          </Frame>
        ))}
      </div>
    </div>
  );
}

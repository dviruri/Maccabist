import { useEffect } from 'react';

import { EVENTS_BY_ID } from '../data/events';
import { MACCABI_ACADEMY_ID, MACCABI_ID } from '../data/clubs';
import { DecisionCard, OutcomeReveal } from '../components/DecisionCard';
import { OutcomeCard } from '../components/EventCard';
import { OffersCard } from '../components/OffersCard';
import {
  AmbientNewsHeader,
  MaccabiBanner,
  SamiOferHeader,
} from '../components/MaccabiCards';
import { CareerTimeline } from '../components/CareerTimeline';
import { OriginReveal } from '../components/OriginReveal';
import { StageLadder } from '../components/StageLadder';
import { resolveOrigin } from '../game/originEngine';
import { NewCareerPage } from '../pages/NewCareerPage';
import { PlayerHub } from '../components/PlayerHub';
import { SeasonResultCard } from '../components/SeasonCards';
import { RetirementPage } from '../pages/RetirementPage';
import { computeLegendScore } from '../game/legendEngine';
import { calculateOutcomeDistribution } from '../game/decisionEngine';
import { createCareer } from '../game/careerEngine';
import { resolveEventChoice } from '../game/eventEngine';
import { createRng } from '../game/random';
import { generateOffers } from '../game/transferEngine';
import { recordMaccabiSeason } from '../game/worldEngine';
import type { Career, CareerOrigin, SeasonRecord } from '../types';

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

/** A retired Maccabi legend, scored by the real Legend engine rather than a made-up number. */
const retiredLegend = (): Career => {
  const career: Career = {
    ...seniorAtMaccabi(),
    retired: true,
    retirementAge: 35,
    age: 35,
    currentSeason: 2056,
    peakAbility: 88,
    stats: { appearances: 512, goals: 96, assists: 74, cleanSheets: 0 },
    maccabi: {
      ...seniorAtMaccabi().maccabi,
      appearances: 384,
      goals: 71,
      assists: 58,
      seasons: 13,
      championships: 6,
      cups: 2,
      captainSeasons: 5,
      europeanRuns: 4,
      everLeft: false,
      academyGraduate: true,
      academySeasons: 9,
      debutAge: 18,
    },
    // A real span, so the poster's "2039-2056" line is not a fixture artifact.
    seasonHistory: Array.from({ length: 17 }, (_, i) =>
      seasonRecord({ season: 2039 + i, age: 18 + i }),
    ),
    milestones: [
      { id: 'debut', season: 2039, age: 18, icon: '👕', text: 'הופעת בכורה במכבי חיפה', major: true },
      { id: 'title', season: 2042, age: 21, icon: '🏆', text: 'אליפות ראשונה', major: true },
      { id: 'captain', season: 2049, age: 28, icon: '🎖️', text: 'קיבלת את הסרט', major: true },
    ],
  };
  return { ...career, legend: computeLegendScore(career) };
};

/** A career that never reached Maccabi's first team, so the poster's empty states are visible. */
const retiredModest = (): Career => {
  const career: Career = {
    ...base({
      academyStage: 'senior',
      currentClubId: 'hapoel_afula',
      retired: true,
      retirementAge: 32,
      age: 32,
      currentSeason: 2053,
      ability: 58,
      peakAbility: 63,
    }),
    stats: { appearances: 214, goals: 18, assists: 21, cleanSheets: 0 },
    milestones: [],
  };
  return { ...career, legend: computeLegendScore(career) };
};

/* --- the three Sami Ofer histories the brief names (v0.4.5.1) --- */

const rivalId = 'maccabi_tel_aviv';

/** A former captain and long-serving great, now at another top-flight club. */
const belovedFormerPlayer = (): Career => {
  const career = base({
    academyStage: 'senior',
    currentClubId: 'bnei_sakhnin',
    age: 32,
    ability: 74,
    roleValue: 70,
    currentSeason: 2053,
  });
  return {
    ...career,
    maccabi: {
      ...career.maccabi,
      appearances: 312,
      seasons: 11,
      championships: 4,
      cups: 2,
      captainSeasons: 4,
      academyGraduate: true,
      academySeasons: 9,
      everLeft: true,
    },
    seasonHistory: [seasonRecord({ clubId: MACCABI_ID })],
  };
};

/** Left Maccabi's senior side directly for a domestic rival. */
const controversialDeparture = (): Career => {
  const career = base({
    academyStage: 'senior',
    currentClubId: rivalId,
    age: 29,
    ability: 78,
    roleValue: 72,
    currentSeason: 2050,
  });
  return {
    ...career,
    maccabi: {
      ...career.maccabi,
      appearances: 190,
      seasons: 6,
      championships: 1,
      academyGraduate: true,
      academySeasons: 9,
      everLeft: true,
      betrayalMoments: 1,
    },
    seasonHistory: [seasonRecord({ clubId: MACCABI_ID }), seasonRecord({ clubId: rivalId })],
  };
};

/**
 * Turned away at the trials at nine, never played for them.
 *
 * The case the brief is most explicit about: this must NOT be framed as a former player returning.
 */
const rejectedAsAChild = (): Career => {
  const career = base({
    academyStage: 'senior',
    currentClubId: 'hapoel_tel_aviv',
    age: 27,
    ability: 71,
    roleValue: 66,
    currentSeason: 2048,
    origin: 'trial_rejected',
  });
  return {
    ...career,
    flags: ['released_by_maccabi'],
    maccabi: { ...career.maccabi, appearances: 0, seasons: 0, academySeasons: 0 },
  };
};

/* ------------------------------------------------------------------ */
/* The three openings (v0.4.5.1)                                       */
/* ------------------------------------------------------------------ */

/*
 * Run the real origin engine and keep the first seed that produces each opening, rather than
 * hand-building three Career objects. The gallery then shows exactly what a player gets - real
 * trial copy, real club, real chapter season - and a change to the engine's wording shows up here
 * instead of silently diverging from a fixture.
 */
function firstOriginOf(origin: CareerOrigin): Career {
  for (let seed = 1; seed <= 400; seed += 1) {
    const career = resolveOrigin(
      createCareer({ playerName: 'דויד', position: 'CM', seed }),
      createRng(seed),
    );
    if (career.origin === origin) return career;
  }
  // Every origin is reachable well inside 400 seeds; this is only here so the type is honest.
  return createCareer({ playerName: 'דויד', position: 'CM', seed: 1 });
}

const originScouted = (): Career => firstOriginOf('scouted');
const originAccepted = (): Career => firstOriginOf('trial_accepted');
const originRejected = (): Career => firstOriginOf('trial_rejected');

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

/**
 * Overflow probe (v0.4.5.1, Phase 19).
 *
 * With `?probe=1`, measures every rendered element against the viewport and writes the result to
 * `data-probe` on <html>, where a headless --dump-dom run can read it. Asking the page itself
 * beats inferring overflow from a screenshot: in v0.4.5 that inference produced a false positive,
 * because headless Chrome's --window-size is not the CSS viewport and an RTL document anchors
 * right, so a correct layout looked clipped.
 *
 * Note that the gallery pins html/body with `overflow-x: hidden`, so document.scrollWidth cannot
 * see the problem. Element rects can.
 */
/**
 * True when some ancestor clips this element horizontally.
 *
 * The walk stops at `.gallery-app`, which is the screenshot harness rather than app layout: it
 * sets `overflow-x: hidden` to pin the document to an exact phone width. Treating it as a
 * clipping ancestor made every element on the page look safely clipped, and the probe reported a
 * clean sweep at every width - including for a deliberately injected 600px element inside a 320px
 * layout, which is how the fault was caught.
 */
function isClipped(el: Element): boolean {
  let parent = el.parentElement;
  while (parent && parent !== document.body && !parent.classList.contains('gallery-app')) {
    if (getComputedStyle(parent).overflowX !== 'visible') return true;
    parent = parent.parentElement;
  }
  return false;
}

function useOverflowProbe(enabled: boolean, pinnedWidth: string | null): void {
  useEffect(() => {
    if (!enabled) return;
    const measure = (): void => {
      /*
       * Measure against the *pinned* width when there is one, not clientWidth. Headless Chrome
       * reports a clientWidth of its own choosing regardless of --window-size (504 in practice),
       * so comparing against it silently checked the wrong number and reported every layout clean.
       */
      const vw = pinnedWidth ? Number(pinnedWidth) : document.documentElement.clientWidth;
      const over = new Set<string>();
      for (const el of Array.from(document.querySelectorAll('*'))) {
        // html/body are the headless viewport itself, which is wider than the pinned width by
        // construction. Reporting them buries every real finding under the same two rows.
        if (el === document.documentElement || el === document.body) continue;
        // Clipped by an ancestor, so it cannot scroll the page. getBoundingClientRect returns
        // unclipped geometry, which made every decorative glow (.sami-lights, .poster-glow -
        // both deliberately inset-inline: -20% inside an overflow:hidden parent) look like a
        // layout bug. Without this the probe is noise.
        if (isClipped(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const past = Math.max(Math.round(r.right - vw), Math.round(-r.left));
        if (past > 1) {
          const name = typeof el.className === 'string' && el.className ? el.className : el.tagName;
          over.add(`${name.split(' ')[0]}+${past}`);
        }
      }
      document.documentElement.dataset.probe = `vw=${vw} over=${over.size} ${[...over]
        .slice(0, 6)
        .join(' ')}`;
    };
    // After fonts settle, since a fallback font can change wrapping and therefore widths.
    const id = window.setTimeout(measure, 300);
    return () => window.clearTimeout(id);
  }, [enabled, pinnedWidth]);
}

export function Gallery(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  useOverflowProbe(params.get('probe') === '1', params.get('w'));
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
    ['new-career', <NewCareerPage onCreate={noop} onBack={noop} />],
    /*
      Deliberately 600px wide, so `?probe=1` can be re-validated on demand. A clean overflow
      sweep only means something if the probe can still fail - this one reported all 25 scenes
      clean at every width while silently skipping every element on the page.
    */
    ['probe-canary', <div className="canary" style={{ width: 600, height: 8 }} />],
    ['ladder-senior', <StageLadder from="u19" to="senior" />],
    ['ladder-normal', <StageLadder from="children_b" to="children_a" />],
    ['ladder-early', <StageLadder from="children_a" to="youth_b" />],
    ['ladder-u19', <StageLadder from="youth_a" to="u19" />],
    ['origin-prodigy', <OriginReveal career={originScouted()} onContinue={noop} />],
    ['origin-accepted', <OriginReveal career={originAccepted()} onContinue={noop} />],
    ['origin-rejected', <OriginReveal career={originRejected()} onContinue={noop} />],
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
    ['sami-legend', <SamiOferHeader career={belovedFormerPlayer()} />],
    ['sami-traitor', <SamiOferHeader career={controversialDeparture()} />],
    ['sami-rejected', <SamiOferHeader career={rejectedAsAChild()} />],
    ['maccabi-banner', <MaccabiBanner career={belovedFormerPlayer()} />],
    ['maccabi-banner-rejected', <MaccabiBanner career={rejectedAsAChild()} />],
    ['news', <AmbientNewsHeader career={euro} />],
    ['timeline', <CareerTimeline career={retiredLegend()} defaultOpen />],
    ['season', <SeasonResultCard career={senior} onContinue={noop} />],
    ['retirement', <RetirementPage career={retiredLegend()} onNewCareer={noop} isBest />],
    ['retirement-modest', <RetirementPage career={retiredModest()} onNewCareer={noop} isBest={false} />],
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

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
import { LeagueTableCard } from '../components/LeagueTableCard';
import { MidSeasonCard } from '../components/SeasonCards';
import { GamePage } from '../pages/GamePage';
import { Sheet } from '../components/Sheet';
import { endManagerTenure, installManager, signAgent, startPersonalCoach } from '../game/peopleEngine';
import { PeopleCard } from '../components/PeopleCard';
import { LegacyCard } from '../components/LegacyCard';
import type { GameActions } from '../state/useGame';
import { ClubCrest } from '../components/ClubCrest';
import { getClub } from '../data/clubs';
import { LEAGUE_MEMBERSHIP } from '../data/worldClubs';
import { resolveOrigin } from '../game/originEngine';
import { positionsForOutcome, projectSeason } from '../game/leagueEngine';
import { leagueShape } from '../data/leagueShape';
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
/** A career with every kind of person attached, for the people-screen scene (v0.5). */

/** A career deep in the record book, for the legacy-screen scene (v0.6). */
const legacyCareer = (): Career => {
  const career = seniorAtMaccabi();
  const records = Array.from({ length: 9 }, (_, i) => ({
    season: 2040 + i,
    age: 19 + i,
    academyStage: 'senior' as const,
    clubId: 'maccabi_haifa',
    clubName: 'מכבי חיפה',
    teamName: 'מכבי חיפה',
    league: 'ליגת העל',
    onLoan: false,
    stats: { appearances: 31, starts: 30, goals: 6, assists: 7, cleanSheets: 0, goalsConceded: 0, rating: 74, injuredGames: 0 },
    firstHalf: null,
    ability: 74,
    role: 'starter' as const,
    coachTrust: 74,
    trophies: [],
    captain: i >= 6,
    olderGroup: 'none' as const,
  }));
  return {
    ...career,
    seasonHistory: [...career.seasonHistory, ...records],
    trophies: [
      ...career.trophies,
      { id: 'championship', name: 'אליפות', season: 2043, clubId: 'maccabi_haifa', clubName: 'מכבי חיפה', weight: 3 },
      { id: 'championship', name: 'אליפות', season: 2046, clubId: 'maccabi_haifa', clubName: 'מכבי חיפה', weight: 3 },
      { id: 'cup', name: 'גביע המדינה', season: 2044, clubId: 'maccabi_haifa', clubName: 'מכבי חיפה', weight: 1.5 },
    ],
  };
};

const peopleCareer = (): Career => {
  let career = seniorAtMaccabi();
  career = installManager(endManagerTenure(career, true));
  career = signAgent(career, 'israel_networker');
  career = startPersonalCoach(career, 'technical');
  if (career.people?.manager) {
    career = {
      ...career,
      people: {
        ...career.people,
        manager: { ...career.people.manager, gaveDebut: true },
        managerHistory: [
          {
            person: { id: 'px_mgr', type: 'club_manager', name: 'דורון אזולאי', shortName: 'אזולאי', archetypeId: 'conservative', createdSeason: 2040, country: 'ישראל' },
            clubId: 'hapoel_haifa',
            fromSeason: 2040,
            toSeason: 2043,
            finalTrust: 58,
          },
          /* v0.5.1: a deliberately long foreign name, to stress the row at 320px. */
          {
            person: { id: 'px_mgr2', type: 'club_manager', name: 'כריסטוס פפאדופולוס־ניקולאידיס', shortName: 'פפאדופולוס', archetypeId: 'star_driven', createdSeason: 2044, country: 'יוון' },
            clubId: 'union_sg',
            fromSeason: 2044,
            toSeason: 2047,
            finalTrust: 71,
          },
        ],
        personalCoachHistory: [
          {
            person: { id: 'px_pc', type: 'personal_coach', name: 'מוטי בן־חיים', shortName: 'בן־חיים', archetypeId: 'goalkeeping', createdSeason: 2041, country: 'ישראל' },
            specialty: 'goalkeeping',
            sinceSeason: 2041,
            endedSeason: 2045,
            seasonsTogether: 4,
          },
        ],
      },
    };
  }
  return career;
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
    /*
     * v0.6: the fixture's counters, records and trophy list now AGREE - the previous version
     * said 384 appearances in the counter while its own season records summed to 527 and its
     * trophy list was empty, which is exactly the inconsistency `legacy_facts_counter_mismatch`
     * forbids in real careers. A showcase should not model the bug the engine bans.
     */
    maccabi: {
      ...seniorAtMaccabi().maccabi,
      appearances: 527,
      goals: 153,
      assists: 102,
      seasons: 17,
      championships: 6,
      cups: 2,
      captainSeasons: 7,
      europeanRuns: 4,
      everLeft: false,
      academyGraduate: true,
      academySeasons: 9,
      debutAge: 18,
    },
    seasonHistory: Array.from({ length: 17 }, (_, i) =>
      seasonRecord({ season: 2039 + i, age: 18 + i, captain: i >= 10 }),
    ),
    trophies: [
      ...[2042, 2044, 2046, 2049, 2052, 2054].map((season) => ({
        id: 'championship', name: 'אליפות', season, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 3,
      })),
      ...[2045, 2051].map((season) => ({
        id: 'cup', name: 'גביע המדינה', season, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 1.5,
      })),
    ],
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

/* A senior season with milestones stamped to it, for the season-memories strip. */

/** v0.6.5 QA grid: the whole Israeli pyramid with live crest resolution. Dev-only. */
function IsraelClubGallery(): JSX.Element {
  const divisions: Array<[string, readonly string[]]> = [
    ['ליגת העל', LEAGUE_MEMBERSHIP.il_premier ?? []],
    ['הליגה הלאומית', LEAGUE_MEMBERSHIP.il_leumit ?? []],
    ['ליגה א׳ צפון', LEAGUE_MEMBERSHIP.il_alef_north ?? []],
    ['ליגה א׳ דרום', LEAGUE_MEMBERSHIP.il_alef_south ?? []],
  ];
  return (
    <div className="stack">
      {divisions.map(([title, ids]) => (
        <section key={title} className="card">
          <h3>{title} ({ids.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {ids.map((id) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <ClubCrest clubId={id} name={getClub(id).name} size="medium" />
                <div>
                  <div>{getClub(id).name}</div>
                  <div style={{ opacity: 0.6, direction: 'ltr', fontSize: 10 }}>{id}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const memorableSeason = (): Career => {
  const career = seniorAtMaccabi();
  const season = career.lastSeasonRecord?.season ?? career.currentSeason;
  return {
    ...career,
    milestones: [
      { id: 'm1', season, age: career.age, icon: '🏆', text: 'אליפות ראשונה עם מכבי חיפה', major: true },
      { id: 'm2', season, age: career.age, icon: '🎯', text: 'השער ה-50 שלך בליגה', major: false },
      { id: 'm3', season, age: career.age, icon: '🇮🇱', text: 'הופעת בכורה בנבחרת', major: true },
    ],
  };
};

/*
 * A season that ended in a lost cup final (v0.6.2).
 *
 * The only way to see the new cup line, because a won cup shows as a trophy and an early exit is
 * deliberately silent. Built by setting the authoritative state rather than by faking the line -
 * if `CupRunLine` stops reading `world.cup`, this fixture goes blank and says so.
 */
const lostCupFinal = (): Career => {
  const career = seniorAtMaccabi();
  const record = career.lastSeasonRecord;
  if (!record) return career;
  return {
    ...career,
    world: {
      ...career.world,
      cup: {
        season: record.season,
        clubId: record.clubId,
        trophyId: 'cup',
        run: 'runner_up',
        finalOpponentId: 'hapoel_haifa',
      },
    },
  };
};

/*
 * A senior career with a live projection, for the table scenes. Runs the real projector rather
 * than hand-building a table, so the gallery shows what the game actually generates.
 */
/* A mid-season senior career with a live table, for the phase-37 standing line. */
/* A senior career sitting on a pending decision, which is the ordinary gameplay state. */
const eventCareer = (): Career => {
  const base = tableCareer(MACCABI_ID, 3);
  return {
    ...base,
    phase: 'event',
    seasonSlot: 'late',
    seasonPoint: 'midseason',
    pendingEventIds: ['sen_derby_moment'],
    lastEventResult: null,
  };
};

/* The same gameplay state, at a club that is not Maccabi - so the Maccabi side line shows. */
const awayEventCareer = (): Career => {
  const base = tableCareer('hapoel_hadera', 11);
  return {
    ...base,
    phase: 'event',
    seasonSlot: 'late',
    seasonPoint: 'midseason',
    pendingEventIds: ['wrl_relegation_battle'],
    lastEventResult: null,
  };
};

/* Put a career on a specific pending event, which is what ordinary gameplay looks like. */
const playCareer = (career: Career, eventId: string): Career => ({
  ...career,
  phase: 'event',
  seasonSlot: 'late',
  seasonPoint: 'midseason',
  pendingEventIds: [eventId],
  lastEventResult: null,
});

/* A senior career whose season is pinned to a given outcome, for the race scenarios. */
const forcedOutcome = (clubId: string, outcome: Career['world']['clubSeasons'][number]['outcome']): Career => {
  const career = tableCareer(clubId, 4);
  const projection = career.world.projection;
  if (!projection) return career;
  const shape = leagueShape(projection.leagueId);
  if (!shape) return career;
  const band = positionsForOutcome(projection.leagueId, outcome, shape);
  const position = band[Math.floor(band.length / 2)] ?? projection.finalPosition;
  return {
    ...career,
    world: {
      ...career.world,
      projection: {
        ...projection,
        finalPosition: position,
        finalOutcome: outcome,
        path: { early: position, mid: position, late: position, end: position },
      },
    },
  };
};

/* A loan offer, so the parent -> destination header can be looked at. */
const loanOffers = (): Career['pendingOffers'] => [
  {
    id: 'loan_demo',
    kind: 'loan',
    clubId: 'hapoel_kfar_saba',
    clubName: 'הפועל כפר סבא',
    league: 'הליגה הלאומית',
    country: 'ישראל',
    title: 'השאלה לעונה',
    description:
      'המועדון רוצה שתשחק. בכפר סבא מחכים לך דקות אמיתיות, ובמכבי ימשיכו לעקוב מקרוב.',
    acceptEffects: {},
    declineEffects: {},
    acceptLabel: 'לצאת להשאלה',
    declineLabel: 'להישאר ולהילחם',
    expectedRole: 'starter',
    direction: 'down',
    hints: ['⬇ רמת ליגה', '⚽ דקות מובטחות', '↩ חוזרים בסוף העונה'],
  },
];

const midSeasonCareer = (): Career => {
  const base = tableCareer(MACCABI_ID, 3);
  return {
    ...base,
    seasonPoint: 'midseason',
    seasonSlot: 'mid',
    firstHalfStats: { appearances: 14, starts: 12, goals: 4, assists: 3, cleanSheets: 0, goalsConceded: 0, rating: 71, injuredGames: 0 },
  };
};

const tableCareer = (clubId: string, seed: number): Career => {
  const base = seniorAtMaccabi();
  const career: Career = {
    ...base,
    currentClubId: clubId,
    academyStage: 'senior',
    currentSeason: 2044,
    seasonPoint: 'preseason',
    seasonSlot: 'mid',
  };
  const projection = projectSeason(career.world, clubId, 2044, null, null, createRng(seed));
  const maccabi =
    clubId === MACCABI_ID
      ? null
      : projectSeason(career.world, MACCABI_ID, 2044, null, null, createRng(seed + 91));
  return { ...career, world: { ...career.world, projection, maccabiProjection: maccabi } };
};

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
      /*
       * Scroll depth (v0.4.7, Phase 45). How far down the page the active decision begins, and
       * how tall the whole thing is. `.event-card` is the decision; `.btn-choice` is the first
       * thing a player can actually press.
       */
      const body = document.body.getBoundingClientRect();
      const yOf = (selector: string): number => {
        const el = document.querySelector(selector);
        return el ? Math.round(el.getBoundingClientRect().top - body.top) : -1;
      };
      const depth = [
        `event=${yOf('.event-card')}`,
        `choice=${yOf('.btn-choice')}`,
        `total=${Math.round(body.height)}`,
      ].join(' ');

      document.documentElement.dataset.probe = `vw=${vw} over=${over.size} ${[...over]
        .slice(0, 6)
        .join(' ')} | ${depth}`;
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
  const decisionFour = EVENTS_BY_ID.kids_older_group;
  /*
   * v0.4.6: a decision fixture needs a live projection, otherwise the match strip has no
   * opponent to name and correctly falls back to the league name - which looks like the old
   * behaviour rather than the new one.
   */
  const decisionCareer = { ...tableCareer(MACCABI_ID, 3), seasonSlot: 'late' as const };

  /*
   * A cup final with the strip showing both finalists (v0.6.3, D5). The opponent is set in the
   * authoritative cup state - the same fact the strip reads - so this fixture goes blank if the
   * strip ever stops reading it.
   */
  const cupFinalEvent = EVENTS_BY_ID.sen_cup_final_won;
  const cupFinalCareer: Career = {
    ...decisionCareer,
    world: {
      ...decisionCareer.world,
      cup: {
        season: decisionCareer.currentSeason,
        clubId: decisionCareer.currentClubId,
        trophyId: 'cup' as const,
        run: 'winners' as const,
        finalOpponentId: 'maccabi_tel_aviv',
      },
    },
  };

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

  /*
   * The whole gameplay screen, for measuring how far a player scrolls before the event starts
   * (v0.4.7). Rendering the real GamePage rather than a mock of it - a measurement taken against
   * an approximation of the layout would measure the approximation.
   */
  const noopActions = new Proxy({} as GameActions, { get: () => noop });

  const screens: Array<[string, JSX.Element]> = [
    ['gameplay', <GamePage career={eventCareer()} actions={noopActions} onExit={noop} />],
    ['gameplay-away', <GamePage career={awayEventCareer()} actions={noopActions} onExit={noop} />],
    /* Phase 46 scenarios A, D, E, H, K, N, O. */
    ['play-academy', <GamePage career={playCareer(academyBoy(), 'kids_older_group')} actions={noopActions} onExit={noop} />],
    ['play-abroad', <GamePage career={playCareer(tableCareer('union_sg', 7), 'es_form_slump')} actions={noopActions} onExit={noop} />],
    ['play-title', <GamePage career={playCareer(forcedOutcome('maccabi_haifa', 'champion'), 'sen_title_run_in')} actions={noopActions} onExit={noop} />],
    ['play-relegation', <GamePage career={playCareer(forcedOutcome('hapoel_hadera', 'relegation_battle'), 'wrl_relegation_battle')} actions={noopActions} onExit={noop} />],
    ['play-gk', <GamePage career={{ ...playCareer(tableCareer(MACCABI_ID, 3), 'gk_derby_save'), position: 'GK' }} actions={noopActions} onExit={noop} />],
    ['play-longname', <GamePage career={playCareer(tableCareer('union_sg', 2), 'sen_new_coach')} actions={noopActions} onExit={noop} />],
    ['four-outcomes', decisionFour ? (
      <DecisionCard career={academyBoy()} event={decisionFour} onChoose={noop} defaultExpanded="go_up" />
    ) : <div />],
    ['loan-offer', <OffersCard offers={loanOffers()} onAccept={noop} onDecline={noop} fromClub="מכבי חיפה" />],
    ['sheet-table', <Sheet open title="ליגת העל" subtitle="מחזור 13" onClose={noop}>
      <LeagueTableCard career={tableCareer(MACCABI_ID, 3)} defaultOpen inSheet />
    </Sheet>],
    /* v0.5: the people screen, with every relationship populated so the layout is stressed. */
    ['sheet-people', <Sheet open title="האנשים שלי" onClose={noop}>
      <PeopleCard career={peopleCareer()} />
    </Sheet>],
    /* v0.6: the legacy screen, on a career deep enough to light every section. */
    ['sheet-legacy', <Sheet open title="מורשת מכבי" onClose={noop}>
      <LegacyCard career={legacyCareer()} />
    </Sheet>],
    ['sheet-timeline', <Sheet open title="סיפור הקריירה" onClose={noop}>
      <CareerTimeline career={retiredLegend()} defaultOpen />
    </Sheet>],
    ['new-career', <NewCareerPage onCreate={noop} onBack={noop} />],
    /*
      Deliberately 600px wide, so `?probe=1` can be re-validated on demand. A clean overflow
      sweep only means something if the probe can still fail - this one reported all 25 scenes
      clean at every width while silently skipping every element on the page.
    */
    ['probe-canary', <div className="canary" style={{ width: 600, height: 8 }} />],
    ['crests', <div className="row row-wrap" style={{ gap: 10 }}>
      {['maccabi_haifa','hapoel_haifa','maccabi_tel_aviv','hapoel_tel_aviv','hapoel_beer_sheva',
        'beitar_jerusalem','maccabi_netanya','bnei_sakhnin','ironi_kiryat_shmona','hapoel_hadera',
        'maccabi_herzliya','hapoel_kfar_saba','filler_x_a','filler_x_b'].map((id) => (
        <ClubCrest key={id} clubId={id} name={id} size="large" />
      ))}
    </div>],
    ['table-maccabi', <LeagueTableCard career={tableCareer(MACCABI_ID, 3)} />],
    ['table-full', <LeagueTableCard career={tableCareer(MACCABI_ID, 3)} defaultOpen />],
    ['table-away', <LeagueTableCard career={tableCareer('hapoel_hadera', 11)} />],
    ['table-second', <LeagueTableCard career={tableCareer('hapoel_petah_tikva', 5)} />],
    /* v0.6.3: the reported league. Twenty named Serie A rows, real crests where imported. */
    ['table-italy', <LeagueTableCard career={tableCareer('bologna', 7)} defaultOpen />],
    /*
     * v0.6.4: the two hardest tables for layout. Spain carries the longest Hebrew club name in
     * the dataset (דפורטיבו לה קורוניה) and England is twenty rows of Latin-derived names, so
     * between them they are where a crest column would push text into truncation.
     */
    ['table-spain', <LeagueTableCard career={tableCareer('getafe', 5)} defaultOpen />],
    /*
     * v0.6.5, E13: every active Israeli club on one screen - crest, name, league. The point is
     * QA by eye: a wrong badge, a duplicate, a wordmark or a broken transparent background is
     * visible here in a way no automated test can promise. Data-driven from the membership
     * lists, so a club added to the pyramid appears without touching this file.
     */
    ['israel-clubs', <IsraelClubGallery />],
    /* v0.6.5: a Liga Alef district table - long Arab-community club names at the narrowest widths. */
    ['table-alef', <LeagueTableCard career={tableCareer('hapoel_nof_hagalil', 3)} defaultOpen />],
    ['table-england', <LeagueTableCard career={tableCareer('brighton', 9)} defaultOpen />],
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
    [
      'decision-cup-final',
      cupFinalEvent ? (
        <DecisionCard career={cupFinalCareer} event={cupFinalEvent} onChoose={noop} />
      ) : (
        <div />
      ),
    ],
    [
      'odds',
      decisionEvent ? (
        <DecisionCard
          career={decisionCareer}
          event={decisionEvent}
          onChoose={noop}
          defaultExpanded={decisionEvent.choices[0]?.id}
        />
      ) : (
        <div />
      ),
    ],
    ['reveal', <OutcomeReveal outcomes={revealOutcomes} onDone={noop} />],
    /* The locked frame (v0.4.8): the reel has stopped on the resolved outcome. */
    ['reveal-locked', <OutcomeReveal
      outcomes={revealOutcomes}
      resolvedOutcomeId={revealOutcomes[1]?.id}
      onDone={noop}
    />],
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
    ['midseason', <MidSeasonCard career={midSeasonCareer()} onContinue={noop} />],
    /* A season that actually produced milestones, so the "what you will remember" strip renders. */
    ['season-memorable', <SeasonResultCard career={memorableSeason()} onContinue={noop} />],
    ['season-cup-final-lost', <SeasonResultCard career={lostCupFinal()} onContinue={noop} />],
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
          /*
            Pin fixed-position UI too (v0.4.7).

            A bottom sheet is \`position: fixed; inset: 0\`, which resolves against the *viewport* -
            and headless Chrome's viewport is not the pinned body width. The first sheet screenshot
            showed club names cut off at the right edge, which looked exactly like a layout bug and
            was the harness measuring 504px while the page was pinned to 390. Same class of false
            positive as the v0.4.5 overflow scare.

            Physical left/right on purpose: the document is RTL, so \`inset-inline: 0 auto\` anchors
            to the *viewport's* right edge and pushes the sheet off a narrow screenshot entirely.
          */
          /*
            Physical left/right on purpose: the document is RTL, so a logical inset anchors to the
            viewport's right edge and pushes the sheet off a narrow screenshot entirely.
          */
          .sheet-root { left: 0; right: auto; width: ${width}px; }
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

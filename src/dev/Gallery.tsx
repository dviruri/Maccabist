import { Fragment, useEffect, useState } from 'react';

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
import { ClubAlbum, buildAlbum } from '../components/ClubAlbum';
import { EuropeCard, EuropeJourneySummary } from '../components/EuropeCards';
import { CareerFeedFull, CareerHomeScene } from '../components/CareerHome';
import { DecisionScreen } from '../components/DecisionScreen';
import { CareerMomentScreen } from '../components/CareerMoments';
import { JourneyTimeline, TrophyShowcase } from '../components/JourneyTimeline';
import { MatchdayExperience } from '../components/Matchday';
import { buildMatchday } from '../game/matchdayPresenter';
import { CinematicBackdrop, GameSectionTitle, MomentShell, PlayerHero } from '../components/gamefeel';
import { getTrophyArt } from '../ui/playerArt';
import { CareerJourney } from '../components/SeasonCardV2';
import { TrophyCabinet } from '../components/TrophyCabinet';
import { buildArchivedCareer } from '../game/archive';
import { renderCareerPoster } from '../services/posterRenderer';
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
import { CREST_MANIFEST } from '../data/clubCrests.generated';
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
import type { Career, CareerOrigin, EuropeanJourney, IndividualHonor, SeasonRecord } from '../types';

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
/**
 * v0.7: renders the 9:16 poster canvas into an <img>, so Scenario N is something a headless
 * browser can actually open and measure instead of a claim.
 */
function PosterPreview(): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const archive = buildArchivedCareer({ ...retiredLegend(), honors: galleryHonors() });
    renderCareerPoster(archive, 'story')
      .then((canvas) => setSrc(canvas.toDataURL('image/png')))
      .catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <div data-poster="error">{error}</div>;
  if (!src) return <div data-poster="loading">מייצר פוסטר…</div>;
  return <img data-poster="ready" src={src} alt="פוסטר קריירה 9:16" style={{ width: '100%' }} />;
}

/**
 * v0.8: the canonical European journey fixture - the story the release is named for. An
 * Israeli champion enters UCL qualifying, survives a round, falls to the Europa League, falls
 * again to the Conference, and makes the knockouts there.
 */
const galleryJourney = (): EuropeanJourney => ({
  season: 2049,
  clubId: MACCABI_ID,
  steps: [
    { kind: 'entered', competition: 'uefa_champions_league', entry: 'ucl_q1', reason: 'champion' },
    {
      kind: 'tie',
      tie: {
        stage: 'ucl_q1', competition: 'uefa_champions_league', opponentId: 'fld_ludogorets',
        opponentName: 'לודוגורץ',
        legs: [{ for: 2, against: 1, home: true }, { for: 1, against: 1, home: false }],
        aggFor: 3, aggAgainst: 2, won: true,
      },
    },
    {
      kind: 'tie',
      tie: {
        stage: 'ucl_q2', competition: 'uefa_champions_league', opponentId: 'fld_red_star',
        opponentName: 'הכוכב האדום',
        legs: [{ for: 0, against: 1, home: true }, { for: 1, against: 2, home: false }],
        aggFor: 1, aggAgainst: 3, won: false,
      },
    },
    { kind: 'dropped', from: 'uefa_champions_league', to: 'uefa_europa_league', toEntry: 'uel_q3' },
    {
      kind: 'tie',
      tie: {
        stage: 'uel_q3', competition: 'uefa_europa_league', opponentId: 'fld_fenerbahce',
        opponentName: 'פנרבחצ׳ה',
        legs: [{ for: 1, against: 1, home: true }, { for: 0, against: 2, home: false }],
        aggFor: 1, aggAgainst: 3, won: false,
      },
    },
    { kind: 'dropped', from: 'uefa_europa_league', to: 'uefa_conference_league', toEntry: 'uecl_po' },
    {
      kind: 'tie',
      tie: {
        stage: 'uecl_po', competition: 'uefa_conference_league', opponentId: 'fld_hajduk',
        opponentName: 'האידוק ספליט',
        legs: [{ for: 3, against: 0, home: true }, { for: 1, against: 2, home: false }],
        aggFor: 4, aggAgainst: 2, won: true,
      },
    },
    {
      kind: 'league_phase', competition: 'uefa_conference_league', position: 12, points: 10,
      won: 3, drawn: 1, lost: 2, goalsFor: 9, goalsAgainst: 7,
    },
    {
      kind: 'tie',
      tie: {
        stage: 'ko_playoff', competition: 'uefa_conference_league', opponentId: 'fld_legia',
        opponentName: 'לגיה ורשה',
        legs: [{ for: 2, against: 0, home: true }, { for: 0, against: 1, home: false }],
        aggFor: 2, aggAgainst: 1, won: true,
      },
    },
    {
      kind: 'tie',
      tie: {
        stage: 'r16', competition: 'uefa_conference_league', opponentId: 'fld_basel',
        opponentName: 'באזל',
        legs: [{ for: 1, against: 1, home: true }, { for: 0, against: 0, home: false }],
        aggFor: 1, aggAgainst: 2, won: false, decidedBy: 'extra_time',
      },
    },
  ],
  finalCompetition: 'uefa_conference_league',
  furthest: 'r16',
  matches: 15,
  wonCompetition: null,
  reachedFinal: false,
  reachedSemiFinal: false,
  reachedLeaguePhase: true,
});

/** A senior career whose current season carries the journey, for the EuropeCard scene. */
const europeanSeasonCareer = (): Career => {
  const base = seniorAtMaccabi();
  return {
    ...base,
    currentSeason: 2049,
    world: {
      ...base.world,
      europe: {
        coefficients: { associations: {}, clubs: {} },
        history: [],
        current: {
          season: 2049,
          entries: [],
          winners: {
            uefa_champions_league: { clubId: 'real_madrid', name: 'ריאל מדריד' },
            uefa_europa_league: { clubId: 'fld_galatasaray', name: 'גלאטסראיי' },
            uefa_conference_league: { clubId: 'fld_copenhagen', name: 'קופנהגן' },
          },
          playerJourney: galleryJourney(),
          maccabiJourney: null,
        },
      },
    },
  };
};

/**
 * v0.9.1: the matchday screen needs its prebuilt presentation, like the real caller.
 *
 * v0.9.3: `at` picks a state to inspect. The screen is a state machine now, so PREVIEW, LIVE,
 * HALF TIME and FULL TIME each need their own scene - measuring only the preview and the
 * conclusion is how the intermediate states escape the audit.
 */
function MatchdaySceneDemo({
  revealAll = false,
  at,
}: {
  revealAll?: boolean;
  at?: 'live' | 'half_time';
}): JSX.Element {
  const career = midSeasonCareer();
  const matchday = buildMatchday(career);
  if (!matchday) return <div>no matchday</div>;
  /* The biggest moment for LIVE, the half-time whistle for HALF TIME - both real, not indices. */
  const target =
    at === 'half_time'
      ? matchday.moments.findIndex((moment) => moment.kind === 'half_time')
      : at === 'live'
        ? matchday.moments.findIndex((moment) => moment.big)
        : -1;
  const fallback = at === undefined ? undefined : Math.max(1, Math.floor(matchday.moments.length / 2));
  return (
    <MatchdayExperience
      career={career}
      matchday={matchday}
      autoReveal={revealAll}
      revealTo={target >= 0 ? target + 1 : fallback}
      onContinue={() => undefined}
    />
  );
}

/** v0.7: a believable honors list for the meta scenes. */
const galleryHonors = (): IndividualHonor[] => [
  { type: 'top_scorer', season: 2046, leagueId: 'il_premier', league: 'ליגת העל', clubId: MACCABI_ID, position: 'ST', statValue: 24, age: 25 },
  { type: 'top_scorer', season: 2049, leagueId: 'il_premier', league: 'ליגת העל', clubId: MACCABI_ID, position: 'ST', statValue: 27, age: 28 },
  { type: 'player_of_season', season: 2049, leagueId: 'il_premier', league: 'ליגת העל', clubId: MACCABI_ID, position: 'ST', statValue: 71, age: 28 },
  { type: 'young_player_of_season', season: 2041, leagueId: 'il_premier', league: 'ליגת העל', clubId: MACCABI_ID, position: 'ST', statValue: 63, age: 20 },
];

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

/**
 * v0.6.5.1 (D15): the crest QA grid for EVERY modelled league.
 *
 * Each club shows its resolved crest, its name and its coverage state, so a wrong badge, a
 * duplicate, a wordmark or a broken transparent background is visible by eye - which no
 * automated test can promise. Data-driven from the membership lists, so a club added to any
 * division appears here without touching this file.
 */
function CrestCoverageGallery({ leagues }: { leagues: Array<[string, readonly string[]]> }): JSX.Element {
  return (
    <div className="stack">
      {leagues.map(([title, ids]) => {
        const real = ids.filter((id) => CREST_MANIFEST[id]).length;
        return (
          <section key={title} className="card">
            <h3>
              {title} ({real}/{ids.length} real)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {ids.map((id) => {
                const entry = CREST_MANIFEST[id];
                const state = entry ? (entry.regime === 'free-media' ? 'PD' : 'REF') : 'FALLBACK';
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <ClubCrest clubId={id} name={getClub(id).name} size="medium" />
                    <div style={{ minWidth: 0 }}>
                      <div>{getClub(id).name}</div>
                      <div style={{ opacity: 0.6, direction: 'ltr', fontSize: 10 }}>
                        {id} · {state}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Every modelled European league, for the same visual QA. */
function EuropeClubGallery(): JSX.Element {
  const leagues: Array<[string, readonly string[]]> = [
    ['England', LEAGUE_MEMBERSHIP.en_premier ?? []],
    ['Spain', LEAGUE_MEMBERSHIP.es_laliga ?? []],
    ['Germany', LEAGUE_MEMBERSHIP.de_bundesliga ?? []],
    ['Italy', LEAGUE_MEMBERSHIP.it_seriea ?? []],
    ['Netherlands', LEAGUE_MEMBERSHIP.nl_eredivisie ?? []],
    ['Belgium', LEAGUE_MEMBERSHIP.be_pro ?? []],
    ['Portugal', LEAGUE_MEMBERSHIP.pt_primeira ?? []],
    ['Austria', LEAGUE_MEMBERSHIP.at_bundesliga ?? []],
    ['Greece', LEAGUE_MEMBERSHIP.gr_superleague ?? []],
    ['Cyprus', LEAGUE_MEMBERSHIP.cy_first ?? []],
  ];
  return <CrestCoverageGallery leagues={leagues} />;
}

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

/**
 * A career that has just moved (v0.9.4): last season at Maccabi Haifa, this preseason at Torino,
 * so `deriveArrivalMoment` fires and the signing scene shows the NEW kit.
 */
const signingCareer = (): Career => ({
  ...tableCareer('bologna', 9),
  phase: 'preseason',
  seasonPoint: 'preseason',
  currentSeason: 2045,
  seasonHistory: [seasonRecord({ season: 2044, clubId: MACCABI_ID, clubName: 'מכבי חיפה' })],
});

/**
 * A settled season that produced a championship (v0.9.4), for the full-screen moment scene. The
 * cup state is cleared so the cup-final matchday does not claim the beat first, which it correctly
 * would otherwise.
 */
const championshipCareer = (): Career => {
  const base = homeCareer();
  const settled = seasonRecord({
    season: base.currentSeason,
    trophies: [
      { id: 'championship', name: 'אליפות', season: base.currentSeason, clubId: MACCABI_ID, clubName: 'מכבי חיפה', weight: 3 },
    ],
  });
  return {
    ...base,
    phase: 'season_result',
    seasonPoint: 'season_end',
    lastSeasonRecord: settled,
    world: { ...base.world, cup: null },
  };
};

/**
 * Offers for the decision scene (v0.9.3). The engine's own generator first, and if this career
 * happened to draw a single offer, the loan fixture joins it - the pager only exists when there
 * is more than one, and a scene that never shows it cannot audit it.
 */
const decisionOffers = (): Career['pendingOffers'] => {
  const generated = generateOffers({ ...seniorAtMaccabi(), ability: 80, reputation: 72 }, createRng(11));
  return generated.length > 1 ? generated : [...generated, ...loanOffers()];
};

/**
 * The home screen's own state (v0.9.3): a settled senior career at the start of a season, with
 * a real projection behind it - no event pending, so the home is the full scene rather than the
 * compact hero a decision collapses it to.
 */
/**
 * The two career forks, so they can be looked at (v0.9.5).
 *
 * Neither had a gallery scene before this release, which is why both were still rendering rows of
 * `btn btn-choice` after three passes of visual work: a screen with no way to screenshot it is a
 * screen nobody checks. Both are built from the real components with real career state.
 */
const youthForkCareer = (offers: number): Career => ({
  ...academyBoy(),
  age: 18,
  academyStage: 'u19',
  phase: 'youth_to_senior',
  lastProgression: {
    kind: 'senior',
    fromStage: 'u19',
    toStage: 'senior',
    title: 'עולה לבוגרים',
    detail: 'עשר שנים במגרשי האימונים של מכבי חיפה נגמרות היום. מכאן זו ליגה אחרת.',
    icon: '🎓',
    major: true,
  },
  pendingOffers: [
    {
      id: 'youth_maccabi',
      kind: 'promotion',
      clubId: MACCABI_ID,
      clubName: 'מכבי חיפה',
      league: 'ליגת העל',
      country: 'ישראל',
      title: 'עולים לבוגרים',
      description: 'הסגל הבוגר של מכבי חיפה פותח לך את הדלת.',
      acceptEffects: {},
      declineEffects: {},
      acceptLabel: 'עולים לבוגרים',
      declineLabel: '',
      expectedRole: 'rotation',
      direction: 'up',
      hints: ['🏠 המועדון שגידל אותך'],
    },
    ...(offers > 1
      ? [
          {
            id: 'youth_kfar_saba',
            kind: 'transfer' as const,
            clubId: 'hapoel_kfar_saba',
            clubName: 'הפועל כפר סבא',
            league: 'הליגה הלאומית',
            country: 'ישראל',
            title: 'מתחילים במקום אחר',
            description: 'בכפר סבא מבטיחים דקות אמיתיות מהיום הראשון.',
            acceptEffects: {},
            declineEffects: {},
            acceptLabel: 'מתחילים בכפר סבא',
            declineLabel: '',
            expectedRole: 'starter' as const,
            direction: 'down' as const,
            hints: ['⚽ דקות מהיום הראשון'],
          },
        ]
      : []),
  ],
});

/** The end of the road. Nothing but age and the two futures. */
const retirementCareer = (): Career => ({
  ...tableCareer(MACCABI_ID, 3),
  age: 35,
  phase: 'retirement_decision',
});

const homeCareer = (): Career => ({
  ...tableCareer(MACCABI_ID, 3),
  phase: 'preseason',
  seasonPoint: 'preseason',
  seasonHistory: [seasonRecord()],
  lastSeasonRecord: seasonRecord(),
});

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

function useOverflowProbe(enabled: boolean, pinnedWidth: string | null, need: string | null): void {
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

      /*
       * Vertical fit (v0.9.3, Phase 8). The one-screen rule is a claim about the DOCUMENT: a
       * primary game screen must not need scrolling to reach its score, its identity or its
       * primary action. `sh` is what the document actually wants; `vh` is what the phone gives
       * it. Reported rather than asserted here - the audit script decides the tolerance, so a
       * screen can be measured without the page deciding whether it passed.
       *
       * `need` asks the page a second question the height alone cannot answer: is each of these
       * elements present AND inside the viewport? A layout that fits because its primary button
       * was cropped away is exactly the cheat the brief forbids, and it shows up here as
       * `name=CUT` rather than as a clean number.
       */
      const vh = window.innerHeight;
      const sh = Math.max(
        document.documentElement.scrollHeight,
        Math.round(body.bottom - Math.min(0, body.top)),
      );
      const seen = (need ?? '')
        .split(';')
        .filter(Boolean)
        .map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return `${selector}=NONE`;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return `${selector}=HIDDEN`;
          const where = `${Math.round(r.top)}..${Math.round(r.bottom)}`;
          return r.top >= -1 && r.bottom <= vh + 1 ? `${selector}=OK(${where})` : `${selector}=CUT(${where})`;
        })
        .join(' ');

      document.documentElement.dataset.probe = `vw=${vw} vh=${vh} sh=${sh} over=${over.size} ${[...over]
        .slice(0, 6)
        .join(' ')} | ${depth}${seen ? ` | ${seen}` : ''}`;
    };
    // After fonts settle, since a fallback font can change wrapping and therefore widths.
    const id = window.setTimeout(measure, 300);
    return () => window.clearTimeout(id);
  }, [enabled, pinnedWidth, need]);
}

/**
 * Contrast probe (v0.9.4.x).
 *
 * With `?contrast=1`, reports every rendered text node whose colour fails WCAG AA against the
 * background it actually sits on, as JSON a `--dump-dom` run can read.
 *
 * ## Why this had to ask the page rather than read the stylesheet
 *
 * Maccabist declares almost no literal text colours - the palette is tokens, and colour is
 * inherited. The readability bugs that reached players were therefore invisible in the CSS: a
 * <button>, which this app uses for every tappable surface, does not inherit `color` from its
 * parent, so any descendant without an explicit colour fell to the UA default. That default is
 * BLACK, and the home screen's Europe panel shipped its competition and position line in
 * near-black on dark glass. Nothing in the source said `black` anywhere.
 *
 * Only the computed style of a rendered node can catch that, and only if the background is
 * resolved the way the eye resolves it - by compositing the translucent glass surfaces up the
 * ancestor chain until something opaque is reached, because that is the whole design language.
 */
function parseRgb(value: string): [number, number, number, number] {
  const nums = value.match(/[\d.]+/g)?.map(Number) ?? [];
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 1];
}

/** Composite `src` (with alpha) over `dst`. */
function over(src: [number, number, number, number], dst: [number, number, number]): [number, number, number] {
  const a = src[3];
  return [src[0] * a + dst[0] * (1 - a), src[1] * a + dst[1] * (1 - a), src[2] * a + dst[2] * (1 - a)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The colour behind this element, as the eye sees it.
 *
 * Walks outward compositing every translucent background onto the next until an opaque one is
 * found. Falling back to the page's own near-black is right for this app and, more importantly,
 * is the conservative choice: assuming a dark backdrop can only ever make dark text look worse,
 * so the probe cannot pass a genuine dark-on-dark by guessing.
 */
function effectiveBackground(el: Element): [number, number, number] {
  const stack: [number, number, number, number][] = [];
  let node: Element | null = el;
  while (node) {
    const bg = parseRgb(getComputedStyle(node).backgroundColor);
    if (bg[3] > 0) {
      stack.push(bg);
      if (bg[3] >= 0.999) break;
    }
    node = node.parentElement;
  }
  let base: [number, number, number] = [14, 18, 15];
  for (let i = stack.length - 1; i >= 0; i -= 1) base = over(stack[i]!, base);
  return base;
}

interface ContrastFail {
  ratio: string;
  color: string;
  bg: string;
  px: number;
  weight: number;
  sel: string;
  text: string;
}

function useContrastProbe(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const run = (): void => {
      const fails: ContrastFail[] = [];
      for (const el of Array.from(document.querySelectorAll('*'))) {
        /* Gallery chrome is the harness, not the game. */
        if (el.closest('.gallery-label, .gallery-title')) continue;
        /* Only elements that render text THEMSELVES; a wrapper's colour is its children's. */
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .trim();
        if (!own) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        /* Deliberately faded things - a fading-out toast, a decorative watermark - are not bugs. */
        if (Number(style.opacity) < 0.9) continue;
        /* Text painted as a gradient through the background is not this check's business. */
        if (style.webkitTextFillColor === 'transparent' || style.color === 'rgba(0, 0, 0, 0)') continue;
        /*
         * A watermark is not text. `.gf-hero-ghost` paints the position initials at 210px and
         * rgba(255,255,255,0.045) behind the hero, deliberately at the edge of visible; reporting
         * it every run would train the reader to skim past real findings. Nobody sets a quarter of
         * an alpha on something they expect to be read, so the alpha is the signal.
         */
        if (parseRgb(style.color)[3] < 0.25) continue;

        const bg = effectiveBackground(el);
        const fg = over(parseRgb(style.color), bg);
        const px = parseFloat(style.fontSize);
        const weight = Number(style.fontWeight) || 400;
        const large = px >= 24 || (px >= 18.66 && weight >= 700);
        const ratio = contrastRatio(fg, bg);
        if (ratio >= (large ? 3 : 4.5)) continue;
        const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
        fails.push({
          ratio: ratio.toFixed(2),
          color: `rgb(${fg.map(Math.round).join(',')})`,
          bg: `rgb(${bg.map(Math.round).join(',')})`,
          px: Math.round(px),
          weight,
          sel: `${el.tagName.toLowerCase()}${cls}`.slice(0, 70),
          text: own.slice(0, 48),
        });
      }
      const tag = document.createElement('script');
      tag.id = 'audit-result';
      tag.type = 'application/json';
      tag.textContent = JSON.stringify(fails);
      document.getElementById('audit-result')?.remove();
      document.body.appendChild(tag);
    };
    const id = window.setTimeout(run, 400);
    return () => window.clearTimeout(id);
  }, [enabled]);
}

export function Gallery(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  useOverflowProbe(params.get('probe') === '1', params.get('w'), params.get('need'));
  useContrastProbe(params.get('contrast') === '1');
  const only = params.get('only');
  /*
   * `?bare=1` (v0.9.3): the scene with no gallery chrome at all - no frame label, no gallery
   * padding, no stack gap. Measuring one-screen fit through the gallery's own wrapper would
   * measure the harness: `.gallery` adds block padding and `.gallery-frame` a label above every
   * scene, which is tens of pixels the real game never renders.
   */
  const bare = params.get('bare');
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
    /*
     * v0.9.3, Phase 6: the two destinations that GAINED content, as sheets. Worth their own
     * scenes because "one button, one destination" is checked by a test but composition is not.
     */
    ['sheet-club', <Sheet open title="המועדון שלי" onClose={noop}>
      <div className="stack">
        <PeopleCard career={peopleCareer()} />
        <GameSectionTitle>מורשת מכבי</GameSectionTitle>
        <LegacyCard career={legacyCareer()} />
      </div>
    </Sheet>],
    ['sheet-story', <Sheet open title="סיפור הקריירה" onClose={noop}>
      <div className="stack">
        <CareerFeedFull career={midSeasonCareer()} />
        <CareerTimeline career={retiredLegend()} defaultOpen />
      </div>
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
    ['europe-clubs', <EuropeClubGallery />],
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
    /* v0.7 meta surfaces, from the archived snapshot of the same legend fixture. */
    ['cabinet', <TrophyCabinet
      trophies={retiredLegend().trophies}
      honors={galleryHonors()}
      promotions={[{ season: 2043, detail: 'הפועל חדרה' }]}
    />],
    ['album', <ClubAlbum entries={buildAlbum([buildArchivedCareer(retiredLegend())])} />],
    ['poster', <PosterPreview />],
    /* v0.8: the European journey surfaces. */
    ['europe-card', <EuropeCard career={europeanSeasonCareer()} />],
    /* v0.9 foundation scenes */
    ['gf-hero', <CinematicBackdrop backdrop="home-dark"><PlayerHero career={seniorAtMaccabi()} /></CinematicBackdrop>],
    ['gf-home', <CareerHomeScene
      career={{ ...tableCareer(MACCABI_ID, 1), seasonPoint: 'midseason', firstHalfStats: { appearances: 12, starts: 11, goals: 6, assists: 3, cleanSheets: 0, goalsConceded: 0, rating: 67, injuredGames: 0 } }}
      focused={false}
      onOpenCareer={noop}
      onOpenTable={noop}
      onOpenEurope={noop}
      onOpenFeed={noop}
      onOpenPeople={noop}
    />],
    /*
     * v0.9.3: the WHOLE home screen, not just its scene - topbar, hero, status, next match,
     * feed, the season's own action and the bottom nav, exactly as the game assembles them.
     * The one-screen claim is about this, so this is what the viewport audit measures.
     */
    ['gf-play-home', <GamePage career={homeCareer()} actions={noopActions} onExit={noop} />],
    /*
     * v0.9.3: the transfer decision as the game assembles it - topbar, the offer owning the
     * viewport with no home scene above it, and the bottom nav still there so a player can
     * consult the table before answering. Three offers, so the pager is exercised.
     */
    ['gf-play-decision', <GamePage
      career={{ ...homeCareer(), phase: 'offseason', pendingOffers: decisionOffers() }}
      actions={noopActions}
      onExit={noop}
    />],
    ['gf-play-home-euro', <GamePage
      career={{ ...homeCareer(), ...europeanSeasonCareer(), phase: 'preseason', seasonPoint: 'preseason' }}
      actions={noopActions}
      onExit={noop}
    />],
    /*
     * v0.9.4, Phase 7: the two club-colour families the preview sheets check in isolation, now in
     * the game itself - a red club and a yellow/blue one. The crest and the shirt must agree.
     */
    ['gf-play-home-red', <GamePage
      career={{ ...tableCareer('hapoel_haifa', 6), phase: 'preseason', seasonPoint: 'preseason', seasonHistory: [seasonRecord({ clubId: 'hapoel_haifa', clubName: 'הפועל חיפה' })] }}
      actions={noopActions}
      onExit={noop}
    />],
    ['gf-play-home-yellow', <GamePage
      career={{ ...tableCareer('maccabi_tel_aviv', 4), phase: 'preseason', seasonPoint: 'preseason', seasonHistory: [seasonRecord({ clubId: 'maccabi_tel_aviv', clubName: 'מכבי תל אביב' })] }}
      actions={noopActions}
      onExit={noop}
    />],
    /*
     * The signing: the moment AFTER acceptance, which is where the new shirt is supposed to land.
     * The previous season was at Maccabi Haifa, so the arrival fires and he is already in Torino's
     * colours - the decision screen showed him in green.
     */
    ['gf-play-signing', <GamePage career={signingCareer()} actions={noopActions} onExit={noop} />],
    /*
     * v0.9.4, Phase 3: a goalkeeper's own home. His kit is one of four colours, chosen from
     * (seed, club, season), and it must be the same colour on every screen for that season.
     */
    ['gf-play-home-gk', <GamePage
      career={{ ...homeCareer(), position: 'GK' }}
      actions={noopActions}
      onExit={noop}
    />],
    /* And a boy in the academy: youth artwork, wearing the parent club's inherited colours. */
    ['gf-play-home-youth', <GamePage
      career={{ ...academyBoy(), phase: 'preseason', seasonPoint: 'preseason' }}
      actions={noopActions}
      onExit={noop}
    />],
    /*
     * v0.9.4: the home screen's third contextual state - an offer already on the table, before the
     * offseason beat makes it a decision. The slot has a priority, so this scene must show the
     * urgent panel and NOT the feed.
     */
    ['gf-play-home-offer', <GamePage
      career={{ ...homeCareer(), pendingOffers: decisionOffers() }}
      actions={noopActions}
      onExit={noop}
    />],
    /*
     * v0.9.4, Phase 1: a championship as the game assembles it. Before this release the season's
     * moments rendered inside `.play-main`, so this scene was the home screen with a moment in the
     * middle of it and the navigation below; it is a full-screen state now.
     */
    ['gf-play-championship', <GamePage career={championshipCareer()} actions={noopActions} onExit={noop} />],
    ['gf-matchday', <MatchdaySceneDemo />],
    ['gf-matchday-live', <MatchdaySceneDemo at="live" />],
    ['gf-matchday-half', <MatchdaySceneDemo at="half_time" />],
    ['gf-matchday-ft', <MatchdaySceneDemo revealAll />],
    ['gf-moment-uefa', <div className="gf-moment-screen"><CareerMomentScreen
      career={seniorAtMaccabi()}
      moment={{
        key: 'demo',
        backdrop: 'europe-night',
        overlay: 'star-lights',
        object: getTrophyArt('conference-generic'),
        kicker: 'עונת 2049/50 · מכבי חיפה',
        title: 'זכייה בקונפרנס ליג!',
        subtitle: 'הלילה הזה ייכנס להיסטוריה.',
        kitClubId: MACCABI_ID,
        mood: 'celebration',
      }}
      onContinue={noop}
    /></div>],
    ['gf-moment-relegation', <div className="gf-moment-screen"><CareerMomentScreen
      career={{ ...seniorAtMaccabi(), currentClubId: 'hapoel_hadera' }}
      moment={{
        key: 'demo2',
        backdrop: 'home-dark',
        kicker: 'עונת 2044/45 · הפועל חדרה',
        title: 'ירידת ליגה.',
        subtitle: 'ערב קשה. מה שתעשה מחר יגדיר אותך.',
        kitClubId: 'hapoel_hadera',
        mood: 'hero',
      }}
      onContinue={noop}
    /></div>],
    /* A youth-band moment, so the age resolver's youth character is audited on a moment too. */
    ['gf-moment-debut', <div className="gf-moment-screen"><CareerMomentScreen
      career={{ ...createCareer({ playerName: 'אורי דביר', position: 'ST', seed: 42 }), age: 17, academyStage: 'senior', currentClubId: MACCABI_ID }}
      moment={{
        key: 'demo3',
        backdrop: 'matchday-crowd',
        kicker: 'עונת 2039/40 · מכבי חיפה',
        title: 'הופעת הבכורה בבוגרים',
        subtitle: 'הרגע שכל ילד במחלקת הנוער חולם עליו.',
        clubId: MACCABI_ID,
        kitClubId: MACCABI_ID,
        age: 17,
        mood: 'celebration',
      }}
      onContinue={noop}
    /></div>],
    ['gf-journey', <div className="card"><JourneyTimeline seasons={buildArchivedCareer(retiredLegend()).seasons} honors={galleryHonors()} /></div>],
    ['gf-showcase', <div className="card"><TrophyShowcase trophies={retiredLegend().trophies} honors={galleryHonors()} /></div>],
    ['gf-decision', <DecisionScreen
      career={euro}
      offers={loanOffers()}
      onAccept={noop}
      onDecline={noop}
      fromClub="מכבי חיפה"
    />],
    ['gf-home-focused', <CareerHomeScene
      career={{ ...seniorAtMaccabi(), phase: 'event' }}
      focused
      onOpenCareer={noop}
      onOpenTable={noop}
      onOpenEurope={noop}
      onOpenFeed={noop}
      onOpenPeople={noop}
    />],
    ['gf-hero-gk', <CinematicBackdrop backdrop="home-dark"><PlayerHero career={{ ...seniorAtMaccabi(), position: 'GK' }} /></CinematicBackdrop>],
    ['gf-hero-youth-gk', <CinematicBackdrop backdrop="training"><PlayerHero career={{ ...createCareer({ playerName: 'אורי דביר', position: 'GK', seed: 42 }), age: 11 }} /></CinematicBackdrop>],
    /*
     * v0.9.4: composed, not pasted. The pack's championship scene has a generic footballer painted
     * into it, so the moment is built from an empty stadium, confetti, the league trophy and the
     * career player - who is the only person in the frame.
     */
    ['gf-moment', <MomentShell
      backdrop="trophy-ceremony"
      overlay="confetti-gold"
      object={getTrophyArt('league')}
      player={{ age: 24, position: 'CM', clubId: MACCABI_ID, seed: 42, season: 2049, context: 'celebration' }}
      kicker="עונת 2049/50"
      title="אלופת המדינה!"
      subtitle="מכבי חיפה"
      onContinue={noop}
    />],
    ['youth-fork', <GamePage career={youthForkCareer(1)} actions={noopActions} onExit={noop} />],
    ['youth-fork-two', <GamePage career={youthForkCareer(2)} actions={noopActions} onExit={noop} />],
    ['retirement-decision', <GamePage career={retirementCareer()} actions={noopActions} onExit={noop} />],
    ['europe-summary', <div className="card"><EuropeJourneySummary journey={galleryJourney()} /></div>],
    ['journey', <CareerJourney
      seasons={buildArchivedCareer(retiredLegend()).seasons.slice(-8)}
      position="ST"
      honors={galleryHonors()}
    />],
    ['retirement', <RetirementPage career={retiredLegend()} onNewCareer={noop} onOpenMeta={noop} isBest />],
    ['retirement-modest', <RetirementPage career={retiredModest()} onNewCareer={noop} onOpenMeta={noop} isBest={false} />],
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
          /*
            Same reason, for the fixed bottom navigation (v0.9.3). Headless Chrome refuses to lay
            out narrower than ~500px whatever --window-size says, so an \`inset-inline: 0\` bar
            spans 500px while the document is pinned to 390 and the overflow probe reports a
            110px overhang that does not exist on a phone. Pinning it is measuring the layout
            rather than the harness.
          */
          .gf-bottomnav { left: 0; right: auto; width: ${width}px; }
        `}</style>
      )}
      {bare === '1' ? (
        /*
          A full-page scene (GamePage, the matchday screen) brings its own shell. Fragment, not a
          div: a wrapper element would break `.app:has(> ...)`-shaped rules and make the harness
          measure a DOM the game never renders.
        */
        shown.map(([name, node]) => <Fragment key={name}>{node}</Fragment>)
      ) : bare === 'shell' ? (
        /* A component scene needs the shell it lives in during play - width and gutters. */
        <div className="shell">{shown.map(([name, node]) => <div key={name}>{node}</div>)}</div>
      ) : (
        <div className="shell gallery">
          {!only && <div className="gallery-title">MACCABIST — component gallery</div>}
          {shown.map(([name, node]) => (
            <Frame key={name} title={name}>
              {node}
            </Frame>
          ))}
        </div>
      )}
    </div>
  );
}

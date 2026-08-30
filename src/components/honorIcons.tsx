/**
 * The trophy and honor icon system (v0.7, Checkpoints E + I5).
 *
 * Original SVG, drawn here - no OS emoji for prestige (emoji rendering is what produced the red
 * "הסמל" regression), no copied real-world trophy designs, no UEFA artwork.
 *
 * The semantic rule this file exists to enforce:
 *
 *   League championship  →  a CHAMPIONSHIP PLATE (circular salver). Never a cup.
 *   Domestic cup         →  a CUP (handled trophy silhouette).
 *   Promotion            →  a distinct upward badge. Not a championship, not a cup.
 *   Individual honors    →  their own family: boot, assist mark, star medal, glove, rising star.
 *
 * Every icon is decorative (`aria-hidden`) - the award TYPE is always communicated by its text
 * label next to the icon, never by shape or colour alone.
 *
 * Palette: green / white / black identity, gold for prestige. Never red.
 */

import type { IndividualHonorType } from '../types';

const GOLD = 'var(--gold, #ffc94a)';
const GOLD_DEEP = 'var(--gold-deep, #c99a1e)';
const GREEN = 'var(--green-primary, #0fa64a)';
const SILVER = '#c8d2cb';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: React.ReactNode }): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** League championship: a circular salver plate. Deliberately NOT a cup. */
export function ChampionshipPlateIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="11" r="8.2" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="1.2" />
      <circle cx="12" cy="11" r="5.4" fill="none" stroke={GOLD_DEEP} strokeWidth="0.9" />
      <circle cx="12" cy="11" r="2.4" fill={GOLD_DEEP} />
      <rect x="8.5" y="20.2" width="7" height="1.6" rx="0.8" fill={GOLD_DEEP} />
    </Svg>
  );
}

/** Domestic cup: the handled trophy silhouette. */
export function CupIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="1" />
      <path d="M7 5.5H4.6a0 0 0 0 0 0 0c0 2.6 1 4.3 2.9 4.9M17 5.5h2.4c0 2.6-1 4.3-2.9 4.9" stroke={GOLD_DEEP} strokeWidth="1.3" fill="none" />
      <rect x="10.9" y="13.6" width="2.2" height="3.4" fill={GOLD_DEEP} />
      <rect x="8.2" y="17" width="7.6" height="2" rx="0.6" fill={GOLD_DEEP} />
      <rect x="7.2" y="19" width="9.6" height="1.6" rx="0.6" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="0.6" />
    </Svg>
  );
}

/** Promotion: an upward ribbon badge. Neither plate nor cup. */
export function PromotionBadgeIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3l5 5h-3v6h-4V8H7l5-5z" fill={GREEN} stroke="var(--green-deep, #06692d)" strokeWidth="1" />
      <path d="M8 16.5h8M8 19h8" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

/** A generic continental run: laurel around a star. Reserved slot - not a UEFA design. */
export function ContinentalIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M5 6c-1 4 0 9 3 12M19 6c1 4 0 9-3 12" stroke={SILVER} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M12 5.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5L12 5.5z" fill={SILVER} />
    </Svg>
  );
}

/** Youth silverware: a small pennant. */
export function YouthPennantIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M7 4v16" stroke={SILVER} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 4.5h9l-3 3.5 3 3.5H8V4.5z" fill={GREEN} stroke="var(--green-deep, #06692d)" strokeWidth="0.9" />
    </Svg>
  );
}

/** מלך השערים: an original golden boot. */
export function GoldenBootIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M5 15c0-4 2-8 3-9l2.5 2.5c2 2 5.5 3 8.5 4.5 1.6.8 2 1.9 2 3H5z" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="1" />
      <rect x="4" y="16.5" width="17" height="2" rx="0.8" fill={GOLD_DEEP} />
      <circle cx="8" cy="20.2" r="1" fill={GOLD_DEEP} />
      <circle cx="12" cy="20.2" r="1" fill={GOLD_DEEP} />
      <circle cx="16" cy="20.2" r="1" fill={GOLD_DEEP} />
    </Svg>
  );
}

/** מלך הבישולים: the pass that made the goal - an arrowed through-ball. */
export function AssistMarkIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="6.5" cy="17.5" r="2.6" fill="none" stroke={GOLD} strokeWidth="1.5" />
      <path d="M9.5 15.5C12 12.5 15 10 18.2 8.4" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2.6 2" fill="none" />
      <path d="M15.8 6.4l4.2-.9-.9 4.2" stroke={GOLD_DEEP} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** שחקן העונה: a star medal on a ribbon. */
export function SeasonStarIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M9 3h6l-1.4 5h-3.2L9 3z" fill={GREEN} />
      <circle cx="12" cy="14" r="6.2" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="1.1" />
      <path d="M12 10.3l1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4L12 10.3z" fill={GOLD_DEEP} />
    </Svg>
  );
}

/** שוער העונה: the keeper's glove. */
export function KeeperGloveIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M8 20v-6.5L6.2 11a1.5 1.5 0 0 1 2.1-2.1L10 10.5V5.4a1.3 1.3 0 0 1 2.6 0V10h.8V4.6a1.3 1.3 0 0 1 2.6 0V10h.8V6a1.3 1.3 0 0 1 2.6 0v8.6c0 2.4-1.3 4.4-3.4 5.4H8z"
        fill={GOLD}
        stroke={GOLD_DEEP}
        strokeWidth="1"
      />
      <path d="M8 17.5h8.5" stroke={GOLD_DEEP} strokeWidth="1" />
    </Svg>
  );
}

/** השחקן הצעיר: the rising star. */
export function RisingStarIcon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 19c3-1 5-3 6-6" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M8.4 12.6L10 13l-.4-1.6" stroke={GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15 4l1.5 3.1 3.5.5-2.5 2.4.6 3.5-3.1-1.7-3.1 1.7.6-3.5L10 7.6l3.5-.5L15 4z" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="0.8" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* UEFA competition marks (v0.8)                                       */
/* ------------------------------------------------------------------ */

/*
 * Original marks, not UEFA artwork. The competition names and official logos are UEFA
 * trademarks whose redistribution terms cannot be confirmed for inclusion in this repository,
 * so the brief's fallback applies: a clean asset layer (see `competitionAssets.ts`) ready to
 * serve an official file if one is ever licensed in, and tasteful original identifiers
 * meanwhile. Visual hierarchy is deliberate: the Champions League mark is the gold standard,
 * the Europa League substantial, the Conference green - a real campaign, not a consolation.
 */

/** ליגת האלופות: a crowned star in a champion's ring. The highest prestige tier. */
export function ChampionsLeagueMark(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.4" fill="none" stroke={GOLD} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="9.4" fill="none" stroke={GOLD_DEEP} strokeWidth="0.5" strokeDasharray="1.6 2.4" />
      <path d="M12 5.6l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6L12 5.6z" fill={GOLD} stroke={GOLD_DEEP} strokeWidth="0.7" />
    </Svg>
  );
}

/** הליגה האירופית: a silver orb on a rising arc. */
export function EuropaLeagueMark(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="12" cy="11" r="6.6" fill="none" stroke={SILVER} strokeWidth="1.6" />
      <circle cx="12" cy="11" r="3" fill={SILVER} />
      <path d="M4 19c4.5 2.4 11.5 2.4 16 0" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** הקונפרנס ליג: a green hex badge - a meaningful European campaign for the clubs it serves. */
export function ConferenceLeagueMark(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3.4l7 4v9.2l-7 4-7-4V7.4l7-4z" fill="none" stroke={GREEN} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" fill={GREEN} />
    </Svg>
  );
}

export function CompetitionMark({
  competition,
  size,
  className,
}: IconProps & { competition: 'uefa_champions_league' | 'uefa_europa_league' | 'uefa_conference_league' }): JSX.Element {
  switch (competition) {
    case 'uefa_champions_league':
      return <ChampionsLeagueMark size={size} className={className} />;
    case 'uefa_europa_league':
      return <EuropaLeagueMark size={size} className={className} />;
    case 'uefa_conference_league':
      return <ConferenceLeagueMark size={size} className={className} />;
  }
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export type TrophyIconKind =
  | 'plate'
  | 'cup'
  | 'promotion'
  | 'continental'
  | 'youth'
  | 'ucl'
  | 'uel'
  | 'uecl';

/**
 * The semantic mapping from typed trophies to icon families. One place, so a league title can
 * never quietly render as a cup somewhere.
 */
export function trophyIconKind(trophyId: string): TrophyIconKind {
  switch (trophyId) {
    case 'championship':
    case 'foreign_championship':
      return 'plate';
    case 'cup':
    case 'foreign_cup':
    case 'super_cup':
      return 'cup';
    // v0.8: real UEFA trophies carry their own competition marks. The legacy rolled ids keep
    // rendering for pre-v0.8 careers: the old champions_league roll shows the UCL mark it
    // always claimed to be, the generic run keeps the laurel.
    case 'uefa_champions_league':
    case 'champions_league':
      return 'ucl';
    case 'uefa_europa_league':
      return 'uel';
    case 'uefa_conference_league':
      return 'uecl';
    case 'european_run':
      return 'continental';
    case 'youth_championship':
      return 'youth';
    case 'youth_cup':
      return 'cup';
    default:
      return 'plate';
  }
}

export function TrophyKindIcon({ kind, size, className }: IconProps & { kind: TrophyIconKind }): JSX.Element {
  switch (kind) {
    case 'plate':
      return <ChampionshipPlateIcon size={size} className={className} />;
    case 'cup':
      return <CupIcon size={size} className={className} />;
    case 'promotion':
      return <PromotionBadgeIcon size={size} className={className} />;
    case 'continental':
      return <ContinentalIcon size={size} className={className} />;
    case 'youth':
      return <YouthPennantIcon size={size} className={className} />;
    case 'ucl':
      return <ChampionsLeagueMark size={size} className={className} />;
    case 'uel':
      return <EuropaLeagueMark size={size} className={className} />;
    case 'uecl':
      return <ConferenceLeagueMark size={size} className={className} />;
  }
}

export function HonorIcon({ type, size, className }: IconProps & { type: IndividualHonorType }): JSX.Element {
  switch (type) {
    case 'top_scorer':
      return <GoldenBootIcon size={size} className={className} />;
    case 'assists_leader':
      return <AssistMarkIcon size={size} className={className} />;
    case 'player_of_season':
      return <SeasonStarIcon size={size} className={className} />;
    case 'goalkeeper_of_season':
      return <KeeperGloveIcon size={size} className={className} />;
    case 'young_player_of_season':
      return <RisingStarIcon size={size} className={className} />;
  }
}

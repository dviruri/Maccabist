/**
 * People data (v0.5): fictional name pools and archetype definitions.
 *
 * Every person in the game is original. No real agents, no real managers, no real coaches, no
 * likenesses - the pools below are assembled from common given names and surnames in each
 * modelled football market, combined at random, which is how fictional people in fiction have
 * always been named. Names are Hebrew or Hebrew-transliterated because the whole game is Hebrew.
 *
 * A name is generated ONCE, from the career's seeded rng, and persisted on the person. Nothing
 * ever re-rolls it (Phase 1.1).
 */

import type {
  AgentArchetypeId,
  CoachSpecialtyId,
  ManagerArchetypeId,
  Position,
} from '../types';

/* ------------------------------------------------------------------ */
/* Name pools (Phase 1.2)                                              */
/* ------------------------------------------------------------------ */

interface NamePool {
  first: string[];
  last: string[];
}

/**
 * Keyed by club `country` exactly as the club data spells it, so a Dutch club's manager draws
 * from the Dutch pool by data lookup and never by a UI string (Phase 8.1 discipline applies to
 * names too). Israel's pool is the deepest because most people in this career are Israeli.
 */
const NAME_POOLS: Record<string, NamePool> = {
  'ישראל': {
    first: [
      'אייל', 'יואב', 'עמית', 'דני', 'אבי', 'רונן', 'ערן', 'ניר', 'אלון', 'שי',
      'עופר', 'גיא', 'דורון', 'צחי', 'מוטי', 'יוסי', 'אריק', 'עידו', 'נדב', 'ברק',
    ],
    last: [
      'רז', 'לביא', 'קדם', 'ברקוביץ׳', 'אזולאי', 'פרץ', 'מזרחי', 'שרון', 'גולן', 'אלמוג',
      'בן־חיים', 'אוחיון', 'שגב', 'הראל', 'ביטון', 'נחמיאס', 'רוזן', 'עמר', 'זוהר', 'כספי',
    ],
  },
  'הולנד': {
    first: ['יורי', 'סנדר', 'רובן', 'טימו', 'יאספר', 'מארטן', 'לארס', 'ווטר'],
    last: ['ואן דר ברג', 'דה יונג', 'בקר', 'ורמולן', 'ואן דייק־הוף', 'סמיט', 'קויפרס', 'הנדריקס'],
  },
  'בלגיה': {
    first: ['תיבו', 'מתיאס', 'יונאס', 'סימון', 'ברם', 'לוקאס', 'ניקולא', 'סבסטיאן'],
    last: ['פטרס', 'ורלינדן', 'קלאסן', 'דה מאייר', 'ואן דן בוש', 'לומבארד', 'מרטנס', 'דובואה'],
  },
  'אוסטריה': {
    first: ['מרקוס', 'שטפן', 'פלוריאן', 'תומאס', 'לוקאס', 'דויד', 'מנואל', 'פטריק'],
    last: ['גרובר', 'הופמן', 'שטיינר', 'וגנר', 'לייטנר', 'אגר', 'מוזר', 'ברגר'],
  },
  'פורטוגל': {
    first: ['ז׳ואאו', 'טיאגו', 'רוי', 'נונו', 'פדרו', 'ברונו', 'אנדרה', 'דיוגו'],
    last: ['פרייטס', 'מוראיש', 'קרבליו', 'סאנטוש', 'אלמיידה', 'פונסקה', 'טברש', 'קושטה'],
  },
  'יוון': {
    first: ['ניקוס', 'יורגוס', 'דימיטריס', 'קוסטאס', 'ואסיליס', 'סטליוס', 'פאנוס', 'תאנוס'],
    last: ['פפאדופולוס', 'ניקולאידיס', 'קרגיאניס', 'אלכסיו', 'סטמאטיס', 'ולכוס', 'מיכאלידיס', 'זגורקיס'],
  },
  'קפריסין': {
    first: ['אנדראס', 'כריסטוס', 'מריוס', 'סטאבְרוס', 'פמבוס', 'לוקאס', 'מיכאליס', 'סוטיריס'],
    last: ['קונסטנטינו', 'חרלמבוס', 'איואנו', 'ניקולאו', 'פיליפו', 'סטיליאנו', 'אנטוניו', 'קיפריאנו'],
  },
  'גרמניה': {
    first: ['מתיאס', 'שטפן', 'יונאס', 'טוביאס', 'קרסטן', 'אולף', 'מרקו', 'דניאל'],
    last: ['בכמן', 'קלר', 'הרטמן', 'שולצה', 'וינקלר', 'ברנדט', 'קראוס', 'לורנץ'],
  },
  'ספרד': {
    first: ['חאבייר', 'איקר', 'רודריגו', 'אלברו', 'מיגל', 'פאבלו', 'אדוארדו', 'רמון'],
    last: ['הרננדס', 'מורנו', 'ויאלבה', 'קמפוס', 'ארנדה', 'סאנצ׳ס־רואיס', 'איבארה', 'דלגאדו'],
  },
  'איטליה': {
    first: ['מרקו', 'אלסנדרו', 'פאולו', 'לוקה', 'דויד', 'סימונה', 'פדריקו', 'ג׳אני'],
    last: ['ריצי', 'לומברדי', 'מנצ׳יני־רוסו', 'קרבונה', 'גרקו', 'פונטנה', 'מורטי', 'דה לוקה'],
  },
  'אנגליה': {
    first: ['גארי', 'סטיב', 'פול', 'מארק', 'קרייג', 'דין', 'ריצ׳רד', 'אנדי'],
    last: ['ווקר', 'הצ׳ינסון', 'בארנס', 'קרופורד', 'דוהרטי', 'וייטפילד', 'מקאליסטר', 'הולוויי'],
  },
};

/** Israel's pool is the default: agents and personal coaches in this story are mostly Israeli. */
export const DEFAULT_NAME_COUNTRY = 'ישראל';

export function namePoolFor(country: string): NamePool {
  return NAME_POOLS[country] ?? NAME_POOLS[DEFAULT_NAME_COUNTRY]!;
}

/* ------------------------------------------------------------------ */
/* Agent archetypes (Phases 3-4)                                       */
/* ------------------------------------------------------------------ */

/**
 * An agent profile is a handful of modifiers, not a staff sheet (Phase 4). Everything here feeds
 * the EXISTING transfer pipeline as probability shifts - an agent can make an eligible door more
 * likely to open, and can never build a door (Phase 8).
 */
export interface AgentArchetype {
  id: AgentArchetypeId;
  /** Style label for the People screen. */
  label: string;
  /** One-line personality, shown to the player. */
  description: string;
  /**
   * Countries this agent knows, spelled exactly as club data spells them (Phase 8.1). Clubs in
   * these markets get `marketBoost` on their interest weight; everywhere else gets `elseFactor`.
   */
  markets: string[];
  marketBoost: number;
  /** Weight factor outside the known markets. 1 = indifferent, below 1 = poorly connected. */
  elseFactor: number;
  /** Multiplier on the chance an offer arrives at all. */
  offerFrequency: number;
  /** Multiplier on the loan-offer chance - the networker's speciality. */
  loanFactor: number;
  /** Chance to improve an offer's expected role one step, when football makes that plausible. */
  negotiation: number;
  /** How hard the agent pushes moves. Feeds advice tone and relationship friction. */
  aggression: number;
  /** Reputation the player needs before this agent would take him on. */
  reputationThreshold: number;
}

export const AGENT_ARCHETYPES: Record<AgentArchetypeId, AgentArchetype> = {
  family: {
    id: 'family',
    label: 'סוכן משפחתי',
    description: 'סבלני, מגונן, חושב עשר שנים קדימה. הקשר חשוב לו מהעסקה.',
    markets: ['ישראל'],
    marketBoost: 1.25,
    elseFactor: 0.75,
    offerFrequency: 0.9,
    loanFactor: 1.0,
    negotiation: 0.10,
    aggression: 0.2,
    reputationThreshold: 0,
  },
  israel_networker: {
    id: 'israel_networker',
    label: 'איש קשרים ישראלי',
    description: 'מכיר כל יו״ר בליגה. יודע בדיוק איפה יש דקות בשבילך.',
    markets: ['ישראל'],
    marketBoost: 1.6,
    elseFactor: 0.7,
    offerFrequency: 1.1,
    loanFactor: 1.35,
    negotiation: 0.18,
    aggression: 0.45,
    reputationThreshold: 15,
  },
  europe_specialist: {
    id: 'europe_specialist',
    label: 'מומחה אירופה',
    description: 'הרשת שלו יושבת בהולנד, בבלגיה ובאוסטריה. שוק מקומי פחות מעניין אותו.',
    markets: ['הולנד', 'בלגיה', 'אוסטריה'],
    marketBoost: 1.7,
    elseFactor: 0.85,
    offerFrequency: 1.0,
    loanFactor: 0.8,
    negotiation: 0.15,
    aggression: 0.55,
    reputationThreshold: 30,
  },
  dealmaker: {
    id: 'dealmaker',
    label: 'סוכן אגרסיבי',
    description: 'תמיד יש עסקה גדולה יותר. דוחף למעלה, גם כשהתפקיד שם לא מובטח.',
    markets: ['ישראל', 'יוון', 'קפריסין', 'פורטוגל'],
    marketBoost: 1.35,
    elseFactor: 1.0,
    offerFrequency: 1.25,
    loanFactor: 0.9,
    negotiation: 0.22,
    aggression: 0.85,
    reputationThreshold: 25,
  },
  super_agent: {
    id: 'super_agent',
    label: 'סוכן־על',
    description: 'מספר בטלפון של כל מנהל ספורטיבי באירופה. אצלו אתה נכס, לא בן.',
    markets: ['הולנד', 'בלגיה', 'גרמניה', 'ספרד', 'איטליה', 'אנגליה', 'פורטוגל', 'אוסטריה'],
    marketBoost: 1.7,
    elseFactor: 0.9,
    offerFrequency: 1.2,
    loanFactor: 0.7,
    negotiation: 0.30,
    aggression: 0.75,
    reputationThreshold: 62,
  },
};

/* ------------------------------------------------------------------ */
/* Manager archetypes (Phases 13-14)                                   */
/* ------------------------------------------------------------------ */

/**
 * Lightweight modifiers that COMBINE with ability, trust, form and competition - archetype alone
 * never decides selection (Phase 18). Values are multipliers/deltas on existing engine terms.
 */
export interface ManagerArchetype {
  id: ManagerArchetypeId;
  label: string;
  description: string;
  /** Added to the initial-trust baseline for a player under 21. */
  youthTrustDelta: number;
  /** Multiplier on minutes for a player under 21. */
  youthMinutesFactor: number;
  /** How much reputation moves the initial baseline, added to the normal term. */
  reputationBias: number;
  /** Multiplier on positive trust movement. */
  trustGainFactor: number;
  /** Multiplier on negative trust movement. */
  trustLossFactor: number;
  /** Multiplier on the whole squad's minutes volatility - rotation managers spread minutes. */
  rotationFactor: number;
  /** Willingness to sanction a loan for a fringe player. */
  loanWillingness: number;
}

export const MANAGER_ARCHETYPES: Record<ManagerArchetypeId, ManagerArchetype> = {
  youth_believer: {
    id: 'youth_believer',
    label: 'מאמין בצעירים',
    description: 'נותן לשחקן צעיר במה אמיתית, וסבלני לטעויות של גיל.',
    youthTrustDelta: 6,
    youthMinutesFactor: 1.10,
    reputationBias: -0.04,
    trustGainFactor: 1.1,
    trustLossFactor: 0.85,
    rotationFactor: 1.0,
    loanWillingness: 1.1,
  },
  conservative: {
    id: 'conservative',
    label: 'שמרן',
    description: 'אמון אצלו נבנה לאט. מעדיף את מי שכבר הוכיח.',
    youthTrustDelta: -5,
    youthMinutesFactor: 0.94,
    reputationBias: 0.05,
    trustGainFactor: 0.8,
    trustLossFactor: 0.85,
    rotationFactor: 0.9,
    loanWillingness: 1.2,
  },
  disciplinarian: {
    id: 'disciplinarian',
    label: 'טקטיקן קפדן',
    description: 'משמעת ותפקיד לפני הכול. מי שממלא הוראות מקבל את אמונו.',
    youthTrustDelta: 0,
    youthMinutesFactor: 1.0,
    reputationBias: 0,
    trustGainFactor: 1.0,
    trustLossFactor: 1.15,
    rotationFactor: 0.95,
    loanWillingness: 1.0,
  },
  rotation: {
    id: 'rotation',
    label: 'מאמן רוטציה',
    description: 'כולם משחקים אצלו, אף אחד לא בטוח. הזדמנויות יש, יציבות פחות.',
    youthTrustDelta: 3,
    youthMinutesFactor: 1.05,
    reputationBias: -0.02,
    trustGainFactor: 1.0,
    trustLossFactor: 1.0,
    rotationFactor: 1.12,
    loanWillingness: 0.85,
  },
  star_driven: {
    id: 'star_driven',
    label: 'מאמן של כוכבים',
    description: 'שם ומוניטין קונים אצלו דקות. אלמוני צריך לעבוד כפול.',
    youthTrustDelta: -5,
    youthMinutesFactor: 0.95,
    reputationBias: 0.09,
    trustGainFactor: 1.05,
    trustLossFactor: 1.0,
    rotationFactor: 0.9,
    loanWillingness: 1.05,
  },
  short_fuse: {
    id: 'short_fuse',
    label: 'פתיל קצר',
    description: 'מתלהב מהר, מתאכזב מהר יותר. אצלו הכול יכול להשתנות בחודש.',
    youthTrustDelta: 2,
    youthMinutesFactor: 1.0,
    reputationBias: 0,
    trustGainFactor: 1.25,
    trustLossFactor: 1.3,
    rotationFactor: 1.05,
    loanWillingness: 1.15,
  },
};

/* ------------------------------------------------------------------ */
/* Personal coach specialties (Phases 21, 24)                          */
/* ------------------------------------------------------------------ */

export interface CoachSpecialty {
  id: CoachSpecialtyId;
  label: string;
  description: string;
  /** Positions this work is actually for. Empty = every position (Phase 24). */
  positions: Position[];
}

export const COACH_SPECIALTIES: Record<CoachSpecialtyId, CoachSpecialty> = {
  goalkeeping: {
    id: 'goalkeeping',
    label: 'מאמן שוערים',
    description: 'עבודה על יציאות, משחק רגל וקבלת החלטות באחד על אחד.',
    positions: ['GK'],
  },
  technical: {
    id: 'technical',
    label: 'מאמן טכני',
    description: 'נגיעה ראשונה, מסירה תחת לחץ, והרגל אחת חלשה שמפסיקה להיות חלשה.',
    positions: ['CB', 'FB', 'CM', 'WG', 'ST'],
  },
  fitness: {
    id: 'fitness',
    label: 'מאמן כושר',
    description: 'עונה שלמה בלי ליפול. הגוף כבסיס לכל השאר.',
    positions: [],
  },
  mental: {
    id: 'mental',
    label: 'מאמן מנטלי',
    description: 'איך חוזרים מהחמצה, מירידת כושר, מקהל ששרק לך.',
    positions: [],
  },
  finishing: {
    id: 'finishing',
    label: 'מאמן סיומות',
    description: 'עשרים דקות אחרי האימון, כל יום: מצבים בתוך הרחבה.',
    positions: ['ST', 'WG'],
  },
  speed: {
    id: 'speed',
    label: 'מאמן מהירות',
    description: 'צעד ראשון, שינוי כיוון, והמטרים שקונים לך שנייה.',
    positions: ['FB', 'WG', 'ST'],
  },
};

/** The specialties that make football sense for this position (Phase 24). */
export function specialtiesFor(position: Position): CoachSpecialty[] {
  return Object.values(COACH_SPECIALTIES).filter(
    (s) => s.positions.length === 0 || s.positions.includes(position),
  );
}

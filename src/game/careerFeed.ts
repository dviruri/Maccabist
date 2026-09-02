import { UEFA_COMPETITIONS } from '../data/uefa';
import { stageConfig } from '../data/academy';
import { visibleEuropeanCampaign } from './europePresentation';
import { activeFixture } from './fixture';
import { currentTable } from './leagueEngine';
import { isInAcademy } from './rules';
import type { Career } from '../types';

/**
 * The career feed (v0.9.1, Phase 5).
 *
 * v0.9 shipped one sentence per situation, so the coach said the identical line every beat for
 * a whole career. The fix keeps everything that made it trustworthy - deterministic, no rng
 * consumed, every line grounded in live state - and changes only how many ways each true thing
 * can be said.
 *
 * ## How variety works without inventing facts
 *
 * Each speaker resolves a CONTEXT from real state (role, form, table, Europe, offers). The
 * context decides the pool; the pool decides the wording. Two lines in a pool must be
 * interchangeable statements of the same fact - variety is phrasing, never a different claim.
 *
 * ## Deterministic dedupe
 *
 * Selection is a hash of (career seed, season, season point, category, context) - stable for a
 * given beat, different across beats, so the same coach does not repeat one sentence forever.
 * A second hash rotates the pool offset per season, so two consecutive seasons in the same
 * situation phrase it differently. No feed history is persisted; no rng stream is touched.
 */

export type FeedRole = 'agent' | 'coach' | 'scout' | 'club-director' | 'journalist';

export interface FeedItem {
  role: FeedRole;
  roleLabel: string;
  text: string;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
  }
  return h >>> 0;
}

/** Deterministic pick with a per-season rotation, so a repeated context reads differently. */
function pick(pool: readonly string[], career: Career, category: string, context: string): string {
  if (pool.length === 0) return '';
  const beat = hash(career.seed, career.currentSeason, career.seasonPoint, category, context);
  const rotation = hash(career.seed, career.currentSeason, category) % pool.length;
  return pool[(beat + rotation) % pool.length]!;
}

/* ------------------------------------------------------------------ */
/* Coach                                                               */
/* ------------------------------------------------------------------ */

const COACH_POOLS: Record<string, readonly string[]> = {
  icon: [
    'הקבוצה נבנית סביבך.',
    'אתה הציר של הקבוצה הזאת. כולם יודעים את זה.',
    'כשאתה על המגרש, כולם משחקים אחרת.',
  ],
  key: [
    'אתה מהראשונים על הדף.',
    'אני בונה על זה שאתה שם בכל משחק.',
    'אתה כבר לא צריך להוכיח לי כלום.',
  ],
  starter: [
    'אתה פותח בשבת.',
    'המקום שלך בהרכב. תשמור עליו.',
    'אתה בפנים. תעשה את שלך.',
  ],
  rotation_trusted: [
    'תקבל דקות. תהיה מוכן.',
    'אני מסובב את הסגל - התור שלך יגיע השבוע.',
    'אתה בתמונה. תישאר חד.',
  ],
  rotation_cold: [
    'אתה נלחם על מקום. תוכיח באימונים.',
    'אני צריך לראות ממך יותר באימונים.',
    'הדלת פתוחה, אבל אתה צריך לפתוח אותה.',
  ],
  fringe: [
    'אתה צריך להילחם על כל דקה.',
    'קשה לך עכשיו. אני יודע. תמשיך לעבוד.',
    'התפקיד שלך היום הוא לחכות ולהיות מוכן.',
  ],
  hot_form: [
    'תמשיך ככה. אתה בכושר הכי טוב שלך.',
    'מה שאתה עושה עכשיו - תשמור על זה.',
  ],
  cold_form: [
    'ראיתי משחקים טובים יותר ממך. בוא נעבוד.',
    'זו תקופה. כולם עוברים אותה. תרים את הראש.',
  ],
  academy: [
    'תמשיך לעבוד, רואים אותך.',
    'בגיל הזה מודדים התמדה, לא רק כישרון.',
    'אתה בכיוון הנכון. אל תמהר.',
  ],
};

function coachItem(career: Career): FeedItem {
  if (isInAcademy(career)) {
    return {
      role: 'coach',
      roleLabel: 'המאמן',
      text: `המאמן: ${stageConfig(career.academyStage).label} — ${pick(COACH_POOLS.academy!, career, 'coach', 'academy')}`,
    };
  }
  const half = career.firstHalfStats;
  /* Form speaks first when there is real evidence of it, then the standing role. */
  let context: string;
  if (half && half.appearances >= 5 && half.rating >= 68) context = 'hot_form';
  else if (half && half.appearances >= 5 && half.rating <= 56) context = 'cold_form';
  else if (career.role === 'star' || career.role === 'icon') context = 'icon';
  else if (career.role === 'key') context = 'key';
  else if (career.role === 'starter') context = 'starter';
  else if (career.role === 'rotation') context = career.coachTrust >= 55 ? 'rotation_trusted' : 'rotation_cold';
  else context = 'fringe';
  return {
    role: 'coach',
    roleLabel: 'המאמן',
    text: `המאמן: ${pick(COACH_POOLS[context]!, career, 'coach', context)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

const AGENT_POOLS: Record<string, readonly string[]> = {
  foreign: [
    'יש עניין ממועדון ב{country}.',
    'שאלו עליך מ{country}. שיחה רצינית.',
    'הטלפון מצלצל מ{country}.',
  ],
  many: [
    '{count} הצעות על השולחן. צריך לדבר.',
    'יש {count} מועדונים באוויר. בוא נשב.',
  ],
  single: ['יש הצעה על השולחן. צריך לדבר.', 'הצעה אחת, אבל היא רצינית.'],
  quiet_strong: [
    'שקט עכשיו, אבל עוקבים אחריך.',
    'אין הצעות על השולחן. זה לא אומר שלא מדברים.',
  ],
};

function agentItem(career: Career): FeedItem | null {
  const offers = career.pendingOffers;
  if (offers.length === 0) {
    if (career.reputation < 55) return null;
    return {
      role: 'agent',
      roleLabel: 'הסוכן',
      text: pick(AGENT_POOLS.quiet_strong!, career, 'agent', 'quiet'),
    };
  }
  const foreign = offers.find((offer) => offer.country && offer.country !== 'ישראל');
  if (foreign) {
    return {
      role: 'agent',
      roleLabel: 'הסוכן',
      text: pick(AGENT_POOLS.foreign!, career, 'agent', foreign.country).replace('{country}', foreign.country),
    };
  }
  if (offers.length > 1) {
    return {
      role: 'agent',
      roleLabel: 'הסוכן',
      text: pick(AGENT_POOLS.many!, career, 'agent', 'many').replace('{count}', String(offers.length)),
    };
  }
  return { role: 'agent', roleLabel: 'הסוכן', text: pick(AGENT_POOLS.single!, career, 'agent', 'single') };
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

const MEDIA_POOLS: Record<string, readonly string[]> = {
  keeper_clean: [
    '{n} שערים נקיים בסיבוב הראשון. השוער הצעיר מושך עניין.',
    'שוב שער נקי. מדברים על השוער של {club}.',
  ],
  scorer: ['{n} שערים כבר העונה. מדברים עליך.', '{n} שערים. הליגה שמה לב.'],
  strong: ['אחרי עוד תצוגה חזקה, השם שלך עולה.', 'עוד משחק טוב. הביקורות מחמיאות.'],
  poor: ['תקופה חלשה. הפרשנים שואלים שאלות.', 'הביקורת לא מפנקת אותך בימים אלה.'],
};

function mediaItem(career: Career): FeedItem | null {
  const half = career.firstHalfStats;
  if (!half || half.appearances < 5) return null;
  const club = activeFixture(career)?.playerClubName ?? '';
  if (career.position === 'GK' && half.cleanSheets >= 3) {
    return {
      role: 'journalist',
      roleLabel: 'התקשורת',
      text: `התקשורת: ${pick(MEDIA_POOLS.keeper_clean!, career, 'media', 'keeper')
        .replace('{n}', String(half.cleanSheets))
        .replace('{club}', club)}`,
    };
  }
  if (half.goals >= 5) {
    return {
      role: 'journalist',
      roleLabel: 'התקשורת',
      text: `התקשורת: ${pick(MEDIA_POOLS.scorer!, career, 'media', 'scorer').replace('{n}', String(half.goals))}`,
    };
  }
  if (half.rating >= 66) {
    return { role: 'journalist', roleLabel: 'התקשורת', text: `התקשורת: ${pick(MEDIA_POOLS.strong!, career, 'media', 'strong')}` };
  }
  if (half.rating <= 54) {
    return { role: 'journalist', roleLabel: 'התקשורת', text: `התקשורת: ${pick(MEDIA_POOLS.poor!, career, 'media', 'poor')}` };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Club                                                                */
/* ------------------------------------------------------------------ */

const CLUB_POOLS: Record<string, readonly string[]> = {
  europe_lp: ['עונה אירופית ב{comp}.', 'אנחנו ב{comp}. לילות גדולים מחכים.'],
  europe_out: ['הקיץ האירופי נגמר מוקדם. הליגה היא הכול עכשיו.', 'אירופה נסגרה השנה. נתמקד בליגה.'],
  title_race: ['אנחנו במקום {pos}. המרוץ פתוח.', 'מקום {pos} בטבלה - כל נקודה נחשבת.'],
  relegation: ['מקום {pos}. צריך נקודות, מהר.', 'המצב בטבלה לא טוב. מקום {pos}.'],
  mid: ['מקום {pos} בטבלה.', 'אנחנו במקום {pos}. יש לאן לעלות.'],
};

function clubItem(career: Career): FeedItem | null {
  /* The visible campaign: this line names a competition to the player (v0.9.6.1). */
  const europe = visibleEuropeanCampaign(career, career.currentClubId);
  if (europe) {
    const pool = europe.inLeaguePhase ? CLUB_POOLS.europe_lp! : CLUB_POOLS.europe_out!;
    return {
      role: 'club-director',
      roleLabel: 'המועדון',
      text: `המועדון: ${pick(pool, career, 'club', europe.competition).replace('{comp}', UEFA_COMPETITIONS[europe.competition].name)}`,
    };
  }
  const table = currentTable(career);
  const row = table?.rows.find((r) => r.clubId === career.currentClubId);
  if (!row) return null;
  const size = table!.rows.length;
  const context = row.position <= 3 ? 'title_race' : row.position >= size - 3 ? 'relegation' : 'mid';
  return {
    role: 'club-director',
    roleLabel: 'המועדון',
    text: `המועדון: ${pick(CLUB_POOLS[context]!, career, 'club', context).replace('{pos}', String(row.position))}`,
  };
}

/* ------------------------------------------------------------------ */
/* The feed                                                            */
/* ------------------------------------------------------------------ */

/**
 * The beat's feed: at most four items, deduped by text so two speakers can never say the same
 * sentence, and grounded entirely in live state.
 */
export function deriveCareerFeed(career: Career): FeedItem[] {
  const items: FeedItem[] = [];
  const push = (item: FeedItem | null): void => {
    if (item && item.text && !items.some((existing) => existing.text === item.text)) items.push(item);
  };

  /*
   * Priority order (v0.9.3). The home screen shows only the first two, so the order became a
   * product decision rather than a cosmetic one: the agent's business and the coach's read are
   * what a player acts on, the club's own state is context, and media colour is the last thing
   * that should displace either. `clubItem` moved above `mediaItem` for exactly that reason.
   */
  push(agentItem(career));
  push(coachItem(career));
  push(clubItem(career));
  push(mediaItem(career));

  if (items.length < 4) {
    const milestone = [...career.milestones]
      .reverse()
      .find((m) => m.major && m.season >= career.currentSeason - 1);
    if (milestone) push({ role: 'scout', roleLabel: 'מסביב', text: milestone.text });
  }
  return items.slice(0, 4);
}

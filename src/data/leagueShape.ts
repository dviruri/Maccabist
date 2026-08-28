/**
 * How big each league is, who else is in it, and what the places mean (v0.4.6).
 *
 * The club dataset models the handful of clubs a career actually touches — nine in ליגת העל,
 * one or two in each European league. That is the right amount of *club* to model, but it is not
 * a league table: a player at Union SG cannot be shown a Belgian table with one row in it.
 *
 * So each league declares its real size, its European and relegation places, and enough opponent
 * names to fill the rest of the table. Filler clubs are names and a quality number, nothing else.
 * They never appear in transfers, never sign the player and have no Club record — they exist so
 * that a table looks like a table and a position means something.
 *
 * Club *names* are facts and are used as such. No crest, badge or other club artwork is
 * reproduced anywhere in this project.
 */

export interface LeagueShape {
  /** Clubs in the division. */
  size: number;
  /** How many places qualify for Europe, from the top. 0 where none are modelled. */
  europePlaces: number;
  /** How many places go down, from the bottom. 0 where nothing is modelled below. */
  relegationPlaces: number;
  /** How many places go up, from the top. 0 in a top division. */
  promotionPlaces: number;
  /**
   * Other clubs in this division, strongest first. Quality is on the same 0-100 scale as
   * `Club.quality`, so a filler club sits in the table where its strength says it should.
   */
  others: ReadonlyArray<{ name: string; quality: number }>;
}

const IL_PREMIER: LeagueShape = {
  // Nine modelled clubs plus five more makes a fourteen-club division, which is the real shape.
  size: 14,
  europePlaces: 3,
  relegationPlaces: 2,
  promotionPlaces: 0,
  others: [
    { name: 'הפועל ירושלים', quality: 54 },
    { name: 'מכבי בני ריינה', quality: 46 },
    { name: 'עירוני טבריה', quality: 45 },
    { name: 'הפועל רמת השרון', quality: 47 },
    { name: 'מ.ס אשדוד', quality: 49 },
  ],
};

const IL_LEUMIT: LeagueShape = {
  size: 16,
  europePlaces: 0,
  relegationPlaces: 2,
  promotionPlaces: 2,
  others: [
    { name: 'הפועל עכו', quality: 38 },
    { name: 'מכבי יפו', quality: 35 },
    { name: 'הפועל כפר שלם', quality: 34 },
    { name: 'שמשון תל אביב', quality: 31 },
    { name: 'הפועל בית שאן', quality: 30 },
    { name: 'הפועל רעננה', quality: 33 },
  ],
};

/** A generic European top flight: enough shape to be legible, no pretence of completeness. */
function european(
  size: number,
  europePlaces: number,
  others: ReadonlyArray<{ name: string; quality: number }>,
): LeagueShape {
  return { size, europePlaces, relegationPlaces: 3, promotionPlaces: 0, others };
}

export const LEAGUE_SHAPES: Record<string, LeagueShape> = {
  il_premier: IL_PREMIER,
  il_leumit: IL_LEUMIT,

  be_pro: european(16, 3, [
    { name: 'קלאב ברוז׳', quality: 76 },
    { name: 'אנדרלכט', quality: 73 },
    { name: 'חנט', quality: 70 },
    { name: 'אנטוורפן', quality: 69 },
    { name: 'גנק', quality: 71 },
    { name: 'סטנדרד ליאז׳', quality: 64 },
    { name: 'שארלרואה', quality: 62 },
    { name: 'מכלן', quality: 60 },
  ]),

  nl_eredivisie: european(18, 3, [
    { name: 'איאקס', quality: 82 },
    { name: 'פיינורד', quality: 79 },
    { name: 'איינדהובן', quality: 81 },
    { name: 'טוונטה', quality: 72 },
    { name: 'אוטרכט', quality: 69 },
    { name: 'ויטסה', quality: 66 },
    { name: 'ספרטה רוטרדם', quality: 63 },
    { name: 'חרונינגן', quality: 62 },
  ]),

  at_bundesliga: european(12, 3, [
    { name: 'רד בול זלצבורג', quality: 78 },
    { name: 'ראפיד וינה', quality: 67 },
    { name: 'אוסטריה וינה', quality: 64 },
    { name: 'לאסק לינץ', quality: 66 },
    { name: 'וולפסברגר', quality: 62 },
    { name: 'הרטברג', quality: 58 },
  ]),

  gr_superleague: european(14, 3, [
    { name: 'אולימפיאקוס', quality: 78 },
    { name: 'פנאתינייקוס', quality: 74 },
    { name: 'AEK אתונה', quality: 72 },
    { name: 'אריס סלוניקי', quality: 65 },
    { name: 'אופי כרתים', quality: 60 },
    { name: 'וולוס', quality: 57 },
  ]),

  cy_first: european(12, 2, [
    { name: 'אפואל ניקוסיה', quality: 60 },
    { name: 'אומוניה ניקוסיה', quality: 58 },
    { name: 'אריס לימסול', quality: 55 },
    { name: 'פאפוס', quality: 53 },
    { name: 'אנורתוסיס', quality: 51 },
  ]),

  pt_primeira: european(18, 4, [
    { name: 'פורטו', quality: 84 },
    { name: 'ספורטינג ליסבון', quality: 83 },
    { name: 'בראגה', quality: 76 },
    { name: 'ויטוריה גימאראש', quality: 70 },
    { name: 'בואוויסטה', quality: 65 },
    { name: 'ז׳יל ויסנטה', quality: 63 },
  ]),

  de_bundesliga: european(18, 5, [
    { name: 'באיירן מינכן', quality: 92 },
    { name: 'לייפציג', quality: 84 },
    { name: 'לברקוזן', quality: 85 },
    { name: 'שטוטגרט', quality: 78 },
    { name: 'פרנקפורט', quality: 77 },
    { name: 'פרייבורג', quality: 73 },
    { name: 'הופנהיים', quality: 70 },
    { name: 'אוניון ברלין', quality: 71 },
  ]),

  es_laliga: european(20, 5, [
    { name: 'ריאל מדריד', quality: 94 },
    { name: 'ברצלונה', quality: 92 },
    { name: 'סביליה', quality: 80 },
    { name: 'ריאל סוסיאדד', quality: 79 },
    { name: 'ויאריאל', quality: 78 },
    { name: 'אתלטיק בילבאו', quality: 79 },
    { name: 'ולנסיה', quality: 74 },
    { name: 'ריאל בטיס', quality: 76 },
  ]),

  it_seriea: european(20, 5, [
    { name: 'אינטר', quality: 90 },
    { name: 'מילאן', quality: 87 },
    { name: 'יובנטוס', quality: 87 },
    { name: 'רומא', quality: 82 },
    { name: 'לאציו', quality: 80 },
    { name: 'אטלנטה', quality: 83 },
    { name: 'פיורנטינה', quality: 77 },
    { name: 'טורינו', quality: 72 },
  ]),

  en_premier: european(20, 5, [
    { name: 'מנצ׳סטר סיטי', quality: 95 },
    { name: 'ליברפול', quality: 92 },
    { name: 'ארסנל', quality: 91 },
    { name: 'צ׳לסי', quality: 86 },
    { name: 'מנצ׳סטר יונייטד', quality: 84 },
    { name: 'ניוקאסל', quality: 81 },
    { name: 'אסטון וילה', quality: 82 },
    { name: 'ווסטהאם', quality: 77 },
  ]),

  euro_elite: european(18, 5, [
    { name: 'יריבה אירופית א׳', quality: 88 },
    { name: 'יריבה אירופית ב׳', quality: 85 },
    { name: 'יריבה אירופית ג׳', quality: 82 },
    { name: 'יריבה אירופית ד׳', quality: 79 },
  ]),

  euro_strong: european(18, 4, [
    { name: 'יריבה אירופית א׳', quality: 76 },
    { name: 'יריבה אירופית ב׳', quality: 73 },
    { name: 'יריבה אירופית ג׳', quality: 70 },
    { name: 'יריבה אירופית ד׳', quality: 67 },
  ]),
};

/** Youth football has no league table in this game; the age group is the unit. */
export const UNTABLED_LEAGUES: readonly string[] = ['il_youth'];

export function leagueShape(leagueId: string): LeagueShape | null {
  return LEAGUE_SHAPES[leagueId] ?? null;
}

export function hasTable(leagueId: string): boolean {
  return !UNTABLED_LEAGUES.includes(leagueId) && LEAGUE_SHAPES[leagueId] !== undefined;
}

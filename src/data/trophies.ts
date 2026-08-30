import { TROPHY_WEIGHTS } from '../game/balance';

export interface TrophyDefinition {
  id: string;
  name: string;
  weight: number;
  icon: string;
}

export const TROPHY_DEFS: Record<string, TrophyDefinition> = {
  championship: {
    id: 'championship',
    name: 'אליפות המדינה',
    weight: TROPHY_WEIGHTS.championship,
    icon: '🏆',
  },
  cup: { id: 'cup', name: 'גביע המדינה', weight: TROPHY_WEIGHTS.cup, icon: '🥇' },
  super_cup: { id: 'super_cup', name: 'גביע הטוטו', weight: TROPHY_WEIGHTS.superCup, icon: '🎖️' },
  european_run: {
    id: 'european_run',
    name: 'קמפיין אירופי היסטורי',
    weight: TROPHY_WEIGHTS.europeanRun,
    icon: '🌍',
  },
  foreign_championship: {
    id: 'foreign_championship',
    name: 'אליפות בחו״ל',
    weight: TROPHY_WEIGHTS.foreignChampionship,
    icon: '🏅',
  },
  foreign_cup: {
    id: 'foreign_cup',
    name: 'גביע בחו״ל',
    weight: TROPHY_WEIGHTS.foreignCup,
    icon: '🥈',
  },
  champions_league: {
    id: 'champions_league',
    name: 'ליגת האלופות',
    weight: TROPHY_WEIGHTS.championsLeague,
    icon: '⭐',
  },
  /*
   * v0.8: real UEFA trophies, awarded ONLY by the competition simulation - a club must enter,
   * qualify, survive the knockouts and win the final. The legacy `european_run` and
   * `champions_league` ids above are retired from awarding (they were season-end rolls) but
   * kept so pre-v0.8 careers keep rendering the trophies they were shown winning.
   */
  uefa_champions_league: {
    id: 'uefa_champions_league',
    name: 'ליגת האלופות',
    weight: TROPHY_WEIGHTS.championsLeague,
    icon: '⭐',
  },
  uefa_europa_league: {
    id: 'uefa_europa_league',
    name: 'הליגה האירופית',
    weight: TROPHY_WEIGHTS.europeanRun,
    icon: '🌍',
  },
  uefa_conference_league: {
    id: 'uefa_conference_league',
    name: 'הקונפרנס ליג',
    weight: TROPHY_WEIGHTS.europeanRun * 0.7,
    icon: '🌍',
  },
  youth_championship: { id: 'youth_championship', name: 'אליפות הנוער', weight: 0.15, icon: '🎽' },
  youth_cup: { id: 'youth_cup', name: 'גביע הנוער', weight: 0.1, icon: '🎗️' },
};

export function trophyIcon(id: string): string {
  return TROPHY_DEFS[id]?.icon ?? '🏆';
}

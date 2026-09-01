export const ASSET_BASE = '/assets/maccabist';

export const clubColorMap = {
  'Maccabi Haifa': { outfield: 'green', goalkeeper: 'black' },
  'Maccabi Tel Aviv': { outfield: 'yellow', goalkeeper: 'black' },
  'Beitar Jerusalem': { outfield: 'yellow', goalkeeper: 'black' },
  'Hapoel Beer Sheva': { outfield: 'red', goalkeeper: 'black' },
  'Hapoel Haifa': { outfield: 'red', goalkeeper: 'black' },
  'Israel': { outfield: 'blue', goalkeeper: 'black' },
  'defaultLight': { outfield: 'white', goalkeeper: 'blue' },
  'defaultDark': { outfield: 'black', goalkeeper: 'purple' },
} as const;

export type AgeGroup = 'child' | 'youth' | 'adult';
export type RoleType = 'outfield' | 'goalkeeper';
export type OutfieldPose = 'hero' | 'celebration';
export type GoalkeeperPose = 'ready' | 'celebration';

export function resolvePlayerAsset(params: {
  role: RoleType;
  age: AgeGroup;
  pose: string;
  color: string;
}) {
  return `${ASSET_BASE}/players/${params.role}/${params.age}/${params.pose}/${params.color}.png`;
}

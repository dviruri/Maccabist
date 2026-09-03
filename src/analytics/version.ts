/**
 * The one application version string (v0.9.6.4).
 *
 * Injected by both vite.config.ts and vitest.config.ts from package.json, so the released build
 * and the tests agree and there is no second constant to remember to bump.
 *
 * `typeof` guards the case where neither config is in play - a bare `tsc` or a consumer that does
 * not define it - because an undefined global would otherwise throw at module load, and a version
 * string is not worth crashing the game for.
 */
export const GAME_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : 'unknown';

import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * One version source (v0.9.6.4).
 *
 * Every analytics event carries `game_version`, and the owner needs to compare releases. Reading
 * package.json here means the number is declared once and cannot drift from the released build -
 * the alternative was a constant to remember to bump in a second place.
 *
 * vitest.config.ts defines the same value, so tests see the real version rather than a stub.
 */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * Base path.
 *
 * GitHub Pages serves this project from https://dviruri.github.io/Maccabist/, so the
 * production bundle has to resolve its assets under /Maccabist/. Local dev is served from
 * the domain root, where that prefix would only get in the way.
 *
 * The value is configurable rather than hard-coded so the same build works anywhere:
 *   MACCABIST_BASE=/  npm run build   -> root deploy (e.g. Netlify, a custom domain)
 *   npm run build                     -> /Maccabist/ (the GitHub Pages default)
 *
 * Nothing else in the codebase should mention "/Maccabist/" - components read
 * `import.meta.env.BASE_URL`, and files in /public use paths relative to themselves.
 */
const DEFAULT_PROD_BASE = '/Maccabist/';

function withSlashes(value: string): string {
  const prefixed = value.startsWith('/') ? value : `/${value}`;
  return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

export default defineConfig(({ command, isPreview }) => {
  const override = process.env.MACCABIST_BASE;
  /*
   * `vite preview` reports command 'serve' as well as `vite dev`, so reading `command` alone gave
   * preview the dev base of '/' while the built HTML it serves asks for '/Maccabist/assets/...'.
   * Every asset fell through to the SPA fallback and came back as text/html, so the module never
   * executed and `npm run preview` rendered a blank page. `isPreview` is what distinguishes them.
   */
  const isDevServer = command === 'serve' && !isPreview;
  const base = isDevServer ? '/' : override ? withSlashes(override) : DEFAULT_PROD_BASE;

  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [react()],
    server: {
      port: 5173,
      open: false,
    },
  };
});

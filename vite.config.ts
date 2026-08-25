import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

export default defineConfig(({ command }) => {
  const override = process.env.MACCABIST_BASE;
  const base =
    command === 'serve' ? '/' : override ? withSlashes(override) : DEFAULT_PROD_BASE;

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      open: false,
    },
  };
});

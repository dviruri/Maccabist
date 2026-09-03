import { readFileSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

/* The same single version source vite.config.ts uses, so tests read the real released number. */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// The engine is pure TypeScript, so tests run in plain node with no plugins involved.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

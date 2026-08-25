import { defineConfig } from 'vitest/config';

// The engine is pure TypeScript, so tests run in plain node with no plugins involved.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

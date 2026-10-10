import { defineConfig } from 'vitest/config';

// `npm test`. Vitest does not read a "vitest" key in package.json, so the
// include list lives here; load tests run separately (`npm run test:load`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'eval/**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**', 'load/**'],
  },
});

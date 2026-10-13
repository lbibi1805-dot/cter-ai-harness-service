import { defineConfig } from 'vitest/config';

// Load tests: `npm run test:load`. Kept out of `npm test` (they take ~1 min).
export default defineConfig({
  test: {
    include: ['load/**/*.load.test.ts'],
    testTimeout: 300_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});

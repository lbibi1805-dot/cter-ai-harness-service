import { defineConfig } from 'vitest/config';

// `npm test`: unit + e2e suites under tests/. Load tests run separately (`npm run test:load`).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/e2e/**/*.test.ts'],
    exclude: ['**/dist/**', '**/node_modules/**', 'tests/load/**'],
  },
});

/** First render cold-starts Chromium (and afterAll closes it); under a full parallel run either can exceed vitest defaults. */
export const BROWSER_TEST_TIMEOUT_MS = 60_000;

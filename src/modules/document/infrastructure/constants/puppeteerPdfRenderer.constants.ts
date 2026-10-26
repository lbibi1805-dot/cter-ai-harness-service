import path from 'path';

/** src/modules/document/infrastructure/constants → repo root (same depth under dist/). */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

export const PAGE_VIEWPORT = { width: 900, height: 1200, deviceScaleFactor: 1 } as const;

/** Mermaid + KaTeX must finish in the page before it is printed. */
export const RENDER_TIMEOUT_MS = 30_000;

export const PDF_PAGE_FORMAT = 'A4';

export const TEMP_FILE_PREFIX = 'canvas-helper-';

export const RANDOM_SUFFIX_RADIX = 36;

export const RANDOM_SUFFIX_LENGTH = 6;

export const MERMAID_LOG_PREFIX = 'mermaid-block-';

export const MERMAID_ERROR_MARKER = 'error:';

export const CHROMIUM_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'];

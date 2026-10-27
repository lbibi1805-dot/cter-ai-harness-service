export const PLANTUML_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/** Same server c4-plantuml-mcp-server renders with; a self-hosted plantuml/plantuml-server avoids its rate limits. */
export const DEFAULT_PLANTUML_SERVER_URL = 'https://www.plantuml.com/plantuml';

/** Headers the PlantUML server sets when the source has a syntax error (status 400, error image body). */
export const PLANTUML_ERROR_HEADER = 'x-plantuml-diagram-error';

export const PLANTUML_ERROR_LINE_HEADER = 'x-plantuml-diagram-error-line';

/** The public server answers in 1-5 s; 30 s covers its slow moments (the C4 include is fetched from GitHub). */
export const PLANTUML_TIMEOUT_MS = 30_000;

/** render-diagram.py of the c4-diagrams skill retries 3 times (1 s, 2 s, 4 s). */
export const PLANTUML_MAX_ATTEMPTS = 3;

export const PLANTUML_BACKOFF = { baseDelayMs: 1_000, maxDelayMs: 4_000, factor: 2 } as const;

export const PNG_PATH = '/png/';

export const TRAILING_SLASHES = /\/+$/;

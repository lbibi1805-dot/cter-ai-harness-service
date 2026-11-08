/** Any site may fetch the API description (Swagger UI hosted elsewhere). */
export const PUBLIC_CORS = { 'Access-Control-Allow-Origin': '*' };

export const CRON_BODY_LIMIT_BYTES = 1024;

/** `/ping` answers plain text. */
export const PLAIN_TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
export const STORAGE_NOT_CONFIGURED = 'object storage not configured';
export const LATENCY_NOT_AVAILABLE = 'latency metrics not available';

export const PROMPT_REGISTRY_NOT_AVAILABLE = 'prompt registry not enabled (system-prompt.md fallback)';

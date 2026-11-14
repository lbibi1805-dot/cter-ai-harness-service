import { errorMessage } from '../../../shared/errors';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import {
  SendStatus,
  STARLINGUIDE_SECRET_HEADER,
  STARLINGUIDE_UPLOAD_PATH,
  type PartnerFile,
  type PartnerResult,
} from '../domain';
import type { StarlinguidePartnerClient, StarlinguideSendResult } from '../application/interfaces/starlinguideForwarder.interface';

const RETRY_AFTER_HEADER = 'retry-after';
const SERVER_ERROR_MIN = 500;
const DETAIL_MAX_CHARS = 200;
const TIMEOUT_ERROR_NAMES = new Set(['TimeoutError', 'AbortError']);

export interface StarlinguideHttpClientOptions {
  /** e.g. `https://api.solve.vn/starlinguide-uat` (no trailing slash). */
  baseUrl: string;
  secret: string;
  timeoutMs: number;
  /** Test hook. */
  fetchImpl?: typeof fetch;
}

/** Retry-After header (seconds) or the body's `retry_after_seconds`. */
function retryAfterSeconds(headers: Headers, body: unknown): number | undefined {
  const header = Number(headers.get(RETRY_AFTER_HEADER));
  if (Number.isFinite(header) && header > 0) return header;
  const field = Number((body as { retry_after_seconds?: unknown } | null)?.retry_after_seconds);
  return Number.isFinite(field) && field > 0 ? field : undefined;
}

function statusOf(httpStatus: number): SendStatus {
  if (httpStatus === HttpStatus.UNAUTHORIZED) return SendStatus.UNAUTHORIZED;
  if (httpStatus === HttpStatus.TOO_MANY_REQUESTS) return SendStatus.RATE_LIMITED;
  if (httpStatus === HttpStatus.PAYLOAD_TOO_LARGE) return SendStatus.TOO_LARGE;
  if (httpStatus >= SERVER_ERROR_MIN) return SendStatus.SERVER;
  return SendStatus.BAD_REQUEST;
}

/**
 * Starlinguide Partner API client: `POST {baseUrl}/partner/context-files`, multipart with repeated
 * `email` and `file` fields, header `X-Partner-Secret`. Server-to-server only; the secret never leaves here.
 */
export class StarlinguideHttpClient implements StarlinguidePartnerClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: StarlinguideHttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(emails: readonly string[], files: readonly PartnerFile[]): Promise<StarlinguideSendResult> {
    const form = new FormData();
    for (const email of emails) form.append('email', email);
    for (const file of files) form.append('file', new Blob([Uint8Array.from(file.body)], { type: file.mimeType }), file.fileName);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.options.baseUrl}${STARLINGUIDE_UPLOAD_PATH}`, {
        method: 'POST',
        headers: { [STARLINGUIDE_SECRET_HEADER]: this.options.secret },
        body: form,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? '';
      return TIMEOUT_ERROR_NAMES.has(name)
        ? { status: SendStatus.TIMEOUT, detail: `no answer in ${this.options.timeoutMs} ms` }
        : { status: SendStatus.NETWORK, detail: errorMessage(err).slice(0, DETAIL_MAX_CHARS) };
    }

    let text = '';
    try {
      text = await response.text();
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? '';
      if (TIMEOUT_ERROR_NAMES.has(name)) return { status: SendStatus.TIMEOUT, detail: `body not read in ${this.options.timeoutMs} ms` };
    }
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (response.ok) {
      const results = (body as { results?: unknown } | null)?.results;
      if (!Array.isArray(results)) return { status: SendStatus.SERVER, detail: `HTTP ${response.status} without results[]` };
      return { status: SendStatus.OK, results: results as PartnerResult[] };
    }
    const status = statusOf(response.status);
    return {
      status,
      detail: `HTTP ${response.status} ${text.slice(0, DETAIL_MAX_CHARS)}`.trim(),
      ...(status === SendStatus.RATE_LIMITED ? { retryAfterSeconds: retryAfterSeconds(response.headers, body) } : {}),
    };
  }
}

import { ServiceDisabledError, ValidationError } from '../../../shared/errors';
import { readJsonBody, readRawBody } from '../../../shared/http/body';
import { HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendError, sendJson } from '../../../shared/http/response';
import type { CaptureService } from '../application/capture.service';
import { CAPTURE_DEFAULT_LIST_LIMIT, CAPTURE_JSON_BODY_LIMIT, CAPTURE_MAX_LIST_LIMIT, CAPTURE_PRIVATE_CACHE } from './constants/capture.constants';
import { CaptureApiPath } from './enums/capture.enums';
import { hasCaptureAccess, presentedKey } from './helpers/captureAuth.helper';
import type { CaptureKeys } from './interfaces/captureKeys.interface';

/** `since`: ISO date or epoch ms. */
function parseSince(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const value = /^\d+$/.test(raw.trim()) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(value)) throw new ValidationError('since must be an ISO date or epoch milliseconds (use the cursor of the last response)');
  return value;
}

/** `folder/index` or `folder/index/name` from the wildcard part of the path. */
function splitPath(path: string, parts: number): string[] {
  const segments = path.split('/');
  if (segments.length !== parts || segments.some((s) => !s)) throw new ValidationError(`expected ${parts === 2 ? '{folder}/{index}' : '{folder}/{index}/{name}'} in the path`);
  return segments;
}

/**
 * `/api/captures*` (the phone UI is the separate `cter-capture-client` web app; planning-13112026-photo-capture/04).
 * Upload routes are public (no key). Read and delete routes need CAPTURE_API_KEY or ADMIN_TOKEN (fail-closed).
 * Without CAPTURE_API_KEY the whole module is disabled (503), uploads included.
 */
export class CaptureController {
  constructor(
    private readonly captures: CaptureService | null,
    private readonly keys: CaptureKeys,
    private readonly maxImageBytes: number,
  ) {}

  /** `GET /api/captures?folder=&since=&limit=` */
  list = async (ctx: RouteContext): Promise<void> => {
    const service = this.authorize(ctx);
    if (!service) return;
    const { query, res } = ctx;
    const limit = Math.min(Math.max(parseInt(query.limit ?? '', 10) || CAPTURE_DEFAULT_LIST_LIMIT, 1), CAPTURE_MAX_LIST_LIMIT);
    sendJson(res, HttpStatus.OK, await service.list({
      ...(query.folder?.trim() ? { folder: query.folder } : {}),
      ...(parseSince(query.since) !== undefined ? { since: parseSince(query.since) } : {}),
      limit,
    }));
  };

  folders = async (ctx: RouteContext): Promise<void> => {
    const service = this.authorize(ctx);
    if (!service) return;
    sendJson(ctx.res, HttpStatus.OK, { folders: await service.folders() });
  };

  /** `POST /api/captures/batches` `{ "folder": "bach" }` → 201 batch. */
  createBatch = async (ctx: RouteContext): Promise<void> => {
    const service = this.enabled();
    const body = await readJsonBody(ctx.req, CAPTURE_JSON_BODY_LIMIT);
    const folder = body && typeof body === 'object' ? (body as Record<string, unknown>).folder : undefined;
    sendJson(ctx.res, HttpStatus.CREATED, await service.createBatch(folder));
  };

  /** `POST /api/captures/batches/{folder}/{index}/images` with a raw image body → 201 image. */
  addImage = async (ctx: RouteContext): Promise<void> => {
    const service = this.enabled();
    const [folder, index] = splitPath(ctx.params.path, 2);
    const body = await readRawBody(ctx.req, this.maxImageBytes);
    if (body.length === 0) throw new ValidationError('empty body: send the image bytes (Content-Type: image/jpeg)');
    sendJson(ctx.res, HttpStatus.CREATED, await service.addImage(folder, index, body));
  };

  /** `GET /api/captures/batches/{folder}/{index}` */
  getBatch = async (ctx: RouteContext): Promise<void> => {
    const service = this.authorize(ctx);
    if (!service) return;
    const [folder, index] = splitPath(ctx.params.path, 2);
    sendJson(ctx.res, HttpStatus.OK, await service.batch(folder, index));
  };

  /** `DELETE /api/captures/batches/{folder}/{index}` → `{ deleted }`. */
  deleteBatch = async (ctx: RouteContext): Promise<void> => {
    const service = this.authorize(ctx);
    if (!service) return;
    const [folder, index] = splitPath(ctx.params.path, 2);
    sendJson(ctx.res, HttpStatus.OK, { ok: true, deleted: await service.deleteBatch(folder, index) });
  };

  /** `GET /api/captures/files/{folder}/{index}/{name}` → image bytes (proxy; `?key=` works for `<img src>`). */
  file = async (ctx: RouteContext): Promise<void> => {
    const service = this.authorize(ctx);
    if (!service) return;
    const [folder, index, name] = splitPath(ctx.params.path, 3);
    const { body, mimeType } = await service.readImage(folder, index, name);
    ctx.res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: mimeType, [HttpHeader.CACHE_CONTROL]: CAPTURE_PRIVATE_CACHE });
    ctx.res.end(body);
  };

  /** The service, or 503 when CAPTURE_API_KEY is not set (public upload routes only need this). */
  private enabled(): CaptureService {
    if (!this.captures) throw new ServiceDisabledError('Capture API disabled: set CAPTURE_API_KEY on the server');
    return this.captures;
  }

  /** The service when the read key is right; otherwise answers 401/503 and returns null. */
  private authorize({ req, res, query }: RouteContext): CaptureService | null {
    const service = this.enabled();
    if (!hasCaptureAccess(this.keys, presentedKey(req, query))) {
      sendError(res, HttpStatus.UNAUTHORIZED, `Unauthorized: send the capture key in X-Capture-Key (or ?key=) — ${CaptureApiPath.LIST}`);
      return null;
    }
    return service;
  }
}

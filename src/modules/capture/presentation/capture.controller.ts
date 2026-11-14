import { ServiceDisabledError, ValidationError } from '../../../shared/errors';
import { readJsonBody, readRawBody } from '../../../shared/http/body';
import { HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendError, sendJson } from '../../../shared/http/response';
import type { CaptureService } from '../application/capture.service';
import { normalizeFolder, parseBatchIndex } from '../domain';
import { CAPTURE_DEFAULT_LIST_LIMIT, CAPTURE_JSON_BODY_LIMIT, CAPTURE_MAX_LIST_LIMIT, CAPTURE_PRIVATE_CACHE } from './constants/capture.constants';
import { CaptureApiPath } from './enums/capture.enums';
import { hasCaptureAccess, hasImageDeleteToken, imageDeleteToken, presentedDeleteToken, presentedKey } from './helpers/captureAuth.helper';
import type { CaptureKeys } from './interfaces/captureKeys.interface';

/** `since`: ISO date or epoch ms. */
function parseSince(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const value = /^\d+$/.test(raw.trim()) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(value)) throw new ValidationError('since must be an ISO date or epoch milliseconds (use the cursor of the last response)');
  return value;
}

const PATH_SHAPES: Record<number, string> = { 2: '{folder}/{index}', 3: '{folder}/{index}/{name}', 4: '{folder}/{index}/images/{name}' };

/** `folder/index`, `folder/index/name` or `folder/index/images/name` from the wildcard part of the path. */
function splitPath(path: string, parts: number): string[] {
  const segments = path.split('/');
  if (segments.length !== parts || segments.some((s) => !s)) throw new ValidationError(`expected ${PATH_SHAPES[parts]} in the path`);
  return segments;
}

/** Id an image delete token is bound to: normalized `folder/index/name`. */
const imageId = (folder: string, index: string, name: string) => `${normalizeFolder(folder)}/${parseBatchIndex(index)}/${name}`;

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

  /**
   * `POST /api/captures/batches/{folder}/{index}/images` with a raw image body → 201 image + `deleteToken`
   * (lets the uploader, who holds no key, delete this one image again).
   */
  addImage = async (ctx: RouteContext): Promise<void> => {
    const service = this.enabled();
    const [folder, index] = splitPath(ctx.params.path, 2);
    const body = await readRawBody(ctx.req, this.maxImageBytes);
    if (body.length === 0) throw new ValidationError('empty body: send the image bytes (Content-Type: image/jpeg)');
    const image = await service.addImage(folder, index, body);
    // enabled() guarantees apiKey is set.
    sendJson(ctx.res, HttpStatus.CREATED, { ...image, deleteToken: imageDeleteToken(this.keys.apiKey!, imageId(folder, index, image.name)) });
  };

  /**
   * `DELETE /api/captures/batches/{folder}/{index}/images/{name}` → `{ ok: true }`.
   * Allowed with the read key, or with that image's `deleteToken` (`X-Delete-Token` header or `?token=`).
   */
  deleteImage = async (ctx: RouteContext): Promise<void> => {
    const service = this.enabled();
    const [folder, index, segment, name] = splitPath(ctx.params.path, 4);
    if (segment !== CaptureApiPath.IMAGES_SEGMENT) throw new ValidationError(`expected ${PATH_SHAPES[4]} in the path`);
    const allowed = hasCaptureAccess(this.keys, presentedKey(ctx.req, ctx.query))
      || hasImageDeleteToken(this.keys.apiKey, imageId(folder, index, name), presentedDeleteToken(ctx.req, ctx.query));
    if (!allowed) {
      sendError(ctx.res, HttpStatus.FORBIDDEN, 'Forbidden: send the deleteToken returned by the upload in X-Delete-Token (or the capture key)');
      return;
    }
    await service.deleteImage(folder, index, name);
    sendJson(ctx.res, HttpStatus.OK, { ok: true });
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

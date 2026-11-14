import { ServiceDisabledError, ValidationError } from '../../../shared/errors';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendError, sendJson } from '../../../shared/http/response';
import { hasCaptureAccess, presentedKey, type CaptureKeys, type CaptureService } from '../../capture';
import type { StarlinguideForwarder } from '../application/starlinguideForwarder.service';
import { StarlinguideApiPath } from './enums/starlinguide.enums';

/**
 * `GET /api/captures/starlinguide/status` and `POST /api/captures/batches/{folder}/{index}/starlinguide`
 * (planning-15112026-starlinguide-push). Both need CAPTURE_API_KEY or ADMIN_TOKEN; there is no public route.
 */
export class StarlinguideController {
  constructor(
    private readonly forwarder: StarlinguideForwarder | null,
    private readonly captures: CaptureService | null,
    private readonly keys: CaptureKeys,
  ) {}

  status = async (ctx: RouteContext): Promise<void> => {
    if (!this.authorized(ctx)) return;
    sendJson(ctx.res, HttpStatus.OK, this.forwarder ? this.forwarder.status() : { enabled: false });
  };

  /** Puts every photo of one batch in the queue again (after a restart lost the queue, or the user cleaned the library). */
  repush = async (ctx: RouteContext): Promise<void> => {
    if (!this.authorized(ctx)) return;
    if (!this.forwarder || !this.captures) throw new ServiceDisabledError('Starlinguide push disabled: set STARLINGUIDE_API_BASE_URL (and CAPTURE_API_KEY)');
    const segments = ctx.params.path.split('/');
    if (segments.length !== 2 || segments.some((s) => !s)) throw new ValidationError(`expected ${StarlinguideApiPath.BATCH_PREFIX}{folder}/{index}${StarlinguideApiPath.REPUSH_SUFFIX}`);
    const batch = await this.captures.batch(segments[0], segments[1]);
    const outcome = this.forwarder.enqueue(batch.images.map((image) => ({
      folder: batch.folder, index: batch.index, seq: image.seq, name: image.name, mimeType: image.mimeType, bytes: image.bytes,
    })));
    sendJson(ctx.res, HttpStatus.ACCEPTED, { ok: true, batch: batch.id, ...outcome });
  };

  /** Fail-closed: answers 401 itself and returns false. */
  private authorized({ req, res, query }: RouteContext): boolean {
    if (hasCaptureAccess(this.keys, presentedKey(req, query))) return true;
    sendError(res, HttpStatus.UNAUTHORIZED, 'Unauthorized: send the capture key in X-Capture-Key (or ADMIN_TOKEN as Bearer)');
    return false;
  }
}

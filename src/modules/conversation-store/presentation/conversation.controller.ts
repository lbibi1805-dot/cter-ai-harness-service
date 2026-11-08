import { HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import { isAuthorized } from '../../../shared/http/auth';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendError, sendJson } from '../../../shared/http/response';
import { ServiceDisabledError } from '../../../shared/errors';
import type { ConversationService } from '../application/conversation.service';
import { ARTIFACTS_SEGMENT } from './enums/conversation.enums';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

/** `/api/conversations*` — CHAT_API_TOKEN or ADMIN_TOKEN (monitoring UI) for everything; `?hard=true` needs ADMIN_TOKEN. */
export class ConversationController {
  constructor(
    private readonly conversations: ConversationService | null,
    private readonly chatApiToken: string | undefined,
    private readonly adminToken: string | undefined,
  ) {}

  list = async ({ res, query }: RouteContext): Promise<void> => {
    const limit = Math.min(parseInt(query.limit ?? '', 10) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    sendJson(res, HttpStatus.OK, { conversations: await this.service().list(limit, query.deleted === 'true', query.pending || undefined) });
  };

  /** `GET /api/conversations/:id` or `GET /api/conversations/:id/artifacts/:artifactId` (raw bytes). */
  get = async ({ res, params }: RouteContext): Promise<void> => {
    const [id, artifactId] = params.path.split(ARTIFACTS_SEGMENT);
    if (artifactId) {
      const { body, mime } = await this.service().readArtifact(id, artifactId);
      res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: mime, [HttpHeader.CACHE_CONTROL]: 'private, max-age=600' });
      res.end(body);
      return;
    }
    sendJson(res, HttpStatus.OK, await this.service().get(id));
  };

  /**
   * Soft delete (204, idempotent) with the chat or admin token; `?hard=true` purges now and needs
   * `Bearer <ADMIN_TOKEN>` instead (this route checks its own auth for that reason).
   */
  delete = async ({ req, res, params, query }: RouteContext): Promise<void> => {
    const hard = query.hard === 'true';
    const tokens = hard ? [this.adminToken] : [this.chatApiToken, this.adminToken];
    if (!tokens.some(Boolean) || !isAuthorized(req, tokens)) return sendError(res, HttpStatus.UNAUTHORIZED, hard ? 'hard delete needs ADMIN_TOKEN' : 'Unauthorized');
    if (hard) await this.service().hardDelete(params.path);
    else await this.service().softDelete(params.path);
    res.writeHead(HttpStatus.NO_CONTENT);
    res.end();
  };

  restore = async ({ res, params }: RouteContext): Promise<void> => {
    await this.service().restore(params.path);
    sendJson(res, HttpStatus.OK, { ok: true, id: params.path });
  };

  private service(): ConversationService {
    if (!this.conversations) throw new ServiceDisabledError('Conversation store disabled: set CONVERSATION_STORE_ENABLED=true');
    return this.conversations;
  }
}

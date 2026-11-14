import { HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import { isAuthorized } from '../../../shared/http/auth';
import { readJsonBody } from '../../../shared/http/body';
import type { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { sendError, sendJson } from '../../../shared/http/response';
import { ServiceDisabledError, ValidationError } from '../../../shared/errors';
import type { ConversationService } from '../application/conversation.service';
import { CONVERSATION_LIST_DEFAULT_LIMIT, INVALID_TITLE_ERROR } from '../application/constants/conversationService.constants';
import { ARTIFACTS_SEGMENT, MAX_RENAME_BODY_BYTES } from './enums/conversation.enums';

/** `/api/conversations*` — CHAT_API_TOKEN or ADMIN_TOKEN (monitoring UI) for everything; `?hard=true` needs ADMIN_TOKEN. */
export class ConversationController {
  constructor(
    private readonly conversations: ConversationService | null,
    private readonly chatApiToken: string | undefined,
    private readonly adminToken: string | undefined,
  ) {}

  /** `?limit=&cursor=&deleted=&pending=` → `{conversations, nextCursor}` (keyset, newest first). */
  list = async ({ res, query }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, await this.service().listPage({
      limit: parseInt(query.limit ?? '', 10) || CONVERSATION_LIST_DEFAULT_LIMIT,
      deleted: query.deleted === 'true',
      pending: query.pending || undefined,
      cursor: query.cursor || undefined,
    }));
  };

  /**
   * `GET /api/conversations/:id[?messages=N]` or `GET /api/conversations/:id/artifacts/:artifactId` (raw bytes).
   * Without `messages` the newest 500 messages are returned (old clients).
   */
  get = async ({ res, params, query }: RouteContext): Promise<void> => {
    const [id, artifactId] = params.path.split(ARTIFACTS_SEGMENT);
    if (artifactId) {
      const { body, mime } = await this.service().readArtifact(id, artifactId);
      res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: mime, [HttpHeader.CACHE_CONTROL]: 'private, max-age=600' });
      res.end(body);
      return;
    }
    sendJson(res, HttpStatus.OK, await this.service().get(id, optionalInt(query.messages, 'messages')));
  };

  /** `GET /api/conversations/:id/messages?beforeSeq=&limit=40` → older messages + their artifacts. */
  messages = async ({ res, params, query }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, await this.service().messages(params.path, optionalInt(query.beforeSeq, 'beforeSeq'), optionalInt(query.limit, 'limit')));
  };

  /** `PATCH /api/conversations/:id` `{title: string | null}` → `{id, title, titleSource}`; never moves it in the list. */
  rename = async ({ req, res, params }: RouteContext): Promise<void> => {
    const body = await readJsonBody(req, MAX_RENAME_BODY_BYTES);
    if (!body || typeof body !== 'object' || Array.isArray(body) || !('title' in body)) throw new ValidationError(INVALID_TITLE_ERROR);
    sendJson(res, HttpStatus.OK, await this.service().rename(params.path, (body as { title: unknown }).title));
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

/** Absent/empty → undefined; anything but an integer → 400. Range checks belong to the service. */
function optionalInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  if (!/^-?\d+$/.test(value)) throw new ValidationError(`${name} must be an integer`);
  return Number(value);
}

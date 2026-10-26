// Canvas Conversations API client — backend mirror of `extension/lib/canvasApi.js`.
// Auth uses the same account token as the file flow.
import { ensureOk, linkUrl, bearerHeaders } from '../../../shared/canvas/canvasHttp';
import { ContentType, HttpHeader, HttpMethod } from '../../../shared/http/enums/http.enums';
import { logger } from '../../../shared/logging/logger';
import type { ConversationGateway, SettingsConversationRef } from '../domain/interfaces/canvasConversation.port';
import { REPLY_VERIFY_PREFIX_CHARS, SETTINGS_DISCOVERY_PAGE_SIZE } from '../domain/constants/conversation.constants';
import { readSettingsFromMessages } from '../domain/pendingRequests';
import { CANVAS_API_PREFIX } from '../../../shared/canvas/constants/canvasHttp.constants';
import { ConversationSettings } from '../domain/interfaces/pendingRequests.interface';
import { CanvasRequestError } from '../../../shared/canvas/errors/canvasHttp.errors';
import { RawMessage, RawConversation } from './interfaces/canvasConversationClient.interface';
import { ConversationMessage } from '../domain/interfaces/conversationMessage.interface';
import { toConversationMessage } from './helpers/canvasConversationClient.helper';

export class ConversationClient implements ConversationGateway {
  private readonly apiBase: string;

  constructor(baseUrl: string, private readonly apiKey: string) {
    this.apiBase = `${baseUrl}${CANVAS_API_PREFIX}`;
  }

  /** Current Canvas user id — required to scope settings-conversation discovery. */
  async getSelfUserId(): Promise<number> {
    const response = ensureOk(await this.get(`${this.apiBase}/users/self`), 'self user fetch');
    return ((await response.json()) as { id: number }).id;
  }

  /** Canvas returns newest-first; this returns oldest-first. */
  async listMessages(conversationId: number): Promise<ConversationMessage[]> {
    const response = ensureOk(await this.get(`${this.apiBase}/conversations/${conversationId}?interleave_submissions=0`), 'conversation fetch');
    const data = (await response.json()) as { messages?: RawMessage[] };
    return [...(data.messages ?? [])].reverse().map(toConversationMessage);
  }

  /**
   * Mirrors `listSelfConversationsBySubjectMarker` in the extension: scoped by
   * `filter=user_<selfId>`, paginated via `Link: rel="next"`, newest first.
   */
  async listSettingsConversations(marker: string): Promise<SettingsConversationRef[]> {
    const selfId = await this.getSelfUserId();
    const params = new URLSearchParams({ scope: 'sent', filter: `user_${selfId}`, per_page: String(SETTINGS_DISCOVERY_PAGE_SIZE) });
    const matches: (SettingsConversationRef & { updatedAt: string })[] = [];
    let url: string | null = `${this.apiBase}/conversations?${params}`;
    while (url) {
      const response = ensureOk(await this.get(url, { [HttpHeader.ACCEPT]: ContentType.JSON }), 'conversations list');
      const page = (await response.json()) as RawConversation[];
      for (const conversation of Array.isArray(page) ? page : []) {
        if (!(conversation.subject ?? '').includes(marker)) continue;
        matches.push({ id: conversation.id, subject: conversation.subject ?? '', updatedAt: conversation.updated_at ?? conversation.last_message_at ?? '' });
      }
      url = linkUrl(response.headers.get(HttpHeader.LINK));
    }
    return matches
      .sort((a, b) => (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0))
      .map(({ id, subject }) => ({ id, subject }));
  }

  async readSettings(settingsConversationId: number): Promise<ConversationSettings> {
    return readSettingsFromMessages(await this.listMessages(settingsConversationId));
  }

  /**
   * Form-urlencoded on purpose (Canvas silently drops a JSON body), then
   * re-reads the conversation: the immediate 200 response can be abbreviated.
   */
  async addReply(conversationId: number, body: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/conversations/${conversationId}/add_message`, {
      method: HttpMethod.POST,
      headers: { ...bearerHeaders(this.apiKey), [HttpHeader.CONTENT_TYPE]: ContentType.FORM_URLENCODED },
      body: new URLSearchParams({ body }).toString(),
    });
    if (!response.ok) throw new CanvasRequestError('add_message', response, await response.text());

    const newest = (await this.listMessages(conversationId)).at(-1);
    if (!newest || !newest.body.includes(body.slice(0, REPLY_VERIFY_PREFIX_CHARS))) {
      logger.warn(`[conv] add_message 200 but newest message does not match reply (conv ${conversationId}) — continuing`);
    }
  }

  async downloadAttachment(fileUrl: string): Promise<Buffer> {
    const response = ensureOk(await this.get(fileUrl), 'attachment download');
    return Buffer.from(await response.arrayBuffer());
  }

  private get(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
    return fetch(url, { headers: { ...bearerHeaders(this.apiKey), ...extraHeaders } });
  }
}

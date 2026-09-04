// Canvas Conversations API client — backend mirror of `extension/lib/canvasApi.js`.
// Used by the conversation poller (extension chat). The file-based Q/A flow in
// `canvasClient.ts` is untouched. Auth uses the same account token as the file flow.
import type { ConversationAttachment, ConversationMessage } from '../types';
import { parseSettingMessageValue } from '../utils/conversationMessageParser';
import { logger } from '../utils/logger';

interface RawAttachment {
  id?: number | string;
  filename?: string;
  url?: string;
  'content-type'?: string;
  contentType?: string;
}

interface RawMessage {
  id: number;
  body?: string;
  created_at?: string;
  attachments?: RawAttachment[];
}

export interface ConversationSettingsRead {
  activeConversationId: number | null;
  sawSystemPrompt: boolean;
}

export class ConversationClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  /** Current Canvas user id — required to scope settings-conversation discovery. */
  async getSelfUserId(): Promise<number> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/self`, { headers: this.headers });
    if (!res.ok) throw new Error(`Canvas self user fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json() as { id: number };
    return data.id;
  }

  /** All messages in a conversation, oldest-first (Canvas returns newest-first). */
  async listMessages(conversationId: number): Promise<ConversationMessage[]> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/conversations/${conversationId}?interleave_submissions=0`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Canvas conversation fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json() as { messages?: RawMessage[] };
    return [...(data.messages ?? [])].reverse().map(toConversationMessage);
  }

  /**
   * Finds self-conversations whose subject contains `marker`, newest-first.
   * Mirrors `listSelfConversationsBySubjectMarker` in the extension: scoped by
   * `filter=user_<selfId>`, paginated via `Link: rel="next"`.
   */
  async listSettingsConversations(marker: string): Promise<{ id: number; subject: string }[]> {
    const selfId = await this.getSelfUserId();
    const params = new URLSearchParams({ scope: 'sent', filter: `user_${selfId}`, per_page: '10' });
    let url: string | null = `${this.baseUrl}/api/v1/conversations?${params}`;
    const matches: { id: number; subject: string; updatedAt: string }[] = [];

    while (url) {
      const res = await fetch(url, { headers: { ...this.headers, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Canvas conversations list failed: ${res.status} ${res.statusText}`);
      const data = await res.json() as { id: number; subject?: string; updated_at?: string; last_message_at?: string }[];
      const conversations = Array.isArray(data) ? data : [];
      for (const c of conversations) {
        if ((c.subject ?? '').includes(marker)) {
          matches.push({ id: c.id, subject: c.subject ?? '', updatedAt: c.updated_at ?? c.last_message_at ?? '' });
        }
      }
      url = parseLinkRel(res.headers.get('Link'), 'next');
    }

    return matches
      .sort((a, b) => (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0))
      .map(({ id, subject }) => ({ id, subject }));
  }

  /**
   * Reverse-scans the settings conversation for the newest
   * `[CFH:SETTING:active_conversation_id]` value. The newest message may be a
   * `system_prompt` setting, so the last message alone is not sufficient.
   */
  async readSettings(settingsConversationId: number): Promise<ConversationSettingsRead> {
    const messages = await this.listMessages(settingsConversationId);
    let activeConversationId: number | null = null;
    let sawSystemPrompt = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (activeConversationId === null) {
        const raw = parseSettingMessageValue(messages[i].body, 'active_conversation_id');
        const n = raw === null ? NaN : Number(raw);
        if (Number.isFinite(n) && n > 0) activeConversationId = n;
      }
      if (!sawSystemPrompt && parseSettingMessageValue(messages[i].body, 'system_prompt') !== null) {
        sawSystemPrompt = true;
      }
      if (activeConversationId !== null && sawSystemPrompt) break;
    }
    return { activeConversationId, sawSystemPrompt };
  }

  /**
   * Posts a text-only [CFH:REPLY] into the conversation. Uses form-urlencoded
   * (Canvas silently drops `attachment_ids`/body sent as JSON), then re-GETs to
   * verify — the immediate `add_message` 200 response can be abbreviated.
   */
  async addReply(conversationId: number, body: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('body', body);
    const res = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}/add_message`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Canvas add_message failed: ${res.status} ${res.statusText} ${text}`.trim());
    }

    // Verify: re-fetch and confirm the newest message carries our reply.
    const messages = await this.listMessages(conversationId);
    const newest = messages[messages.length - 1];
    if (!newest || !newest.body.includes(body.slice(0, 64))) {
      logger.info(`[conv] add_message 200 but newest message does not match reply (conv ${conversationId}) — continuing`);
    }
  }

  /** Downloads a conversation attachment (same auth pattern as file download). */
  async downloadAttachment(fileUrl: string): Promise<Buffer> {
    const res = await fetch(fileUrl, { headers: this.headers });
    if (!res.ok) throw new Error(`Canvas attachment download failed: ${res.status} ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

function toConversationMessage(m: RawMessage): ConversationMessage {
  return {
    id: m.id,
    body: m.body ?? '',
    createdAt: m.created_at ?? '',
    attachments: (m.attachments ?? []).map((a): ConversationAttachment => ({
      id: String(a.id ?? ''),
      filename: a.filename ?? 'attachment',
      url: a.url ?? '',
      contentType: a['content-type'] ?? a.contentType,
    })).filter((a) => a.id && a.url),
  };
}

function parseLinkRel(linkHeader: string | null, rel: string): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, ...params] = part.split(';');
    if (params.some((p) => p.trim() === `rel="${rel}"`)) {
      const match = urlPart.trim().match(/^<(.+)>$/);
      if (match) return match[1];
    }
  }
  return null;
}

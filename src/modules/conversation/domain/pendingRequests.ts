import { ConversationSettingKey } from './enums/conversation.enums';
import {
  isRequestMessage,
  parseReplyMessage,
  parseRequest,
  parseSettingMessageValue,
} from './conversationMessage';
import { ConversationMessage } from './interfaces/conversationMessage.interface';
import { PendingConversationRequest, ConversationSettings } from './interfaces/pendingRequests.interface';
import { byCreatedAtAsc } from './helpers/pendingRequests.helper';

/** Key in the processing state; stable across polls (never derived from the message body). */
export function buildConvStateKey(accountIndex: number, conversationId: number, messageId: number): string {
  return `conv-${accountIndex}-${conversationId}-${messageId}`;
}

/**
 * Matches REQUEST messages with REPLY messages, mirroring
 * `deriveRequestStatuses` in `extension/lib/messageFormat.js`: a REPLY with
 * `request_id` answers that REQUEST; a REPLY without id answers the oldest
 * unanswered REQUEST (legacy FIFO). Returns pending requests oldest-first.
 */
export function findPendingRequests(messages: ConversationMessage[]): PendingConversationRequest[] {
  const sorted = [...messages].sort(byCreatedAtAsc);
  const answered = new Set<string>();
  const legacyQueue: string[] = [];

  for (const message of sorted) {
    if (isRequestMessage(message.body)) {
      legacyQueue.push(String(message.id));
      continue;
    }
    const reply = parseReplyMessage(message.body);
    if (!reply) continue;
    if (reply.requestId !== null) {
      answered.add(String(reply.requestId));
      const queued = legacyQueue.indexOf(String(reply.requestId));
      if (queued !== -1) legacyQueue.splice(queued, 1);
      continue;
    }
    const oldest = legacyQueue.shift();
    if (oldest !== undefined) answered.add(oldest);
  }

  return sorted
    .filter((message) => isRequestMessage(message.body) && !answered.has(String(message.id)))
    .map((message) => {
      const parsed = parseRequest(message.body);
      return {
        message,
        provider: parsed.provider,
        model: parsed.model,
        question: parsed.question,
        valid: parsed.valid,
        invalidReason: parsed.error,
        mode: parsed.mode,
      };
    });
}

/**
 * Reverse-scans the settings conversation for the newest
 * `[CFH:SETTING:active_conversation_id]` value. The newest message may be a
 * `system_prompt` setting, so the last message alone is not sufficient.
 */
export function readSettingsFromMessages(messages: ConversationMessage[]): ConversationSettings {
  let activeConversationId: number | null = null;
  let sawSystemPrompt = false;
  for (let i = messages.length - 1; i >= 0 && (activeConversationId === null || !sawSystemPrompt); i--) {
    const body = messages[i].body;
    if (activeConversationId === null) {
      const id = Number(parseSettingMessageValue(body, ConversationSettingKey.ACTIVE_CONVERSATION_ID) ?? Number.NaN);
      if (Number.isFinite(id) && id > 0) activeConversationId = id;
    }
    if (parseSettingMessageValue(body, ConversationSettingKey.SYSTEM_PROMPT) !== null) sawSystemPrompt = true;
  }
  return { activeConversationId, sawSystemPrompt };
}

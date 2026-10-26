// Conversation marker protocol — backend mirror of `extension/lib/messageFormat.js`.
// Keep both in sync: this file parses [CFH:REQUEST] bodies and builds [CFH:REPLY]
// bodies; the extension does the reverse. If markers change, update both files.
import { AnswerMode } from '../../agent/domain/enums/agent.enums';
import { REPLY_MARKER, REQUEST_MARKER, SETTING_MESSAGE_PREFIX_START } from './constants/conversation.constants';
import { ConversationReplyStatus, ProtocolHeader } from './enums/conversation.enums';
import { AI_PROVIDERS } from '../../ai/domain/constants/ai.constants';
import { parseAIProvider } from '../../ai/domain/helpers/ai.helper';
import { ParsedConversationRequest, ParsedReply, ConversationReply } from './interfaces/conversationMessage.interface';
import { parseHeaderBlock } from './helpers/conversationMessage.helper';

export function buildSettingMessagePrefix(key: string): string {
  return `${SETTING_MESSAGE_PREFIX_START}${key}]`;
}

export function buildSettingMessageBody(key: string, value: string | number): string {
  return `${buildSettingMessagePrefix(key)} ${value}`;
}

export function parseSettingMessageValue(body: string | undefined, key: string): string | null {
  const trimmed = (body ?? '').trim();
  const prefix = buildSettingMessagePrefix(key);
  if (!trimmed.startsWith(prefix)) return null;
  return trimmed.slice(prefix.length).trim() || null;
}

export function isRequestMessage(body: string | undefined): boolean {
  return (body ?? '').trim().startsWith(REQUEST_MARKER);
}

export function isReplyMessage(body: string | undefined): boolean {
  return (body ?? '').trim().startsWith(REPLY_MARKER);
}

/**
 * Parses an extension [CFH:REQUEST] body into provider/model/question.
 * Providers the extension offers but the backend cannot serve (e.g.
 * `cloudflare`) are rejected with a readable error.
 */
export function parseRequest(body: string | undefined): ParsedConversationRequest {
  if (!isRequestMessage(body)) {
    return { provider: '', question: '', valid: false, error: 'Not a [CFH:REQUEST] message', mode: AnswerMode.SINGLE_SHOT };
  }
  const { headers, content: question } = parseHeaderBlock(body ?? '');
  const rawProvider = (headers[ProtocolHeader.PROVIDER] ?? '').toLowerCase();
  const model = headers[ProtocolHeader.MODEL] || undefined;
  const mode = (headers[ProtocolHeader.MODE] ?? '').toLowerCase() === AnswerMode.AGENT ? AnswerMode.AGENT : AnswerMode.SINGLE_SHOT;
  if (!rawProvider) return { provider: rawProvider, model, question, valid: false, error: 'Missing provider header', mode };

  const provider = parseAIProvider(rawProvider);
  if (!provider) {
    return {
      provider: rawProvider, model, question, valid: false, mode,
      error: `Provider "${rawProvider}" is not servable by the backend (supported: ${AI_PROVIDERS.join(', ')})`,
    };
  }
  return { provider, model, question, valid: true, mode };
}

export function buildReply(reply: ConversationReply): string {
  const headerLines = [
    REPLY_MARKER,
    `${ProtocolHeader.REQUEST_ID}: ${reply.requestId}`,
    `${ProtocolHeader.STATUS}: ${reply.status}`,
    `${ProtocolHeader.PROVIDER}: ${reply.provider}`,
  ];
  if (reply.model) headerLines.push(`${ProtocolHeader.MODEL}: ${reply.model}`);
  if (reply.mode === AnswerMode.AGENT) headerLines.push(`${ProtocolHeader.MODE}: ${reply.mode}`);
  return [...headerLines, '', reply.content ?? ''].join('\n');
}

/** Parses a [CFH:REPLY] body. Returns null if not a reply message. */
export function parseReplyMessage(body: string | undefined): ParsedReply | null {
  if (!isReplyMessage(body)) return null;
  const { headers, content } = parseHeaderBlock(body ?? '');
  const requestId = Number(headers[ProtocolHeader.REQUEST_ID]);
  return {
    requestId: Number.isFinite(requestId) && requestId > 0 ? requestId : null,
    status: headers[ProtocolHeader.STATUS] ?? ConversationReplyStatus.DONE,
    provider: headers[ProtocolHeader.PROVIDER],
    model: headers[ProtocolHeader.MODEL],
    content,
  };
}

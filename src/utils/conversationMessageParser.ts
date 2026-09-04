// Conversation marker protocol — backend mirror of `extension/lib/messageFormat.js`.
// Keep both in sync: this file parses [CFH:REQUEST] bodies and builds [CFH:REPLY]
// bodies; the extension does the reverse. If markers change, update both files.
import type { ConversationReply, ParsedConversationRequest } from '../types';

export const REQUEST_MARKER = '[CFH:REQUEST]';
export const REPLY_MARKER = '[CFH:REPLY]';
export const SETTINGS_CONVERSATION_MARKER = '[CFH:SETTINGS]';
export const ACTIVE_CONVERSATION_SUBJECT_PREFIX = '[ACTIVE]';
export const SETTING_MESSAGE_PREFIX_START = '[CFH:SETTING:';
export const ACTIVE_CONVERSATION_ID_SETTING_KEY = 'active_conversation_id';
export const SYSTEM_PROMPT_SETTING_KEY = 'system_prompt';

/** Providers the backend can actually serve (mirrors ALLOWED_MODELS keys). */
const SERVABLE_PROVIDERS = new Set(['claude', 'gemini', 'grok', 'openai']);

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

interface HeaderBlock {
  headers: Record<string, string>;
  content: string;
}

/** Parses `key: value` lines up to the first blank line (shared by request/reply). */
function parseHeaderBlock(body: string): HeaderBlock {
  const lines = (body ?? '').replace(/\r\n/g, '\n').split('\n');
  const headers: Record<string, string> = {};
  let i = 1; // skip marker line
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { i++; break; }
    const sepIdx = line.indexOf(':');
    if (sepIdx === -1) continue;
    headers[line.slice(0, sepIdx).trim().toLowerCase()] = line.slice(sepIdx + 1).trim();
  }
  return { headers, content: lines.slice(i).join('\n').trim() };
}

/**
 * Parses an extension [CFH:REQUEST] body into provider/model/question.
 * `cloudflare` (valid in the extension UI) is explicitly rejected — the backend
 * has no cloudflare adapter (see ALLOWED_MODELS).
 */
export function parseRequest(body: string | undefined): ParsedConversationRequest {
  if (!isRequestMessage(body)) {
    return { provider: '', question: '', valid: false, error: 'Not a [CFH:REQUEST] message' };
  }
  const { headers, content: question } = parseHeaderBlock(body ?? '');
  const provider = (headers.provider ?? '').toLowerCase();
  const model = headers.model || undefined;
  if (!provider) {
    return { provider, model, question, valid: false, error: 'Missing provider header' };
  }
  if (!SERVABLE_PROVIDERS.has(provider)) {
    return {
      provider, model, question, valid: false,
      error: `Provider "${provider}" is not servable by the backend (supported: claude, gemini, grok, openai)`,
    };
  }
  return { provider: provider as ParsedConversationRequest['provider'], model, question, valid: true };
}

export function buildReply(reply: ConversationReply): string {
  const headerLines = [
    REPLY_MARKER,
    `request_id: ${reply.requestId}`,
    `status: ${reply.status}`,
    `provider: ${reply.provider}`,
  ];
  if (reply.model) headerLines.push(`model: ${reply.model}`);
  return [...headerLines, '', reply.content ?? ''].join('\n');
}

export interface ParsedReply {
  requestId: number | null;
  status: string;
  provider?: string;
  model?: string;
  content: string;
}

/** Parses a [CFH:REPLY] body. Returns null if not a reply message. */
export function parseReplyMessage(body: string | undefined): ParsedReply | null {
  if (!isReplyMessage(body)) return null;
  const { headers, content } = parseHeaderBlock(body ?? '');
  const requestId = Number(headers.request_id);
  return {
    requestId: Number.isFinite(requestId) && requestId > 0 ? requestId : null,
    status: headers.status ?? 'done',
    provider: headers.provider,
    model: headers.model,
    content,
  };
}

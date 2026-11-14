import { ConversationStateKey } from '../enums/conversation.enums';
import type { ConversationCursor } from '../interfaces/conversation.interface';

/** Key of every object of a conversation; `deletePrefix` of it purges the conversation's files. */
export function conversationPrefix(conversationId: string): string {
  return `conversations/${conversationId}/`;
}

export function artifactObjectKey(conversationId: string, artifactId: string, extension: string): string {
  return `${conversationPrefix(conversationId)}${artifactId}.${extension}`;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Max length of a conversation title, generated or user-given (PATCH /api/conversations/:id). */
export const CONVERSATION_TITLE_MAX = 80;
export const TITLE_MAX_CHARS = CONVERSATION_TITLE_MAX;

/** Title of a new conversation: the first question, one line. */
export function titleFrom(text: string, fallback: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return fallback;
  return line.length > TITLE_MAX_CHARS ? `${line.slice(0, TITLE_MAX_CHARS - 1)}…` : line;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'text/x-plantuml': 'puml',
  'application/json': 'json',
};

export function extensionForMime(mime: string): string {
  return EXTENSION_BY_MIME[mime.toLowerCase()] ?? 'bin';
}

/** `?pending=` values of GET /api/conversations → the state key they filter on. */
export const PENDING_FILTERS: Readonly<Record<string, ConversationStateKey>> = {
  c4: ConversationStateKey.PENDING_C4,
};

// Control characters (C0, DEL, C1) and line/paragraph separators: never part of a display title.
const TITLE_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
 
/**
 * User-given title (PATCH body): control characters become spaces, whitespace collapses, trimmed.
 * Returns null for `null`/`""` (back to the generated title); `undefined` when the value is invalid
 * (not a string, blank after cleaning, longer than CONVERSATION_TITLE_MAX).
 */
export function normalizeDisplayTitle(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const title = value.replace(TITLE_CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (!title || [...title].length > CONVERSATION_TITLE_MAX) return undefined;
  return title;
}

const CURSOR_SEPARATOR = '|';
/** Postgres `timestamptz::text` (or an ISO string): validated before it reaches a `::timestamptz` cast. */
const CURSOR_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2}){0,2})?$/;

/** Opaque list cursor: base64url of `updatedAtText|id`. */
export function encodeConversationCursor(cursor: ConversationCursor): string {
  return Buffer.from(`${cursor.updatedAt}${CURSOR_SEPARATOR}${cursor.id}`, 'utf-8').toString('base64url');
}

/** Null when the cursor is not one this server produced. */
export function decodeConversationCursor(value: string): ConversationCursor | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const text = Buffer.from(value, 'base64url').toString('utf-8');
  const at = text.lastIndexOf(CURSOR_SEPARATOR);
  if (at <= 0) return null;
  const updatedAt = text.slice(0, at);
  const id = text.slice(at + 1);
  if (!CURSOR_TIMESTAMP_PATTERN.test(updatedAt) || !isUuid(id)) return null;
  return { updatedAt, id: id.toLowerCase() };
}

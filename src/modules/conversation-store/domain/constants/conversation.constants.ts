import { ConversationStateKey } from '../enums/conversation.enums';

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

export const TITLE_MAX_CHARS = 80;

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

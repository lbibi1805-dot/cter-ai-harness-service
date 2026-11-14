export enum ConversationApiPath {
  LIST = '/api/conversations',
  PREFIX = '/api/conversations/',
  RESTORE_SUFFIX = '/restore',
  /** `GET /api/conversations/:id/messages?beforeSeq=&limit=` (older messages, planning-12112026/07). */
  MESSAGES_SUFFIX = '/messages',
}

export const ARTIFACTS_SEGMENT = '/artifacts/';

/** PATCH body is `{title}` only (≤ 80 chars): anything bigger is not a rename. */
export const MAX_RENAME_BODY_BYTES = 4 * 1024;

import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import type { ConversationGateway } from '../../domain/interfaces/canvasConversation.port';
import { PendingConversationRequest } from '../../domain/interfaces/pendingRequests.interface';

export interface ConversationPollerDeps {
  createClient: (account: CanvasAccountConfig) => ConversationGateway;
  now?: () => number;
  /** CANVAS_DEADLINE_MS: the AI chain of one request (absent = the invocation default, CHAT_DEADLINE_MS). */
  deadlineMs?: number;
}

export interface CachedSettings {
  conversationId: number;
  expiresAt: number;
}

/** One pending request being answered. */
export interface RequestTask {
  request: PendingConversationRequest;
  conversationId: number;
  account: CanvasAccountConfig;
  client: ConversationGateway;
  /** Processing-state key (also used as its "file name"). */
  key: string;
}

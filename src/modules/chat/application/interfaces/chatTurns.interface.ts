import type { ConversationTurn, PromptContent, PromptImage } from '../../../ai';
import type { CitedChunk } from '../../../retrieval';

export interface ChatTurnInput {
  /** Absent = start a new conversation (its id comes back in `done`). */
  conversationId?: string;
  question: string;
  images: PromptImage[];
  /** History sent by an old client; used only when there is no stored conversation to read. */
  clientHistory: ConversationTurn[];
}

/** What happened in the turn, for the message row (timings feed latency dashboards). */
export interface ChatTurnOutcome {
  text: string;
  provider: string;
  model: string;
  mode: string;
  durationMs: number;
  ttftMs?: number;
  sources: CitedChunk[];
}

export interface ChatTurnRecord {
  conversationId: string;
  /** Id of the assistant message. */
  messageId: string;
  /** False when the database write failed (the answer was still returned). */
  persisted: boolean;
}

export interface PreparedChatTurn {
  conversationId: string;
  /** The prompt content with every context layer (history, memory, JIT artifacts, RAG query). */
  content: PromptContent;
  finish(outcome: ChatTurnOutcome): Promise<ChatTurnRecord>;
}

/**
 * Server-side conversation memory for /api/chat (implemented by the context
 * module). Absent = stateless chat: the client's `history` is used as before.
 */
export interface ChatTurns {
  /** Throws NotFoundError for a soft-deleted conversation, ValidationError for a bad id. */
  begin(input: ChatTurnInput): Promise<PreparedChatTurn>;
}

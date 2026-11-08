import type { ConversationTurn, PromptContent, PromptImage } from '../../../ai';
import type { ConversationSnapshot, ResolvedRefs } from '../../../conversation-store';
import type { CitedChunk } from '../../../retrieval';
import type { AgentTool } from '../../../agent/domain/interfaces/agentTool.interface';
import type { AuxResolver } from '../../../context/domain/interfaces/artifactResolver.interface';

export interface ChatTurnInput {
  /** Absent = start a new conversation (its id comes back in `done`). */
  conversationId?: string;
  question: string;
  images: PromptImage[];
  /** History sent by an old client; used only when there is no stored conversation to read. */
  clientHistory: ConversationTurn[];
  /**
   * Artifacts the user pointed at in the UI ("↩ Hỏi về cái này" / `[A7]` chip): aliases
   * such as "A7" (artifact UUIDs are accepted too). They win over every other signal.
   */
  refArtifactIds?: string[];
  /**
   * This request's aux resolver instead of the shared one (Essay Mode: the session whose single call
   * also returns the essay analysis). Absent = the turn service's own resolver.
   */
  auxResolver?: AuxResolver;
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
  /** Prompt / completion tokens reported by the provider. */
  tokensIn?: number;
  tokensOut?: number;
  /** Prompt tokens served from the provider's prompt cache (note 18 step 1). */
  tokensCached?: number;
}

export interface ChatTurnRecord {
  conversationId: string;
  /** Id of the assistant message. */
  messageId: string;
  /** False when the database write failed (the answer was still returned). */
  persisted: boolean;
  /** Artifacts written by this turn, with the `[A7]` alias the client shows on bubbles ("↩ Hỏi về cái này"). */
  artifacts?: TurnArtifactRef[];
}

export interface TurnArtifactRef {
  id: string;
  alias: string;
  kind: string;
  label: string;
  level?: string;
}

export interface PreparedChatTurn {
  conversationId: string;
  /** The prompt content with every context layer (history, memory, JIT artifacts, RAG query). */
  content: PromptContent;
  /** What the resolver picked for this question (also persisted in `messages.resolved_refs`). */
  resolvedRefs?: ResolvedRefs;
  /** The conversation read by `begin` (null for a new one): feeds the agent artifact tools. */
  snapshot?: ConversationSnapshot | null;
  /** Agent mode: `list_artifacts` / `get_artifact` over this conversation (note 17 step 8). */
  agentTools?: AgentTool[];
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

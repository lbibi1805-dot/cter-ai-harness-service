import type { ConversationRole } from '../enums/ai.enums';

export interface PromptImage {
  data: Buffer;
  mimeType: string;
}

/** One earlier message of the conversation (text only; images are not replayed). */
export interface ConversationTurn {
  role: ConversationRole;
  text: string;
}

/** What the user asked: extracted file text, a chat question, plus any images. */
export interface PromptContent {
  textContent: string;
  imageBuffers: PromptImage[];
  /**
   * Earlier turns, oldest first, already normalized by `normalizeHistory`:
   * starts with a user turn, alternates roles and ends with an assistant turn.
   */
  history?: ConversationTurn[];
  /**
   * Conversation memory (layers ② summary + ③ artifact registry), appended to the
   * end of the system prompt so the static prefix (layer ①) stays cacheable.
   */
  memory?: string;
  /** Just-in-time artifacts (layer ⑤: C4 spec, PUML, image notes), placed before the RAG context. */
  jitContext?: string;
  /** Overrides the RAG query (question + previous turn + OCR text, or a rewritten follow-up). */
  retrievalQuery?: string;
}

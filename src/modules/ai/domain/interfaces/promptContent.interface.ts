import type { ConversationRole } from '../enums/ai.enums';

export interface PromptImage {
  data: Buffer;
  mimeType: string;
  /** Artifact alias (`A3`) of an image replayed from the conversation; used in history markers. */
  alias?: string;
}

/**
 * One earlier message of the conversation. Text only, except inside the hot window
 * (CONTEXT_HOT_WINDOW_TURNS, note 18 step 5): the images of that message, in place —
 * user images on the user turn, the C4 PNGs an assistant turn drew on the assistant turn
 * (adapters render those at the start of the next user turn, see `renderHistory`).
 */
export interface ConversationTurn {
  role: ConversationRole;
  text: string;
  images?: PromptImage[];
}

/** What the user asked: extracted file text, a chat question, plus any images. */
export interface PromptContent {
  textContent: string;
  imageBuffers: PromptImage[];
  /**
   * Earlier turns, oldest first, already normalized by `normalizeHistory`:
   * starts with a user turn, alternates roles and ends with an assistant turn.
   * Layout V2: the conversation summary (if any) is the first user/assistant pair.
   */
  history?: ConversationTurn[];
  /**
   * Conversation memory (layers ② summary + ③ artifact registry). Layout V1 only:
   * appended to the end of the system prompt. Layout V2 producers leave it unset
   * (summary → history, registry → `jitContext`); a V2 consumer that still gets it
   * puts it at the tail, never in the system prompt (see `placeMemory`).
   */
  memory?: string;
  /**
   * Tail layers placed before the RAG context: (V2) ③ artifact registry, then ⑤
   * just-in-time artifacts (C4 spec, PUML, image notes).
   */
  jitContext?: string;
  /** Overrides the RAG query (question + previous turn + OCR text, or a rewritten follow-up). */
  retrievalQuery?: string;
}

import type { ConversationTurn } from '../../../ai';
import type { ConversationSnapshot, StoredArtifact, StoredMessage } from '../../../conversation-store';

export interface ContextSettings {
  /** Turns kept verbatim when compacting (CONTEXT_KEEP_RECENT_TURNS). */
  keepRecentTurns: number;
  /** Compact when the not-yet-summarized messages exceed this estimate (CONTEXT_COMPACT_THRESHOLD_TOKENS). */
  compactThresholdTokens: number;
  /** …or when they span more turns than this. */
  compactMaxTurns: number;
  /** Artifact registry lines in the prompt (newest). */
  registryMaxLines: number;
  /** Images re-attached just in time. */
  jitMaxImages: number;
  /** Size cap of inlined text artifacts (≈ 4k tokens). */
  jitMaxChars: number;
  /** Messages read per turn (safety bound; compaction keeps the real count lower). */
  maxLoadMessages: number;
  maxLoadArtifacts: number;
}

/** Caption + OCR of an image, written by the aux model. */
export interface ImageNote {
  caption: string;
  ocrText: string;
}

export interface AssembleInput {
  snapshot: ConversationSnapshot | null;
  question: string;
  /** Images sent with this question (they come first in the message). */
  currentImageCount: number;
  /** Notes of the images sent with this question (known only for image-only questions). */
  currentImageNotes: ImageNote[];
  settings: ContextSettings;
}

/** Layers ②–⑤ plus the RAG query, ready to go into PromptContent. */
export interface AssembledContext {
  history: ConversationTurn[];
  /** ② summary + ③ registry. */
  memory: string;
  /** ⑤ inlined text artifacts and the labels of re-attached images. */
  jitText: string;
  /** Image artifacts to fetch and re-attach (after the current images). */
  jitImages: StoredArtifact[];
  /** Query for RAG (layer ⑥); empty = nothing to search with. */
  retrievalQuery: string;
  /** OCR/caption snippets of the images in play (kept when the question is rewritten). */
  retrievalHints: string[];
}

export interface CompactionPlan {
  /** Messages folded into the new summary (oldest unsummarized ones). */
  toSummarize: StoredMessage[];
  uptoSeq: number;
  /** Artifact aliases the summary must keep (never dropped). */
  requiredRefs: string[];
}

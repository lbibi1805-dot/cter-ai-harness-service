import type { ConversationTurn } from '../../../ai';
import type { PromptCacheLayout } from '../../../ai/domain/enums/promptLayout.enums';
import type { ArtifactKind, ConversationSnapshot, ResolvedRefs, StoredArtifact, StoredMessage } from '../../../conversation-store';
import type { ResolveResult, ResolverSettings } from './artifactResolver.interface';

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
  /** CONTEXT_PINNED_KINDS: always loaded, outside `maxLoadArtifacts` (same query). */
  pinnedKinds: readonly ArtifactKind[];
  /** Safety cap on pinned rows. */
  maxPinnedArtifacts: number;
  /** A design answer at least this long (or with a component list/table) becomes a design_note. */
  designNoteMinChars: number;
  /** ARTIFACT_RESOLVER_*. */
  resolver: ResolverSettings;
  /** PROMPT_CACHE_LAYOUT: where summary + registry go (note 18 §4). */
  promptLayout: PromptCacheLayout;
  /** CONTEXT_HOT_WINDOW_TURNS: last K user/assistant pairs sent with their images in place (0 = off). */
  hotWindowTurns: number;
  /** CONTEXT_MAX_PROMPT_IMAGES: cap on current + hot window + JIT images in one request. */
  maxPromptImages: number;
}

/** A history turn before its images are loaded: the image artifacts of its message (hot-window candidates). */
export interface HistoryTurnDraft {
  role: ConversationTurn['role'];
  text: string;
  images?: StoredArtifact[];
}

/** Images to load into one history turn (hot window); `turnIndex` indexes `AssembledContext.history`. */
export interface HotWindowSlot {
  turnIndex: number;
  artifacts: StoredArtifact[];
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
  /** Explicit refs from the UI (aliases or ids). */
  refIds?: string[];
  /** Resolution done beforehand (e.g. with the aux resolver); computed by rules when absent. */
  resolution?: ResolveResult;
}

/** Layers ②–⑤ plus the RAG query, ready to go into PromptContent. */
export interface AssembledContext {
  history: ConversationTurn[];
  /** Layout V1: ② summary + ③ registry (one block for the system prompt). */
  memory: string;
  /** ② summary alone (layout V2: first history turn). */
  summary: string;
  /** ③ registry block alone (layout V2: tail, before the JIT artifacts). */
  registry: string;
  /** ⑤ inlined text artifacts and the labels of re-attached images. */
  jitText: string;
  /** Image artifacts to fetch and re-attach (after the current images); never one already in the hot window. */
  jitImages: StoredArtifact[];
  /** Hot window (note 18 step 5): image artifacts to load into history turns, in place. Empty when off. */
  hotWindow: HotWindowSlot[];
  /** Query for RAG (layer ⑥); empty = nothing to search with. */
  retrievalQuery: string;
  /** OCR/caption snippets of the images in play (kept when the question is rewritten). */
  retrievalHints: string[];
  /** What the resolver picked (null when the resolver is off). */
  resolvedRefs: ResolvedRefs | null;
}

export interface CompactionPlan {
  /** Messages folded into the new summary (oldest unsummarized ones). */
  toSummarize: StoredMessage[];
  uptoSeq: number;
  /** Artifact aliases the summary must keep (never dropped). */
  requiredRefs: string[];
}

/** Structured design answered in normal chat (design_note.data_json). */
export interface DesignNoteData {
  systemName: string;
  elements: { name: string; tech?: string }[];
  decisions: string[];
  /** heuristic | aux */
  extractedBy: string;
}

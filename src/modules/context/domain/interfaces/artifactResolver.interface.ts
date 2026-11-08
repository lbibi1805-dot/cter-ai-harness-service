import type { ArtifactKind, MessageRole, ResolvedRefSource, StoredArtifact, StoredMessage } from '../../../conversation-store';
import type { ArtifactResolverMode, TemporalCue } from '../enums/context.enums';

/** ARTIFACT_RESOLVER_* settings (note 17 §7). */
export interface ResolverSettings {
  mode: ArtifactResolverMode;
  /** top1 must reach this score… */
  minScore: number;
  /** …and lead top2 by at least this much. */
  margin: number;
  /** Aux resolver deadline; a timeout counts as ambiguous. */
  auxTimeoutMs: number;
  /** Aux replies below this confidence count as ambiguous. */
  auxMinConfidence: number;
}

/** Reference signals found in a question (§3.1). */
export interface ReferenceSignals {
  /** Aliases typed in the question ("A7", "[A7]"). */
  aliases: string[];
  /** Candidate kinds the question points at (empty = any referable kind). */
  kinds: ArtifactKind[];
  /** Asks about a picture the assistant drew ("hình bạn vẽ", "bản vẽ", "sơ đồ") → attach its C4_PNG. */
  drawn: boolean;
  /** C4 levels named in the question. */
  levels: string[];
  owner: MessageRole | null;
  temporal: TemporalCue | null;
  /** "bản 2", "v2", "lần 2" → version / order number. */
  ordinal: number | null;
  /** "turn 3", "lượt 3". */
  turn: number | null;
  /** Anaphoric marker ("lúc nãy", "ở trên"): a reference exists, without saying which. */
  reference: boolean;
  /** Content words for the fuzzy system/entity match. */
  entityTokens: string[];
}

export interface ScoreBreakdown {
  kind: number;
  level: number;
  entity: number;
  owner: number;
  temporal: number;
  recency: number;
}

export interface ScoredCandidate {
  artifact: StoredArtifact;
  alias: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface ResolveInput {
  question: string;
  /** The conversation's artifacts (snapshot: newest N + pinned kinds). */
  artifacts: StoredArtifact[];
  /** Recent messages (aux context; optional). */
  messages?: StoredMessage[];
  /** Explicit refs from the UI: aliases ("A7") or artifact ids. Win over every other signal. */
  refIds?: string[];
  settings?: Partial<ResolverSettings>;
}

export interface ResolveResult {
  /**
   * Artifacts to ground the answer on. When `ambiguous`, the single default
   * (the newest of the candidates); `candidates` then holds the choices to offer.
   */
  picked: StoredArtifact[];
  source: ResolvedRefSource;
  /** 0..1. */
  confidence: number;
  /** Scored candidates, best first (top ones only when ambiguous: the choices). */
  candidates: ScoredCandidate[];
  ambiguous: boolean;
  signals: ReferenceSignals;
}

/** One registry line given to the aux resolver (≤ 40 lines). */
export interface AuxRegistryEntry {
  alias: string;
  kind: ArtifactKind;
  owner: MessageRole | null;
  turn: number | null;
  label: string;
}

export interface AuxResolveRequest {
  question: string;
  registry: AuxRegistryEntry[];
  /** The last two turns, oldest first ("user: …", "assistant: …"). */
  recentTurns: string[];
  timeoutMs: number;
}

export interface AuxResolveReply {
  /** Aliases ("A7"); unknown ones are dropped by the caller. */
  refs: string[];
  confidence: number;
  reason?: string;
}

/**
 * Step ③ hook (note 17 §3.3) — NOT implemented here: the C4 agent provides one combined
 * aux call that returns both the intent (note 05 §2) and the refs. Called only when the
 * rules are not sure. Must not throw for model problems: return null instead (= ambiguous).
 */
export interface AuxResolver {
  resolve(request: AuxResolveRequest): Promise<AuxResolveReply | null>;
}

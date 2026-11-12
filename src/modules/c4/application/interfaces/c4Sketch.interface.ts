import type { AIProvider, ModelCatalog, PromptImage } from '../../../ai';
import type { ResolverSettings } from '../../../context';
import type { ConversationSnapshot, StoredArtifact } from '../../../conversation-store';
import type { CitedChunk } from '../../../retrieval';
import type { IntentDecision, IntentRouter, RequestIntent } from '../../../routing';
import type {
  C4DiagramSpec,
  C4Level,
  C4Requirement,
  C4Validation,
  C4ValidationRules,
  C4WorkflowStep,
  ClarifyQuestion,
  DesignSourceKind,
  DiagramRenderer,
  ProblemBrief,
} from '../../domain';

export interface C4PumlOptions {
  /** C4-PlantUML base URL, or "stdlib" for PlantUML's bundled copy. */
  includeBase?: string;
  showLegend?: boolean;
}

export interface C4SketchRequest {
  provider: AIProvider;
  /** As sent by the client; resolved and validated by the service. */
  requestedModel?: string;
  /** Typed text; may be empty when images carry the statement. */
  description: string;
  levels: C4Level[];
  /** Skip the clarify questions and the critic round. */
  fast: boolean;
  /** Answer as NDJSON events instead of one JSON body. */
  stream: boolean;
  /** Problem pages and/or the user's own design. */
  images: PromptImage[];
  /** Server-side conversation the run belongs to (its diagrams become artifacts there). */
  conversationId?: string;
  /** `--review`. */
  review?: boolean;
  /** Intent the client asked for (`intent` other than "auto"); absent = the router decides. */
  intent?: RequestIntent | null;
  /** Explicit artifact refs ("A7" or ids) from the client: the design to revise/review. */
  refArtifactIds?: string[];
}

export interface C4LevelResult {
  level: C4Level;
  title?: string;
  png?: Buffer;
  puml?: string;
  /** The accepted diagram spec (what was rendered). */
  spec?: C4DiagramSpec;
  elementCount: number;
  covered: string[];
  missing: string[];
  /** Pipeline notes (repairs, critic verdict, deadline). */
  notes: string[];
  error?: string;
}

/** Old pause shape (kept in `done.confirmation` for older clients): question + what is drawn without an answer. */
export interface C4Clarification {
  question: string;
  assumption: string;
}

/** Set when the run paused for the user (human in the loop); `levels` is then empty. */
export interface C4Confirmation {
  sessionId: string;
  clarifications: C4Clarification[];
  /** Epoch ms after which the session is gone and /api/c4/resume answers 404. */
  expiresAt: number;
}

/** The clarify message (note 05 §5): what was understood + at most 3 questions with defaults. */
export interface C4Clarify {
  sessionId: string;
  summary: string[];
  questions: ClarifyQuestion[];
  expiresAt: number;
}

/** A design review (note 05 §6), saved as a `design_review` artifact. */
export interface C4ReviewResult {
  markdown: string;
  designSource: DesignSourceKind;
  /** Alias/label of the reviewed artifact when it came from the conversation. */
  designLabel?: string;
  artifactId?: string;
  alias?: string;
}

/** An artifact the run created (alias = `A{ordinal}`, as on chat turns). */
export interface C4ArtifactRef {
  id: string;
  alias: string;
  kind: string;
  label: string;
  level?: string;
}

/** A c4_revise result continues the base spec's version chain (note 17 §4). */
export interface C4Revision {
  parentArtifactId: string;
  version: number;
  baseAlias: string;
}

export interface C4SketchResult {
  provider: AIProvider;
  model: string;
  systemName: string;
  requirements: C4Requirement[];
  /** Knowledge-base files whose chunks were given to the agents. */
  knowledgeSources: string[];
  levels: C4LevelResult[];
  /** Machine time only: waiting for the user's confirmation does not count. */
  elapsedMs: number;
  deadlineHit: boolean;
  confirmation?: C4Confirmation;
  clarify?: C4Clarify;
  intent?: IntentDecision;
  brief?: ProblemBrief;
  /** Set for review intents (null when the review could not be written). */
  review?: C4ReviewResult | null;
  /** The critic's findings as readable sentences (instead of "review: ok"). */
  criticNotes?: string[];
  revision?: C4Revision;
  /** Artifacts written by this run, with their aliases. */
  artifacts?: C4ArtifactRef[];
  /** Set when the run was recorded in a conversation. */
  conversationId?: string;
  messageId?: string;
}

/** Continues a paused run. Blank or "ok" `answers` = keep every default. */
export interface C4ResumeRequest {
  sessionId: string;
  answers?: string;
  stream: boolean;
}

/** What the architect produced, parsed. */
export interface C4ArchitectPlan {
  systemName: string;
  requirements: C4Requirement[];
  drafted: C4SpecsByLevel;
  /** The shared model as JSON, given to fallback drafters. */
  modelJson: string;
  rules: C4ValidationRules;
  clarifications: C4Clarification[];
}

/** Progress of a run, for streaming clients. The note-05 events are optional to listen to. */
export interface C4EventSink {
  progress(message: string): void;
  analysis(plan: C4ArchitectPlan, knowledgeSources: string[]): void;
  /** A level got a (new) rendered image. */
  level(result: C4LevelResult): void;
  intent?(decision: IntentDecision): void;
  brief?(brief: ProblemBrief): void;
  clarify?(clarify: C4Clarify): void;
  reviewDelta?(text: string): void;
  reviewDone?(review: C4ReviewResult): void;
}

/** A conversation artifact a run builds on (revise base or reviewed design), as persisted in the session. */
export interface C4DesignRef {
  artifactId: string;
  alias: string;
  kind: string;
  label: string;
  version: number;
  dataJson: unknown;
  /** Object key (user images: bytes reloaded for a review). */
  objectKey?: string | null;
  mime?: string | null;
}

/**
 * A run paused at the clarify step (`conversations.state.pendingC4`, survives restarts). The clock is
 * stopped with `remainingMs` left. The request images are staged in object storage (`imageKeys`) so a
 * resume after a restart still sends them to the architect / drafter / review calls.
 */
export interface C4Session {
  id: string;
  step: C4WorkflowStep;
  request: C4SketchRequest;
  model: string;
  knowledge: CitedChunk[];
  remainingMs: number;
  activeMs: number;
  expiresAt: number;
  label: string;
  /** Conversation the paused run belongs to: the session is persisted there (survives a restart). */
  conversationId?: string;
  intent: IntentDecision;
  /** Same as intent.confidence (monitoring view of pendingC4). */
  intentConfidence: number;
  brief: ProblemBrief;
  systemName: string;
  summary: string[];
  questions: ClarifyQuestion[];
  /** Design to revise/review, resolved before pausing. */
  design?: C4DesignRef | null;
  /** The request images staged while paused (object storage, `tmp/` prefix); absent = none or not staged. */
  imageKeys?: C4StagedImage[];
}

/** One request image of a paused run, staged in object storage. */
export interface C4StagedImage {
  key: string;
  mime: string;
}

/**
 * Object storage for the images of paused runs. Cleanup happens on the request path only (resume or an
 * expired take); objects nobody takes are removed by the bucket's `tmp/` lifecycle rule.
 */
export interface C4ImageStaging {
  stage(sessionId: string, images: PromptImage[]): Promise<C4StagedImage[]>;
  /** The images in order; null when any object is missing or unreadable. */
  load(staged: C4StagedImage[]): Promise<PromptImage[] | null>;
  discard(staged: C4StagedImage[]): Promise<void>;
}

/** Paused runs: in memory, and in the conversation's state when the run belongs to one. Entries expire. */
export interface C4SessionRepository {
  save(session: C4Session): Promise<void>;
  /** Removes and returns the session; undefined when unknown or expired. */
  take(id: string): Promise<C4Session | undefined>;
}

export interface C4RecordInput {
  conversationId: string;
  userText: string;
  images: PromptImage[];
  result: C4SketchResult;
  paused: boolean;
  /** Write the brief as a `problem_brief` artifact (first turn, or answers changed it); default false. */
  recordBrief?: boolean;
}

/** Records C4 runs in server-side conversations (implemented by the context module). */
export interface C4ConversationRecorder {
  /** Checks the conversation can be used and reads it (ValidationError for a bad id, NotFoundError when soft-deleted). */
  open(conversationId: string): Promise<ConversationSnapshot | null>;
  record(input: C4RecordInput): Promise<{ messageId: string; artifacts?: C4ArtifactRef[] }>;
  /** Bytes of image artifacts (a user design picked from the conversation). */
  loadImages?(artifacts: StoredArtifact[]): Promise<PromptImage[]>;
}

/** One model call with the C4 system prompt (not the chat persona) and no per-call retrieval. */
export interface C4ModelCall {
  provider: AIProvider;
  model: string;
  systemPrompt: string;
  text: string;
  images: PromptImage[];
  label: string;
  /** Absolute deadline (epoch ms) of this step's AI call chain; absent = the invocation default (CHAT_DEADLINE_MS). */
  deadlineAt?: number;
}

export interface C4ModelGateway {
  ask(call: C4ModelCall): Promise<string>;
  /** Streams the answer (review markdown); absent = `ask`, delivered as one delta. */
  stream?(call: C4ModelCall, onDelta: (text: string) => void): Promise<string>;
}

/** The cheap aux model (AUX_MODEL) for small JSON jobs: parsing the user's clarify reply. */
export interface C4AuxGateway {
  complete(call: { system: string; text: string; label: string; timeoutMs: number; maxOutputTokens: number }): Promise<string>;
}

/** Prompt registry lookup: a skill's body by id, null when missing. */
export type C4SkillSource = (id: string) => string | null;

/** The vault (RAG) as seen by the sketcher: design rules and exam notes the user uploaded. */
export interface C4KnowledgeSource {
  /** Empty when RAG is not ready yet. */
  search(query: string): Promise<CitedChunk[]>;
}

export interface C4SketchSettings {
  /** False when CHAT_API_TOKEN is unset: the API fails closed. */
  enabled: boolean;
  deadlineMs: number;
  maxElements: number;
  /** The critic only starts before this point of the deadline, so its revision can still be rendered. */
  criticCutoffMs: number;
  /** Per-call cap so one stuck provider call cannot eat the whole budget. */
  callTimeoutMs: number;
}

export interface C4SketchDeps {
  catalog: ModelCatalog;
  sessions: C4SessionRepository;
  model: C4ModelGateway;
  knowledge: C4KnowledgeSource;
  renderer: DiagramRenderer;
  puml: C4PumlOptions;
  /** Absent = runs are not recorded in conversations. */
  conversations?: C4ConversationRecorder;
  /** Intent router (rules + combined aux call); absent = rules only. */
  router?: IntentRouter | null;
  /** Aux model for the clarify-reply parser; absent = numbered answers / defaults only. */
  aux?: C4AuxGateway | null;
  /** Prompt registry skills; absent = the TS constants. */
  skills?: C4SkillSource | null;
  /** Precedence + domain system-architecture (registry), composed before every /c4 system prompt; absent = none. */
  sharedRules?: string | null;
  /** `prompts/policies/reminder.md`, appended after every request text; absent = none. */
  reminder?: string;
  /** Artifact resolver settings (ARTIFACT_RESOLVER_*). */
  resolver?: Partial<ResolverSettings>;
  /** Test hook. */
  now?: () => number;
}

/** Per-level working state inside one run. */
export interface C4LevelState {
  result: C4LevelResult;
  candidate?: C4Validation;
  problems: string[];
}

/** Specs the architect/repair/critic returned, keyed by level. */
export type C4SpecsByLevel = Map<C4Level, C4DiagramSpec>;

export interface C4Critique {
  revise: boolean;
  issues: string[];
  spec?: C4DiagramSpec;
}

/** What the repair agent gets for one broken level. */
export interface C4RepairInput {
  specJson: string;
  problems: readonly string[];
}

/** Everything one run's model calls share. */
export interface C4RunContext {
  provider: AIProvider;
  model: string;
  systemPrompt: string;
  /** The run's vault notes as reference material, put in front of every request text (empty = none). */
  reference?: string;
  /** Epoch ms after which no new work starts. */
  deadline: number;
  /** Epoch ms after which the critic is skipped (its call and re-render must still fit). */
  criticBy: number;
  label: string;
  sink?: C4EventSink;
}

/** Inputs of the draw step (generate or revise). */
export interface C4DrawInput {
  request: C4SketchRequest;
  brief: ProblemBrief;
  /** The clarify reply, given to the architect verbatim. */
  answers?: string;
  /** c4_revise: base spec + version chain. */
  design?: C4DesignRef | null;
  revise: boolean;
}

import type { AIProvider, ModelCatalog, PromptImage } from '../../../ai';
import type { CitedChunk } from '../../../retrieval';
import type { C4DiagramSpec, C4Level, C4Requirement, C4Validation, C4ValidationRules, DiagramRenderer } from '../../domain';

export interface C4PumlOptions {
  /** C4-PlantUML base URL, or "stdlib" for PlantUML's bundled copy. */
  includeBase?: string;
  showLegend?: boolean;
}

export interface C4SketchRequest {
  provider: AIProvider;
  /** As sent by the client; resolved and validated by the service. */
  requestedModel?: string;
  description: string;
  levels: C4Level[];
  /** Skip the critic round. */
  fast: boolean;
  /** Answer as NDJSON events (progress/analysis/level/done) instead of one JSON body. */
  stream: boolean;
}

export interface C4LevelResult {
  level: C4Level;
  title?: string;
  png?: Buffer;
  puml?: string;
  elementCount: number;
  covered: string[];
  missing: string[];
  /** Pipeline notes (repairs, critic verdict, deadline). */
  notes: string[];
  error?: string;
}

/** An ambiguity the architect wants the user to settle; `assumption` is what gets drawn without an answer. */
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
}

/** Continues a paused run. Blank `answers` = keep the architect's assumptions. */
export interface C4ResumeRequest {
  sessionId: string;
  answers?: string;
  stream: boolean;
}

/** What the architect produced, parsed: shared by the first run and a resumed one. */
export interface C4ArchitectPlan {
  systemName: string;
  requirements: C4Requirement[];
  drafted: C4SpecsByLevel;
  /** The shared model as JSON, given to fallback drafters. */
  modelJson: string;
  rules: C4ValidationRules;
  clarifications: C4Clarification[];
}

/** Progress of a run, for streaming clients. Every method is optional to listen to. */
export interface C4EventSink {
  progress(message: string): void;
  analysis(plan: C4ArchitectPlan, knowledgeSources: string[]): void;
  /** A level got a (new) rendered image. */
  level(result: C4LevelResult): void;
}

/** A run paused for confirmation; the clock is stopped with `remainingMs` left. */
export interface C4Session {
  id: string;
  request: C4SketchRequest;
  model: string;
  knowledge: CitedChunk[];
  /** The architect's raw JSON answer (re-parsed on resume). */
  architect: Record<string, unknown>;
  remainingMs: number;
  activeMs: number;
  expiresAt: number;
  label: string;
}

/** Paused runs; in memory (one server instance), entries expire. */
export interface C4SessionRepository {
  save(session: C4Session): void;
  /** Removes and returns the session; undefined when unknown or expired. */
  take(id: string): C4Session | undefined;
}

/** One model call with the C4 system prompt (not the chat persona) and no per-call retrieval. */
export interface C4ModelCall {
  provider: AIProvider;
  model: string;
  systemPrompt: string;
  text: string;
  images: PromptImage[];
  label: string;
}

export interface C4ModelGateway {
  ask(call: C4ModelCall): Promise<string>;
}

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
  /** Epoch ms after which no new work starts. */
  deadline: number;
  /** Epoch ms after which the critic is skipped (its call and re-render must still fit). */
  criticBy: number;
  label: string;
  sink?: C4EventSink;
}

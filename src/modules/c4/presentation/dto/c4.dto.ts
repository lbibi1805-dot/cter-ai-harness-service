import type { AIProvider } from '../../../ai';
import type { C4Level, C4Requirement, ClarifyQuestion, ConnectivityIssue } from '../../domain';
import type { C4ArtifactRef, C4Clarification } from '../../application/interfaces/c4Sketch.interface';

export interface C4LevelDto {
  level: C4Level;
  ok: boolean;
  title: string | null;
  /** PNG as base64 (no data: prefix). */
  png: string | null;
  puml: string | null;
  elementCount: number;
  covered: string[];
  missing: string[];
  notes: string[];
  error: string | null;
  /** Connectivity rules C1–C9 on the accepted spec (plan 04 §4.2); empty lists before a spec is accepted. */
  connectivity: C4ConnectivityDto;
}

export interface C4ConnectivityDto {
  errors: ConnectivityIssue[];
  warnings: ConnectivityIssue[];
}

export interface C4DiscussionDto {
  markdown: string;
  artifactId?: string;
  alias?: string;
}

export interface C4IntentDto {
  intent: string;
  confidence: number;
  source: string;
}

export interface C4BriefDto {
  systemName: string;
  /** 3–5 bullets ("Mình hiểu đề như sau"). */
  summary: string[];
  actors: string[];
  externalSystems: string[];
  levels: string[];
}

export interface C4ClarifyDto {
  sessionId: string;
  summary: string[];
  questions: ClarifyQuestion[];
  expiresInSec: number;
}

export interface C4ReviewDto {
  markdown: string;
  artifactId?: string;
  alias?: string;
}

export interface C4SketchDto {
  provider: AIProvider;
  model: string;
  systemName: string;
  requirements: C4Requirement[];
  knowledgeSources: string[];
  levels: C4LevelDto[];
  durationMs: number;
  deadlineHit: boolean;
  /** Server-side conversation the run was recorded in (null when none). */
  conversationId: string | null;
  messageId: string | null;
  /** Human in the loop (old shape, kept for compatibility): answer with POST /api/c4/resume { sessionId, answers? }. */
  confirmation: C4ConfirmationDto | null;
  intent?: C4IntentDto;
  brief?: C4BriefDto;
  /** Review intents only: the review (null when it could not be written). */
  review?: { markdown: string } | null;
  /** Design discussion T1–T7 (null when it could not be written; absent when skipped). */
  discussion?: C4DiscussionDto | null;
  /** Artifacts this run created ("↩ Hỏi về cái này" chips). */
  artifacts?: C4ArtifactRef[];
  /** The critic's findings as readable sentences. */
  criticNotes?: string[];
}

export interface C4ConfirmationDto {
  sessionId: string;
  clarifications: C4Clarification[];
  /** Seconds left before the session expires. */
  expiresInSec: number;
}

export interface C4AnalysisDto {
  systemName: string;
  requirements: C4Requirement[];
  clarifications: C4Clarification[];
  knowledgeSources: string[];
}

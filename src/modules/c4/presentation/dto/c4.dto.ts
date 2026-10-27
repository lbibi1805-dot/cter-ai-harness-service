import type { AIProvider } from '../../../ai';
import type { C4Level, C4Requirement } from '../../domain';
import type { C4Clarification } from '../../application/interfaces/c4Sketch.interface';

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
  /** Human in the loop: the run paused; answer with POST /api/c4/resume { sessionId, answers? }. */
  confirmation: C4ConfirmationDto | null;
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

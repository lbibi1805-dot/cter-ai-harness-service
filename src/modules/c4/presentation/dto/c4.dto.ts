import type { AIProvider } from '../../../ai';
import type { C4Level, C4Requirement } from '../../domain';

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
}

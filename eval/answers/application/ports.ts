import type { GoldenItem } from '../../rag/domain';
import type { JudgeVerdict } from '../domain';

export interface JudgeInput {
  item: GoldenItem;
  answer: string;
  /** Authoritative course text for the expected sources ('' for unanswerable questions). */
  referenceText: string;
}

/** Grades one answer against the reference material and key points. */
export interface AnswerJudge {
  readonly model: string;
  judge(input: JudgeInput): Promise<JudgeVerdict>;
}

/** Loads the vault content of the expected sources (read-only). */
export interface ReferenceLoader {
  load(paths: string[]): Promise<string>;
}

export interface TextEmbedder {
  embed(text: string): Promise<number[]>;
}

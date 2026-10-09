import type { AnswerMode, AgentFallbackReason, AgentStopReason, TokenUsage } from '../../../src/modules/agent/domain';
import type { AnswerMetric, DriftStatus } from './answerEval.enums';

/** One answer produced by the system under test. */
export interface AnswerSample {
  questionId: string;
  mode: AnswerMode;
  repeat: number;
  text: string;
  model: string;
  latencyMs: number;
  error?: string;
  /** Mode that actually answered (an agent request may fall back to single-shot). */
  answeredBy?: AnswerMode;
  fallbackReason?: AgentFallbackReason;
  agent?: { toolCalls: number; stopReason: AgentStopReason; sourcesRead: string[]; usage: TokenUsage };
  citedSources: string[];
}

export interface JudgeClaim {
  text: string;
  supported: boolean;
}

/** Raw grading from the judge model — the scores are computed by us from these facts. */
export interface JudgeVerdict {
  claims: JudgeClaim[];
  /** One entry per golden key point, same order. */
  keyPointsCovered: boolean[];
  /** 1–5. */
  relevance: number;
  refused: boolean;
  notes: string;
}

export interface SampleScores {
  /** Supported claims / all claims — "precision of the answer". */
  answerPrecision: number | null;
  /** Covered key points / all key points — recall of what a complete answer needs. */
  completeness: number | null;
  f1: number | null;
  /** Relevance normalised to 0..1. */
  relevance: number | null;
  citationPrecision: number | null;
  citationRecall: number | null;
  /** True when it refused exactly when it should (unanswerable) and answered otherwise. */
  refusalCorrect: boolean | null;
}

export interface ScoredSample extends AnswerSample {
  verdict?: JudgeVerdict;
  judgeError?: string;
  scores: SampleScores;
}

export interface LatencyStats {
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

export interface ModeSummary {
  mode: AnswerMode;
  samples: number;
  metrics: Partial<Record<AnswerMetric, number | null>>;
  latency: LatencyStats | null;
  tokens: { meanInput: number; meanOutput: number } | null;
  meanToolCalls: number | null;
}

export interface EnvironmentSnapshot {
  vaultFiles: number | null;
  vaultIndexed: number | null;
  vectorCount: number | null;
  embeddingProvider: string;
  pineconeIndex: string;
}

export interface MetricDrift {
  mode: AnswerMode;
  metric: AnswerMetric;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  status: DriftStatus;
}

export interface QuestionDrift {
  questionId: string;
  mode: AnswerMode;
  f1Delta: number | null;
  /** Cosine similarity between the baseline and current answer text. */
  answerSimilarity: number | null;
  /** Jaccard overlap of the vault files read/cited. */
  sourcesOverlap: number | null;
  regressed: boolean;
  answerChanged: boolean;
}

export interface DriftReport {
  baselineLabel: string;
  baselineStartedAt: string;
  environment: { field: keyof EnvironmentSnapshot; baseline: unknown; current: unknown }[];
  metrics: MetricDrift[];
  questions: QuestionDrift[];
}

export interface AnswerEvalReport {
  label: string;
  startedAt: string;
  durationMs: number;
  settings: { answerModel: string; judgeModel: string; modes: AnswerMode[]; repeats: number; questionCount: number };
  environment: EnvironmentSnapshot;
  summaries: ModeSummary[];
  samples: ScoredSample[];
  drift?: DriftReport;
}

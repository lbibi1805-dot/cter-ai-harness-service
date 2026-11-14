import { ANSWER_METRICS_CAPACITY } from '../domain/constants/answerPlan.constants';
import type { AnswerMetricsSummary, AnswerTurnRecord } from '../domain/interfaces/answerPlan.interface';

function p95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil(0.95 * sorted.length))) - 1];
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Counters of the AnswerOrchestrator since start (`GET /api/metrics/latency` → `answers`, 12/11 plan 08 Bước 7).
 * RAM only, no database: totals plus a ring buffer of long-turn durations for the p95.
 */
export class AnswerMetrics {
  private turns = 0;
  private questions = 0;
  private sections = 0;
  private continuations = 0;
  private truncated = 0;
  private complete = 0;
  private outputTokens = 0;
  private outputTokenTurns = 0;
  private readonly longDurations: number[] = [];

  constructor(private readonly capacity: number = ANSWER_METRICS_CAPACITY) {}

  record(turn: AnswerTurnRecord): void {
    this.turns++;
    this.questions += turn.questions;
    this.sections += turn.sections;
    this.continuations += turn.continuations;
    if (turn.truncated) this.truncated++;
    if (!turn.truncated && turn.missing.length === 0) this.complete++;
    if (turn.outputTokens !== undefined) {
      this.outputTokens += turn.outputTokens;
      this.outputTokenTurns++;
    }
    if (turn.long) {
      this.longDurations.push(turn.durationMs);
      if (this.longDurations.length > this.capacity) this.longDurations.shift();
    }
  }

  summary(): AnswerMetricsSummary {
    return {
      turns: this.turns,
      questionsPerTurnAvg: this.turns ? round(this.questions / this.turns) : 0,
      sectionsTotal: this.sections,
      continuationsTotal: this.continuations,
      truncatedRemaining: this.truncated,
      completeRate: this.turns ? round(this.complete / this.turns, 4) : 0,
      outputTokensAvg: this.outputTokenTurns ? Math.round(this.outputTokens / this.outputTokenTurns) : 0,
      longTurnP95Ms: p95(this.longDurations),
    };
  }
}

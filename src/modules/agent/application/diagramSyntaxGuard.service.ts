import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { extractPlantUmlBlocks } from '../../../shared/text';
import { ProgressStage, type AnswerStream } from '../../ai';
import type { DiagramRepairer, DiagramValidator } from '../domain';
import { MIN_GUARD_TIME_MS } from './constants/diagramGuard.constants';
import type { DiagramGuardOutcome, DiagramGuardSettings, DiagramGuardStats } from './interfaces/diagramGuard.interface';

/**
 * Layer 3 of 12/11 plan 03 (§5): after an answer is written, render each PlantUML block; a block with a syntax
 * error gets at most DIAGRAM_SYNTAX_MAX_REPAIRS aux-model repairs, and a repaired block that renders replaces
 * the original. Anything that fails (renderer down, deadline, repair still broken) keeps the original text.
 * Not used by /c4 (its own repair agent builds the PlantUML from a spec).
 */
export class DiagramSyntaxGuard {
  private readonly totals: DiagramGuardStats = { answers: 0, blocks: 0, repairs: 0, repairFailed: 0, skipped: 0 };

  constructor(
    private readonly settings: DiagramGuardSettings,
    private readonly validator: DiagramValidator,
    private readonly repairer: DiagramRepairer | null,
    private readonly now: () => number = Date.now,
  ) {}

  get enabled(): boolean {
    return this.settings.enabled;
  }

  /** Counters since start (`GET /api/metrics/latency` → `diagramGuard`). */
  stats(): DiagramGuardStats {
    return { ...this.totals };
  }

  async check(text: string, deadlineAt: number, label: string, stream?: AnswerStream): Promise<DiagramGuardOutcome> {
    const blocks = this.settings.enabled ? [...new Set(extractPlantUmlBlocks(text))] : [];
    if (blocks.length === 0) return { text };
    const started = this.now();
    this.totals.answers++;
    this.totals.blocks += blocks.length;
    if (deadlineAt - started < MIN_GUARD_TIME_MS) {
      this.totals.skipped++;
      return { text, timings: { diagramBlocks: blocks.length, diagramValidateMs: 0 } };
    }
    stream?.progress?.({ stage: ProgressStage.VALIDATING_DIAGRAM });

    const fixes = await Promise.all(blocks.map((block) => this.fix(block, deadlineAt, label)));
    let result = text;
    let repairs = 0;
    let failed = 0;
    fixes.forEach((fix, i) => {
      if (fix === undefined) return;
      if (fix === null) {
        failed++;
        return;
      }
      result = result.replace(blocks[i], fix);
      repairs++;
    });
    this.totals.repairs += repairs;
    this.totals.repairFailed += failed;
    const timings = { diagramValidateMs: this.now() - started, diagramBlocks: blocks.length, diagramRepairs: repairs, diagramRepairFailed: failed };
    if (repairs || failed) logger.info(`[diagram-guard] ${label}: ${blocks.length} block(s), ${repairs} repaired, ${failed} still broken (${timings.diagramValidateMs}ms)`);
    return { text: result, timings };
  }

  /** undefined = renders (or could not be checked), null = broken and not repaired, string = repaired source. */
  private async fix(block: string, deadlineAt: number, label: string): Promise<string | null | undefined> {
    let source = block;
    let check = await attempt(() => this.validator.validate(source));
    if (!check.ok) {
      logger.warn(`[diagram-guard] ${label}: renderer failed, block kept as is: ${errorMessage(check.error)}`);
      return undefined;
    }
    if (check.value.ok) return undefined;
    if (!this.repairer) return null;
    for (let round = 0; round < this.settings.maxRepairs; round++) {
      if (deadlineAt - this.now() < MIN_GUARD_TIME_MS) return null;
      const error = check.value.error ?? 'syntax error';
      const repaired = await attempt(() => this.repairer!.repair({ source, error, line: check.ok ? check.value.line : undefined, deadlineAt, label }));
      if (!repaired.ok || !repaired.value?.trim()) return null;
      source = repaired.value.trim();
      check = await attempt(() => this.validator.validate(source));
      if (!check.ok) return null;
      if (check.value.ok) return source;
    }
    return null;
  }
}

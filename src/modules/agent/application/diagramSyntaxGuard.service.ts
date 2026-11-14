import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { extractPlantUmlBlocks } from '../../../shared/text';
import { ProgressStage, type AnswerStream } from '../../ai';
import type { DiagramCheck, DiagramConnectivityIssue, DiagramRepairer, DiagramValidator } from '../domain';
import { CONNECTIVITY_WARNING, MIN_GUARD_TIME_MS } from './constants/diagramGuard.constants';
import type { DiagramGuardOutcome, DiagramGuardSettings, DiagramGuardStats } from './interfaces/diagramGuard.interface';

/**
 * Layer 3 of 12/11 plan 03 (§5): after an answer is written, render each PlantUML block; a block with a syntax
 * error gets at most DIAGRAM_SYNTAX_MAX_REPAIRS aux-model repairs, and a repaired block that renders replaces
 * the original. Anything that fails (renderer down, deadline, repair still broken) keeps the original text.
 * 12/11 plan 04 §4.3: the validator also lints connectivity (orphan elements, split diagram, one-sided queue);
 * those errors share the same repair budget, and a block whose orphans could not be fixed gets a warning line
 * under it. Not used by /c4 (its own repair agent builds the PlantUML from a spec).
 */
export class DiagramSyntaxGuard {
  private readonly totals: DiagramGuardStats = {
    answers: 0, blocks: 0, repairs: 0, repairFailed: 0, skipped: 0, orphanFound: 0, orphanRepaired: 0, connectivityErrors: 0,
  };

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
      if (fix.orphanFound) this.totals.orphanFound++;
      if (fix.orphanRepaired) this.totals.orphanRepaired++;
      this.totals.connectivityErrors += fix.connectivityErrors;
      if (fix.failed) failed++;
      if (fix.replacement !== undefined) {
        result = result.replace(blocks[i], fix.replacement);
        repairs++;
      }
      if (fix.warning) result = appendAfterBlock(result, fix.replacement ?? blocks[i], fix.warning);
    });
    this.totals.repairs += repairs;
    this.totals.repairFailed += failed;
    const timings = { diagramValidateMs: this.now() - started, diagramBlocks: blocks.length, diagramRepairs: repairs, diagramRepairFailed: failed };
    if (repairs || failed) logger.info(`[diagram-guard] ${label}: ${blocks.length} block(s), ${repairs} repaired, ${failed} still broken (${timings.diagramValidateMs}ms)`);
    return { text: result, timings };
  }

  /**
   * One block: syntax and connectivity problems share DIAGRAM_SYNTAX_MAX_REPAIRS rounds. `replacement` = a repaired
   * source that renders (it may still carry connectivity errors); `failed` = still does not render; `warning` = a
   * line to put under the block when connectivity errors are left.
   */
  private async fix(block: string, deadlineAt: number, label: string): Promise<BlockFix> {
    const first = await attempt(() => this.validator.validate(block));
    if (!first.ok) {
      logger.warn(`[diagram-guard] ${label}: renderer failed, block kept as is: ${errorMessage(first.error)}`);
      return { connectivityErrors: 0 };
    }
    const initial = connectivityErrors(first.value);
    const outcome: BlockFix = { connectivityErrors: initial.length, orphanFound: initial.some(isOrphan) };
    if (first.value.ok && initial.length === 0) return outcome;

    let source = block;
    let check: DiagramCheck = first.value;
    let best: string | undefined;
    let bestCheck: DiagramCheck = first.value;
    for (let round = 0; this.repairer && round < this.settings.maxRepairs; round++) {
      if (deadlineAt - this.now() < MIN_GUARD_TIME_MS) break;
      const repaired = await attempt(() => this.repairer!.repair({ source, error: problemText(check), line: check.ok ? undefined : check.line, deadlineAt, label }));
      if (!repaired.ok || !repaired.value?.trim()) break;
      const next = await attempt(() => this.validator.validate(repaired.value!.trim()));
      if (!next.ok) break;
      source = repaired.value.trim();
      check = next.value;
      if (check.ok) {
        best = source;
        bestCheck = check;
      }
      if (check.ok && connectivityErrors(check).length === 0) break;
    }
    // A repair is only kept when it renders; otherwise the original stays (with its problems).
    const final = bestCheck;
    const left = connectivityErrors(final);
    if (best !== undefined) outcome.replacement = best;
    if (!final.ok) outcome.failed = true;
    if (outcome.orphanFound && !left.some(isOrphan)) outcome.orphanRepaired = true;
    if (final.ok && left.length > 0) outcome.warning = CONNECTIVITY_WARNING(left.map((i) => i.message));
    return outcome;
  }
}

/** What the guard did with one block. */
interface BlockFix {
  replacement?: string;
  failed?: boolean;
  warning?: string;
  orphanFound?: boolean;
  orphanRepaired?: boolean;
  connectivityErrors: number;
}

const ORPHAN_CODE = 'ORPHAN_ELEMENT';

function connectivityErrors(check: DiagramCheck): DiagramConnectivityIssue[] {
  return check.connectivity?.errors ?? [];
}

function isOrphan(issue: DiagramConnectivityIssue): boolean {
  return issue.code === ORPHAN_CODE;
}

/** The repairer's error text: the syntax error (if any), then each connectivity error. */
function problemText(check: DiagramCheck): string {
  const lines = [check.ok ? '' : check.error ?? 'syntax error', ...connectivityErrors(check).map((i) => `${i.code}: ${i.message}`)];
  return lines.filter(Boolean).join('\n');
}

/** Puts `line` after the fenced block whose body is `body` (the first fence that contains it). */
function appendAfterBlock(text: string, body: string, line: string): string {
  const at = text.indexOf(body);
  if (at < 0) return `${text}\n\n${line}`;
  const fenceEnd = text.indexOf('```', at + body.length);
  if (fenceEnd < 0) return `${text}\n\n${line}`;
  const lineEnd = text.indexOf('\n', fenceEnd);
  const cut = lineEnd < 0 ? text.length : lineEnd;
  return `${text.slice(0, cut)}\n\n${line}${text.slice(cut)}`;
}

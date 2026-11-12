import { formatAnswerForClient } from '../../../shared/text';
import { DEFAULT_CHAT_DEADLINE_MS } from '../../ai';
import type { Answerer, AnswerRequest, AnswerResult } from '../domain';
import type { DiagramSyntaxGuard } from './diagramSyntaxGuard.service';

/**
 * Answerer for clients that render the Markdown themselves (chat API + Canvas
 * conversation replies): the FINAL text is math-normalized (strict `$…$` / `$$…$$`)
 * and Mermaid fences are sanitized. Streaming deltas stay raw — the client
 * normalizes them itself. The file Q&A job (PDF) keeps the raw answerer.
 * With a diagram guard (12/11 plan 03 §5), PlantUML blocks with a syntax error are repaired before `done`;
 * the client replaces the streamed text with this final text, so no new stream event is needed.
 */
export class ClientAnswerService implements Answerer {
  constructor(
    private readonly inner: Answerer,
    private readonly guard: DiagramSyntaxGuard | null = null,
    private readonly now: () => number = Date.now,
  ) {}

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    const startedAt = this.now();
    const result = await this.inner.answer(request);
    const text = formatAnswerForClient(result.text);
    if (!this.guard?.enabled) return { ...result, text };
    const deadlineAt = request.deadlineAt ?? startedAt + DEFAULT_CHAT_DEADLINE_MS;
    const checked = await this.guard.check(text, deadlineAt, request.label, request.stream);
    if (!checked.timings) return { ...result, text };
    return { ...result, text: checked.text, ...(result.timings ? { timings: { ...result.timings, ...checked.timings } } : {}) };
  }
}

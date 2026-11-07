import { formatAnswerForClient } from '../../../shared/text';
import type { Answerer, AnswerRequest, AnswerResult } from '../domain';

/**
 * Answerer for clients that render the Markdown themselves (chat API + Canvas
 * conversation replies): the FINAL text is math-normalized (strict `$…$` / `$$…$$`)
 * and Mermaid fences are sanitized. Streaming deltas stay raw — the client
 * normalizes them itself. The file Q&A job (PDF) keeps the raw answerer.
 */
export class ClientAnswerService implements Answerer {
  constructor(private readonly inner: Answerer) {}

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    const result = await this.inner.answer(request);
    return { ...result, text: formatAnswerForClient(result.text) };
  }
}

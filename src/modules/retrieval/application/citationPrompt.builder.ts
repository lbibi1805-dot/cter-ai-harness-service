import type { CitationPrompt, CitedChunk } from '../domain/interfaces/retrieval.interface';
import { CITATION_RULES, DOLLAR_WRAPPED_MD_FILE, SOURCE_SEPARATOR, DOLLAR_WRAPPED_FILE_NAME, PERCENT, CONTEXT_OPEN_TAG, CONTEXT_CLOSE_TAG, TRAILING_REFERENCES_SECTION } from './constants/citationPrompt.constants';

/** Drops a trailing `## References` / `## Sources` / `## Nguồn` / `## Tài liệu tham khảo` section (clients list sources themselves). */
export function stripTrailingReferences(response: string): string {
  const stripped = response.replace(TRAILING_REFERENCES_SECTION, '');
  return stripped === response ? response : stripped.trimEnd();
}

/** Puts retrieved chunks in front of the question and adds the citation rules to the system prompt. */
export class CitationPromptBuilder {
  build(baseSystemPrompt: string, chunks: CitedChunk[], question: string): CitationPrompt {
    const contextBlock = this.formatContext(chunks);
    return {
      systemPrompt: `${baseSystemPrompt}\n\n${CITATION_RULES}`,
      userContent: contextBlock ? `${contextBlock}\n\n${question}` : question,
    };
  }

  /** Unwraps `$$file.md$$` citations the model was told not to write and drops a trailing References section. */
  cleanResponse(response: string): string {
    return stripTrailingReferences(response)
      .replace(DOLLAR_WRAPPED_MD_FILE, (_, inner: string) => inner.trim())
      .replace(DOLLAR_WRAPPED_FILE_NAME, (_, inner: string) => inner.trim());
  }

  private formatContext(chunks: CitedChunk[]): string {
    if (chunks.length === 0) return '';
    const parts = chunks.map((chunk, i) => {
      const relevance = chunk.score !== undefined ? ` (relevance: ${(chunk.score * PERCENT).toFixed(0)}%)` : '';
      return [`📄 SOURCE [${i + 1}]: ${chunk.source} > ${chunk.heading}${relevance}`, SOURCE_SEPARATOR, chunk.text].join('\n');
    });
    return `${CONTEXT_OPEN_TAG}\n${parts.join('\n\n')}\n${CONTEXT_CLOSE_TAG}`;
  }
}

import type { CitedChunk } from '../../../../types';
import { AgentToolName, stringArg, type AgentTool, type ToolResult } from '../../domain';

/** Port over RAGRetriever so the tool can be tested without Pinecone. */
export interface VaultSearcher {
  search(query: string): Promise<CitedChunk[]>;
}

export const SEARCH_RESULTS_SHOWN = 5;

export class VaultSearchTool implements AgentTool {
  readonly name = AgentToolName.SEARCH_VAULT;
  readonly description = 'Semantic search over the course document vault. Returns the most relevant passages with their file path and heading.';
  readonly parameters = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to look for. Try Vietnamese and English phrasings if the first search misses.' },
      folder: { type: 'string', description: 'Optional vault folder prefix to restrict results, e.g. "mon-qnx-current/lab-4".' },
    },
    required: ['query'],
    additionalProperties: false,
  };

  constructor(private readonly searcher: VaultSearcher) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = stringArg(args, 'query');
    if (!query) throw new Error('"query" is required');
    const folder = stringArg(args, 'folder');

    const chunks = (await this.searcher.search(query))
      .filter((c) => !folder || c.source === folder || c.source.startsWith(`${folder}/`))
      .slice(0, SEARCH_RESULTS_SHOWN);
    if (chunks.length === 0) {
      return { content: `No passages found for "${query}"${folder ? ` in ${folder}` : ''}. Try other keywords or the other language.`, sources: [] };
    }

    const content = chunks
      .map((c, i) => [
        `[${i + 1}] file: ${c.source} | heading: ${c.heading || '(none)'} | relevance: ${((c.score ?? 0) * 100).toFixed(0)}%`,
        c.text.trim(),
      ].join('\n'))
      .join('\n\n---\n\n');
    return { content, sources: [...new Set(chunks.map((c) => c.source))] };
  }
}

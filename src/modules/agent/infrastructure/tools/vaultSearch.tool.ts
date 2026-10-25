import {
  AgentToolName,
  InvalidToolArgumentsError,
  SEARCH_RESULTS_SHOWN,
  stringArg,
  type AgentTool,
  type ToolResult,
} from '../../domain';
import { VaultSearcher } from '../interfaces/vaultSearch.interface';
import { PERCENT, RESULT_SEPARATOR } from '../constants/vaultSearch.constants';

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
    if (!query) throw new InvalidToolArgumentsError('"query" is required');
    const folder = stringArg(args, 'folder');

    const chunks = (await this.searcher.search(query))
      .filter((chunk) => !folder || chunk.source === folder || chunk.source.startsWith(`${folder}/`))
      .slice(0, SEARCH_RESULTS_SHOWN);
    if (chunks.length === 0) {
      return { content: `No passages found for "${query}"${folder ? ` in ${folder}` : ''}. Try other keywords or the other language.`, sources: [] };
    }

    const content = chunks
      .map((chunk, i) => [
        `[${i + 1}] file: ${chunk.source} | heading: ${chunk.heading || '(none)'} | relevance: ${((chunk.score ?? 0) * PERCENT).toFixed(0)}%`,
        chunk.text.trim(),
      ].join('\n'))
      .join(RESULT_SEPARATOR);
    return { content, sources: [...new Set(chunks.map((chunk) => chunk.source))], contexts: chunks };
  }
}

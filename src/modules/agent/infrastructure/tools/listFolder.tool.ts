import type { VaultRepository } from '../../../vault';
import { AgentToolName, stringArg, type AgentTool, type ToolResult } from '../../domain';

export const MAX_LISTED_ITEMS = 60;

/** Discovery only: listings are not evidence, so they add no citable sources. */
export class ListFolderTool implements AgentTool {
  readonly name = AgentToolName.LIST_FOLDER;
  readonly description = 'List vault folders (no argument) or the files inside one folder.';
  readonly parameters = {
    type: 'object',
    properties: {
      folder: { type: 'string', description: 'Folder path to list files from. Omit to list all folders.' },
    },
    additionalProperties: false,
  };

  constructor(private readonly repository: Pick<VaultRepository, 'listFolders' | 'findByFolder'>) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const folder = stringArg(args, 'folder');
    if (!folder) {
      const folders = await this.repository.listFolders();
      return { content: limited(folders.map((f) => `${f.path} (${f.fileCount} files)`), 'folders'), sources: [] };
    }
    const files = await this.repository.findByFolder(folder);
    if (files.length === 0) return { content: `Folder "${folder}" is empty or does not exist. Call list_folder without arguments to see all folders.`, sources: [] };
    return { content: limited(files.map((f) => f.filePath), 'files'), sources: [] };
  }
}

function limited(lines: string[], noun: string): string {
  const shown = lines.slice(0, MAX_LISTED_ITEMS);
  const more = lines.length > shown.length ? `\n…and ${lines.length - shown.length} more ${noun}` : '';
  return shown.join('\n') + more;
}

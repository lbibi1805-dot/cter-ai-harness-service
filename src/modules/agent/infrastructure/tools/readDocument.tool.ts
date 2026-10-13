import type { VaultRepository } from '../../../vault';
import { AgentToolName, stringArg, type AgentTool, type ToolResult } from '../../domain';

const HEADING_LINE = /^(#{1,6})\s+(.*)$/;

/**
 * Returns the section that starts at the first heading containing `heading`
 * (case-insensitive) and ends before the next heading of the same or a higher
 * level. Null when no heading matches.
 */
export function extractSection(markdown: string, heading: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const needle = heading.toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(HEADING_LINE);
    return match !== null && match[2].toLowerCase().includes(needle);
  });
  if (start === -1) return null;

  const level = lines[start].match(HEADING_LINE)![1].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(HEADING_LINE);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

export function listHeadings(markdown: string): string[] {
  return markdown.split(/\r?\n/).map((line) => line.match(HEADING_LINE)?.[2]?.trim()).filter((h): h is string => !!h);
}

/** Reads vault content from the manifest store (Neon) — never from the filesystem. */
export class ReadDocumentTool implements AgentTool {
  readonly name = AgentToolName.READ_DOCUMENT;
  readonly description = 'Read a vault file, or only one of its sections by heading. Use the exact file path returned by search_vault or list_folder.';
  readonly parameters = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Vault file path, e.g. "mon-qnx-current/lab-4/Barriers.md".' },
      heading: { type: 'string', description: 'Optional heading text; returns only that section.' },
    },
    required: ['path'],
    additionalProperties: false,
  };

  constructor(private readonly repository: Pick<VaultRepository, 'findByPath'>) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = stringArg(args, 'path');
    if (!filePath) throw new Error('"path" is required');
    const entry = await this.repository.findByPath(filePath);
    if (!entry || !entry.content.trim()) {
      return { content: `File not found in the vault: "${filePath}". Use search_vault or list_folder to find valid paths.`, sources: [] };
    }

    const heading = stringArg(args, 'heading');
    if (heading) {
      const section = extractSection(entry.content, heading);
      if (section) return { content: `file: ${filePath} | section: ${heading}\n\n${section}`, sources: [filePath] };
      const available = listHeadings(entry.content).slice(0, 30).join(' | ') || '(no headings)';
      return { content: `Heading "${heading}" not found in ${filePath}. Available headings: ${available}`, sources: [] };
    }
    return { content: `file: ${filePath}\n\n${entry.content}`, sources: [filePath] };
  }
}

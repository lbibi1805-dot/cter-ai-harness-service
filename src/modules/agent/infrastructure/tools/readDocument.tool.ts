import {
  AgentToolName,
  InvalidToolArgumentsError,
  MAX_HEADINGS_SUGGESTED,
  stringArg,
  type AgentTool,
  type ToolResult,
} from '../../domain';
import { readContext, extractSection, listHeadings } from '../helpers/readDocument.helper';

/** Where `read_document` gets file content (the vault: manifest lookup + object storage). */
export interface VaultDocumentSource {
  /** Null when the file does not exist (or has no stored content). */
  readDocument(filePath: string): Promise<string | null>;
}

/** Reads vault content through the vault service (object storage) — never from the local filesystem. */
export class ReadDocumentTool implements AgentTool {
  readonly name = AgentToolName.READ_DOCUMENT;
  readonly referenceMaterial = true;
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

  constructor(private readonly documents: VaultDocumentSource) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = stringArg(args, 'path');
    if (!filePath) throw new InvalidToolArgumentsError('"path" is required');
    const content = await this.documents.readDocument(filePath);
    if (!content || !content.trim()) {
      return { content: `File not found in the vault: "${filePath}". Use search_vault or list_folder to find valid paths.`, sources: [] };
    }

    const heading = stringArg(args, 'heading');
    if (!heading) {
      return { content: `file: ${filePath}\n\n${content}`, sources: [filePath], contexts: [readContext(filePath, '', content)] };
    }
    const section = extractSection(content, heading);
    if (!section) {
      const available = listHeadings(content).slice(0, MAX_HEADINGS_SUGGESTED).join(' | ') || '(no headings)';
      return { content: `Heading "${heading}" not found in ${filePath}. Available headings: ${available}`, sources: [] };
    }
    return { content: `file: ${filePath} | section: ${heading}\n\n${section}`, sources: [filePath], contexts: [readContext(filePath, heading, section)] };
  }
}

import { AGENT_FILE_SUFFIX, AnswerMode } from '../modules/agent/domain/agent.enums';
import type { AIProviderName, ParsedFileName } from '../types';

const FILE_PATTERN = /^START_(.+)_(claude|gemini|grok|openai)(?:_(.+))?(\.[^.]+)$/i;
/** `_agent` right before the extension opts the file into agent mode. */
const AGENT_MARKER = new RegExp(`${AGENT_FILE_SUFFIX}(\\.[^.]+)$`, 'i');

export function parseFileName(name: string): ParsedFileName | null {
  const isAgent = AGENT_MARKER.test(name);
  const core = isAgent ? name.replace(AGENT_MARKER, '$1') : name;
  const match = core.match(FILE_PATTERN);
  if (!match) return null;
  const [, , provider, model, extension] = match;
  return {
    originalName: name,
    provider: provider.toLowerCase() as AIProviderName,
    model: model ?? undefined,
    extension,
    doneFileName: name.replace(extension, '_DONE.pdf'),
    mode: isAgent ? AnswerMode.AGENT : AnswerMode.SINGLE_SHOT,
  };
}

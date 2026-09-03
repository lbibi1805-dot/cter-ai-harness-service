import type { AIProviderName, ParsedFileName } from '../types';

const FILE_PATTERN = /^START_(.+)_(claude|gemini|grok|openai)(?:_(.+))?(\.[^.]+)$/i;

export function parseFileName(name: string): ParsedFileName | null {
  const match = name.match(FILE_PATTERN);
  if (!match) return null;
  const [, , provider, model, extension] = match;
  return {
    originalName: name,
    provider: provider.toLowerCase() as AIProviderName,
    model: model ?? undefined,
    extension,
    doneFileName: name.replace(extension, '_DONE.pdf'),
  };
}

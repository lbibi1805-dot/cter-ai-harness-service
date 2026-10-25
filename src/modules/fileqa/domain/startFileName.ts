import { AnswerMode } from '../../agent/domain/enums/agent.enums';
import { type AIProvider } from '../../ai/domain/enums/ai.enums';
import { DONE_FILE_SUFFIX } from './constants/fileqa.constants';
import { ParsedFileName } from './interfaces/startFileName.interface';
import { AGENT_MARKER, FILE_PATTERN } from './constants/startFileName.constants';

export function parseFileName(name: string): ParsedFileName | null {
  const isAgent = AGENT_MARKER.test(name);
  const core = isAgent ? name.replace(AGENT_MARKER, '$1') : name;
  const match = core.match(FILE_PATTERN);
  if (!match) return null;
  const [, , provider, model, extension] = match;
  return {
    originalName: name,
    provider: provider.toLowerCase() as AIProvider,
    model: model ?? undefined,
    extension,
    doneFileName: name.replace(extension, DONE_FILE_SUFFIX),
    mode: isAgent ? AnswerMode.AGENT : AnswerMode.SINGLE_SHOT,
  };
}

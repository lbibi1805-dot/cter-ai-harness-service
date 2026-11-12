import { stripGeneratedHeader } from '../config/readers/promptConfig.reader';
import { GENERATED_PROMPT_HEADER, SYSTEM_PROMPT_FILE } from '../constants/bootstrap.constants';
import { readProjectFile } from '../helpers/config.helper';

/** system-prompt.md content for a registry composition (written by `npm run prompts:legacy`). */
export function legacyPromptText(systemPrompt: string): string {
  return `${GENERATED_PROMPT_HEADER}\n\n${systemPrompt}\n`;
}

/** True when system-prompt.md (the rollback copy, PROMPT_REGISTRY_ENABLED=false) equals the registry composition. */
export function legacyPromptInSync(systemPrompt: string): boolean {
  return stripGeneratedHeader(readProjectFile(SYSTEM_PROMPT_FILE)) === systemPrompt.trim();
}

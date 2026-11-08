import * as path from 'path';
import { createPromptRegistry, hasPromptRegistry, shortHash } from '../../../modules/prompts';
import { readBoolean, readString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';
import { DEFAULT_PROMPTS_DIR, DEFAULT_SYSTEM_PROMPT, KNOWLEDGE_FILE, SYSTEM_PROMPT_FILE } from '../../constants/bootstrap.constants';
import { readProjectFile } from '../../helpers/config.helper';
import type { PromptConfig } from '../../interfaces/appConfig.interface';

/**
 * The static system prompt (layer ①): composed by the PromptRegistry from `prompts/` (PROMPTS_DIR) when
 * PROMPT_REGISTRY_ENABLED (default: on when `prompts/core/system.md` exists), else system-prompt.md as before.
 * A malformed prompt file fails startup.
 */
export function readPromptConfig(): PromptConfig {
  const knowledgeContent = readProjectFile(KNOWLEDGE_FILE);
  const rootDir = path.resolve(process.cwd(), readString('PROMPTS_DIR', DEFAULT_PROMPTS_DIR));
  const available = hasPromptRegistry(rootDir);
  if (!readBoolean('PROMPT_REGISTRY_ENABLED', available)) {
    const systemPrompt = readProjectFile(SYSTEM_PROMPT_FILE) || DEFAULT_SYSTEM_PROMPT;
    return { systemPrompt, knowledgeContent, promptVersion: shortHash(systemPrompt), registry: null };
  }
  if (!available) throw new ConfigurationError(`PROMPT_REGISTRY_ENABLED=true but ${rootDir} has no core/system.md`);
  const registry = createPromptRegistry(rootDir);
  return { systemPrompt: registry.systemPrompt, knowledgeContent, promptVersion: registry.promptVersion, registry };
}

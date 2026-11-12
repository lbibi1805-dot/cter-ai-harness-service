import * as path from 'path';
import { PromptId, REMINDER_FALLBACK, createPromptRegistry, hasPromptRegistry, shortHash } from '../../../modules/prompts';
import { readBoolean, readString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';
import { DEFAULT_PROMPTS_DIR, DEFAULT_SYSTEM_PROMPT, GENERATED_PROMPT_HEADER, KNOWLEDGE_FILE, SYSTEM_PROMPT_FILE } from '../../constants/bootstrap.constants';
import { readProjectFile } from '../../helpers/config.helper';
import type { PromptConfig } from '../../interfaces/appConfig.interface';

/** system-prompt.md without its first-line "generated" marker (the marker is for humans, not the model). */
export function stripGeneratedHeader(text: string): string {
  return text.startsWith(GENERATED_PROMPT_HEADER) ? text.slice(GENERATED_PROMPT_HEADER.length).trim() : text;
}

/**
 * The static system prompt (layer ①): composed by the PromptRegistry from `prompts/` (PROMPTS_DIR) when
 * PROMPT_REGISTRY_ENABLED (default: on when `prompts/core/system.md` exists), else system-prompt.md
 * (generated from the registry by `npm run prompts:legacy`, the rollback copy). A malformed prompt file fails startup.
 * Every other instruction text (reminder, research mode, /c4 shared rules, diagram syntax) also comes from `prompts/`;
 * without the registry the built-in copies are used (reminder, research mode) or the feature has none (/c4 shared rules).
 */
export function readPromptConfig(): PromptConfig {
  const knowledgeContent = readProjectFile(KNOWLEDGE_FILE);
  const rootDir = path.resolve(process.cwd(), readString('PROMPTS_DIR', DEFAULT_PROMPTS_DIR));
  const available = hasPromptRegistry(rootDir);
  if (!readBoolean('PROMPT_REGISTRY_ENABLED', available)) {
    const systemPrompt = stripGeneratedHeader(readProjectFile(SYSTEM_PROMPT_FILE)) || DEFAULT_SYSTEM_PROMPT;
    return {
      systemPrompt, knowledgeContent, promptVersion: shortHash(systemPrompt), registry: null,
      reminder: REMINDER_FALLBACK, researchMode: null, c4Rules: null, diagramSyntax: null,
    };
  }
  if (!available) throw new ConfigurationError(`PROMPT_REGISTRY_ENABLED=true but ${rootDir} has no core/system.md`);
  const registry = createPromptRegistry(rootDir);
  return {
    systemPrompt: registry.systemPrompt,
    knowledgeContent,
    promptVersion: registry.promptVersion,
    registry,
    reminder: registry.policy(PromptId.REMINDER)?.body ?? REMINDER_FALLBACK,
    researchMode: registry.skill(PromptId.RESEARCH_MODE)?.body ?? null,
    c4Rules: registry.c4Rules() || null,
    diagramSyntax: registry.policy(PromptId.DIAGRAM_SYNTAX)?.body ?? null,
  };
}

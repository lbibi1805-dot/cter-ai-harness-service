import { PromptRegistry } from './application/promptRegistry';
import { readPromptFiles } from './infrastructure/promptFile.loader';

/** Loads and validates `rootDir` (e.g. `prompts/`); throws ConfigurationError on a bad file (fail fast at startup). */
export function createPromptRegistry(rootDir: string): PromptRegistry {
  return new PromptRegistry(readPromptFiles(rootDir));
}

export { PromptRegistry, layerEntry } from './application/promptRegistry';
export { hasPromptRegistry, readPromptFiles } from './infrastructure/promptFile.loader';
export { EvalKind, PromptKind, PromptPath } from './domain/enums/prompt.enums';
export { PromptId, COMPOSED_PATHS } from './domain/constants/promptIds.constants';
export { PROMPT_HASH_LENGTH } from './domain/constants/prompt.constants';
export { matchesPattern, shortHash } from './domain/helpers/frontmatter.helper';
export type { DomainPrompt, PromptFile, PromptFrontmatter, PromptLayerEntry, PromptListEntry, RawPromptFile, SkillPrompt } from './domain/interfaces/prompt.interface';
export { scoreGoldenCase, mean } from './domain/helpers/goldenEval.helper';
export type { GoldenAnswer, GoldenCase, GoldenRunSummary, GoldenScore } from './domain/interfaces/goldenEval.interface';
export { listEvalResults } from './infrastructure/evalResults.reader';
export { EVAL_RESULTS_DIR } from './domain/constants/goldenEval.constants';
export type { EvalResultEntry } from './domain/interfaces/goldenEval.interface';
export { REMINDER_FALLBACK } from './domain/constants/promptFallback.constants';

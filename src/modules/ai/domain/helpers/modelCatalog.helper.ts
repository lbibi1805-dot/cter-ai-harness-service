import { AIProvider, OpenAIApiMode } from '../enums/ai.enums';
import { DIRECT_ALLOWED_MODELS, OPENAI_RESPONSES_MODELS } from '../constants/modelCatalog.constants';

/** API mode of a direct OpenAI model; null for other providers and unknown models. */
export function getOpenAIApiMode(provider: AIProvider, model: string): OpenAIApiMode | null {
  if (provider !== AIProvider.OPENAI) return null;
  if (!DIRECT_ALLOWED_MODELS[AIProvider.OPENAI].includes(model)) return null;
  return OPENAI_RESPONSES_MODELS.has(model) ? OpenAIApiMode.RESPONSES : OpenAIApiMode.CHAT_COMPLETIONS;
}

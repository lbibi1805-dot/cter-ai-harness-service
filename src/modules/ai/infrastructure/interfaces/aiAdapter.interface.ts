import { AIProvider, ModelRoute } from '../../domain/enums/ai.enums';

export interface KeyValidationResult {
  provider: AIProvider | ModelRoute.OPENROUTER;
  ok: boolean;
  error?: string;
}

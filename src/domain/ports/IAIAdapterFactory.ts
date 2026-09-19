import type { AppConfig } from '../../types';
import type { AIProviderName } from '../enums/AIProviderName';
import type { IAIAdapter } from './IAIAdapter';

export interface KeyValidationResult {
  provider: AIProviderName;
  ok: boolean;
  error?: string;
}

export interface IAIAdapterFactory {
  create(provider: AIProviderName, aiKeys: AppConfig['aiKeys'], grokBaseUrl: string): IAIAdapter;
  validateAll(aiKeys: AppConfig['aiKeys'], grokBaseUrl: string): Promise<KeyValidationResult[]>;
  resolveModel(provider: AIProviderName, modelFromFileName: string | undefined, defaultModels: AppConfig['defaultModels']): string;
}

import { getModelApiMode } from '../../config/allowedModels';
import type { AIProviderName } from '../enums/AIProviderName';

export class ModelChainResolver {
  static buildChain(provider: AIProviderName, primaryModel: string, fallbackList: string[]): string[] {
    const chain: string[] = [primaryModel];
    const primaryMode = getModelApiMode(provider, primaryModel);
    for (const fb of fallbackList) {
      if (fb !== primaryModel && !chain.includes(fb) && (provider !== 'openai' || getModelApiMode(provider, fb) === primaryMode)) {
        chain.push(fb);
      }
    }
    return chain;
  }
}

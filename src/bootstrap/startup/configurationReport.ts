import { AI_PROVIDERS, type AiModule } from '../../modules/ai';
import { logger } from '../../shared/logging/logger';
import type { AppConfig } from '../interfaces/appConfig.interface';

/** Logs which AI routes are usable per provider, and warns about providers no route can serve. */
export function logConfiguration(config: AppConfig, ai: AiModule): void {
  const routes = AI_PROVIDERS.map((provider) => {
    const direct = ai.adapters.direct(provider) !== null;
    const openRouter = ai.adapters.openRouter(provider) !== null;
    return `${provider}=${[direct && 'direct', openRouter && 'openrouter'].filter(Boolean).join('+') || 'none'}`;
  }).join(' ');
  logger.info(`Config loaded — AI routes: ${routes} | vault=${config.retrieval?.pineconeIndex ?? 'none'}`);
  for (const provider of AI_PROVIDERS) {
    if (!ai.configuredAdapters.isConfigured(provider)) logger.warn(`${ai.adapters.credentialName(provider)} not set — ${provider} requests will fail`);
  }
}

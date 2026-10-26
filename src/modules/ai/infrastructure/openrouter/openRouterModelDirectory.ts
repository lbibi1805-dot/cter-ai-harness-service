import type OpenAI from 'openai';
import { errorMessage } from '../../../../shared/errors';
import { logger } from '../../../../shared/logging/logger';
import { attempt } from '../../../../shared/resilience/attempt';
import { OpenRouterModel } from '../interfaces/openRouterModelDirectory.interface';
import { TOOLS_PARAMETER } from '../constants/openRouterModelDirectory.constants';

/**
 * Answers "can this OpenRouter model call tools?" from `GET /models`, loaded
 * once. When the listing cannot be fetched every model is assumed capable:
 * the agent then fails per request and falls back to single-shot.
 */
export class OpenRouterModelDirectory {
  private toolModels: Promise<ReadonlySet<string> | null> | null = null;

  constructor(private readonly client: OpenAI) {}

  async supportsTools(model: string): Promise<boolean> {
    const toolModels = await this.loadToolModels();
    return toolModels === null || toolModels.has(model);
  }

  private loadToolModels(): Promise<ReadonlySet<string> | null> {
    this.toolModels ??= this.fetchToolModels();
    return this.toolModels;
  }

  private async fetchToolModels(): Promise<ReadonlySet<string> | null> {
    const listing = await attempt(async () => {
      const ids = new Set<string>();
      for await (const model of this.client.models.list()) {
        const described = model as unknown as OpenRouterModel;
        if (described.supported_parameters?.includes(TOOLS_PARAMETER)) ids.add(described.id);
      }
      return ids;
    });
    if (listing.ok) return listing.value;
    logger.warn(`[openrouter] model listing failed (${errorMessage(listing.error)}) — assuming every model supports tools`);
    return null;
  }
}

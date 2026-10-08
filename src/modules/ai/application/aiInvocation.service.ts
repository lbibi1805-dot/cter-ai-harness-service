import { createAIAdapter } from '../../../ai/aiRouter';
import {
  DEFAULT_BACKOFF,
  FailureKind,
  backoffDelayMs,
  classifyFailure,
  errorMessage,
  sleep as realSleep,
  type BackoffOptions,
  type Sleep,
} from '../../../shared/resilience';
import type { AIAdapter, AIProviderName, AppConfig, FileContent } from '../../../types';
import { logger } from '../../../utils/logger';
import { withTimeout } from '../../../utils/withTimeout';
import { AIInvocationError } from '../domain/aiInvocationError';
import { buildModelChain } from '../domain/modelChain';
import type { PromptPreparer } from './promptPreparer';

/** A rate-limited model gets this many tries before the chain moves on. */
export const RATE_LIMIT_ATTEMPTS_PER_MODEL = 2;

export type AIInvocationSettings = Pick<AppConfig, 'aiKeys' | 'grokBaseUrl' | 'modelFallback' | 'maxRetryCount' | 'aiTimeoutMs'>;

export type AdapterFactory = (provider: AIProviderName, aiKeys: AppConfig['aiKeys'], grokBaseUrl: string) => AIAdapter;

export interface AIInvocationDeps {
  createAdapter?: AdapterFactory;
  sleep?: Sleep;
  backoff?: BackoffOptions;
}

export interface AIRequest {
  provider: AIProviderName;
  /** Already resolved (filename/request model or the provider default). */
  model: string;
  content: FileContent;
  /** Shown in logs, e.g. the file name or conversation key. */
  label: string;
}

export interface AIAnswer {
  text: string;
  model: string;
  attempts: number;
}

/**
 * Single entry point for AI calls from every flow. The prompt is prepared once;
 * each model is retried with exponential backoff; rate limits and permanent
 * errors move on to the next fallback model; fatal errors stop immediately.
 */
export class AIInvocationService {
  private readonly createAdapter: AdapterFactory;
  private readonly sleep: Sleep;
  private readonly backoff: BackoffOptions;

  constructor(
    private readonly settings: AIInvocationSettings,
    private readonly prompts: PromptPreparer,
    deps: AIInvocationDeps = {},
  ) {
    this.createAdapter = deps.createAdapter ?? createAIAdapter;
    this.sleep = deps.sleep ?? realSleep;
    this.backoff = deps.backoff ?? DEFAULT_BACKOFF;
  }

  async answer(request: AIRequest): Promise<AIAnswer> {
    const chain = buildModelChain(request.provider, request.model, this.settings.modelFallback[request.provider] ?? []);

    let adapter: AIAdapter;
    try {
      adapter = this.createAdapter(request.provider, this.settings.aiKeys, this.settings.grokBaseUrl);
    } catch (err) {
      throw new AIInvocationError(errorMessage(err), FailureKind.FATAL, 0, chain[0]);
    }

    const prompt = await this.prompts.prepare(request.content);
    let attempts = 0;
    let lastError: unknown;
    let lastKind = FailureKind.TRANSIENT;

    for (let mi = 0; mi < chain.length; mi++) {
      const model = chain[mi];
      for (let attemptOnModel = 1; ; attemptOnModel++) {
        attempts++;
        logger.ai(request.provider, model, request.label);
        try {
          const raw = await withTimeout(
            adapter.process(prompt.content, prompt.systemPrompt, model),
            this.settings.aiTimeoutMs,
            `${request.provider}/${model}`,
          );
          return { text: this.prompts.cleanResponse(raw), model, attempts };
        } catch (err) {
          lastError = err;
          lastKind = classifyFailure(err);
          if (lastKind === FailureKind.FATAL) {
            throw new AIInvocationError(errorMessage(err), lastKind, attempts, model);
          }
          if (lastKind === FailureKind.PERMANENT || attemptOnModel >= this.attemptLimit(lastKind)) {
            const next = chain[mi + 1];
            if (next) logger.fallback(request.provider, model, next, request.label, `${lastKind}: ${errorMessage(err)}`);
            break;
          }
          const delayMs = backoffDelayMs(attemptOnModel - 1, this.backoff);
          logger.retry(attemptOnModel, this.attemptLimit(lastKind), request.label, `${lastKind}, retry in ${delayMs}ms: ${errorMessage(err)}`);
          await this.sleep(delayMs);
        }
      }
    }

    throw new AIInvocationError(errorMessage(lastError), lastKind, attempts, chain[chain.length - 1]);
  }

  private attemptLimit(kind: FailureKind): number {
    const perModel = this.settings.maxRetryCount + 1;
    return kind === FailureKind.RATE_LIMITED ? Math.min(RATE_LIMIT_ATTEMPTS_PER_MODEL, perModel) : perModel;
  }
}

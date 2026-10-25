import { InvalidJsonError, PayloadTooLargeError, readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/http.enums';
import { sendError, sendJson } from '../../../shared/http/response';
import type { RouteContext } from '../../../shared/http/router';
import { errorMessage } from '../../../shared/resilience';
import type { AppConfig } from '../../../types';
import { logger } from '../../../utils/logger';
import type { Answerer } from '../../agent/domain';
import { ALLOWED_MODELS } from '../../../config/allowedModels';
import { MAX_CHAT_BODY_BYTES, toChatQuestion } from './chat.dto';

export interface ChatControllerOptions {
  /** False when CHAT_API_TOKEN is unset: every route answers 503. */
  enabled: boolean;
  agentEnabled: boolean;
  aiKeys: AppConfig['aiKeys'];
  defaultModels: AppConfig['defaultModels'];
}

/**
 * Direct chat for clients that talk to the backend over HTTP instead of a
 * Canvas conversation. Same answer pipeline (RAG, model fallback, agent mode)
 * as the conversation poller; nothing is written to Canvas or the state file.
 */
export class ChatController {
  private sequence = 0;

  constructor(
    private readonly answers: Answerer,
    private readonly options: ChatControllerOptions,
  ) {}

  status = async ({ res }: RouteContext): Promise<void> => {
    if (!this.ensureEnabled(res)) return;
    const { aiKeys, defaultModels, agentEnabled } = this.options;
    sendJson(res, HttpStatus.OK, {
      ok: true,
      agentEnabled,
      providers: { claude: !!aiKeys.claude, gemini: !!aiKeys.gemini, grok: !!aiKeys.grok, openai: !!aiKeys.openai },
      defaultModels,
      models: ALLOWED_MODELS,
    });
  };

  ask = async ({ req, res }: RouteContext): Promise<void> => {
    if (!this.ensureEnabled(res)) return;

    let body: unknown;
    try {
      body = await readJsonBody(req, MAX_CHAT_BODY_BYTES);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) return sendError(res, HttpStatus.PAYLOAD_TOO_LARGE, err.message);
      if (err instanceof InvalidJsonError) return sendError(res, HttpStatus.BAD_REQUEST, err.message);
      throw err;
    }

    const parsed = toChatQuestion(body, this.options.defaultModels);
    if (!parsed.ok) return sendError(res, HttpStatus.BAD_REQUEST, parsed.error);

    const { provider, model, mode, content } = parsed.value;
    const label = `chat-api-${Date.now()}-${++this.sequence}`;
    const started = Date.now();
    try {
      const answer = await this.answers.answer({ provider, model, content, label, mode });
      logger.info(`[chat-api] ${label} answered with ${provider}/${answer.model} (${answer.mode ?? mode}) in ${Date.now() - started}ms`);
      sendJson(res, HttpStatus.OK, {
        text: answer.text,
        provider,
        model: answer.model,
        requestedMode: mode,
        mode: answer.mode ?? mode,
        fallbackReason: answer.fallbackReason ?? null,
        attempts: answer.attempts,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      logger.info(`[chat-api] ${label} failed for ${provider}/${model}: ${errorMessage(err)}`);
      sendError(res, HttpStatus.BAD_GATEWAY, `AI request failed: ${errorMessage(err)}`);
    }
  };

  private ensureEnabled(res: RouteContext['res']): boolean {
    if (this.options.enabled) return true;
    sendError(res, HttpStatus.SERVICE_UNAVAILABLE, 'Chat API disabled: set CHAT_API_TOKEN on the server');
    return false;
  }
}

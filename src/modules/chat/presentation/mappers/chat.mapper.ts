import { ValidationError } from '../../../../shared/errors';
import { AnswerMode } from '../../../agent/domain';
import { AI_PROVIDERS, parseAIProvider } from '../../../ai';
import { ChatAnswer, ChatQuestion } from '../../application/interfaces/chat.interface';
import { ChatAnswerDto } from '../dto/chat.dto';
import { optionalString, parseImages } from '../helpers/chat.helper';

/** Shape validation of a `POST /api/chat` body; model rules are checked by ChatService. */
export function toChatQuestion(body: unknown): ChatQuestion {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;

  const rawProvider = optionalString(raw.provider)?.toLowerCase();
  if (!rawProvider) throw new ValidationError('Missing provider');
  const provider = parseAIProvider(rawProvider);
  if (!provider) throw new ValidationError(`Provider "${rawProvider}" is not servable (supported: ${AI_PROVIDERS.join(', ')})`);

  const images = parseImages(raw.images);
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!question && images.length === 0) throw new ValidationError('Provide a question or at least one image');

  return {
    provider,
    requestedModel: optionalString(raw.model),
    mode: optionalString(raw.mode)?.toLowerCase() === AnswerMode.AGENT ? AnswerMode.AGENT : AnswerMode.SINGLE_SHOT,
    content: { textContent: question, imageBuffers: images },
    includeTrace: raw.includeTrace === true,
  };
}

export function toChatAnswerDto({ question, answer, durationMs }: ChatAnswer): ChatAnswerDto {
  return {
    text: answer.text,
    provider: question.provider,
    model: answer.model,
    requestedMode: question.mode,
    mode: answer.mode ?? question.mode,
    fallbackReason: answer.fallbackReason ?? null,
    attempts: answer.attempts,
    durationMs,
    ...(question.includeTrace ? { trace: { contexts: answer.contexts ?? [], ...(answer.agent ? { agent: answer.agent } : {}) } } : {}),
  };
}

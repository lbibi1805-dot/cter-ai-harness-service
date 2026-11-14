import type { PromptTrace } from '../interfaces/promptTrace.interface';
import { ValidationError } from '../../../../shared/errors';
import { AnswerMode } from '../../../agent/domain';
import { AI_PROVIDERS, parseAIProvider, type PromptImage } from '../../../ai';
import { EssayRequestMode, EssayTrigger, parseEssayCommand, type EssayRequestOptions } from '../../../essay';
import { ChatAnswer, ChatQuestion } from '../../application/interfaces/chat.interface';
import { DEFAULT_CHAT_LIMITS } from '../constants/chat.constants';
import type { ChatLimits } from '../interfaces/chatLimits.interface';
import { ChatAnswerDto } from '../dto/chat.dto';
import { optionalString, parseHistory, parseImages, parseRefArtifactIds } from '../helpers/chat.helper';

/** Shape validation of a `POST /api/chat` body; model rules are checked by ChatService. */
/** `stagedImages`: the bytes of the body's `imageIds` (upload-first), resolved by the controller; they follow the inline ones. */
export function toChatQuestion(body: unknown, limits: ChatLimits = DEFAULT_CHAT_LIMITS, stagedImages: PromptImage[] = []): ChatQuestion {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;

  const rawProvider = optionalString(raw.provider)?.toLowerCase();
  if (!rawProvider) throw new ValidationError('Missing provider');
  const provider = parseAIProvider(rawProvider);
  if (!provider) throw new ValidationError(`Provider "${rawProvider}" is not servable (supported: ${AI_PROVIDERS.join(', ')})`);

  const inlineImages = parseImages(raw.images, limits.maxImages);
  if (inlineImages.length + stagedImages.length > limits.maxImages) {
    throw new ValidationError(`At most ${limits.maxImages} images per question (got ${inlineImages.length + stagedImages.length} with imageIds)`);
  }
  // No inline-size 413 here any more: the Gemini adapter moves oversized image sets to the Files API.
  const images = [...inlineImages, ...stagedImages];
  const refArtifactIds = parseRefArtifactIds(raw.refArtifactIds);
  const conversationId = optionalString(raw.conversationId);
  const rawQuestion = typeof raw.question === 'string' ? raw.question.trim() : '';
  const rawMode = optionalString(raw.mode)?.toLowerCase();
  const { question, essay } = parseEssayRequest(rawQuestion, rawMode);
  if (!question && images.length === 0) throw new ValidationError(essay ? 'Provide the essay question after /essay' : 'Provide a question or at least one image');

  return {
    provider,
    requestedModel: optionalString(raw.model),
    // Essay Mode is never combined with the agent.
    mode: rawMode === AnswerMode.AGENT && !essay ? AnswerMode.AGENT : AnswerMode.SINGLE_SHOT,
    content: { textContent: question, imageBuffers: images, history: parseHistory(raw.history) },
    ...(essay ? { essay } : {}),
    includeTrace: raw.includeTrace === true,
    stream: raw.stream === true,
    ...(conversationId ? { conversationId } : {}),
    ...(refArtifactIds.length ? { refArtifactIds } : {}),
  };
}

/** `/essay [strict] [3đ] …` (stripped from the question) or `mode: "essay"` → Essay Mode options. */
function parseEssayRequest(rawQuestion: string, rawMode: string | undefined): { question: string; essay?: EssayRequestOptions } {
  const command = parseEssayCommand(rawQuestion);
  if (command) {
    return {
      question: command.question,
      essay: { trigger: EssayTrigger.COMMAND, strict: command.strict, ...(command.points !== undefined ? { points: command.points } : {}) },
    };
  }
  if (rawMode === EssayRequestMode.ESSAY) return { question: rawQuestion, essay: { trigger: EssayTrigger.BODY_MODE, strict: false } };
  return { question: rawQuestion };
}

/** Path whose prompt composition answered (`trace.prompt`): essay, agent or single-shot. */
export function promptPathOf({ answer, essay }: ChatAnswer): string {
  if (essay) return 'essay';
  return answer.mode === 'agent' ? 'agent' : 'single';
}

/**
 * `promptTrace` (12/11 02 Bước 6): `id@version` + size of each prompt file in composition order for the path that
 * answered, added to `trace.prompt` when the request asked for a trace. No chunk content.
 */
export function toChatAnswerDto(chatAnswer: ChatAnswer, promptTrace?: PromptTrace): ChatAnswerDto {
  const { question, answer, durationMs, sources, conversation, essay } = chatAnswer;
  const prompt = question.includeTrace && promptTrace ? promptTrace(promptPathOf(chatAnswer)) : null;
  return {
    text: answer.text,
    provider: question.provider,
    model: answer.model,
    requestedMode: question.mode,
    mode: answer.mode ?? question.mode,
    fallbackReason: answer.fallbackReason ?? null,
    attempts: answer.attempts,
    durationMs,
    ...(conversation ? { conversationId: conversation.conversationId, messageId: conversation.messageId, persisted: conversation.persisted, ...(conversation.artifacts ? { artifacts: conversation.artifacts } : {}) } : {}),
    sources,
    ...(answer.timings ? { timings: answer.timings } : {}),
    ...(essay ? { essay } : {}),
    ...(answer.completeness ? { completeness: answer.completeness } : {}),
    ...(question.includeTrace ? { trace: { contexts: answer.contexts ?? [], ...(answer.agent ? { agent: answer.agent } : {}), ...(prompt ? { prompt } : {}) } } : {}),
  };
}

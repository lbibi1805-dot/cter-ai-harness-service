import { FinishReason } from '../../domain/enums/ai.enums';
import {
  CHAT_LENGTH_REASON,
  CHAT_SAFETY_REASON,
  CHAT_STOP_REASONS,
  CLAUDE_LENGTH_REASON,
  CLAUDE_SAFETY_REASON,
  CLAUDE_STOP_REASONS,
  GEMINI_LENGTH_REASON,
  GEMINI_SAFETY_REASONS,
  GEMINI_STOP_REASON,
  RESPONSES_LENGTH_REASON,
  RESPONSES_SAFETY_REASON,
} from '../constants/finishReason.constants';

/** Chat Completions (OpenAI, xAI, OpenRouter) `finish_reason`. */
export function chatFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) return undefined;
  if (reason === CHAT_LENGTH_REASON) return FinishReason.LENGTH;
  if (reason === CHAT_SAFETY_REASON) return FinishReason.SAFETY;
  return CHAT_STOP_REASONS.has(reason) ? FinishReason.STOP : FinishReason.OTHER;
}

/** Responses API: `status: incomplete` + `incomplete_details.reason`. */
export function responsesFinishReason(status: string | null | undefined, incompleteReason: string | null | undefined): FinishReason | undefined {
  if (incompleteReason === RESPONSES_LENGTH_REASON) return FinishReason.LENGTH;
  if (incompleteReason === RESPONSES_SAFETY_REASON) return FinishReason.SAFETY;
  if (!status) return undefined;
  return status === 'completed' ? FinishReason.STOP : FinishReason.OTHER;
}

/** Anthropic `stop_reason`. */
export function claudeFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) return undefined;
  if (reason === CLAUDE_LENGTH_REASON) return FinishReason.LENGTH;
  if (reason === CLAUDE_SAFETY_REASON) return FinishReason.SAFETY;
  return CLAUDE_STOP_REASONS.has(reason) ? FinishReason.STOP : FinishReason.OTHER;
}

/** Gemini `candidates[0].finishReason`. */
export function geminiFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (!reason) return undefined;
  if (reason === GEMINI_STOP_REASON) return FinishReason.STOP;
  if (reason === GEMINI_LENGTH_REASON) return FinishReason.LENGTH;
  return GEMINI_SAFETY_REASONS.has(reason) ? FinishReason.SAFETY : FinishReason.OTHER;
}

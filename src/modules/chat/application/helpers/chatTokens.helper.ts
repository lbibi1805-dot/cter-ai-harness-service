import type { ChatTokenUsage, TimedAnswer } from '../interfaces/chat.interface';

/** Token counts for the message row (`tokens_in/out/cached`); only the fields the provider reported. */
export function tokenUsage(answer: TimedAnswer): ChatTokenUsage {
  const timings = answer.timings;
  if (!timings) return {};
  return {
    ...(timings.inputTokens !== undefined ? { tokensIn: timings.inputTokens } : {}),
    ...(timings.outputTokens !== undefined ? { tokensOut: timings.outputTokens } : {}),
    ...(timings.cachedTokens !== undefined ? { tokensCached: timings.cachedTokens } : {}),
  };
}

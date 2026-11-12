import { PromptCacheLayout } from '../enums/promptLayout.enums';

export const DEFAULT_PROMPT_CACHE_LAYOUT = PromptCacheLayout.V2;

/** First history turn in V2 (layer ②). */
export const SUMMARY_TURN_HEADER = '[SUMMARY OF EARLIER TURNS]';

/** Assistant turn after the summary so roles keep alternating (static: cacheable). */
export const SUMMARY_TURN_ACK = 'Đã nắm phần tóm tắt các turn trước.';

/**
 * Marker placed before an image an assistant turn produced (C4 PNG). Assistant roles cannot carry images on
 * every provider, so the image goes at the start of the next user turn (same layout for every provider).
 */
export function assistantImageMarker(alias: string | undefined): string {
  return alias ? `[Hình [${alias}] do trợ lý vẽ ở lượt trước]` : '[Hình do trợ lý vẽ ở lượt trước]';
}

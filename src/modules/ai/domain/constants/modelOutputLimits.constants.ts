import type { ModelOutputLimit } from '../interfaces/modelOutputLimit.interface';

/**
 * Per-model output caps (08 Bước 2): AI_MAX_OUTPUT_TOKENS is clamped to the first matching entry.
 *
 * Only limits that can be confirmed from the SDKs installed in node_modules are listed. Everything else is
 * "chưa xác minh" (not verified): no entry, the configured AI_MAX_OUTPUT_TOKENS is sent as is, and a model whose
 * real limit is lower answers 4xx → the invocation moves to the next model of the chain. Add an entry only after
 * checking the vendor's official model page.
 *
 * - Claude Opus 4 / 4.1 non-streaming: 8192 (`@anthropic-ai/sdk` internal/constants.js MODEL_NONSTREAMING_TOKENS;
 *   the SDK refuses larger non-streaming requests). Streaming limit: chưa xác minh.
 */
export const MODEL_OUTPUT_LIMITS: readonly ModelOutputLimit[] = [
  { pattern: /^claude-(?:opus-4(?:-0|-1)?(?:-\d{8})?|4-opus)/i, maxOutputTokens: 8_192, nonStreamingOnly: true, verified: true },
];

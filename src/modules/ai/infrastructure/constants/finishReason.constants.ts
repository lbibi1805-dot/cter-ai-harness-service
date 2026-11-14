/** Vendor stop reasons mapped to FinishReason (08 Bước 2). */
export const CHAT_LENGTH_REASON = 'length';

export const CHAT_SAFETY_REASON = 'content_filter';

export const CHAT_STOP_REASONS: ReadonlySet<string> = new Set(['stop', 'tool_calls', 'function_call']);

export const RESPONSES_LENGTH_REASON = 'max_output_tokens';

export const RESPONSES_SAFETY_REASON = 'content_filter';

/** Responses API stream event of a response cut by the output cap / a filter (instead of `response.completed`). */
export const RESPONSES_INCOMPLETE_EVENT = 'response.incomplete';

export const CLAUDE_LENGTH_REASON = 'max_tokens';

export const CLAUDE_SAFETY_REASON = 'refusal';

export const CLAUDE_STOP_REASONS: ReadonlySet<string> = new Set(['end_turn', 'stop_sequence', 'tool_use', 'pause_turn']);

export const GEMINI_STOP_REASON = 'STOP';

export const GEMINI_LENGTH_REASON = 'MAX_TOKENS';

export const GEMINI_SAFETY_REASONS: ReadonlySet<string> = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

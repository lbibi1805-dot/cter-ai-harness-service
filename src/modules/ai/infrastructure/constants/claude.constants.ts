export const CLAUDE_TEXT_BLOCK = 'text';

/** Anthropic prompt-cache breakpoint (default ~5 min TTL). */
export const CLAUDE_CACHE_CONTROL = { type: 'ephemeral' } as const;

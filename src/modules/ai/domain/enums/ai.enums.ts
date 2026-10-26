/** Model families a user can ask for (file name, chat header or `/api/chat` body). */
export enum AIProvider {
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  GROK = 'grok',
  OPENAI = 'openai',
}

/**
 * Which route produced an answer. DIRECT (the vendor's own API) is always
 * tried first; OPENROUTER is the backend's last-resort fallback. Clients
 * never choose the route.
 */
export enum ModelRoute {
  DIRECT = 'direct',
  OPENROUTER = 'openrouter',
}

/** Which OpenAI endpoint a direct OpenAI model is served from. */
export enum OpenAIApiMode {
  CHAT_COMPLETIONS = 'chat-completions',
  RESPONSES = 'responses',
}

/** OpenRouter `provider.sort`: how it orders upstream hosts for one model. */
export enum OpenRouterProviderSort {
  PRICE = 'price',
  THROUGHPUT = 'throughput',
  LATENCY = 'latency',
}

/** Speaker of an earlier turn in a chat conversation. */
export enum ConversationRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

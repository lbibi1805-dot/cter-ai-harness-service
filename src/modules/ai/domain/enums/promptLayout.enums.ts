/**
 * Where conversation memory goes in the prompt (PROMPT_CACHE_LAYOUT, note 18 §4).
 * V1: summary + registry appended to the system prompt (old layout).
 * V2: static system prompt only (base + citation rules + conversation rules, identical for
 *     every conversation and both the RAG and knowledge.md paths); summary = first history
 *     turn; registry = tail of the last message, before the JIT artifacts. Layers ①②④③⑤⑥⑦.
 */
export enum PromptCacheLayout {
  V1 = 'v1',
  V2 = 'v2',
}

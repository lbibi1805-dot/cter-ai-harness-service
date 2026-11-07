/** Appends conversation memory (summary + artifact registry) after the static system prompt. */
export function withMemory(systemPrompt: string, memory: string | undefined): string {
  return memory?.trim() ? `${systemPrompt}\n\n${memory.trim()}` : systemPrompt;
}

/** Puts just-in-time artifacts in front of the user content (before RAG context and question). */
export function withJit(userContent: string, jit: string | undefined): string {
  return jit?.trim() ? `${jit.trim()}\n\n${userContent}` : userContent;
}

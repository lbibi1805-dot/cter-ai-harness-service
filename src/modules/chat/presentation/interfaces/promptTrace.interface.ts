/** One composed prompt file of an answer (`trace.prompt`). */
export interface PromptTraceEntry {
  id: string;
  version: string;
  chars: number;
}

/** Composition of a path (`single`, `agent`, `essay`); null without the prompt registry. */
export type PromptTrace = (path: string) => PromptTraceEntry[] | null;

/** How a question is answered. Requested per file (`_agent` suffix) or per chat message (`mode: agent`). */
export enum AnswerMode {
  SINGLE_SHOT = 'single-shot',
  AGENT = 'agent',
}

/** Why the agent loop ended with an answer. */
export enum AgentStopReason {
  FINAL_ANSWER = 'final-answer',
  STEP_LIMIT = 'step-limit',
  TIME_LIMIT = 'time-limit',
}

/** Tool names exposed to the model. All tools are read-only. */
export enum AgentToolName {
  SEARCH_VAULT = 'search_vault',
  READ_DOCUMENT = 'read_document',
  LIST_FOLDER = 'list_folder',
}

/** Why an agent request was answered by the single-shot path instead. */
export enum AgentFallbackReason {
  AGENT_DISABLED = 'agent-disabled',
  UNSUPPORTED_PROVIDER = 'unsupported-provider',
  UNSUPPORTED_MODEL = 'unsupported-model',
  AGENT_FAILED = 'agent-failed',
}

export enum ModelTurnKind {
  TOOL_CALLS = 'tool-calls',
  FINAL = 'final',
}

/** Provider-side tool policy for one model turn (OpenAI `tool_choice` values). */
export enum ToolChoice {
  AUTO = 'auto',
  /** The model must call at least one tool this turn. */
  REQUIRED = 'required',
  /** The model must answer in text. */
  NONE = 'none',
}

/** File name marker: `START_<name>_<provider>[_<model>]_agent.<ext>`. */
export const AGENT_FILE_SUFFIX = '_agent';

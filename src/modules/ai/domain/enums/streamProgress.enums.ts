/** Stages of a streamed answer that carry no text yet; the transport maps them to its own progress event. */
export enum ProgressStage {
  /** Prompt preparation is done and the model call has started. */
  ANSWERING = 'answering',
  /** The agent is running a tool; `detail` is the tool name. */
  AGENT_TOOL = 'agent-tool',
}

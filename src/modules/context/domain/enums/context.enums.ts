/** ARTIFACT_RESOLVER_MODE (note 17 §7). */
export enum ArtifactResolverMode {
  /** Old behaviour: a design word inlines the latest c4_spec, an image word re-attaches the latest user images. */
  OFF = 'off',
  /** Rule scoring only (ambiguous → ask back with a default). */
  RULES = 'rules',
  /** Rules, then the aux resolver when the rules are not sure (falls back to RULES without an aux resolver). */
  RULES_AUX = 'rules+aux',
}

/** Time/order words of a reference ("bản trước đó", "đầu tiên", "khác gì bản trước"). */
export enum TemporalCue {
  LATEST = 'latest',
  /** Parent of the newest version when there is a chain, otherwise the newest. */
  PREVIOUS = 'previous',
  FIRST = 'first',
  /** Head of the version chain AND its parent. */
  COMPARE = 'compare',
}

/** Tools the agent can call to read this conversation's artifacts (note 17 step 8). */
export enum ArtifactToolName {
  LIST_ARTIFACTS = 'list_artifacts',
  GET_ARTIFACT = 'get_artifact',
}

/** `get_artifact` part argument. */
export enum ArtifactPart {
  ALL = 'all',
  SPEC = 'spec',
  PUML = 'puml',
  OCR = 'ocr',
}

/** How a design note's data_json was produced. */
export enum DesignNoteSource {
  HEURISTIC = 'heuristic',
  AUX = 'aux',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum MessageKind {
  CHAT = 'chat',
  C4 = 'c4',
  C4_REVIEW = 'c4_review',
  SUMMARY = 'summary',
}

export enum ArtifactKind {
  USER_IMAGE = 'user_image',
  C4_PNG = 'c4_png',
  C4_PUML = 'c4_puml',
  C4_SPEC = 'c4_spec',
  PROBLEM_BRIEF = 'problem_brief',
  DESIGN_REVIEW = 'design_review',
  /** /c4 design discussion T1–T7 (12/11 plan 04 §5.3): {markdown, systemName}. */
  DESIGN_DISCUSSION = 'design_discussion',
  /** A design answered in normal chat (markdown, not /c4): {systemName, elements[], decisions[]}. */
  DESIGN_NOTE = 'design_note',
}

/** How the artifact resolver picked the artifacts a question refers to (`messages.resolved_refs.source`). */
export enum ResolvedRefSource {
  /** Explicit `refArtifactIds` sent by the client ("↩ Hỏi về cái này"). */
  UI = 'ui',
  /** Rule scoring (or a typed alias such as "A7"). */
  RULE = 'rule',
  /** The aux model settled what the rules could not. */
  AUX = 'aux',
  /** Too close to call: the model was told to ask back with a default. */
  AMBIGUOUS = 'ambiguous',
  /** No reference signal in the question. */
  NONE = 'none',
}

/** Keys of `conversations.state` (pending workflows). */
export enum ConversationStateKey {
  PENDING_C4 = 'pendingC4',
}

/** Where `conversations.title` shown to clients comes from (migration 009). */
export enum TitleSource {
  /** Renamed by the user (`display_title`, PATCH /api/conversations/:id). */
  USER = 'user',
  /** Generated from the first question (`title`). */
  AUTO = 'auto',
}

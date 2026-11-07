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
}

/** Keys of `conversations.state` (pending workflows). */
export enum ConversationStateKey {
  PENDING_C4 = 'pendingC4',
}

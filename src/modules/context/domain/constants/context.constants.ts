import type { ContextSettings } from '../interfaces/context.interface';

export const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  keepRecentTurns: 6,
  compactThresholdTokens: 12_000,
  compactMaxTurns: 20,
  registryMaxLines: 40,
  jitMaxImages: 3,
  jitMaxChars: 16_000,
  maxLoadMessages: 80,
  maxLoadArtifacts: 40,
};

/** Rough token estimate (same ratio as the chunker). */
export const CHARS_PER_TOKEN = 4;

/** Words that make the question refer to an earlier image (JIT re-attach). */
export const IMAGE_REFERENCE_WORDS: readonly string[] = [
  'ảnh', 'hình', 'diagram', 'sơ đồ', 'design', 'trên', 'lúc nãy', 'this image', 'image', 'picture', 'screenshot', 'đề',
];

/** Words that make the question about a drawn C4 design (inline spec + PUML). */
export const DESIGN_REFERENCE_WORDS: readonly string[] = [
  'design', 'thiết kế', 'c4', 'container', 'component', 'kiến trúc', 'architecture', 'diagram', 'sơ đồ',
  'vì sao', 'tại sao', 'why', 'element', 'queue', 'database', 'service',
];

/** Follow-ups that only make sense with the previous turn ("explain it more"). */
export const REFERENCE_PRONOUNS: readonly string[] = [
  'nó', 'cái đó', 'cái này', 'phần trên', 'ở trên', 'điều đó', 'cái trên', 'như vậy', 'that', ' it ', ' it?', 'this one', 'those', 'them',
];

/** A follow-up longer than this is assumed self-contained. */
export const REWRITE_MAX_QUESTION_CHARS = 200;

/** Explicit artifact reference typed by the user: "A3", "[A3]". */
export const ARTIFACT_ALIAS_PATTERN = /\[?\bA(\d{1,4})\b\]?/g;

/** Image-related text added to the RAG query, per image. */
export const OCR_QUERY_MAX_CHARS = 300;

export const MEMORY_HEADER = '## CONVERSATION MEMORY';

/**
 * The citation rules restrict answers to [RETRIEVED CONTEXT]; this conversation's own turns,
 * images and artifacts are a valid source too (the user's exam statement, their C4 design).
 */
export const CONVERSATION_SOURCE_RULE = 'Ngoài [RETRIEVED CONTEXT], các turn trước của hội thoại này, ảnh người dùng gửi và [CONVERSATION ARTIFACTS] cũng là nguồn hợp lệ: khi câu hỏi nói về đề bài, ảnh, thiết kế hay điều đã trao đổi trước đó, hãy trả lời từ các nguồn này (không cần có trong tài liệu) và nói rõ là lấy từ hội thoại.';
export const SUMMARY_HEADER = '### Summary of earlier turns';
export const REGISTRY_HEADER = '### Artifacts in this conversation (id · kind · turn · caption)';
export const REGISTRY_FOOTER = 'Refer to artifacts by id. An image is re-attached to the message only when it is needed.';
export const JIT_HEADER = '[CONVERSATION ARTIFACTS]';
export const JIT_FOOTER = '[/CONVERSATION ARTIFACTS]';

/** Shown in history for a user turn that had images. */
export const IMAGE_IN_HISTORY_LABEL = 'ảnh đính kèm';

export const ARTIFACT_REFS_HEADING = '🔗 Artifact refs';

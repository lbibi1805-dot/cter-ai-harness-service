import { DEFAULT_PROMPT_CACHE_LAYOUT } from '../../../ai/domain/constants/promptLayers.constants';
import { ArtifactKind } from '../../../conversation-store';
import type { ContextSettings } from '../interfaces/context.interface';
import { DEFAULT_RESOLVER_SETTINGS } from './artifactResolver.constants';

/** CONTEXT_PINNED_KINDS default: design kinds always loaded, outside the newest-N window (note 17 §4). */
export const DEFAULT_PINNED_KINDS: readonly ArtifactKind[] = [
  ArtifactKind.C4_SPEC,
  ArtifactKind.PROBLEM_BRIEF,
  ArtifactKind.DESIGN_REVIEW,
  ArtifactKind.DESIGN_NOTE,
];

/** CONTEXT_HOT_WINDOW_TURNS default: the last 2 user/assistant pairs carry their images in place (note 18 step 5). */
export const DEFAULT_HOT_WINDOW_TURNS = 2;

/** CONTEXT_MAX_PROMPT_IMAGES default: current + hot window + JIT images per request (oldest window images dropped first). */
export const DEFAULT_MAX_PROMPT_IMAGES = 16;

/** Images one history message keeps in the hot window (ordinal order, the first ones). */
export const HOT_WINDOW_MAX_IMAGES_PER_TURN = 3;

/** JIT line for a picked image that is already in place in the history (hot window), so it is not re-attached. */
export const HOT_WINDOW_IN_HISTORY_NOTE = 'already shown in place in the conversation above (not re-attached)';

export const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  keepRecentTurns: 6,
  compactThresholdTokens: 12_000,
  compactMaxTurns: 20,
  registryMaxLines: 40,
  jitMaxImages: 3,
  jitMaxChars: 16_000,
  maxLoadMessages: 80,
  maxLoadArtifacts: 40,
  pinnedKinds: DEFAULT_PINNED_KINDS,
  maxPinnedArtifacts: 60,
  designNoteMinChars: 800,
  resolver: DEFAULT_RESOLVER_SETTINGS,
  promptLayout: DEFAULT_PROMPT_CACHE_LAYOUT,
  hotWindowTurns: DEFAULT_HOT_WINDOW_TURNS,
  maxPromptImages: DEFAULT_MAX_PROMPT_IMAGES,
};

/** Rough token estimate (same ratio as the chunker). */
export const CHARS_PER_TOKEN = 4;

/** ARTIFACT_RESOLVER_MODE=off only: words that make the question refer to an earlier image (JIT re-attach). */
export const IMAGE_REFERENCE_WORDS: readonly string[] = [
  'ảnh', 'hình', 'diagram', 'sơ đồ', 'design', 'trên', 'lúc nãy', 'this image', 'image', 'picture', 'screenshot', 'đề',
];

/** ARTIFACT_RESOLVER_MODE=off only: words that make the question about a drawn C4 design (latest spec + PUML). */
export const DESIGN_REFERENCE_WORDS: readonly string[] = [
  'design', 'thiết kế', 'c4', 'container', 'component', 'kiến trúc', 'architecture', 'diagram', 'sơ đồ',
  'vì sao', 'tại sao', 'why', 'element', 'queue', 'database', 'service',
];

/** Follow-ups that only make sense with the previous turn ("explain it more"); whole words only. */
export const REFERENCE_PRONOUNS: readonly string[] = [
  'nó', 'cái đó', 'cái này', 'phần trên', 'ở trên', 'điều đó', 'cái trên', 'như vậy', 'that', 'it', 'this one', 'those', 'them',
];

/** A follow-up longer than this is assumed self-contained. */
export const REWRITE_MAX_QUESTION_CHARS = 200;

/** Explicit artifact reference typed by the user: "A3", "[A3]". */
export const ARTIFACT_ALIAS_PATTERN = /\[?\bA(\d{1,4})\b\]?/g;

/** Image-related text added to the RAG query, per image. */
export const OCR_QUERY_MAX_CHARS = 300;

export const MEMORY_HEADER = '## CONVERSATION MEMORY';
export const SUMMARY_HEADER = '### Summary of earlier turns';
export const REGISTRY_HEADER = '### Artifacts in this conversation (id · kind · turn · label)';
export const REGISTRY_FOOTER = 'Refer to artifacts by id. An image is re-attached to the message only when it is needed.';
export const JIT_HEADER = '[CONVERSATION ARTIFACTS]';
export const JIT_FOOTER = '[/CONVERSATION ARTIFACTS]';
export const JIT_INTRO = 'Artifacts of THIS conversation (valid sources for questions about them):';
export const JIT_TRUNCATED = '\n…[truncated]';

/** Ambiguous reference (note 17 §3.4): offer the choices, answer with the default meanwhile. */
export const AMBIGUITY_HEADER = '[AMBIGUOUS REFERENCE] Câu hỏi có thể nói tới một trong các artifact sau:';
export function ambiguityInstruction(defaultIndex: number, defaultAlias: string, otherAlias: string): string {
  return `Mở đầu câu trả lời bằng đúng 1 câu hỏi lại ngắn ("Bạn đang nói tới thiết kế nào?") kèm danh sách lựa chọn ở trên, rồi tạm trả lời theo (${defaultIndex}) [${defaultAlias}] — bản mới nhất — và nói rằng nếu ý bạn là bản khác thì gõ "${otherAlias}". Nội dung đầy đủ của [${defaultAlias}] ở bên dưới.`;
}

/** Shown in history for a user turn that had images. */
export const IMAGE_IN_HISTORY_LABEL = 'ảnh đính kèm';

export const ARTIFACT_REFS_HEADING = '🔗 Artifact refs';

/** Elements listed per candidate / per registry entry. */
export const COMPACT_ELEMENTS_MAX = 8;
export const REGISTRY_TEXT_MAX_CHARS = 120;

// ── Labels generated on write (no LLM) ─────────────────────────────────────
export const LABEL_SEPARATOR = ' · ';
export const LABEL_PREFIX = {
  c4Spec: 'C4',
  c4Png: 'Sơ đồ C4',
  c4Puml: 'PlantUML',
  userImage: 'Ảnh người dùng',
  designNote: 'Thiết kế trong chat',
  problemBrief: 'Đề bài',
  designReview: 'Nhận xét thiết kế',
  designDiscussion: 'Bàn luận thiết kế',
} as const;
export const LEVELS_JOINER = '+';

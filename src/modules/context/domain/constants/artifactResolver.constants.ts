import { ArtifactKind } from '../../../conversation-store';
import { ArtifactResolverMode } from '../enums/context.enums';
import type { ResolverSettings } from '../interfaces/artifactResolver.interface';

export const DEFAULT_RESOLVER_SETTINGS: ResolverSettings = {
  mode: ArtifactResolverMode.RULES_AUX,
  minScore: 2.5,
  margin: 1.0,
  auxTimeoutMs: 1500,
  auxMinConfidence: 0.7,
};

/**
 * Score weights (§3.2). Starting point, tuned on the golden set: `temporal` is 2 (not 1)
 * because "bản trước đó" / "mới nhất" is an explicit instruction that must beat recency
 * and settle two versions of the same design.
 */
export const RESOLVER_WEIGHTS = {
  kind: 2,
  level: 2,
  entity: 2,
  ownerMatch: 1.5,
  ownerMismatch: -3,
  temporal: 2,
  recency: 0.5,
} as const;

export const CONFIDENCE = {
  explicit: 1,
  sure: 0.9,
  singleCandidate: 0.85,
  onlyViable: 0.6,
  ambiguous: 0.3,
  none: 0,
} as const;

/** Kinds a question can refer to; PUML and PNG come along with their spec. */
export const REFERABLE_KINDS: readonly ArtifactKind[] = [
  ArtifactKind.C4_SPEC,
  ArtifactKind.DESIGN_NOTE,
  ArtifactKind.PROBLEM_BRIEF,
  ArtifactKind.DESIGN_REVIEW,
  ArtifactKind.USER_IMAGE,
];

/** Shown as choices when ambiguous (§3.4). */
export const MAX_AMBIGUOUS_CANDIDATES = 2;

/** Registry lines sent to the aux resolver. */
export const AUX_REGISTRY_MAX_LINES = 40;
export const AUX_RECENT_TURNS = 2;
export const AUX_TURN_MAX_CHARS = 600;

/** Fuzzy entity match: hits needed for a full match. */
export const ENTITY_FULL_MATCH_HITS = 2;
export const ENTITY_MIN_TOKEN_CHARS = 2;

// ── Cue words (matched as whole words, NFC, lower case) ────────────────────

/** Compounds whose syllables must not count alone ("vấn đề" ≠ đề, "mô hình" ≠ hình). */
export const MASKED_COMPOUNDS: readonly string[] = [
  'vấn đề', 'chủ đề', 'đề xuất', 'đề cập', 'tiêu đề', 'đề nghị', 'đề ra', 'đề tài',
  'mô hình', 'hình như', 'hình thức', 'tình hình', 'địa hình', 'hình dung', 'cấu hình', 'màn hình', 'hình dạng',
  'ảnh hưởng', 'phản ảnh',
];

/** A picture the assistant drew. */
export const DIAGRAM_WORDS: readonly string[] = ['bản vẽ', 'hình vẽ', 'sơ đồ', 'diagram', 'biểu đồ'];
export const IMAGE_WORDS: readonly string[] = ['ảnh', 'hình', 'hình ảnh', 'image', 'picture', 'screenshot', 'ảnh chụp'];
export const DRAW_VERBS: readonly string[] = ['vẽ', 'draw', 'drew', 'drawn'];
export const DESIGN_WORDS: readonly string[] = ['thiết kế', 'kiến trúc', 'design', 'spec', 'architecture', 'c4'];
export const PROBLEM_WORDS: readonly string[] = ['đề', 'đề bài', 'bài tập', 'yêu cầu', 'problem', 'requirement', 'requirements', 'exam'];
export const REVIEW_WORDS: readonly string[] = ['nhận xét', 'đánh giá', 'review', 'góp ý'];

export const LEVEL_WORDS: Readonly<Record<string, string>> = {
  context: 'context',
  'ngữ cảnh': 'context',
  container: 'container',
  component: 'component',
  deployment: 'deployment',
  sequence: 'sequence',
};

export const OWNER_ASSISTANT_WORDS: readonly string[] = [
  'bạn vẽ', 'bạn đã vẽ', 'bạn thiết kế', 'bạn đã thiết kế', 'bạn làm', 'bạn đã làm', 'bạn tạo', 'bạn đề xuất', 'bạn đưa ra',
  'của bạn', 'you drew', 'you designed', 'your design', 'your diagram',
];
export const OWNER_USER_WORDS: readonly string[] = [
  'của tôi', 'tôi vẽ', 'tôi thiết kế', 'tôi làm', 'tôi gửi', 'bài em', 'bài của em', 'của em', 'em vẽ', 'em thiết kế', 'em gửi',
  'my design', 'my diagram', 'i drew', 'i designed', 'mine',
];

export const LATEST_WORDS: readonly string[] = ['mới nhất', 'vừa rồi', 'vừa vẽ', 'gần nhất', 'gần đây nhất', 'bản mới', 'cuối cùng', 'latest', 'newest', 'last'];
export const PREVIOUS_WORDS: readonly string[] = ['trước đó', 'lần trước', 'bản cũ', 'bản trước', 'phiên bản trước', 'previous', 'older version'];
export const FIRST_WORDS: readonly string[] = ['đầu tiên', 'bản đầu', 'lần đầu', 'ban đầu', 'first'];
export const COMPARE_WORDS: readonly string[] = ['khác gì', 'so với', 'so sánh', 'khác nhau', 'thay đổi gì', 'compare', 'diff'];
export const ANAPHORA_WORDS: readonly string[] = [
  'lúc nãy', 'hồi nãy', 'vừa nãy', 'lúc trước', 'hồi trước', 'trước đây', 'ở trên', 'phía trên', 'đã gửi', 'đã vẽ', 'earlier', 'above',
];

/** "bản 2", "phiên bản 2", "version 2", "v2", "lần 2". */
export const ORDINAL_PATTERN = /(?<![\p{L}\p{N}])(?:phiên bản|phien ban|bản|ban|version|lần|lan|v)\s*(\d{1,2})(?![\p{L}\p{N}])/u;
/** "turn 3", "lượt 3". */
export const TURN_PATTERN = /(?<![\p{L}\p{N}])(?:turn|lượt|luot)\s*(\d{1,3})(?![\p{L}\p{N}])/u;

/** Words that never identify a system/element (compared without diacritics). */
export const ENTITY_STOPWORDS: readonly string[] = [
  'hệ', 'thống', 'system', 'của', 'tôi', 'bạn', 'em', 'mình', 'là', 'gì', 'thế', 'nào', 'và', 'với', 'cho', 'trong', 'về', 'này', 'đó',
  'kia', 'cái', 'những', 'các', 'một', 'có', 'không', 'được', 'đã', 'đang', 'sẽ', 'thì', 'mà', 'như', 'hãy', 'giải', 'thích', 'nói', 'rõ',
  'hơn', 'lại', 'ở', 'dùng', 'sao', 'vì', 'tại', 'làm', 'phần', 'bản', 'lần', 'turn', 'lượt', 'nữa', 'thêm', 'giúp', 'xem', 'hỏi', 'trả',
  'lời', 'chi', 'tiết', 'cụ', 'thể', 'nào', 'ra', 'vào', 'lên', 'xuống', 'nhé', 'ạ', 'à', 'ơi', 'đi', 'nhỉ', 'đâu', 'sử', 'gồm', 'những',
  'why', 'what', 'the', 'a', 'an', 'of', 'in', 'is', 'are', 'to', 'for', 'and', 'how', 'which', 'this', 'that', 'it', 'me', 'about', 'explain',
  'nãy', 'lúc', 'hồi', 'vừa', 'trước', 'sau', 'mới', 'nhất', 'cũ', 'đầu', 'tiên', 'khác', 'nhau', 'so', 'sánh', 'trên', 'dưới',
];

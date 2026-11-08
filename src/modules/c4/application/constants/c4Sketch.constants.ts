/** Leaves ~30 s of the client's 5-minute budget for the network and the PNG transfer. */
export const DEFAULT_C4_DEADLINE_MS = 270_000;

/** Below this not even the architect call reliably finishes; above it the 5-minute promise is broken. */
export const MIN_C4_DEADLINE_MS = 60_000;

export const MAX_C4_DEADLINE_MS = 290_000;

/** The critic only starts before 65% of the deadline, leaving time for its call and one re-render. */
export const CRITIC_CUTOFF_RATIO = 0.65;

/** One stuck provider call (retries + OpenRouter fallback) must not eat the whole budget. */
export const DEFAULT_C4_CALL_TIMEOUT_MS = 150_000;

/** Retrieval is an embedding call + Pinecone query; if it is slower than this the run goes on without notes. */
export const KNOWLEDGE_TIMEOUT_MS = 20_000;

/** A JSON retry only makes sense when a call still fits in the remaining time. */
export const MIN_TIME_FOR_RETRY_MS = 20_000;

export const REVISE_VERDICT = 'revise';

export const PNG_MIME_TYPE = 'image/png';

/** How long a paused run waits for the user's answer before its session is dropped. */
export const C4_SESSION_TTL_MS = 15 * 60_000;

/** Paused runs kept at once; the oldest goes first (each holds a few KB of JSON). */
export const MAX_C4_SESSIONS = 50;

/** The architect may ask at most this many questions; more would cost the user more time than it saves. */
export const MAX_CLARIFICATIONS = 3;

/** Progress messages for streaming clients (Vietnamese UI). */
export const C4Progress = {
  KNOWLEDGE: 'Đang tìm rule thiết kế trong knowledge base…',
  ARCHITECT: (count: number) => `Architect đang phân tích đề và vẽ ${count} diagram…`,
  ARCHITECT_ANSWERS: 'Architect đang cập nhật theo câu trả lời của bạn…',
  DRAFT: (count: number) => `Đang vẽ bù ${count} diagram…`,
  RENDER: 'Đang render PlantUML…',
  REPAIR: (count: number) => `Đang sửa ${count} diagram…`,
  CRITIC: 'Critic đang review ảnh…',
} as const;

/** Notes shown under each image in the client (Vietnamese UI). */
export const C4Notes = {
  REPAIRED: 'đã tự sửa',
  REVIEW_OK: 'critic: không thấy vấn đề',
  REVIEW_SKIPPED_LATE: 'bỏ review (sát giờ)',
  REVIEW_REJECTED_WORSE: 'review: bỏ bản sửa (kém hơn)',
  REVIEW_REJECTED_RENDER: 'review: bản sửa lỗi cú pháp, giữ bản cũ',
  REVIEW_FIXED: 'review: đã sửa',
  DEADLINE: 'hết giờ — dùng bản đã vẽ',
  NO_DIAGRAM: 'Không có diagram cho cấp này',
  TIMED_OUT: 'Hết thời gian trước khi vẽ xong',
} as const;

/** The aux model's clarify-reply parse; on timeout the numbered-answer parser and the defaults are used. */
export const CLARIFY_PARSE_TIMEOUT_MS = 8_000;

export const CLARIFY_PARSE_LABEL = 'c4-clarify-parse';

export const CLARIFY_PARSE_SYSTEM = 'You map a user reply to form slots. Answer with ONE JSON object only.';

/** Steps of the run's model calls (label suffix `c4-<started>-<n>-<step>`). */
export const C4Step = {
  EXTRACT: 'extract',
  ARCHITECT: 'architect',
  REVISE: 'revise',
  REPAIR: 'repair',
  CRITIC: 'critic',
  DESIGN_READ: 'design-read',
  REVIEW: 'review',
  DRAFT: (level: string) => `draft-${level}`,
} as const;

/** Progress messages of the note-05 steps (Vietnamese UI). */
export const C4FlowProgress = {
  ROUTE: 'Đang xác định yêu cầu…',
  EXTRACT: (images: number) => (images > 0 ? `Đang đọc đề từ ${images} ảnh…` : 'Đang phân tích đề…'),
  ANSWERS: 'Đang đọc câu trả lời của bạn…',
  REVISE: (alias: string) => `Đang sửa thiết kế ${alias}…`,
  DESIGN_READ: 'Đang đọc thiết kế của bạn…',
  REVIEW: 'Đang đánh giá thiết kế theo rubric…',
} as const;

/** Readable critic findings (criticNotes, note 05 §6). */
export const CriticNotes = {
  OK: (level: string, issues: string[]) => `${level}: ${issues.length ? issues.join('; ') : 'critic không thấy vấn đề'}`,
  FIXED: (level: string, issues: string[]) => `${level}: đã sửa — ${issues.join('; ') || 'critic đề xuất bản tốt hơn'}`,
  REJECTED_WORSE: (level: string, issues: string[]) => `${level}: critic góp ý (${issues.join('; ')}) nhưng bản sửa kém hơn, giữ bản cũ`,
  REJECTED_RENDER: (level: string, issues: string[]) => `${level}: critic góp ý (${issues.join('; ')}) nhưng bản sửa lỗi cú pháp, giữ bản cũ`,
  SKIPPED_LATE: 'Bỏ bước critic vì sát giờ',
  FAILED: 'Critic không trả lời được, giữ bản đã vẽ',
} as const;

/** Labels of what was reviewed (review markdown header, Vietnamese UI). */
export const DesignLabels = {
  GENERATED: 'thiết kế vừa vẽ',
  USER_IMAGE: 'thiết kế của bạn (ảnh)',
} as const;

/** Shown when the user's design could not be transcribed: the evaluator reads the images instead. */
export const DESIGN_UNREADABLE = '(transcription failed: read the design from the attached images)';

/** `AIRequest.purpose` of C4 model calls (latency metrics). */
export const C4_PURPOSE = 'c4';

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

export const CODE_FENCE = /```(?:json)?\s*\n([\s\S]*?)```/i;

export const REVISE_VERDICT = 'revise';

export const PNG_MIME_TYPE = 'image/png';

/** Notes shown under each image in the client (Vietnamese UI). */
export const C4Notes = {
  REPAIRED: 'đã tự sửa',
  REVIEW_OK: 'review: ok',
  REVIEW_SKIPPED_LATE: 'bỏ review (sát giờ)',
  REVIEW_REJECTED_WORSE: 'review: bỏ bản sửa (kém hơn)',
  REVIEW_REJECTED_RENDER: 'review: bản sửa lỗi cú pháp, giữ bản cũ',
  REVIEW_FIXED: 'review: đã sửa',
  DEADLINE: 'hết giờ — dùng bản đã vẽ',
  NO_DIAGRAM: 'Không có diagram cho cấp này',
  TIMED_OUT: 'Hết thời gian trước khi vẽ xong',
} as const;

import { ClientIntent, RequestIntent } from '../enums/routing.enums';

/**
 * Command words are only read in the head of the text: a pasted problem statement often contains them as
 * features ("khách hàng có thể đánh giá phim", "thêm sản phẩm vào giỏ") — they are not commands there.
 */
export const COMMAND_HEAD_WORDS = 12;

/** Texts up to this length are read whole (a typed command, not a pasted statement). */
export const SHORT_COMMAND_CHARS = 200;

/** "đánh giá / nhận xét / chấm / review" → review the design. */
export const REVIEW_WORDS: readonly string[] = ['đánh giá', 'nhận xét', 'chấm', 'chấm điểm', 'review', 'góp ý', 'phản biện', 'evaluate', 'critique'];

/** "sửa / thêm / bỏ …" → change an existing design. */
export const REVISE_WORDS: readonly string[] = [
  'sửa', 'chỉnh', 'chỉnh sửa', 'thêm', 'bỏ', 'xoá', 'xóa', 'cập nhật', 'đổi', 'thay', 'thay đổi', 'bổ sung',
  'revise', 'fix', 'update', 'add', 'remove', 'change',
];

/** "vẽ / tạo" → draw a diagram. */
export const DRAW_WORDS: readonly string[] = ['vẽ', 'vẽ lại', 'tạo', 'sinh', 'draw', 'generate', 'sketch'];

/** "bạn vẽ", "đã vẽ"…: a reference to something already drawn, not a command to draw (masked before matching). */
export const DRAWN_REFERENCE_PHRASES: readonly string[] = [
  'bạn vẽ', 'bạn đã vẽ', 'đã vẽ', 'vừa vẽ', 'tôi vẽ', 'mình vẽ', 'em vẽ', 'bạn tạo', 'đã tạo', 'you drew', 'i drew',
];

/** Confidence the rules report per decision kind. */
export const INTENT_CONFIDENCE = {
  explicit: 1,
  flag: 0.95,
  rule: 0.9,
  weakRule: 0.75,
  fallback: 0.5,
} as const;

/** Aux intents below this confidence are ignored (the rules' default is used). */
export const AUX_INTENT_MIN_CONFIDENCE = 0.6;

export const CLIENT_INTENTS: Readonly<Record<ClientIntent, RequestIntent | null>> = {
  [ClientIntent.AUTO]: null,
  [ClientIntent.GENERATE]: RequestIntent.C4_GENERATE,
  [ClientIntent.REVIEW]: RequestIntent.C4_REVIEW,
  [ClientIntent.GENERATE_AND_REVIEW]: RequestIntent.C4_GENERATE_AND_REVIEW,
  [ClientIntent.REVISE]: RequestIntent.C4_REVISE,
};

/** Intents that draw a diagram. */
export const GENERATING_INTENTS: readonly RequestIntent[] = [RequestIntent.C4_GENERATE, RequestIntent.C4_GENERATE_AND_REVIEW, RequestIntent.C4_REVISE];

/** Intents that write a design review. */
export const REVIEWING_INTENTS: readonly RequestIntent[] = [RequestIntent.C4_REVIEW, RequestIntent.C4_GENERATE_AND_REVIEW];

/** Accent-free forms that are also common English words ("thêm" → "them"): never cues in accent-free text. */
export const ACCENT_FREE_COLLISIONS: readonly string[] = ['them', 'bo', 'thay'];

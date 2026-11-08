/** "hệ thống đặt vé", "app giao đồ ăn", "system X": the design's name (up to punctuation). */
export const SYSTEM_NAME_PATTERN = /(?<![\p{L}\p{N}])(?:hệ thống|ứng dụng|app|system|nền tảng|platform)\s+[^\n,.?!:;()]{2,50}/iu;

/** A line with one of these words is kept as a design decision. */
export const DESIGN_DECISION_WORDS: readonly string[] = [
  'chọn', 'dùng', 'sử dụng', 'vì', 'quyết định', 'đánh đổi', 'trade-off', 'because', 'use', 'choose', 'chose', 'decision',
];

/** Bullet items that make an answer a component list. */
export const DESIGN_LIST_MIN_ITEMS = 3;
export const DESIGN_NOTE_MAX_ELEMENTS = 30;
export const DESIGN_NOTE_MAX_DECISIONS = 10;
export const DESIGN_NOTE_MAX_ITEM_CHARS = 60;

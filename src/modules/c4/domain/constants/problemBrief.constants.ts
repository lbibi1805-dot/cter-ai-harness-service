import { C4Slot, SlotImpact } from '../enums/c4.enums';
import type { SlotRule } from '../interfaces/problemBrief.interface';

/** HITL rule (note 05 §5): a slot is asked only below this confidence. */
export const CLARIFY_MIN_CONFIDENCE = 0.6;

/** At most this many questions, all in one message. */
export const MAX_CLARIFY_QUESTIONS = 3;

/** Confidence of a default the user accepted by not answering (it stays an assumption). */
export const DEFAULT_ACCEPTED_CONFIDENCE = 0.6;

/** Confidence of a value the user stated (typed text, answers). */
export const USER_STATED_CONFIDENCE = 1;

/** Brief summary shown before the questions: 3–5 bullets. */
export const MIN_SUMMARY_BULLETS = 3;
export const MAX_SUMMARY_BULLETS = 5;
export const SUMMARY_MAX_REQUIREMENTS = 3;

/** Fixed slots, highest impact first (note 05 §5). Rubric is only needed for reviews and is never asked. */
export const SLOT_RULES: readonly SlotRule[] = [
  { slot: C4Slot.SYSTEM_BOUNDARY, impact: SlotImpact.HIGH, question: 'Phạm vi hệ thống cần thiết kế gồm những gì?' },
  { slot: C4Slot.ACTORS, impact: SlotImpact.HIGH, question: 'Ai là người dùng chính (actors) của hệ thống?' },
  {
    slot: C4Slot.LEVELS, impact: SlotImpact.HIGH, question: 'Cần vẽ đến level nào?',
    options: ['Context', 'Context + Container', 'Context + Container + Component'],
  },
  {
    slot: C4Slot.EXTERNAL_SYSTEMS, impact: SlotImpact.MEDIUM,
    question: 'Hệ thống có tích hợp hệ thống ngoài nào không (cổng thanh toán, email, SSO…)?', options: ['Có', 'Không'],
  },
  { slot: C4Slot.TECH_CONSTRAINTS, impact: SlotImpact.MEDIUM, question: 'Có ràng buộc công nghệ nào không (ngôn ngữ, framework, cloud…)?' },
  { slot: C4Slot.RUBRIC, impact: SlotImpact.LOW, question: 'Bài được chấm theo tiêu chí nào?' },
];

/** Impact order for sorting the questions. */
export const IMPACT_RANK: Readonly<Record<SlotImpact, number>> = {
  [SlotImpact.HIGH]: 0,
  [SlotImpact.MEDIUM]: 1,
  [SlotImpact.LOW]: 2,
};

/** Default texts (Vietnamese UI) when a slot is missing (note 05 §5). */
export const SlotDefaults = {
  BOUNDARY: (systemName: string) => `Suy ra từ tên đề: ${systemName || 'hệ thống trong đề'}`,
  ACTORS_FROM_FR: 'Suy ra từ yêu cầu chức năng',
  NONE: 'Không có',
  LEVELS: 'Context + Container',
  TECH: 'Stack phổ biến (ghi rõ là giả định)',
  RUBRIC: 'Rubric C4 chuẩn từ knowledge base',
} as const;

/** Bullet prefixes of the brief summary. */
export const SummaryLabels = {
  SYSTEM: 'Hệ thống',
  BOUNDARY: 'Phạm vi',
  ACTORS: 'Actors',
  EXTERNAL: 'Hệ thống ngoài',
  REQUIREMENTS: 'Yêu cầu chính',
  LEVELS: 'Cần vẽ',
  UNKNOWN: '(chưa rõ)',
} as const;

/** Replies that accept every default ("ok"), matched on the whole (normalized) answer. */
export const ACCEPT_ALL_ANSWERS: readonly string[] = [
  'ok', 'oke', 'okay', 'okie', 'được', 'duoc', 'đồng ý', 'dong y', 'yes', 'y', 'ừ', 'uh', 'ừm', 'có', 'giữ mặc định', 'giu mac dinh',
  'mặc định', 'mac dinh', 'default', 'tiếp tục', 'tiep tuc',
];

/** Answers meaning "none" for list slots. */
export const NONE_ANSWERS: readonly string[] = ['không', 'khong', 'không có', 'khong co', 'none', 'no', 'không cần', 'khong can'];

/** "1. …", "2) …", "3 - …" at the start of a line. */
export const NUMBERED_ANSWER = /^\s*(\d{1,2})\s*[.):\-–]\s*(.+)$/;

/** Separators of list answers ("Khách hàng, Admin và Nhân viên"). */
export const LIST_ANSWER_SEPARATOR = /\s*(?:,|;|\/|\n|\s+và\s+|\s+and\s+)\s*/iu;

/** Trailing punctuation dropped before matching an answer. */
export const TRAILING_PUNCTUATION = /[.!?…]+$/u;

/** Level names in answers, besides the C4_LEVEL_ALIASES keys ("ngữ cảnh", "thành phần"…), matched on whole words. */
export const LEVEL_ANSWER_WORDS: Readonly<Record<string, string>> = {
  'ngữ cảnh': 'context',
  'bối cảnh': 'context',
  'thành phần': 'component',
  'tuần tự': 'sequence',
};

/** Confidence given to a field the model returned without one (a value it wrote is likely right, not sure). */
export const UNSTATED_CONFIDENCE = 0.7;

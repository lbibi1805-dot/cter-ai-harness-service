/** One section of the review's fixed frame (note 05 §6), in output order. */
export interface ReviewSection {
  heading: string;
  /** Lower-case words that identify the section in a model-written heading. */
  keys: readonly string[];
  /** Body when the model left the section out. */
  placeholder: string;
}

export const REVIEW_TABLE_HEADER = '| Tiêu chí | Điểm | Nhận xét |\n|---|---|---|';

/** Summary → criteria table → unmet requirements → C4 notation errors → prioritized fixes. */
export const REVIEW_SECTIONS: readonly ReviewSection[] = [
  { heading: '## Tóm tắt nhận xét', keys: ['tóm tắt', 'tổng quan', 'summary'], placeholder: '_(không có)_' },
  { heading: '## Đánh giá theo tiêu chí', keys: ['tiêu chí', 'bảng', 'rubric', 'điểm'], placeholder: `${REVIEW_TABLE_HEADER}\n| (chưa chấm) | – | – |` },
  { heading: '## Yêu cầu chưa đáp ứng', keys: ['chưa đáp ứng', 'yêu cầu', 'thiếu'], placeholder: '- Không có' },
  { heading: '## Lỗi ký hiệu C4', keys: ['ký hiệu', 'notation', 'lỗi'], placeholder: '- Không có' },
  { heading: '## Đề xuất sửa (ưu tiên)', keys: ['đề xuất', 'sửa', 'gợi ý', 'suggest'], placeholder: '- Không có' },
];

/** Heading matching order: specific sections first ("Đề xuất sửa lỗi" is a fix list, not the notation errors). */
export const REVIEW_MATCH_ORDER: readonly number[] = [4, 2, 3, 1, 0];

/** A markdown heading line (any level). */
export const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

/** A markdown table row. */
export const TABLE_ROW = /^\s*\|.*\|\s*$/;

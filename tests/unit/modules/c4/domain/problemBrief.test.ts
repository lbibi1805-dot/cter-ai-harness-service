import { describe, expect, it } from 'vitest';
import {
  analyzeGaps,
  applyAnswers,
  BriefSource,
  briefSummary,
  C4Level,
  C4Slot,
  ClarifySkipReason,
  emptyBrief,
  ensureReviewFrame,
  isAcceptAll,
  mergeBrief,
  parseNumberedAnswers,
  toBriefOverride,
  toProblemBrief,
  withRequestedLevels,
  type ProblemBrief,
} from '../../../../../src/modules/c4/domain';
import { toSlotAnswers } from '../../../../../src/modules/c4';

const NO_SKIP = { fast: false, reviewWithDesign: false, revise: false };

function brief(over: Partial<Record<string, unknown>> = {}): ProblemBrief {
  return toProblemBrief({
    systemName: { value: 'Hệ thống đặt vé', confidence: 0.95 },
    systemBoundary: { value: 'Web + API đặt vé', confidence: 0.9 },
    actors: { value: ['Khách hàng', 'Admin'], confidence: 0.9 },
    externalSystems: { value: ['VNPay'], confidence: 0.8 },
    functionalReqs: ['Đặt vé', 'Thanh toán', 'Xem lịch chiếu', 'Huỷ vé'],
    techConstraints: { value: [], confidence: 0.7 },
    levels: { value: ['context', 'container'], confidence: 0.9 },
    ...over,
  }, BriefSource.IMAGE);
}

describe('gap analysis (note 05 §5)', () => {
  it('asks nothing when every high/medium slot is ≥ 0.6', () => {
    expect(analyzeGaps(brief(), NO_SKIP)).toEqual({ questions: [], skipped: ClarifySkipReason.CONFIDENT });
  });

  it('asks only low-confidence high/medium slots, highest impact first, at most 3, each with a default', () => {
    const b = brief({
      systemBoundary: { value: '', confidence: 0 },
      actors: { value: [], confidence: 0 },
      levels: { value: [], confidence: 0 },
      externalSystems: { value: [], confidence: 0.2 },
      techConstraints: { value: [], confidence: 0.1 },
    });
    const { questions } = analyzeGaps(b, NO_SKIP);
    expect(questions.map((q) => q.slot)).toEqual([C4Slot.SYSTEM_BOUNDARY, C4Slot.ACTORS, C4Slot.LEVELS]);
    expect(questions.map((q) => q.default)).toEqual(['Suy ra từ tên đề: Hệ thống đặt vé', 'Suy ra từ yêu cầu chức năng', 'Context + Container']);
    expect(questions[2].options).toContain('Context + Container');
  });

  it('medium slots are asked when the high ones are fine; a 0.6 confidence is enough', () => {
    const { questions } = analyzeGaps(brief({ externalSystems: { value: [], confidence: 0.3 }, techConstraints: { value: [], confidence: 0.6 } }), NO_SKIP);
    expect(questions).toEqual([{ slot: C4Slot.EXTERNAL_SYSTEMS, question: expect.any(String), default: 'Không có', options: ['Có', 'Không'] }]);
  });

  it('never asks the rubric (low impact)', () => {
    expect(analyzeGaps(brief({ rubric: [] }), NO_SKIP).questions).toEqual([]);
  });

  it('skips with --fast, for a review with the design present, and for a revision', () => {
    const vague = emptyBrief();
    expect(analyzeGaps(vague, { ...NO_SKIP, fast: true }).skipped).toBe(ClarifySkipReason.FAST);
    expect(analyzeGaps(vague, { ...NO_SKIP, reviewWithDesign: true }).skipped).toBe(ClarifySkipReason.REVIEW_WITH_DESIGN);
    expect(analyzeGaps(vague, { ...NO_SKIP, revise: true }).skipped).toBe(ClarifySkipReason.REVISE);
    expect(analyzeGaps(vague, NO_SKIP).questions).toHaveLength(3);
  });

  it('summarizes the brief in 3–5 bullets', () => {
    const bullets = briefSummary(brief());
    expect(bullets.length).toBeGreaterThanOrEqual(3);
    expect(bullets.length).toBeLessThanOrEqual(5);
    expect(bullets[0]).toBe('Hệ thống: Hệ thống đặt vé');
    expect(bullets.at(-1)).toBe('Cần vẽ: Context + Container');
    expect(briefSummary(emptyBrief()).length).toBeGreaterThanOrEqual(3);
  });
});

describe('brief merge: typed text overrides the images (note 05 §4)', () => {
  it('typed scalars and levels replace the image values; typed list items come first, image items are kept', () => {
    const fromImages = brief();
    const typed = toBriefOverride({ systemName: { value: 'Hệ thống bán vé xem phim', confidence: 0.8 }, actors: ['Nhân viên quầy'], levels: ['component'] });
    const merged = mergeBrief(fromImages, typed);
    expect(merged.systemName).toMatchObject({ value: 'Hệ thống bán vé xem phim', confidence: 1, source: BriefSource.TEXT });
    expect(merged.levels.value).toEqual([C4Level.COMPONENT]);
    expect(merged.actors.value).toEqual(['Nhân viên quầy', 'Khách hàng', 'Admin']);
    expect(merged.actors.source).toBe(BriefSource.TEXT);
    expect(merged.externalSystems.value).toEqual(['VNPay']);            // not stated in the text: image value kept
  });

  it('an empty typed part changes nothing; requested levels win over everything', () => {
    const b = brief();
    expect(mergeBrief(b, toBriefOverride({}))).toEqual(b);
    expect(withRequestedLevels(b, [C4Level.SEQUENCE, C4Level.CONTEXT]).levels).toMatchObject({ value: [C4Level.CONTEXT, C4Level.SEQUENCE], confidence: 1 });
  });

  it('reads the per-item confidence shape of note 05 and ignores design indexes out of range', () => {
    const b = toProblemBrief({
      actors: [{ value: 'Khách hàng', confidence: 0.9 }, { value: 'Admin', confidence: 0.5 }],
      userDesign: { present: true, imageIndexes: [1, 7] },
    }, BriefSource.IMAGE, 2);
    expect(b.actors).toMatchObject({ value: ['Khách hàng', 'Admin'], confidence: 0.7 });
    expect(b.userDesign).toEqual({ present: true, imageIndexes: [1] });
  });
});

describe('clarify answers (note 05 §5 rule 3)', () => {
  const vague = brief({ systemBoundary: { value: '', confidence: 0 }, levels: { value: [], confidence: 0 }, externalSystems: { value: ['VNPay'], confidence: 0.3 } });
  const { questions } = analyzeGaps(vague, NO_SKIP);

  it('"ok", blank and "đồng ý" keep every default', () => {
    for (const reply of ['ok', 'OK.', '', '  đồng ý ', 'Giữ mặc định']) expect(isAcceptAll(reply)).toBe(true);
    expect(isAcceptAll('không')).toBe(false);
    expect(parseNumberedAnswers('ok', questions)).toEqual({});
    const after = applyAnswers(vague, questions, {});
    expect(after.systemBoundary).toMatchObject({ value: 'Suy ra từ tên đề: Hệ thống đặt vé', source: BriefSource.DEFAULT });
    expect(after.levels.value).toEqual([C4Level.CONTEXT, C4Level.CONTAINER]);
    expect(after.externalSystems.value).toEqual(['VNPay']);
    expect(analyzeGaps(after, NO_SKIP).questions).toEqual([]);      // settled: not asked again
  });

  it('a partial numbered reply fills those slots only', () => {
    const answers = parseNumberedAnswers('2) Context, Container và Component\n3. không', questions)!;
    expect(answers).toEqual({ [C4Slot.LEVELS]: 'Context, Container và Component', [C4Slot.EXTERNAL_SYSTEMS]: 'không' });
    const after = applyAnswers(vague, questions, answers);
    expect(after.levels).toMatchObject({ value: [C4Level.CONTEXT, C4Level.CONTAINER, C4Level.COMPONENT], confidence: 1, source: BriefSource.USER_ANSWER });
    expect(after.externalSystems).toMatchObject({ value: [], confidence: 1 });
    expect(after.systemBoundary.source).toBe(BriefSource.DEFAULT);
  });

  it('one question takes the whole reply; several unnumbered questions need the aux model', () => {
    expect(parseNumberedAnswers('chỉ cần context', questions.slice(1, 2))).toEqual({ [C4Slot.LEVELS]: 'chỉ cần context' });
    expect(parseNumberedAnswers('chỉ cần context, không có hệ thống ngoài', questions)).toBeNull();
  });

  it('the aux reply is restricted to the asked slots', () => {
    expect(toSlotAnswers('{"answers":{"levels":"ngữ cảnh","rubric":"x","actors":"A"}}', questions)).toEqual({ [C4Slot.LEVELS]: 'ngữ cảnh' });
    expect(toSlotAnswers('no json', questions)).toBeNull();
    expect(applyAnswers(vague, questions, { [C4Slot.LEVELS]: 'ngữ cảnh' }).levels.value).toEqual([C4Level.CONTEXT]);
  });
});

describe('review frame (note 05 §6)', () => {
  const HEADINGS = ['## Tóm tắt nhận xét', '## Đánh giá theo tiêu chí', '## Yêu cầu chưa đáp ứng', '## Lỗi ký hiệu C4', '## Đề xuất sửa (ưu tiên)'];
  const headings = (md: string) => md.split('\n').filter((l) => l.startsWith('## '));

  it('reorders sections, canonical headings, placeholders for missing ones', () => {
    const md = ensureReviewFrame('### Đề xuất sửa\n1. Thêm cache\n\n# Tóm tắt\nỔn.\n\n## Lỗi ký hiệu\n- API thiếu tech');
    expect(headings(md)).toEqual(HEADINGS);
    expect(md.indexOf('Ổn.')).toBeLessThan(md.indexOf('API thiếu tech'));
    expect(md.indexOf('API thiếu tech')).toBeLessThan(md.indexOf('1. Thêm cache'));
    expect(md).toContain('## Yêu cầu chưa đáp ứng\n\n- Không có');
    expect(md).toContain('| Tiêu chí | Điểm | Nhận xét |');
  });

  it('text before any heading is the summary; a table without header gets one; "Đề xuất sửa lỗi" is the fix list', () => {
    const md = ensureReviewFrame('Tốt.\n## Điểm\n| Coverage | 8/10 | ok |\n## Đề xuất sửa lỗi\n1. X');
    expect(headings(md)).toEqual(HEADINGS);
    expect(md).toMatch(/## Tóm tắt nhận xét\n\nTốt\./);
    expect(md).toContain('| Tiêu chí | Điểm | Nhận xét |\n|---|---|---|\n| Coverage | 8/10 | ok |');
    expect(md).toMatch(/## Đề xuất sửa \(ưu tiên\)\n\n1\. X/);
    expect(md).toContain('## Lỗi ký hiệu C4\n\n- Không có');
  });
});

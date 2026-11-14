import { describe, expect, it } from 'vitest';
import { QuestionKind, QuestionMarker, allQuestionPoints, classifyQuestion, continuationTail, splitQuestions } from '../../../../src/shared/text';

describe('splitQuestions (12/11 plan 08, rule-based)', () => {
  it('named markers: "Câu 1 … Câu 3" with a shared case study as preamble and marks per question', () => {
    const split = splitQuestions([
      'Cho hệ thống đặt vé xe khách trực tuyến.',
      'Câu 1 (2 điểm): Trình bày kiến trúc tổng thể của hệ thống.',
      '**Câu 2.** Định nghĩa microservice là gì?',
      'Câu 3 (1,5đ): Tính thông lượng nếu mỗi request mất 20 ms.',
    ].join('\n'));
    expect(split.marker).toBe(QuestionMarker.NAMED);
    expect(split.preamble).toBe('Cho hệ thống đặt vé xe khách trực tuyến.');
    expect(split.questions.map((q) => [q.id, q.label, q.points, q.kind])).toEqual([
      ['Q1', 'Câu 1', 2, QuestionKind.ESSAY],
      ['Q2', 'Câu 2', undefined, QuestionKind.SHORT],
      ['Q3', 'Câu 3', 1.5, QuestionKind.CALC],
    ]);
  });

  it('numbered items count only when each one asks something (a list of requirements is one question)', () => {
    const asks = splitQuestions('1. Explain the role of a message queue.\n2. Compare REST and gRPC.\n3. Why is idempotency important?');
    expect(asks.marker).toBe(QuestionMarker.NUMBERED);
    expect(asks.questions.map((q) => q.label)).toEqual(['Question 1', 'Question 2', 'Question 3']);
    const requirements = splitQuestions('Design a booking system with:\n1. users can book seats online\n2. payments go through a gateway');
    expect(requirements.questions).toHaveLength(1);
    expect(requirements.marker).toBe(QuestionMarker.NONE);
  });

  it('lettered sub-questions and several "?" sentences', () => {
    expect(splitQuestions('a) Nêu định nghĩa kiểm thử hộp đen.\nb) Giải thích ưu điểm của kiểm thử hộp trắng.').questions.map((q) => q.label)).toEqual(['a)', 'b)']);
    const marks = splitQuestions('Here is some context. What is a deadline in RTOS? Why does priority inversion happen?');
    expect(marks.marker).toBe(QuestionMarker.QUESTION_MARK);
    // Text before the first "?" belongs to the first question (it is usually its context).
    expect(marks.questions.map((q) => q.text)).toEqual(['Here is some context. What is a deadline in RTOS?', 'Why does priority inversion happen?']);
  });

  it('one plain question stays one question; kinds and all marks are detected', () => {
    expect(splitQuestions('Giải thích cơ chế priority inheritance').questions).toHaveLength(1);
    expect(classifyQuestion('Vẽ sơ đồ use case cho hệ thống')).toBe(QuestionKind.DIAGRAM);
    expect(classifyQuestion('What is a mutex?')).toBe(QuestionKind.SHORT);
    expect(allQuestionPoints('Câu 1 (2 điểm) … Câu 2 (3 điểm) … Câu 3 (0,5đ)')).toEqual([2, 3, 0.5]);
  });
});

describe('continuationTail', () => {
  it('drops the repeated end of the cut text, keeps a clean continuation as is', () => {
    const cut = 'The scheduler picks the highest priority ready task and preempts the running one when';
    expect(continuationTail(cut, 'preempts the running one when a higher priority task arrives.')).toBe(' a higher priority task arrives.');
    expect(continuationTail(cut, ' a higher priority task arrives.')).toBe(' a higher priority task arrives.');
  });
});

import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ANSWER_COMPLETENESS, buildAnswerPlan, incompleteSentences, scoreAnswerCase, type AnswerGoldenCase } from '../../../../src/modules/chat';

const GOLDEN = path.resolve(__dirname, '../../../../evals/golden/multi-question.jsonl');
const cases = fs.readFileSync(GOLDEN, 'utf-8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as AnswerGoldenCase);
const words = (n: number) => Array.from({ length: n }, () => 'từ').join(' ');

describe('evals/golden/multi-question.jsonl (12/11 plan 08 Bước 8, offline)', () => {
  it('has the planned shapes (3, 5, 8, 12 questions, mixed kinds, one short) and the splitter finds each count', () => {
    expect(cases.map((c) => c.expected_questions)).toEqual(expect.arrayContaining([3, 5, 8, 12, 1]));
    for (const testCase of cases) expect(buildAnswerPlan(testCase.question, DEFAULT_ANSWER_COMPLETENESS).questions, testCase.id).toHaveLength(testCase.expected_questions);
  });

  it('scores coverage, short answers, truncation and incomplete sentences', () => {
    const mq01 = cases.find((c) => c.id === 'MQ01')!;
    const full = [1, 2, 3].map((n) => `**Câu ${n}.** ${words(300)}.`).join('\n\n');
    expect(scoreAnswerCase(mq01, full, false, DEFAULT_ANSWER_COMPLETENESS)).toMatchObject({ coverage: 1, shortAnswers: [], incompleteSentences: 0, pass: true });
    const partial = `**Câu 1.** ${words(300)}.\n\n**Câu 2.** ${words(100)}`;
    expect(scoreAnswerCase(mq01, partial, true, DEFAULT_ANSWER_COMPLETENESS)).toMatchObject({ coverage: 2 / 3, shortAnswers: ['Q2', 'Q3'], truncated: true, incompleteSentences: 1, pass: false });
    expect(incompleteSentences('Một câu đầy đủ.\n\n- ý cụt\n- ý đầy đủ.\n\n```c\nint x\n```')).toBe(1);
  });
});

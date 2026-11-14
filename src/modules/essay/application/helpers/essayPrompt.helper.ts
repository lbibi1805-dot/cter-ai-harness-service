import { CONTEXT_CLOSE, CONTEXT_OPEN, ESSAY_VERB_EXPECTATIONS, VERB_LINE } from '../../domain/constants/essay.constants';
import { EssayVerb } from '../../domain/enums/essay.enums';
import type { EssayAnalysis } from '../../domain/interfaces/essay.interface';
import type { EssayPromptParts } from '../interfaces/essayService.interface';

/** `prompts/skills/essay/verb-expectations.md` body (`list: …` lines) → text per verb; unknown keys ignored. */
export function parseVerbExpectations(body: string | null | undefined): Partial<Record<EssayVerb, string>> {
  const known = new Set<string>(Object.values(EssayVerb));
  const table: Partial<Record<EssayVerb, string>> = {};
  for (const line of (body ?? '').split(/\r?\n/)) {
    const match = VERB_LINE.exec(line);
    if (match && known.has(match[1].toLowerCase())) table[match[1].toLowerCase() as EssayVerb] = match[2].trim();
  }
  return table;
}

/** Expectations of the verbs in the question (from prompts/ when given, else the built-in copy); all of them when none was found. */
export function verbExpectationLines(verbs: EssayVerb[], table: Partial<Record<EssayVerb, string>> = {}): string[] {
  const list = verbs.length ? verbs : Object.values(EssayVerb);
  return list.map((verb) => `- ${table[verb] ?? ESSAY_VERB_EXPECTATIONS[verb]}`);
}

/** The writing call's user content: context with chunk ids, rubric, verb table, optional exemplar, task, question. */
export function buildEssayUserContent(parts: EssayPromptParts): string {
  const context = parts.chunks
    .map((chunk) => `[c:${chunk.chunkId}] ${chunk.source} > ${chunk.heading}\n${chunk.text}`)
    .join('\n\n');
  const task = [
    `subject: ${parts.subject || '-'}`,
    'aspects (trả lời đủ, đúng thứ tự):',
    ...parts.aspects.map((aspect, index) => `${index + 1}. ${aspect}`),
    `target_words: ${parts.targetWords}`,
    ...(parts.questionTargets?.length ? ['target_words theo từng câu:', ...parts.questionTargets.map((q) => `- ${q.label}: ${q.targetWords}`)] : []),
  ].join('\n');
  return [
    parts.chunks.length ? `${CONTEXT_OPEN}\n${context}\n${CONTEXT_CLOSE}` : `${CONTEXT_OPEN}\n(không có tài liệu phù hợp)\n${CONTEXT_CLOSE}`,
    `<essay_rubric>\n${parts.rubric}\n</essay_rubric>`,
    `<verb_expectations>\n${parts.verbLines.join('\n')}\n</verb_expectations>`,
    ...(parts.exemplar ? [`<exemplar>\n${parts.exemplar}\n</exemplar>`] : []),
    `<task>\n${task}\n</task>`,
    `<question>\n${parts.question}\n</question>`,
  ].join('\n\n');
}

/** Step ⑦ input for the aux model. */
export function buildSelfCheckInput(analysis: EssayAnalysis, targetWords: number, outline: string, essay: string): string {
  return [
    `aspects:\n${analysis.aspects.map((aspect, index) => `${index + 1}. ${aspect}`).join('\n')}`,
    `target_words: ${targetWords}`,
    `<outline>\n${outline}\n</outline>`,
    `<essay>\n${essay}\n</essay>`,
  ].join('\n\n');
}

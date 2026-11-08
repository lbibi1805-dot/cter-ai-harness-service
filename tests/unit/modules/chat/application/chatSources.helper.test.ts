import { describe, it, expect } from 'vitest';
import { buildAnswerSources } from '../../../../../src/modules/chat/application/helpers/chatSources.helper';
import { MAX_ANSWER_SOURCES } from '../../../../../src/modules/chat/application/constants/chatSources.constants';
import { AgentStopReason } from '../../../../../src/modules/agent/domain';
import type { CitedChunk } from '../../../../../src/modules/retrieval';

function chunk(source: string, heading: string, score?: number, rerankScore?: number): CitedChunk {
  return { chunkId: `${source}#${heading}`, text: 't', source, heading, parentHeading: '', tokenCount: 1, score, rerankScore };
}

describe('buildAnswerSources', () => {
  it('dedupes by file keeping the best-scoring heading, best file first', () => {
    const sources = buildAnswerSources({
      contexts: [chunk('a.md', 'Intro', 0.4), chunk('b.md', 'Mutex', 0.7), chunk('a.md', 'Details', 0.9)],
    });
    expect(sources).toEqual([
      { file: 'a.md', heading: 'Details', score: 0.9 },
      { file: 'b.md', heading: 'Mutex', score: 0.7 },
    ]);
  });

  it('prefers the rerank score and clamps to [0, 1]', () => {
    const sources = buildAnswerSources({ contexts: [chunk('a.md', 'H', 0.3, 0.95), chunk('b.md', 'H', 1.2), chunk('c.md', 'H', -0.1)] });
    expect(sources.map((s) => s.score)).toEqual([1, 0.95, 0]);
  });

  it(`keeps at most ${MAX_ANSWER_SOURCES} files`, () => {
    const contexts = Array.from({ length: 9 }, (_, i) => chunk(`f${i}.md`, 'H', i / 10));
    const sources = buildAnswerSources({ contexts });
    expect(sources).toHaveLength(MAX_ANSWER_SOURCES);
    expect(sources[0]).toMatchObject({ file: 'f8.md', score: 0.8 });
  });

  it('agent mode: adds files the tools returned without a scored passage (score null, listed last)', () => {
    const sources = buildAnswerSources({
      contexts: [chunk('read.md', '', undefined), chunk('hit.md', 'H', 0.6)],
      agent: { stopReason: AgentStopReason.FINAL_ANSWER, toolCalls: 2, sourcesRead: ['hit.md', 'read.md', 'listed.md'], usage: { inputTokens: 0, outputTokens: 0 }, steps: [], modelCalls: 2, durationMs: 1 },
    });
    expect(sources).toEqual([
      { file: 'hit.md', heading: 'H', score: 0.6 },
      { file: 'read.md', heading: '', score: null },
      { file: 'listed.md', heading: '', score: null },
    ]);
  });
});

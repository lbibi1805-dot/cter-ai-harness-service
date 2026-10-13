// L1 — retrieval path under concurrency: RerankingRetriever + the real Pinecone
// SDK against a fake /rerank API with latency, injected 500s and slow responses.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PineconeReranker, RerankingRetriever, type ChunkRetriever } from '../src/modules/rerank';
import type { CitedChunk } from '../src/types';
import { activeTimers, FakeRerankServer, heapUsedMb, latency, recordMetrics, runPool, sleep } from './loadKit';

const CANDIDATES = 40;
const TOP_N = 8;
const FALLBACK_TOP_K = 20;
const VECTOR_LATENCY_MS = 15;
const TOPICS = ['boundary value analysis', 'equivalence partitioning', 'statement coverage', 'acceptance testing', 'load testing jmeter', 'static review walkthrough'];

/** 40 chunks; every fifth is long enough to be split into passages. */
function candidates(question: string): CitedChunk[] {
  return Array.from({ length: CANDIDATES }, (_, i) => {
    const topic = TOPICS[i % TOPICS.length];
    const filler = i % 5 === 0 ? ' detail'.repeat(600) : '';
    return {
      chunkId: `c${i}`, source: `software-testing/chapter-${i % 7}.md`, heading: `## ${topic}`, parentHeading: '',
      text: `${topic} notes ${i}.${filler} ${i % 5 === 0 ? question : ''}`, tokenCount: 200, score: 0.8 - i / 100,
    };
  });
}

const vectorSearch: ChunkRetriever = {
  retrieve: async (question) => {
    await sleep(VECTOR_LATENCY_MS + Math.random() * 10);
    return candidates(question);
  },
};

describe('L1 retrieval with reranking under load', () => {
  const rerankApi = new FakeRerankServer();
  beforeAll(() => rerankApi.start());
  afterAll(() => rerankApi.stop());

  it('stays correct under errors and timeouts, with bounded latency and no heap growth', async () => {
    const timeoutMs = 400;
    rerankApi.behaviour = { latencyMs: 40, jitterMs: 60, errorRate: 0.05, slowRate: 0.03, slowMs: 900 };
    const retriever = new RerankingRetriever(
      vectorSearch,
      new PineconeReranker({ apiKey: 'load-test', model: 'bge-reranker-v2-m3', controllerHostUrl: rerankApi.baseUrl }),
      { topN: TOP_N, fallbackTopK: FALLBACK_TOP_K, timeoutMs, maxQueryChars: 600, maxDocumentChars: 1500, label: 'load' },
    );

    const rounds = 3;
    const perRound = 400;
    const concurrency = 40;
    const heap: number[] = [heapUsedMb()];
    const durations: number[] = [];
    let reranked = 0;
    let fallbacks = 0;
    let failed = 0;
    let wallMs = 0;

    for (let round = 0; round < rounds; round++) {
      const { outcomes, wallMs: roundWall } = await runPool(perRound, concurrency, (i) => retriever.retrieve(`what is ${TOPICS[i % TOPICS.length]} in practice?`));
      wallMs += roundWall;
      for (const o of outcomes) {
        durations.push(o.ms);
        if (!o.ok) failed++;
        else if (o.value!.length === TOP_N && o.value![0].rerankScore !== undefined) reranked++;
        else if (o.value!.length === FALLBACK_TOP_K && o.value![0].rerankScore === undefined) fallbacks++;
      }
      heap.push(heapUsedMb());
    }
    await sleep(1_000); // let the slow fake responses finish before counting

    const total = rounds * perRound;
    const stats = latency(durations);
    recordMetrics('L1-retrieval', {
      requests: total, concurrency, throughputPerSec: Math.round(total / (wallMs / 1000)),
      reranked, fallbacks, failed, injectedErrors: rerankApi.errors, injectedSlow: rerankApi.slow,
      latencyMs: stats, heapMbPerRound: heap, maxDocumentsPerRequest: rerankApi.maxDocuments,
    });

    expect(failed).toBe(0);
    expect(reranked + fallbacks).toBe(total);
    expect(fallbacks).toBe(rerankApi.errors + rerankApi.slow);
    expect(rerankApi.maxDocuments).toBeLessThanOrEqual(100);
    expect(stats.max).toBeLessThan(timeoutMs + VECTOR_LATENCY_MS + 250);
    expect(heap[rounds] - heap[1]).toBeLessThan(8);
  });

  it('leaves no timers behind after thousands of calls with a long timeout', async () => {
    rerankApi.behaviour = { latencyMs: 2, jitterMs: 3, errorRate: 0, slowRate: 0, slowMs: 0 };
    const retriever = new RerankingRetriever(
      vectorSearch,
      new PineconeReranker({ apiKey: 'load-test', model: 'bge-reranker-v2-m3', controllerHostUrl: rerankApi.baseUrl }),
      { topN: TOP_N, fallbackTopK: FALLBACK_TOP_K, timeoutMs: 60_000, maxQueryChars: 600, maxDocumentChars: 1500, label: 'timers' },
    );
    await retriever.retrieve('warm up');
    const before = activeTimers();
    const { outcomes } = await runPool(1_000, 50, () => retriever.retrieve('boundary value analysis'));
    const after = activeTimers();
    recordMetrics('L1-timer-hygiene', { calls: 1_000, timeoutMs: 60_000, activeTimersBefore: before, activeTimersAfter: after });

    expect(outcomes.every((o) => o.ok)).toBe(true);
    // A timeout that is not cleared would leave ~1 000 pending 60 s timers here.
    expect(after - before).toBeLessThanOrEqual(5);
  });
});

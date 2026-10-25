// L2 — agent answers under concurrency: real AnswerService + AgentRunner + the
// OpenAI SDK against a fake Responses API (with latency and injected 500s), and
// search_vault going through the reranking retriever + fake Pinecone /rerank.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgentModule, createOpenAIToolModelFactory, type AnswerResult } from '../../src/modules/agent';
import { AnswerMode, type AgentLimits } from '../../src/modules/agent/domain';
import { AIProvider } from '../../src/modules/ai';
import { createRerankModule, DEFAULT_RERANK_CONFIG, RerankProvider, type ChunkRetriever, type RerankConfig } from '../../src/modules/rerank';
import { FileVaultRepository } from '../../src/modules/vault';
import type { CitedChunk } from '../../src/modules/retrieval';
import { createFakeAiModule } from '../support/aiFixture';
import { FakeOpenAIResponsesServer, type ResponsesRequestBody } from '../support/fakeOpenAIResponsesServer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FakeRerankServer, heapUsedMb, latency, recordMetrics, runPool, sleep } from './loadKit';

const DOC = 'software-testing/Chapter 4/02 - Black-Box.md';

/**
 * A "lazy" model like the one measured in production: it answers from memory
 * unless the API forces a tool call (tool_choice=required). After a tool
 * result it writes the grounded answer.
 */
function lazyModel(body: ResponsesRequestBody) {
  const hasToolOutput = body.input.some((item) => item.type === 'function_call_output');
  if (hasToolOutput) return { text: `grounded answer\n\n## References\n- ${DOC}` };
  if (body.tool_choice === 'required') return { functionCall: { name: 'search_vault', arguments: { query: 'boundary value analysis' } } };
  return { text: 'answer from memory\n\n## References\nThe provided documents were not retrieved.' };
}

const RERANK_CONFIG: RerankConfig = { ...DEFAULT_RERANK_CONFIG, provider: RerankProvider.PINECONE, timeoutMs: 1_000 };

function agentLimits(minToolCalls: number): AgentLimits {
  return { maxToolCalls: 4, minToolCalls, maxDurationMs: 30_000 };
}

const vectorSearch: ChunkRetriever = {
  retrieve: async () => {
    await sleep(10);
    return Array.from({ length: 40 }, (_, i): CitedChunk => ({
      chunkId: `c${i}`, source: i === 7 ? DOC : `software-testing/other-${i}.md`, heading: i === 7 ? 'Boundary value analysis' : `Topic ${i}`,
      parentHeading: '', text: i === 7 ? 'Boundary value analysis picks values at the edges.' : `Unrelated notes ${i}.`, tokenCount: 20, score: 0.9 - i / 100,
    }));
  },
};

describe('L2 agent answers under load', () => {
  const openai = new FakeOpenAIResponsesServer();
  const rerankApi = new FakeRerankServer();
  let workDir = '';

  beforeAll(async () => {
    await openai.start();
    await rerankApi.start();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-load-'));
  });
  afterAll(async () => {
    await openai.stop();
    await rerankApi.stop();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  async function runScenario(minToolCalls: number, total: number, concurrency: number) {
    const ai = createFakeAiModule(async (_content, _system, model) => ({ text: 'single-shot fallback', model }));
    const ranking = createRerankModule(RERANK_CONFIG, { pineconeApiKey: 'k', controllerHostUrl: rerankApi.baseUrl });
    const searcher = ranking.wrap(vectorSearch, { topN: 10, fallbackTopK: 10, label: 'agent' });
    const { answers } = createAgentModule({ limits: agentLimits(minToolCalls), systemPrompt: 'sys' }, {
      singleShot: ai.invocation,
      vaultRepository: new FileVaultRepository(workDir),
      createModel: createOpenAIToolModelFactory({ apiKey: 'k', timeoutMs: 10_000, baseURL: openai.baseURL, sleep: async () => undefined }),
      retrieval: null,
      searcher: { search: (q) => searcher.retrieve(q) },
    });

    const requestsBefore = openai.requests.length;
    const heapBefore = heapUsedMb();
    const { outcomes, wallMs } = await runPool(total, concurrency, (i) => answers.answer({
      provider: AIProvider.OPENAI, model: 'gpt-6-astra', mode: AnswerMode.AGENT, label: `q${i}`,
      content: { textContent: `Question ${i}: how is boundary value analysis applied?`, imageBuffers: [] },
    }));
    const results = outcomes.filter((o) => o.ok).map((o) => o.value as AnswerResult);
    const agentRuns = results.filter((r) => r.mode === AnswerMode.AGENT && r.agent);
    return {
      outcomes, results, wallMs,
      metrics: {
        answers: total, concurrency, minToolCalls,
        throughputPerSec: Math.round((total / wallMs) * 1000 * 10) / 10,
        failed: outcomes.filter((o) => !o.ok).length,
        agentAnswers: agentRuns.length,
        fallbackToSingleShot: results.filter((r) => r.fallbackReason).length,
        meanToolCalls: Math.round((agentRuns.reduce((s, r) => s + r.agent!.toolCalls, 0) / Math.max(1, agentRuns.length)) * 100) / 100,
        grounded: agentRuns.filter((r) => r.agent!.sourcesRead.includes(DOC)).length,
        groundedShare: Math.round((agentRuns.filter((r) => r.agent!.sourcesRead.includes(DOC)).length / Math.max(1, agentRuns.length)) * 1000) / 10,
        modelRequests: openai.requests.length - requestsBefore,
        latencyMs: latency(outcomes.map((o) => o.ms)),
        heapMbBeforeAfter: [heapBefore, heapUsedMb()],
      },
    };
  }

  it('before the fix (minToolCalls=0) the lazy model never reads the vault', async () => {
    openai.responder = (body) => lazyModel(body);
    openai.latencyMs = 20;
    rerankApi.behaviour = { latencyMs: 30, jitterMs: 30, errorRate: 0, slowRate: 0, slowMs: 0 };
    const run = await runScenario(0, 100, 20);
    recordMetrics('L2-agent-before-minToolCalls0', run.metrics);
    expect(run.metrics.failed).toBe(0);
    expect(run.metrics.agentAnswers).toBe(100);
    expect(run.metrics.meanToolCalls).toBe(0);
    expect(run.metrics.groundedShare).toBe(0);
  });

  it('with minToolCalls=1 every answer searches the vault, survives injected 500s and keeps heap flat', async () => {
    let n = 0;
    openai.responder = (body) => (++n % 25 === 0 ? { status: 500, error: 'injected' } : lazyModel(body));
    openai.latencyMs = 20;
    rerankApi.behaviour = { latencyMs: 30, jitterMs: 30, errorRate: 0.05, slowRate: 0.02, slowMs: 1_500 };
    rerankApi.errors = 0;
    rerankApi.slow = 0;
    const requestsBefore = openai.requests.length;
    const run = await runScenario(1, 300, 30);
    recordMetrics('L2-agent-after-minToolCalls1', { ...run.metrics, injectedRerankErrors: rerankApi.errors, injectedRerankSlow: rerankApi.slow });

    expect(run.metrics.failed).toBe(0);
    expect(run.metrics.agentAnswers + run.metrics.fallbackToSingleShot).toBe(300);
    expect(run.metrics.agentAnswers).toBeGreaterThanOrEqual(297); // transient 500s are retried by the adapter
    expect(run.metrics.meanToolCalls).toBeGreaterThanOrEqual(1);
    // Each answer makes one search; a failed/slow rerank degrades to the cosine
    // order, where the right file sits at rank 8 — outside the 5 results shown.
    expect(run.metrics.grounded).toBe(run.metrics.agentAnswers - (rerankApi.errors + rerankApi.slow));
    const first = openai.requests.slice(requestsBefore).filter((r) => !r.input.some((i) => i.type === 'function_call_output'));
    expect(first.length).toBeGreaterThanOrEqual(300);
    expect(first.every((r) => r.tool_choice === 'required')).toBe(true);
    expect(run.metrics.heapMbBeforeAfter[1] - run.metrics.heapMbBeforeAfter[0]).toBeLessThan(15);
  });
});

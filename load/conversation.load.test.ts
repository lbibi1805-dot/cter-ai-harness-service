// L3 — soak of the real chat loop: 120 [CFH:REQUEST]s (agent + single-shot)
// queued on a fake Canvas, answered by the REAL ConversationPoller round by
// round (5 per round), agent search going through the reranker. Checks that
// nothing is lost or answered twice and that memory stays flat across rounds.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeCanvasServer } from '../src/e2e/fakeCanvasServer';
import { FakeOpenAIResponsesServer } from '../src/e2e/fakeOpenAIResponsesServer';
import { createAgentModule } from '../src/modules/agent';
import { createOpenAIToolModelFactory } from '../src/modules/agent/infrastructure/openaiResponsesToolModel';
import { AIInvocationService, PromptPreparer } from '../src/modules/ai';
import { createRerankModule, DEFAULT_RERANK_CONFIG, RerankProvider, type ChunkRetriever } from '../src/modules/rerank';
import { FileVaultRepository } from '../src/modules/vault/infrastructure/fileVault.repository';
import { MAX_CONV_PER_ROUND, ConversationPoller } from '../src/orchestrator/conversationPoller';
import { StorageProvider } from '../src/shared/database/database.enums';
import { StateManager } from '../src/state/stateManager';
import type { AIAdapter, AppConfig, CanvasAccountConfig, CitedChunk } from '../src/types';
import { parseReplyMessage } from '../src/utils/conversationMessageParser';
import { FakeRerankServer, heapUsedMb, latency, recordMetrics, sleep } from './loadKit';

const REQUESTS = 120;
const DOC = 'software-testing/Chapter 4/03 - White-Box.md';

describe('L3 conversation soak', () => {
  const canvas = new FakeCanvasServer();
  const openai = new FakeOpenAIResponsesServer();
  const rerankApi = new FakeRerankServer();
  let workDir = '';

  beforeAll(async () => {
    await canvas.start();
    await openai.start();
    await rerankApi.start();
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-soak-'));
  });
  afterAll(async () => {
    await canvas.stop();
    await openai.stop();
    await rerankApi.stop();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('answers every request exactly once, in bounded rounds, without memory growth', async () => {
    const account: CanvasAccountConfig = { url: canvas.baseUrl, apiKey: 'token', index: 1 };
    const config: AppConfig = {
      accounts: [account], aiKeys: { openai: 'k' },
      defaultModels: { claude: 'c', gemini: 'g', grok: 'x', openai: 'gpt-6-astra' },
      modelFallback: { claude: [], gemini: [], grok: [], openai: [] },
      pollIntervalMs: 1000, maxRetryCount: 0, systemPrompt: 'sys', knowledgeContent: '', grokBaseUrl: '',
      aiTimeoutMs: 10_000, gmail: {}, canvasFolder: { materials: 'Materials2', input: 'Q', output: 'A' },
      database: { provider: StorageProvider.FILE }, pollAutostart: false,
      agent: { maxToolCalls: 4, minToolCalls: 1, maxDurationMs: 30_000 },
      rerank: { ...DEFAULT_RERANK_CONFIG, provider: RerankProvider.PINECONE, timeoutMs: 1_000 },
    };

    openai.latencyMs = 15;
    openai.responder = (body) => (body.input.some((i) => i.type === 'function_call_output')
      ? { text: `White-box answer.\n\n## References\n- ${DOC}` }
      : { functionCall: { name: 'search_vault', arguments: { query: 'statement coverage' } } });
    rerankApi.behaviour = { latencyMs: 20, jitterMs: 20, errorRate: 0.05, slowRate: 0, slowMs: 0 };

    const singleShot: AIAdapter = { validate: async () => undefined, process: async () => { await sleep(10); return 'single-shot answer'; } };
    const ai = new AIInvocationService(config, new PromptPreparer('sys', ''), { createAdapter: () => singleShot, sleep: async () => undefined });
    const vector: ChunkRetriever = {
      retrieve: async () => Array.from({ length: 40 }, (_, i): CitedChunk => ({
        chunkId: `c${i}`, source: i === 3 ? DOC : `software-testing/other-${i}.md`, heading: i === 3 ? 'Statement coverage' : `Topic ${i}`,
        parentHeading: '', text: i === 3 ? 'Statement coverage counts executed statements.' : `Notes ${i}.`, tokenCount: 10, score: 0.9 - i / 100,
      })),
    };
    const ranking = createRerankModule(config.rerank, { pineconeApiKey: 'k', controllerHostUrl: rerankApi.baseUrl });
    const searcher = ranking.wrap(vector, { topN: 10, fallbackTopK: 10, label: 'agent' });
    const { answers } = createAgentModule(config, {
      ai,
      vaultRepository: new FileVaultRepository(workDir),
      createModel: createOpenAIToolModelFactory({ apiKey: 'k', timeoutMs: 10_000, baseURL: openai.baseURL, sleep: async () => undefined }),
      searcher: { search: (q) => searcher.retrieve(q) },
    });
    const state = new StateManager(path.join(workDir, 'processed.json'));
    state.load();
    const poller = new ConversationPoller(config, state, undefined, undefined, answers);

    const requestIds: number[] = [];
    for (let i = 0; i < REQUESTS; i++) {
      requestIds.push(i % 2 === 0
        ? canvas.addConversationRequest(`Agent question ${i}: explain statement coverage`, 'openai', { model: 'gpt-6-astra', mode: 'agent' })
        : canvas.addConversationRequest(`Single-shot question ${i}`, 'gemini'));
    }

    const roundMs: number[] = [];
    const heap: number[] = [heapUsedMb()];
    const expectedRounds = Math.ceil(REQUESTS / MAX_CONV_PER_ROUND);
    for (let round = 0; round < expectedRounds + 3; round++) {
      const t0 = performance.now();
      await poller.pollAccountConversations(account);
      roundMs.push(performance.now() - t0);
      if (round % 6 === 5) heap.push(heapUsedMb());
    }
    heap.push(heapUsedMb());

    const replies = canvas.conversation
      .map((m) => parseReplyMessage(m.body))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const finals = replies.filter((r) => r.status === 'done' || r.status === 'failed');
    const perRequest = new Map<number, number>();
    for (const r of finals) perRequest.set(r.requestId!, (perRequest.get(r.requestId!) ?? 0) + 1);
    const agentReplies = canvas.conversation.filter((m) => m.body.startsWith('[CFH:REPLY]') && /\nmode: agent\n/.test(m.body) && /\nstatus: done\n/.test(m.body));

    recordMetrics('L3-conversation-soak', {
      requests: REQUESTS, pollRounds: roundMs.length, perRound: MAX_CONV_PER_ROUND,
      finalReplies: finals.length, failedReplies: finals.filter((r) => r.status === 'failed').length,
      duplicates: [...perRequest.values()].filter((n) => n > 1).length,
      missing: requestIds.filter((id) => !perRequest.has(id)).length,
      agentRepliesWithModeHeader: agentReplies.length,
      roundLatencyMs: latency(roundMs.slice(0, expectedRounds)),
      heapMbSamples: heap,
      rerankRequests: rerankApi.requests, injectedRerankErrors: rerankApi.errors,
    });

    expect(finals).toHaveLength(REQUESTS);
    expect(requestIds.every((id) => perRequest.get(id) === 1)).toBe(true);
    expect(finals.every((r) => r.status === 'done')).toBe(true);
    expect(agentReplies).toHaveLength(REQUESTS / 2);
    expect(Math.max(...heap.slice(2)) - heap[1]).toBeLessThan(10);
  });
});

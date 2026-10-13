import * as http from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RerankModel } from '../domain';
import { PineconeReranker } from './pineconeReranker';

interface RecordedRequest { path: string; apiKey: string | undefined; body: Record<string, unknown> }

/** Minimal Pinecone Inference API: POST /rerank. Lets the real SDK run end to end. */
function startFakeInference(respond: (body: Record<string, unknown>) => { status: number; json: unknown }) {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (part) => { raw += part; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}') as Record<string, unknown>;
      requests.push({ path: req.url ?? '', apiKey: req.headers['api-key'] as string | undefined, body });
      const { status, json } = respond(body);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });
  return { server, requests };
}

describe('PineconeReranker (real SDK against a fake Pinecone API)', () => {
  let status = 200;
  const fake = startFakeInference((body) => (status !== 200
    ? { status, json: { error: { code: 'RESOURCE_EXHAUSTED', message: 'quota exceeded' } } }
    : {
      status,
      json: {
        model: body.model,
        data: [{ index: 2, score: 0.91 }, { index: 0, score: 0.42 }],
        usage: { rerank_units: 1 },
      },
    }));
  let baseUrl = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => fake.server.close(() => resolve())));

  it('sends model, query, documents, top_n and the bge truncate parameter, and maps hits', async () => {
    const reranker = new PineconeReranker({ apiKey: 'pc-test', model: RerankModel.BGE_RERANKER_V2_M3, controllerHostUrl: baseUrl });
    const hits = await reranker.rerank('what is BVA?', ['doc a', 'doc b', 'doc c'], 2);

    expect(hits).toEqual([{ index: 2, score: 0.91 }, { index: 0, score: 0.42 }]);
    const sent = fake.requests.at(-1)!;
    expect(sent.path).toBe('/rerank');
    expect(sent.apiKey).toBe('pc-test');
    expect(sent.body).toMatchObject({
      model: 'bge-reranker-v2-m3',
      query: 'what is BVA?',
      documents: [{ text: 'doc a' }, { text: 'doc b' }, { text: 'doc c' }],
      top_n: 2,
      return_documents: false,
      parameters: { truncate: 'END' },
    });
  });

  it('omits model parameters for models that do not take them', async () => {
    const reranker = new PineconeReranker({ apiKey: 'pc-test', model: RerankModel.COHERE_RERANK_3_5, controllerHostUrl: baseUrl });
    await reranker.rerank('q', ['a', 'b'], 1);
    expect(fake.requests.at(-1)!.body.parameters ?? {}).toEqual({});
  });

  it('throws on API errors so the decorator can fall back', async () => {
    status = 429;
    try {
      const reranker = new PineconeReranker({ apiKey: 'pc-test', model: RerankModel.BGE_RERANKER_V2_M3, controllerHostUrl: baseUrl });
      await expect(reranker.rerank('q', ['a', 'b'], 1)).rejects.toThrow();
    } finally {
      status = 200;
    }
  });

  it('makes exactly one request on a 5xx (SDK retries are disabled)', async () => {
    status = 503;
    try {
      const reranker = new PineconeReranker({ apiKey: 'pc-test', model: RerankModel.BGE_RERANKER_V2_M3, controllerHostUrl: baseUrl });
      const before = fake.requests.length;
      await expect(reranker.rerank('q', ['a', 'b'], 1)).rejects.toThrow();
      expect(fake.requests.length - before).toBe(1);
    } finally {
      status = 200;
    }
  });
});

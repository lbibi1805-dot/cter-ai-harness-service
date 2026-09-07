import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGRetriever } from './ragRetriever';

function makeRetriever(embedMock: ReturnType<typeof vi.fn>): RAGRetriever {
  const config = {
    pineconeApiKey: 'test-key',
    pineconeIndex: 'test-index',
    embeddingProvider: 'openai' as const,
    vaultPath: './documents-vault',
    topK: 6,
    embeddingDelayMs: 500,
    embeddingBatchSize: 100,
  };
  // Mock Pinecone query to return empty
  const mockVectorStore = { query: vi.fn().mockResolvedValue([]) } as never;
  const embedder = {
    embed: embedMock,
    embedBatch: vi.fn(),
    dimension: 1536,
    provider: 'openai' as const,
  } as never;

  const retriever = new RAGRetriever(config, embedder);
  // Replace internal vectorStore with mock to avoid Pinecone init
  (retriever as unknown as { vectorStore: unknown }).vectorStore = mockVectorStore;
  return retriever;
}

describe('RAGRetriever — truncate for embedding limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not truncate short question', async () => {
    const embedMock = vi.fn().mockResolvedValue([0.1, 0.2]);
    const retriever = makeRetriever(embedMock);
    await retriever.retrieve('short question');
    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(embedMock.mock.calls[0][0]).toBe('short question');
  });

  it('truncates long question to 4000 chars (safe for OpenAI 8192 & Gemini 2048)', async () => {
    const embedMock = vi.fn().mockResolvedValue([0.1]);
    const retriever = makeRetriever(embedMock);
    const long = 'a'.repeat(8000);
    await retriever.retrieve(long);
    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(embedMock.mock.calls[0][0].length).toBe(4000);
  });

  it('retries with 2000 chars when embed throws maximum context length', async () => {
    const embedMock = vi.fn()
      .mockRejectedValueOnce(new Error('400 Invalid input: maximum context length is 8192 tokens'))
      .mockResolvedValueOnce([0.1]);
    const retriever = makeRetriever(embedMock);
    const long = 'a'.repeat(5000);
    await retriever.retrieve(long);
    expect(embedMock).toHaveBeenCalledTimes(2);
    expect(embedMock.mock.calls[0][0].length).toBe(4000);
    expect(embedMock.mock.calls[1][0].length).toBe(2000);
  });

  it('retries on Gemini 2048 error as well', async () => {
    const embedMock = vi.fn()
      .mockRejectedValueOnce(new Error('too long input exceeds 2048 tokens'))
      .mockResolvedValueOnce([0.1]);
    const retriever = makeRetriever(embedMock);
    await retriever.retrieve('a'.repeat(5000));
    expect(embedMock).toHaveBeenCalledTimes(2);
  });

  it('throws if retry also fails', async () => {
    const embedMock = vi.fn().mockRejectedValue(new Error('other error'));
    const retriever = makeRetriever(embedMock);
    await expect(retriever.retrieve('a'.repeat(5000))).rejects.toThrow('other error');
    expect(embedMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty for blank question without calling embed', async () => {
    const embedMock = vi.fn();
    const retriever = makeRetriever(embedMock);
    const result = await retriever.retrieve('   ');
    expect(result).toEqual([]);
    expect(embedMock).not.toHaveBeenCalled();
  });
});

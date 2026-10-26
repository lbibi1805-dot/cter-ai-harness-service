import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { RAGRetriever } from '../../../../../src/modules/retrieval/application/ragRetriever.service';
import type { EmbeddingService } from '../../../../../src/modules/retrieval/domain/interfaces/embedding.port';
import type { VectorStore } from '../../../../../src/modules/retrieval/domain/interfaces/vectorStore.port';
import { EmbeddingProvider } from '../../../../../src/modules/retrieval/domain/enums/retrieval.enums';
import { EMBEDDING_DIMENSION } from '../../../../../src/modules/retrieval/domain/constants/retrieval.constants';

const TOP_K = 6;

function makeRetriever(embedMock: Mock<EmbeddingService['embed']>): RAGRetriever {
  const vectorStore = { query: vi.fn().mockResolvedValue([]) } as unknown as VectorStore;
  const embedder: EmbeddingService = {
    embed: embedMock,
    embedBatch: vi.fn(),
    dimension: EMBEDDING_DIMENSION[EmbeddingProvider.OPENAI],
    provider: EmbeddingProvider.OPENAI,
  };
  return new RAGRetriever(vectorStore, embedder, TOP_K);
}

describe('RAGRetriever — truncate for embedding limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not truncate short question', async () => {
    const embedMock = vi.fn<EmbeddingService['embed']>().mockResolvedValue([0.1, 0.2]);
    const retriever = makeRetriever(embedMock);
    await retriever.retrieve('short question');
    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(embedMock.mock.calls[0][0]).toBe('short question');
  });

  it('truncates long question to 4000 chars (safe for OpenAI 8192 & Gemini 2048)', async () => {
    const embedMock = vi.fn<EmbeddingService['embed']>().mockResolvedValue([0.1]);
    const retriever = makeRetriever(embedMock);
    const long = 'a'.repeat(8000);
    await retriever.retrieve(long);
    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(embedMock.mock.calls[0][0].length).toBe(4000);
  });

  it('retries with 2000 chars when embed throws maximum context length', async () => {
    const embedMock = vi.fn<EmbeddingService['embed']>()
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
    const embedMock = vi.fn<EmbeddingService['embed']>()
      .mockRejectedValueOnce(new Error('too long input exceeds 2048 tokens'))
      .mockResolvedValueOnce([0.1]);
    const retriever = makeRetriever(embedMock);
    await retriever.retrieve('a'.repeat(5000));
    expect(embedMock).toHaveBeenCalledTimes(2);
  });

  it('throws if retry also fails', async () => {
    const embedMock = vi.fn<EmbeddingService['embed']>().mockRejectedValue(new Error('other error'));
    const retriever = makeRetriever(embedMock);
    await expect(retriever.retrieve('a'.repeat(5000))).rejects.toThrow('other error');
    expect(embedMock).toHaveBeenCalledTimes(1);
  });

  it('returns empty for blank question without calling embed', async () => {
    const embedMock = vi.fn<EmbeddingService['embed']>();
    const retriever = makeRetriever(embedMock);
    const result = await retriever.retrieve('   ');
    expect(result).toEqual([]);
    expect(embedMock).not.toHaveBeenCalled();
  });
});

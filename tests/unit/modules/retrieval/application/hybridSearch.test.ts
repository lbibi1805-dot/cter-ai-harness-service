import { describe, expect, it } from 'vitest';
import {
  LexicalIndexSync,
  MiniSearchLexicalIndex,
  RAGRetriever,
  reciprocalRankFusion,
  stripDiacritics,
  type CitedChunk,
  type EmbeddingService,
  type LexicalCorpus,
  type LexicalDocumentRef,
  type VectorStore,
} from '../../../../../src/modules/retrieval';
import { EmbeddingProvider } from '../../../../../src/modules/retrieval/domain/enums/retrieval.enums';
import { chunkId, computeContentHash } from '../../../../../src/modules/vault/domain';
import { createVaultLexicalCorpus } from '../../../../../src/modules/vault';
import { VaultEntryStatus, VaultSourceType, type VaultEntry } from '../../../../../src/modules/vault/domain';

function chunk(id: string, text: string, extra: Partial<CitedChunk> = {}): CitedChunk {
  return { chunkId: id, text, source: `${id.split('#')[0]}.md`, heading: 'H', parentHeading: '', tokenCount: 10, ...extra };
}

const embedder: EmbeddingService = {
  dimension: 3,
  provider: EmbeddingProvider.GEMINI,
  embed: async () => [1, 0, 0],
  embedBatch: async (texts) => texts.map(() => [1, 0, 0]),
};

function vectorStoreReturning(hits: CitedChunk[]): VectorStore {
  return {
    ensureIndex: async () => undefined,
    upsertChunks: async () => undefined,
    query: async (_vector, topK) => hits.slice(0, topK),
    deleteAll: async () => undefined,
    deleteByIds: async () => undefined,
    listIds: async () => [],
    fetchByIds: async () => ({}),
  };
}

describe('stripDiacritics', () => {
  it('drops Vietnamese marks and maps đ', () => {
    expect(stripDiacritics('Kiểm thử phần mềm, Đặc tả')).toBe('Kiem thu phan mem, Dac ta');
  });
});

describe('reciprocalRankFusion (k=60)', () => {
  it('rewards chunks found by both lists and keeps vector scores', () => {
    const vector = [chunk('a#1#000', 'a', { score: 0.9 }), chunk('b#1#000', 'b', { score: 0.8 }), chunk('c#1#000', 'c', { score: 0.7 })];
    const lexical = [chunk('c#1#000', 'c'), chunk('d#1#000', 'd')];
    const fused = reciprocalRankFusion([vector, lexical]);
    expect(fused.map((c) => c.chunkId)).toEqual(['c#1#000', 'a#1#000', 'b#1#000', 'd#1#000']);
    expect(fused[0].score).toBe(0.7);
    // 1/(60+3) + 1/(60+1) > 1/(60+1)
  });

  it('returns a single list unchanged', () => {
    const list = [chunk('a#1#000', 'a'), chunk('b#1#000', 'b')];
    expect(reciprocalRankFusion([list]).map((c) => c.chunkId)).toEqual(['a#1#000', 'b#1#000']);
  });
});

describe('MiniSearchLexicalIndex (BM25 in RAM)', () => {
  const index = new MiniSearchLexicalIndex();
  index.replaceDocument('doc1', 'h1', [
    chunk('doc1#h1#000', 'Chất lượng phần mềm theo ISO 25010 gồm tám đặc tính.'),
    chunk('doc1#h1#001', 'Kiểm thử hộp đen dựa trên đặc tả, không cần mã nguồn.'),
  ]);
  index.replaceDocument('doc2', 'h2', [chunk('doc2#h2#000', 'The MTBF of a component is the mean time between failures.')]);

  it('finds an exact standard code', () => {
    expect(index.search('tiêu chuẩn ISO 25010 là gì', 3)[0].chunkId).toBe('doc1#h1#000');
  });

  it('matches Vietnamese typed without diacritics', () => {
    expect(index.search('kiem thu hop den', 3)[0].chunkId).toBe('doc1#h1#001');
  });

  it('replaces and removes documents', () => {
    const local = new MiniSearchLexicalIndex();
    local.replaceDocument('d', 'v1', [chunk('d#v1#000', 'alpha beta')]);
    local.replaceDocument('d', 'v2', [chunk('d#v2#000', 'gamma delta')]);
    expect(local.search('alpha', 5)).toEqual([]);
    expect(local.search('gamma', 5)[0].chunkId).toBe('d#v2#000');
    local.removeDocument('d');
    expect(local.chunkCount).toBe(0);
  });

  it('filters by source', () => {
    expect(index.search('MTBF failures', 5, { sourceFilter: (source) => source.startsWith('doc1') })).toEqual([]);
  });
});

describe('RAGRetriever hybrid', () => {
  it('BM25 brings in a rare-term chunk the vector search missed', async () => {
    const index = new MiniSearchLexicalIndex();
    const rare = chunk('std#h#000', 'Mô hình chất lượng ISO 25010: functional suitability, reliability, usability…');
    index.replaceDocument('std', 'h', [rare]);
    const vectorHits = [chunk('x#h#000', 'Chất lượng phần mềm nói chung', { score: 0.8 }), chunk('y#h#000', 'Quy trình phát triển', { score: 0.7 })];
    const vectorOnly = new RAGRetriever(vectorStoreReturning(vectorHits), embedder, 2);
    const hybrid = new RAGRetriever(vectorStoreReturning(vectorHits), embedder, 2, (c) => c, 0, index);
    expect((await vectorOnly.retrieve('ISO 25010')).map((c) => c.chunkId)).not.toContain('std#h#000');
    expect((await hybrid.retrieve('ISO 25010')).map((c) => c.chunkId)).toContain('std#h#000');
  });

  it('keeps the vector result unchanged when BM25 finds nothing', async () => {
    const vectorHits = [chunk('x#h#000', 'a', { score: 0.9 })];
    const hybrid = new RAGRetriever(vectorStoreReturning(vectorHits), embedder, 3, (c) => c, 0, new MiniSearchLexicalIndex());
    expect(await hybrid.retrieve('zzz')).toEqual(vectorHits);
  });

  it('applies the read-side guard to BM25 hits too', async () => {
    const index = new MiniSearchLexicalIndex();
    index.replaceDocument('gone', 'h', [chunk('gone#h#000', 'ISO 25010 deleted file')]);
    const hybrid = new RAGRetriever(vectorStoreReturning([]), embedder, 3, (chunks) => chunks.filter((c) => !c.chunkId.startsWith('gone')), 0, index);
    expect(await hybrid.retrieve('ISO 25010')).toEqual([]);
  });
});

describe('LexicalIndexSync', () => {
  const content = '# Week 1\n\n## Real-time\nA hard real-time system must meet every deadline.\n\n## Scheduling\nRate monotonic scheduling assigns priorities.';
  const hash = computeContentHash(content);

  function corpus(docs: LexicalDocumentRef[] | null, reads: string[]): LexicalCorpus {
    return {
      liveDocuments: () => docs,
      readContent: async (ref) => {
        reads.push(ref.docId);
        return content;
      },
    };
  }

  it('builds chunk ids like the indexer (<docId>#<hash8>#<idx>) and reads each version once', async () => {
    const reads: string[] = [];
    const sync = new LexicalIndexSync(new MiniSearchLexicalIndex());
    const docs = [{ docId: 'd1', hash, filePath: 'Week-01/rt.md', objectKey: 'vault/d1' }];
    sync.setCorpus(corpus(docs, reads));
    const report = await sync.sync();
    expect(report).toMatchObject({ documents: 1, chunks: 2, added: 1, failed: 0 });
    const [hit] = sync.search('rate monotonic', 1);
    expect(hit.chunkId).toBe(chunkId('d1', hash, 1));
    expect(hit).toMatchObject({ source: 'Week-01/rt.md', heading: 'Scheduling', docId: 'd1', contentHash: hash });
    await sync.sync();
    expect(reads).toEqual(['d1']);
  });

  it('drops a document that left the manifest and skips a content/hash mismatch', async () => {
    const docs: LexicalDocumentRef[] = [{ docId: 'd1', hash, filePath: 'a.md', objectKey: 'k' }, { docId: 'd2', hash: 'other', filePath: 'b.md', objectKey: 'k2' }];
    const sync = new LexicalIndexSync(new MiniSearchLexicalIndex());
    sync.setCorpus(corpus(docs, []));
    expect(await sync.sync()).toMatchObject({ documents: 1, failed: 1 });
    docs.splice(0, 2);
    expect(await sync.sync()).toMatchObject({ documents: 0, removed: 1 });
  });

  it('returns null (reads nothing) while the manifest is not loaded', async () => {
    const reads: string[] = [];
    const sync = new LexicalIndexSync(new MiniSearchLexicalIndex());
    sync.setCorpus(corpus(null, reads));
    expect(await sync.sync()).toBeNull();
    expect(sync.search('deadline', 3)).toEqual([]);
    expect(reads).toEqual([]);
  });
});

describe('createVaultLexicalCorpus', () => {
  const base: VaultEntry = {
    filePath: 'a.md', docId: 'd1', hash: 'h1', objectKey: 'vault/d1/h1.md', chunkIds: [], indexed: true, indexedHash: 'h1',
    status: VaultEntryStatus.ACTIVE, sourceType: VaultSourceType.MARKDOWN, contentType: 'text/markdown', sizeBytes: 1, lastError: null, updatedAt: '',
  };

  it('lists only fully indexed, live files from the RAM manifest', () => {
    const entries = [
      base,
      { ...base, docId: 'd2', filePath: 'b.md', hash: 'h3', indexedHash: 'h2' },
      { ...base, docId: 'd3', filePath: 'c.md', status: VaultEntryStatus.DELETING },
    ];
    const corpus = createVaultLexicalCorpus({ peekAll: () => entries }, { readContent: async () => null });
    expect(corpus.liveDocuments()!.map((doc) => doc.docId)).toEqual(['d1']);
    expect(createVaultLexicalCorpus({ peekAll: () => null }, { readContent: async () => null }).liveDocuments()).toBeNull();
  });
});

import { Pinecone } from '@pinecone-database/pinecone';
import type { RecordMetadata } from '@pinecone-database/pinecone';
import type { CitedChunk } from '../types';
import { logger } from '../utils/logger';

const BATCH_SIZE = 100;

interface ChunkMetadata extends RecordMetadata {
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
}

export interface IndexedChunk {
  id: string;
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
  vector: number[];
}

export class VectorStore {
  private pc: Pinecone;
  private indexName: string;

  constructor(apiKey: string, indexName: string) {
    this.pc = new Pinecone({ apiKey });
    this.indexName = indexName;
  }

  async ensureIndex(dimension: number): Promise<void> {
    const existing = await this.pc.listIndexes();
    const found = existing.indexes?.find(
      (i: { name: string }) => i.name === this.indexName,
    );
    if (found) {
      const desc = await this.pc.describeIndex(this.indexName);
      if (desc.dimension !== dimension) {
        await this.pc.deleteIndex(this.indexName);
        logger.info(`Recreating index ${this.indexName} with dimension ${dimension} (was ${desc.dimension})`);
        await this.createAndWait(dimension);
      }
      return;
    }

    await this.createAndWait(dimension);
  }

  private async createAndWait(dimension: number): Promise<void> {
    await this.pc.createIndex({
      name: this.indexName,
      dimension,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    });

    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const desc = await this.pc.describeIndex(this.indexName);
      if (desc.status?.ready === true) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error(`Index ${this.indexName} not ready after 60s`);
  }

  async upsertChunks(chunks: IndexedChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const index = this.pc.index<ChunkMetadata>(this.indexName);

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await index.upsert({
        records: batch.map(c => ({
          id: c.id,
          values: c.vector,
          metadata: {
            text: c.text,
            source: c.source,
            heading: c.heading,
            parentHeading: c.parentHeading,
            tokenCount: c.tokenCount,
          },
        })),
      });
    }
  }

  async query(vector: number[], topK: number = 6): Promise<CitedChunk[]> {
    const index = this.pc.index<ChunkMetadata>(this.indexName);
    const result = await index.query({
      vector,
      topK,
      includeMetadata: true,
    });

    return (result.matches ?? [])
      .filter(m => m.metadata && m.score !== undefined)
      .map(m => ({
        chunkId: m.id ?? '',
        text: m.metadata?.text ?? '',
        source: m.metadata?.source ?? '',
        heading: m.metadata?.heading ?? '',
        parentHeading: m.metadata?.parentHeading ?? '',
        tokenCount: m.metadata?.tokenCount ?? 0,
        score: m.score,
      }));
  }

  async deleteAll(): Promise<void> {
    const index = this.pc.index<ChunkMetadata>(this.indexName);
    await index.deleteAll();
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const index = this.pc.index<ChunkMetadata>(this.indexName);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      await index.deleteMany({ ids: ids.slice(i, i + BATCH_SIZE) });
    }
  }
}

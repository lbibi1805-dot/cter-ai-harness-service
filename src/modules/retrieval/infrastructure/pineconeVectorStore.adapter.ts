import { Pinecone, Errors as PineconeErrors, type Index } from '@pinecone-database/pinecone';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { logger } from '../../../shared/logging/logger';
import { extractHttpStatus } from '../../../shared/resilience/failureClassifier';
import { sleep } from '../../../shared/resilience/retry';
import {
  INDEX_READY_MAX_POLLS,
  INDEX_READY_POLL_INTERVAL_MS,
  PINECONE_CLOUD,
  PINECONE_METRIC,
  PINECONE_REGION,
} from '../domain/constants/retrieval.constants';
import { VectorIndexNotReadyError } from '../domain/errors/retrieval.errors';
import type { CitedChunk, IndexedChunk } from '../domain/interfaces/retrieval.interface';
import type { VectorStore } from '../domain/interfaces/vectorStore.port';
import { inBatches } from './helpers/pineconeVectorStore.helper';
import { PineconeChunkMetadata } from './interfaces/pineconeVectorStore.interface';

/**
 * Pinecone-backed vector store. Deleting from an index that does not exist
 * yet is a no-op: the SDK's 404 is translated here, at the boundary.
 */
export class PineconeVectorStore implements VectorStore {
  private readonly client: Pinecone;

  constructor(apiKey: string, private readonly indexName: string) {
    this.client = new Pinecone({ apiKey });
  }

  async ensureIndex(dimension: number): Promise<void> {
    const existing = await this.client.listIndexes();
    const found = existing.indexes?.some((index) => index.name === this.indexName);
    if (!found) return this.createAndWait(dimension);

    const description = await this.client.describeIndex(this.indexName);
    if (description.dimension === dimension) return;
    logger.info(`Recreating index ${this.indexName} with dimension ${dimension} (was ${description.dimension})`);
    await this.client.deleteIndex(this.indexName);
    await this.createAndWait(dimension);
  }

  async upsertChunks(chunks: IndexedChunk[]): Promise<void> {
    for (const batch of inBatches(chunks)) {
      await this.index().upsert({
        records: batch.map((chunk) => ({
          id: chunk.id,
          values: chunk.vector,
          metadata: {
            text: chunk.text,
            source: chunk.source,
            heading: chunk.heading,
            parentHeading: chunk.parentHeading,
            tokenCount: chunk.tokenCount,
          },
        })),
      });
    }
  }

  async query(vector: number[], topK: number): Promise<CitedChunk[]> {
    const result = await this.index().query({ vector, topK, includeMetadata: true });
    return (result.matches ?? [])
      .filter((match) => match.metadata && match.score !== undefined)
      .map((match) => ({
        chunkId: match.id ?? '',
        text: match.metadata?.text ?? '',
        source: match.metadata?.source ?? '',
        heading: match.metadata?.heading ?? '',
        parentHeading: match.metadata?.parentHeading ?? '',
        tokenCount: match.metadata?.tokenCount ?? 0,
        score: match.score,
      }));
  }

  async deleteAll(): Promise<void> {
    await this.ignoringMissingIndex(() => this.index().deleteAll());
  }

  async deleteByIds(ids: string[]): Promise<void> {
    for (const batch of inBatches(ids)) {
      const deleted = await this.ignoringMissingIndex(() => this.index().deleteMany({ ids: batch }));
      if (!deleted) return;
    }
  }

  async fetchByIds(ids: string[]): Promise<Record<string, PineconeChunkMetadata & { id: string }>> {
    const found: Record<string, PineconeChunkMetadata & { id: string }> = {};
    for (const batch of inBatches(ids)) {
      const response = await this.index().fetch({ ids: batch });
      for (const [id, record] of Object.entries(response.records ?? {})) {
        if (record.metadata) found[id] = { id, ...record.metadata };
      }
    }
    return found;
  }

  private index(): Index<PineconeChunkMetadata> {
    return this.client.index<PineconeChunkMetadata>(this.indexName);
  }

  private async createAndWait(dimension: number): Promise<void> {
    await this.client.createIndex({
      name: this.indexName,
      dimension,
      metric: PINECONE_METRIC,
      spec: { serverless: { cloud: PINECONE_CLOUD, region: PINECONE_REGION } },
    });
    for (let poll = 0; poll < INDEX_READY_MAX_POLLS; poll++) {
      await sleep(INDEX_READY_POLL_INTERVAL_MS);
      const description = await this.client.describeIndex(this.indexName);
      if (description.status?.ready === true) return;
    }
    throw new VectorIndexNotReadyError(this.indexName, INDEX_READY_MAX_POLLS * INDEX_READY_POLL_INTERVAL_MS);
  }

  /** Returns false when the index does not exist (nothing to delete); other errors propagate. */
  private async ignoringMissingIndex(operation: () => Promise<unknown>): Promise<boolean> {
    try {
      await operation();
      return true;
    } catch (err) {
      if (err instanceof PineconeErrors.PineconeNotFoundError || extractHttpStatus(err) === HttpStatus.NOT_FOUND) return false;
      throw err;
    }
  }
}

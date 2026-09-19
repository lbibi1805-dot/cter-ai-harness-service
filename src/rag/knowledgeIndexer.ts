import * as path from 'path';
import * as crypto from 'crypto';
import type { VaultConfig } from '../types';
import type { IEmbeddingService } from './embeddingService';
import type { IndexedChunk } from './vectorStore';
import { VectorStore } from './vectorStore';
import { logger } from '../utils/logger';
import { normalizeText } from './textNormalizer';
import { createVaultStorageWithFallback } from '../vault';

interface ParsedSection {
  heading: string;
  parentHeading: string;
  content: string;
}

const CHUNK_MAX_TOKENS = 800;
const CHUNK_OVERLAP_TOKENS = 100;

export class KnowledgeIndexer {
  private embedder: IEmbeddingService;
  private vectorStore: VectorStore;

  constructor(
    private config: VaultConfig,
    embedder: IEmbeddingService,
    vectorStore?: VectorStore,
  ) {
    this.embedder = embedder;
    this.vectorStore = vectorStore ?? new VectorStore(
      config.pineconeApiKey,
      config.pineconeIndex,
    );
  }

  async indexAll(): Promise<void> {
    await this.vectorStore.ensureIndex(this.embedder.dimension).catch(() => {
      logger.info('Pinecone unavailable — proceeding with manifest only');
    });

    const storage = await createVaultStorageWithFallback();
    const { entries } = await storage.list({ limit: 10000, offset: 0 });

    if (entries.length === 0) {
      logger.info('Neon vault empty — nothing to index');
      return;
    }

    // Neon-only: content lives in DB, not on disk. Detect stale entries.
    const changed: typeof entries = [];
    const emptyContent: string[] = [];
    for (const e of entries) {
      const raw = e.content ?? '';
      if (!raw.trim()) {
        emptyContent.push(e.filePath);
        // Force re-index attempt but will be skipped below due to empty content
        if (!e.indexed) changed.push(e);
        continue;
      }
      const normalized = normalizeText(raw);
      const computedHash = crypto.createHash('md5').update(normalized).digest('hex');
      if (!e.indexed || computedHash !== e.hash) changed.push(e);
    }

    if (emptyContent.length > 0) {
      logger.info(`Neon vault has ${emptyContent.length} files with empty content (need re-upload): ${emptyContent.slice(0, 5).join(', ')}${emptyContent.length > 5 ? '…' : ''}`);
    }

    // Filter out empty-content entries — cannot chunk/embed without content
    const indexable = changed.filter(e => (e.content ?? '').trim().length > 0);

    if (indexable.length === 0) {
      const pending = entries.filter(e => !e.indexed).length;
      if (pending === 0) logger.info(`All ${entries.length} files indexed — skipping`);
      else logger.info(`Neon vault: ${entries.length} files, ${pending} pending but ${emptyContent.length} have empty content — skipping (re-upload needed)`);
      return;
    }

    logger.info(`Neon vault: ${entries.length} files, ${indexable.length} pending — indexing ${indexable.length} files`);

    // Build map for old chunkIds lookup
    const entryMap = new Map(entries.map(e => [e.filePath, e]));

    const allNewChunks: IndexedChunk[] = [];
    let globalChunkIndex = 0;
    const fileChunkMap = new Map<string, string[]>();

    for (const entry of indexable) {
      const source = entry.filePath;
      const normalized = normalizeText(entry.content);
      const hash = crypto.createHash('md5').update(normalized).digest('hex');

      const oldChunkIds = entryMap.get(source)?.chunkIds ?? [];
      if (oldChunkIds.length > 0) {
        await this.vectorStore.deleteByIds(oldChunkIds).catch(() => {});
      }

      const sections = this.parseMarkdown(normalized);
      const fileChunks: IndexedChunk[] = [];

      if (sections.length === 0 && normalized.trim()) {
        fileChunks.push(...this.chunkSection(
          normalized.trim(), source, path.basename(source, '.md'), '',
          () => globalChunkIndex++,
        ));
      } else {
        for (const section of sections) {
          fileChunks.push(...this.chunkSection(
            section.content, source, section.heading, section.parentHeading,
            () => globalChunkIndex++,
          ));
        }
      }

      allNewChunks.push(...fileChunks);
      fileChunkMap.set(source, fileChunks.map(c => c.id));
      // Persist BEFORE embedding so crash doesn't lose tracking
      await storage.upsert({ filePath: source, hash, chunkIds: fileChunks.map(c => c.id), indexed: false, content: entry.content } as any);
    }

    // Embed new chunks - batch size & delay from config (strategy per provider)
    const EMBED_BATCH_SIZE = this.config.embeddingBatchSize ?? 1;
    const EMBED_DELAY_MS = this.config.embeddingDelayMs ?? 0;
    logger.info(`Embedding ${allNewChunks.length} new chunks... (provider=${this.config.embeddingProvider}, batch=${EMBED_BATCH_SIZE}, delay=${EMBED_DELAY_MS}ms)`);
    for (let start = 0; start < allNewChunks.length; start += EMBED_BATCH_SIZE) {
      const batch = allNewChunks.slice(start, Math.min(start + EMBED_BATCH_SIZE, allNewChunks.length));
      const batchIndex = Math.floor(start / EMBED_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allNewChunks.length / EMBED_BATCH_SIZE);
      logger.info(`Embedding batch ${batchIndex}/${totalBatches} (${batch.length} chunks, ${start + 1}-${start + batch.length}/${allNewChunks.length})`);

      let lastError: string | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const vectors = await this.embedder.embedBatch(batch.map(c => c.text));
          batch.forEach((chunk, idx) => { chunk.vector = vectors[idx] ?? []; });
          lastError = undefined;
          break;
        } catch (err) {
          lastError = (err as Error).message;
          if (lastError.includes('429')) {
            const wait = Math.min(3000 * Math.pow(2, attempt), 30000);
            logger.info(`Rate limited on batch ${batchIndex}/${totalBatches} — waiting ${wait}ms`);
            await new Promise(r => setTimeout(r, wait));
          } else if (lastError.includes('fetch failed') || lastError.includes('fetch')) {
            const wait = Math.min(2000 * Math.pow(2, attempt), 15000);
            logger.info(`Fetch failed on batch ${batchIndex}/${totalBatches} — retry ${attempt + 1}/5 waiting ${wait}ms`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            logger.info(`Skipping batch ${batchIndex}: ${lastError}`);
            break;
          }
        }
      }
      if (lastError) {
        logger.info(`Giving up on batch ${batchIndex} after 5 retries: ${lastError}`);
        batch.forEach(c => { if (!c.vector.length) c.vector = []; });
      }
      if (start + EMBED_BATCH_SIZE < allNewChunks.length) {
        await new Promise(r => setTimeout(r, EMBED_DELAY_MS));
      }
    }

    const validChunks = allNewChunks.filter(c => c.vector.length > 0);
    if (validChunks.length > 0) {
      logger.info(`Upserting ${validChunks.length}/${allNewChunks.length} chunks to Pinecone...`);
      await this.vectorStore.upsertChunks(validChunks);
    }

    for (const entry of indexable) {
      const ids = fileChunkMap.get(entry.filePath) ?? [];
      const fileChunks = allNewChunks.filter(c => ids.includes(c.id));
      const allOk = fileChunks.length > 0 && fileChunks.every(c => c.vector.length > 0);
      const normalized = normalizeText(entry.content);
      const hash = crypto.createHash('md5').update(normalized).digest('hex');
      await storage.upsert({ filePath: entry.filePath, hash, chunkIds: ids, indexed: allOk, content: entry.content } as any);
    }

    logger.info(`Vault indexing complete — ${validChunks.length} new chunks stored`);
  }

  private parseMarkdown(content: string): ParsedSection[] {
    const lines = content.split('\n');
    const sections: ParsedSection[] = [];
    let currentH1 = '';
    let currentH2 = '';
    let currentContent: string[] = [];

    const flushSection = (): void => {
      const text = currentContent.join('\n').trim();
      if (currentH2 && text) {
        sections.push({
          heading: currentH2,
          parentHeading: currentH1,
          content: text,
        });
      }
      currentContent = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (line.startsWith('## ')) {
        flushSection();
        currentH2 = line.replace(/^## /, '').trim();
      } else if (line.startsWith('# ') && !line.startsWith('## ')) {
        flushSection();
        currentH1 = line.replace(/^# /, '').trim();
        currentH2 = '';
      } else {
        currentContent.push(rawLine);
      }
    }

    flushSection();
    return sections;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private chunkSection(
    text: string,
    source: string,
    heading: string,
    parentHeading: string,
    nextIndex: () => number,
  ): IndexedChunk[] {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= CHUNK_MAX_TOKENS) {
      return [this.makeChunk(text, source, heading, parentHeading, nextIndex())];
    }

    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    const chunks: IndexedChunk[] = [];
    let currentParagraphs: string[] = [];
    let currentTokens = 0;

    for (const para of paragraphs) {
      const paraTokens = this.estimateTokens(para);

      if (currentTokens + paraTokens > CHUNK_MAX_TOKENS && currentParagraphs.length > 0) {
        chunks.push(this.makeChunk(
          currentParagraphs.join('\n\n'),
          source,
          heading,
          parentHeading,
          nextIndex(),
        ));

        const overlap: string[] = [];
        let overlapTokens = 0;
        for (let i = currentParagraphs.length - 1; i >= 0; i--) {
          const pt = this.estimateTokens(currentParagraphs[i]);
          if (overlapTokens + pt > CHUNK_OVERLAP_TOKENS) break;
          overlap.unshift(currentParagraphs[i]);
          overlapTokens += pt;
        }

        currentParagraphs = [...overlap];
        currentTokens = overlapTokens;
      }

      currentParagraphs.push(para);
      currentTokens += paraTokens;
    }

    if (currentParagraphs.length > 0) {
      chunks.push(this.makeChunk(
        currentParagraphs.join('\n\n'),
        source,
        heading,
        parentHeading,
        nextIndex(),
      ));
    }

    return chunks;
  }

  private makeChunk(
    text: string,
    source: string,
    heading: string,
    parentHeading: string,
    index: number,
  ): IndexedChunk {
    const baseName = source.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeHeading = heading.replace(/[^a-zA-Z0-9_-\s]/g, '').trim().slice(0, 30).replace(/\s+/g, '-');
    return {
      id: safeHeading
        ? `${baseName}_${safeHeading}_chunk_${String(index).padStart(3, '0')}`
        : `${baseName}_chunk_${String(index).padStart(3, '0')}`,
      text,
      source,
      heading,
      parentHeading,
      tokenCount: this.estimateTokens(text),
      vector: [],
    };
  }
}

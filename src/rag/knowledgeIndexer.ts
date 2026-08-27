import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { VaultConfig } from '../types';
import type { IEmbeddingService } from './embeddingService';
import type { IndexedChunk } from './vectorStore';
import { VectorStore } from './vectorStore';
import { logger } from '../utils/logger';
import { normalizeText } from './textNormalizer';

interface ParsedSection {
  heading: string;
  parentHeading: string;
  content: string;
}

const CHUNK_MAX_TOKENS = 800;
const CHUNK_OVERLAP_TOKENS = 100;
const MANIFEST_PATH = path.resolve(process.cwd(), '.vault-manifest.json');

interface VaultManifest {
  files: Record<string, { hash: string; chunkIds: string[]; indexed: boolean }>;
}

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
    const vaultPath = path.resolve(process.cwd(), this.config.vaultPath);
    if (!fs.existsSync(vaultPath)) {
      logger.info(`Vault path not found: ${vaultPath} — skipping indexing`);
      return;
    }

    await this.vectorStore.ensureIndex(this.embedder.dimension).catch(() => {
      logger.info('Pinecone unavailable — proceeding with manifest only');
    });

    // Load manifest
    let manifest: VaultManifest = { files: {} };
    try {
      if (fs.existsSync(MANIFEST_PATH)) manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch { logger.info('Manifest corrupted — starting fresh'); }

    // Scan current files
    const mdFiles = this.scanMdFiles(vaultPath);

    // Compute file hashes
    const fileEntries = mdFiles.map(fp => {
      const source = path.relative(vaultPath, fp);
      const rawContent = fs.readFileSync(fp, 'utf-8');
      const content = normalizeText(rawContent);
      const hash = crypto.createHash('md5').update(content).digest('hex');
      return { filePath: fp, source, content, hash };
    });

    // Detect changes
    const currentSources = new Set(fileEntries.map(e => e.source));
    const prevSources = new Set(Object.keys(manifest.files));
    const deleted = [...prevSources].filter(s => !currentSources.has(s));
    const changed = fileEntries.filter(e => {
      const prev = manifest.files[e.source];
      return prev?.hash !== e.hash || prev?.indexed !== true;
    });

    // Handle deleted files
    if (deleted.length > 0) {
      const idsToDelete = deleted.flatMap(s => manifest.files[s]?.chunkIds ?? []);
      if (idsToDelete.length > 0) {
        await this.vectorStore.deleteByIds(idsToDelete);
        logger.info(`Removed ${idsToDelete.length} chunks from ${deleted.length} deleted files`);
      }
      for (const s of deleted) delete manifest.files[s];
    }

    // Save manifest if there were deletions (even if no files to index)
    if (deleted.length > 0 && changed.length === 0) {
      try { fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2)); } catch {}
      logger.info('Manifest updated — deleted files cleaned up');
      return;
    }

    // Skip if nothing changed
    if (changed.length === 0) {
      if (fileEntries.length === 0) {
        logger.info('Vault is empty — nothing to index');
      } else {
        logger.info(`All ${fileEntries.length} files unchanged — indexing skipped`);
      }
      return;
    }

    logger.info(`${changed.length}/${fileEntries.length} files changed — indexing ${changed.length} files`);

    // Index only changed files
    const allNewChunks: IndexedChunk[] = [];
    let globalChunkIndex = 0;

    for (const entry of changed) {
      const { source, content } = entry;

      // Delete old chunks for this file
      const oldChunkIds = manifest.files[source]?.chunkIds ?? [];
      if (oldChunkIds.length > 0) {
        await this.vectorStore.deleteByIds(oldChunkIds);
      }

      // Parse and chunk
      const sections = this.parseMarkdown(content);
      const fileChunks: IndexedChunk[] = [];

      if (sections.length === 0 && content.trim()) {
        fileChunks.push(...this.chunkSection(
          content.trim(), source, path.basename(source, '.md'), '',
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
      manifest.files[source] = {
        hash: entry.hash,
        chunkIds: fileChunks.map(c => c.id),
        indexed: false,
      };
    }

    // Persist manifest BEFORE embedding so a crash mid-embedding does not
    // lose change detection (next run only re-indexes un-indexed files).
    try { fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2)); } catch {}

    // Embed new chunks
    logger.info(`Embedding ${allNewChunks.length} new chunks...`);
    for (let i = 0; i < allNewChunks.length; i++) {
      let lastError: string | undefined;
      let chunkDelay = 1300;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await new Promise(r => setTimeout(r, chunkDelay));
          const vector = await this.embedder.embed(allNewChunks[i].text);
          allNewChunks[i].vector = vector;
          lastError = undefined;
          chunkDelay = 1300;
          break;
        } catch (err) {
          lastError = (err as Error).message;
          if (lastError.includes('429')) {
            chunkDelay = 5000;
            const wait = Math.min(3000 * Math.pow(2, attempt), 30000);
            logger.info(`Rate limited on chunk ${i + 1}/${allNewChunks.length} — waiting ${wait}ms`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            logger.info(`Skipping chunk ${i + 1}: ${lastError}`);
            break;
          }
        }
      }
      if (lastError?.includes('429')) {
        logger.info(`Giving up on chunk ${i + 1} after 5 retries`);
      }
    }

    // Upsert
    const validChunks = allNewChunks.filter(c => c.vector.length > 0);
    if (validChunks.length > 0) {
      logger.info(`Upserting ${validChunks.length}/${allNewChunks.length} chunks to Pinecone...`);
      await this.vectorStore.upsertChunks(validChunks);
    }

    // Mark fully-indexed files so change detection treats them as clean
    if (validChunks.length === allNewChunks.length) {
      for (const entry of changed) {
        if (manifest.files[entry.source]) manifest.files[entry.source].indexed = true;
      }
    }

    // Save manifest
    try { fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2)); } catch {}
    logger.info(`Vault indexing complete — ${validChunks.length} new chunks stored`);
  }

  private scanMdFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.scanMdFiles(fullPath));
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
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

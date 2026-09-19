#!/usr/bin/env node
// Clear Pinecone index (deleteAll vectors) — Neon-only vault
// Usage: node scripts/clear-pinecone.mjs [--index canvashelper-kb] [--dry-run]
import 'dotenv/config';

const dryRun = process.argv.includes('--dry-run');
const idxArg = process.argv.find(a => a.startsWith('--index='));
const indexName = idxArg ? idxArg.split('=')[1] : (process.env.PINECONE_INDEX ?? 'canvashelper-kb');
const apiKey = process.env.PINECONE_API_KEY;

if (!apiKey) {
  console.error('PINECONE_API_KEY missing in .env');
  process.exit(1);
}

console.log(`Target index: ${indexName} ${dryRun ? '(dry-run)' : ''}`);

if (dryRun) {
  console.log('[dry-run] would call index.deleteAll()');
  process.exit(0);
}

const { VectorStore } = await import('../dist/rag/vectorStore.js');
const vs = new VectorStore(apiKey, indexName);
console.log('Calling deleteAll()...');
await vs.deleteAll();
console.log('Done — all vectors deleted. Verify via Pinecone console or query with topK.');

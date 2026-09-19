#!/usr/bin/env node
// Backfill vault_manifest.content from local documents-vault/ -> Neon
// Usage: node scripts/backfill-vault-content.mjs [--dry-run]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const dryRun = process.argv.includes('--dry-run');
const vaultPath = path.resolve(process.cwd(), process.env.VAULT_PATH ?? './documents-vault');

function normalizeText(s) {
  return s.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ').trim();
}

function scanMdFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...scanMdFiles(full));
    else if (ent.name.endsWith('.md')) out.push(full);
  }
  return out;
}

async function main() {
  const mdFiles = scanMdFiles(vaultPath);
  console.log(`Local vault: ${mdFiles.length} .md under ${vaultPath}`);
  if (mdFiles.length === 0) { console.log('Nothing to backfill'); return; }

  const { createVaultStorageWithFallback } = await import('../dist/vault/index.js');
  const storage = await createVaultStorageWithFallback();
  await storage.init();
  // ensure column exists (idempotent)
  try { await storage.init(); } catch {}

  let ok = 0, skip = 0, fail = 0;
  for (const fp of mdFiles) {
    const rel = path.relative(vaultPath, fp).replace(/\\/g, '/');
    const raw = fs.readFileSync(fp, 'utf-8');
    const normalized = normalizeText(raw);
    if (!normalized.trim()) { skip++; continue; }
    const hash = crypto.createHash('md5').update(normalized).digest('hex');
    if (dryRun) {
      console.log(`[dry-run] would upsert ${rel} hash=${hash.slice(0,8)} len=${normalized.length}`);
      ok++;
      continue;
    }
    try {
      await storage.upsert({ filePath: rel, hash, chunkIds: [], indexed: false, content: normalized });
      ok++;
      if (ok % 50 === 0) console.log(`  ... ${ok}/${mdFiles.length} upserted`);
    } catch (e) {
      console.error(`  FAIL ${rel}: ${e.message}`);
      fail++;
    }
  }
  console.log(`Done: ok=${ok} skipEmpty=${skip} fail=${fail}`);
  if (!dryRun) {
    const { total, indexed } = await storage.stats();
    const { entries } = await storage.list({ limit: 5, offset: 0 });
    console.log(`Neon stats: ${indexed}/${total} indexed`);
    console.log(`Sample: ${entries.slice(0,3).map(e=> `${e.filePath} len=${(e.content||'').length} indexed=${e.indexed}`).join(' | ')}`);
    console.log('\nNext: Render will auto-index on next deploy (indexAll reads Neon). Or trigger re-index via redeploy.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

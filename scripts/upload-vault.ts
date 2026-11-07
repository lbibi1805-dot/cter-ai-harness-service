/**
 * Upload a folder of markdown notes to a running harness (POST /api/vault/files),
 * keeping relative paths as vault folders. Unchanged files are skipped server-side
 * (same content hash → no object write, no embedding).
 *
 *   npm run vault:upload -- ./documents-vault
 *   npm run vault:upload -- ./notes --url https://harness.example.com --prefix mon-qnx
 *
 * Uses ADMIN_TOKEN from `.env`. Default URL: http://localhost:${API_PORT:-3000}.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const BATCH = 20;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : walk(full);
    return entry.name.toLowerCase().endsWith('.md') ? [full] : [];
  });
}

async function main(): Promise<void> {
  const root = process.argv[2];
  if (!root || root.startsWith('--') || !fs.existsSync(root)) {
    console.error('Usage: npm run vault:upload -- <folder> [--url http://localhost:3000] [--prefix folder]');
    process.exit(1);
  }
  const url = (arg('--url') ?? `http://localhost:${process.env.API_PORT ?? 3000}`).replace(/\/$/, '');
  const prefix = arg('--prefix');
  const files = walk(root);
  console.log(`Uploading ${files.length} markdown files from ${root} to ${url}`);

  const totals: Record<string, number> = {};
  for (let i = 0; i < files.length; i += BATCH) {
    const form = new FormData();
    for (const file of files.slice(i, i + BATCH)) {
      const relative = path.relative(root, file).split(path.sep).join('/');
      const vaultPath = prefix ? `${prefix}/${relative}` : relative;
      form.append('files', new Blob([fs.readFileSync(file)], { type: 'text/markdown' }), path.basename(file));
      form.append('path', vaultPath);
    }
    const res = await fetch(`${url}/api/vault/files`, {
      method: 'POST',
      headers: process.env.ADMIN_TOKEN ? { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { files: { file: string; outcome?: string; error?: string }[] };
    for (const f of body.files) {
      const key = f.error ? 'error' : f.outcome ?? 'ok';
      totals[key] = (totals[key] ?? 0) + 1;
      if (f.error) console.warn(`  ✗ ${f.file}: ${f.error}`);
    }
    console.log(`  ${Math.min(i + BATCH, files.length)}/${files.length}`);
  }
  console.log(`Done: ${JSON.stringify(totals)} — indexing runs in the background (GET /api/vault/files?indexed=false).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Read-only backup of the legacy vault (markdown stored inline in
 * `vault_manifest.content`, before object storage) into a local folder, keeping
 * the folder structure. Run it BEFORE `vault:reset`, then re-upload the folder:
 *
 *   npm run vault:export-legacy -- ./vault-backup
 *   npm run vault:upload -- ./vault-backup --url https://<server>
 *
 * Reads DATABASE_URL from `.env` (DOTENV_CONFIG_PATH=.env.prod for another file). One SELECT, no writes.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { neon } from '@neondatabase/serverless';

async function main(): Promise<void> {
  const out = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!out || out.startsWith('--')) throw new Error('Usage: npm run vault:export-legacy -- <output-folder>');
  if (!url) throw new Error('DATABASE_URL is not set');

  const sql = neon(url);
  const columns = (await sql.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vault_manifest' AND column_name = 'content'")) as unknown[];
  if (columns.length === 0) {
    console.log('vault_manifest has no `content` column (already migrated) — nothing to export.');
    return;
  }
  const rows = (await sql.query("SELECT file_path, content FROM vault_manifest WHERE content <> '' ORDER BY file_path")) as { file_path: string; content: string }[];
  const root = path.resolve(out);
  let written = 0;
  for (const row of rows) {
    const target = path.resolve(root, row.file_path);
    if (!target.startsWith(root + path.sep)) {
      console.warn(`  skipped unsafe path: ${row.file_path}`);
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, row.content, 'utf-8');
    written++;
  }
  console.log(`Exported ${written}/${rows.length} files from ${new URL(url).host} to ${root}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

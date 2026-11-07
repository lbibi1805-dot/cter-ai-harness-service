/**
 * Live smoke test of the configured R2 bucket (R2_* in .env). Writes 2 tiny
 * objects under tmp/smoke-<uuid>/, reads them back (sha256 metadata, list,
 * presigned GET, prefix delete) and verifies everything is gone afterwards.
 *
 *   npm run smoke:r2
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { readStorageConfig } from '../src/bootstrap/config/readers/storageConfig.reader';
import { R2ObjectStorage, sha256Hex } from '../src/shared/storage';

function check(condition: unknown, label: string): void {
  if (!condition) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function main(): Promise<void> {
  const config = readStorageConfig();
  if (!config.r2) throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET must be set');
  const r2 = new R2ObjectStorage(config.r2);
  const prefix = `tmp/smoke-${randomUUID()}/`;
  console.log(`R2 smoke test on ${r2.location}, prefix ${prefix}`);
  try {
    const text = 'xin chào R2 — smoke test';
    await r2.put(`${prefix}a.txt`, text, { contentType: 'text/plain; charset=utf-8', metadata: { purpose: 'smoke' } });
    await r2.put(`${prefix}b.bin`, Buffer.from([1, 2, 3]), { contentType: 'application/octet-stream' });
    check(true, 'put 2 objects');

    const got = await r2.get(`${prefix}a.txt`);
    check(got?.body.toString('utf-8') === text, 'get returns the same bytes');
    check(got?.metadata.sha256 === sha256Hex(text), 'sha256 metadata stored');
    check((await r2.head(`${prefix}b.bin`))?.size === 3, 'head size');
    check(await r2.get(`${prefix}missing.txt`) === null, 'missing key → null');
    check((await r2.list(prefix)).length === 2, 'list by prefix');

    const url = await r2.presignGet(`${prefix}a.txt`, 60);
    const res = await fetch(url!);
    check(res.ok && (await res.text()) === text, 'presigned GET works');

    check((await r2.deletePrefix(prefix)) === 2, 'deletePrefix removed 2 objects');
  } finally {
    const leftover = await r2.list(prefix).catch(() => []);
    if (leftover.length > 0) await r2.deletePrefix(prefix).catch(() => undefined);
  }
  check((await r2.list(prefix)).length === 0, 'nothing left behind');
  console.log('R2 smoke test passed.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

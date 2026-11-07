/**
 * Wipe the document vault in ONE environment: Pinecone vectors, the manifest
 * rows (vault_manifest), and the objects under vault/ and derived/ in object
 * storage. Conversations and their files are NOT touched.
 *
 *   npm run vault:reset                    # dry run: prints the target and the counts only
 *   npm run vault:reset -- --confirm       # really deletes
 *   npm run vault:reset -- --confirm --allow-prod   # required when the bucket/index name contains "prod"
 *
 * Reads `.env` like the server. Afterwards re-upload the vault (npm run vault:upload -- <dir>)
 * and call POST /api/vault/sync (or restart) on a running server so its RAM cache reloads.
 */
import 'dotenv/config';
import { PineconeVectorStore } from '../src/modules/retrieval';
import { VaultService } from '../src/modules/vault/application/vault.service';
import { RetrievalVectorIndex } from '../src/modules/vault/infrastructure/retrievalVectorIndex.adapter';
import { createVaultRepository } from '../src/modules/vault/infrastructure/vaultRepository.factory';
import { readStorageConfig } from '../src/bootstrap/config/readers/storageConfig.reader';
import { readRetrievalConfig } from '../src/bootstrap/config/readers/retrievalConfig.reader';
import { parseStorageProvider, usesNeon } from '../src/shared/database/helpers/database.helper';
import { readOptionalString } from '../src/shared/config/env';
import { ObjectPrefix, createObjectStorage } from '../src/shared/storage';

const PROD_MARKER = /prod/i;

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');
  const allowProd = process.argv.includes('--allow-prod');

  const database = { provider: parseStorageProvider(readOptionalString('VAULT_STORAGE_PROVIDER')), databaseUrl: readOptionalString('DATABASE_URL') };
  const storageConfig = readStorageConfig();
  const retrieval = readRetrievalConfig();
  const storage = createObjectStorage(storageConfig);
  const repository = createVaultRepository(database);
  const vectorStore = retrieval ? new PineconeVectorStore(retrieval.pineconeApiKey, retrieval.pineconeIndex) : null;
  const vectors = vectorStore ? new RetrievalVectorIndex(vectorStore) : null;

  const dbHost = usesNeon(database) ? new URL(database.databaseUrl).host : 'local JSON manifest (data/.vault-manifest.json)';
  const targets = [`database: ${dbHost}`, `object storage: ${storage.location}`, `vector index: ${retrieval?.pineconeIndex ?? '(none)'}`];
  console.log(`Vault reset target:\n  ${targets.join('\n  ')}`);
  if (targets.some((t) => PROD_MARKER.test(t)) && !allowProd) {
    console.error('Refusing: the target looks like PRODUCTION. Re-run with --allow-prod if this is intended.');
    process.exit(2);
  }

  const [live, deleting, vaultObjects, derivedObjects, vectorIds] = await Promise.all([
    repository.findAll(),
    repository.findDeleting(),
    storage.list(ObjectPrefix.VAULT),
    storage.list(ObjectPrefix.DERIVED),
    vectors ? vectors.listIds().catch((err: Error) => { console.warn(`  (cannot list vectors: ${err.message})`); return null; }) : Promise.resolve([]),
  ]);
  console.log(`Current: ${live.length} files (+${deleting.length} pending delete, ${live.filter((e) => !e.objectKey).length} legacy without object), `
    + `${vaultObjects.length} vault/ objects, ${derivedObjects.length} derived/ objects, ${vectorIds === null ? '?' : vectorIds.length} vectors`);

  if (!confirm) {
    console.log('Dry run — nothing deleted. Add --confirm to wipe.');
    return;
  }
  const service = new VaultService(repository, vectors, storage);
  const result = await service.deleteAll();
  const [after, objectsAfter] = await Promise.all([repository.stats(), storage.list(ObjectPrefix.VAULT)]);
  console.log(`Deleted ${result.deleted} files (pending: ${result.pending}). Now: ${after.total} files, ${objectsAfter.length} vault/ objects.`);
  if (result.pending > 0) {
    console.error('Some cleanup failed (see warnings). Run the reset again, or POST /api/vault/sync on the server.');
    process.exit(1);
  }
  console.log('Next: npm run vault:upload -- <folder>, then POST /api/vault/sync (or restart) on any running server.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

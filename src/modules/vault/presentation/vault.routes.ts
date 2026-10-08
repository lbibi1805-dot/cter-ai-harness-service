import { HttpMethod } from '../../../shared/http/http.enums';
import { exactPath, wildcardPath, type Route } from '../../../shared/http/router';
import type { VaultController } from './vault.controller';

export const VAULT_API_PREFIX = '/api/vault';

export enum VaultApiPath {
  FILES = '/api/vault/files',
  FILE_PREFIX = '/api/vault/files/',
  CHUNKS_SUFFIX = '/chunks',
  CHUNKS = '/api/vault/chunks',
  FOLDERS = '/api/vault/folders',
  MANIFEST = '/api/vault/manifest',
  REINDEX = '/api/vault/reindex',
  SYNC_VECTORS = '/api/vault/sync-pinecone',
}

/** Order matters: `/files/:path/chunks` must be tried before `/files/:path`. */
export function createVaultRoutes(controller: VaultController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(VaultApiPath.FILES), handler: controller.searchFiles },
    { method: HttpMethod.POST, match: exactPath(VaultApiPath.FILES), requiresAuth: true, handler: controller.uploadFiles },
    { method: HttpMethod.DELETE, match: exactPath(VaultApiPath.FILES), requiresAuth: true, handler: controller.deleteFiles },
    { method: HttpMethod.GET, match: wildcardPath(VaultApiPath.FILE_PREFIX, VaultApiPath.CHUNKS_SUFFIX), handler: controller.listFileChunks },
    { method: HttpMethod.GET, match: wildcardPath(VaultApiPath.FILE_PREFIX), handler: controller.getFile },
    { method: HttpMethod.DELETE, match: wildcardPath(VaultApiPath.FILE_PREFIX), requiresAuth: true, handler: controller.deleteFile },
    { method: HttpMethod.GET, match: exactPath(VaultApiPath.CHUNKS), handler: controller.listChunks },
    { method: HttpMethod.GET, match: exactPath(VaultApiPath.FOLDERS), handler: controller.listFolders },
    { method: HttpMethod.GET, match: exactPath(VaultApiPath.MANIFEST), handler: controller.getManifest },
    { method: HttpMethod.POST, match: exactPath(VaultApiPath.REINDEX), requiresAuth: true, handler: controller.reindex },
    { method: HttpMethod.POST, match: exactPath(VaultApiPath.SYNC_VECTORS), requiresAuth: true, handler: controller.syncVectorIndex },
  ];
}

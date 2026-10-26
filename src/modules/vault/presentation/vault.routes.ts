import { HttpMethod } from '../../../shared/http/enums/http.enums';
import type { VaultController } from './vault.controller';
import { exactPath, wildcardPath } from '../../../shared/http/helpers/router.helper';
import { Route } from '../../../shared/http/interfaces/router.interface';
import { VaultApiPath } from './enums/vault.enums';

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

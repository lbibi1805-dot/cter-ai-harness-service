import type { QueryParams } from '../../../shared/http/router';
import type { Page, VaultUpload } from '../application/vault.service';
import type { VaultEntry, VaultSearchCriteria } from '../domain';
import type { MultipartPayload } from '../../../shared/http/multipart';

export interface PageLimits {
  defaultLimit: number;
  maxLimit: number;
}

export const FILE_PAGE_LIMITS: PageLimits = { defaultLimit: 50, maxLimit: 1000 };
export const CHUNK_PAGE_LIMITS: PageLimits = { defaultLimit: 50, maxLimit: 100 };

/** Multipart fields that may carry a client-side relative path (folder upload). */
const RELATIVE_PATH_FIELDS = ['path', 'webkitRelativePath'] as const;

export interface ManifestEntryDto {
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt: string;
  folderPath?: string;
  depth?: number;
}

export function parsePage(query: QueryParams, limits: PageLimits): Page {
  const limit = Math.min(parseInt(query.limit ?? '', 10) || limits.defaultLimit, limits.maxLimit);
  const offset = parseInt(query.offset ?? '', 10) || 0;
  return { limit, offset };
}

export function parseIndexedFilter(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function toSearchCriteria(query: QueryParams): VaultSearchCriteria {
  return {
    ...parsePage(query, FILE_PAGE_LIMITS),
    folder: query.folder,
    text: query.q,
    indexed: parseIndexedFilter(query.indexed),
  };
}

/**
 * Maps uploaded files to upload commands. A relative path field (sent per file,
 * in the same order) wins over the bare file name when it contains a folder.
 */
export function toVaultUploads(payload: MultipartPayload): VaultUpload[] {
  const relativePaths = RELATIVE_PATH_FIELDS
    .map((field) => payload.fields[field])
    .find((values) => values && values.length > 0) ?? [];

  return payload.files.map((file, i) => {
    const relativePath = relativePaths[i];
    const rawName = relativePath && relativePath.includes('/') ? relativePath : file.originalName;
    return { rawName, content: file.content };
  });
}

/** Legacy `/api/vault/manifest` shape: entries keyed by file path. */
export function toManifestDto(entries: VaultEntry[]): Record<string, ManifestEntryDto> {
  const files: Record<string, ManifestEntryDto> = {};
  for (const entry of entries) {
    files[entry.filePath] = {
      hash: entry.hash,
      chunkIds: entry.chunkIds,
      indexed: entry.indexed,
      updatedAt: entry.updatedAt,
      folderPath: entry.folderPath,
      depth: entry.depth,
    };
  }
  return files;
}

import type { IncomingHttpHeaders } from 'http';
import { ValidationError } from '../../../../shared/errors';
import { HttpHeader } from '../../../../shared/http/enums/http.enums';
import { VaultDeleteConfirmation, type VaultEntry, type VaultSearchCriteria } from '../../domain';
import { MultipartPayload } from '../../../../shared/http/interfaces/multipart.interface';
import { VaultUpload, Page } from '../../application/interfaces/vault.interface';
import { QueryParams } from '../../../../shared/http/interfaces/router.interface';
import { ManifestEntryDto, PageLimits } from '../dto/vault.dto';
import { FILE_PAGE_LIMITS, RELATIVE_PATH_FIELDS } from '../constants/vault.constants';

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

  if (payload.files.length === 0) throw new ValidationError('No files');
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

/** Clearing the whole vault needs an explicit confirmation header. */
export function requireDeleteAllConfirmation(headers: IncomingHttpHeaders): void {
  if (headers[HttpHeader.CONFIRM] !== VaultDeleteConfirmation.DELETE_ALL) {
    throw new ValidationError(`Missing X-Confirm: ${VaultDeleteConfirmation.DELETE_ALL} header for clear all`);
  }
}

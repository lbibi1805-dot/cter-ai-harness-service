import { HttpHeader, HttpStatus } from '../../../shared/http/http.enums';
import { parseMultipart } from '../../../shared/http/multipart';
import { sendError, sendJson } from '../../../shared/http/response';
import type { RouteContext } from '../../../shared/http/router';
import type { VaultService } from '../application/vault.service';
import { AUTO_INDEX_DEBOUNCE_MS, type VaultIndexingService } from '../application/vaultIndexing.service';
import { ReindexOutcome, VaultDeleteConfirmation } from '../domain';
import {
  CHUNK_PAGE_LIMITS,
  parsePage,
  toManifestDto,
  toSearchCriteria,
  toVaultUploads,
} from './vault.dto';

const RETRY_AFTER_SECONDS = AUTO_INDEX_DEBOUNCE_MS / 1000;

/** HTTP adapter for the vault: parses requests, calls use cases, shapes JSON. */
export class VaultController {
  constructor(
    private readonly vault: VaultService,
    private readonly indexing: VaultIndexingService,
  ) {}

  searchFiles = async ({ res, query }: RouteContext): Promise<void> => {
    const criteria = toSearchCriteria(query);
    const { items, total } = await this.vault.searchFiles(criteria);
    sendJson(res, HttpStatus.OK, { files: items, total, limit: criteria.limit, offset: criteria.offset });
  };

  getManifest = async ({ res, query }: RouteContext): Promise<void> => {
    const { items, total } = await this.vault.searchFiles(toSearchCriteria(query));
    sendJson(res, HttpStatus.OK, { files: toManifestDto(items), total });
  };

  getFile = async ({ res, params }: RouteContext): Promise<void> => {
    const entry = await this.vault.getFile(params.path);
    if (!entry) return sendError(res, HttpStatus.NOT_FOUND, 'Not found');
    sendJson(res, HttpStatus.OK, entry);
  };

  listFolders = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { folders: await this.vault.listFolders() });
  };

  /** `/api/vault/chunks` — one file's chunks with `?file=`, otherwise all chunk ids. */
  listChunks = async (ctx: RouteContext): Promise<void> => {
    if (ctx.query.file) return this.respondFileChunks(ctx, ctx.query.file);
    const page = parsePage(ctx.query, CHUNK_PAGE_LIMITS);
    const { total, chunkIds } = await this.vault.listChunkIds(page);
    sendJson(ctx.res, HttpStatus.OK, { total, limit: page.limit, offset: page.offset, chunkIds });
  };

  listFileChunks = async (ctx: RouteContext): Promise<void> => {
    await this.respondFileChunks(ctx, ctx.params.path);
  };

  uploadFiles = async ({ req, res }: RouteContext): Promise<void> => {
    const uploads = toVaultUploads(await parseMultipart(req));
    if (uploads.length === 0) return sendError(res, HttpStatus.BAD_REQUEST, 'No files');
    const files = await this.vault.uploadFiles(uploads);
    sendJson(res, HttpStatus.OK, { ok: true, files });
    this.indexing.scheduleAfterUpload();
  };

  deleteFile = async ({ res, params }: RouteContext): Promise<void> => {
    const vectorSync = await this.vault.deleteFile(params.path);
    if (vectorSync === null) return sendError(res, HttpStatus.NOT_FOUND, 'Not found');
    sendJson(res, HttpStatus.OK, { ok: true, pinecone: vectorSync });
  };

  /** `DELETE /api/vault/files` — a folder with `?folder=`, otherwise everything (needs confirmation). */
  deleteFiles = async ({ req, res, query }: RouteContext): Promise<void> => {
    if (query.folder) {
      const deleted = await this.vault.deleteFolder(query.folder);
      if (deleted === 0) return sendError(res, HttpStatus.NOT_FOUND, 'Folder not found or empty');
      return sendJson(res, HttpStatus.OK, { ok: true, deleted });
    }
    if (req.headers[HttpHeader.CONFIRM] !== VaultDeleteConfirmation.DELETE_ALL) {
      return sendError(res, HttpStatus.BAD_REQUEST, `Missing X-Confirm: ${VaultDeleteConfirmation.DELETE_ALL} header for clear all`);
    }
    sendJson(res, HttpStatus.OK, { ok: true, deleted: await this.vault.deleteAll() });
  };

  reindex = async ({ res }: RouteContext): Promise<void> => {
    switch (this.indexing.requestManualReindex()) {
      case ReindexOutcome.NOT_CONFIGURED:
        return sendError(res, HttpStatus.BAD_REQUEST, 'vault not configured');
      case ReindexOutcome.ALREADY_RUNNING:
        return sendJson(res, HttpStatus.CONFLICT, { error: 'already indexing', retryAfter: RETRY_AFTER_SECONDS });
      case ReindexOutcome.STARTED:
        return sendJson(res, HttpStatus.ACCEPTED, { ok: true, triggered: true });
    }
  };

  syncVectorIndex = async ({ res }: RouteContext): Promise<void> => {
    if (!this.vault.isVectorIndexEnabled()) return sendError(res, HttpStatus.BAD_REQUEST, 'vault not configured');
    sendJson(res, HttpStatus.OK, { ok: true, result: await this.vault.reconcileVectors() });
  };

  private async respondFileChunks({ res, query }: RouteContext, filePath: string): Promise<void> {
    const page = parsePage(query, CHUNK_PAGE_LIMITS);
    const result = await this.vault.getFileChunks(filePath, page);
    if (!result) return sendError(res, HttpStatus.NOT_FOUND, 'File not found');
    sendJson(res, HttpStatus.OK, { file: filePath, total: result.total, limit: page.limit, offset: page.offset, chunks: result.chunks });
  }
}

import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { parseMultipart } from '../../../shared/http/multipart';
import { sendError, sendJson } from '../../../shared/http/response';
import type { VaultService } from '../application/vault.service';
import { type VaultIndexingService } from '../application/vaultIndexing.service';
import { ReindexOutcome } from '../domain';
import {
  parsePage,
  toManifestDto,
  toSearchCriteria,
  toVaultUploads,
  requireDeleteAllConfirmation,
} from './mappers/vault.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { CHUNK_PAGE_LIMITS, RETRY_AFTER_SECONDS } from './constants/vault.constants';

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
    sendJson(res, HttpStatus.OK, await this.vault.getFile(params.path));
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
    sendJson(res, HttpStatus.OK, { ok: true, files: await this.vault.uploadFiles(uploads) });
  };

  deleteFile = async ({ res, params }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { ok: true, pinecone: await this.vault.deleteFile(params.path) });
  };

  /** `DELETE /api/vault/files` — a folder with `?folder=`, otherwise everything (needs confirmation). */
  deleteFiles = async ({ req, res, query }: RouteContext): Promise<void> => {
    if (query.folder) return sendJson(res, HttpStatus.OK, { ok: true, deleted: await this.vault.deleteFolder(query.folder) });
    requireDeleteAllConfirmation(req.headers);
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
    sendJson(res, HttpStatus.OK, { ok: true, result: await this.vault.syncVectorIndex() });
  };

  private async respondFileChunks({ res, query }: RouteContext, filePath: string): Promise<void> {
    const page = parsePage(query, CHUNK_PAGE_LIMITS);
    const result = await this.vault.getFileChunks(filePath, page);
    sendJson(res, HttpStatus.OK, { file: filePath, total: result.total, limit: page.limit, offset: page.offset, chunks: result.chunks });
  }
}

import { bearerHeaders, linkUrl, ensureOk } from '../../../shared/canvas/canvasHttp';
import { ContentType, HttpHeader, HttpMethod, HttpStatus } from '../../../shared/http/enums/http.enums';
import type { CanvasFile, CanvasFilesGateway, CanvasFolder } from '../domain/interfaces/canvasFiles.port';
import { START_FILE_PREFIX, UPLOAD_ON_DUPLICATE } from '../domain/constants/fileqa.constants';
import { CANVAS_API_PREFIX, CANVAS_PAGE_SIZE } from '../../../shared/canvas/constants/canvasHttp.constants';
import { CanvasRequestError } from '../../../shared/canvas/errors/canvasHttp.errors';
import { UploadSlot } from './interfaces/canvasFilesClient.interface';
import { MULTIPART_FILE_FIELD, UPLOAD_REDIRECT_STATUSES } from './constants/canvasFilesClient.constants';

/** Canvas Files REST API for one account (My Files folders, START_* listing, result upload). */
export class CanvasFilesClient implements CanvasFilesGateway {
  private readonly apiBase: string;

  constructor(baseUrl: string, private readonly apiKey: string) {
    this.apiBase = `${baseUrl}${CANVAS_API_PREFIX}`;
  }

  async findFolderByPath(path: string): Promise<CanvasFolder | null> {
    const response = await this.get(`${this.apiBase}/users/self/folders/by_path/${encodeURIComponent(path)}`);
    if (response.status === HttpStatus.NOT_FOUND) return null;
    const folders = (await ensureOk(response, 'findFolderByPath').json()) as CanvasFolder[];
    return folders[folders.length - 1] ?? null;
  }

  async listSubfolders(folderId: number): Promise<CanvasFolder[]> {
    const response = await this.get(`${this.apiBase}/folders/${folderId}/folders?per_page=${CANVAS_PAGE_SIZE}`);
    return (await ensureOk(response, 'listSubfolders').json()) as CanvasFolder[];
  }

  async createFolder(parentFolderId: number, name: string): Promise<CanvasFolder> {
    const response = await this.postJson(`${this.apiBase}/folders/${parentFolderId}/folders`, { name });
    return (await ensureOk(response, 'createFolder').json()) as CanvasFolder;
  }

  /** Newest first; pagination stops at the first file older than `since` (the poll watermark). */
  async listFilesInFolder(folderId: number, since?: Date): Promise<CanvasFile[]> {
    const params = new URLSearchParams({ search_term: START_FILE_PREFIX, sort: 'updated_at', order: 'desc', per_page: String(CANVAS_PAGE_SIZE) });
    const files: CanvasFile[] = [];
    let url: string | null = `${this.apiBase}/folders/${folderId}/files?${params}`;
    while (url) {
      const response = ensureOk(await this.get(url), 'listFilesInFolder');
      const page = (await response.json()) as CanvasFile[];
      const staleIndex = since ? page.findIndex((file) => new Date(file.updated_at).getTime() < since.getTime()) : -1;
      if (staleIndex !== -1) {
        files.push(...page.slice(0, staleIndex));
        break;
      }
      files.push(...page);
      url = linkUrl(response.headers.get(HttpHeader.LINK));
    }
    return files;
  }

  /** Every file (no search filter) — used to see which results already exist in the output folder. */
  async listAllFilesInFolder(folderId: number): Promise<CanvasFile[]> {
    const files: CanvasFile[] = [];
    let url: string | null = `${this.apiBase}/folders/${folderId}/files?per_page=${CANVAS_PAGE_SIZE}`;
    while (url) {
      const response = ensureOk(await this.get(url), 'listAllFilesInFolder');
      files.push(...((await response.json()) as CanvasFile[]));
      url = linkUrl(response.headers.get(HttpHeader.LINK));
    }
    return files;
  }

  async downloadFile(fileUrl: string): Promise<Buffer> {
    const response = ensureOk(await this.get(fileUrl), 'download');
    return Buffer.from(await response.arrayBuffer());
  }

  /** Two steps: ask Canvas for an upload slot in the folder, then POST the bytes to the pre-signed URL. */
  async uploadFileToFolder(folderId: number, fileName: string, content: Buffer, mimeType: string): Promise<void> {
    const slotResponse = await this.postJson(`${this.apiBase}/users/self/files`, {
      name: fileName,
      size: content.length,
      content_type: mimeType,
      parent_folder_id: folderId,
      on_duplicate: UPLOAD_ON_DUPLICATE,
    });
    const slot = (await ensureOk(slotResponse, 'upload slot').json()) as UploadSlot;

    const form = new FormData();
    for (const [key, value] of Object.entries(slot.upload_params)) form.append(key, value);
    form.append(MULTIPART_FILE_FIELD, new Blob([new Uint8Array(content)], { type: mimeType }), fileName);
    const uploadResponse = await fetch(slot.upload_url, { method: HttpMethod.POST, body: form });
    if (!uploadResponse.ok && !UPLOAD_REDIRECT_STATUSES.has(uploadResponse.status)) {
      throw new CanvasRequestError('file upload', uploadResponse);
    }
  }

  private get(url: string): Promise<Response> {
    return fetch(url, { headers: bearerHeaders(this.apiKey) });
  }

  private postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
      method: HttpMethod.POST,
      headers: { ...bearerHeaders(this.apiKey), [HttpHeader.CONTENT_TYPE]: ContentType.JSON },
      body: JSON.stringify(body),
    });
  }
}

import type { CanvasFile, CanvasFolder } from '../types';

export class CanvasClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  private get headers() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  // ── Folders ────────────────────────────────────────────────────────────────

  /** Returns the folder at the given path under My Files, or null if not found. */
  async findFolderByPath(path: string): Promise<CanvasFolder | null> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/users/self/folders/by_path/${encodeURIComponent(path)}`,
      { headers: this.headers }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Canvas findFolderByPath failed: ${res.status} ${res.statusText}`);
    const folders: CanvasFolder[] = await res.json() as CanvasFolder[];
    return folders[folders.length - 1] ?? null;
  }

  /** Lists immediate subfolders of a folder. */
  async listSubfolders(folderId: number): Promise<CanvasFolder[]> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/folders/${folderId}/folders?per_page=100`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Canvas listSubfolders failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<CanvasFolder[]>;
  }

  /** Creates a subfolder inside parentFolderId. */
  async createFolder(parentFolderId: number, name: string): Promise<CanvasFolder> {
    const res = await fetch(`${this.baseUrl}/api/v1/folders/${parentFolderId}/folders`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Canvas createFolder failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<CanvasFolder>;
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  /** Lists files inside a specific folder, filtered to START_* and sorted newest-first. */
  async listFilesInFolder(folderId: number, since?: Date): Promise<CanvasFile[]> {
    const files: CanvasFile[] = [];
    const params = new URLSearchParams({
      search_term: 'START_',
      sort: 'updated_at',
      order: 'desc',
      per_page: '100',
    });
    let url: string | null = `${this.baseUrl}/api/v1/folders/${folderId}/files?${params}`;

    while (url) {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) throw new Error(`Canvas listFilesInFolder failed: ${res.status} ${res.statusText}`);
      const page: CanvasFile[] = await res.json() as CanvasFile[];

      if (since) {
        const cutoff = since.getTime();
        const staleIdx = page.findIndex((f) => new Date(f.updated_at).getTime() < cutoff);
        if (staleIdx !== -1) {
          files.push(...page.slice(0, staleIdx));
          break;
        }
      }

      files.push(...page);
      url = parseLinkNext(res.headers.get('Link'));
    }

    return files;
  }

  /** Lists ALL files inside a folder (no search filter — used for the A/output folder). */
  async listAllFilesInFolder(folderId: number): Promise<CanvasFile[]> {
    const files: CanvasFile[] = [];
    let url: string | null =
      `${this.baseUrl}/api/v1/folders/${folderId}/files?per_page=100`;

    while (url) {
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) throw new Error(`Canvas listAllFilesInFolder failed: ${res.status} ${res.statusText}`);
      const page: CanvasFile[] = await res.json() as CanvasFile[];
      files.push(...page);
      url = parseLinkNext(res.headers.get('Link'));
    }

    return files;
  }

  async downloadFile(fileUrl: string): Promise<Buffer> {
    const res = await fetch(fileUrl, { headers: this.headers });
    if (!res.ok) throw new Error(`Canvas download failed: ${res.status} ${res.statusText}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  /** Uploads a file into a specific folder (by folderId). */
  async uploadFileToFolder(
    folderId: number,
    fileName: string,
    content: Buffer,
    mimeType: string
  ): Promise<void> {
    // Step 1: request upload slot targeting the specific folder
    const slotRes = await fetch(`${this.baseUrl}/api/v1/users/self/files`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fileName,
        size: content.length,
        content_type: mimeType,
        parent_folder_id: folderId,
        on_duplicate: 'overwrite',
      }),
    });
    if (!slotRes.ok) throw new Error(`Canvas upload slot failed: ${slotRes.status} ${slotRes.statusText}`);
    const slot = await slotRes.json() as { upload_url: string; upload_params: Record<string, string> };

    // Step 2: multipart upload to the pre-signed URL
    const form = new FormData();
    for (const [k, v] of Object.entries(slot.upload_params)) {
      form.append(k, v);
    }
    form.append('file', new Blob([new Uint8Array(content)], { type: mimeType }), fileName);

    const uploadRes = await fetch(slot.upload_url, { method: 'POST', body: form });
    if (!uploadRes.ok && uploadRes.status !== 301 && uploadRes.status !== 302) {
      throw new Error(`Canvas file upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
    }
  }
}

function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, relPart] = part.split(';');
    if (relPart?.trim() === 'rel="next"') {
      const match = urlPart.trim().match(/^<(.+)>$/);
      if (match) return match[1];
    }
  }
  return null;
}

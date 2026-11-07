import * as fs from 'fs';
import * as path from 'path';
import { ObjectMetadataKey, ObjectStorageKind } from './enums/objectStorage.enums';
import { LOCAL_META_SUFFIX } from './constants/objectStorage.constants';
import { assertValidKey, assertValidPrefix, sha256Hex, toBuffer } from './helpers/objectKey.helper';
import type { ObjectInfo, PutObjectOptions, StoredObject } from './interfaces/objectStorage.interface';
import type { ObjectStorage } from './objectStorage.port';

interface LocalMeta {
  contentType: string;
  metadata: Record<string, string>;
}

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

/**
 * Objects as files under a root directory (dev and tests). Metadata lives in
 * a sidecar `<file>.meta.json`. Same key rules and semantics as R2.
 */
export class LocalDiskObjectStorage implements ObjectStorage {
  readonly kind = ObjectStorageKind.LOCAL_DISK;
  readonly location: string;
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
    this.location = this.root;
  }

  async put(key: string, body: Buffer | string, options: PutObjectOptions): Promise<void> {
    const file = this.fileFor(key);
    const bytes = toBuffer(body);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const meta: LocalMeta = { contentType: options.contentType, metadata: { ...options.metadata, [ObjectMetadataKey.SHA256]: sha256Hex(bytes) } };
    await fs.promises.writeFile(file + LOCAL_META_SUFFIX, JSON.stringify(meta));
    await fs.promises.writeFile(file, bytes);
  }

  async get(key: string): Promise<StoredObject | null> {
    const file = this.fileFor(key);
    try {
      const body = await fs.promises.readFile(file);
      const meta = await this.readMeta(file);
      return { body, contentType: meta?.contentType, metadata: meta?.metadata ?? {} };
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    const file = this.fileFor(key);
    try {
      const stat = await fs.promises.stat(file);
      return { key, size: stat.size, lastModified: stat.mtime, metadata: (await this.readMeta(file))?.metadata ?? {} };
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const file = this.fileFor(key);
    await fs.promises.rm(file, { force: true });
    await fs.promises.rm(file + LOCAL_META_SUFFIX, { force: true });
  }

  async deleteMany(keys: string[]): Promise<void> {
    keys.forEach(assertValidKey);
    for (const key of keys) await this.delete(key);
  }

  async deletePrefix(prefix: string): Promise<number> {
    const objects = await this.list(prefix);
    await this.deleteMany(objects.map((o) => o.key));
    return objects.length;
  }

  async list(prefix: string): Promise<ObjectInfo[]> {
    assertValidPrefix(prefix);
    const found: ObjectInfo[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (entry.name.endsWith(LOCAL_META_SUFFIX)) continue;
        const key = path.relative(this.root, full).split(path.sep).join('/');
        if (!key.startsWith(prefix)) continue;
        const stat = await fs.promises.stat(full);
        found.push({ key, size: stat.size, lastModified: stat.mtime });
      }
    };
    const topFolder = prefix.split('/')[0];
    await walk(path.join(this.root, topFolder));
    return found.sort((a, b) => a.key.localeCompare(b.key));
  }

  async presignGet(): Promise<string | null> {
    return null;
  }

  private fileFor(key: string): string {
    assertValidKey(key);
    const file = path.resolve(this.root, ...key.split('/'));
    if (!file.startsWith(this.root + path.sep)) throw new Error(`Object key escapes root: ${key}`);
    return file;
  }

  private async readMeta(file: string): Promise<LocalMeta | null> {
    try {
      return JSON.parse(await fs.promises.readFile(file + LOCAL_META_SUFFIX, 'utf-8')) as LocalMeta;
    } catch {
      return null;
    }
  }
}

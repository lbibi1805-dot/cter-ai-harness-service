import type { CaptureMimeType } from '../../domain';

export interface CaptureServiceOptions {
  /** Lifetime of the presigned image URLs in a listing. */
  urlTtlSeconds: number;
  maxImagesPerBatch: number;
  now: () => number;
}

/** One image as the API returns it. */
export interface CaptureImageView {
  name: string;
  seq: number;
  mimeType: CaptureMimeType;
  bytes: number;
  createdAt: string;
  /** Presigned GET URL (R2), loadable without any key until it expires; null on local-disk storage. */
  url: string | null;
  /** Path of the proxy download (`GET`, needs the capture key) — always works. */
  path: string;
}

export interface CaptureBatchView {
  /** `"{folder}/{index}"` — stable id receivers can mark as done. */
  id: string;
  folder: string;
  index: number;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
  images: CaptureImageView[];
}

export interface CaptureFolderView {
  name: string;
  batchCount: number;
  imageCount: number;
  latestIndex: number;
  updatedAt: string;
}

export interface CaptureListQuery {
  folder?: string;
  /** Only batches changed after this instant (ms); results then run oldest → newest. */
  since?: number;
  limit: number;
}

export interface CaptureListView {
  folders: CaptureFolderView[];
  batches: CaptureBatchView[];
  /** Pass back as `since` to get only what changed afterwards. */
  cursor: string | null;
  hasMore: boolean;
}

export interface CaptureFile {
  body: Buffer;
  mimeType: string;
}

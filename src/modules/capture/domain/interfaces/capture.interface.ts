import type { CaptureMimeType } from '../enums/capture.enums';

/** One stored photo. `name` is unique inside its batch; `key` is the object key. */
export interface CaptureImage {
  name: string;
  key: string;
  seq: number;
  mimeType: CaptureMimeType;
  bytes: number;
  createdAt: number;
}

/** A batch = the photos of one exercise ("bài #index") taken by `folder`. */
export interface CaptureBatch {
  folder: string;
  index: number;
  createdAt: number;
  updatedAt: number;
  /** Ordered by `seq` (upload order). */
  images: CaptureImage[];
}

export interface CaptureFolderSummary {
  name: string;
  /** Batches with at least one image. */
  batchCount: number;
  imageCount: number;
  latestIndex: number;
  updatedAt: number;
}

/** What a storage listing gives back for one object. */
export interface CaptureObjectEntry {
  key: string;
  size: number;
  lastModified?: Date;
}

export interface CaptureKeyParts {
  folder: string;
  index: number;
  name: string;
  seq: number;
  mimeType: CaptureMimeType;
}

import { type VectorChunkMetadata } from '../../domain';

export interface Page {
  limit: number;
  offset: number;
}

export interface VaultUpload {
  rawName: string;
  content: string;
}

export type VaultUploadResult =
  | { file: string; hash: string; indexed: false }
  | { file: string; error: string };

export interface VaultChunkView extends Partial<VectorChunkMetadata> {
  id: string;
  index: number;
  indexed: boolean;
}

export interface FileChunksResult {
  total: number;
  chunks: VaultChunkView[];
}

export interface ChunkIdsResult {
  total: number;
  chunkIds: string[];
}

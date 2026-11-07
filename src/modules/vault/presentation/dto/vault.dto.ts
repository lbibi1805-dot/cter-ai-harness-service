export interface PageLimits {
  defaultLimit: number;
  maxLimit: number;
}

export interface ManifestEntryDto {
  docId: string;
  status: string;
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt: string;
  folderPath?: string;
  depth?: number;
}

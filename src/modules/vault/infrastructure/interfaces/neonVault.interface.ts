export interface VaultManifestRow {
  file_path: string;
  hash: string;
  chunk_ids: string[] | string | null;
  indexed: boolean;
  updated_at: Date | string;
  content: string | null;
  folder_path: string | null;
  depth: number | null;
}

export interface WhereClause {
  sql: string;
  params: unknown[];
}

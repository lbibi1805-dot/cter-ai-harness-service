export interface VaultManifestRow {
  file_path: string;
  doc_id: string;
  hash: string;
  object_key: string | null;
  chunk_ids: string[] | string | null;
  indexed: boolean;
  indexed_hash: string | null;
  status: string;
  source_type: string | null;
  content_type: string | null;
  size_bytes: number | string | null;
  last_error: string | null;
  updated_at: Date | string;
  folder_path: string | null;
  depth: number | null;
}

export interface WhereClause {
  sql: string;
  params: unknown[];
}

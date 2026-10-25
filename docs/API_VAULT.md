# Vault API (Neon PG hierarchies)

Base: `http://localhost:3000` / `https://<render>.onrender.com`
Auth: `ADMIN_TOKEN` → `Authorization: Bearer <token>` cho `POST`/`DELETE` (nếu set)

## Endpoints

### Health
- `GET /health` → `{"vault":"70/70 indexed","polling":"stopped"}` (PG `count(*) FILTER`)
- `GET /` → `{"status":"up","vault":{"index","provider"}}`

### Upload (giữ hierarchies)
- `POST /api/vault/files` `multipart/form-data` field `file` (multiples). Giữ folder qua `filename=lab-99/hello.md` (forward-slash, sanitize `..`, check `<1024`). Ghi `documents-vault/<path>` + `upsert vault_manifest(file_path, hash, chunkIds=[], indexed=false)` (hash=`md5(normalizeText)`).
- Example: `curl -H "Authorization: Bearer $ADMIN_TOKEN" -F "file=@a.md;filename=lab-99/a.md" /api/vault/files`

### List files
- `GET /api/vault/files?folder=&q=&indexed=&limit=&offset=` → `{"files":[{"filePath","hash","chunkIds","indexed","updatedAt","folderPath","depth"}, ...],"total","limit","offset"}`
  - `folder=lab-2` → `file_path = 'lab-2' OR LIKE 'lab-2/%'`
  - `q=REQUIREMENT` → `ILIKE %q%`
- `GET /api/vault/manifest` → legacy `{"files":{"lab-2/file.md":{...}},"total"}`

### Folders
- `GET /api/vault/folders` → `{"folders":[{"path","depth","fileCount"}]}` (Neon `SELECT DISTINCT folder_path`, expand intermediate `a/b/c.md → a, a/b`)

### File detail / delete
- `GET /api/vault/files/:path` → `VaultEntry` | `404`
- `DELETE /api/vault/files/:path` → `{"ok":true}` — lấy `chunkIds` → `VectorStore.deleteByIds` (Pinecone batch 100) → `DELETE FROM vault_manifest` → `unlink` disk. Chunk aggregate giảm.

### Chunks
- `GET /api/vault/chunks?limit=&offset=` → `{"total":871,"chunkIds":[...]} ` (aggregate từ manifest)
- `GET /api/vault/files/:path/chunks?limit=&offset=` hoặc `GET /api/vault/chunks?file=lab-99/a.md` → `{"file","total","chunks":[{"id","index","indexed","text","heading","parentHeading","tokenCount"}]}` — enrich từ `VectorStore.fetchByIds` nếu `indexed:true`.

## DB Schema (Neon)

`migrations/001_vault_manifest.sql`:
```sql
CREATE TABLE vault_manifest (
  file_path TEXT PRIMARY KEY CHECK (length<1024),
  hash TEXT, chunk_ids JSONB, indexed BOOLEAN, updated_at TIMESTAMPTZ,
  folder_path TEXT GENERATED ALWAYS AS (regexp_replace(file_path,'/[^/]+$','')) STORED,
  depth INT GENERATED ALWAYS AS (length(file_path)-length(replace(file_path,'/',''))) STORED
);
CREATE INDEX idx_vault_manifest_indexed ON vault_manifest(indexed);
CREATE INDEX idx_vault_manifest_folder ON vault_manifest(folder_path);
CREATE INDEX idx_vault_manifest_depth ON vault_manifest(depth);
```

## RAG hierarchies

`KnowledgeIndexer` scan `VAULT_PATH`, `md5(normalizeText)` → so PG `hash`, upsert `indexed=false` → chunk `H1(##)/H2(#)` + `CHUNK_MAX 800` overlap `100` → `makeChunk` id `baseName_heading_chunk_###` → `upsertChunks` Pinecone metadata `{text,source=file_path,heading,parentHeading,tokenCount}` → mark `indexed=true`. `citationPromptBuilder` render `SOURCE: folder/file.md > parentHeading > heading`.

## Delete chunk behavior

`DELETE /api/vault/files/:path` xóa 1 file → xóa toàn bộ `chunkIds` của file khỏi Pinecone → RAG không còn retrieve chunk đó. File khác không ảnh hưởng. `GET /api/vault/chunks` total giảm.

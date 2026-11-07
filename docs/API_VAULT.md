# Vault API (Neon manifest + R2 objects + Pinecone vectors)

Base: `http://localhost:3000` / `https://<render>.onrender.com`
Auth: `ADMIN_TOKEN` → `Authorization: Bearer <token>` cho `POST`/`DELETE` (nếu set)

> Từ 07/11/2026: nội dung file nằm trên **object storage** (Cloudflare R2, `R2_*`; dev không có R2 thì thư mục
> `OBJECT_STORAGE_DIR`). Bảng `vault_manifest` chỉ giữ id + trạng thái. Thiết kế: `planning/planning-06112026/02`, `12`.

## Ba nơi lưu, một nguồn sự thật

| Nơi | Dữ liệu | Khoá |
|---|---|---|
| Neon `vault_manifest` (**nguồn sự thật**) | `file_path`, `doc_id`, `hash`, `object_key`, `chunk_ids`, `indexed_hash`, `status`, `last_error` | `file_path` (PK), `doc_id` (unique) |
| R2 | Markdown đã chuẩn hoá | `vault/{docId}/{hash}.md` (content-addressed, không ghi đè) · metadata `sha256`, `doc-id`, `content-hash` |
| Pinecone | Vector từng chunk | `<docId>#<hash8>#<idx3>` · metadata `docId`, `contentHash`, `source`, `heading`… |

- `hash` = md5 của nội dung chuẩn hoá (math-alphanumeric → ASCII, bỏ BOM, CRLF → LF, bỏ khoảng trắng cuối file). Không dùng ETag của R2.
- `status`: `active` · `indexing` (bản mới chưa embed, bản cũ vẫn phục vụ RAG) · `failed` (`last_error`, bản cũ vẫn phục vụ) · `deleting` (đang xoá, ẩn khỏi mọi API đọc và khỏi RAG).
- Server chỉ chạy **1 instance**: manifest được cache trong RAM sau lần đọc đầu → `GET` và `/health` **không query DB**. Sửa DB ngoài app (SQL editor, script) thì gọi `POST /api/vault/sync` hoặc restart.

## Endpoints

### Upload
`POST /api/vault/files` (multipart, field `files`/`file`, đường dẫn trong `filename` hoặc field `path`/`webkitRelativePath`)

```json
{ "ok": true, "files": [ { "file": "lab-2/a.md", "hash": "…", "indexed": false, "outcome": "created" },
                         { "file": "lab-2/b.md", "hash": "…", "indexed": true,  "outcome": "unchanged" },
                         { "file": "x.md", "error": "…" } ] }
```

- `outcome`: `created` · `updated` (nội dung khác → object mới, re-embed **chỉ file đó**) · `unchanged` (cùng hash → **0 put R2, 0 embed**).
- Tên không có `.md` → thêm `.md`; `\` → `/`; bỏ `../`; dài hơn 1023 ký tự → lỗi.
- Indexing chạy nền (debounce 2 s); file lỗi được thử lại sau 30 s / 90 s / 240 s.

### Đổi tên
`POST /api/vault/files/<path>/rename` body `{ "newPath": "folder/new.md" }` → `{ "ok": true, "file": VaultEntry }`
Chỉ đổi `file_path` trong Neon: **0 put, 0 embed**. Trích dẫn RAG dùng đường dẫn mới ngay (guard đọc từ manifest). `409` nếu đích đã tồn tại.

### Đọc
- `GET /api/vault/files?folder=&q=&indexed=&limit=&offset=` → `{ files: VaultEntry[], total, limit, offset }`
- `GET /api/vault/files/<path>` → `VaultEntry` + `content` (đọc từ R2, kiểm tra sha256) | `404`
- `GET /api/vault/folders`, `GET /api/vault/manifest` (dạng cũ, thêm `docId`, `status`)
- `GET /api/vault/chunks?limit=&offset=`, `GET /api/vault/files/<path>/chunks` (metadata từ Pinecone)

`VaultEntry`: `filePath, docId, hash, objectKey, chunkIds, indexed, indexedHash, status, sourceType, contentType, sizeBytes, lastError, updatedAt, folderPath, depth`.

### Xoá (state machine `active → deleting → (row xoá)`)
- `DELETE /api/vault/files/<path>`
- `DELETE /api/vault/files?folder=<folder>`
- `DELETE /api/vault/files` + header `X-Confirm: delete-all`

Thứ tự: commit `status='deleting'` → xoá vector theo prefix `<docId>#` (list + delete) → xoá prefix R2 `vault/<docId>/`, `derived/<docId>/` → xoá row.
Trả `200 {ok, deleted, pending: 0, pinecone: "ok"|"skip"}` khi sạch; **`202`** với `pending > 0` khi một bước lỗi (row ở lại `deleting`, đã ẩn khỏi RAG; reconcile xoá nốt). Gọi lại vẫn an toàn (idempotent).

### Reindex / Reconcile
- `POST /api/vault/reindex` → `202` (chạy nền), `409` đang chạy, `400` không có Pinecone.
- `POST /api/vault/sync` (tên cũ `/api/vault/sync-pinecone` vẫn chạy) → reload manifest vào RAM rồi dọn rác:

```json
{ "ok": true, "result": { "deletesResumed": 0, "deletesStillPending": 0, "orphanVectorsDeleted": 3,
  "orphanObjectsDeleted": 1, "pendingIndex": 0, "legacyRows": 0, "skipped": [] } }
```

Reconcile cũng chạy lúc startup. Object mồ côi chỉ bị xoá khi cũ hơn 10 phút (tránh xoá file đang upload dở).
`legacyRows > 0` = row cũ còn nội dung trong Neon, chưa có object → chạy reset + upload lại.

## Vận hành

| Lệnh | Việc |
|---|---|
| `npm run vault:reset` | Dry-run: in DB host, bucket, index và số lượng |
| `npm run vault:reset -- --confirm` | Xoá vectors + rows + `vault/`, `derived/` (không đụng `conversations/`). Bucket/index có chữ `prod` cần thêm `--allow-prod` |
| `npm run vault:upload -- <folder> [--url …] [--prefix …]` | Upload cả thư mục `.md` qua API (file trùng → `unchanged`) |
| `npm run smoke:r2` | Kiểm tra bucket R2 thật bằng 2 object nhỏ dưới `tmp/`, tự dọn |

## DB Schema

`migrations/001` + `004_vault_object_storage.sql` (SchemaGuard tự áp khi khởi động, 1 transaction).
`006_drop_legacy_vault_content.sql` **chạy tay sau khi reset** (bỏ cột `content` cũ).

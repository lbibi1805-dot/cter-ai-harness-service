# Đồng bộ Document Vault và Hướng dẫn Docker

> Áp dụng cho `cter-ai-harness-service`. Cơ chế đồng bộ 2 chiều giữa local dev và Docker container.

## 1. Nguyên lý đồng bộ

| Thành phần | Đường dẫn | Vai trò | Đồng bộ |
|---|---|---|---|
| Document vault | `./documents-vault/` | Chứa file `.md` nguồn cho RAG | Cùng folder, mount read-write |
| Manifest | `./.vault-manifest.json` | Lưu hash MD5 + `indexed: true/false` | Cùng file, mount read-write |
| State polling | `./data/` | Lưu `processed.json` | Cùng folder, mount read-write |
| Pinecone | Cloud | Lưu vector embedding | Dùng chung 1 index |

**Cơ chế incremental indexing** (`src/modules/retrieval/application/knowledgeIndexer.service.ts`):

1. `indexAll()` đọc manifest → so sánh hash file thực tế
2. Chỉ embed file có `hash` khác hoặc `indexed: false`
3. Embed xong hết chunks → ghi `indexed: true` vào manifest
4. Local và Docker **đọc/ghi cùng manifest** → ai làm trước, người sau skip

## 2. Cấu trúc thư mục cần mount

```
cter-ai-harness-service/
├── documents-vault/          # ← mount read-write
│   ├── C-POINTER/
│   ├── Week-01/
│   └── ...
├── .vault-manifest.json      # ← mount read-write
├── data/                     # ← mount read-write
├── docker-compose.yml
└── Dockerfile
```

## 3. Docker Compose (khuyến nghị)

File `docker-compose.yml` đã cấu hình sẵn:

```yaml
services:
  harness:
    build: .
    image: cter-ai-harness-service:latest
    container_name: cter-harness
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./documents-vault:/app/documents-vault
      - ./.vault-manifest.json:/app/.vault-manifest.json
    restart: unless-stopped
```

### Lệnh thường dùng

```bash
# Build image (lần đầu hoặc sau khi sửa code/dependencies)
docker compose build --no-cache

# Khởi động container nền
docker compose up -d

# Xem log realtime
docker logs -f cter-harness

# Restart sau khi sửa .env
docker compose restart

# Dừng và xóa container (giữ volume)
docker compose down

# Dừng và xóa container + volume (reset state)
docker compose down -v
```

## 4. Docker Run (thay thế compose)

Nếu không dùng compose, dùng absolute path tránh lỗi relative path trên Windows:

```bash
# PowerShell
docker rm -f cter-harness
docker run -d --name cter-harness -p 3000:3000 --env-file .env `
  -v "${PWD}/data:/app/data" `
  -v "${PWD}/documents-vault:/app/documents-vault" `
  -v "${PWD}/.vault-manifest.json:/app/.vault-manifest.json" `
  cter-harness:latest

# Bash/Git Bash
docker run -d --name cter-harness -p 3000:3000 --env-file .env \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/documents-vault:/app/documents-vault" \
  -v "$(pwd)/.vault-manifest.json:/app/.vault-manifest.json" \
  cter-harness:latest

# Xem log
docker logs -f cter-harness

# Stop/Start
docker stop cter-harness
docker start cter-harness
```

## 5. Workflow thêm/sửa document

### 5.1 Thêm file mới (local dev)

```bash
# 1. Thêm file .md vào documents-vault/
cp my-doc.md documents-vault/MyFolder/my-doc.md

# 2. Chạy local để index
npm run dev
# Log: "1/25 files changed — indexing 1 files" → "Embedding N new chunks" → "indexed: true"

# 3. Docker (nếu đang chạy) sẽ skip tự động vì manifest đã indexed: true
```

### 5.2 Sửa file có sẵn

```bash
# 1. Sửa file .md trong documents-vault/
code documents-vault/Week-01/Architecture.md

# 2. Chạy local hoặc restart docker để re-index
npm run dev
# Hoặc
docker compose restart
# Log: "1/25 files changed — indexing 1 files"
```

### 5.3 Xóa file

```bash
# 1. Xóa file .md
rm documents-vault/OldFolder/old-doc.md

# 2. Chạy local hoặc restart docker
npm run dev
# Log: "Removed N chunks from 1 deleted files" → manifest xóa entry
```

## 6. Lưu ý quan trọng

| Vấn đề | Giải pháp |
|---|---|
| **Chạy local + Docker cùng lúc** | ❌ Không được. Hai process ghi manifest gây conflict. Chạy xen kẽ. |
| **Manifest bị mất/corrupt** | Xóa `.vault-manifest.json` → chạy lại sẽ full re-index (tốn quota embedding). |
| **Rate limit 429 khi embed** | Manifest giữ `indexed: false`. Lần sau restart sẽ tiếp tục embed chunks còn lại. |
| **Thay đổi embedding model/dimension** | Xóa manifest + Pinecone index → full re-index. |
| **Rebuild Docker image** | Volume mount ghi đè `COPY` trong Dockerfile, manifest/vault trên host luôn thắng. |

## 6. Kiểm tra trạng thái

```bash
# Health check API
curl http://localhost:3000/
# {"status":"up","polling":"running","canvasAccounts":[{"index":1,"email":"ch***ng@gmail.com"}]}

# Kiểm tra manifest
cat .vault-manifest.json | jq '.files | length'
cat .vault-manifest.json | jq '.files[] | select(.indexed==false)'

# Kiểm tra container
docker ps --filter name=cter-harness
docker exec cter-harness ls -la /app/documents-vault
```

## 7. Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `Vault path not found: /app/documents-vault` | Mount thất bại | Dùng `docker compose up` hoặc absolute path `${PWD}/documents-vault` |
| `OPENAI_API_KEY required` | `EMBEDDING_PROVIDER=gemini` có trailing space/CRLF | Fix `.env` line ending LF, không space cuối dòng |
| `All N files unchanged` nhưng Pinecone thiếu vector | Manifest ghi `indexed: true` sai | Xóa `.vault-manifest.json` → re-index |
| Container exit ngay | Thiếu key trong `.env` (PINECONE, GEMINI, CLAUDE...) | Điền đủ keys, `docker compose restart` |

## 8. Tóm tắt lệnh nhanh

```bash
# Dev local
npm run dev

# Docker production
docker compose build --no-cache && docker compose up -d
docker logs -f cter-harness

# Thêm/sửa doc → chạy lại index
npm run dev          # local
docker compose restart  # docker

# Reset hoàn toàn
docker compose down -v
rm .vault-manifest.json
docker compose build --no-cache && docker compose up -d
```

---

**Liên quan:** `docs/git-flow.md`, `docs/docker.md`, `README.md`
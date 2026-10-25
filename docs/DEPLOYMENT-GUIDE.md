# Hướng dẫn Host & Cấu hình Backend

> Cập nhật 10/10/2026: bảng biến môi trường đầy đủ (mục 4), reranker + agent (mục 4.3), checklist và sự cố mới. Danh sách thay đổi code: [`CHANGES.md`](../CHANGES.md).

Tài liệu này hướng dẫn cách chọn dịch vụ hosting và cấu hình để chạy Canvas File Helper trên môi trường production (24/7).

## 1. Đặc điểm kiến trúc (quan trọng khi chọn host)

Backend này **không phải** app serverless. Nó cần:

| Yêu cầu | Lý do |
|---|---|
| Chạy liên tục 24/7 | `PollScheduler` poll Canvas mỗi `POLL_INTERVAL_MS`, tự bật khi khởi động (`POLL_AUTOSTART=true`) |
| Đĩa lưu trữ bền (persistent disk) | Chỉ cần khi `VAULT_STORAGE_PROVIDER=sqlite-disk`. Với `postgres-r2` (Neon) manifest vault + con trỏ poll nằm trong DB; `data/processed.json` vẫn là file |
| Outbound HTTPS tới nhiều nơi | Canvas API, Gemini/Claude/Grok/OpenAI, Pinecone (vector + rerank), Neon, Gmail SMTP |
| Một instance (không cần scale) | Không hỗ trợ nhiều instance chạy song song (state file không share) |
| API port (mặc định 3000) | `ApiServer` — tuỳ chọn, có thể không cần mở public |

→ **Loại ngay:** Vercel, Netlify, Cloudflare Workers, AWS Lambda (không chạy được background loop, không lưu file bền).

## 2. So sánh các lựa chọn

### 2.1 Miễn phí

| Nền tảng | Spec | Kết luận |
|---|---|---|
| **Oracle Cloud Always Free** ⭐ | 4 vCPU ARM + 24GB RAM, 200GB disk, 10TB egress/tháng, **miễn phí vĩnh viễn** | Tốt nhất. Khó khăn: đăng ký hay báo "out of capacity"; VM bị "idle" 7 ngày có thể bị thu hồi |
| **GCP Always Free** | e2-micro 1GB RAM, 30GB HDD, **1GB egress/tháng** | Free thật nhưng egress 1GB rất dễ vượt với app gọi API liên tục → dễ phát sinh phí. Budget alert bắt buộc |
| **Koyeb (free)** | 512MB RAM, không sleep | Không có persistent disk → mất state khi redeploy. Không khuyến nghị |
| Render (free) — **đang dùng** | 750 giờ/tháng | Sleep sau 15p không có request HTTP. Đang giảm thiểu bằng cron heartbeat (`CRON_ENABLED`, 12 phút) + `POLL_AUTOSTART=true` (dậy là poll lại). Vẫn nên có ping ngoài (vd UptimeRobot → `/health`) |
| Fly.io / Railway | — | Không còn free tier cho user mới (Fly); Railway chỉ ~$1/tháng |

**Lưu ý GCP:** bắt buộc đăng ký thẻ credit card (không thu phí, chỉ xác minh). Chỉ free tại 3 region: `us-west1`, `us-central1`, `us-east1`. Egress vượt 1GB tính ~$0.12/GB. Nên set **Budget Alert** ($1) trong Billing console.

### 2.2 Trả phí (rẻ + ổn định)

| Dịch vụ | Giá/tháng | Spec | Ghi chú |
|---|---|---|---|
| Hetzner CX22 | ~€3.5 | 2 vCPU, 4GB RAM, 40GB | VPS rẻ nhất đáng tin, không giới hạn egress |
| **AWS Lightsail (Linux)** ⭐ | **$3.50–5** | 512MB–2GB RAM, 20–60GB SSD, 1–3TB transfer | Gộp sẵn bandwidth, đơn giản nhất trên AWS |
| AWS Lightsail $10 | $10 | 2GB RAM, 2 vCPU, 60GB SSD, 3TB | Thoải mái hơn |
| AWS EC2 t3.micro | ~$7.59 | 1GB RAM, 2 vCPU | Trả egress riêng (~$0.09/GB) — đắt hơn Lightsail vì app tốn bandwidth |

> **Khuyến nghị AWS:** dùng **Lightsail**, đừng dùng EC2. Lightsail gộp sẵn data transfer — app poll Canvas + gọi AI + Pinecone liên tục tốn egress, EC2 tính egress riêng làm chi phí tăng nhanh.

## 3. AWS chi tiết

### 3.1 Free Tier (cảnh báo!)

Free tier EC2 đổi từ **15/07/2025**:
- Account tạo **trước** 15/07/2025: 750h/tháng t3.micro (12 tháng).
- Account tạo **sau**: **$200 credit dùng 6 tháng** (không còn 750h free). Hết credit là trả tiền.

Lightsail: 750h free $5 plan **tháng đầu** + 90 ngày free trial (một số plan).

### 3.2 Giá tham khảo (us-east-1, Linux)

| Instance | Giá/tháng |
|---|---|
| t4g.micro (ARM) | ~$6 |
| t3.micro | ~$7.59 |
| t3.small | ~$15 |
| Lightsail nhỏ nhất (Linux) | $3.50–5 |
| EBS 20GB (nếu dùng EC2) | ~$2–3 |
| Egress ngoài AWS | ~$0.09/GB |

## 4. Cấu hình biến môi trường khi deploy

Copy `.env.example` → `.env` (VPS/Docker) hoặc khai báo trong dashboard (Render). Không commit `.env`.
Nguồn sự thật là `src/bootstrap/config/loadConfig.ts`; bảng dưới liệt kê **mọi** biến code đọc.

### 4.1 Bắt buộc

| Biến | Ví dụ | Ghi chú |
|---|---|---|
| `CANVAS_URL_1`, `CANVAS_KEY_1` | `https://rmit.instructure.com`, token | Thiếu → service không khởi động. Thêm `_2`, `_3`… cho nhiều tài khoản |
| Ít nhất 1 key AI | `OPENAI_API_KEY` / `GEMINI_API_KEY` / `CLAUDE_API_KEY` / `GROK_API_KEY` | Agent mode + embedding OpenAI cần `OPENAI_API_KEY` |
| `PINECONE_API_KEY`, `PINECONE_INDEX` | `cter-index-production` | Không có → không RAG (dùng `knowledge.md`), không agent, không rerank |
| `EMBEDDING_PROVIDER` | `openai` | **Phải khớp** index (openai = 1536 chiều, gemini = 3072) |
| `VAULT_STORAGE_PROVIDER` | `postgres-r2` | `postgres-r2` = Neon (production) · `sqlite-disk` = file local |
| `DATABASE_URL` | `postgresql://…` | Bắt buộc khi `postgres-r2` |
| `ADMIN_TOKEN` | chuỗi ngẫu nhiên | Bearer cho các API ghi: vault, điều khiển polling, `POST /api/cron`, `DELETE /api/logs`. Bỏ trống = ai cũng gọi được (không nên) |
| `CHAT_API_TOKEN` | chuỗi ngẫu nhiên (khác `ADMIN_TOKEN`) | **Tuỳ chọn.** Bearer cho `POST /api/chat` + `GET /api/chat/status` — client desktop (InterviewCloak) chat thẳng với server thay vì qua Canvas. Bỏ trống = chat API **tắt** (trả 503), khác `ADMIN_TOKEN` vì endpoint này tiêu tiền AI. Đưa token này cho client, **không** đưa `ADMIN_TOKEN` |

### 4.2 Vận hành (có mặc định)

| Biến | Mặc định | Production | Ghi chú |
|---|---|---|---|
| `API_PORT` | `3000` | `3000` | |
| `POLL_INTERVAL_MS` | — | `6000` | Một tick thật mất vài giây; dưới ~15 s các tick chạy liền nhau. Khuyến nghị `30000` |
| `POLL_AUTOSTART` | `true` | *(mặc định)* | `false` → chờ `GET /start` mới poll |
| `AI_TIMEOUT_MS` | `120000` | `120000` | Timeout mỗi lần gọi model |
| `MAX_RETRY_COUNT` | — | có | Số lần thử lại file lỗi; cũng quyết định ngưỡng "processing" bị coi là treo |
| `DEFAULT_MODEL_{OPENAI,GEMINI,CLAUDE,GROK}` | openai: `gpt-6-astra` | gemini/claude/grok có; **openai chưa đặt** | Model khi tên file không ghi model |
| `MODEL_FALLBACK_{OPENAI,GEMINI,CLAUDE,GROK}` | — | openai, gemini | Chuỗi model dự phòng, ngăn cách bằng dấu phẩy |
| `GROK_BASE_URL` | `https://api.x.ai/v1` | có | |
| `RAG_TOP_K` | `6` | `20` | Số chunk lấy từ Pinecone. **Khi bật rerank** chỉ còn là số chunk dùng lúc rerank lỗi |
| `VAULT_PATH` | `./documents-vault` | có | Chỉ dùng khi index từ đĩa |
| `EMBEDDING_DELAY_MS`, `EMBEDDING_BATCH_SIZE` | gemini 4000/1 · openai 500/100 | có | Nhịp gọi embedding khi index |
| `CANVAS_MATERIALS_FOLDER` / `_INPUT_` / `_OUTPUT_` | `Materials2` / `Q` / `A` | có | |
| `CANVAS_EMAIL_<n>` | — | có | Email nhận thông báo cho tài khoản n |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | — | có | Bỏ trống = tắt email |
| `FRONTEND_URL` (hoặc `ALLOWED_ORIGINS`) | — | có | CORS cho client monitoring, ngăn cách bằng dấu phẩy |
| `CRON_ENABLED`, `CRON_INTERVAL_MS` | — | `true`, `720000` | Heartbeat chống sleep Render |

### 4.3 Agent và reranker (mới — **production chưa có các biến này**)

| Biến | Mặc định | Khuyến nghị | Ghi chú |
|---|---|---|---|
| `AGENT_MAX_TOOL_CALLS` | `6` | `6` | Ngân sách tool mỗi câu hỏi agent |
| `AGENT_MIN_TOOL_CALLS` | `1` | `1` | Agent phải tra vault trước khi trả lời. `0` = hành vi cũ (model tự quyết; đo được 35/37 câu không tra) |
| `AGENT_MAX_DURATION_MS` | `180000` | `180000` | Giới hạn thời gian một lần chạy agent |
| `RERANK_PROVIDER` | `none` | **`pinecone`** | `none` = chỉ thứ tự cosine (hành vi cũ) |
| `RERANK_MODEL` | `bge-reranker-v2-m3` | giữ | Model rerank của Pinecone Inference |
| `RERANK_CANDIDATES` | `40` | `40` | Số ứng viên lấy từ Pinecone trước khi rerank |
| `RERANK_TOP_N` | `8` | `8` | Số chunk đưa vào prompt sau rerank |
| `RERANK_TIMEOUT_MS` | `5000` | `5000` | Quá hạn → dùng thứ tự cosine |

**Trước khi đặt `RERANK_PROVIDER=pinecone`:** kiểm tra gói Pinecone có quota rerank (Pinecone console → Usage). Mỗi câu hỏi single-shot = 1 request rerank; mỗi `search_vault` của agent = 1 request. Rerank lỗi/hết quota **không làm hỏng câu trả lời** (tự fallback), nhưng mất lợi ích.

**Rollback không cần deploy:** `RERANK_PROVIDER=none`, `AGENT_MIN_TOOL_CALLS=0`.

### 4.3b OpenRouter fallback (mới — tuỳ chọn)

OpenRouter là **fallback của backend**, client (extension, WPF, `/api/chat`) không thấy và không chọn được. Với mỗi câu hỏi:

1. Backend gọi **direct** (key riêng của provider) theo chuỗi `DEFAULT_MODEL_<P>` → `MODEL_FALLBACK_<P>`, có retry.
2. Khi chuỗi direct thất bại hết, gặp lỗi key/thanh toán (401/402), hoặc provider **không có key direct**, backend chuyển sang **OpenRouter** với model `OPENROUTER_MODEL_<P>`; các model trong `OPENROUTER_FALLBACK_<P>` được OpenRouter tự thử tiếp phía server (field `models`).
3. Kết quả ghi lại model thực sự trả lời (`model`) và route (`direct`/`openrouter`) trong log và trace.

Client vẫn chỉ gửi provider + model theo danh sách direct (vd. `gpt-6-astra`, `gemini-3.5-flash`); id `vendor/model` của OpenRouter chỉ cấu hình ở server. Agent mode cũng theo thứ tự này: OpenAI Responses (direct) trước, không được thì dùng model OpenRouter của provider (nếu model hỗ trợ `tools`). Embedding không đi qua OpenRouter (vector phải khớp index Pinecone).

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Có giá trị = bật fallback. Trống = chỉ direct (hành vi cũ) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Chỉ đổi khi dùng proxy |
| `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE` | — | Header `HTTP-Referer` / `X-Title` để thống kê usage trên openrouter.ai |
| `OPENROUTER_MODEL_{CLAUDE,GEMINI,GROK,OPENAI}` | `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-flash`, `x-ai/grok-4-fast`, `openai/gpt-5` | Model OpenRouter dùng khi direct của provider đó thất bại |
| `OPENROUTER_FALLBACK_{CLAUDE,GEMINI,GROK,OPENAI}` | — | Fallback phía server OpenRouter, phẩy ngăn cách; tính tiền theo model thực sự trả lời |
| `OPENROUTER_PROVIDER_SORT` | — | `price` / `throughput` / `latency` — thứ tự host OpenRouter thử cho cùng model |
| `OPENROUTER_ALLOW_FALLBACKS` | `true` | `false` = không cho OpenRouter đổi host của cùng model |

Lỗi OpenRouter: `402` (hết credit) và `401` dừng ngay (FATAL); `403` (moderation) không retry; `429/5xx/timeout` và lỗi trả trong body HTTP 200 được retry theo `MAX_RETRY_COUNT`.

**Tắt fallback không cần deploy:** xoá giá trị `OPENROUTER_API_KEY`.

> Từ bản refactor này, giá trị env **sai kiểu** làm service dừng ngay lúc khởi động với thông báo rõ ràng (vd. `POLL_AUTOSTART must be "true" or "false"`, `EMBEDDING_PROVIDER must be one of gemini, openai`) thay vì âm thầm dùng giá trị khác. Giá trị mặc định khi **không đặt** biến không đổi, trừ `DEFAULT_MODEL_GEMINI` (nay `gemini-3.5-flash`, vì `gemini-2.0-flash` đã bị Google tắt).

### 4.4 Chỉ dùng cho test/eval (không đặt trên server)

| Biến | Dùng ở |
|---|---|
| `SKIP_BROWSER_TESTS` | Bỏ test cần Chromium |
| `cter-rag-eval/.env` (`SERVICE_URL`, `CHAT_API_TOKEN`, `JUDGE_*`) | repo đánh giá riêng (`uv run rag-eval …`), gitignored |

### 4.5 Render: cách thêm biến

`render.yaml` đã khai báo đủ các biến ở 4.1–4.3. Nếu service tạo tay trên dashboard (không qua Blueprint): **Environment → Add Environment Variable**, thêm ít nhất `RERANK_PROVIDER=pinecone`, rồi **Save, rebuild and deploy**. Biến secret (`sync: false`) phải nhập giá trị trong dashboard.

## 5. Deploy lên VPS/Lightsail/EC2 (Ubuntu)

### 5.1 Build (đừng chạy `tsx` trên production)

```bash
# local hoặc trên server
npm ci
npm run build          # tsc → thư mục dist/ (kiểm tra package.json trước)
node dist/index.js     # chạy thử
```

Kiểm tra `package.json` có script `build` (tsc) hay chưa; nếu chưa, thêm:

```json
"scripts": {
  "build": "tsc -p tsconfig.json",
  "start": "node dist/index.js"
}
```

### 5.2 Giữ process chạy 24/7 với pm2

```bash
npm install -g pm2
pm2 start dist/index.js --name canvas-helper
pm2 save
pm2 startup           # chạy lệnh output để tự khởi động cùng máy
pm2 logs              # xem log
```

Các thư mục state (`data/`, `documents-vault/`, `.vault-manifest.json`) nằm cùng thư mục app — đảm bảo disk persistent (EBS/Lightsail SSD) và **backup định kỳ** vì chúng chứa dữ liệu đã xử lý.

### 5.3 (Tuỳ chọn) Docker

Nếu host hỗ trợ container:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Để secrets + volume bền cho `/app/data` và `/app/documents-vault`.

## 6. Checklist trước khi deploy

- [ ] Biến môi trường đủ theo mục 4.1; mục 4.3 đã quyết định bật/tắt reranker
- [ ] `EMBEDDING_PROVIDER` khớp dimension của `PINECONE_INDEX`
- [ ] Pinecone có quota rerank (nếu `RERANK_PROVIDER=pinecone`)
- [ ] `ADMIN_TOKEN` đã đặt
- [ ] `CHAT_API_TOKEN` đã đặt (nếu client desktop dùng kênh "API server")
- [ ] Đã chạy `npm test` và `npm run test:load` xanh
- [ ] `documents-vault/` (nếu dùng RAG) đã upload .md lên server
- [ ] `knowledge.md` + `system-prompt.md` có mặt (fallback khi RAG không hoạt động)
- [ ] Build thử local: `npm ci && npm run build && node dist/index.js`
- [ ] Mở port cần thiết (3000) hoặc bỏ qua nếu chỉ dùng local
- [ ] Set budget alert (GCP) / billing alarm (AWS) để tránh phí bất ngờ
- [ ] Backup `data/` định kỳ

## 7. Xử lý sự cố phổ biến

| Hiện tượng | Nguyên nhân | Fix |
|---|---|---|
| `Vector dimension 3072 does not match ... 768` | Sai dimension trong embedding | `embeddingService.ts` dimension phải = 3072 (default của `gemini-embedding-001`); `ensureIndex` tự recreate index |
| App chạy nhưng không poll | Process bị tắt | Dùng pm2 `restart`, check `pm2 logs` |
| Mất state sau khi restart | Disk không persistent | Dùng instance có persistent disk (Lightsail/EC2 EBS/VPS) |
| Egress bị tính phí (GCP) | Vượt 1GB/tháng | Chuyển Oracle/VPS hoặc nâng hạn mức |
| Log `[rerank] … failed (…) — using vector order` lặp lại | Hết quota / plan không có rerank / Pinecone chậm | Kiểm tra Pinecone Usage; tăng `RERANK_TIMEOUT_MS`; hoặc `RERANK_PROVIDER=none` |
| Không thấy log `[rerank] enabled` lúc khởi động | `RERANK_PROVIDER` khác `pinecone` hoặc thiếu `PINECONE_API_KEY` | Sửa biến, restart |
| Câu trả lời agent ghi "documents were not retrieved" | `AGENT_MIN_TOOL_CALLS=0` | Đặt `1` |
| Khởi động xong không poll | `POLL_AUTOSTART=false` | Gọi `GET /start` hoặc đặt `true` |
| Workflow `Fly Deploy` (GitHub Actions) fail | Repo không có `fly.toml`; production đang ở Render | Xoá/tắt workflow hoặc thêm `fly.toml` nếu chuyển sang Fly |

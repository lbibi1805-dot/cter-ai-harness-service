# Hướng dẫn Host & Cấu hình Backend

> Cập nhật 08/11/2026: health check `/ping`, migration 007/008, biến latency/cache/resolver/essay (mục 4.3c), endpoint monitoring, cờ rollback.
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
| Render (free) — **đang dùng** | 750 giờ/tháng | Sleep sau 15p không có request HTTP. Đang giảm thiểu bằng cron heartbeat (`CRON_ENABLED`, 12 phút) + `POLL_AUTOSTART=true` (dậy là poll lại). Vẫn nên có ping ngoài (vd UptimeRobot → `/ping`, không chạm DB) |
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
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | account id, token, `cter-prod` | **Mới 07/11.** File vault + ảnh/diagram hội thoại nằm trên Cloudflare R2. Mỗi môi trường 1 bucket (`cter-dev`, `cter-prod`); token *Object Read & Write* chỉ cho đúng bucket đó. Thiếu cả 4 → thư mục local (chỉ dev, Render mất khi restart); thiếu 1 phần → không khởi động |
| `ADMIN_TOKEN` | chuỗi ngẫu nhiên | Bearer cho các API ghi: vault, điều khiển polling, `POST /api/cron`, `DELETE /api/logs`. Bỏ trống = ai cũng gọi được (không nên) |
| `CHAT_API_TOKEN` | chuỗi ngẫu nhiên (khác `ADMIN_TOKEN`) | **Tuỳ chọn.** Bearer cho `POST /api/chat` + `GET /api/chat/status` — client desktop (InterviewCloak) chat thẳng với server thay vì qua Canvas. Bỏ trống = chat API **tắt** (trả 503), khác `ADMIN_TOKEN` vì endpoint này tiêu tiền AI. Đưa token này cho client, **không** đưa `ADMIN_TOKEN` |

### 4.2 Vận hành (có mặc định)

| Biến | Mặc định | Production | Ghi chú |
|---|---|---|---|
| `API_PORT` | `3000` | `3000` | |
| `POLL_INTERVAL_MS` | — | `6000` | Một tick thật mất vài giây; dưới ~15 s các tick chạy liền nhau. Khuyến nghị `30000` |
| `POLL_AUTOSTART` | `true` | *(mặc định)* | `false` → chờ `GET /start` mới poll |
| `AI_TIMEOUT_MS` | `120000` | `120000` | Timeout mỗi lần gọi model **không stream** (polling/Canvas). Stream dùng timeout token đầu/khoảng lặng ở 4.3c |
| `MAX_RETRY_COUNT` | `2` | **`2`** (hạ từ 12) | Số lần retry 429/5xx trước token đầu; cũng là số lần thử lại file lỗi và ngưỡng "processing" bị coi là treo. Giá trị 12 làm Gemini treo > 5 phút |
| `DEFAULT_MODEL_{OPENAI,GEMINI,CLAUDE,GROK}` | openai: `gpt-6-astra` | gemini/claude/grok có; **openai chưa đặt** | Model khi tên file không ghi model |
| `MODEL_FALLBACK_{OPENAI,GEMINI,CLAUDE,GROK}` | — | openai, gemini | Chuỗi model dự phòng, ngăn cách bằng dấu phẩy |
| `GROK_BASE_URL` | `https://api.x.ai/v1` | có | |
| `RAG_TOP_K` | `8` | `8` (trước 20) | Số chunk lấy từ Pinecone. **Khi bật rerank** chỉ còn là số chunk dùng lúc rerank lỗi |
| `RAG_MIN_SCORE` | `0.3` | mặc định | Bỏ chunk score thấp hơn (luôn giữ top 2) |
| `HYBRID_SEARCH_ENABLED` | `true` | mặc định | BM25 trong RAM (minisearch) + RRF với vector, mọi mode; 0 query Neon. `false` = chỉ vector |
| `VAULT_PATH` | — | *(xoá được)* | **Không còn dùng** từ 07/11: vault nằm trên R2, upload qua `POST /api/vault/files` hoặc `npm run vault:upload` |
| `OBJECT_STORAGE_DIR` | `./data/object-store` | không đặt | Thư mục thay R2 khi chạy local |
| `CONVERSATION_STORE_ENABLED` | `false` | `true` sau smoke test | Hội thoại phía server + context engineering cho `/api/chat`, `/api/c4` (xem `docs/API_CONVERSATIONS.md`) |
| `CONVERSATION_PURGE_DAYS` | `30` | `30` | Thời gian khôi phục conversation đã xoá mềm |
| `CONTEXT_KEEP_RECENT_TURNS`, `CONTEXT_COMPACT_THRESHOLD_TOKENS` | `6`, `12000` | mặc định | Auto-compact |
| `AUX_PROVIDER`, `AUX_MODEL`, `AUX_SYNC_TIMEOUT_MS` | `gemini`, `gemini-3.1-flash-lite`, `15000` | mặc định | Model phụ: caption/OCR ảnh, tóm tắt, viết lại câu hỏi |
| `EMBEDDING_DELAY_MS`, `EMBEDDING_BATCH_SIZE` | gemini 4000/1 · openai 500/100 | có | Nhịp gọi embedding khi index |
| `CANVAS_MATERIALS_FOLDER` / `_INPUT_` / `_OUTPUT_` | `Materials2` / `Q` / `A` | có | |
| `CANVAS_EMAIL_<n>` | — | có | Email nhận thông báo cho tài khoản n |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | — | có | Bỏ trống = tắt email |
| `FRONTEND_URL` (hoặc `ALLOWED_ORIGINS`) | — | có | CORS cho client monitoring, ngăn cách bằng dấu phẩy |
| `CRON_ENABLED`, `CRON_INTERVAL_MS` | — | `true`, `720000` | Heartbeat chống sleep Render — tự ping `/ping` (từ 08/11, trước `/health`), không chạm Neon/R2/Pinecone |
| `POLL_CURSOR_FLUSH_MS` | `900000` | mặc định | Cursor poller cache trong RAM, ghi Neon tối đa 1 batch / N ms (+ flush khi SIGTERM). Để Neon được ngủ |

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

### 4.3a C4 Sketcher `/api/c4` (mới 27/10 — tuỳ chọn, đều có mặc định)

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `C4_PLANTUML_SERVER_URL` | `https://www.plantuml.com/plantuml` | Server render PNG (cả `POST /api/c4/render` — xem trước PlantUML trong chat). Server công khai đôi khi rate-limit; có thể self-host `plantuml/plantuml-server` (Docker) rồi trỏ vào |
| `C4_INCLUDE_BASE` | `https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master` | Nguồn `C4_*.puml` (giống repo c4-plantuml-mcp-server). `stdlib` = bản đóng gói sẵn trong PlantUML, không fetch GitHub |
| `C4_DEADLINE_MS` | `270000` | Hạn cứng một request (kẹp 60000–290000) để client nhận kết quả < 5 phút |
| `C4_CALL_TIMEOUT_MS` | `150000` | Trần một bước gọi model (kể cả retry/fallback OpenRouter) = min(giá trị này, thời gian còn lại của `C4_DEADLINE_MS`). Từ 08/11 chiều có hiệu lực thật (trước bị kẹp 90 s bởi `CHAT_DEADLINE_MS`) |
| `C4_MAX_ELEMENTS` | `12` | Element tối đa mỗi diagram (kẹp 4–30) |
| `C4_SHOW_LEGEND` | `false` | Thêm `SHOW_LEGEND()` vào diagram |

Dùng chung `CHAT_API_TOKEN` với `/api/chat` (không có token → 503). Rule thiết kế/lưu ý thi: upload file `.md` vào vault; mỗi lần vẽ server tìm trong RAG theo đề bài + truy vấn "C4 design rules" và đưa cho mọi agent.

### 4.3c Latency, prompt, cache, resolver, essay (mới 08/11 — đều có mặc định)

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `AI_FIRST_TOKEN_TIMEOUT_MS` | `15000` | Stream: chờ token đầu tối đa, quá → chuyển model |
| `AI_IDLE_TIMEOUT_MS` | `20000` | Stream: khoảng lặng tối đa giữa 2 chunk |
| `CHAT_DEADLINE_MS` | `90000` | Hạn chót **cả chuỗi** model (direct + OpenRouter) cho `/api/chat`. Từ 08/11 chiều polling Canvas dùng `CANVAS_DEADLINE_MS`, mỗi bước C4 dùng `C4_CALL_TIMEOUT_MS` |
| `CANVAS_DEADLINE_MS` | `300000` | Hạn chót cả chuỗi cho 1 item polling Canvas (file Q&A + hội thoại Canvas). Câu trả lời PDF dài bị cắt → tăng |
| `AI_CIRCUIT_FAILURE_THRESHOLD`, `AI_CIRCUIT_WINDOW_MS`, `AI_CIRCUIT_COOLDOWN_MS` | `3`, `60000`, `120000` | N lỗi 503/504/529/overloaded/timeout trong cửa sổ → bỏ qua model trong cooldown (xem `circuit[]` ở `/api/ai-usage`) |
| `AI_MAX_OUTPUT_TOKENS` | `8192` | Gemini `maxOutputTokens` / OpenAI `max_output_tokens` |
| `GEMINI_THINKING_LEVEL` | `minimal` | `minimal\|low\|medium\|high` |
| `OPENAI_REASONING_EFFORT` | `low` | Chỉ gửi cho o-series/gpt-5*/gpt-6*/codex |
| `OPENAI_SERVICE_TIER` | trống | `auto\|default\|flex\|priority`; trống = không gửi |
| `OPENAI_PROMPT_CACHE_KEY` | `conversation` | `conversation\|prompt_version\|off` |
| `PROMPT_CACHE_CLAUDE` | `false` | `cache_control` cho Claude; chỉ bật khi đo hit rate ≥ 50% |
| `PROMPT_CACHE_LAYOUT` | `v2` | v2 = system tĩnh (ăn KV cache); `v1` = bố cục cũ (rollback) |
| `MAX_CHAT_IMAGES` | `10` | Số ảnh tối đa mỗi câu hỏi (`/api/chat`, `/api/c4`) |
| `CHAT_MAX_BODY_MB` | `20` | Giới hạn body JSON `/api/chat` |
| `GEMINI_INLINE_IMAGES_MAX_MB` | `15` | Tổng ảnh vượt → adapter Gemini direct upload qua **Files API** (URI cache RAM 47 h); 413 chỉ khi upload lỗi. `/api/c4` vẫn chặn inline riêng |
| `CHAT_UPLOAD_TTL_MS` | `3600000` | Ảnh upload qua `POST /api/chat/images` (`tmp/uploads/`) phải được dùng trong khoảng này; metadata chỉ trong RAM |
| `CONTEXT_HOT_WINDOW_TURNS` | `2` | Ảnh của N cặp user/assistant gần nhất nằm tại chỗ trong history (≤ 3 ảnh/turn, ăn KV cache). `0` = hành vi cũ (rollback) |
| `CONTEXT_MAX_PROMPT_IMAGES` | `16` | Trần tổng ảnh mỗi prompt (hiện tại + window + JIT); vượt → bỏ ảnh window cũ nhất |
| `PROMPT_REGISTRY_ENABLED` | bật nếu có `prompts/core/system.md` | `false` = dùng `system-prompt.md` như cũ (rollback) |
| `PROMPTS_DIR` | `prompts` | Thư mục registry (image Docker đã copy `prompts/` + `evals/`) |
| `ARTIFACT_RESOLVER_MODE` | `rules+aux` | `off` (hành vi cũ) \| `rules` \| `rules+aux` |
| `ARTIFACT_RESOLVER_MIN_SCORE`, `ARTIFACT_RESOLVER_MARGIN`, `ARTIFACT_RESOLVER_AUX_TIMEOUT_MS` | `2.5`, `1.0`, `1500` | Ngưỡng chọn artifact; aux cũng là Intent Router của `/api/c4` |
| `CONTEXT_PINNED_KINDS` | `c4_spec,problem_brief,design_review,design_note` | Kind luôn có trong registry (≤ 60) |
| `ESSAY_MODE_ENABLED` | `false` | Chỉ bật bộ **tự nhận diện** "(N điểm)"; `/essay` và `mode:"essay"` luôn chạy. Cần Pinecone |
| `ESSAY_MAX_CHUNKS`, `ESSAY_WORDS_PER_POINT` | `12`, `175` | |
| `ESSAY_SELF_CHECK`, `ESSAY_THINKING_LEVEL` | `false`, `low` | Self-check luôn chạy với `/essay strict` |
| `ESSAY_ANALYSIS_TIMEOUT_MS`, `ESSAY_SELF_CHECK_TIMEOUT_MS` | `6000`, `20000` | Phân tích đề gộp vào call aux router: timeout = max(`ARTIFACT_RESOLVER_AUX_TIMEOUT_MS`, `ESSAY_ANALYSIS_TIMEOUT_MS`) |

**Rollback không cần deploy:** `PROMPT_REGISTRY_ENABLED=false`, `PROMPT_CACHE_LAYOUT=v1`, `ARTIFACT_RESOLVER_MODE=off`, `HYBRID_SEARCH_ENABLED=false`, `CONTEXT_HOT_WINDOW_TURNS=0`.

**`MODEL_FALLBACK_GEMINI`**: mặc định mới `gemini-3.5-flash,gemini-3.1-flash-lite` — `gemini-2.5-flash-lite` trả 404 cho key mới; nếu Render/`.env` đang đặt tay giá trị cũ thì xoá model này. Cột của migration 007/008 để nguyên (code cũ bỏ qua).

### 4.3d Health check, migration, endpoint vận hành (mới 08/11)

- **Health check Render: `/ping`** (text `ok`, không phụ thuộc gì). `render.yaml` đã đặt `healthCheckPath: /ping`; service tạo từ dashboard phải đổi tay ở **Settings → Health Check Path**. `/health` cũng không query DB (vault stats từ RAM, `vault: "loading"` tới khi load xong).
- **Migration 007** (`artifact_references`) và **008** (`c4_intent`) được SchemaGuard **tự áp lúc khởi động** (idempotent, `ADD COLUMN IF NOT EXISTS`). Có thể chạy tay `migrations/007_*.sql`, `008_*.sql` trước để kiểm.
- Endpoint vận hành mới (ADMIN_TOKEN): `GET /health/deep` (Neon + R2 + Pinecone, chỉ gọi khi cần), `/api/metrics/db`, `/api/metrics/latency?window=1h|24h`, `/api/config` (secret chỉ hiện boolean), `/api/storage/stats` (R2 list, tốn Class A), `/api/prompts`, `/api/evals`. Chỉ `/health/deep` và `/api/storage/stats` chạm dịch vụ ngoài.
- Sau deploy: `/ping`, `/health`, `/health/deep` (1 lần); `/api/metrics/db` sau 30 phút idle **không tăng** (Neon ngủ được).
- Package mới: `@google/genai`, `minisearch`.
- Endpoint mới (08/11 chiều, CHAT_API_TOKEN): `POST /api/chat/images` (upload ảnh trước → `imageId`, lưu `tmp/uploads/`, 0 query Neon), `POST /api/c4/render` (PlantUML → PNG, cache RAM, 0 DB/R2). `/api/chat` và `/api/c4` nhận `imageIds[]`. Ảnh `/c4` đang chờ trả lời lưu ở `tmp/c4-pending/` (key nằm trong `pendingC4`, không thêm write Neon); lifecycle `tmp/` 1 ngày (checklist §6) dọn phần sót.

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
| `OPENROUTER_MODEL_{CLAUDE,GEMINI,GROK,OPENAI}` | `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-flash`, `x-ai/grok-4.7`, `openai/gpt-5` | Model OpenRouter dùng khi direct của provider đó thất bại |
| `OPENROUTER_FALLBACK_{CLAUDE,GEMINI,GROK,OPENAI}` | — | Fallback phía server OpenRouter, phẩy ngăn cách; tính tiền theo model thực sự trả lời. OpenRouter chỉ nhận **tối đa 3 model** (model chính + 2 fallback) — backend tự cắt phần thừa |
| `OPENROUTER_PROVIDER_SORT` | — | `price` / `throughput` / `latency` — thứ tự host OpenRouter thử cho cùng model |
| `OPENROUTER_ALLOW_FALLBACKS` | `true` | `false` = không cho OpenRouter đổi host của cùng model |
| `OPENROUTER_MAX_TOKENS` | `8192` | `max_tokens` gửi kèm mọi request OpenRouter (cả agent). Không có giới hạn này OpenRouter giữ credit cho toàn bộ cửa sổ output (64k+) và trả `402` khi credit thấp |

Lỗi OpenRouter: `402` (hết credit) và `401` dừng ngay (FATAL); `403` (moderation) không retry; `429/5xx/timeout` và lỗi trả trong body HTTP 200 được retry theo `MAX_RETRY_COUNT`.

**Tắt fallback không cần deploy:** xoá giá trị `OPENROUTER_API_KEY`.

> Từ bản refactor này, giá trị env **sai kiểu** làm service dừng ngay lúc khởi động với thông báo rõ ràng (vd. `POLL_AUTOSTART must be "true" or "false"`, `EMBEDDING_PROVIDER must be one of gemini, openai`) thay vì âm thầm dùng giá trị khác. Giá trị mặc định khi **không đặt** biến không đổi, trừ `DEFAULT_MODEL_GEMINI` (nay `gemini-3.5-flash`, vì `gemini-2.0-flash` đã bị Google tắt).

### 4.3e Photo capture `/api/captures` cho web app `cter-capture-client` (mới 13/11 — tắt khi chưa đặt key; thêm origin Vercel của app vào `FRONTEND_URL`)

| Biến | Bắt buộc | Mặc định | Prod |
|---|---|---|---|
| `CAPTURE_API_KEY` | Có (để bật) | — | Secret ngẫu nhiên, chia cho người nhận ảnh |
| `CAPTURE_UPLOAD_KEY` | Không | = `CAPTURE_API_KEY` | Secret riêng cho người chụp |
| `CAPTURE_R2_BUCKET` | Khuyến nghị | dùng chung `R2_BUCKET` (prefix `captures/`) | `cter-capture-prod` |
| `CAPTURE_R2_ACCESS_KEY_ID` / `CAPTURE_R2_SECRET_ACCESS_KEY` | Khi có bucket riêng | `R2_*` | Token R2 chỉ cho `cter-capture-prod` |
| `CAPTURE_R2_ACCOUNT_ID` / `CAPTURE_R2_ENDPOINT` | Không | `R2_ACCOUNT_ID` / `R2_ENDPOINT` | — |
| `CAPTURE_URL_TTL_SECONDS` | Không | `3600` | `3600` |
| `CAPTURE_MAX_IMAGE_MB` | Không | `15` | `15` |
| `CAPTURE_STORAGE_DIR` | Không | `./data/capture-store` | không đặt (chỉ dev không R2) |

Runbook đầy đủ: `planning/planning-13112026-photo-capture/handoff/01-devops-deploy-runbook.md` (workspace).

### 4.4 Chỉ dùng cho test/eval (không đặt trên server)

| Biến | Dùng ở |
|---|---|
| `SKIP_BROWSER_TESTS` | Bỏ test cần Chromium |
| `cter-rag-eval/.env` (`SERVICE_URL`, `CHAT_API_TOKEN`, `JUDGE_*`) | repo đánh giá riêng (`uv run rag-eval …`), gitignored |
| `HARNESS_URL`, `EVAL_PROVIDER`, `EVAL_MODEL`, `EVAL_JUDGE_PROVIDER`, `EVAL_JUDGE_MODEL` (+ `CHAT_API_TOKEN`) | `npm run eval` / `npm run eval:essay` (golden set trong `evals/golden/`). Chỉ trỏ dev/local |

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
- [ ] R2: bucket đúng môi trường, token chỉ cho bucket đó, lifecycle rule `tmp/` 1 ngày + abort multipart 1 ngày; `npm run smoke:r2` xanh
- [ ] Vault đã reset + upload lại sau khi chuyển sang R2 (`planning/planning-06112026/handoff/`), `POST /api/vault/sync` báo `legacyRows: 0`
- [ ] `knowledge.md` + `system-prompt.md` có mặt (fallback khi RAG không hoạt động); `prompts/` có trong image
- [ ] Health Check Path = `/ping`; `MAX_RETRY_COUNT=2`, `RAG_TOP_K=8` (không bị dashboard override giá trị cũ)
- [ ] Đã chạy `npm run eval` trên dev và lưu `evals/results/baseline.json` trước khi tin registry/bố cục v2 trên prod
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
| Chat trả 413 / 502 khi gửi nhiều ảnh | Body vượt `CHAT_MAX_BODY_MB` (413); hoặc ảnh Gemini vượt `GEMINI_INLINE_IMAGES_MAX_MB` và upload Files API lỗi (tới client thành 502) | Client nén ảnh / dùng `POST /api/chat/images`; xem log lỗi upload Files API |
| Câu trả lời dài (PDF) bị cắt / lỗi deadline | Canvas file Q&A dùng `CANVAS_DEADLINE_MS` (300 s); chat dùng `CHAT_DEADLINE_MS` (90 s) | Tăng biến tương ứng |
| Log Gemini 404 cho `gemini-2.5-flash-lite` | Model còn trong `MODEL_FALLBACK_GEMINI` đặt tay | Xoá khỏi biến (Render dashboard / `.env`) |
| Câu trả lời lạ sau deploy 08/11 | Prompt registry / bố cục v2 / resolver | Rollback bằng cờ ở 4.3c |
| Workflow `Fly Deploy` (GitHub Actions) fail | Repo không có `fly.toml`; production đang ở Render | Xoá/tắt workflow hoặc thêm `fly.toml` nếu chuyển sang Fly |

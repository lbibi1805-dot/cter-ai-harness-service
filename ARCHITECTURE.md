# High-level Architecture — cter-ai-harness-service và các client

> Cập nhật: 2026-10-09 · Phạm vi: backend `cter-ai-harness-service` và 5 client trong workspace `Wrapper-Project`.

**Tóm tắt.** Backend là trung tâm. Các client chat (browser extension, app WPF) **không gọi backend trực tiếp**. Chúng trao đổi qua **Canvas LMS**: client đăng tin `[CFH:REQUEST]` vào một conversation, backend poll Canvas, trả lời bằng `[CFH:REPLY]`, rồi client đọc lại. Riêng hai web UI quản trị (monitoring, vault) gọi **HTTP API** của backend.

Mỗi câu hỏi được trả lời theo một trong hai cách:
- **Single-shot RAG** (mặc định): lấy top-20 chunk từ Pinecone một lần, gọi model một lần.
- **Agentic RAG** (opt-in): model OpenAI dùng tool chỉ đọc để tự tìm và đọc tài liệu nhiều lần, rồi mới trả lời. Bật bằng hậu tố `_agent` ở tên file, hoặc header `mode: agent` (nút Agent trên extension). Agent lỗi thì tự chuyển về single-shot.

## Mục lục

1. [Toàn cảnh hệ thống](#1-toàn-cảnh-hệ-thống)
2. [Bên trong backend](#2-bên-trong-backend)
3. [Luồng 1 — File Q/A qua Canvas Files](#3-luồng-1--file-qa-qua-canvas-files)
4. [Luồng 2 — Chat qua Canvas Conversations (extension, WPF)](#4-luồng-2--chat-qua-canvas-conversations-extension-wpf)
5. [Luồng 3 — Quản trị qua HTTP API](#5-luồng-3--quản-trị-qua-http-api)
6. [Agentic RAG](#6-agentic-rag)
7. [Dữ liệu và nơi lưu](#7-dữ-liệu-và-nơi-lưu)
8. [Triển khai](#8-triển-khai)
9. [Bảng tra cứu thành phần](#9-bảng-tra-cứu-thành-phần)

---

## 1. Toàn cảnh hệ thống

```mermaid
flowchart TB
    subgraph Chat["Client chat — đi qua Canvas"]
        direction LR
        EXT["Browser extension<br/>Chrome MV3"]
        WPF["App WPF<br/>.NET 10"]
        WEB["Canvas web<br/>upload START_*"]
    end

    subgraph Admin["Client quản trị — gọi HTTP"]
        direction LR
        MON["Monitoring UI<br/>React"]
        VC["Vault client<br/>React, chỉ đọc"]
    end

    CANVAS[("Canvas LMS<br/>Files: Materials2/Q, A<br/>Conversations: CFH REQUEST / REPLY")]

    subgraph Backend["cter-ai-harness-service · Node.js / TypeScript"]
        direction LR
        API["HTTP API<br/>cổng 3000"]
        POLL["Polling<br/>FileQAJob<br/>ConversationPoller"]
        SINGLE["Single-shot RAG<br/>top-20 chunk · 1 lần gọi"]
        AGENT["Agentic RAG<br/>tool-calling · ≤ 6 tool call"]
        VAULT["Vault + RAG"]
    end

    subgraph External["Dịch vụ ngoài"]
        direction LR
        LLM["LLM<br/>OpenAI · Gemini<br/>Claude · Grok"]
        PC[("Pinecone<br/>vector")]
        NEON[("Neon Postgres<br/>vault_manifest<br/>poll_cursor")]
        GMAIL["Gmail SMTP"]
    end

    EXT -- "CFH REQUEST / REPLY<br/>nút Agent → mode: agent" --> CANVAS
    WPF -- "CFH REQUEST / REPLY<br/>mode: agent" --> CANVAS
    WEB -- "upload START_*<br/>hậu tố _agent" --> CANVAS
    MON -- "HTTPS + Bearer ADMIN_TOKEN" --> API
    VC -- "HTTPS, GET" --> API

    POLL -- "poll Files + Conversations<br/>CANVAS_KEY_n" --> CANVAS
    POLL -- "mặc định" --> SINGLE
    POLL -- "mode: agent" --> AGENT
    AGENT -. "lỗi / không hỗ trợ<br/>fallback" .-> SINGLE
    SINGLE -- "model chain" --> LLM
    AGENT -- "tool-calling" --> LLM
    SINGLE --> VAULT
    AGENT -- "search_vault · read_document<br/>list_folder" --> VAULT
    VAULT --> PC
    VAULT --> NEON
    POLL -- "con trỏ poll" --> NEON
    POLL -- "email kết quả" --> GMAIL
    API --> POLL
    API --> VAULT
```

| Client | Nói chuyện với ai | Giao thức | Xác thực | Bật agent thế nào |
|---|---|---|---|---|
| Browser extension | Canvas | Canvas REST, tin nhắn `[CFH:*]` | Token Canvas của người dùng | Nút **Agent** (chỉ bật được với `gpt-6-astra`, `*codex`) → header `mode: agent` |
| App WPF | Canvas | Canvas REST, tin nhắn `[CFH:*]` (lớp chat đang làm dở) | Token Canvas của người dùng | `CanvasSettings.AgentMode` → `MessageFormat.ResolveRequestMode` (chưa có nút trên UI) |
| Canvas web | Canvas | Upload file vào `Materials2/Q` | Đăng nhập Canvas | Tên file `START_<tên>_openai[_<model>]_agent.<ext>` |
| Monitoring UI | Backend | HTTP JSON | `Authorization: Bearer ADMIN_TOKEN` | — |
| Vault client | Backend | HTTP JSON, chỉ GET | Không | — |

`cter-canvas-helper-client` là bản extension cũ gần trùng với `cter-browser-extension-client`, dùng cùng cơ chế.

---

## 2. Bên trong backend

Backend theo hướng module, mỗi module chia 4 lớp (domain · application · infrastructure · presentation). Đọc từ trên xuống: request HTTP hoặc tick poll đi xuống các tầng bên dưới.

```mermaid
flowchart TB
    subgraph L1["① HTTP — src/api/server.ts"]
        direction LR
        SRV["ApiServer<br/>/health · /api/logs<br/>/api/cron · /api/ai-usage"]
        RPOLL["Polling router<br/>/start · /stop · /api/polling"]
        RVAULT["Vault router<br/>/api/vault/*"]
    end

    subgraph L2["② Polling — modules/polling"]
        direction LR
        SCHED["PollSchedulerService<br/>tick không chồng · tự bật"]
        CURSOR["PollCursorRepository<br/>Neon / file"]
    end

    subgraph L3["③ Job — src/orchestrator"]
        direction LR
        FQA["FileQAJob<br/>Materials2/Q → A"]
        CONV["ConversationPoller<br/>REQUEST → REPLY"]
        STATE["StateManager<br/>processed.json"]
    end

    subgraph L4["④ Chọn cách trả lời — modules/agent"]
        direction LR
        ASVC["AnswerService<br/>mode · hỗ trợ? · fallback"]
    end

    subgraph L4A["④a Single-shot RAG — modules/ai"]
        direction LR
        AIS["AIInvocationService<br/>retry · fallback model"]
        PREP["PromptPreparer<br/>top-20 chunk"]
        ADP["Adapter LLM<br/>OpenAI · Gemini<br/>Claude · Grok"]
    end

    subgraph L4B["④b Agentic RAG — modules/agent"]
        direction LR
        RUNNER["AgentRunner<br/>vòng lặp · ngân sách<br/>≤ 6 tool call · ≤ 180 s"]
        TCM["OpenAIResponsesToolModel<br/>Responses API<br/>tool_choice auto / none"]
        TOOLS["Tool chỉ đọc<br/>search_vault<br/>read_document · list_folder"]
    end

    subgraph L5["⑤ Tri thức và tài liệu"]
        direction LR
        VSVC["VaultService<br/>+ indexing"]
        VREPO["VaultRepository<br/>Neon / file"]
        RAG["RAG<br/>Retriever · Indexer"]
        VS["VectorStore<br/>Pinecone"]
        EXTR["fileExtractor<br/>docx · pdf · ảnh"]
        PDF["markdownToPdf<br/>Chromium"]
    end

    SRV --> RPOLL
    SRV --> RVAULT
    RPOLL --> SCHED
    RVAULT --> VSVC
    SCHED --> CURSOR
    SCHED --> FQA
    SCHED --> CONV
    FQA --> STATE
    CONV --> STATE
    FQA --> ASVC
    CONV --> ASVC
    FQA --> EXTR
    FQA --> PDF
    ASVC -- "single-shot<br/>hoặc fallback" --> AIS
    ASVC -- "mode: agent" --> RUNNER
    AIS --> PREP
    AIS --> ADP
    PREP --> RAG
    RUNNER --> TCM
    RUNNER --> TOOLS
    TOOLS -- "search_vault" --> RAG
    TOOLS -- "read_document<br/>list_folder" --> VREPO
    VSVC --> VREPO
    VSVC --> RAG
    RAG --> VS
```

Hai phần không vẽ để sơ đồ gọn:
- **Khởi động** (`src/index.ts`): đọc cấu hình, dựng các module, bật API server và polling.
- **Dùng chung** (`src/shared`): `resilience` (phân loại lỗi, backoff) được tầng ④a và ④b dùng; `database` (Neon client, `SchemaGuard`) được các repository ở tầng ② và ⑤ dùng.

| Module | Trách nhiệm | File chính |
|---|---|---|
| `modules/polling` | Lịch poll, chống chạy chồng, con trỏ bền theo (job, account) | `pollScheduler.service.ts` |
| `orchestrator` | Hai job: file Q/A và chat qua Conversations | `fileQAJob.ts`, `conversationPoller.ts` |
| `modules/agent` | **Agentic RAG**: chọn single-shot hay agent, vòng lặp tool-calling có ngân sách, 3 tool chỉ đọc, adapter OpenAI Responses, fallback | `answer.service.ts`, `agentRunner.service.ts`, `openaiResponsesToolModel.ts`, `tools/*.tool.ts` |
| `modules/ai` | Gọi model: retry có backoff, phân loại lỗi, chuyển model dự phòng | `aiInvocation.service.ts` |
| `ai/*Adapter` | SDK của từng nhà cung cấp (SDK retry tắt) | `openaiAdapter.ts`, … |
| `modules/vault` | Kho tài liệu: upload, xoá, liệt kê, index | `vault.service.ts`, `neonVault.repository.ts` |
| `rag` | Chia chunk, embed, truy xuất Pinecone | `knowledgeIndexer.ts`, `ragRetriever.ts` |
| `extractor` · `utils/markdownToPdf` | Đọc file đầu vào; render câu trả lời thành PDF | `fileExtractor.ts`, `markdownToPdf.ts` |
| `shared` | Phân loại lỗi và retry; Neon client và schema | `resilience/`, `database/` |

---

## 3. Luồng 1 — File Q/A qua Canvas Files

Người dùng upload `START_<tên>_<provider>[_<model>][_agent].<ext>` vào `Materials2/Q`; backend trả `<tên>_DONE.pdf` vào `Materials2/A`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant C as Canvas Files
    participant S as PollScheduler
    participant J as FileQAJob
    participant A as AnswerService
    participant G as AgentRunner
    participant L as LLM
    participant P as Chromium (PDF)
    participant N as Neon (con trỏ)

    U->>C: upload START_bai1_openai_agent.docx vào Materials2/Q
    loop mỗi POLL_INTERVAL_MS
        S->>N: đọc con trỏ (file-qa, account)
        S->>J: run(account, cursor)
        J->>C: liệt kê file Q (updated_at ≥ cursor) và file A
        J->>C: tải file
        J->>J: trích xuất text + ảnh (1 lần)
        J->>A: answer(provider, model, content, mode)
        alt tên file có _agent và model hỗ trợ
            A->>G: run(model, content)
            G->>L: vòng lặp tool-calling (xem mục 6)
            L-->>G: câu trả lời cuối
            G-->>A: text + nguồn đã đọc + token
        else single-shot, hoặc agent lỗi (fallback)
            A->>L: top-20 chunk RAG + gọi model (retry, model dự phòng)
            L-->>A: markdown
        end
        A-->>J: câu trả lời + mode
        J->>P: render markdown → PDF (ghi Mode, Sources read)
        J->>C: upload START_bai1_openai_agent_DONE.pdf vào Materials2/A
        J-->>S: con trỏ mới (chỉ qua file đã xong hẳn)
        S->>N: lưu con trỏ
    end
    U->>C: mở file _DONE.pdf
```

Chống trùng ba lớp: file `_DONE.pdf` đã có trên Canvas; `data/processed.json`; con trỏ trong Neon chỉ tiến qua file đã xong.

---

## 4. Luồng 2 — Chat qua Canvas Conversations (extension, WPF)

Canvas Conversations đóng vai trò hộp thư giữa client và backend.

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant X as Extension / WPF
    participant C as Canvas Conversations
    participant CP as ConversationPoller
    participant A as AnswerService
    participant G as AgentRunner

    Note over X,C: Conversation [CFH:SETTINGS] lưu active_conversation_id
    U->>X: gõ câu hỏi, chọn model, bật/tắt Agent
    X->>X: resolveRequestMode: agent chỉ khi nút bật VÀ model hỗ trợ
    X->>C: add_message "[CFH:REQUEST] provider · model · mode: agent"
    loop mỗi tick
        CP->>C: đọc settings (cache 10 phút) + tin nhắn của conversation đang active
        CP->>CP: ghép REQUEST với REPLY, lấy tối đa 5 request đang chờ
        CP->>A: answer(…, mode)
        alt mode: agent
            A->>G: vòng lặp tool-calling (xem mục 6)
            G-->>A: câu trả lời mode agent
        else single-shot hoặc fallback
            A->>A: AIInvocationService (top-20 chunk)
        end
        A-->>CP: câu trả lời
        CP->>C: add_message "[CFH:REPLY] request_id · status · model · mode: agent?"
    end
    X->>C: tải lại tin nhắn
    X-->>U: hiện câu trả lời + nhãn "agent" hoặc "agent → single-shot"
```

Giao thức tin nhắn được định nghĩa giống nhau ở 3 nơi, có test hợp đồng giữ chúng khớp nhau:

| Nơi | File |
|---|---|
| Backend | `src/utils/conversationMessageParser.ts` |
| Extension | `lib/messageFormat.js` |
| WPF | `Services/MessageFormat.cs` |

---

## 5. Luồng 3 — Quản trị qua HTTP API

```mermaid
flowchart LR
    MON["Monitoring UI"] -->|"GET /health · /api/logs<br/>/api/ai-usage · /api/canvas-accounts"| API["ApiServer"]
    MON -->|"GET/POST /api/cron"| API
    MON -->|"/start · /stop · /api/polling"| PR["Polling router"]
    MON -->|"GET/POST/DELETE /api/vault/*"| VR["Vault router"]
    VC["Vault client"] -->|"GET /api/vault/files"| VR
    API --> PR
    API --> VR
    VR -->|"upload → index nền"| IDX["VaultIndexingService"]
    VR --> VS["VaultService"]
    VS --> NEON[("Neon")]
    VS --> PC[("Pinecone")]
    CRON["Cron heartbeat 12 phút"] -->|"GET /health"| API
```

| Endpoint | Method | Auth | Việc |
|---|---|---|---|
| `/`, `/health` | GET | — | Trạng thái, số file đã index, polling đang chạy hay dừng |
| `/start`, `/stop`, `/api/polling` | GET | — | Bật, tắt, xem trạng thái polling |
| `/api/logs` | GET / DELETE | DELETE cần Bearer | Log trong bộ nhớ |
| `/api/cron` | GET / POST | POST cần Bearer | Heartbeat chống ngủ |
| `/api/vault/files` | GET / POST / DELETE | ghi cần Bearer | Liệt kê, upload, xoá theo thư mục hoặc toàn bộ |
| `/api/vault/files/:path[/chunks]` | GET / DELETE | xoá cần Bearer | Chi tiết file, chunk, xoá file |
| `/api/vault/reindex`, `/api/vault/sync-pinecone` | POST | Bearer | Index lại, dọn vector mồ côi |
| `/docs`, `/openapi.json` | GET | — | Swagger |

---

## 6. Agentic RAG

Agent là cách trả lời **opt-in**: model OpenAI (Responses API) được dùng 3 tool **chỉ đọc** để tự tìm, đọc tài liệu trong vault nhiều lần trước khi trả lời. Nếu agent không dùng được hoặc gặp lỗi, request tự chuyển về single-shot, nên không bao giờ mất câu trả lời.

| | Single-shot RAG | Agentic RAG |
|---|---|---|
| Bật bằng | Mặc định | `_agent` trong tên file · `mode: agent` (nút Agent) |
| Provider | OpenAI · Gemini · Claude · Grok | OpenAI, model Responses (`gpt-6-astra`, `*codex`) |
| Truy xuất | 1 lần, top-20 chunk theo nguyên văn câu hỏi | Nhiều lần, model tự viết lại truy vấn (tiếng Việt / tiếng Anh) |
| Đọc tài liệu | Chỉ thấy các chunk rời | Đọc nguyên section hoặc nguyên file |
| Số lần gọi model | 1 (cộng retry khi lỗi) | 2–7 |
| Trích nguồn | Có thể trích file không thật sự dùng | Chỉ trích file tool đã trả về |
| Code | `modules/ai` | `modules/agent` |

### 6.1 Chọn cách trả lời

```mermaid
flowchart TD
    REQ["AnswerRequest<br/>provider · model · content · mode"] --> M{"mode = agent?"}
    M -- "không" --> SS["Single-shot<br/>AIInvocationService"]
    M -- "có" --> EN{"Agent bật?<br/>có OPENAI_API_KEY + PINECONE_API_KEY"}
    EN -- "không" --> FB1["fallback: agent-disabled"]
    EN -- "có" --> OK{"provider = openai<br/>và model Responses?"}
    OK -- "provider khác" --> FB2["fallback: unsupported-provider"]
    OK -- "model khác" --> FB3["fallback: unsupported-model"]
    OK -- "có" --> AR["AgentRunner"]
    AR -- "thành công" --> OUT["Câu trả lời · mode: agent"]
    AR -- "lỗi" --> FB4["fallback: agent-failed"]
    FB1 & FB2 & FB3 & FB4 --> SS
    SS --> OUT2["Câu trả lời · mode: single-shot"]
```

### 6.2 Vòng lặp agent

```mermaid
sequenceDiagram
    autonumber
    participant A as AnswerService
    participant R as AgentRunner
    participant M as OpenAI Responses API
    participant T as Tool chỉ đọc
    participant V as Pinecone / Neon

    A->>R: run(model, system prompt agent, câu hỏi)
    R->>M: lượt 1 · tools + tool_choice auto
    M-->>R: function_call search_vault(query)
    R->>T: search_vault
    T->>V: embed truy vấn + query Pinecone (10 ứng viên, hiện 5)
    V-->>T: đoạn văn + file + heading
    T-->>R: kết quả (cắt ≤ 6 000 ký tự) + nguồn
    R->>M: lượt 2 · function_call_output
    M-->>R: function_call read_document(path, heading)
    R->>T: read_document
    T->>V: SELECT content FROM vault_manifest
    T-->>R: nguyên section + nguồn
    alt còn ngân sách
        R->>M: lượt tiếp · tool_choice auto
        M-->>R: câu trả lời cuối
    else hết 6 tool call hoặc 180 s
        R->>M: lượt cuối · tool_choice none (buộc trả lời)
        M-->>R: câu trả lời từ những gì đã có
    end
    R-->>A: text · stopReason · sourcesRead · token
```

### 6.3 Tool và ngân sách

| Tool | Đọc từ | Trả về | Tính là nguồn trích? |
|---|---|---|---|
| `search_vault(query, folder?)` | Pinecone qua `RAGRetriever` | 5 đoạn văn kèm file, heading, độ liên quan | Có |
| `read_document(path, heading?)` | Neon `vault_manifest.content` | Nguyên file, hoặc một section theo heading | Có |
| `list_folder(folder?)` | Neon | Danh sách thư mục hoặc file (tối đa 60 dòng) | Không |

| Giới hạn | Mặc định | Biến môi trường |
|---|---|---|
| Số tool call mỗi câu hỏi | 6 | `AGENT_MAX_TOOL_CALLS` |
| Thời gian mỗi câu hỏi | 180 s | `AGENT_MAX_DURATION_MS` |
| Độ dài mỗi kết quả tool | 6 000 ký tự | — |

An toàn: không có tool ghi; `read_document` chỉ đọc qua DB, không chạm filesystem; prompt coi kết quả tool là dữ liệu, không phải chỉ dẫn. Chi tiết đầy đủ ở `docs/agentic-rag.md`.

---

## 7. Dữ liệu và nơi lưu

```mermaid
flowchart LR
    subgraph Neon["Neon Postgres"]
        VM[("vault_manifest<br/>path · hash · chunk_ids · indexed · content")]
        PCUR[("poll_cursor<br/>job · account · cursor_at")]
    end
    subgraph Pinecone["Pinecone"]
        VEC[("Vector chunk<br/>metadata: text · source · heading")]
    end
    subgraph Local["Đĩa của tiến trình (tạm trên Render)"]
        PJ[("data/processed.json")]
        DV[("documents-vault/*.md<br/>bản copy")]
    end
    subgraph CanvasStore["Canvas"]
        QA[("Materials2/Q, A")]
        CV[("Conversations")]
    end

    VM -- "chunk + embed" --> VEC
```

| Dữ liệu | Nơi lưu | Mất khi restart? | Ghi chú |
|---|---|---|---|
| Nội dung và metadata tài liệu vault | Neon `vault_manifest` | Không | 235 file `.md`, khoảng 1,6 MB |
| Vector của chunk | Pinecone | Không | Số chiều theo `EMBEDDING_PROVIDER` |
| Con trỏ poll | Neon `poll_cursor` (file khi chạy dev) | Không | Chỉ tiến qua file đã xong |
| Trạng thái từng file / tin nhắn | `data/processed.json` | **Có** trên Render | Chống trùng vẫn đúng nhờ Canvas và con trỏ |
| File đầu vào và kết quả | Canvas Files | Không | `Materials2/Q`, `Materials2/A` |
| Câu hỏi và trả lời chat | Canvas Conversations | Không | `[CFH:REQUEST]`, `[CFH:REPLY]`, header `mode: agent` |
| Vết của một lần chạy agent (tool đã gọi, nguồn đã đọc, token) | Log `[agent]` và header PDF | Có (log trong bộ nhớ) | Chưa lưu bền; nên ghi vào DB nếu cần thống kê |
| Ảnh trong vault | Chưa có nơi lưu trên production | — | Đề xuất: Cloudflare R2 |

---

## 8. Triển khai

```mermaid
flowchart LR
    GH["GitHub repo"] -->|"push main"| FLY["Fly.io<br/>GitHub Action"]
    GH --> RENDER["Render free<br/>render.yaml · Docker"]
    subgraph Image["Docker image · node:22-alpine"]
        NODE["node dist/index.js"]
        CHR["Chromium<br/>render PDF"]
    end
    RENDER --> Image
    FLY --> Image
    PING["Ping từ bên ngoài<br/>đề xuất"] -.->|"GET /health"| Image
    Image --> EXTSVC["Canvas · LLM · Pinecone · Neon · Gmail"]
```

| Thành phần | Ghi chú |
|---|---|
| Image | `Dockerfile`: build TypeScript, chạy `node dist/index.js`, có Chromium cho Puppeteer |
| Render free | Ngủ khi không có traffic **từ bên ngoài**; cron nội bộ không giữ được |
| Polling | Tự bật khi khởi động (`POLL_AUTOSTART`, mặc định bật) |
| Cấu hình | `.env`: `CANVAS_URL_n`/`CANVAS_KEY_n`, key LLM, `PINECONE_*`, `DATABASE_URL`, `ADMIN_TOKEN`, `AGENT_*` |

---

## 9. Bảng tra cứu thành phần

| Thành phần | Repo / thư mục | Công nghệ | Vai trò |
|---|---|---|---|
| Backend | `cter-ai-harness-service` | Node.js, TypeScript | Poll Canvas, trả lời bằng LLM + RAG, API quản trị |
| Agentic RAG | `cter-ai-harness-service/src/modules/agent` | OpenAI Responses API, tool-calling | Agent tự tìm và đọc vault; opt-in, có ngân sách và fallback |
| Browser extension | `cter-browser-extension-client` | Chrome MV3, JS thuần | Chat qua Canvas, chụp màn hình, nút Agent |
| Extension cũ | `cter-canvas-helper-client` | Chrome MV3 | Bản cũ, gần trùng |
| App WPF | `cter-interview-cloak-client` | .NET 10, WPF | Overlay, phím tắt; lớp chat Canvas đang làm dở |
| Monitoring UI | `cter-monitoring-client-ui` | React 19, Vite | Dashboard vault, log, cron |
| Vault client | `cter-vault-client` | React 18, Vite | Duyệt vault chỉ đọc, build vào `public/vault` |
| Đánh giá | `cter-ai-harness-service/eval` | TypeScript | `eval:rag`, `eval:answers` (chạy tay, chỉ đọc production) |

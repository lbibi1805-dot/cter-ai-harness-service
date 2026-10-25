# Quy ước code — cter-ai-harness-service

Áp dụng `rules/*.md` (DDD 4 lớp, ENUM thay chuỗi cứng) cho TypeScript. Mọi code mới phải theo đúng các mục dưới; `npm run typecheck` và `npm test` phải xanh trước khi merge.

## 1. Cấu trúc thư mục

```
src/
  index.ts                 entry (gọi bootstrap/main)
  bootstrap/               composition root, nơi DUY NHẤT biết mọi module
    main.ts                chỉ có hàm main(): các bước khởi động theo thứ tự
    config/loadConfig.ts   đọc .env → AppConfig; config/readers/<slice>.reader.ts cho từng nhóm
    startup/               các bước khởi động (log cấu hình, warm-up RAG, nguồn trạng thái ops)
    httpServer.ts          CORS + chuyển request tới router của module
    interfaces/ constants/ helpers/
  shared/                  shared kernel, KHÔNG import từ modules/
    errors/                DomainError + các lỗi chung, errorMessage()
    resilience/            attempt(), retryTransient(), runWithFallback(), withTimeout, phân loại lỗi
    http/                  Router (error boundary), body, cors, response
    config/env.ts          readInt/readList/readEnum/… (fail fast khi giá trị sai)
    logging/ database/ state/ canvas/
  modules/<name>/
    domain/                <entity>.ts (class/hàm nghiệp vụ chính), index.ts
    application/           <useCase>.service.ts, <thing>.builder.ts
    infrastructure/        <tech><Thing>.adapter.ts, <tech><Thing>.repository.ts, <thing>.factory.ts
    presentation/          <name>.controller.ts, <name>.routes.ts
      dto/                 <name>.dto.ts: shape request/response (chỉ interface)
      mappers/             <name>.mapper.ts: to…() parse request, map response
    index.ts               create<Name>Module(config, deps) + export public API
tests/
  unit/<mirror của src>/   *.test.ts
  e2e/                     server/poller thật + fake Canvas/OpenAI
  load/                    *.load.test.ts (npm run test:load)
  support/                 fixture + fake server dùng chung
```

**Thư mục con trong mỗi layer** (`domain/ application/ infrastructure/ presentation/`, `shared/<x>/`, `bootstrap/`). Chỉ tạo khi có nội dung:

| Thư mục | Chứa | Tên file |
|---|---|---|
| `interfaces/` | interface, type, port, repository interface | `<file>.interface.ts`, `<thing>.port.ts`, `<thing>.repository.ts` |
| `enums/` | enum | `<file>.enums.ts` |
| `constants/` | hằng số, regex, bảng tra (`as const`) | `<file>.constants.ts` |
| `errors/` | subclass `DomainError` | `<file>.errors.ts` |
| `helpers/` | hàm phụ thuần, không phải API chính của file | `<file>.helper.ts` |

Quy tắc:
- File chính (`*.service.ts`, `*.adapter.ts`, `<entity>.ts`…) chỉ chứa class/hàm chính. Interface, enum, hằng, lỗi, hàm phụ đều nằm trong thư mục con tương ứng, kể cả khi chỉ một file dùng.
- Không khai báo interface/type ngoài `interfaces/` hoặc `presentation/dto/`.
- Trạng thái cấp module (cache client, promise trình duyệt) được phép nằm cạnh hàm dùng nó và không export.

Module hiện có: `ai` (provider, OpenRouter fallback, model catalog, fallback), `agent` (agentic RAG), `retrieval` (embedding, Pinecone, chunking, `/api/retrieve`), `rerank`, `vault`, `fileqa` (Materials/Q → A), `conversation` (chat extension qua Canvas), `chat` (`/api/chat`), `polling`, `document` (Markdown → PDF), `notification`, `ops` (status/health/logs/cron).

## 2. Hướng phụ thuộc

- `domain` không import framework/SDK, chỉ import `shared/errors` và domain của chính module (hoặc type thuần của domain module khác).
- `application` dùng port của domain; không `new` SDK client.
- `infrastructure` hiện thực port (adapter). Adapter thuộc module **sở hữu port** (vd. Canvas Files client nằm ở `fileqa`, Canvas Conversations client ở `conversation`).
- Module khác chỉ được dùng qua `modules/<name>/index.ts` (hoặc `domain/index.ts`). Không với tay vào `infrastructure/` của module khác.
- Mỗi module nhận **config slice của nó** (vd. `VaultModuleConfig`), không nhận cả `AppConfig` → tách microservice chỉ cần copy module + shared.

### Controller chỉ xử lý request

Mỗi handler đúng 3 bước: **parse request** (hàm `to…` trong `mappers/<name>.mapper.ts`, chỉ kiểm tra định dạng, sai thì throw `ValidationError`) → **gọi một method của service** → **trả response** (`sendJson`, map DTO).

Controller **không** được: resolve/kiểm tra quy tắc nghiệp vụ (model có hợp lệ không, file có tồn tại không), gọi nhiều service nối tiếp, tự quyết định status lỗi (`if (!x) sendError(404)`), log nghiệp vụ, đọc file/DB. Những việc đó nằm ở service, service throw lỗi có kiểu và router tự map ra HTTP status. Ví dụ: `ChatService.ask`, `VaultService.getFile` (throw `NotFoundError`), `PollingControlService.start`, `OpsService.health`, `RetrievalQueryService.search`.

## 3. Xử lý lỗi — "if → throw", không try/catch trong nghiệp vụ

```ts
// domain / application: guard rồi throw lỗi có kiểu
if (!entry) throw new NotFoundError(`File not found: ${path}`);
if (!parsed.ok) return sendError(res, HttpStatus.BAD_REQUEST, parsed.error);

// cần fallback khi dependency lỗi: dùng attempt(), rẽ nhánh bằng if
const retrieval = await attempt(() => retriever.retrieve(question));
if (!retrieval.ok) return this.withKnowledgeFile(content);
```

- `try/catch` chỉ được phép ở **biên**: (a) infrastructure adapter dịch lỗi SDK/fs/JSON thành lỗi có kiểu; (b) error boundary: `shared/http/router.ts`, `shared/resilience/attempt.ts`.
- Lỗi chủ động luôn là subclass `DomainError` (`ValidationError`, `NotFoundError`, `UpstreamError`, `ConfigurationError`, …). Router tự map `code` → HTTP status (`shared/http/httpErrorStatus.ts`).
- Retry/fallback dùng `retryTransient` / `runWithFallback`; phân loại lỗi tập trung ở `failureClassifier.ts` (FATAL 401/402, PERMANENT 4xx, RATE_LIMITED 429, TRANSIENT 5xx/timeout/không rõ).

## 4. Enum và hằng số

- Tập giá trị rời rạc (provider, status, mode, tool name, HTTP method/status/header, log tag…) → `enum` trong `enums/<file>.enums.ts`. Không so sánh với chuỗi cứng (`'done'`, `'openai'`).
- Số có ý nghĩa (timeout, giới hạn, kích thước, batch, retry) → hằng có tên trong `constants/<file>.constants.ts`, kèm comment **vì sao** chọn giá trị đó.
- Giá trị mặc định của env nằm ở constants của module sở hữu; `bootstrap/config/` chỉ đọc env qua `shared/config/env.ts`.

## 5. Đặt tên

| Vai trò | Hậu tố file | Ví dụ |
|---|---|---|
| Use case | `.service.ts` | `aiInvocation.service.ts` |
| Port (interface ra ngoài) | `interfaces/<thing>.port.ts` | `domain/interfaces/vectorStore.port.ts` |
| Interface / type | `interfaces/<file>.interface.ts` | `application/interfaces/chat.interface.ts` |
| Hàm phụ | `helpers/<file>.helper.ts` | `presentation/helpers/chat.helper.ts` |
| Adapter | `.adapter.ts` | `pineconeVectorStore.adapter.ts`, `openRouter.adapter.ts` |
| Repository | `.repository.ts` | `neonVault.repository.ts` |
| Factory | `.factory.ts` | `aiAdapter.factory.ts` |
| Đọc config | `bootstrap/config/readers/<slice>.reader.ts` | `aiConfig.reader.ts` |
| Builder thuần | `.builder.ts` | `citationPrompt.builder.ts` |
| HTTP | `.controller.ts` / `.routes.ts` / `dto/<name>.dto.ts` / `mappers/<name>.mapper.ts` | `chat.controller.ts`, `chat.mapper.ts` |
| Test | `<file gốc>.test.ts` trong `tests/unit/<mirror>` | `tests/unit/modules/ai/application/aiInvocation.service.test.ts` |

## 6. Test

- Test không dùng `vi.mock` lên module nội bộ: inject fake qua constructor/`deps` (`AIAdapterFactory`, `ConversationGateway`, `CanvasFilesGateway`, …).
- Config test dựng bằng `tests/support/configFixture.ts` (`buildTestConfig`, `buildTestAiConfig`) — thêm field config mới không làm vỡ fixture.
- Adapter HTTP test bằng fake server thật (`tests/support/fake*Server.ts`) để chạy SDK thật.

## 7. Lệnh

```bash
npm run typecheck   # src + tests + scripts
npm test            # unit + e2e
npm run test:load   # load test (~1 phút)
npm run build       # chỉ src → dist/
```

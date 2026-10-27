# Thay đổi: Streaming `/api/chat` + `/api/c4`, human in the loop cho C4 (27/10/2026)

> Trạng thái: **chưa commit** · Client: `cter-interview-cloak-client`

## TL;DR khi deploy

| Việc | Bắt buộc? | Chi tiết |
|---|---|---|
| Không làm gì | — | Không có biến môi trường mới. Client cũ (không gửi `stream`) nhận JSON như trước |
| Proxy | Kiểm tra | Response stream là `application/x-ndjson` + `X-Accel-Buffering: no`; Render không buffer. Nếu đặt sau nginx riêng, tắt `proxy_buffering` |

## Thay đổi

| # | Thay đổi | Vì sao |
|---|---|---|
| 1 | `POST /api/chat` nhận `stream: true` → NDJSON: `delta` (đoạn chữ), `reset` (retry/fallback sau khi đã gửi chữ → client xoá phần đã hiện), `done` (body như JSON thường, text đã clean), `error` | Hiện chữ dần thay vì chờ cả câu trả lời |
| 2 | `AIAdapter.process(..., onDelta?)`: Claude (`messages.stream`), Gemini (`generateContentStream`), OpenAI Chat Completions + Responses (`response.output_text.delta`), Grok, OpenRouter (Chat Completions stream, lỗi trong chunk → exception có code để classifier xử lý) | Một đường stream chung cho mọi provider; không truyền `onDelta` thì hành vi cũ |
| 3 | `AIRequest.stream?: AnswerStream`; `AIInvocationService` gọi `reset()` trước mỗi lần thử lại nếu đã gửi chữ (`createStreamRelay`). Agent mode không stream (chỉ `done`) | Retry/fallback OpenRouter không làm chữ bị lặp |
| 4 | `shared/http/ndjson.ts` (`NdjsonStream`); Router: lỗi sau khi stream đã mở → event `error` thay vì ghi header lần hai | Error boundary vẫn là một chỗ |
| 5 | `POST /api/c4` nhận `stream: true` → `progress`, `analysis` (checklist trước khi có ảnh), `level` (mỗi ảnh ngay khi render/sửa xong), `done` | Thấy tiến độ và ảnh đầu tiên sau ~15–20 s |
| 6 | **Human in the loop**: Architect trả `clarifications` (tối đa 3, mỗi câu kèm giả định đã dùng) chỉ khi đề mơ hồ thật. Có câu hỏi → run dừng, lưu session (bộ nhớ, 15 phút, tối đa 50, dùng một lần), response có `confirmation`. `POST /api/c4/resume { sessionId, answers?, stream? }`: answers trống = vẽ luôn bản nháp theo giả định (0 call thêm); có answers = Architect chạy lại 1 lần. Đồng hồ `C4_DEADLINE_MS` dừng khi chờ người dùng, `durationMs` chỉ tính thời gian máy | Đề thi mơ hồ (vd "có thanh toán" không nói cổng nào) được hỏi lại thay vì đoán |

## Kiểm thử

- `npm run typecheck` 0 lỗi; `npm test` 365 pass (mới: stream relay/reset, chat NDJSON route, C4 stream route, resume 404/400, pause/resume với đồng hồ dừng, resume có answers, session hết hạn).
- Chạy thật local (Gemini direct): `/api/chat` stream 16 delta, chữ đầu tiên ~2 s; `/api/c4` đề "phòng khám, có thanh toán và gửi thông báo" → hỏi 1 câu; resume với câu trả lời "VNPay; SMS + email" → 2 diagram trong 37.7 s máy chạy, ảnh đầu tiên sau ~17 s.

---

# Thay đổi: C4 Sketcher `POST /api/c4` (27/10/2026)

> Trạng thái: **chưa commit** · Client gọi: `cter-interview-cloak-client` (lệnh chat `/c4`)

## TL;DR: cần làm gì khi deploy

| Việc | Bắt buộc? | Chi tiết |
|---|---|---|
| Không làm gì | — | `/api/c4` dùng `CHAT_API_TOKEN` sẵn có; mọi biến `C4_*` đều có mặc định |
| Tuỳ chỉnh renderer / giới hạn | Tuỳ chọn | `C4_PLANTUML_SERVER_URL`, `C4_INCLUDE_BASE`, `C4_DEADLINE_MS`, `C4_CALL_TIMEOUT_MS`, `C4_MAX_ELEMENTS`, `C4_SHOW_LEGEND` — xem `docs/DEPLOYMENT-GUIDE.md` §4.3a |
| Upload rule thiết kế | Nên | File `.md` (luật vẽ C4, lưu ý chấm thi) vào vault → được RAG đưa cho mọi agent. Hiện index Pinecone đang trống (0 vector) |
| Outbound HTTPS | Có | Server cần gọi được `www.plantuml.com` (và `raw.githubusercontent.com` nếu không dùng `C4_INCLUDE_BASE=stdlib`) |

## Thay đổi

| # | Thay đổi | Vì sao |
|---|---|---|
| 1 | Module mới `src/modules/c4` (domain/application/infrastructure/presentation): `POST /api/c4 { provider, model?, description, levels?, fast? }` → mỗi cấp một PNG base64 + `.puml` + requirement đã phủ/thiếu + ghi chú | Lệnh `/c4` của client desktop; logic trước đó chạy ở client, không kiểm soát được RAG / system prompt / thời gian |
| 2 | Pipeline 2–3 lần gọi model bất kể số cấp: Architect (checklist + model chung + mọi diagram) → `validateDiagram` (coverage theo id requirement, tối giản: xoá element không phủ gì và không nối gì, luật skill c4-diagrams, đủ actor/hệ thống ngoài ở context+container, có mô tả) → render → Repair (một call cho mọi cấp lỗi, kể cả lỗi cú pháp PlantUML) → Critic (một call, xem tất cả ảnh) → render lại. Bản sửa chỉ được nhận nếu điểm validator không tệ hơn và render được | Mỗi call qua provider tốn vài chục giây + rate limit; gọi song song mỗi cấp một agent đã vượt 4.5 phút khi đo thật |
| 3 | RAG: truy vấn vault **một lần** mỗi request (đề bài + truy vấn cố định "C4 design rules"), tối đa 8 chunk, đưa vào system prompt C4 riêng (không persona chat, không CITATION_RULES) | Rule người dùng upload áp dụng cho mọi agent; citation rules bắt trả prose + References, phá JSON |
| 4 | `AIInvocationService.answerPrepared(request, prompt)` (tách từ `answer`, hành vi `answer` giữ nguyên) | C4 dùng chung route direct → OpenRouter, retry, fallback nhưng với system prompt riêng |
| 5 | `.puml` port từ `c4-plantuml-mcp-server` (cùng include/macro → ảnh giống repo), sửa: escape `"`, boundary lồng nhau, `Rel_U/D/L/R`, giữ `HIDE_STEREOTYPE()`, bỏ note UUID. Renderer: `GET {server}/png/{encoded}`, retry 3 lần, lỗi cú pháp đọc từ header `X-PlantUML-Diagram-Error` | "Sinh ảnh chuẩn theo repo" |
| 6 | Hạn cứng `C4_DEADLINE_MS` (mặc định 270 s), trần mỗi call `C4_CALL_TIMEOUT_MS`; Critic chỉ chạy trước 65% hạn | Client nhận kết quả < 5 phút; hết giờ vẫn trả ảnh tốt nhất |

## Biến môi trường mới

| Biến | Mặc định |
|---|---|
| `C4_PLANTUML_SERVER_URL` | `https://www.plantuml.com/plantuml` |
| `C4_INCLUDE_BASE` | `https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master` (`stdlib` = bản trong PlantUML) |
| `C4_DEADLINE_MS` | `270000` (kẹp 60000–290000) |
| `C4_CALL_TIMEOUT_MS` | `150000` |
| `C4_MAX_ELEMENTS` | `12` (kẹp 4–30) |
| `C4_SHOW_LEGEND` | `false` |

## Kiểm thử

- `npm run typecheck`: 0 lỗi. `npx vitest run tests/unit`: 330 pass (30 test mới: `tests/unit/modules/c4/**`, `answerPrepared`).
- Chạy thật (local, Gemini `gemini-3.1-flash-lite` direct, plantuml.com, qua HTTP từ client C#): 4 cấp trong 32–44 s, mọi requirement được phủ.

---

# Thay đổi: Refactor clean architecture + OpenRouter fallback + trace cho đánh giá

> Ngày: 25/10/2026 · Nhánh: `refactor/clean-architecture` · Trạng thái: **chưa commit**
> Quy ước code mới: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) · Repo đánh giá tách riêng: `../cter-rag-eval`

## TL;DR: cần làm gì khi deploy

| Việc | Bắt buộc? | Chi tiết |
|---|---|---|
| Không làm gì | — | Không đặt `OPENROUTER_API_KEY` thì hành vi gọi AI giữ như cũ (chỉ gọi provider trực tiếp) |
| Bật OpenRouter làm fallback | Tuỳ chọn | Đặt `OPENROUTER_API_KEY`, có thể chỉnh thêm `OPENROUTER_MODEL_<P>` / `OPENROUTER_FALLBACK_<P>`. Xem `docs/DEPLOYMENT-GUIDE.md` §4.3b |
| Xoá `AI_GATEWAY` nếu đã đặt | Nên | Biến này không còn được đọc |
| Kiểm tra env có giá trị lạ | **Có** | Giá trị sai kiểu giờ **dừng service lúc khởi động** (vd. `POLL_AUTOSTART=yes`, `EMBEDDING_PROVIDER=Gemini2`). Giá trị hợp lệ: boolean `true`/`false`, số nguyên, enum đúng chính tả |
| Commit thư mục `docs/` | Nên | `/docs/` không còn bị ignore, nên `GET /openapi.json` và `/docs` hoạt động sau deploy |
| Build | Có | `npm run build` dùng `tsconfig.build.json` (Dockerfile đã copy cả hai tsconfig) |

## 1. Tóm tắt

| # | Thay đổi | Vì sao |
|---|---|---|
| 1 | Toàn bộ `src/{ai,rag,canvas,orchestrator,extractor,state,utils,api}` + `types.ts` + `config.ts` chuyển vào `src/modules/*` (4 lớp đồng nhất) + `src/shared/*` + `src/bootstrap/*` | Cấu trúc đồng nhất giữa các module; mỗi module nhận config slice riêng nên sẵn sàng tách microservice |
| 1b | Mỗi layer có thư mục con `interfaces/ enums/ constants/ errors/ helpers/` (presentation thêm `dto/` + `mappers/`). File chính chỉ chứa class/hàm chính; interface chỉ nằm trong `interfaces/` hoặc `dto/` | Dễ tìm, cấu trúc giống nhau ở mọi module |
| 1c | `bootstrap/main.ts` chỉ còn hàm `main()`; đọc config tách ra `bootstrap/config/` (`loadConfig` + `readers/<slice>.reader.ts`), các bước khởi động nằm ở `bootstrap/startup/` | `main` đọc như một quy trình |
| 2 | Không còn `try/catch` trong domain/application: guard `if → throw` lỗi có kiểu (`DomainError`), fallback qua `attempt()`; router map lỗi sang HTTP status | Theo `rules/` (if-throw, lỗi có kiểu) |
| 2b | Controller chỉ parse request → gọi 1 method service → trả response. Logic chuyển xuống các service mới: `ChatService`, `PollingControlService`, `OpsService`, `RetrievalQueryService`. `VaultService` tự throw `NotFoundError` và tự lên lịch re-index sau upload | Controller không chứa business logic |
| 3 | Enum/hằng số thay chuỗi/số cứng: `AIProvider`, `ModelRoute`, `ProcessingStatus`, `ConversationReplyStatus`, `LogTag`, `HttpStatus`, … | Hết magic string/number |
| 4 | **OpenRouter là fallback của backend**: trước hết chạy chuỗi model trực tiếp (`DEFAULT_MODEL_<P>` → `MODEL_FALLBACK_<P>`). Khi cả chuỗi lỗi (kể cả lỗi FATAL như hết credit), hoặc provider không có key trực tiếp, mới gọi `OPENROUTER_MODEL_<P>` (OpenRouter tự fallback server-side qua `OPENROUTER_FALLBACK_<P>`). Client không thấy và không chọn được route; model client gửi phải nằm trong danh sách direct. `attempts` cộng dồn cả hai route; log ghi route đã trả lời. 402 = FATAL, lỗi trong body HTTP 200 / `choices` rỗng được retry | Tăng độ sẵn sàng mà không đổi hành vi khi provider trực tiếp còn chạy |
| 5 | **Agent có fallback OpenRouter**: thử OpenAI Responses (direct) trước, sau đó tool calling qua Chat Completions của OpenRouter với `OPENROUTER_MODEL_<P>` (chỉ model có `tools`, kiểm tra qua `GET /models`) | Agent chạy được cho claude/gemini/grok khi có OpenRouter |
| 6 | `POST /api/chat` nhận `includeTrace: true`, trả về `trace.contexts` + `trace.agent` (steps, sources, tokens); thêm endpoint `POST /api/retrieve` | Repo `cter-rag-eval` (Python + Ragas) đánh giá qua HTTP |
| 7 | `tsconfig.json` (typecheck cả `tests/`, ES2022) + `tsconfig.build.json` (chỉ `src`); sửa 20 lỗi type trong test/e2e (`AppConfig` thiếu `rerank`, `.at()`, mock) | Trước đây IDE báo đỏ nhưng `tsc` bỏ qua test |
| 8 | Test tách ra `tests/{unit,e2e,load,support}` | Theo yêu cầu |
| 8b | **Thêm 27/10: chat nhớ ngữ cảnh hội thoại.** `POST /api/chat` nhận `history: [{ role: "user"\|"assistant", text }]` (cũ → mới). Server chuẩn hoá (`normalizeHistory`: bỏ lượt rỗng, gộp lượt cùng role, bắt đầu bằng `user`, kết thúc bằng `assistant`, giữ tối đa 20 lượt / 30k ký tự, mỗi lượt cắt ở 6k), rồi đưa thành message thật trước câu hỏi hiện tại cho mọi adapter (Claude, OpenAI Responses/Chat Completions, Gemini, Grok, OpenRouter) và cả phiên agent. RAG tìm theo câu hỏi trước + câu hỏi hiện tại để câu hỏi nối tiếp vẫn ra đúng tài liệu. Client InterviewCloak gửi các cặp hỏi/đáp đã trả lời thành công (bỏ lượt lỗi, không gửi lại ảnh) | Trước đây mỗi request độc lập nên model không biết câu hỏi trước |
| 9 | Dọn: xoá `eval/` (chuyển sang `cter-rag-eval`), `AGENTS.md` (trùng `CLAUDE.md`), DOCX renderer + `latexMath` + dependency `docx` (code chết từ khi chuyển sang PDF), email `notifyPolling*` không ai gọi, `scripts/test-render-docx.ts` hỏng, vài biến chết; `ARCHITECTURE.md`/`AGENTIC-QNA.md` chuyển vào `docs/` | Bỏ file rác |

## 2. Biến môi trường mới / thay đổi

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `AI_GATEWAY` | **bỏ** | Không còn đọc. OpenRouter tự bật khi có key |
| `OPENROUTER_API_KEY` | — | Có giá trị thì bật route fallback OpenRouter (nằm cuối `.env`) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | |
| `OPENROUTER_APP_URL`, `OPENROUTER_APP_TITLE` | — | Header attribution |
| `OPENROUTER_MODEL_{CLAUDE,GEMINI,GROK,OPENAI}` | `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-flash`, `x-ai/grok-4.7`, `openai/gpt-5` | Model OpenRouter dùng khi chuỗi direct của provider đó lỗi |
| `OPENROUTER_FALLBACK_{CLAUDE,GEMINI,GROK,OPENAI}` | — | Fallback server-side của OpenRouter, phẩy ngăn cách |
| `OPENROUTER_PROVIDER_SORT` | — | `price` \| `throughput` \| `latency` |
| `OPENROUTER_ALLOW_FALLBACKS` | `true` | |
| `OPENROUTER_MAX_TOKENS` | `8192` | **Thêm 26/10:** `max_tokens` cho mọi request OpenRouter (single-shot + agent). Trước đó không gửi → OpenRouter giữ credit cho 64k token và trả 402 dù câu hỏi ngắn |
| `DEFAULT_MODEL_GEMINI` | **đổi** `gemini-2.0-flash` → `gemini-3.5-flash` | Chỉ ảnh hưởng khi không đặt biến (2.0 đã bị tắt) |
| Mọi biến số/boolean/enum | — | **Đổi hành vi:** giá trị sai kiểu gây lỗi khởi động thay vì âm thầm dùng mặc định |

## 3. API

- `POST /api/chat` body thêm `includeTrace` (boolean); response thêm `trace` khi bật. Thêm `history` (tuỳ chọn, tối đa 200 phần tử; sai shape → 400). Không có biến môi trường mới; giới hạn history là hằng số trong `src/modules/ai/domain/constants/conversation.constants.ts`. Client cũ không gửi `history` vẫn chạy như trước. `GET /api/chat/status` không đổi shape (`models` = danh sách model direct client được chọn).
- `POST /api/retrieve` `{ query, topK?, rerank? }` → `{ chunks }` (Bearer `CHAT_API_TOKEN`; trả 503 khi chưa có token/Pinecone).
- `GET /api/ai-usage`: `providers` = chuỗi model thực tế sẽ thử, phần tử cuối `openrouter:<model>` khi bật fallback.
- Mọi route khác giữ nguyên shape. Đặc tả: `docs/openapi.json`.

## 4. Kiểm thử

- `npm run typecheck`: 0 lỗi (src + tests + scripts).
- `npm test`: 39 file / 327 test pass (thêm test chat history, fallback direct → OpenRouter, OpenRouter adapter, Chat Completions tool model, model catalog, `includeTrace`). `npm run test:load`: 3/3. `npm run build` OK.
- Smoke test bản build (chỉ có `OPENROUTER_API_KEY` giả, không có key direct): `/health`, `/api/chat/status`, 401 khi thiếu token, 400 khi provider sai, `/api/retrieve` trả 503, 404. `POST /api/chat` claude **đã đi tới OpenRouter thật** và nhận 401 (key giả) → 502, xác nhận đúng route fallback.
- 26/10: smoke với key OpenRouter thật trên local: fallback direct → OpenRouter đúng route (claude direct 401 → OpenRouter); gemini `mode: "agent"` chạy qua OpenRouter OK. Claude/grok qua OpenRouter trả 402 do tài khoản OpenRouter **0 credit** — cần nạp credit. OpenRouter từ chối (`400`) mảng `models` > 3 phần tử → `buildRoutingFields` tự cắt còn model chính + 2 fallback đầu. Default `OPENROUTER_MODEL_GROK` đổi `x-ai/grok-4-fast` → `x-ai/grok-4.7` (id cũ không còn trên OpenRouter).

---

# Thay đổi: Chat API trực tiếp cho client desktop (`/api/chat`)

> Ngày: 24/10/2026 · Trạng thái: **chưa commit** · Client đi kèm: `cter-interview-cloak-client` (kênh chatbot "API server")

## TL;DR — cần làm gì khi deploy

| Việc | Bắt buộc? | Chi tiết |
|---|---|---|
| Thêm `CHAT_API_TOKEN` trên Render (chuỗi ngẫu nhiên, **khác** `ADMIN_TOKEN`) | **Có, nếu client dùng kênh "API server"** | Không đặt → `/api/chat` trả **503** (fail closed — endpoint tiêu tiền AI). Kênh Canvas không bị ảnh hưởng |
| Đưa URL Render + `CHAT_API_TOKEN` cho người dùng client | Có | Client lưu thành profile trong Cài đặt › Chatbot, đổi nhanh ở tab Chat |

## 1. Tóm tắt

| # | Thay đổi | Vì sao |
|---|---|---|
| 1 | Module mới `src/modules/chat`: `POST /api/chat` trả lời đồng bộ, `GET /api/chat/status` kiểm tra kết nối | Client desktop muốn chat thẳng với server (Render) thay vì đăng `[CFH:REQUEST]` vào Canvas rồi chờ poll (15–60 s) |
| 2 | Dùng chung `Answerer` với conversation poller | Cùng RAG, fallback model, agent mode opt-in (`mode: "agent"`), cùng luật kiểm tra provider/model như `[CFH:REQUEST]` |
| 3 | Biến mới `CHAT_API_TOKEN` (Bearer riêng) | Không phải đưa `ADMIN_TOKEN` (xoá được vault) cho client |
| 4 | `src/shared/http/body.ts` (`readJsonBody`, giới hạn 20 MB), thêm HTTP 413/502/503 | Ảnh chụp màn hình gửi base64 trong JSON |

## 2. API

`POST /api/chat` — header `Authorization: Bearer <CHAT_API_TOKEN>`

```json
{ "provider": "openai", "model": "gpt-6-astra", "mode": "agent", "question": "…",
  "images": [{ "mimeType": "image/png", "data": "<base64 hoặc data URL>" }] }
```

Trả về `{ text, provider, model, requestedMode, mode, fallbackReason, attempts, durationMs }`.
Lỗi: 400 body sai · 401 sai token · 413 quá 20 MB · 502 mọi model lỗi · 503 chưa đặt `CHAT_API_TOKEN`.
Không ghi gì lên Canvas hay `data/processed.json`. Đặc tả đầy đủ: `docs/openapi.json` (`/docs`).

## 3. Kiểm thử

- `src/modules/chat/presentation/chat.routes.test.ts` (14 test): auth, 503 khi tắt, validate body, ảnh data URL/base64, agent fallback, 502.
- `npm test`: 348 pass / 6 skip. Contract test chéo repo: CLI `tests/ProtocolTests` của client (`chat-status`, `chat-ask`) gọi router thật.

---

# Thay đổi: Reranker + Agent bắt buộc tra vault + Load test

> Ngày: 09–10/10/2026 · Nhánh: `module-refactor` · Trạng thái: **chưa commit**
> Số liệu đo trước/sau: [`eval/METRICS-BEFORE-AFTER.md`](eval/METRICS-BEFORE-AFTER.md)

## TL;DR — cần làm gì khi deploy

| Việc | Bắt buộc? | Chi tiết |
|---|---|---|
| Thêm `RERANK_PROVIDER=pinecone` trên Render | **Có, nếu muốn bật reranker** | Không đặt → giữ hành vi cũ (chỉ cosine). Xem [mục 3](#3-biến-môi-trường-mới--thay-đổi) |
| Kiểm tra gói Pinecone có quota rerank | Có, trước khi bật | Mỗi câu hỏi = 1 request rerank (agent: 1 request mỗi lần `search_vault`) |
| `AGENT_MIN_TOOL_CALLS` | Không (mặc định `1`) | **Đổi hành vi mặc định**: agent luôn tra vault ít nhất 1 lần |
| `POLL_AUTOSTART` | Không (mặc định `true`) | Đã có từ commit `0a39a3c`; production đang chạy theo mặc định này |
| Đổi mật khẩu Neon (`DATABASE_URL`) | **Nên làm ngay** | Connection string bị in ra log của phiên làm việc ngày 09/10 |

## 1. Tóm tắt

| # | Thay đổi | Vì sao | Kết quả đo |
|---|---|---|---|
| 1 | **Reranker** (module mới `src/modules/rerank`): Pinecone lấy 40 ứng viên → cross-encoder `bge-reranker-v2-m3` → giữ 8 | Hit@10 = 100% nhưng Hit@1 chỉ 69,7%: tài liệu đúng có trong kết quả nhưng xếp sai thứ tự | Hit@1 69,7% → **90,9%**, MRR 0,802 → **0,947** |
| 2 | **Agent bắt buộc tra vault** (`AGENT_MIN_TOOL_CALLS`, `tool_choice: required`) | Eval production: 35/37 câu agent trả lời **không gọi tool nào** (tự trả lời từ trí nhớ) | Load test: 0 → 1 tool call/câu, 0% → 100% có nguồn (khi rerank không lỗi) |
| 3 | **Fix rò timer** trong `withTimeout` | Mỗi lần gọi AI để lại 1 timer sống tới hết timeout (120 s) | 1 000 lần gọi: 1 000 → **0** timer còn sống |
| 4 | **Tắt retry ngầm của SDK Pinecone** cho rerank | SDK tự retry 5xx tới 3 lần (backoff ≤ 20 s), nhân tải khi Pinecone quá tải | p95 retrieval khi có lỗi: 396 ms → **146 ms** |
| 5 | **Fix parser citation** trong eval | Tên file có dấu cách bị cắt (`Chapter 1 - Testing Fundamentals.md` → `fundamentals.md`) | Citation recall single-shot: 15,2% (sai) → **95,5%** (đúng) |
| 6 | **Load test** (`npm run test:load`) | Yêu cầu kiểm chứng ổn định dưới tải | 5 kịch bản, 0 lỗi, 0 mất/trùng câu trả lời |
| 7 | **Fix cấu hình vitest** | Khoá `"vitest"` trong `package.json` không được vitest đọc → `npm test` chạy cả load test | Cấu hình chuyển sang `vitest.config.ts` |
| 8 | **Golden set production** + `eval:rag --rerank` | Golden set mẫu là QNX, production là môn Software Testing + ISTQB | 37 câu (33 trả lời được, 4 ngoài phạm vi) |

## 2. Chi tiết theo phần

### 2.1 Reranker

```text
Câu hỏi ─► Pinecone top 40 (cosine) ─► chia chunk dài thành ≤ 3 cửa sổ chồng 20% ─► bge-reranker-v2-m3
        ─► điểm chunk = điểm cửa sổ cao nhất ─► top 8 vào prompt (agent: top 10, hiển thị 5)
             │ lỗi / quá RERANK_TIMEOUT_MS
             └──► thứ tự cosine cũ, RAG_TOP_K chunk (hành vi trước đây)
```

| File | Vai trò |
|---|---|
| `src/modules/rerank/domain/*` | Enum (`RerankProvider`, `RerankModel`), `RerankConfig`, port `Reranker` / `ChunkRetriever`, dựng văn bản rerank (breadcrumb + cửa sổ) |
| `src/modules/rerank/application/rerankingRetriever.service.ts` | Decorator bọc retriever: rerank, max-pool theo cửa sổ, fallback; `fuseWithVectorOrder` (RRF — chỉ dùng trong eval) |
| `src/modules/rerank/infrastructure/pineconeReranker.ts` | Adapter Pinecone Inference, `maxRetries: 0` |
| `src/modules/rerank/index.ts` | `createRerankModule(config, deps)` → `{ enabled, candidateCount, wrap }` |
| `src/index.ts` | Single-shot: `RAGRetriever(topK = 40)` → `ranking.wrap(…, topN 8, fallback RAG_TOP_K)` |
| `src/modules/agent/infrastructure/ragVaultSearcher.ts` | Agent `search_vault` cũng đi qua reranker |
| `src/modules/ai/application/promptPreparer.ts` | `RagRefs.retriever` đổi kiểu sang interface `ChunkRetriever` |
| `src/types.ts` | `CitedChunk.rerankScore?`, `AppConfig.rerank` |

Quyết định thiết kế (đều dựa trên số đo, xem tài liệu metrics):

- **Chia cửa sổ thay vì cắt 1 đoạn**: bản đầu chỉ chấm 1 500 ký tự đầu mỗi chunk → Hit@8 *giảm* từ 100% xuống 90,9%. Chia ≤ 3 cửa sổ → Hit@8 = 100%.
- **Không dùng fusion RRF trong production**: RRF (Hit@1 81,8%) kém rerank thuần (90,9%) trên golden set.
- **Reranker là tối ưu hoá, không phải phụ thuộc**: mọi lỗi (429, 5xx, timeout, kết quả rỗng) → fallback về thứ tự cosine, không bao giờ làm hỏng câu trả lời.

### 2.2 Agent bắt buộc tra vault

| File | Thay đổi |
|---|---|
| `agent.enums.ts` | Enum `ToolChoice { AUTO, REQUIRED, NONE }` |
| `agentBudget.ts` | `minToolCalls` (mặc định 1) |
| `toolCallingModel.port.ts` | `TurnOptions { allowTools, requireTool? }` |
| `agentRunner.service.ts` | `requireTool = còn ngân sách && steps < minToolCalls` |
| `openaiResponsesToolModel.ts` | `tool_choice`: `none` (hết ngân sách) > `required` (chưa đủ tool) > `auto` |
| `agentPrompt.ts` | Prompt: "always start with `search_vault`" |
| `agent/index.ts` | Kẹp `0 ≤ minToolCalls ≤ maxToolCalls` |

### 2.3 Sửa lỗi

| Lỗi | File | Ảnh hưởng trước khi sửa |
|---|---|---|
| `withTimeout` không `clearTimeout` | `src/utils/withTimeout.ts` | Mọi lời gọi AI/rerank để lại timer sống tới hết hạn → tích tụ dưới tải |
| SDK Pinecone retry 5xx ngầm | `pineconeReranker.ts` | 1 lỗi → tới 4 request, latency đuôi tăng |
| Parser citation cắt tên file có dấu cách | `eval/answers/domain/answerMetrics.ts` | Metric citation của eval sai (~0%) |
| `package.json#vitest` không có hiệu lực | `vitest.config.ts` (mới) | `npm test` vô tình chạy load test song song → fail ngẫu nhiên |

### 2.4 Eval & test

| Thêm / sửa | Mô tả |
|---|---|
| `eval/rag/golden.jsonl` | Golden set production (37 câu, 23 file Software Testing; câu ISTQB chưa có vì thiếu bản local) |
| `eval:rag --rerank [--candidates N] [--rerank-model M]` | So sánh vector / rerank / RRF trên cùng ứng viên, xuất `*-comparison.md` |
| `eval:answers` | Đọc `RERANK_*`, `AGENT_MIN_TOOL_CALLS` từ `.env.eval`; ghi cấu hình vào `settings` của run |
| `load/` + `vitest.load.config.ts` | L1 retrieval (1 200 req), L1 timer, L2 agent trước/sau (100 + 300), L3 soak chat (120 request) |
| Unit test mới | `rerank.test.ts`, `pineconeReranker.test.ts` (SDK thật + fake server), `withTimeout.test.ts`, `rerankComparison.test.ts`, test `requireTool`, test parser citation |

Kết quả: **`npm test` 329 pass / 6 skip / 0 fail · `npm run test:load` 5/5 pass · `npm run build` OK.**

## 3. Biến môi trường mới / thay đổi

| Biến | Mặc định | Production hiện tại | Khuyến nghị | Ghi chú |
|---|---|---|---|---|
| `RERANK_PROVIDER` | `none` | *chưa có* → `none` | **`pinecone`** | `none` = hành vi cũ. Giá trị lạ cũng = `none` |
| `RERANK_MODEL` | `bge-reranker-v2-m3` | *chưa có* | giữ mặc định | Đa ngôn ngữ (vault tiếng Việt). Khác: `cohere-rerank-3.5`, `pinecone-rerank-v0` |
| `RERANK_CANDIDATES` | `40` | *chưa có* | `40` | Pinecone top-k khi bật rerank (thay `RAG_TOP_K` làm top-k truy vấn) |
| `RERANK_TOP_N` | `8` | *chưa có* | `8` | Số chunk vào prompt single-shot (Hit@8 = 100%) |
| `RERANK_TIMEOUT_MS` | `5000` | *chưa có* | `5000` | Đo thực tế: p95 ≈ 1,6 s, max ≈ 2,7 s |
| `AGENT_MIN_TOOL_CALLS` | `1` | *chưa có* → `1` | `1` | `0` = để model tự quyết (hành vi cũ) |
| `AGENT_MAX_TOOL_CALLS` | `6` | *chưa có* → `6` | `6` | Có từ đợt agent |
| `AGENT_MAX_DURATION_MS` | `180000` | *chưa có* → `180000` | `180000` | Có từ đợt agent |
| `POLL_AUTOSTART` | `true` | *chưa có* → `true` | `true` | Có từ đợt polling: khởi động xong là poll ngay |
| `RAG_TOP_K` | `6` | `20` | `20` | **Ý nghĩa đổi khi bật rerank**: chỉ còn là số chunk dùng khi rerank lỗi |

`PINECONE_API_KEY` dùng chung cho cả vector search lẫn rerank — không cần key mới.

## 4. Rollout & rollback

1. Deploy code (mặc định `RERANK_PROVIDER=none` → không đổi hành vi retrieval; agent đổi sang luôn tra vault).
2. Kiểm tra log khởi động có `Config loaded …`, không lỗi.
3. Đặt `RERANK_PROVIDER=pinecone` → restart. Log phải có `[rerank] enabled — bge-reranker-v2-m3, 40 candidates → top 8`.
4. Theo dõi log mỗi câu hỏi: `[rerank] single-shot — 40→8 in 1061ms (top1 0.909 …)`. Nếu thấy nhiều `[rerank] … failed (…) — using vector order` → kiểm tra quota/plan Pinecone.
5. **Rollback**: đặt `RERANK_PROVIDER=none` (không cần deploy lại code) · agent: `AGENT_MIN_TOOL_CALLS=0`.

## 5. Kiểm chứng

```bash
npm test                 # unit + e2e (329 pass)
npm run test:load        # 5 kịch bản tải, ~20 s, ghi load/runs/latest.json
npm run eval:rag -- --rerank --label check        # production, chỉ đọc, 37 request rerank
npm run eval:answers -- --yes --baseline latest   # production, tốn phí model
```

# Thay đổi: Photo capture — upload không cần key, `CAPTURE_API_KEY` chỉ để đọc (14/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-12112026-wave3`) · Plan: `planning/planning-13112026-photo-capture/04-plan-public-upload`
> · Client: `cter-capture-client` bỏ ô Capture key (chỉ còn tên người chụp, bài gần đây lưu trên máy). Cloak client và monitoring không đổi.

## Vì sao

Bản 13/11 bắt người chụp nhập key. Yêu cầu đúng: ai mở web app cũng upload được; key chỉ dành cho backend bên nhận để đọc.

## Thay đổi

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | `POST /api/captures/batches` và `POST /api/captures/batches/{folder}/{index}/images` **không kiểm tra key** | Vẫn giữ: 15 MB/ảnh, 60 ảnh/bài, magic bytes, `CAPTURE_FOLDER_PATTERN`, CORS theo `FRONTEND_URL` |
| 2 | `GET` (list, folders, batch, files) và `DELETE` batch: chỉ nhận `CAPTURE_API_KEY` hoặc `ADMIN_TOKEN` | Trước: `DELETE` đi theo quyền upload |
| 3 | `CAPTURE_API_KEY` vẫn là công tắc bật: trống = **mọi** route 503, cả upload | |
| 4 | Bỏ biến `CAPTURE_UPLOAD_KEY`, enum `CaptureAccess`, dòng `/api/config` `CAPTURE_SEPARATE_UPLOAD_ACCESS` | |

## Biến môi trường

| Biến | Thay đổi |
|---|---|
| `CAPTURE_UPLOAD_KEY` | **Bỏ**. Xoá trên Render nếu đã đặt (đặt cũng không còn tác dụng) |
| `CAPTURE_API_KEY` | Không đổi tên/giá trị; nay chỉ là key đọc/xoá + công tắc bật. Không nhập vào web app |

## Rủi ro chấp nhận

Ai biết URL harness đều upload được (spam, tốn dung lượng R2). Giảm thiểu: giới hạn kích thước/số ảnh, magic bytes, lifecycle R2, CORS. Không làm rate limit theo IP (plan 04 §6 O1).

## Kiểm thử

- `tests/unit/modules/capture/capture.routes.test.ts`: upload không key → 201; `GET`/`DELETE` không key hoặc sai key → 401; `ADMIN_TOKEN` đọc được; thiếu `CAPTURE_API_KEY` → 503 cho cả upload, đọc, xoá.

---

# Thay đổi: Trả lời đủ dài, đủ câu, đủ mọi câu hỏi trong một lượt — answer plan, sinh theo phần, auto-continue, kiểm tra phủ (13/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-12112026-wave3`) · Plan: `planning/planning-12112026/08-long-complete-answers` (Bước 1–5, 7 phía harness, 8)
> · Client: `cter-interview-cloak-client` (hiện "Phần i/n", "đang viết tiếp…", cảnh báo `coverage.missing`) và `cter-monitoring-client-ui` (khối `answers`) làm riêng. Tương thích ngược: sự kiện NDJSON mới chỉ thêm `type` mới; `ANSWER_COMPLETENESS_ENABLED=false` trả về hành vi cũ.

## Vì sao

Câu trả lời tự luận ngắn, câu văn cụt; prompt nhiều câu hỏi bị cắt giữa chừng, người dùng phải nhắn "làm tiếp". Nguyên nhân đã xác minh: rule ép ngắn trong `prompts/`, trần output thấp (Claude 4096 cứng), không đọc `finish_reason`, không tách câu hỏi, deadline 90 s.

## Thay đổi

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | `prompts/`: policy mới `policies/answer-completeness.md` (order 15, static); `core/system.md` 2.2.0 (bỏ "Keep it concise"); `policies/language.md` 1.1.0 (trả lời **cùng ngôn ngữ với câu hỏi**, bỏ "every sentence should earn its place"); `skills/essay/writer.md` 1.2.0; skill mới `skills/answer/{plan,section,continue,coverage-fix}.md`, `skills/essay/verb-expectations.md` (chuyển từ `essay.constants.ts`); `skills/routing/essay-analysis.md` 1.1.0 (1–12 ý) | `system-prompt.md` sinh lại (promptVersion đổi → KV cache prefix đổi 1 lần). `domains/system-architecture.md` do plan 04 sửa |
| 2 | Mọi adapter trả `finishReason` (`stop` / `length` / `safety` / `other`): Gemini `MAX_TOKENS`, OpenAI `length` + Responses `response.incomplete`, Claude `max_tokens`, OpenRouter/Grok `length` | `AIAnswer.finishReason` |
| 3 | Trần output đồng nhất: Claude dùng `AI_MAX_OUTPUT_TOKENS` (bỏ 4096 cứng), Grok gửi `max_tokens`, agent OpenAI Responses gửi `max_output_tokens`, OpenRouter mặc định theo `AI_MAX_OUTPUT_TOKENS` khi không đặt `OPENROUTER_MAX_TOKENS`; `MODEL_OUTPUT_LIMITS` kẹp theo model | Chỉ có giới hạn xác minh từ SDK (Claude Opus 4/4.1 non-streaming 8192); các model khác **chưa xác minh** → gửi đúng giá trị cấu hình |
| 4 | Gemini: thinking ăn chung trần → nếu phần còn lại < 4096 token thì hạ mức thinking một bậc (log) | `fitThinkingLevel` |
| 5 | `AnswerOrchestrator` (module chat) bọc chat single-shot + agent, trả lời hội thoại Canvas và file Q&A: tách câu hỏi bằng luật (0 lần gọi model) → khối `<answer_plan>` sau câu hỏi (lớp ⑦, không đụng prefix tĩnh) → sinh theo phần (≤ 3 câu/phần khi vượt ~6144 token/lần gọi) nối liền trong cùng stream → auto-continue khi `finishReason=length` hoặc lỗi sau khi đã stream chữ → kiểm tra phủ (nhãn "Câu i" + ≥ 60 % số từ) → 1 lần bổ sung phần thiếu | Lưu **một** tin assistant đã ghép, không thêm query Neon. `/c4` và Essay Mode không đi qua orchestrator |
| 6 | NDJSON `/api/chat` thêm sự kiện: `answer_plan {total, questions:[{id,label}]}`, `section {index,total}` (1-based), `continuation {n}`, `coverage {missing:[ids]}` (mảng rỗng = đủ). DTO thêm `completeness` | Chữ vẫn đi bằng `delta`; client cũ phải bỏ qua `type` lạ (chưa xác minh trên client) |
| 7 | Essay Mode: `ESSAY_MAX_ASPECTS` (mặc định 12, trước cố định 6); đọc **mọi** "(N điểm)" → `target_words` từng câu; bỏ kẹp 8192 (dùng `AI_MAX_OUTPUT_TOKENS`); `<essay>` không đóng hoặc bị cắt → viết tiếp (≤ `ANSWER_MAX_CONTINUATIONS`) | |
| 8 | Lịch sử: lượt assistant **gần nhất** giữ tới `HISTORY_ASSISTANT_TURN_MAX_CHARS` ký tự (các lượt cũ 6000) | "làm tiếp" thấy đủ câu trả lời dài trước |
| 9 | `GET /api/metrics/latency` thêm khối `answers: {turns, questionsPerTurnAvg, sectionsTotal, continuationsTotal, truncatedRemaining, completeRate, outputTokensAvg, longTurnP95Ms}` | RAM, 0 query DB, tính từ lúc khởi động |
| 10 | `/api/config` thêm `AI_MAX_OUTPUT_TOKENS`, `ANSWER_*`, `LONG_ANSWER_DEADLINE_MS`, `ESSAY_MAX_ASPECTS`, `HISTORY_ASSISTANT_TURN_MAX_CHARS` | |
| 11 | Eval: `evals/golden/multi-question.jsonl` (8 case: 3/5/8/12 câu, có/không điểm, trộn tự luận + tính + vẽ, a/b/c, 1 câu ngắn); `npm run eval:answers` (coverage, ≥ 80 % số từ, truncated, câu cụt, `--judge` 0–10; `--offline` chỉ kiểm bộ tách câu) | Live chỉ chạy vài case nhỏ trên dev |

## Biến môi trường

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `AI_MAX_OUTPUT_TOKENS` (đổi default) | 8192 → `16384` | Nay áp cho cả Claude, Grok, agent; OpenRouter dùng khi không đặt `OPENROUTER_MAX_TOKENS` |
| `ANSWER_COMPLETENESS_ENABLED` | `true` | `false` = rollback toàn bộ orchestrator |
| `ANSWER_MIN_WORDS_PER_QUESTION` | `300` | Câu tự luận không ghi điểm; có điểm = điểm × `ESSAY_WORDS_PER_POINT` (175); câu ngắn/tính/vẽ không ép |
| `ANSWER_SECTION_MAX_QUESTIONS` | `3` | |
| `ANSWER_MAX_CONTINUATIONS` | `2` | Mỗi phần; cũng dùng cho Essay |
| `ANSWER_COVERAGE_FIX` | `true` | |
| `LONG_ANSWER_DEADLINE_MS` | `240000` | Cả lượt nhiều phần; mỗi lần gọi thêm vẫn có `CHAT_DEADLINE_MS` riêng |
| `ESSAY_MAX_ASPECTS` | `12` | |
| `HISTORY_ASSISTANT_TURN_MAX_CHARS` | `12000` | |

Không có secret mới. `ESSAY_MODE_ENABLED` giữ `false` (bật sau khi `eval:answers` đạt).

## Rollback

`ANSWER_COMPLETENESS_ENABLED=false` (orchestrator chuyển thẳng request), `AI_MAX_OUTPUT_TOKENS=8192`, `ANSWER_MAX_CONTINUATIONS=0`. Không có migration.

## Kiểm thử

- Offline (provider giả): `tests/unit/modules/chat/answerOrchestrator.test.ts` (17), `answerEval.test.ts` (2), `tests/unit/shared/text/questionSplit.test.ts` (5), `tests/unit/modules/essay/essayCompleteness.test.ts` (4), `tests/unit/modules/ai/infrastructure/finishReason.test.ts` (4); cập nhật test history/OpenAI/OpenRouter/promptSources theo default mới.
- `npm run eval:answers -- --offline`: 8/8 case tách đúng số câu.
- **Chưa** chạy live (model thật, Neon dev); giới hạn output thật từng model chưa xác minh; client chưa kiểm với sự kiện mới.

---

# Thay đổi: Tiêu chí bàn luận design T1–T7, kiểm tra kết nối khối (B1), instances, multi-tenancy (13/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-12112026-wave3`) · Plan: `planning/planning-12112026/04-design-discussion-rules.md` (§3, §4, §5.1–5.4, §7, §8) + `05-multi-tenancy-knowledge.md` (khối `<multi_tenancy>`). Bỏ §5.5 (level Deployment, P2).
> · Client: `cter-interview-cloak-client` (bubble bàn luận, `noDiscussion`), `cter-monitoring-client-ui` (card Design compliance, counter orphan). Tương thích ngược: chỉ **thêm** event/trường.

## Thay đổi

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | `prompts/domains/system-architecture.md` **1.5.0**: khối `<design_discussion>` (7 mục T1–T7, mục không áp dụng giữ heading + 1 câu lý do; circuit breaker bàn như Kafka; Kafka/security/observability chỉ vẽ khi cần), `<connectivity>`, `<multi_tenancy>`; phân tích kiến trúc viết đoạn văn đủ câu, bullet chỉ để liệt kê thành phần (plan 08) | Đến mọi path: chat, agent, essay, `/c4` |
| 2 | Skill C4: `system` 2.1.0 (bỏ "SMALLEST… no decoration"), `level-container` 1.3.0, `universal-rules` 1.1.0, `spec-shape` 1.1.0, `extract` 1.1.0, `review` 1.1.0 (thêm hàng T1–T7 + Connectivity); **mới** `discussion-system`, `discussion`, `critic-design` 1.0.0 | TS fallback `c4Prompts.constants.ts` giữ y hệt (test parity) |
| 3 | Validator kết nối C1–C9 (`c4/domain/diagramConnectivity.ts`): `ORPHAN_ELEMENT`, `DISCONNECTED_GRAPH`, `DB_WITHOUT_OWNER`, `QUEUE_ONE_SIDED` = error → vòng repair; `SERVICE_WITHOUT_DB`, `SHARED_DB`, `GATEWAY_COVERAGE`, `COMPONENT_NO_OUTBOUND`, `MISSING_INSTANCES` = warning → critic | Khối bị prune (không `covers`, không quan hệ) giờ ghi warning thay vì lặng lẽ; khối có `covers` mà mồ côi → error. Còn lỗi sau repair → vẫn trả diagram + dòng trong `criticNotes` |
| 4 | Event `level` thêm `connectivity: {errors, warnings}` (`{code, message, elementIds}`) | |
| 5 | Spec element thêm `instances` (`"3"`, `"2..10"`, `"auto"`) và `scaling` (`fixed\|hpa\|serverless`); PlantUML: `API Service x 3` hoặc dòng `Instances: 2..10 (HPA)` trong mô tả | Định dạng sai → error validator |
| 6 | Bước **Discussion writer** sau critic, trước review: stream `discussion_delta {text}`, kết thúc `discussion_done {discussion: {markdown, artifactId?, alias?}}`; artifact mới `design_discussion`; `done.discussion` | Khung 7 heading do code ép (`discussionFrame.ts`): mục thiếu → "Chưa phân tích", không gọi lại model. Chạy cả khi `fast`; bỏ khi body `noDiscussion: true` |
| 7 | Brief: `tenancySignals`, `cloudScope` (`full-cloud\|hybrid\|on-prem\|unknown`), `scaleHints`; slot `tenancy`, `deployment_target` (impact thấp, chỉ hỏi khi có tín hiệu nhưng chưa rõ, vẫn ≤ 3 câu) | Brief cũ trong session không có trường mới vẫn đọc được |
| 8 | Chat/agent: guard PlantUML lint thêm C1/C2/C7 trên khối C4 (dùng chung lượt repair `DIAGRAM_SYNTAX_MAX_REPAIRS`); không sửa được → thêm 1 dòng cảnh báo dưới khối. Tool `validate_diagram` trả thêm dòng `CONNECTIVITY ERROR/WARNING` | |
| 9 | `GET /api/metrics/latency` → `diagramGuard` thêm `orphanFound`, `orphanRepaired`, `connectivityErrors` (chat + /c4, RAM, 0 query DB) | |
| 10 | Eval: R09–R14 trong `evals/golden/rule-compliance.jsonl` (R11 chấm bằng lint, `lint_connectivity`); `npm run eval:c4` (`scripts/eval-c4-design.ts`, 3 đề, `fast`, xoá conversation sau khi chạy) ghi `evals/results/<date>-design-<promptVersion>.json` kind `design-compliance`; `GET /api/evals?kind=` lọc theo kind | |

## Biến môi trường mới

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `C4_DESIGN_DISCUSSION_ENABLED` | `true` | Bật bước bàn luận thiết kế T1–T7 trên `/c4` (+1 call model/run). `false` = rollback |
| `DIAGRAM_CONNECTIVITY_CHECK` | `true` | Bật validator C1–C9 trên `/c4` và lint kết nối PlantUML trong chat/agent |

Không có secret mới. Không có migration (artifact kind là TEXT tự do).

# Thay đổi: Lazy history + đổi tên conversation — phân trang keyset, `PATCH /api/conversations/:id`, detail nhẹ (13/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-12112026-wave3`) · Plan: `planning/planning-12112026/07-lazy-history-and-rename.md` (Bước 1, 2, 3, test Bước 6)
> · Client: `cter-interview-cloak-client` (sidebar 3 mục + "Xem thêm" 20, rename inline), `cter-monitoring-client-ui` ("Tải thêm", Đổi tên). Tương thích ngược: chỉ **thêm** trường; client cũ không truyền `cursor`/`messages` vẫn chạy như trước.

## Vì sao

Sidebar chỉ cần 3 cuộc trò chuyện gần nhất, tải tiếp khi bấm "Xem thêm"; tin nhắn chỉ tải khi bấm vào; người dùng muốn đặt tên cho cuộc trò chuyện. Mỗi lời gọi vẫn 1 query Neon.

## Thay đổi

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | `GET /api/conversations?limit=&cursor=` trả thêm `nextCursor` (keyset `(updated_at, id) DESC`, lấy `limit+1` hàng, không `COUNT`) | Cursor = base64url của `updated_at` (text µs từ SQL, không qua JS `Date`) + `id`. Cursor hỏng → `400 {error:"invalid_cursor"}`. `limit` kẹp 1–100 |
| 2 | Cột `conversations.display_title` + `PATCH /api/conversations/:id` `{title: string\|null}` → `{id, title, titleSource}` | Trim, gộp khoảng trắng, bỏ ký tự điều khiển, 1–80 ký tự; `null`/`""` = về tên tự sinh. `400 invalid_title`, `404` khi không có/đã xoá mềm. **Không** đổi `updated_at` |
| 3 | List + detail trả `title = COALESCE(display_title, title)` và `titleSource: user\|auto` | `title` tự sinh không bao giờ bị ghi đè |
| 4 | `GET /api/conversations/:id?messages=N` (1–500) + `hasMoreMessages`, `oldestSeq` | Không truyền `messages` = 500 như cũ. Detail vẫn trả mọi artifact (metadata + url) |
| 5 | Mới: `GET /api/conversations/:id/messages?beforeSeq=&limit=40` → `{messages, artifacts, hasMoreMessages, oldestSeq}` | `artifacts` chỉ của các tin trả về; 1 query (CTE) |
| 6 | Route byte artifact dùng 1 JOIN nhẹ `artifacts ⨝ conversations` thay cho `findActive` (500 tin + mọi artifact mỗi ảnh) | Port mới `findActiveArtifact` |
| 7 | `HttpMethod.PATCH`; CORS `Access-Control-Allow-Methods` thêm `PATCH` | Origin whitelist giữ nguyên |
| 8 | Port `ConversationStore`: `list(query)` trả `{conversations, next}`; thêm `rename`, `findMessages`, `findActiveArtifact` (Neon + InMemory) | `ConversationService.list(limit, deleted, pending)` giữ nguyên chữ ký (trả trang đầu) |
| 9 | Docs: `docs/API_CONVERSATIONS.md`, `docs/openapi.json` (thêm các path `/api/conversations*`) | |

## Migration

`migrations/009_conversation_title_paging.sql`: `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS display_title TEXT` + index `conversations_active_updated_id_idx (updated_at DESC, id DESC) WHERE deleted_at IS NULL`. Đã đăng ký trong `conversationSchema.constants.ts` → SchemaGuard tự áp lúc khởi động (idempotent, chỉ thêm). Index cũ `conversations_active_updated_idx` giữ lại (có thể drop sau). Prod: theo handoff.

## Biến môi trường mới

Không có. Hằng số: `CONVERSATION_LIST_DEFAULT_LIMIT = 20`, `CONVERSATION_LIST_MAX_LIMIT = 100`, `CONVERSATION_DETAIL_DEFAULT_MESSAGES = 40` (mặc định `limit` của `/messages`; client mới truyền `messages=40`), `CONVERSATION_MESSAGES_MAX = 500`, `CONVERSATION_TITLE_MAX = 80`. Client: 3 mục đầu, 20 mục/lần "Xem thêm".

## Rollback

Revert code; cột `display_title` và index mới vô hại với code cũ (code cũ không đọc chúng).

## Kiểm thử

- `tests/unit/modules/conversation-store/*` 42 test (thêm 10): keyset đi hết các trang không lặp/mất (cả 2 store), ranh giới cùng `updated_at` µs trên PGlite (id phá hoà, cursor giữ µs), cursor hỏng → 400, rename không đổi `updated_at` / `null` khôi phục / đã xoá → 404 / validate, detail `messages=N` + `/messages` kèm artifact đúng trang, PATCH 200/400/401/404, budget: list/rename/detail/messages/artifact mỗi lời gọi **1 round-trip**.
- Chưa chạy migration trên Neon dev (chỉ PGlite offline).

# Thay đổi: Photo capture — API `/api/captures` cho web app `cter-capture-client` (13/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-photo-capture`) · Plan: `planning/planning-13112026-photo-capture`
> · Client: **`cter-capture-client`** (web app mobile riêng, deploy Vercel — UI chụp/upload), `cter-interview-cloak-client` (nút 📥 Sync + Chuyển vào chat), `cter-monitoring-client-ui` (trang Photos). Tương thích ngược: module tắt khi chưa đặt `CAPTURE_API_KEY`.

## Vì sao

Cần chụp bài tập trên giấy bằng điện thoại (iPhone, góc 0.5×) rồi đưa nhanh vào AI. Một người chụp, nhiều người nhận (cả app AI riêng của người khác) qua một API GET đơn giản chỉ cần một key dùng chung.

## Thay đổi

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | Module mới `src/modules/capture` (domain `CaptureCatalog` + key layout, application `CaptureService`, presentation controller/routes) | Không dùng database: index nằm trong RAM, dựng lại từ **1 lần list** `captures/` khi được hỏi lần đầu |
| 2 | UI chụp **không** nằm trong harness: web app riêng `cter-capture-client` (Vercel) gọi API này qua CORS | Không đổi `Dockerfile` |
| 3 | API: `GET /api/captures`, `GET /api/captures/folders`, `POST /api/captures/batches`, `POST /api/captures/batches/{folder}/{index}/images` (body ảnh thô), `GET\|DELETE /api/captures/batches/{folder}/{index}`, `GET /api/captures/files/{folder}/{index}/{name}` | Key: header `X-Capture-Key` (hoặc `?key=`, hoặc `Bearer`); fail-closed |
| 4 | Object key `captures/{folder}/{0007}/{01-abcdef}.jpg`; `ObjectPrefix.CAPTURES` | Ảnh trong list có `url` presigned R2 (TTL `CAPTURE_URL_TTL_SECONDS`) + `path` proxy |
| 5 | CORS: thêm `X-Capture-Key` vào `Access-Control-Allow-Headers` | Để `cter-capture-client` và app web của người khác gọi được; thêm origin Vercel vào `FRONTEND_URL` |
| 6 | `/api/config` thêm `CAPTURE_ENABLED`, `CAPTURE_SEPARATE_UPLOAD_ACCESS`, `CAPTURE_STORAGE`, `CAPTURE_R2_BUCKET`, `CAPTURE_URL_TTL_SECONDS`, `CAPTURE_MAX_IMAGE_MB` | Không lộ key |

## Biến môi trường mới

| Biến | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|
| `CAPTURE_API_KEY` | Có (để bật) | — | Secret, chia cho người nhận. Trống = 503 |
| `CAPTURE_UPLOAD_KEY` | Không | = `CAPTURE_API_KEY` | Secret, chỉ người chụp |
| `CAPTURE_R2_BUCKET` | Khuyến nghị | — | Trống = dùng chung `R2_BUCKET` (prefix `captures/`) |
| `CAPTURE_R2_ACCESS_KEY_ID` / `CAPTURE_R2_SECRET_ACCESS_KEY` | Khi có bucket riêng | `R2_*` | Secret; token chỉ có quyền trên bucket capture |
| `CAPTURE_R2_ACCOUNT_ID` / `CAPTURE_R2_ENDPOINT` | Không | `R2_ACCOUNT_ID` / `R2_ENDPOINT` | |
| `CAPTURE_STORAGE_DIR` | Không | `./data/capture-store` | Chỉ khi không có R2 (dev) |
| `CAPTURE_URL_TTL_SECONDS` | Không | `3600` | 60–604800 |
| `CAPTURE_MAX_IMAGE_MB` | Không | `15` | 1–50 |

## Rollback

Xoá `CAPTURE_API_KEY` → `/api/captures` trả 503 (app `cter-capture-client` báo "Server chưa bật Capture API"). Không có migration.

## Kiểm thử

- `tests/unit/modules/capture/*` 11 test (key, catalog, routes: auth, upload song song, since/cursor, restart, 400/413). Toàn bộ suite: 882 pass; `puppeteerPdfRenderer.browser.test.ts` chập chờn khi chạy cả suite (chạy riêng pass, không liên quan).
- Smoke HTTP thật (module capture + local disk, không chạm Neon/R2): preflight có `X-Capture-Key`, create/upload/list/file OK, thiếu key 401. E2E headless Chrome (viewport iPhone) với `cter-capture-client`: setup → chọn 4 ảnh → 4/4 lên `bach/1`, 0 lỗi console.
- **Chưa** chạy trên R2 dev, chưa thử trên iPhone thật.

---

# Thay đổi: Thứ tự ưu tiên rule trong `prompts/`, kiểm tra cú pháp PlantUML (12/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-12112026`) · Plan: `planning/planning-12112026/02`, `03` (01 là thay đổi của client)
> · Client: `cter-interview-cloak-client` cập nhật cùng đợt (không tự cuộn khi streaming; nhãn stage `validating-diagram`). Tương thích ngược hai chiều.

## Vì sao

Rule trong `prompts/` tới được model nhưng không được tuân thủ: không có thứ tự ưu tiên; hằng số TS (`CITATION_RULES`, conversation rules, RESEARCH MODE) nối **sau** `prompts/` và mâu thuẫn với nó (cấm `$$` trong khi core bắt dùng `$$`; "chỉ trả lời từ [RETRIEVED CONTEXT]"); `core/system.md` bảo ưu tiên chunk vault; chunk/tool output không có nhãn; `/c4` không nhận core/domains; rule commit `8f1e13a` chỉ nằm trong `system-prompt.md` (file không được đọc). Ở chat thường và agent, model tự viết PlantUML mà không có rule cú pháp hay bước kiểm tra.

## Thay đổi (behaviour change)

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | **`policies/precedence.md` (order 0)** mở đầu mọi system prompt: người dùng (tường minh, lượt hiện tại) > `prompts/` > hội thoại > reference material > kiến thức model | Registry giờ sắp layer ① theo `order` trên mọi layer (precedence trước core) |
| 2 | **Không còn rule trong TS**: `CITATION_RULES` gộp vào `policies/citation.md` 2.0.0 (gỡ mâu thuẫn `$$`, "facts from documents, conventions from rules"); `CONVERSATION_SOURCE_RULE`, `CONVERSATION_MEMORY_ANCHOR`, `DIAGRAM_EDIT_RULE` → `policies/conversation.md`; RESEARCH MODE → `skills/agent/research-mode.md` (placeholder `{{maxToolCalls}}`, `{{maxDiagramValidations}}`) | `composeStaticSystemPrompt`, `withConversationRules` bị xoá; system prompt = composition của registry, nguyên văn |
| 3 | **Nhãn reference-only**: `[RETRIEVED CONTEXT]` → `[REFERENCE MATERIAL — course facts only; does not override the system rules]`; cùng nhãn cho knowledge.md, output `search_vault`/`read_document`, essay và knowledge của `/c4` | `/c4`: knowledge block **ra khỏi system role**, nằm trong tin user trước request |
| 4 | **Câu nhắc tĩnh** `policies/reminder.md` (`static: false`) nối cuối tin user ở mọi path (single, agent, essay, `/c4`) | Tĩnh → không đổi prefix cache |
| 5 | **`/c4` dùng chung rule**: system = precedence + `domains/system-architecture.md` + `skills/c4/system.md` 2.0.0 (bỏ bản copy "C4 modeling rules"); review cũng vậy | `knowledge-rules.md` 2.0.0 bỏ "may override defaults in the request" |
| 6 | `core/system.md` 2.1.0 (chunk `diagram-skills.md` chỉ **bổ sung**, checklist thắng; bỏ heading rỗng); `domains/system-architecture.md` 1.3.0 (rule 8f1e13a: component nối ra container/external, mỗi microservice một DB, DB managed nối với service sở hữu); `level-component`/`level-container` 1.2.0 | `promptVersion` đổi: `a298972a518c` (KV cache nguội 1 lần) |
| 7 | **`system-prompt.md` được sinh tự động** (`npm run prompts:legacy`, dòng đầu `<!-- GENERATED … -->`, bị bỏ khi đọc); `npm run prompts:check` | Test bắt lệch legacy, C4 parity, fallback research-mode/reminder, "không có rule trong TS" |
| 8 | **`policies/diagram-syntax.md`** (order 30): 10 rule PlantUML/C4-PlantUML + Mermaid, few-shot Container dựng bằng `C4PumlBuilder` và đã render thử | Nạp ở mọi path qua layer ① |
| 9 | **Tool agent `validate_diagram`**: render qua `C4RenderService`, trả `OK` hoặc `SYNTAX ERROR line N` + 3 dòng quanh; budget riêng `AGENT_MAX_DIAGRAM_VALIDATIONS` (không ăn `AGENT_MAX_TOOL_CALLS`) | Không đăng ký khi budget = 0 |
| 10 | **Guard sau khi trả lời** (`ClientAnswerService`: chat API + hội thoại Canvas, không chạy cho `/c4`): render mọi khối PlantUML; lỗi → tối đa `DIAGRAM_SYNTAX_MAX_REPAIRS` lượt repair bằng aux model (system = diagram-syntax policy); render OK thì thay block trong `done`, còn lỗi thì giữ bản gốc. Hết deadline (< 3 s) → bỏ qua | Stream progress `validating-diagram`; `timings.diagramValidateMs/diagramBlocks/diagramRepairs/diagramRepairFailed`; `/api/metrics/latency` → `metrics.diagramGuard` |
| 11 | **Monitoring**: `GET /api/prompts` thêm `compositions` (single/agent/essay/c4: `id@version` + chars theo thứ tự ghép) và `legacyInSync`; `/api/chat` với `includeTrace` có `trace.prompt`; `GET /api/evals` thêm `kind` (`golden-qa`/`rule-compliance`) | Vẫn chỉ đọc RAM/đĩa, 0 query DB |
| 12 | **Eval tuân thủ rule**: `evals/golden/rule-compliance.jsonl` (8 case: rule thắng chunk, ký pháp, `$$`, code C, C4 component, ghi đè thật/giả, Discovery Service) + `npm run eval:rules` (ma trận `EVAL_RULE_MODES` × `EVAL_RULE_MODELS`, mục tiêu ≥ 90%) | **Chưa chạy live** — xem handoff `planning/planning-12112026/handoff` |

## Biến môi trường mới

Tất cả có mặc định trong code — chỉ cần đặt khi muốn khác.

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `DIAGRAM_SYNTAX_GUARD_ENABLED` | `true` | Bật/tắt guard sau khi trả lời (rollback: `false`) |
| `DIAGRAM_SYNTAX_MAX_REPAIRS` | `1` | Số lượt repair mỗi khối |
| `AGENT_MAX_DIAGRAM_VALIDATIONS` | `3` | Số lần gọi `validate_diagram` mỗi lượt agent; `0` = không có tool |

Tái dùng `C4_PLANTUML_SERVER_URL` (render) và `AUX_PROVIDER`/`AUX_MODEL` (repair). Server công cộng `plantuml.com` có rate limit: khuyến nghị self-host `plantuml/plantuml-server` cho prod (chưa xác minh chi phí).

## Rollback

`DIAGRAM_SYNTAX_GUARD_ENABLED=false`, `AGENT_MAX_DIAGRAM_VALIDATIONS=0`; `PROMPT_REGISTRY_ENABLED=false` dùng `system-prompt.md` (đã sinh từ registry, cùng nội dung layer ①; khi đó `/c4` không có shared rules).

---


# Thay đổi: Hot window ảnh (KV cache), upload ảnh phía server, Gemini Files API, xem trước PlantUML, deadline theo đường (08/11/2026, chiều)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-0611-rest`) · Plan: `planning/planning-06112026/09`, `15`, `18 bước 5`
> · Client: `cter-interview-cloak-client` cập nhật cùng đợt (upload-first có fallback base64; preview PlantUML). Tương thích ngược hai chiều.

## Vì sao

Ảnh của các lượt trước chỉ quay lại prompt qua JIT (vị trí đổi theo turn → không ăn KV cache); client gửi base64 ảnh trong
mọi request; Gemini trả 413 khi tổng ảnh > 15 MB; essay tốn 1 call aux riêng; resume `/c4` sau restart mất ảnh đề;
`CHAT_DEADLINE_MS` 90 s cắt câu trả lời PDF dài của Canvas và trần từng bước C4 (`C4_CALL_TIMEOUT_MS` 150 s) thực chất bị
kẹp ở 90 s; sửa sơ đồ trong chat không xem được hình; `gemini-2.5-flash-lite` trả 404 cho key mới.

## Thay đổi (behaviour change)

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | **Hot window ảnh (18 bước 5)**: `ConversationTurn.images?`; ảnh của `CONTEXT_HOT_WINDOW_TURNS` cặp user/assistant gần nhất nằm **tại chỗ** trong history (≤ 3 ảnh/turn). PNG C4 trợ lý vẽ được đặt ở đầu turn user kế tiếp sau marker `[Hình [A3] do trợ lý vẽ ở lượt trước]`. Ảnh đã nằm trong window không gắn lại dạng JIT. Tổng ảnh/prompt ≤ `CONTEXT_MAX_PROMPT_IMAGES` (ảnh hiện tại + window + JIT; vượt → bỏ ảnh window cũ nhất trước) | Helper chung `src/modules/ai/domain/helpers/historyRender.helper.ts`; mọi adapter (Gemini, OpenAI chat + responses, Claude, Grok, OpenRouter, agent). Chỉ có tác dụng khi hội thoại phía server bật. Rollback `CONTEXT_HOT_WINDOW_TURNS=0` |
| 2 | **Upload ảnh phía server** `POST /api/chat/images` (CHAT_API_TOKEN): body raw `image/*` hoặc JSON `{images:[{data, mimeType?}]}` (≤ `MAX_CHAT_IMAGES`, body ≤ `CHAT_MAX_BODY_MB`). Mime nhận từ magic bytes (PNG/JPEG/GIF/WebP); PNG/JPEG cạnh dài > 2048 px thu về 1568 px (`@napi-rs/canvas`). Lưu `tmp/uploads/<uuid>` qua ObjectStorage, metadata **chỉ trong RAM** (0 query Neon). `/api/chat` và `/api/c4` nhận `imageIds: string[]` (tính vào `MAX_CHAT_IMAGES`; id lạ/hết hạn → 400) | Object bị xoá sau khi trả lời xong; object hết hạn (`CHAT_UPLOAD_TTL_MS`) chỉ được quét khi có upload mới (≤ 1 lần/phút, không timer); `tmp/` còn có lifecycle R2 1 ngày. Không có object storage → 503 |
| 3 | **Gemini Files API**: `GEMINI_INLINE_IMAGES_MAX_MB` (15) giờ là ngưỡng adapter Gemini direct **upload ảnh qua Files API** (URI cache theo sha256 trong RAM 47 h) thay vì trả 413. 413 (`InlineImagesTooLargeError`) chỉ khi upload lỗi — tới client sẽ thành 502 (lỗi provider sau fallback) | `/api/c4` vẫn giữ guard inline riêng; đường OpenRouter không còn guard kích thước |
| 4 | **Essay gộp vào aux router**: `IntentRouter.essaySession`; JSON router có thêm block `essay` tuỳ chọn; output cap 1024 token (`ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS`, hằng số) chỉ cho phiên essay; timeout = max(`ARTIFACT_RESOLVER_AUX_TIMEOUT_MS`, `ESSAY_ANALYSIS_TIMEOUT_MS`). Skill mới `prompts/skills/routing/essay-analysis.md` (có hằng fallback + test drift) | Essay = 1 aux + 1 write (+ self-check) — đo được `llmCalls = 2` |
| 5 | **/c4 tạm dừng giữ ảnh qua restart**: ảnh stage ở `tmp/c4-pending/<sessionId>/<n>.<ext>`, key nằm trong `pendingC4.imageKeys` của **cùng** lần ghi state (không thêm write Neon); resume nạp lại khi RAM không còn; xoá khi resume/hết hạn | Trước: resume đi tiếp từ brief text |
| 6 | **Deadline theo đường**: `CANVAS_DEADLINE_MS` (300000) cho polling Canvas (file Q&A + hội thoại Canvas); `/api/chat` vẫn `CHAT_DEADLINE_MS` 90000; mỗi bước model C4 = min(`C4_CALL_TIMEOUT_MS` 150000, thời gian còn lại của run) | Trước: bước C4 bị kẹp âm thầm ở 90 s |
| 7 | **Xem trước PlantUML** `POST /api/c4/render` (CHAT_API_TOKEN): `{source, format?:"png"}`, source ≤ 100 000 ký tự, tự bọc `@startuml/@enduml`; 200 `image/png` + `X-Render-Cache: hit\|miss`; 422 `{error, syntaxError, line}`; 502 renderer lỗi; 400/413. Cache LRU trong RAM 100 entry / 32 MB; dùng `C4_PLANTUML_SERVER_URL`; 0 DB/R2 | |
| 8 | Câu trả lời chat: `@startuml…@enduml` trần được bọc fence ```` ```plantuml ```` (text `done`/đã lưu; delta stream giữ nguyên). Khối PlantUML trong câu trả lời lưu thành artifact `c4_puml` (version +1 khi turn nói về thiết kế đã có). Rule tĩnh mới `DIAGRAM_EDIT_RULE` (trả đủ PlantUML trong 1 fence + danh sách thay đổi; gợi ý `/c4`) | **Hash prompt tĩnh đổi 1 lần** (cache prefix nguội lại 1 lần sau deploy) |
| 9 | **Fallback Gemini**: bỏ `gemini-2.5-flash-lite` khỏi mặc định `MODEL_FALLBACK_GEMINI` (code + `.env.example`) — Google trả 404 cho key mới | `.env` dev và Render vẫn còn → **sửa tay** |
| 10 | **Eval**: `npm run eval:cache [-- --label X] [--scenario long]` (`scripts/eval-cache.ts`) → `evals/reports/data/cache-<label>.json`; script eval ghi `timings`/`wallMs` từng case; `eval-prompts.ts` bỏ qua file golden không có `expected_points` (trước crash ở `reference-resolution.jsonl`); `REF_EVAL_OUT=<file>` cho test golden reference-resolution dump kết quả từng case; notebook `evals/reports/eval-report-vi.ipynb` / `eval-report-en.ipynb` + `report_lib.py` | Baseline `evals/results/baseline.json`: QA mean 94%, pass 100%, promptVersion `859067ef360c` |

## Biến môi trường mới / đổi nghĩa

Tất cả có mặc định trong code — chỉ cần đặt khi muốn khác.

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `CONTEXT_HOT_WINDOW_TURNS` | `2` | **Mới**. Số cặp user/assistant gần nhất giữ ảnh tại chỗ; `0` = hành vi cũ (rollback) |
| `CONTEXT_MAX_PROMPT_IMAGES` | `16` | **Mới**. Trần tổng ảnh mỗi prompt (hiện tại + window + JIT) |
| `CHAT_UPLOAD_TTL_MS` | `3600000` | **Mới**. Ảnh upload phải được dùng trong khoảng này |
| `CANVAS_DEADLINE_MS` | `300000` | **Mới**. Hạn chót cả chuỗi model cho 1 item polling Canvas |
| `CHAT_DEADLINE_MS` | `90000` | **Đổi phạm vi**: vẫn áp cho `/api/chat`; polling Canvas chuyển sang `CANVAS_DEADLINE_MS`, mỗi bước C4 dùng deadline riêng |
| `GEMINI_INLINE_IMAGES_MAX_MB` | `15` | **Đổi nghĩa**: ngưỡng chuyển sang Files API (không còn trả 413 ngay) |
| `C4_CALL_TIMEOUT_MS` | `150000` | Nay có hiệu lực thật (trước bị kẹp 90 s) |
| `ESSAY_ANALYSIS_TIMEOUT_MS` | `6000` | Nay là timeout (cùng `ARTIFACT_RESOLVER_AUX_TIMEOUT_MS`, lấy max) của call aux router khi phiên essay |
| `MODEL_FALLBACK_GEMINI` | `gemini-3.5-flash,gemini-3.1-flash-lite` | Bỏ `gemini-2.5-flash-lite` |
| `REF_EVAL_OUT` | — | Chỉ test/eval (server không đọc) |

Không có package mới (resize ảnh upload dùng `@napi-rs/canvas` đã có sẵn).

## API

| Endpoint | Thay đổi |
|---|---|
| `POST /api/chat/images` | Mới (CHAT_API_TOKEN) → `{images:[{imageId, mimeType, bytes, width?, height?}]}`; 400 (không phải ảnh/rỗng/quá số ảnh), 413 (body quá lớn), 503 (không có token/object storage) |
| `POST /api/c4/render` | Mới (CHAT_API_TOKEN): PlantUML → PNG; 200/400/413/422/502/503 |
| `POST /api/chat` | Body thêm `imageIds[]`; ảnh lớn qua Gemini không còn 413 (trừ khi Files API lỗi) |
| `POST /api/c4` | Body thêm `imageIds[]` |

## Tương thích ngược

- Client cũ: vẫn gửi base64 `images` như trước; không cần `/api/chat/images`. Client mới gặp server cũ (404/405) → tự gửi base64.
- Rollback bằng env: `CONTEXT_HOT_WINDOW_TURNS=0` (ảnh lịch sử chỉ qua JIT như cũ). Có thể tăng/giảm `CANVAS_DEADLINE_MS`, `CHAT_DEADLINE_MS` độc lập.
- Không có migration; `pendingC4.imageKeys` là field JSON tuỳ chọn trong `conversations.state`.
- Render/dev: xoá `gemini-2.5-flash-lite` khỏi `MODEL_FALLBACK_GEMINI` nếu đang đặt tay.

## Kiểm thử

- `tsc` 0 lỗi, `npx vitest run` **88 file / 854 test**, `npm run build` OK.
- Client: build 0 warning, ProtocolTests 104/104.

---

# Thay đổi: Latency, Prompt Registry, Artifact Resolver, C4 agent flow, Essay Mode, chi phí Neon (08/11/2026)

> Trạng thái: **chưa commit** (branch `feature/bach-planning-0611-rest`) · Plan: `planning/planning-06112026/05`, `06`, `07`, `08`, `09`, `13 §3.1`, `15`, `16`, `17`, `18`
> · Client: `cter-interview-cloak-client`, `cter-monitoring-client-ui` cập nhật cùng đợt (tương thích ngược với server cũ). Note 14 (PDF ingestion) **không làm**.

## Vì sao

Gemini có lúc treo > 5 phút (retry 12 lần, không có timeout token đầu, không abort thật); câu trả lời luôn kèm mục
`## References` dài; system prompt cứng một môn và đổi theo từng turn nên không ăn được KV cache của provider;
"thiết kế bạn vẽ lúc nãy" không trỏ đúng artifact; `/c4` không hiểu đề dạng ảnh, không review được thiết kế của user;
câu hỏi tự luận "(N điểm)" thiếu ý; `/health` + cursor poller giữ Neon thức suốt ngày (CU-giờ vượt free tier).

## Thay đổi (behaviour change)

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | **Latency (07)**: `AbortSignal` xuống 5 adapter; timeout tách: token đầu `AI_FIRST_TOKEN_TIMEOUT_MS`, khoảng lặng giữa chunk `AI_IDLE_TIMEOUT_MS`, `AI_TIMEOUT_MS` cho non-stream; **deadline cả chuỗi** `CHAT_DEADLINE_MS` áp cho MỌI request (chat, Canvas file Q&A, C4, aux) | Câu trả lời PDF rất dài bị cắt → tăng `CHAT_DEADLINE_MS` |
| 2 | Retry chỉ 429/5xx **trước** token đầu; đã có delta → chuyển model (gửi `reset`). Timeout/4xx/rỗng/lỗi mạng → chuyển model ngay. Gemini trả rỗng ném `EmptyProviderResponseError` | `MAX_RETRY_COUNT` mặc định 2 |
| 3 | **Circuit breaker** theo model: `AI_CIRCUIT_FAILURE_THRESHOLD` lỗi (503/504/529/overloaded/timeout) trong `AI_CIRCUIT_WINDOW_MS` → bỏ qua model `AI_CIRCUIT_COOLDOWN_MS`; mọi model đều mở thì vẫn thử | Trạng thái ở `circuit[]` của `/api/ai-usage` |
| 4 | Gemini adapter chuyển sang **`@google/genai`** (thinkingConfig, maxOutputTokens, không retry trong SDK, abortSignal); `@google/generative-ai` chỉ còn cho embedding (không đổi vector). OpenAI: reasoning effort (o-series/gpt-5*/gpt-6*/codex), service tier, `max_output_tokens`, `prompt_cache_key` | Embedding câu hỏi: timeout 5 s, 1 retry, LRU 200 |
| 5 | RAG: `RAG_TOP_K` mặc định 6→8, `RAG_MIN_SCORE` 0.3 (luôn giữ top 2). Agent: fallback single-shot dùng phần còn lại của deadline; tool call trong 1 turn chạy song song | |
| 6 | `done` (chat) có **`timings`** `{ttftMs, totalMs, attempts[{model,outcome,ms}], inputTokens, outputTokens, cachedTokens, retrievalMs, llmCalls?}`; lưu `messages.tokens_in/out/cached`, `ttft_ms`, `latency_ms`. Ring buffer 1000 lượt trong RAM → `GET /api/metrics/latency` | Agent invocation chưa vào ring buffer |
| 7 | **References (08)**: prompt không còn đòi `## References` (vẫn cấm bịa nguồn); `stripTrailingReferences` cắt mục References/Sources/Nguồn/Tài liệu tham khảo cuối bài ở mọi đường chat. `sources: [{file, heading, score\|null}]` luôn có (≤ 6 file, dedupe theo file) | Client hiện expander "📚 N nguồn" |
| 8 | **Ảnh (09)**: `MAX_CHAT_IMAGES` (10, trước hardcode 4), body `CHAT_MAX_BODY_MB` 20, tổng ảnh Gemini > `GEMINI_INLINE_IMAGES_MAX_MB` → **413** kèm gợi ý nén. `/api/c4` cũng 10 ảnh | Files API chưa làm |
| 9 | **System prompt (06)**: `system-prompt.md` đa môn, bỏ lệnh bắt đọc `diagram-skills.md`, sửa path `software-tesing-ISYS2092-SYS3397`. **Prompt Registry** `prompts/` (core, policies, domains, skills/c4, skills/essay), frontmatter `id/version/owner/description` bắt buộc (thiếu → lỗi khởi động); `promptVersion` = sha256[:12] phần tĩnh. Không có `prompts/` → `system-prompt.md` như cũ | Dockerfile copy `prompts/` + `evals/` → **prod dùng registry sau deploy** |
| 10 | `messages.prompt_version` = hash prefix tĩnh thực sự gửi cho model (khác `promptVersion` của registry — chỉ phần base) | |
| 11 | Eval: `npm run eval` (`evals/golden/qa.jsonl`, 8 case), `npm run eval:essay` (`essay.jsonl`, 6 case) → `evals/results/<date>-<promptVersion>.json`, so `baseline.json` | **Chưa chạy, chưa có baseline** |
| 12 | **KV cache (18)**: bố cục prompt v2 ①②④③⑤⑥⑦ — system tĩnh (base + `CITATION_RULES` + conversation rules) giống hệt byte giữa các hội thoại, summary là turn đầu history, artifact registry ở tin cuối; đo `cachedTokens` ở 3 adapter; OpenAI `prompt_cache_key`; Claude `cache_control` sau cờ `PROMPT_CACHE_CLAUDE` | Rollback `PROMPT_CACHE_LAYOUT=v1`. Bước 5 (hot window ảnh) chưa làm; OpenRouter chưa gửi cache key |
| 13 | **Artifact Resolver (17)**: `refArtifactIds` từ UI > alias gõ tay (`[A7]`) > rule chấm điểm (kind/level/owner/entity fuzzy bỏ dấu/thời gian; `ARTIFACT_RESOLVER_MIN_SCORE`, `_MARGIN`) > aux (chỉ khi mơ hồ, mode `rules+aux`) > mơ hồ: chèn 2 ứng viên + hỏi lại 1 câu. "Hình/sơ đồ bạn vẽ" → `c4_png`; JIT cắt spec theo level được hỏi; model mở đầu "Dựa trên [A7] …" | `ARTIFACT_RESOLVER_MODE=off` = hành vi cũ |
| 14 | Ghim kind thiết kế (`CONTEXT_PINNED_KINDS`, ≤ 60) ngoài giới hạn 40 artifact, vẫn 1 round-trip. `design_note` cho thiết kế trả lời trong chat thường (heuristic trong cùng transaction). Agent có tool `list_artifacts`, `get_artifact(id, part, level)` khi hội thoại có artifact | |
| 15 | `done` của chat và c4 có **`artifacts: [{id, alias, kind, label, level?}]`**; message lưu `resolved_refs {ids, source: ui\|rule\|aux\|ambiguous\|none, scores}` | Client: nút "↩ Hỏi về cái này" |
| 16 | **C4 agent flow (05)**: module `src/modules/routing` — Intent Router rule trước (chỉ đọc ≤ 200 ký tự / 12 từ đầu) rồi aux 1 lần/request `{intent, confidence, refs[]}` (dùng chung làm AuxResolver cho chat). Workflow Route → Extract (`ProblemBrief`, 1 call vision) → Gap analysis (≤ 3 câu hỏi) → pause ở `conversations.state.pendingC4` (TTL 15 phút, sống qua restart) → Generate/Revise → Render → Repair → Critic → Review → Record | Intent: `qa`, `c4_generate`, `c4_review`, `c4_generate_and_review`, `c4_revise` |
| 17 | Revise: bản mới có `parent_artifact_id` + `version+1`. Review: thiết kế của user (ảnh → spec) hoặc spec resolver chọn, RAG rubric, khung cố định, artifact `design_review`. Ảnh đề giờ tới extract/architect/drafter/repair. Skill C4 đọc từ registry (+6 skill mới) | Resume sau restart mất ảnh request (đi tiếp từ brief text) |
| 18 | **Essay Mode (15)**: `/essay [strict] [Nđ]` hoặc `mode: "essay"` luôn chạy; `ESSAY_MODE_ENABLED` chỉ bật tự nhận diện. Phân tích (aux) → multi-query mỗi aspect + RRF + rerank → 1 call viết `<outline>` + `<essay>` theo rubric môn → kiểm id trích dẫn bằng code → self-check (strict / `ESSAY_SELF_CHECK`). ≤ 3 LLM call; stream chỉ phần `<essay>`. `done.essay` = `{outline, aspects, targetWords, coverage, strict, wordCount, droppedCitations, trigger, subject?, domain?}` | Cần Pinecone; không kết hợp agent |
| 19 | **Hybrid search** BM25 (`minisearch` 7.2.0) trong RAM cho mọi mode: build sau RAG warmup từ object storage, cập nhật theo chữ ký manifest RAM, 0 query Neon; RRF k=60 | `HYBRID_SEARCH_ENABLED=false` = chỉ vector |
| 20 | **Neon (13 §3.1)**: `GET /ping` (không phụ thuộc gì), `HEARTBEAT_PATH` /health → **/ping**, `render.yaml healthCheckPath: /ping`; `/health` đọc vault stats từ RAM (`vault: "loading"` tới khi load xong). `CachedPollCursorRepository`: đọc 1 lần mỗi (job, account), ghi gom ≤ 1 batch / `POLL_CURSOR_FLUSH_MS`, flush khi SIGTERM/SIGINT (≤ 10 s) | Crash → mất tối đa 15 phút cursor (dedupe downstream) |
| 21 | **Monitoring (16)**: `countingSqlClient` đếm mọi query Neon; endpoint mới (ADMIN_TOKEN) — xem mục API | Poll được vì chỉ đọc RAM |
| 22 | Refactor: interface trong `index.ts` của ai/agent/retrieval tách ra `interfaces/`; `extractJsonObject` sang `src/shared/text` | |

## Biến môi trường mới

Tất cả có mặc định trong code — chỉ cần đặt khi muốn khác.

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `MAX_RETRY_COUNT` | `2` | **Hạ** nếu `.env`/Render đang 12 |
| `AI_FIRST_TOKEN_TIMEOUT_MS`, `AI_IDLE_TIMEOUT_MS`, `CHAT_DEADLINE_MS` | `15000`, `20000`, `90000` | 07 |
| `AI_CIRCUIT_FAILURE_THRESHOLD`, `AI_CIRCUIT_WINDOW_MS`, `AI_CIRCUIT_COOLDOWN_MS` | `3`, `60000`, `120000` | 07 |
| `AI_MAX_OUTPUT_TOKENS` | `8192` | |
| `GEMINI_THINKING_LEVEL` | `minimal` | |
| `OPENAI_REASONING_EFFORT`, `OPENAI_SERVICE_TIER` | `low`, trống | |
| `RAG_TOP_K`, `RAG_MIN_SCORE` | `8` (trước 6; render.yaml 20→8), `0.3` | |
| `OPENAI_PROMPT_CACHE_KEY`, `PROMPT_CACHE_CLAUDE`, `PROMPT_CACHE_LAYOUT` | `conversation`, `false`, `v2` | 18 |
| `MAX_CHAT_IMAGES`, `CHAT_MAX_BODY_MB`, `GEMINI_INLINE_IMAGES_MAX_MB` | `10`, `20`, `15` | 09 |
| `PROMPT_REGISTRY_ENABLED`, `PROMPTS_DIR` | bật nếu có `prompts/core/system.md`, `prompts` | 06 |
| `POLL_CURSOR_FLUSH_MS` | `900000` | 13 |
| `ARTIFACT_RESOLVER_MODE` | `rules+aux` | `off` \| `rules` \| `rules+aux` |
| `ARTIFACT_RESOLVER_MIN_SCORE`, `_MARGIN`, `_AUX_TIMEOUT_MS` | `2.5`, `1.0`, `1500` | |
| `CONTEXT_PINNED_KINDS` | `c4_spec,problem_brief,design_review,design_note` | |
| `ESSAY_MODE_ENABLED` | `false` | Chỉ bộ tự nhận diện |
| `ESSAY_MAX_CHUNKS`, `ESSAY_WORDS_PER_POINT`, `ESSAY_SELF_CHECK`, `ESSAY_THINKING_LEVEL` | `12`, `175`, `false`, `low` | |
| `ESSAY_ANALYSIS_TIMEOUT_MS`, `ESSAY_SELF_CHECK_TIMEOUT_MS` | `6000`, `20000` | |
| `HYBRID_SEARCH_ENABLED` | `true` | |
| `HARNESS_URL`, `EVAL_PROVIDER`, `EVAL_MODEL`, `EVAL_JUDGE_PROVIDER`, `EVAL_JUDGE_MODEL` | — | Chỉ script eval (server không đọc) |

Package mới: `@google/genai` ^3.0.0, `minisearch` 7.2.0. Không đổi env C4 (dùng `AUX_*`, `ARTIFACT_RESOLVER_*`).

## API

| Endpoint | Thay đổi |
|---|---|
| `GET /ping` | Mới, không auth, text `ok`, 0 query DB — dùng cho Render health check + heartbeat |
| `GET /health/deep` (ADMIN) | Mới: Neon `SELECT 1`, R2 HEAD 1 key, Pinecone describeIndexStats; 503 nếu 1 check fail. Chỉ gọi theo yêu cầu |
| `GET /api/metrics/db` (ADMIN) | Mới, RAM: `queriesSinceBoot`, `lastQueryAt/Tag`, `byTag`, `cursors {flushCount, dirty…}` |
| `GET /api/metrics/latency?window=1h\|24h` (ADMIN) | Mới, RAM: p50/p95 ttft/total, retries, errors, cacheHitRate theo model |
| `GET /api/ai-usage` | Thêm `circuit[]` |
| `GET /api/config` (ADMIN) | Mới: cấu hình whitelist, secret chỉ hiện dạng boolean |
| `GET /api/storage/stats` (ADMIN) | Mới: R2 list (Class A) — chỉ khi bấm |
| `GET /api/prompts` (ADMIN) | Mới: `{promptVersion, prompts[]}`; 404 khi không có registry |
| `GET /api/evals` (ADMIN) | Mới: `{evals: [...]}` từ `evals/results` |
| `POST /api/chat` | Body thêm `refArtifactIds[]`, `mode: "essay"`, câu bắt đầu `/essay`; `done`/JSON thêm `sources`, `timings`, `artifacts`, `essay`; 413 khi ảnh quá lớn |
| `POST /api/c4` | Body thêm `images` (≤ 10), `description` tuỳ chọn khi có ảnh, `review`, `intent`, `refArtifactIds`. Event mới: `intent`, `brief`, `clarify`, `review_delta`, `review_done`; `done` thêm `intent`, `brief`, `review`, `artifacts`, `criticNotes` (`confirmation` cũ giữ nguyên) |
| `GET /api/conversations/:id` | `state.pendingC4` (đã lọc); message `resolvedRefs`, `tokensCached`, `intent`, `intentConfidence`; artifact `label`, `level`, `owner`, `parentArtifactId`, `version` |
| `GET /api/conversations?pending=c4` | Lọc hội thoại C4 đang chờ trả lời; item có `pending[]` |

## Migration

- `007_artifact_references.sql`: `artifacts.label/level/owner/parent_artifact_id (FK SET NULL)/version`, `messages.resolved_refs JSONB`, `messages.tokens_cached`, index `artifacts_conversation_kind_idx`.
- `008_c4_intent.sql`: `messages.intent TEXT`, `messages.intent_confidence REAL`.
- Cả hai **SchemaGuard tự áp** lúc khởi động (idempotent, `ADD COLUMN IF NOT EXISTS`, chỉ thêm cột). Có thể chạy tay trước để kiểm.

## Tương thích ngược

- Client cũ: field mới đều tuỳ chọn; `confirmation` của `/api/c4` giữ nguyên; client mới vẫn gom heading References của server cũ.
- Rollback nhanh bằng env (không cần redeploy code): `PROMPT_REGISTRY_ENABLED=false`, `PROMPT_CACHE_LAYOUT=v1`, `ARTIFACT_RESOLVER_MODE=off`, `HYBRID_SEARCH_ENABLED=false`. Cột 007/008 để nguyên (code cũ bỏ qua).
- Render: nếu service tạo từ dashboard, đổi tay **Health Check Path** → `/ping` và kiểm `MAX_RETRY_COUNT`/`RAG_TOP_K` không bị override giá trị cũ.

## Kiểm thử

- `tsc` 0 lỗi, `npx vitest run` **80 file / 778 test** (chạy 2 lần), `npm run build` OK. Test puppeteer PDF thêm `hookTimeout` 60 s (sửa flaky).
- Golden reference resolution (`evals/golden/reference-resolution.jsonl`, 33 case, offline): accuracy 100%, ambiguity recall 100% (rule được tinh chỉnh trên chính bộ này).
- Smoke live trên dev (Neon dev branch, R2 `cter-dev`, Pinecone dev, Gemini): **21/21**, đã dọn. Turn 2 của chat: cached 2027/4198 token; `/c4` → câu hỏi "hình bạn vẽ" resolve `[A2]` bằng rule, cached 4057 token; `/ping` + `/health` = 0 query DB.
- **Chưa test live**: clarify → resume, review, revise, essay (vault dev trống), cache OpenAI/Claude, client WPF + monitoring UI với server thật, p95 Gemini trên 20 câu, `npm run eval`.

---

# Thay đổi: Vault lên Cloudflare R2, hội thoại phía server, context engineering (07/11/2026)

> Trạng thái: **chưa commit** · Plan: `planning/planning-06112026/02`, `03`, `04`, `12`, `13 §4` · Prod: `planning/planning-06112026/handoff/01-prod-runbook.md`
> · Client: `cter-interview-cloak-client` gửi `conversationId` (tương thích ngược).

## Vì sao

Nội dung vault nằm trong cột `content` của Neon và chunk ID dựa trên tên file (trùng giữa `Bài 1.md`/`Bái 1.md`);
upload file y hệt vẫn bị re-embed; xoá không có trạng thái nên lỗi giữa chừng để lại vector "ma". Hội thoại chỉ
nằm ở client (bỏ ảnh, bỏ turn `/c4`, cắt cứng 20 turn), phiên `/c4` mất khi restart.

## Thay đổi (behaviour change)

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | **Object storage** `src/shared/storage` (port + R2 qua S3 API + local disk): key phải thuộc prefix `vault/`, `vault-images/`, `derived/`, `conversations/`, `tmp/`; xoá prefix không bao giờ chạm root; metadata `sha256` mọi object | R2: checksum `WHEN_REQUIRED`, path-style. Thiếu một phần `R2_*` → không khởi động |
| 2 | **Vault**: file ở `vault/{docId}/{hash}.md` (content-addressed); manifest giữ `doc_id`, `object_key`, `status`, `indexed_hash`, `last_error`. Chunk ID `<docId>#<hash8>#<idx3>`, metadata Pinecone thêm `docId`, `contentHash` | Sửa bug trùng chunk ID. Bỏ `DiskVaultDocumentStore`; Dockerfile không bake `documents-vault` |
| 3 | Upload cùng nội dung → `outcome: unchanged`, **0 put, 0 embed** (sửa bug cũ). Hash = md5 nội dung chuẩn hoá (thêm bỏ BOM, CRLF→LF, trim cuối) | `POST /api/vault/files` trả `outcome` |
| 4 | Index: đọc từ object storage (kiểm sha256), embed từng file, upsert, **rồi** đổi pointer, **rồi** xoá vector cũ; lỗi → `failed`, bản cũ vẫn phục vụ; thử lại sau 30/90/240 s | `KnowledgeIndexer` viết lại |
| 5 | **Xoá** theo state machine `deleting` (commit trước) → vector theo prefix → object theo prefix → row; lỗi giữa chừng → `202 {pending}`, reconcile làm nốt | `DELETE /api/vault/files…` thêm `deleted`, `pending` |
| 6 | **Reconciler** lúc startup và `POST /api/vault/sync` (tên cũ `/sync-pinecone` vẫn chạy): xoá nốt row `deleting`, vector/object mồ côi (object > 10 phút), xếp lại file chưa index | Chạy tuần tự với indexing |
| 7 | **Read-side guard** cho RAG: bỏ chunk của doc đã xoá/đang xoá/phiên bản cũ; trích dẫn dùng đường dẫn hiện tại | `RetrievalModule.setChunkGuard` |
| 8 | **Rename** `POST /api/vault/files/<path>/rename {newPath}`: chỉ đổi `file_path` (0 put, 0 embed) | |
| 9 | Manifest **cache trong RAM** (1 instance): `/health`, liệt kê file, guard = 0 query DB sau lần load đầu | Note 13 §3.1 B |
| 10 | **Hội thoại phía server** (`CONVERSATION_STORE_ENABLED`, mặc định tắt): bảng `conversations`/`messages`/`artifacts`, file ở `conversations/<id>/`; `/api/chat` nhận `conversationId`, trả `conversationId`, `messageId`, `persisted`; `/api/conversations` (GET, list, soft delete 204, restore, `?hard=true` admin); purge sau `CONVERSATION_PURGE_DAYS` (chạy ké, ≤ 1 lần/ngày) | 1 turn = 1 read + 1 transaction. Ghi DB lỗi không làm hỏng câu trả lời |
| 11 | **Context engineering** `src/modules/context`: Context Assembler (summary + artifact registry + turn chưa tóm tắt + JIT ảnh/spec C4 + RAG); caption/OCR ảnh, viết lại câu follow-up có đại từ, auto-compact rolling summary giữ mọi artifact id — bằng aux model | `PromptContent` thêm `memory`, `jitContext`, `retrievalQuery`; agent mode gộp các lớp vào prompt |
| 12 | **C4**: nhận `conversationId`, `images` (đưa cho architect); mỗi lần vẽ thuộc 1 conversation, lưu `c4_spec`/`c4_png`/`c4_puml` + tóm tắt element; phiên chờ trả lời lưu ở `conversations.state.pendingC4` → resume được sau restart | Tạo conversation mới khi client không gửi id |
| 13 | **Fix**: upload nhiều file một lần có thể gán **sai đường dẫn** cho nội dung (formidable trả file theo thứ tự ghi xong) | `parseMultipart` giữ thứ tự part |
| 14 | SchemaGuard áp DDL trong **1 transaction** (1 round-trip) | |
| 16 | **`GET /api/storage/check`** (ADMIN_TOKEN): ghi/đọc/xoá 1 object nhỏ trong `tmp/healthcheck/` → `{ok, kind, location, latencyMs, failedStep?, error?}`; 503 khi lỗi hoặc chưa có storage. Chỉ gọi theo yêu cầu (nút trong monitoring), **không** gắn vào heartbeat | 2 Class A + 1 Class B R2/lần |
| 17 | **Fix upload**: 1 file rỗng (0 byte) làm **cả batch** bị từ chối (`options.allowEmptyFiles is false…`). Nay file rỗng/chỉ khoảng trắng trả lỗi riêng `{file, error: "empty file"}`, các file khác vẫn lưu. Tổng dung lượng 1 request nâng lên 200 MB (trước = giới hạn 1 file 50 MB) | `parseMultipart`, `VaultService.uploadFiles` |
| 15 | Script: `vault:reset` (dry-run mặc định, `--confirm`, `--allow-prod`), `vault:upload`, `vault:export-legacy`, `smoke:r2` | |
| 16 | `/api/conversations*` nhận `CHAT_API_TOKEN` **hoặc** `ADMIN_TOKEN` (monitoring UI có trang Chats); purge vẫn chỉ `ADMIN_TOKEN`. `isAuthorized`/`Router` nhận nhiều token | `cter-monitoring-client-ui` cập nhật theo: trạng thái file, upload `path`+`outcome`, rename, xoá folder, Sync/Reindex, Chats. Plan: `planning-06112026/16-monitoring.md` |

## Biến môi trường mới

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | — | Dev `cter-dev`, prod `cter-prod`; token chỉ cho bucket đó |
| `R2_ENDPOINT` | — | Tuỳ chọn |
| `OBJECT_STORAGE_DIR` | `./data/object-store` | Khi không có R2 |
| `CONVERSATION_STORE_ENABLED` | `false` | Feature flag |
| `CONVERSATION_PURGE_DAYS` | `30` | |
| `CONTEXT_KEEP_RECENT_TURNS`, `CONTEXT_COMPACT_THRESHOLD_TOKENS` | `6`, `12000` | |
| `AUX_PROVIDER`, `AUX_MODEL`, `AUX_SYNC_TIMEOUT_MS` | `gemini`, `gemini-3.1-flash-lite`, `15000` | |

`VAULT_PATH` không còn dùng. Package mới: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`; dev: `@electric-sql/pglite`, `aws-sdk-client-mock`, `fast-check`.
Migration: `004_vault_object_storage.sql`, `005_conversations.sql` (SchemaGuard tự áp); `006_drop_legacy_vault_content.sql` **chạy tay sau reset**.

## Kiểm thử

- `tsc` 0 lỗi, `npm test` **53 file / 497 test** (Postgres in-process PGlite, R2 contract test, property test I1–I6 có chèn lỗi).
- Live trên dev (Neon branch dev, R2 `cter-dev`, Pinecone dev, Gemini): vault 20/20, hội thoại 19/19. Chi tiết: `planning/planning-06112026/handoff/02-dev-test-report.md`.

---

# Thay đổi: Câu trả lời chat được chuẩn hoá math + sanitize Mermaid (05/11/2026)

> Trạng thái: **chưa commit** · Plan: `planning/planning-05112026/03-latex-math-rendering.md` (+ bước 6 của plan 02)
> · Client: `cter-interview-cloak-client` port strict mode (`MathDelimiters.cs`) và chạy cùng fixture.

## Vì sao

Client chỉ nhận math dạng `$…$` / `$$…$$`, nhưng model hay trả `\( \)`, `\[ \]`, `\begin{equation}` trần.
`normalizeMathDelimiters` đã có nhưng chỉ dùng cho PDF, và nó còn sửa cả nội dung trong code block.

## Thay đổi (behaviour change)

| # | Thay đổi | Ghi chú |
|---|---|---|
| 1 | **Chat answers are math-normalized**: text cuối của `POST /api/chat` (JSON `text` và event `done` của stream) và reply Canvas `[CFH:REPLY]` đi qua `normalizeMathDelimiters(text, { mode: 'strict' })` | Một chỗ duy nhất: `ClientAnswerService` (`src/modules/agent/application/clientAnswer.service.ts`) bọc `AnswerService`; `main.ts` truyền `agent.clientAnswers` cho chat + conversation. Delta stream vẫn raw (client tự chuẩn hoá). File Q&A (PDF) giữ answerer cũ |
| 2 | Strict mode: chỉ đổi `\(…\)`→`$…$`, `\[…\]`→`$$…$$` (trim), `\begin{equation\|align\|gather\|…}` → `$$…$$` (`align`→`aligned`, `gather`→`gathered`, env khác bọc nguyên); `$…$` theo luật Pandoc (giá `$5 và $10` không phải math), `\$` là dấu đô la literal; không heuristic nào khác | Hợp đồng + fixture dùng chung: `tests/fixtures/math-delimiters.json` |
| 3 | **Code không bao giờ bị đụng** (cả 2 mode): fenced block ```` ``` ````/`~~~` và inline code được bỏ qua | PDF (loose) giữ nguyên output với phần ngoài code (fuzz 200k input so với bản cũ: 0 khác biệt); trước đây `$HOME` trong code có thể bị chèn space / bọc `$` |
| 4 | **Mermaid sanitize cho chat**: thân các fence ```` ```mermaid ```` trong câu trả lời chat/Canvas đi qua cùng logic `sanitizeMermaidGlyphs` của PDF (xoá dòng glyph rời, `δl`→`δ<sub>l</sub>`) | Chỉ thân block mermaid; fence khác không đổi |
| 5 | Chuyển `mathNormalizer.ts` và `sanitizeMermaidGlyphs` sang `src/shared/text/` (thêm `splitCodeSegments`, `formatAnswerForClient`) | `document` module re-export, import cũ vẫn chạy |
| 6 | `system-prompt.md`: cấm `\(\)`/`\[\]`, `$$` trên dòng riêng, không đặt math trong code block, `\$` cho dấu đô la; bỏ hướng dẫn `\begin{equation}`/`\begin{align}` trần (dùng `aligned` trong `$$`) | Ảnh hưởng cả prompt của File Q&A (PDF vẫn render `aligned` bằng KaTeX) |

Không có env var mới.

## Kiểm thử

- `tests/unit/shared/text/*` (fixture strict 50 case + idempotent, loose regression, code segments, mermaid),
  `ClientAnswerService`, chat route stream (delta raw, `done` + JSON đã chuẩn hoá).

---

# Thay đổi: Agent mode cũng stream + event `progress` (27/10/2026)

> Trạng thái: **chưa commit** · Client: `cter-interview-cloak-client` (bản có `onProgress` + đồng hồ chờ)

## Vì sao

`/api/chat` đã stream ở single-shot, nhưng **agent mode không stream**: `AnswerService` rẽ nhánh agent và
gọi `runner.run()` mà không truyền `stream`, nên client chỉ nhận đúng một event `done` ở cuối — chữ hiện
một cục sau 10–20 s im lặng. Ngoài ra cả single-shot lẫn agent đều không có event nào trong lúc dựng prompt
(RAG) và lúc agent đọc vault.

## Thay đổi

| # | Thay đổi | Vì sao |
|---|---|---|
| 1 | `POST /api/chat` (stream) phát `progress` đầu tiên ngay khi nhận request: `{"type":"progress","stage":"preparing"}` | Client biết server đã nhận, không thấy "đứng hình" trong lúc dựng prompt/RAG |
| 2 | `AnswerStream.progress?` + `ProgressStage` (`src/modules/ai/domain/enums/streamProgress.enums.ts`): `answering` (prompt xong, bắt đầu gọi model) và `agent-tool` + `detail` = tên tool | Một kênh "đang làm gì" độc lập với text; transport tự đặt tên event |
| 3 | Agent stream chữ: `ToolCallingSession.next(..., onDelta?)`, `AgentRunner` truyền `stream` xuống, cả `OpenAIResponsesSession` (`stream: true`, ghép từ `response.completed`) và `ChatCompletionsSession` (ghép `delta.tool_calls` theo `index`) | Agent trả lời đến đâu hiện đến đó thay vì một cục |
| 4 | Agent chạy tool → `progress` `agent-tool`; turn gọi tool mà có nói trước → `reset` để client xoá phần mở đầu (không thuộc câu trả lời) | Người dùng thấy "agent đang chạy search_vault" thay vì im lặng |
| 5 | Agent lỗi → `reset()` trước khi fallback single-shot | Không để chữ của agent dính vào câu trả lời single-shot |
| 6 | Không retry transport ở nhánh agent streaming (chỉ `withTimeout`) | Retry sau khi đã gửi chữ sẽ gửi trùng; fallback single-shot vẫn còn |

## Kiểm thử

- `npm run typecheck` 0 lỗi; `npx vitest run tests/unit` **341 pass** (thêm: runner stream + reset preamble +
  progress tool; `AnswerService` truyền stream và reset khi fallback; chat route phát `progress` và forward
  `agent-tool`).

---

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

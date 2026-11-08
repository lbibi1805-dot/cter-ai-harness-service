# Conversations API + context engineering

Bật bằng `CONVERSATION_STORE_ENABLED=true` (cần `CHAT_API_TOKEN`). Tắt = `/api/chat` chạy như cũ (client gửi `history`).
Thiết kế: `planning/planning-06112026/03-conversation-store.md`, `04-context-engineering.md`, `13 §4`; cập nhật 08/11: `05` (C4 agent flow), `08` (sources), `15` (essay), `17` (Artifact Resolver), `18` (KV cache).

## Lưu ở đâu

| Bảng / prefix | Nội dung |
|---|---|
| `conversations` | `title`, `summary` + `summary_upto_seq` (auto-compact), `state` (`pendingC4`), `deleted_at`, `purge_after` |
| `messages` | `seq`, `role`, `kind` (`chat`/`c4`), `text`, `provider`, `model`, `mode`, `prompt_version` (hash prefix tĩnh thật sự gửi cho model), `ttft_ms`, `latency_ms`, `tokens_in`, `tokens_out`, `sources`; **007**: `resolved_refs` `{ids, source: ui\|rule\|aux\|ambiguous\|none, scores}`, `tokens_cached`; **008**: `intent`, `intent_confidence` |
| `artifacts` | `ordinal` (alias `[A3]`), `kind` (`user_image`, `c4_png`, `c4_puml`, `c4_spec`, `problem_brief`, `design_review`, `design_note`…), `object_key`, `caption`, `ocr_text`, `data_json`; **007**: `label`, `level`, `owner` (`user`/`assistant`), `parent_artifact_id` (chuỗi version), `version` |
| R2 `conversations/<id>/<artifactId>.<ext>` | Ảnh user gửi, PNG/PUML của C4 |

Mỗi turn chat tốn **tối đa 2 round-trip Neon**: 1 query đọc context, 1 transaction ghi (tin nhắn + artifact). Caption/OCR ảnh và auto-compact chạy nền ngay sau đó (DB còn thức).

## `POST /api/chat`

Thêm field `conversationId?` (UUID). Không có → server tạo mới. Có → server **bỏ qua `history`** và tự dựng context.
Kết quả (JSON hoặc event `done`) thêm: `conversationId`, `messageId`, `persisted` (false khi ghi DB lỗi — câu trả lời vẫn trả về).
`404` nếu conversation đã bị xoá mềm. `GET /api/chat/status` có `conversations: true` khi server hỗ trợ.

Body thêm (08/11): `refArtifactIds[]` (chip "↩ Hỏi về cái này" ở client), `mode: "essay"` hoặc câu bắt đầu `/essay [strict] [Nđ]` (Essay Mode).
Kết quả thêm: `sources[{file, heading, score|null}]` (không còn mục `## References` trong text), `timings`
(`ttftMs`, `totalMs`, `attempts[]`, `inputTokens`, `outputTokens`, `cachedTokens`, `retrievalMs`, `llmCalls?`), `artifacts[{id, alias, kind, label, level?}]`, `essay` (chỉ Essay Mode).

Context Assembler dựng prompt theo lớp. Bố cục **v2** (`PROMPT_CACHE_LAYOUT=v2`, mặc định) xếp theo thứ tự gửi ①②④③⑤⑥⑦ để prefix ổn định ăn KV cache của provider:
① system prompt tĩnh (base + citation rules + conversation rules — giống hệt byte giữa mọi hội thoại) → ② summary (turn đầu của history) →
④ các turn chưa tóm tắt → ③ artifact registry (≤ 40 dòng + kind ghim `CONTEXT_PINNED_KINDS`, đặt ở tin cuối) →
⑤ artifact gắn đúng lúc (do Artifact Resolver chọn: `refArtifactIds` > alias `[A3]` > rule chấm điểm > aux; mơ hồ → chèn 2 ứng viên và hỏi lại; "hình bạn vẽ" → `c4_png`; spec C4 cắt theo level được hỏi) →
⑥ RAG (vector + BM25 trong RAM, RRF; query = câu trước + câu hỏi + OCR ảnh; câu follow-up có đại từ được aux viết lại) → ⑦ câu hỏi + ảnh.
Bố cục **v1** (rollback): summary + registry nối vào system prompt như trước. Model được dặn mở đầu "Dựa trên [A7] …" khi dùng artifact.
Câu hỏi chỉ có ảnh: OCR trước (tối đa `AUX_SYNC_TIMEOUT_MS`) để RAG có từ khoá.

**Hot window ảnh** (08/11 chiều, note 18 bước 5): ảnh của `CONTEXT_HOT_WINDOW_TURNS` (2) cặp user/assistant gần nhất nằm **tại chỗ** trong ④ (≤ 3 ảnh/turn),
nên prefix có ảnh vẫn ổn định giữa các turn. PNG C4 trợ lý vẽ được đặt ở đầu turn user kế tiếp sau marker `[Hình [A3] do trợ lý vẽ ở lượt trước]`.
Ảnh đã có trong window không gắn lại ở ⑤. Tổng ảnh mỗi prompt ≤ `CONTEXT_MAX_PROMPT_IMAGES` (16; vượt → bỏ ảnh window cũ nhất). `0` = hành vi cũ.

**PlantUML trong câu trả lời** (08/11 chiều): `@startuml…@enduml` trần được bọc fence ```` ```plantuml ```` (text `done`/đã lưu; delta stream giữ nguyên);
khối PlantUML được lưu thành artifact `c4_puml` của tin trợ lý (version +1 khi turn nói về một thiết kế đã có). Client xem trước bằng `POST /api/c4/render`.

## `POST /api/chat/images` (upload-first, 08/11 chiều)

Auth `CHAT_API_TOKEN`. Body raw `image/*` (1 ảnh) hoặc JSON `{images:[{data, mimeType?}]}` (≤ `MAX_CHAT_IMAGES`, body ≤ `CHAT_MAX_BODY_MB`).
Mime xác định từ magic bytes (PNG/JPEG/GIF/WebP); PNG/JPEG cạnh dài > 2048 px thu về 1568 px. Lưu `tmp/uploads/<imageId>`; metadata **chỉ trong RAM** (0 query Neon).
Trả `{images:[{imageId, mimeType, bytes, width?, height?}]}`; 400 (không phải ảnh / rỗng / quá số ảnh), 413, 503 (không có token hoặc object storage).
`/api/chat` và `/api/c4` nhận `imageIds[]` (tính chung vào `MAX_CHAT_IMAGES`; id lạ/hết hạn → 400). Ảnh đã dùng bị xoá sau khi trả lời xong;
ảnh quá `CHAT_UPLOAD_TTL_MS` (1 giờ) được quét khi có upload mới (≤ 1 lần/phút, không timer); lifecycle R2 `tmp/` 1 ngày dọn phần sót.
Client mới upload trước, gặp server cũ (404/405) thì gửi base64 `images` như cũ.

## `POST /api/c4`, `POST /api/c4/resume`

`/api/c4` nhận thêm `conversationId?` và `images?` (ảnh đề, đưa cho architect). Khi store bật, mỗi lần vẽ thuộc một conversation
(tạo mới nếu không gửi) và trả `conversationId`, `messageId`. Kết quả lưu thành artifact `c4_spec`, `c4_png`, `c4_puml` và một
message tóm tắt các element. Phiên đang chờ trả lời lưu ở `conversations.state.pendingC4` → **restart server vẫn resume được** (trong TTL 15 phút). Từ 08/11 chiều ảnh của request được stage ở `tmp/c4-pending/<sessionId>/<n>.<ext>`, key ghi vào `pendingC4.imageKeys` trong **cùng** lần ghi state (không thêm write Neon); resume nạp lại khi RAM không còn, xoá khi resume/hết hạn.

Từ 08/11 (C4 agent flow): body thêm `images` (≤ 10; `description` tuỳ chọn khi có ảnh), `review`, `intent` (`auto|generate|review|generate_and_review|revise`), `refArtifactIds`.
Intent Router (rule → aux) chọn workflow; Extract tạo `problem_brief`, gap analysis hỏi ≤ 3 câu (event `clarify`), Revise tạo `c4_spec` mới với `parent_artifact_id` + `version+1`,
Review ghi artifact `design_review`. Từ 08/11 chiều body nhận thêm `imageIds[]` (từ `POST /api/chat/images`). Event stream mới: `intent`, `brief`, `clarify`, `review_delta`, `review_done`; `done` thêm `intent`, `brief`, `review`, `artifacts`, `criticNotes` (`confirmation` cũ giữ nguyên).

## Quản lý

Auth: `Authorization: Bearer <CHAT_API_TOKEN>` (client) **hoặc** `Bearer <ADMIN_TOKEN>` (monitoring UI, trang Chats). Purge (`?hard=true`) chỉ nhận `ADMIN_TOKEN`.

| Endpoint | Hành vi |
|---|---|
| `GET /api/conversations?limit=20&deleted=false` | Danh sách (mới nhất trước); `deleted=true` = thùng rác |
| `GET /api/conversations?pending=c4` | Chỉ hội thoại có phiên C4 đang chờ trả lời; mỗi item có `pending[]` |
| `GET /api/conversations/:id` | Messages + artifacts (kèm `url` presigned 10 phút, hoặc link `/artifacts/:artifactId` khi dev không có R2). Thêm `state.pendingC4` (đã lọc); message `resolvedRefs`, `tokensCached`, `intent`, `intentConfidence`; artifact `label`, `level`, `owner`, `parentArtifactId`, `version` |
| `GET /api/conversations/:id/artifacts/:artifactId` | Bytes của artifact |
| `DELETE /api/conversations/:id` | Xoá mềm → `204` (gọi lại vẫn `204`). File R2 giữ lại để khôi phục |
| `POST /api/conversations/:id/restore` | Khôi phục trong `CONVERSATION_PURGE_DAYS` ngày; `404` nếu đã purge |
| `DELETE /api/conversations/:id?hard=true` | Purge ngay. Cần `Authorization: Bearer <ADMIN_TOKEN>` |

Purge tự động: chạy ké sau một turn đã ghi DB, tối đa 1 lần/24 h, tối đa 50 conversation; xoá prefix R2 trước rồi mới xoá row.

## Biến môi trường

`CONVERSATION_STORE_ENABLED` (false), `CONVERSATION_PURGE_DAYS` (30), `CONTEXT_KEEP_RECENT_TURNS` (6),
`CONTEXT_COMPACT_THRESHOLD_TOKENS` (12000), `AUX_PROVIDER` (gemini), `AUX_MODEL` (gemini-3.1-flash-lite), `AUX_SYNC_TIMEOUT_MS` (15000).
Aux model không có key → không caption/OCR/compact (history bị cắt như cũ).
Từ 08/11: `PROMPT_CACHE_LAYOUT` (v2), `ARTIFACT_RESOLVER_MODE` (rules+aux; `off` = hành vi cũ), `ARTIFACT_RESOLVER_MIN_SCORE` (2.5), `ARTIFACT_RESOLVER_MARGIN` (1.0),
`ARTIFACT_RESOLVER_AUX_TIMEOUT_MS` (1500), `CONTEXT_PINNED_KINDS` (c4_spec,problem_brief,design_review,design_note). Migration 007/008 do SchemaGuard tự áp.
Từ 08/11 chiều: `CONTEXT_HOT_WINDOW_TURNS` (2; `0` = rollback), `CONTEXT_MAX_PROMPT_IMAGES` (16), `CHAT_UPLOAD_TTL_MS` (3600000).

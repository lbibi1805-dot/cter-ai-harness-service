# Conversations API + context engineering

Bật bằng `CONVERSATION_STORE_ENABLED=true` (cần `CHAT_API_TOKEN`). Tắt = `/api/chat` chạy như cũ (client gửi `history`).
Thiết kế: `planning/planning-06112026/03-conversation-store.md`, `04-context-engineering.md`, `13 §4`.

## Lưu ở đâu

| Bảng / prefix | Nội dung |
|---|---|
| `conversations` | `title`, `summary` + `summary_upto_seq` (auto-compact), `state` (`pendingC4`), `deleted_at`, `purge_after` |
| `messages` | `seq`, `role`, `kind` (`chat`/`c4`), `text`, `provider`, `model`, `mode`, `prompt_version`, `ttft_ms`, `latency_ms`, `sources` |
| `artifacts` | `ordinal` (alias `[A3]`), `kind` (`user_image`, `c4_png`, `c4_puml`, `c4_spec`…), `object_key`, `caption`, `ocr_text`, `data_json` |
| R2 `conversations/<id>/<artifactId>.<ext>` | Ảnh user gửi, PNG/PUML của C4 |

Mỗi turn chat tốn **tối đa 2 round-trip Neon**: 1 query đọc context, 1 transaction ghi (tin nhắn + artifact). Caption/OCR ảnh và auto-compact chạy nền ngay sau đó (DB còn thức).

## `POST /api/chat`

Thêm field `conversationId?` (UUID). Không có → server tạo mới. Có → server **bỏ qua `history`** và tự dựng context.
Kết quả (JSON hoặc event `done`) thêm: `conversationId`, `messageId`, `persisted` (false khi ghi DB lỗi — câu trả lời vẫn trả về).
`404` nếu conversation đã bị xoá mềm. `GET /api/chat/status` có `conversations: true` khi server hỗ trợ.

Context Assembler dựng prompt theo lớp, tĩnh → động:
① system prompt (cố định, hash = `prompt_version`) → ② summary → ③ artifact registry (≤ 40 dòng) → ④ các turn chưa tóm tắt →
⑤ artifact gắn đúng lúc (ảnh của 2 turn gần nhất hoặc khi câu hỏi nhắc "ảnh/hình/đề/lúc nãy/[A3]…"; spec + PUML C4 khi hỏi về design) →
⑥ RAG (query = câu trước + câu hỏi + OCR ảnh; câu follow-up có đại từ được aux model viết lại) → ⑦ câu hỏi + ảnh.
Câu hỏi chỉ có ảnh: OCR trước (tối đa `AUX_SYNC_TIMEOUT_MS`) để RAG có từ khoá.

## `POST /api/c4`, `POST /api/c4/resume`

`/api/c4` nhận thêm `conversationId?` và `images?` (ảnh đề, đưa cho architect). Khi store bật, mỗi lần vẽ thuộc một conversation
(tạo mới nếu không gửi) và trả `conversationId`, `messageId`. Kết quả lưu thành artifact `c4_spec`, `c4_png`, `c4_puml` và một
message tóm tắt các element. Phiên đang chờ trả lời lưu ở `conversations.state.pendingC4` → **restart server vẫn resume được** (trong TTL 15 phút).

## Quản lý

Auth: `Authorization: Bearer <CHAT_API_TOKEN>` (client) **hoặc** `Bearer <ADMIN_TOKEN>` (monitoring UI, trang Chats). Purge (`?hard=true`) chỉ nhận `ADMIN_TOKEN`.

| Endpoint | Hành vi |
|---|---|
| `GET /api/conversations?limit=20&deleted=false` | Danh sách (mới nhất trước); `deleted=true` = thùng rác |
| `GET /api/conversations/:id` | Messages + artifacts (kèm `url` presigned 10 phút, hoặc link `/artifacts/:artifactId` khi dev không có R2) |
| `GET /api/conversations/:id/artifacts/:artifactId` | Bytes của artifact |
| `DELETE /api/conversations/:id` | Xoá mềm → `204` (gọi lại vẫn `204`). File R2 giữ lại để khôi phục |
| `POST /api/conversations/:id/restore` | Khôi phục trong `CONVERSATION_PURGE_DAYS` ngày; `404` nếu đã purge |
| `DELETE /api/conversations/:id?hard=true` | Purge ngay. Cần `Authorization: Bearer <ADMIN_TOKEN>` |

Purge tự động: chạy ké sau một turn đã ghi DB, tối đa 1 lần/24 h, tối đa 50 conversation; xoá prefix R2 trước rồi mới xoá row.

## Biến môi trường

`CONVERSATION_STORE_ENABLED` (false), `CONVERSATION_PURGE_DAYS` (30), `CONTEXT_KEEP_RECENT_TURNS` (6),
`CONTEXT_COMPACT_THRESHOLD_TOKENS` (12000), `AUX_PROVIDER` (gemini), `AUX_MODEL` (gemini-3.1-flash-lite), `AUX_SYNC_TIMEOUT_MS` (15000).
Aux model không có key → không caption/OCR/compact (history bị cắt như cũ).

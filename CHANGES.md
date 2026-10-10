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

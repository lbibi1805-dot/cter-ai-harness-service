# Bộ câu hỏi test hệ thống Mermaid → PDF

Thư mục này chứa bộ test đánh giá pipeline **output PDF + render Mermaid**
của hệ thống, dựa trên kiến thức trong `documents-vault/` (môn QNX RTOS &
C/C++ concurrency).

## Cách chạy

```bash
npx tsx scripts/run-questions.ts
```

Script đưa từng file trong `test-questions/*.md` qua pipeline
`markdownToPdf` (markdown → HTML → Chromium → PDF), ghi PDF ra
`test-questions-out/*.pdf`, rồi in kết quả `renderLog` từng block.

## Danh sách test

| File | Khối kiến thức | Loại Mermaid test |
|------|----------------|-------------------|
| T01_QNX_Thread_States | Week-02 Concurrent Processes | `stateDiagram-v2` |
| T02_QNX_IPC | Week-02 IPC - QNX | `sequenceDiagram` |
| T03_QNX_Mutex | Week-02 Race Conditions | `graph TD` (flowchart) |
| T04_QNX_ClassDiagram | Week-02 Concurrent Processes | `classDiagram` |
| T05_C_Pointer | C-POINTER | `graph LR` |
| T06_QNX_Terminal | Week-01 Terminal Commands | `graph TD` |
| T07_Mixed_Content | Toàn vault | 4 loại diagram cùng lúc |
| T08_Broken_Mermaid | — | 1 block đúng + 1 block cố tình sai |
| T09_Math_Heavy | — | Chỉ có LaTeX/KaTeX (không Mermaid) |
| T10_GOLDEN | Toàn vault | benchmark: flowchart + sequence + state + class + table + code + math |

## Tiêu chí đánh giá

- **T01–T07, T10:** tất cả block Mermaid trong `renderLog` phải `ok:true`,
  PDF hợp lệ (đầu file `%PDF-`).
- **T08:** kỳ vọng đúng 1 block `ok:true` + 1 block `ok:false` **kèm error**,
  nhưng PDF vẫn được tạo → chứng minh cơ chế **render-log check + fallback**
  hoạt động (block lỗi hiển thị dạng raw-code, pipeline không fail).
- **T09:** chỉ kiểm tra math, vẫn tạo PDF hợp lệ.
# Bộ câu hỏi test Diagram Skills — kiểm tra AI có cross-check `diagram-skills.md` không

Thư mục này chứa **1 file duy nhất** `DIAGRAM_SKILLS_ALL_TEST.md` gộp **10 câu hỏi** adversarial để kiểm tra AI có thực sự đọc và áp dụng `documents-vault/diagram-skills.md` (§1–§4) khi gặp yêu cầu vẽ diagram không. Mỗi câu là 1 trap ký pháp sẽ bị trừ điểm Week-8.

## Cách chạy
```bash
npx tsx scripts/run-questions.ts  # đổi glob sang test-questions-diagram/*.md nếu cần
# hoặc copy DIAGRAM_SKILLS_ALL_TEST.md vào test-questions/ và chạy pipeline markdownToPdf → PDF
```

## Danh sách test trong file gộp (10 Q, phân cách bởi ---)

| Q | § kiểm tra | Trap chính (AI không đọc file sẽ sai) | Mức độ |
|---|-----------|----------------------------------------|--------|
| Q01_DFD_Shape | §1.1 Hình dạng | Data store = chữ nhật **MỞ** (Gane–Sarson) vs source/sink **ĐÓNG** — AI hay vẽ D1 như `["D1"]` đóng | Khó |
| Q02_DFD_Flow_Types | §1.2 Flow | Event `-.->` vs Discrete `--> ` vs Continuous `==>` — AI hay dùng toàn `--> ` | Trung bình |
| Q03_DFD_Balance | §1.1 Balancing | Level-1 phải giữ **hệt 6 entities** như L0, kèm `TRAIN_RED` ở cả hai — AI hay thêm/bớt | Khó |
| Q04_UseCase_Boundary | §2.1 | Actors **NGOÀI** boundary, UC **TRONG**, có sub-boundary Railway Safety | Dễ |
| Q05_IncludeExtend | §2.2 **Nặng nhất** | `<<include>>` **UC4→UC5** (gốc→con) và `<<extend>>` **UC6→UC1** (mở rộng→gốc) — ngược trực giác, 90% AI vẽ ngược nếu không đọc | Rất khó |
| Q06_State_Flowchart | §3 | State = **rounded rect**, start = **chấm đen đặc**, decision = **hình thoi** `{{}}` — AI hay vẽ state như `["Red"]` | Trung bình |
| Q07_COMET_Task | §3.1 **Nặng** | Task = **chữ nhật 2 dòng** `«stereotype»` + `: TênTask`, KHÔNG phải tròn DFD — AI hay vẽ `((T_Light))` | Rất khó |
| Q08_BW_Glyph | §3.2 + §4 | B&W `primaryColor:#FFFFFF`/`#000000` + glyph `δ_l`→`δ<sub>l</sub>` không tofu — AI hay đề xuất màu | Trung bình |
| Q09_Adversarial_Correction | Toàn file | Đưa diagram **SAI sẵn** yêu cầu sửa 5 lỗi + bảng `Lỗi | § | Sửa` — test khả năng **cross-check & tự sửa**, nếu AI khen "đã đúng" → FAIL | Rất khó |
| Q10_Full_Hanoi | Toàn file §1–§4 | Tổng hợp 4 diagram + checklist 8 mục — benchmark cuối | Khó |

## Tiêu chí chấm (cho mỗi câu)

- **PASS** nếu AI:
  1. Có dòng `CROSS-CHECK diagram-skills.md §X` trong reasoning/trả lời
  2. Vẽ đúng ký pháp của § tương ứng (checklist trong file)
  3. Với TD05/TD07/TD09: **không mắc trap ngược/nhầm hình**
- **FAIL** nếu AI:
  - Không nhắc tới `diagram-skills.md` khi vẽ diagram
  - Vẽ Data store đóng, Task tròn, Include ngược, Flow cùng nét
  - Với TD09: copy nguyên diagram sai không sửa

## Shot prompting đã gắn

Đã thêm vào `system-prompt.md` § **DIAGRAM SKILLS — SHOT PROMPTING** với:
- Trigger keywords tự động kích hoạt khi câu hỏi chứa `diagram`, `DFD`, `Use Case`, `COMET`, `mermaid`...
- Bắt buộc đọc `documents-vault/diagram-skills.md` + cross-check table §1–§4
- 4 few-shot đúng/sai + dòng `CROSS-CHECK` bắt buộc in ra

## Gợi ý chấm nhanh

Cho AI trả lời từng file `TD*.md` qua pipeline (Claude/Gemini/Grok), rồi kiểm tra:
- `renderLog` Mermaid `ok:true` (không vỡ syntax)
- Text chứa `CROSS-CHECK` + `§`
- Với TD05: grep `UC4.*include.*UC5` và `UC6.*extend.*UC1` (không phải ngược)
- Với TD07: grep `«.*»<br>: T_` (có 2 dòng)

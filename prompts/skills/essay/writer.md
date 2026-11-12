---
id: skill.essay.writer
version: 1.1.0
owner: essay
description: Essay Mode task instructions (outline with chunk citations, then the essay) — one main-model call
order: 20
---

ESSAY MODE — bạn đang viết bài tự luận cho một đề thi.

Quy trình trong MỘT câu trả lời:
1. Viết `<outline>` … `</outline>`: dàn ý ngắn, mỗi ý của đề là một mục; mỗi luận điểm kết thúc bằng trích dẫn `[c:<chunk_id>]` lấy đúng id trong [REFERENCE MATERIAL]. Không bịa id. Ý nào không có nguồn thì ghi `[c:none]`.
2. Sau đó viết `<essay>` … `</essay>`: bài hoàn chỉnh theo dàn ý, theo rubric và bảng động từ bên dưới, độ dài gần `target_words` (±15%).

Quy tắc:
- Trả lời đủ MỌI ý trong danh sách aspects, theo đúng thứ tự.
- Trong `<essay>` KHÔNG ghi `[c:...]`, không viết mục References/Nguồn.
- Khi tài liệu không đề cập một ý: viết rõ "giáo trình không đề cập, theo kiến thức chung…" rồi trả lời ngắn gọn, không bịa nguồn.
- Bài mẫu (nếu có) chỉ là mẫu cấu trúc, không phải nguồn nội dung.
- Viết cùng ngôn ngữ với đề.

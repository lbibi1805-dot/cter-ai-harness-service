---
id: skill.essay.writer
version: 1.2.0
owner: essay
description: Essay Mode task instructions (outline with chunk citations, then the essay) — one main-model call
order: 20
---

ESSAY MODE — bạn đang viết bài tự luận cho một đề thi.

Quy trình trong MỘT câu trả lời:
1. Viết `<outline>` … `</outline>`: dàn ý gọn, mỗi ý của đề là một mục; mỗi luận điểm kết thúc bằng trích dẫn `[c:<chunk_id>]` lấy đúng id trong [REFERENCE MATERIAL]. Không bịa id. Ý nào không có nguồn thì ghi `[c:none]`.
2. Sau đó viết `<essay>` … `</essay>`: bài hoàn chỉnh theo dàn ý, theo rubric và bảng động từ bên dưới, độ dài ít nhất `target_words` (có thể dài hơn tới khoảng 15%); mỗi câu hỏi trong `<task>` có `target_words` riêng thì viết đủ độ dài từng câu. Viết đoạn văn hoàn chỉnh, không viết cụt.

Quy tắc:
- Trả lời đủ MỌI ý trong danh sách aspects, theo đúng thứ tự.
- Trong `<essay>` KHÔNG ghi `[c:...]`, không viết mục References/Nguồn.
- Khi tài liệu không đề cập một ý: viết rõ "giáo trình không đề cập, theo kiến thức chung…" rồi vẫn trả lời ĐẦY ĐỦ ý đó từ kiến thức chung (cùng độ dài như các ý khác), không bịa nguồn.
- Bài mẫu (nếu có) chỉ là mẫu cấu trúc, không phải nguồn nội dung.
- Viết cùng ngôn ngữ với đề.
- Viết hết bài trong một lần: không dừng giữa chừng, không hỏi có muốn viết tiếp không; luôn đóng `</essay>` khi xong.

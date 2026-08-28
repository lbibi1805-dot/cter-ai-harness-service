# START_T09_Math_Heavy_gemini.md

## Câu hỏi
Tổng hợp các công thức toán học xuất hiện trong vault (QNX/C concurrency).

## Yêu cầu output
Ít nhất 5 công thức, mỗi công thức dùng 1 kiểu cú pháp LaTeX khác nhau:

1. Inline: Biến chia sẻ $counter$ tăng lên sau 100000 lần lặp của 2 luồng.
2. Display: $$T_{total} = \max(t_1, t_2)$$
3. Phân số: $$\frac{n(n+1)}{2}$$
4. Tổng: $$\sum_{k=1}^{n} k$$
5. Ghi chú dùng `\text{}`: $\text{deadlock} \neq \text{priority inversion}$

## Để kiểm tra trong output PDF
- [ ] Cả 5 công thức render đúng dạng toán học (KaTeX).
- [ ] `\text{}` trong công thức render thành chữ thường (upright), không bị coi là biến in nghiêng.
- [ ] `\max`, `\sum`, `\frac` hiển thị đúng.

## Đáp án mẫu (để test pipeline)
1. Inline: Biến chia sẻ $counter$ tăng lên sau 100000 lần lặp của 2 luồng.
2. Display: $$T_{total} = \max(t_1, t_2)$$
3. Phân số: $$\frac{n(n+1)}{2}$$
4. Tổng: $$\sum_{k=1}^{n} k$$
5. Ghi chú: $\text{deadlock} \neq \text{priority inversion}$

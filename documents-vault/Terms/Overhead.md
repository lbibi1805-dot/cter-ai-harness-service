Trong Khoa học Máy tính và Kỹ thuật Phần mềm, **Overhead** (chi phí phát sinh / độ trễ hệ thống) là sự tiêu tốn thêm các tài nguyên (như thời gian xử lý của CPU, dung lượng bộ nhớ, hoặc băng thông mạng) để hệ thống thực hiện các công việc **quản lý và điều phối**, thay vì thực thi trực tiếp logic chính của ứng dụng.

Để dễ hình dung nhất, hãy xét Overhead trong bối cảnh bài học của bạn (Hệ điều hành và Hệ thống thời gian thực):

### Overhead trong bối cảnh "Task Switching" (Chuyển đổi Task)

Khi bạn có quá nhiều task chạy song song, CPU không thể xử lý tất cả cùng một lúc. Nó phải luân phiên chạy từng task một theo cơ chế chia sẻ thời gian (Time slicing). Quá trình chuyển đổi từ task này sang task khác được gọi là **Context Switch**.

Mỗi lần thực hiện Context Switch, hệ điều hành phải làm các việc sau:

1. Dừng task hiện tại.
    
2. Lưu lại toàn bộ trạng thái, biến số, và dữ liệu của task hiện tại vào bộ nhớ.
    
3. Tìm xem task nào tiếp theo được ưu tiên chạy.
    
4. Lấy dữ liệu của task tiếp theo từ bộ nhớ và nạp vào CPU.
    
5. Khởi động task tiếp theo.
    

Tất cả 5 bước trên **không hề tạo ra bất kỳ giá trị nào cho chức năng của app**, nó chỉ là công việc "bếp núc" của hệ điều hành. Khoảng thời gian CPU và bộ nhớ bị lãng phí cho 5 bước này chính là **Overhead**.

Việc chuyển đổi task quá mức (excessive task switching) sẽ dẫn đến execution overhead (chi phí thực thi) rất cao cho hệ thống. Nếu overhead quá lớn, CPU sẽ dành phần lớn thời gian chỉ để "chuyển qua chuyển lại" giữa các task thay vì thực sự chạy code của bạn, dẫn đến hệ thống bị giật lag hoặc trễ deadline.

### Ví dụ thực tế cho dễ nhớ

Hãy tưởng tượng bạn là một thợ mộc (CPU) và bạn đang đóng 10 cái bàn (10 tasks).

- **Không có overhead:** Bạn đóng xong cái bàn thứ 1, cất dụng cụ đi, rồi lấy gỗ ra đóng cái bàn thứ 2.
    
- **Có overhead:** Cứ đóng được 1 nhát búa cho bàn số 1, bạn lại phải cất búa đi, chạy sang kho lấy đinh gõ 1 nhát cho bàn số 2, rồi lại cất đinh đi, chạy lại bàn số 3 cầm cưa lên... Thời gian bạn đi lại, cất và lấy dụng cụ chính là **Overhead**. Bạn làm việc rất mệt mỏi nhưng tiến độ thực tế (làm xong cái bàn) lại rất chậm.
    

Đó chính là lý do vì sao ở các kỹ thuật trước, chúng ta phải dùng **Task Clustering** và **Task Inversion** để gom các task lại với nhau, nhằm giảm thiểu tối đa lượng **Overhead** này.
### Telnet Connection là gì?

Trong quá trình phát triển phần mềm, đặc biệt là khi thiết kế kiến trúc hệ thống hoặc triển khai các ứng dụng backend lên server, bạn hiếm khi cắm màn hình trực tiếp vào máy chủ để thao tác. Thay vào đó, bạn phải điều khiển nó từ xa.

**Telnet** (Teletype Network) đơn giản là một giao thức mạng cho phép bạn ngồi ở máy tính này (máy Host - ví dụ: Ubuntu) để truy cập và điều khiển màn hình dòng lệnh (Terminal) của một máy tính khác (máy Target - ví dụ: máy ảo QNX) thông qua mạng IP.

- **Bản chất:** Nó giống như bạn đang mở một kết nối xuyên suốt, gõ lệnh trên bàn phím máy mình nhưng lệnh đó lại được chuyển sang thực thi và trả kết quả ở hệ điều hành của máy ảo QNX.
    
- **So sánh:** Nếu bạn từng làm việc với các máy chủ từ xa, Telnet rất giống với **SSH** (Secure Shell). Điểm khác biệt là Telnet ra đời từ rất lâu, dữ liệu truyền đi dưới dạng plain-text (không mã hóa) nên kém bảo mật hơn, nhưng lại cực kỳ nhẹ và phù hợp để test trong môi trường Lab nội bộ.
    

### Cách thực hiện kết nối Telnet cho Task 1A

Để "remote" vào máy ảo QNX bằng Telnet, bạn thực hiện các bước sau:

1. **Xác định "tọa độ" (IP):** Đây chính là lý do lúc nãy đề bài bắt bạn gõ lệnh `ifconfig` trên máy ảo QNX. Bạn cần lấy được địa chỉ IP của `VM_x86_Target01` (ví dụ: `192.168.x.x`).
    
2. **Mở kết nối:** Trên máy đang chạy Momentics (máy Host), bạn mở một cửa sổ Terminal mới (không phải màn hình của VM nhé).
    
3. **Gõ lệnh kết nối:** Nhập cú pháp sau và ấn Enter: `telnet <địa_chỉ_IP_của_máy_QNX>`
    
4. **Đăng nhập:** Màn hình sẽ yêu cầu thông tin đăng nhập. Trong các bài Lab QNX chuẩn, user thường là `root` và không có password (chỉ cần ấn Enter).
    

Sau khi vào thành công, bạn dùng lệnh `cd /tmp` (hoặc thư mục chứa file thực thi mà Momentics vừa build ra) và gọi chạy chương trình để lấy kết quả chụp màn hình.
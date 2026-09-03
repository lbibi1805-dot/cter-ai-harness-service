Đây là giai đoạn **bóc tách hệ thống** dựa trên 3 tiêu chí đầu tiên của Gomaa 
### 1. Tiêu chí 1: Cấu trúc Task I/O (I/O Task Structuring Criteria - Slide 5)
Việc phân bổ task cho các thiết bị I/O phụ thuộc vào 2 yếu tố chính: 
**Đặc tính phần cứng** và **Bản chất của dữ liệu**.

Dưới đây là bảng tổng hợp chi tiết cho **Tiêu chí Cấu trúc Task I/O**:

|**Tiêu chí phân loại**|**Dạng Task / Dữ liệu**|**Đặc điểm & Cách xử lý Task**|
|---|---|---|
|**Hình thức cơ bản**|**Mặc định**|Hình thức đơn giản nhất: Cấp phát hẳn 1 task riêng cho mỗi thiết bị I/O.|
|**Theo Đặc tính Phần cứng I/O**|**Asynchronous**<br><br>  <br><br>_(Bất đồng bộ / Điều khiển bằng ngắt)_|Thông thường không có lựa chọn nào khác ngoài việc phải tạo 1 task riêng cho mỗi thiết bị.|
||**Passive**<br><br>  <br><br>_(Thụ động)_|- Áp dụng cho đầu vào lấy mẫu (polled inputs) hoặc đầu ra định kỳ.<br><br>  <br><br>- Task chạy định kỳ kiểm tra đầu vào, hoặc chạy theo yêu cầu (điều khiển bằng State machine).<br><br>  <br><br>- **Khả năng tối ưu:** Có tiềm năng nhóm (group) lại nếu thời gian (timing) khớp nhau.|
||**Communications link**<br><br>  <br><br>_(Đường truyền truyền thông)_|Liên quan đến các giao thức mạng (Ví dụ: TCP/IP).|
||**Periodic I/O tasks**<br><br>  <br><br>_(Task I/O định kỳ)_|- **Dùng external timer:** Thường gặp vấn đề về biến động tần số (frequency jitter).<br><br>  <br><br>- **Dùng ADC:** Thường tích hợp sẵn bộ định thời nội bộ riêng (internal timer).|
|**Theo Bản chất Dữ liệu**|**Discrete**<br><br>  <br><br>_(Rời rạc)_|Dữ liệu thuộc dạng Boolean hoặc có một số lượng giá trị hữu hạn.|
||**Continuous**<br><br>  <br><br>_(Liên tục)_|Dữ liệu thuộc dạng tương tự (Analog).

### 2. Tiêu chí 2: Cấu trúc Task Nội bộ (Internal Task Structuring Criteria - Slide 6)

Phân loại các task chạy bên trong hệ thống thành 4 dạng chính:

|**Loại Internal Task**|**Cơ chế kích hoạt & Mục đích sử dụng**|**Đặc điểm & Chi tiết kỹ thuật**|
|---|---|---|
|**Periodic internal tasks**|Kích hoạt bởi một bộ định thời nội bộ (internal timer) trong CPU để thực hiện các chức năng định kỳ.|Trong QNX, sử dụng QNX periodic timer (dưới dạng periodic signal pulse, thread, message receive, v.v.).|
|**Asynchronous internal tasks**|Kích hoạt bởi các sự kiện nội bộ (internal events), các tin nhắn (messages) hoặc xung (pulses).|Chạy không theo chu kỳ cố định mà dựa trên sự kiện phát sinh.|
|**Control task**|Thực thi một sơ đồ trạng thái (state chart) hoặc phổ biến hơn là một máy trạng thái (state machine).|Đóng vai trò làm bộ điều khiển trung tâm cho luồng xử lý.|
|**User Role task**|Xử lý các thao tác I/O của người dùng (bàn phím và màn hình hiển thị).|Tương tự như việc gọi các hàm `scanf()` hoặc `gets()`. Đối với đầu vào Terminal, nếu có nhiều cửa sổ terminal thì sẽ cần các task riêng biệt để xử lý (có thể là 1 task cho mỗi terminal/màn hình/cửa sổ).|

### 3. Tiêu chí 3: Mức độ ưu tiên của Task (Task Priority Criteria - Slide 7)

Dưới đây là bảng tổng hợp cho **Tiêu chí Mức độ ưu tiên của Task**:

|**Loại Task**|**Mức độ ưu tiên**|**Đặc điểm & Quy tắc xử lý**|
|---|---|---|
|**Time Critical Tasks**<br><br>  <br><br>_(Nhiệm vụ cấp bách về thời gian)_|**Cao (High priority)**|- Mang các ràng buộc thời gian nghiêm ngặt (Hard deadlines).<br><br>  <br><br>- Thường phải được tổ chức thành các task riêng biệt (separate tasks).<br><br>  <br><br>- **Quy tắc an toàn:** Không an toàn nếu kết hợp (combine) các task này với các task kém quan trọng hơn.|
|**Non-time critical & Computationally intensive tasks**<br><br>  <br><br>_(Nhiệm vụ không cấp bách & Nặng về tính toán)_|**Thấp (Low priority)**|- **Mục tiêu:** Đảm bảo các task này không chiếm dụng CPU, tránh gây ra tình trạng "bỏ đói" (starvation) cho các task cấp bách quan trọng.|
        
- **Cách xử lý các Task nặng tính toán trong Hệ thống Thời gian thực:**
    
    - Thông thường, hệ thống RT không chứa các task nặng về tính toán. Nhưng nếu có, giải pháp tốt nhất là sử dụng **phần cứng chuyên dụng (Dedicated hardware)** để xử lý, ví dụ: các IC chuyên xử lý MP3/DiVx, hoặc vi xử lý render hình ảnh 3D / xử lý dữ liệu.
        
    - Nếu không có phần cứng chuyên dụng, bắt buộc phải chạy chúng ở mức ưu tiên thấp và phải có khả năng bị ngắt/chiếm quyền (preemptable) dưới dạng một hệ thống chấp nhận mất mát dữ liệu (lossy system).
### 1. "Priority 15" nghĩa là gì? Có liên quan đến 3 threads không?

**Mức ưu tiên (Priority)** và **Số lượng luồng (Threads)** là hai khái niệm hoàn toàn khác nhau:

- **Số lượng luồng (Ví dụ: 3 threads):** Là số lượng các "công nhân" đang làm việc đồng thời trong chương trình của bạn (ví dụ: Main thread, Thread 1, Thread 2).
    
- **Mức ưu tiên (Priority - ví dụ: 15):** Là **độ quan trọng** của luồng đó. Trong hệ điều hành QNX, mức ưu tiên được thể hiện bằng các con số (thường từ 1 đến 255). Số càng lớn, luồng càng được ưu tiên sử dụng CPU.
    

Mặc định, luồng chính (Main thread) có priority là 10. Khi bạn set priority cho Thread 1 là **15**, bạn đang nói với hệ điều hành rằng: _"Hãy ưu tiên cho Thread 1 chạy trước, vì độ quan trọng của nó (15) cao hơn luồng chính (10)"_. Nó không liên quan gì đến việc bạn có bao nhiêu luồng trong chương trình.

### 2. Giải thích tường minh về `PTHREAD_EXPLICIT_SCHED`

Khi bạn tạo một luồng con từ luồng chính, luồng con cần biết nó sẽ chạy với mức ưu tiên và chính sách nào. Hàm `pthread_attr_setinheritsched` dùng để quyết định **nguồn gốc** của các thuộc tính đó. Có 2 lựa chọn (parameters) chính:

1. `PTHREAD_INHERIT_SCHED` (Kế thừa): Luồng con sẽ copy y hệt các cài đặt (như priority 10) từ luồng cha. Mọi cấu hình bạn vừa vất vả setup trong biến `attr` sẽ bị **bỏ qua hoàn toàn**.
    
2. `PTHREAD_EXPLICIT_SCHED` (Tường minh): Luồng con sẽ **không quan tâm** luồng cha đang chạy thế nào. Nó sẽ chỉ sử dụng các thuộc tính mà bạn đã "chỉ định rõ ràng" (tường minh) trong biến `attr` (ví dụ: priority 15, chính sách Round Robin).
    

**Tóm lại:** Lệnh `pthread_attr_setinheritsched(&th1_attr, PTHREAD_EXPLICIT_SCHED);` giống như việc bạn nói với hệ thống: _"Đừng lấy thông số mặc định của luồng cha nữa, hãy áp dụng chính xác những cài đặt tôi vừa viết cho luồng này."_

### 3. Tổng hợp các bước thiết lập Priority và Code Snippet

Dưới đây là bảng tổng hợp các bước theo đúng trình tự để thiết lập priority cho một luồng:

|**Bước**|**Mục đích**|**Code Snippet**|
|---|---|---|
|**1**|**Khai báo biến:** Tạo các biến để lưu trữ thuộc tính luồng và thông số lập lịch.|`pthread_attr_t attr;`<br><br>  <br><br>`struct sched_param param;`|
|**2**|**Khởi tạo thuộc tính:** Đưa biến thuộc tính về trạng thái mặc định ban đầu.|`pthread_attr_init(&attr);`|
|**3**|**Ngắt kế thừa (Tường minh):** Yêu cầu luồng sử dụng cài đặt mới thay vì copy từ luồng cha.|`pthread_attr_setinheritsched(&attr, PTHREAD_EXPLICIT_SCHED);`|
|**4**|**Chọn chính sách (Policy):** Quyết định cách luồng chia sẻ thời gian CPU (ví dụ: Round Robin).|`pthread_attr_setschedpolicy(&attr, SCHED_RR);`|
|**5**|**Gán mức ưu tiên:** Thiết lập giá trị con số ưu tiên (VD: 15) vào biến thông số.|`param.sched_priority = 15;`|
|**6**|**Áp dụng thông số:** Gắn biến thông số (`param`) vào biến thuộc tính (`attr`).|`pthread_attr_setschedparam(&attr, &param);`|
|**7**|**Tạo luồng:** Chạy luồng mới cùng với bộ thuộc tính vừa thiết lập xong.|`pthread_create(&thread_id, &attr, thread_func, NULL);`|

### 4. Tổng hợp các Parameter (Chính sách lập lịch - Scheduling Policies)

Khi dùng hàm `pthread_attr_setschedpolicy`, tham số thứ 2 chính là chính sách lập lịch. Dưới đây là các loại phổ biến trong POSIX/QNX:

| **Type (Parameter)** | **Tên gọi**                                      | **Cách hoạt động (Giải thích)**                                                                                                                                                                    |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SCHED_RR`           | **Round Robin** (Luân chuyển)                    | Các luồng có **cùng mức ưu tiên** sẽ thay phiên nhau chạy theo từng khoảng thời gian (time-slice/quantum). Hết giờ của người này sẽ đến người kia.                                                 |
| `SCHED_FIFO`         | **First In First Out** (Đến trước phục vụ trước) | Luồng sẽ chiếm dụng CPU và chạy liên tục cho đến khi nó tự kết thúc, tự block (như gọi hàm `sleep`), hoặc bị một luồng có mức ưu tiên **cao hơn** chen ngang. Không có chia sẻ thời gian đều nhau. |
| `SCHED_SPORADIC`     | **Sporadic** (Không thường xuyên)                | (Đặc trưng của QNX) Dùng cho các luồng thỉnh thoảng mới cần chạy nhưng khi chạy thì cần ưu tiên cao, giúp bảo vệ CPU không bị luồng này chiếm dụng 100% thời gian.                                 |
| `SCHED_OTHER`        | **Mặc định**                                     | Phụ thuộc vào hệ điều hành. Thường tương đương với `SCHED_RR` trong các hệ thống QNX hiện đại.                                                                                                     |
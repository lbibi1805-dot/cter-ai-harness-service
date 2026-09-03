### 1. So sánh hai trạng thái của luồng

|**Loại luồng (Thread type)**|**Cơ chế hoạt động (What happens)**|**Khi nào nên dùng (When to use)**|
|---|---|---|
|**Joinable** (Mặc định)|Một luồng khác có thể chờ luồng này thực thi xong bằng cách gọi hàm `pthread_join()`. **Lưu ý:** Tài nguyên hệ thống của luồng chỉ được thu hồi _sau khi_ nó được join.|Khi bạn cần lấy kết quả trả về từ luồng đó, hoặc cần hệ thống tắt/đóng các luồng theo một trình tự kiểm soát chặt chẽ.|
|**Detached**|Không thể dùng `pthread_join()` để chờ. Tài nguyên của luồng sẽ được hệ thống **tự động giải phóng** ngay khi nó thực thi xong.|Các tác vụ "fire-and-forget" (giao việc rồi thôi), chạy ngầm ở chế độ nền và không cần trả về kết quả cho luồng chính.|

### 2. Cách tạo luồng Detached (Đoạn mã C)

Bình thường `pthread_create` sẽ tạo luồng Joinable. Để tạo một luồng Detached ngay từ đầu, bạn cần làm theo các bước trong đoạn mã trên slide:

1. Khởi tạo biến thuộc tính luồng: `pthread_attr_init(&attr);`
    
2. Thiết lập thuộc tính tách rời: `pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);`
    
3. Tạo luồng với thuộc tính vừa thiết lập: `pthread_create(NULL, &attr, worker, NULL);`
    
### 3. Các lưu ý quan trọng (Context QNX)

Phần bên phải của slide nhấn mạnh 3 điểm mấu chốt bạn cần nhớ khi lập trình:

- **Giá trị mặc định:** Trong các tài liệu và ví dụ của QNX, các luồng sinh ra luôn là **Joinable** theo mặc định.
    
- **Điều kiện sống còn:** Chỉ nên sử dụng luồng Detached khi tiến trình mẹ (Process) sẽ sống đủ lâu để luồng Detached làm xong việc. Nếu tiến trình mẹ kết thúc (hàm `main` return hoặc gọi `exit()`), tất cả các luồng bên trong (kể cả Detached) đều bị ép buộc dừng ngay lập tức.
    
- **Bản chất "Tách rời":** Detached **không** có nghĩa luồng đó tách ra thành một tiến trình (Process) độc lập. Nó vẫn nằm trong tiến trình cũ, có cùng Process ID và vẫn chia sẻ chung không gian bộ nhớ (shared address space) với các luồng khác.
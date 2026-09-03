### 1. Mục đích sử dụng

Thay vì dùng các hàm `pthread_mutex_*` để bảo vệ Critical Section (vùng găng), bạn sẽ dùng Semaphore. Trong ngữ cảnh Mutual Exclusion, bạn sẽ sử dụng **Binary Semaphore** (Semaphore có giá trị khởi tạo là 1).

### 2. Phạm vi hoạt động (Scope)
Đề bài chỉ định rõ là dùng **unnamed semaphores** (semaphore không tên). Trong QNX, loại này chỉ có thể đồng bộ hóa giữa các luồng (threads) **bên trong cùng một tiến trình (process)**.

### 3. Vòng đời của một Semaphore (4 hàm cơ bản)
Bạn bắt buộc phải khai báo thư viện `#include <semaphore.h>` và sử dụng tuần tự 4 hàm sau:

- **`sem_init()`**: Khởi tạo cấu trúc semaphore. Để thay thế mutex, bạn cần khởi tạo giá trị ban đầu là `1`.
    
- **`sem_wait()`**: Tương đương với hành động `lock()`. Khi một thread gọi hàm này, nếu giá trị semaphore $> 0$, nó sẽ trừ đi 1 và cho phép thread đi tiếp. Nếu giá trị $= 0$, thread sẽ bị chặn (block) và phải đứng chờ.
    
- **`sem_post()`**: Tương đương với hành động `unlock()`. Nó cộng thêm 1 vào giá trị của semaphore và đánh thức các thread đang bị block ở `sem_wait()` (nếu có).
    
- **`sem_destroy()`**: Hủy semaphore và giải phóng tài nguyên hệ thống sau khi tất cả các thread đã chạy xong.

```mermaid
graph TD
    Start(("Bắt đầu")) --> Init["<b>sem_init()</b><br/>Khởi tạo giá trị Semaphore = 1"]
    
    Init --> Request("Thread cần truy cập tài nguyên")
    Request --> Wait["<b>sem_wait()</b>"]
    
    Wait --> Check{"Giá trị > 0?"}
    
    Check -- "Không (Giá trị = 0)" --> Block["<b>Block</b><br/>Thread bị chặn và đứng chờ"]
    Check -- "Có" --> Dec["Trừ giá trị đi 1<br/>Cho phép đi tiếp"]
    
    Dec --> CS["<b>Critical Section</b><br/>Thực thi mã độc quyền"]
    
    CS --> Post["<b>sem_post()</b><br/>Cộng giá trị lên 1"]
    
    Post -. "Đánh thức (nếu có thread đang đợi)" .-> Block
    Block -. "Thử lấy lại quyền" .-> Wait
    
    Post --> CheckEnd{"Tất cả thread<br/>đã hoàn thành?"}
    
    CheckEnd -- "Chưa" --> Request
    CheckEnd -- "Rồi" --> Destroy["<b>sem_destroy()</b><br/>Hủy Semaphore, giải phóng bộ nhớ"]
    
    Destroy --> End(("Kết thúc"))
    
    %% Styling
    classDef init_destroy fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px;
    classDef wait_block fill:#ffebee,stroke:#f44336,stroke-width:2px;
    classDef post_cs fill:#e8f5e9,stroke:#4caf50,stroke-width:2px;
    classDef condition fill:#fff3e0,stroke:#ff9800,stroke-width:2px;
    
    class Init,Destroy init_destroy;
    class Wait,Block wait_block;
    class CS,Post,Dec post_cs;
    class Check,CheckEnd condition;
```

### Khung code cơ bản (Skeleton)
C

```
#include <stdio.h>
#include <pthread.h>
#include <semaphore.h>

// 1. Khai báo biến semaphore toàn cục
sem_t my_sem; 

void* thread_function(void* arg) {
    // 2. Chờ lấy quyền truy cập (Lock)
    sem_wait(&my_sem); 

    // --- BẮT ĐẦU CRITICAL SECTION ---
    // Chỉ 1 thread được chạy đoạn code này tại 1 thời điểm
    // --- KẾT THÚC CRITICAL SECTION ---

    // 3. Trả lại quyền truy cập (Unlock)
    sem_post(&my_sem); 

    return NULL;
}

int main() {
    // 4. Khởi tạo: tham số thứ 2 là pshared (0 = chia sẻ giữa các threads), tham số thứ 3 là giá trị khởi tạo (1)
    sem_init(&my_sem, 0, 1);

    // ... (Khởi tạo và chạy các pthreads tại đây) ...

    // 5. Hủy semaphore
    sem_destroy(&my_sem); 
    
    return 0;
}
```

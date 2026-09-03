
### 1. Bản chất của vấn đề: Chia sẻ bộ nhớ

- **Lý thuyết:** Các luồng (threads) trong cùng một tiến trình (process) chạy rất nhanh và giao tiếp hiệu quả vì chúng chia sẻ chung một không gian bộ nhớ.
    
- **Mặt trái:** Chính sự chia sẻ này là "con dao hai lưỡi". Nếu nhiều luồng cùng cố gắng thay đổi một dữ liệu dùng chung cùng một lúc mà không có cơ chế kiểm soát, dữ liệu đó sẽ bị hỏng.
### 2. Các khái niệm cốt lõi

- **Shared variable (Biến chia sẻ):** Là các dữ liệu mà nhiều luồng có thể truy cập, thường là các biến toàn cục (global variables) hoặc các đối tượng được cấp phát động (heap objects). Trong ảnh, biến `counter` là một biến chia sẻ.
    
- **Critical section (Vùng găng):** Là đoạn mã (code) thực hiện việc truy cập hoặc chỉnh sửa các biến chia sẻ này. Để đảm bảo an toàn, hệ thống phải đảm bảo **chỉ có một luồng** được thực thi đoạn mã này tại một thời điểm.
    
- **Race condition (Điều kiện tương tranh):** Đây là lỗi xảy ra khi kết quả cuối cùng của chương trình phụ thuộc vào thứ tự xen kẽ ngẫu nhiên (unpredictable interleaving) của các luồng.
    
    - _Ví dụ trong ảnh:_ Lệnh `counter++` trông có vẻ như là một thao tác duy nhất, nhưng thực tế CPU xử lý nó qua 3 bước:
        
        1. Đọc giá trị hiện tại (`tmp = counter;`)
            
        2. Tăng giá trị lên 1 (`tmp = tmp + 1;`)
            
        3. Ghi đè lại giá trị mới (`counter = tmp;`)
            
    - Nếu Luồng A và Luồng B cùng đọc `counter` lúc nó bằng 0, cả hai sẽ cùng tự tính ra kết quả là 1 và cùng ghi số 1 vào `counter`. Đáng lẽ biến phải tăng lên 2, nhưng cuối cùng lại chỉ là 1. Đây là một Race condition điển hình.
![[Pasted image 20260712171854.png]]
### 3. Giải pháp: Mutex (Mutual Exclusion Lock)

- Để giải quyết Race condition, người ta dùng **Mutex** (khóa loại trừ lẫn nhau). Mutex hoạt động như một ổ khóa bảo vệ Critical section: chỉ luồng nào cầm được chìa khóa mới được vào thao tác với dữ liệu, các luồng khác phải đứng ngoài chờ (block/sleep) cho đến khi luồng kia thao tác xong và trả lại khóa.
    
- **Áp dụng thực tế:** QNX tuân thủ chuẩn POSIX (Portable Operating System Interface), do đó các hàm API được sử dụng y hệt như trong ảnh:
    
    - `pthread_mutex_lock(&lock);` : Xin khóa trước khi vào vùng găng.
        
    - Thực hiện thao tác (`counter++;`).
        
    - `pthread_mutex_unlock(&lock);` : Trả khóa sau khi thao tác xong.
        

### 💡 Bối cảnh trong Hệ thống thời gian thực (QNX RTOS)

Khi bạn học khái niệm này để áp dụng cho QNX, có một vài điểm nâng cao cần lưu ý:

1. **Tính xác định (Determinism):** QNX được thiết kế để đảm bảo mọi thứ diễn ra đúng thời hạn (hard real-time). Race conditions phá vỡ hoàn toàn tính xác định này, gây ra những lỗi ngẫu nhiên, thoắt ẩn thoắt hiện (heisenbugs) rất nguy hiểm cho các hệ thống nhúng quan trọng (như phanh ô tô hay thiết bị y tế).
    
2. **Đảo ngược độ ưu tiên (Priority Inversion):** Khi sử dụng Mutex trong QNX, bạn sẽ phải đối mặt với bài toán: _Điều gì xảy ra nếu một luồng ưu tiên thấp đang giữ Mutex, còn một luồng ưu tiên cao lại đang phải chờ Mutex đó?_ Trong QNX, vấn đề này thường được giải quyết bằng các cơ chế tích hợp sẵn trong kernel như **Priority Inheritance** (Kế thừa độ ưu tiên) cho các pthreads mutex.

Dưới đây là một đoạn mã C hoàn chỉnh sử dụng thư viện `pthread` (POSIX Threads). Vì QNX là một hệ điều hành tuân thủ chặt chẽ tiêu chuẩn POSIX, đoạn mã này là **chuẩn mực** để bạn biên dịch và chạy trực tiếp trên hệ thống QNX.

Chương trình dưới đây mô phỏng 2 luồng cùng cộng dồn vào một biến toàn cục `shared_counter`, và sử dụng Mutex để bảo vệ biến này khỏi lỗi Race Condition.

C

```
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>

// 1. Khai báo biến chia sẻ (Shared Data)
int shared_counter = 0;

// 2. Khai báo Mutex
// Khởi tạo tĩnh: pthread_mutex_t my_mutex = PTHREAD_MUTEX_INITIALIZER; 
// Ở ví dụ này, chúng ta sẽ dùng khởi tạo động trong hàm main để thấy rõ vòng đời.
pthread_mutex_t my_mutex;

// Hàm thực thi của các luồng
void* thread_function(void* arg) {
    int thread_id = *(int*)arg;

    // Mỗi luồng sẽ đếm lên 100,000 lần
    for (int i = 0; i < 100000; i++) {
        
        // --- Bắt đầu Vùng găng (Critical Section) ---
        
        // 3. KHÓA MUTEX: Xin quyền truy cập. 
        // Nếu luồng khác đang giữ khóa, luồng này sẽ bị block (sleep) và chờ ở đây.
        pthread_mutex_lock(&my_mutex);
        
        // Đoạn code nhạy cảm dễ sinh Race Condition
        shared_counter++; 
        
        // 4. MỞ KHÓA MUTEX: Trả lại quyền truy cập cho luồng khác.
        pthread_mutex_unlock(&my_mutex);
        
        // --- Kết thúc Vùng găng ---
    }
    
    printf("Luồng %d đã đếm xong.\n", thread_id);
    return NULL;
}

int main() {
    pthread_t thread1, thread2;
    int id1 = 1, id2 = 2;

    // 5. KHỞI TẠO MUTEX (Bắt buộc trước khi sử dụng)
    // Tham số thứ 2 là pthread_mutexattr_t (thuộc tính của mutex). NULL nghĩa là dùng mặc định.
    if (pthread_mutex_init(&my_mutex, NULL) != 0) {
        printf("Lỗi: Không thể khởi tạo mutex.\n");
        return 1;
    }

    // Tạo 2 luồng, cùng trỏ tới hàm thread_function
    pthread_create(&thread1, NULL, thread_function, &id1);
    pthread_create(&thread2, NULL, thread_function, &id2);

    // Chờ 2 luồng thực thi xong thì main mới chạy tiếp
    pthread_join(thread1, NULL);
    pthread_join(thread2, NULL);

    // 6. HỦY MUTEX: Giải phóng tài nguyên hệ thống sau khi không dùng nữa
    pthread_mutex_destroy(&my_mutex);

    // In kết quả
    // Do có Mutex bảo vệ, kết quả CHẮC CHẮN sẽ luôn là 200,000.
    // Nếu bạn comment lại dòng lock và unlock, kết quả sẽ bị sai lệch ngẫu nhiên.
    printf("Giá trị cuối cùng của shared_counter: %d\n", shared_counter);

    return 0;
}
```

### 💡 Vòng đời của Mutex chuẩn chỉnh:

Để dùng Mutex an toàn và không bị rò rỉ bộ nhớ (memory leak), bạn luôn cần nhớ quy trình 4 bước này:

1. **Khai báo & Khởi tạo:** Dùng `pthread_mutex_init()` (khởi tạo động) hoặc `PTHREAD_MUTEX_INITIALIZER` (khởi tạo tĩnh cho biến toàn cục).
    
2. **Khóa (Lock):** Dùng `pthread_mutex_lock()`. Bước này đặt ngay sát trước khi thao tác với biến dùng chung.
    
3. **Mở khóa (Unlock):** Dùng `pthread_mutex_unlock()`. Bước này đặt ngay sát sau khi thao tác xong. _Đừng quên mở khóa, nếu không chương trình sẽ bị treo vĩnh viễn (Deadlock)._
    
4. **Hủy (Destroy):** Dùng `pthread_mutex_destroy()`. Khi chương trình chuẩn bị kết thúc và chắc chắn không còn luồng nào dùng đến Mutex này nữa, phải gọi hàm này để trả lại tài nguyên cho OS (đặc biệt quan trọng trong QNX vì tài nguyên hệ thống nhúng thường eo hẹp).
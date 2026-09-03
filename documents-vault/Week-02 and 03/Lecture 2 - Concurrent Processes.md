
### **1. Processes and Tasks**
![[NotebookLM Mind Map (9).png]]
#### **1.1. Tổng quan:**
**LƯU Ý:** *Thuật ngữ "Process" (Tiến trình) và "Task" (Tác vụ) thường được sử dụng thay thế cho nhau trong tài liệu này.*
##### **a. Process là gì?**
- Process được định nghĩa là *"Một chương trình đang được thực thi"*, bao gồm một chuỗi các mã lệnh đang chạy.
- Process bao gồm mã chương trình nằm trong bộ nhớ cùng với các hoạt động hiện tại như:
	- Giá trị của Bộ đếm chương trình (PC) và các thanh ghi.
	- Nội dung của stack và heap, cùng các file đang được mở.
- LƯU Ý:
	- Bản thân một Process là một Thread, nhưng nó cũng có thể chứa nhiều Thread khác bên trong nó.
	- Khi một Process chứa nhiều hơn một Thread, nó được gọi là có mã thực thi đồng thời (concurrently executing code).
	- Các Process KHÔNG chia sẻ không gian địa chỉ (address space) với nhau.
	- Ưu điểm của việc chia nhỏ thành nhiều Process riêng biệt bao gồm: Tăng tính tách biệt (decoupling) và tính mô-đun hóa, cải thiện khả năng bảo trì và nâng cao độ tin cậy.
	
![[Pasted image 20260706080744.png]]

##### **b. Threads là gì?**
![[NotebookLM Mind Map (10).png]]
- Threads (còn được gọi là tiến trình nhẹ - lightweight processes) chia sẻ mã nguồn và dữ liệu toàn cục (global data) với Process cha của chúng.
- Dù chia sẻ tài nguyên với Process cha, mỗi Thread vẫn có các giá trị thanh ghi, stack và dữ liệu riêng tư của chính nó (đảm bảo duy trì phạm vi biến - scope).
- Các Threads nằm trong cùng một Process thì chia sẻ mọi thứ trong không gian địa chỉ của Process đó.
- Khi chia sẻ mã hoặc tài nguyên giữa các thread, hệ thống yêu cầu phải có cơ chế bảo vệ biến (Variable Protection) và tuyệt đối không được sử dụng các biến không được bảo vệ.

Những đặc điểm lặp lại và song song giữa Process và Thread được tổng hợp trong bảng sau:

| **Đặc điểm**          | **Process (Tiến trình)**                                                                 | **Thread (Luồng)**                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Không gian bộ nhớ** | Không chia sẻ không gian địa chỉ với process khác (có rào cản bảo vệ bộ nhớ riêng biệt). | Chia sẻ mã nguồn, dữ liệu toàn cục và toàn bộ không gian địa chỉ của Process cha.                     |
| **Tài nguyên riêng**  | Hoạt động độc lập.                                                                       | Vẫn có các giá trị thanh ghi (register) và ngăn xếp (stack) của riêng nó.                             |
| **Ưu điểm / Lưu ý**   | Việc chia ra nhiều Process giúp tăng tính mô-đun, dễ bảo trì và tăng độ tin cậy.         | Cần phải có biện pháp bảo vệ các biến dùng chung (Variable Protection) để chia sẻ tài nguyên an toàn. |
#### **1.2. Các trạng thái (States) của Proceses/Threads:**
Mặc dù hệ điều hành QNX có tới 21 trạng thái luồng khác nhau, vòng đời cơ bản được tóm gọn qua 4 trạng thái thiết yếu:

|**Trạng thái**|**Mô tả chi tiết**|
|---|---|
|**Running (Đang chạy)**|Đang chủ động thực thi trên CPU. (Lưu ý: Nếu hệ thống chỉ có CPU đơn lõi thì chỉ có duy nhất 1 process ở trạng thái này tại một thời điểm).|
|**Ready (Sẵn sàng)**|Không chạy trên CPU nhưng đã sẵn sàng để chạy nếu CPU rảnh rỗi.|
|**Blocked (Bị chặn)**|Đang chờ một sự kiện xảy ra (ví dụ: chờ hoàn thành I/O, chờ tín hiệu, chờ luồng khác hoàn tất...). Ở trạng thái này, luồng hoàn toàn không tiêu tốn thời gian của CPU.|
|**Stopped/Dead (Dừng/Chết)**|Tiến trình đã bị đình chỉ hoặc đã chết (hệ thống kernel đang chờ để giải phóng tài nguyên).|

### **2. OS Management**
![[NotebookLM Mind Map (11).png]]
#### **2.1. PCB - Process Control Block - "Định danh"/"CCCD" của một Process (Tiến Trình)**
Để quản lý các tiến trình (và các luồng bên trong), bộ lập lịch (scheduler/kernel) cần lưu giữ một hồ sơ thông tin cho mọi tiến trình đang thực thi. Hồ sơ này chính là PCB. Hệ điều hành dùng PCB để kiểm soát trạng thái của các tiến trình đang hoạt động.

Một PCB thường chứa các thông tin quan trọng sau:
- **Current State:** Trạng thái hiện tại của tiến trình.
    
- **Process ID:** Mã định danh duy nhất.
    
- **Program Counter & CPU Registers:** Bộ đếm chương trình và các giá trị thanh ghi CPU (như con trỏ ngăn xếp - Stack Pointer) để biết tiến trình đang chạy tới đâu.
    
- **CPU Scheduling Info:** Thông tin lập lịch (ví dụ: mức độ ưu tiên của tiến trình).
    
- **Memory Management:** Cấu hình bộ nhớ (giá trị thanh ghi giới hạn hoặc con trỏ bảng phân trang).
    
- **Accounting & I/O Status:** Lịch sử tiêu thụ CPU, các file đang mở và thiết bị I/O đang sử dụng.


![[Pasted image 20260706082013.png]]


![[Pasted image 20260706082028.png]]

Dựa trên thông tin từ PCB, hệ điều hành sẽ luân chuyển các **Process** qua lại giữa 3 trạng thái cốt lõi:

- **Ready $\rightarrow$ Running:** Chuyển đổi thông qua thao tác cấp phát (Dispatch).
    
- **Running $\rightarrow$ Ready:** Xảy ra khi hết thời gian cho phép (Timer_run_out).
    
- **Running $\rightarrow$ Blocked:** Xảy ra khi tiến trình phải chờ một sự kiện (Block).
    
- **Blocked $\rightarrow$ Ready:** Khi sự kiện chờ đợi đã hoàn tất (Wakeup).

#### 2.2. QNX Kernel States 
- Điểm đặc biệt của hệ điều hành thời gian thực QNX là quản lý trạng thái rất chi tiết (có sẵn trong file `<sys/neutrino.h>`).
- **Lưu ý quan trọng:** *Khi một luồng ở trạng thái bị chặn (Blocked), nó hoàn toàn không tiêu thụ thời gian của CPU.*

- *? **Tại sao ở trên nói Process có 4 trạng thái mà ở đây sang Kernel lại có 21 trạng thái ?*** 
	- Giám đốc (hoặc lý thuyết hệ điều hành nói chung) chỉ cần nhìn bức tranh tổng thể. Một nhân viên (Process) đối với giám đốc chỉ nằm ở 4 trạng thái. ***Đây là khái niệm dùng chung cho mọi hệ điều hành trên thế giới (Windows, Linux, macOS...).***
	- **Kernel** là "Nhân" của hệ điều hành - phần lõi cốt lõi nhất trực tiếp điều khiển phần cứng và phân bổ tài nguyên. Đối với Kernel, việc biết một tiến trình đang "Blocked" (bị kẹt) là chưa đủ. Kernel cần phải biết **chính xác nó đang đợi cái gì** để khi cái đó xuất hiện, Kernel có thể đánh thức nó ngay lập tức một cách tối ưu nhất. Vì vậy, trong hệ điều hành QNX, Kernel đã "chẻ nhỏ" 4 trạng thái cơ bản kia ra thành 21 trạng thái chi tiết. Sự khác biệt lớn nhất nằm ở việc bóc tách trạng thái **Blocked**.

Dưới đây là bảng tổng hợp 21 trạng thái cụ thể của luồng trong QNX:

|**Trạng thái**|**Ý nghĩa (Luồng đang...)**|
|---|---|
|**RUNNING**|Đang tích cực chạy trên một CPU.|
|**READY**|Sẵn sàng chạy nhưng đang nhường chỗ cho luồng có mức ưu tiên cao hơn hoặc bằng.|
|**DEAD**|Đã chết. Kernel đang chờ để giải phóng tài nguyên của luồng.|
|**STOPPED**|Bị đình chỉ (nhận tín hiệu SIGSTOP).|
|**NANOSLEEP**|Đang ngủ (sleep) trong một khoảng thời gian nhất định.|
|**INTR**|Đang chờ một ngắt (interrupt) phần cứng.|
|**JOIN / WAITTHREAD**|Đang chờ một luồng khác hoàn thành (Join) / Chờ một luồng được tạo.|
|**MUTEX / SEM / CONDVAR**|Chờ để lấy Mutex / Chờ lấy Semaphore / Chờ biến điều kiện (Condition Variable) được báo hiệu.|
|**RECEIVE / REPLY / SEND**|Chờ Client gửi tin nhắn / Chờ Server phản hồi tin nhắn / Chờ Server nhận tin nhắn.|
|**NET_REPLY / NET_SEND**|Chờ phản hồi qua mạng / Chờ gửi xung (pulse) hoặc tin nhắn qua mạng.|
|**SIGSUSPEND / SIGWAITINFO**|Đang chờ một tín hiệu (Signal).|
|**STACK / WAITPAGE / WAITCTX**|Chờ cấp phát thêm stack / Chờ process manager giải quyết lỗi trang nhớ / Chờ thanh ghi ngữ cảnh (chỉ trên hệ SMP).|
### 3. Concurrent Behaviour
Phần này giải thích nguyên lý cốt lõi về cách các tác vụ chạy cùng lúc.

| **Góc nhìn**                               | **Hiện tượng / Bản chất**                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Ảo giác đồng thời**                      | Khi nhìn từ bên ngoài, tất cả các tác vụ (tasks/threads) dường như bắt đầu và chạy song song cùng một lúc. |
| **Sự thật phũ phàng** _(trên CPU lõi đơn)_ | Tại một thời điểm chính xác (micro-giây), chỉ có duy nhất 1 tác vụ được thực thi.                          |
**? Tại sao lại nhìn như chạy song song ?** -> CPU chia thời gian thành các lát cắt rất nhỏ 
(time-slicing). Nó chạy Task 1 một chút, tạm dừng, chuyển sang Task 2 một chút, rồi Task 3... Quá trình chuyển đổi (context switch) diễn ra quá nhanh khiến mắt người dùng tưởng chúng chạy song song.

***Nguyên tắc sống còn (Golden Rule): Khi lập trình đồng thời, không bao giờ được giả định về tốc độ chạy của các tiến trình hay khi nào thì sự chuyển đổi tiến trình sẽ xảy ra. Bạn không thể đoán trước Task A sẽ chạy xong trước Task B.***

###### **Ví dụ ta có đoạn code sau đây:**
![[Pasted image 20260706092832.png]]
Nó gọi một hàm tên là `Myfunction`, ép kiểu con trỏ để lấy giá trị, và bắt hệ thống ngủ (`sleep`). Dù máy tính của bạn có CPU 4 lõi hay 8 lõi, không có gì chạy song song ở đây cả.

**Trực quan hóa Dòng thời gian chạy:** Để trả lời câu hỏi cuối slide _"Tổng thời gian chạy là bao lâu?"_, chúng ta nhìn vào bảng sau:

| **Thời điểm**               | **Đang chạy ở đâu?**       | **Hành động**                              | **Hậu quả**                                                                            |
| --------------------------- | -------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Giây 0 $\rightarrow$ 5**  | Bên trong hàm `Myfunction` | Lệnh `sleep(a)` với `a = 5`.               | Toàn bộ chương trình bị "đóng băng" đứng chờ 5 giây. Hàm `main` không được nhúc nhích. |
| **Giây thứ 5**              | Quay lại hàm `main`        | `Myfunction` in ra "Finished" và kết thúc. | Hàm `main` mới được phép lấy lại quyền điều khiển.                                     |
| **Giây 5 $\rightarrow$ 11** | Bên trong hàm `main`       | Lệnh `sleep(6)` được gọi.                  | Chương trình lại tiếp tục đóng băng thêm 6 giây.                                       |
| **Giây thứ 11**             | Kết thúc                   | In ra "Main terminated".                   | **Tổng thời gian: 11 giây.**                                                           |
$\rightarrow$ **Kết luận:** Nếu không dùng Thread, một tác vụ bị "kẹt" (như lệnh sleep) sẽ kéo theo cả chương trình bị treo cứng.
#### **3.1. Resource Polling**
- **Ranh giới của Process:** Các tiến trình (Processes) tuyệt đối **không chia sẻ** không gian địa chỉ với nhau.
    
- **Sự chia sẻ của Thread:** Các luồng (Threads) nằm trong cùng một Process sẽ **chia sẻ tất cả mọi thứ** trong không gian địa chỉ của Process đó.
    
- **Sự riêng tư của Thread:** Mặc dù xài chung tài nguyên, mỗi Thread vẫn giữ được dữ liệu riêng (giữ nguyên phạm vi hoạt động - scope) và sở hữu một **ngăn xếp (stack) của riêng nó**.
    
- **Điều kiện bắt buộc (Variable Protection):** Để chia sẻ code hoặc tài nguyên một cách an toàn giữa các Thread, hệ thống yêu cầu phải có biện pháp **Bảo vệ biến (Variable Protection)**.
    
- **Điều cấm kỵ (Quy tắc vàng):** Các đoạn code dùng chung tuyệt đối **không được phép** chia sẻ hoặc sử dụng các biến chưa được bảo vệ.

![[Pasted image 20260706090141.png]]
#### **3.2. Concurrent Behaviour within a Single Process (Đồng thời trong 1 tiến trình)**
Phần này mô tả việc "Chia để trị" trong một chương trình .
Thay vì viết một chương trình chạy tuần tự từ trên xuống dưới (đợi nhập phím xong mới xử lý dữ liệu, xử lý xong mới hiển thị), ta tách nó ra làm các Luồng (Thread) chạy đồng thời:
- **Main Thread:** Chỉ làm nhiệm vụ khởi tạo hệ thống (System_Init) và sau đó ngồi chờ (Block) các luồng khác hoàn thành (Join) .
    
- **Key Scan Thread:** Một luồng riêng chỉ chuyên vòng lặp kiểm tra xem người dùng có bấm phím hay không .
    
- **Data Thread:** Một luồng riêng chuyên xử lý và hiển thị dữ liệu . * **Lợi ích:** Trong lúc chương trình đang bận xử lý dữ liệu nặng, hệ thống vẫn nhận được tín hiệu bấm phím của bạn (vì nó nằm ở 2 luồng đang chạy "đồng thời").
![[Pasted image 20260706084734.png]]

***? Khi thiết kế chương trình, vậy tại sao không nhét hàng tỷ Thread vào chung 1 Process cho tiện, sinh ra nhiều Process làm gì ?***
- **Thread thì chia sẻ tất cả:** Nếu 1 Thread bị lỗi (ví dụ: tràn bộ nhớ), nó có thể kéo sập toàn bộ Process.
- **Process có "Rào cản bảo vệ bộ nhớ" (Memory protection barrier):** Các Process không chung chạ bộ nhớ với nhau .
- **Kết luận của slide:** Đừng gom tất cả vào 1 Process. Hãy chia ra nhiều Process để tăng tính độc lập (Decoupling), dễ bảo trì (Maintainability) và tăng độ tin cậy (Reliability - process này chết thì process kia vẫn sống) .
![[Pasted image 20260706085142.png]]
![[Pasted image 20260706085158.png]]

Demo bằng Code: Sự khác biệt giữa "Chết chùm" và "Sống độc lập"
- **Kịch bản 1:** Dùng chung 1 Process, đẻ nhiều Thread $\rightarrow$ Lỗi 1 thằng, sập cả làng (Mất Reliability)
	Giả sử bạn có 1 hệ thống, Thread A làm nhiệm vụ quan trọng (thu thập dữ liệu cảm biến), Thread B chỉ là tính năng phụ. Vì chung một Address Space, nếu Thread B nghịch dại gây ra lỗi tràn bộ nhớ (Segmentation Fault), Hệ điều hành sẽ **giết toàn bộ Process**.
Giả sử bạn có 1 hệ thống, Thread A làm nhiệm vụ quan trọng (thu thập dữ liệu cảm biến), Thread B chỉ là tính năng phụ. Vì chung một Address Space, nếu Thread B nghịch dại gây ra lỗi tràn bộ nhớ (Segmentation Fault), Hệ điều hành sẽ **giết toàn bộ Process**.

C

```
#include <stdio.h>
#include <pthread.h>
#include <unistd.h>

// Thread A làm việc rất chăm chỉ và an toàn
void* thread_A(void* arg) {
    while(1) {
        printf("Thread A: Vẫn đang thu thập dữ liệu an toàn...\n");
        sleep(1);
    }
}

// Thread B code ẩu, gây lỗi bộ nhớ
void* thread_B(void* arg) {
    sleep(3);
    printf("Thread B: Chuẩn bị chọc vào vùng nhớ cấm đây!\n");
    int *con_tro_ngu = NULL;
    *con_tro_ngu = 404; // BÙM! LỖI SEGMENTATION FAULT!
}

int main() {
    pthread_t t1, t2;
    pthread_create(&t1, NULL, thread_A, NULL);
    pthread_create(&t2, NULL, thread_B, NULL);
    
    pthread_join(t1, NULL); 
    // Kết quả: Sau 3 giây, Thread B lỗi con trỏ. 
    // Hệ điều hành kill toàn bộ chương trình. Thread A đang chạy ngon cũng CHẾT OAN!
    return 0;
}
```

- **Kịch bản 2: C**hia thành 2 Process độc lập $\rightarrow$ Anh nào làm anh nấy chịu (Tăng Reliability)
Giờ ta tách tính năng B ra hẳn một chương trình (Process) riêng. Bức tường bảo vệ (Memory protection barrier) xuất hiện.

**Code của Process A (Chạy file `process_A.exe`):**

C

```
int main() {
    while(1) {
        printf("Process A: Thu thập dữ liệu tẹt ga, chả sợ thằng nào làm liên lụy!\n");
        sleep(1);
    }
    return 0;
}
```

**Code của Process B (Chạy file `process_B.exe`):**

C

```
int main() {
    sleep(3);
    int *con_tro_ngu = NULL;
    *con_tro_ngu = 404; // LỖI SEGMENTATION FAULT!
    return 0;
}
```

**Kết quả:** Sau 3 giây, Process B báo lỗi và bị hệ điều hành dọn rác. Nhưng Process A **vẫn chạy phà phà** không rớt một nhịp nào! Bức tường thép đã phát huy tác dụng.

### 4. Concurrency Types
![[NotebookLM Mind Map (12).png]]
**Hệ quy chiếu 1: Dựa trên Phần cứng (Physical Execution)**

| **Loại**                                 | **Mô tả**                                                                                                                                                  | **Nhận diện**                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Quasi-concurrent** (Giả đồng thời)     | Giống như trình bày ở phần 1. Các tác vụ thay phiên nhau chạy trên **1 nhân CPU (Single Core)** .                                                          | Time slicing (chia sẻ thời gian). |
| **Truly Concurrent** (Đồng thời thực sự) | Nhiều tác vụ chạy song song cùng 1 thời điểm vật lý vì có **Nhiều nhân CPU (Multiple CPUs/Cores)** hoặc chạy trên nhiều máy tính khác nhau (distributed) . | Xử lý song song đích thực.        |
**Hệ quy chiếu 2: Dựa trên cách các tác vụ tương tác với nhau**

|**Loại**|**Mô tả**|**Ví dụ thực tế**|
|---|---|---|
|**Asynchronous** (Bất đồng bộ)|Các tiến trình làm việc độc lập, thỉnh thoảng mới cần nói chuyện/đồng bộ với nhau (Loosely coupled) .|Ứng dụng Server - Client, Webserver, Hệ điều hành . (Mỗi người dùng vào web là 1 tiến trình độc lập).|
|**Synchronous** (Đồng bộ)|Các tiến trình phụ thuộc chặt chẽ vào nhau, bước đi cùng nhịp, dữ liệu của thằng này là đầu vào của thằng kia ngay lập tức (Tightly coupled) .|Tính toán đồ họa GPU, tính toán mô phỏng vật lý (CFD).|
### 5. Coding (Thread Life-cycle Management)
#### **5.1. Các hàm/API lấy thông tin Process and Threads**
Khi hệ thống có hàng chục luồng chạy ngầm, bạn không thể debug bằng mắt thường. Giống như khi làm việc với các framework backend phức tạp như Spring Boot, nếu log file không ghi rõ Thread ID nào đang xử lý Request nào, việc truy vết lỗi (tracing) khi hệ thống crash là bất khả thi. Slide này cung cấp các API gốc ở tầng hệ điều hành (OS level) để bạn lấy thông tin định danh đó.
**Bảng tổng hợp các API định danh cốt lõi:**

|**Hàm API (C)**|**Ý nghĩa (Lấy thông tin gì?)**|**Ví dụ trả về**|
|---|---|---|
|`gethostname()`|Lấy tên của máy chủ/thiết bị đang chạy code .|"user-PC" hoặc "ubuntu-server"|
|`getpid()`|**Process ID:** Lấy ID của Tiến trình hiện tại .|`1045` (ID của cả căn nhà)|
|`gettid()`|**Thread ID:** Lấy ID của Luồng hiện tại .|`1`, `2`... (ID của từng người trong nhà)|
|`getppid()`|**Parent Process ID:** Lấy ID của Tiến trình Cha (kẻ đã sinh ra tiến trình này) .|`800` (ID của terminal hoặc OS)|
|`getprio()`|**Priority:** Lấy mức độ ưu tiên của tiến trình (Dùng trong lập lịch thời gian thực) .|`10`|
***Ví dụ code snippet:***
**Trực quan hóa đoạn code trong slide:** Đoạn code chỉ đơn giản là gọi 4 hàm trên và in ra màn hình (`printf`) . Mục đích là để bạn "điểm danh" xem đoạn code hiện tại đang được thực thi dưới danh nghĩa của ai, trước khi chính thức áp dụng `pthread_create()` ở slide tiếp theo để tách nhánh luồng chạy.
![[Pasted image 20260706093257.png]]

#### **5.2. Multi-Thread Process Example (Quy trình đa luồng)**
###### **a. Sử dụng Threads trong một Process (Using Threads within a Process)**
- Ở đây đoạn code này muốn nói rằng:
	- **Process (Tiến trình):** Là cái **Container** (cái thùng chứa). Nó chứa mã chương trình, dữ liệu, bộ nhớ, tài nguyên (file, socket). Process chính là đơn vị quản lý tài nguyên của hệ điều hành. Còn **Thread (Luồng):** Là **Đơn vị thực thi (Execution Unit)** nằm bên trong cái thùng đó.
	- Hàm main() là một thread chính. Main Thread tuyệt đối KHÔNG phải là Process. Main Thread là **thành phần** của Process.
	*(Một Process bắt buộc phải có **ít nhất một luồng** (chính là cái Main Thread đó) thì mới chạy được. Nếu không có luồng nào, Process đó coi như "chết" (không có gì để thực thi cả).)*
	
- Trong hệ điều hành như QNX (hay Linux), khi bạn tạo ra một chương trình, hệ thống luôn khởi tạo một **Process** (tiến trình) để chứa chương trình đó. Bất kỳ luồng (thread) nào được tạo ra bên trong chương trình này (dù là luồng chính `main` hay các luồng phụ được đẻ ra sau đó) đều được coi là nằm **bên trong** (thuộc về) cái Process đó.
	- Chúng cùng chia sẻ **Code** (phần mã nguồn bạn viết).
    
	- Chúng cùng chia sẻ **Dữ liệu toàn cục** (global data) của cái Process đó.
    
	- Đó là lý do tại sao người ta gọi luồng là "các tiến trình nhẹ" (lightweight processes).

![[Pasted image 20260706180500.png]]

#### **b. Multi-thread process example (học về khời tạo threads, etc.)**
- **Điểm then chốt:** Thay vì gọi hàm `thread_ex` trực tiếp (như kiểu tuần tự ở slide trước), bạn dùng `pthread_create()`. pthread_create() là thread chứa đơn vị thực thi là hàm *thread_ex().
- **Sự khác biệt:** Khi `pthread_create()` được gọi, hệ điều hành sẽ tạo ra một luồng (Thread) mới. Luồng này chạy **song song** với luồng `main`.
- Mình sẽ gọi tạm như sau:
	- **Luồng chính (Main Thread) - THREAD A :** Thực hiện lệnh `pthread_create`, sau đó nó `sleep(6)` và in ra "Main terminated" .
	- **Luồng phụ (Thread B):** Bắt đầu từ hàm `thread_ex`, nó `sleep(5)` và in ra "Thread Finished".
- **Điều thú vị ở đây là:**
	- Cả hai luồng cùng "ngủ" (sleep) **cùng một lúc**.
	- Thay vì tổng thời gian chạy là 11 giây như ở slide 13 (5s + 6s), thì với chương trình này, **tổng thời gian chương trình chạy chỉ khoảng 6 giây** (bằng thời gian của luồng ngủ lâu nhất).
![[Pasted image 20260706181033.png]]

**Cơ chế cốt lõi:**

- Sử dụng hàm **`pthread_create()`** để khởi tạo một luồng mới.
    
- Luồng mới sẽ chạy một hàm được chỉ định (gọi là _thread routine_), hàm này được truyền dưới dạng tham số con trỏ cho `pthread_create()`.

| **Tham số**     | **Kiểu dữ liệu**        | **Ý nghĩa**                        | **Bạn truyền cái gì vào?**                                               |
| --------------- | ----------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `thread`        | `pthread_t*`            | Con trỏ tới ID của luồng           | Một địa chỉ của biến kiểu `pthread_t` để OS ghi ID vào đó.               |
| `attr`          | `const pthread_attr_t*` | Bản thiết kế (thuộc tính)          | `NULL` (nếu dùng mặc định) hoặc `&my_attr` (bản thiết kế riêng).         |
| `start_routine` | `void* (*)(void*)`      | Địa chỉ của hàm (Function Pointer) | Tên hàm của bạn (hàm này phải nhận 1 tham số `void*` và trả về `void*`). |
| `arg`           | `void*`                 | Túi đồ nghề                        | Địa chỉ của biến hoặc `struct` dữ liệu bạn muốn truyền vào hàm kia.      |


---


#### **5.3. Joining Threads và Return Value trong hàm của Threads**

_Tại sao lại cần Return Value?"_. Hãy tưởng tượng thế này: Bạn là `main` (Sếp), bạn thuê `th1` (Nhân viên) đi tính toán một bài toán khó. Nếu bạn chỉ gọi `pthread_create` rồi mặc kệ nó, bạn làm sao biết nó tính ra kết quả bao nhiêu? Bạn cần một "hộp kết quả" để nhân viên bỏ đáp án vào đó khi làm xong. Đó chính là `return value`.

Ở trong slide, hàm xử lý Thread B  có trả về value 512
###### *Phân tích đoạn code trong slide*

- **Khai báo "Hộp chứa":** `void *retval;` – Đây là biến sẽ chứa địa chỉ kết quả trả về từ luồng con.
    
-  **Chờ đợi:** `pthread_join(th1, &retval);`
    
    - Nếu `th1` chưa xong: `main` ngủ tại chỗ.
        
    - Khi `th1` xong: Kết quả `152` được copy vào `retval`.
        
- **Sử dụng kết quả:** `printf("Thread returned %i\n", retval);` – Lúc này `main` đã cầm được "đáp án" từ nhân viên để sử dụng tiếp.


![[Pasted image 20260706191219.png]]

![[Pasted image 20260706191211.png]]

##### **a. Giải thích về pthread_join()**

- **Vai trò 1 (Đồng bộ - Synchronization):** Nó bắt luồng gọi (ở đây là `main`) phải **dừng lại (block)** và chờ cho đến khi luồng con (`th1`) thực sự kết thúc. Nó đảm bảo `main` không kết thúc chương trình quá sớm trước khi luồng con kịp làm việc xong.
    
- **Vai trò 2 (Thu hồi - Resource Management):** Khi luồng con kết thúc, nó không tự xóa sạch mọi dấu vết ngay. `pthread_join` giúp dọn dẹp các tài nguyên (như stack, trạng thái luồng) mà luồng con đã dùng. Nếu bạn tạo luồng mà không bao giờ `join` (hoặc `detach`), bạn sẽ bị rò rỉ tài nguyên hệ thống .
___
Hãy tưởng tượng bạn là **Sếp (Main Thread)** và bạn thuê một **Nhân viên (Thread B)** làm một việc gì đó.
- **Nếu không có `join`:** Sếp giao việc xong, Sếp đi chơi (Main kết thúc chương trình) hoặc đi làm việc khác. Nếu Sếp về nhà trước khi nhân viên làm xong, chương trình sẽ bị "cắt ngang" và nhân viên đó bị "đuổi việc" bất đắc dĩ .
- C**ó `join`:** Sếp đứng chờ tại cửa công ty.
	
	- Khi nhân viên làm xong, họ "gõ cửa" và nộp kết quả.
	    
	- Sếp nhận kết quả đó xong mới đóng cửa công ty (kết thúc chương trình).
	    
	- `join` vừa là lệnh **"Đợi đến khi xong mới được đi tiếp"** , vừa là lệnh **"Thu dọn rác"** (giải phóng tài nguyên hệ thống mà nhân viên đó đã dùng) .
_____
Hình ảnh bạn thấy (có 2 biểu đồ thời gian) là cách giảng viên minh họa **"Hành vi của các luồng khi gặp nhau"** :
- **Hình trên (thời gian chạy song song - `main` không bị block):** Minh họa trường hợp `main` và `thread_ex` cùng chạy. Nếu bạn không gọi `pthread_join`, luồng `main` sẽ chạy đến `return EXIT_SUCCESS` và kết thúc chương trình ngay lập tức. Nếu luồng con chưa xong, nó sẽ bị "giết" oan uổng.
    
- **Hình dưới (cách `pthread_join` kiểm soát thời gian):** Minh họa sự tương tác giữa luồng cha và luồng con. Khi gọi `pthread_join`, `main` (đường đỏ) sẽ dừng lại (ngừng chạy) để đợi nhân viên (đường xanh) hoàn thành công việc. Sau khi nhân viên xong, đường đỏ mới tiếp tục chạy.
    

**Tóm lại:** Hình này nằm trong slide `join` để minh họa rằng `pthread_join` chính là "chiếc van điều tiết" cho phép bạn đồng bộ hóa thời gian giữa 2 luồng.

(Ở trong THREAD A (MAIN) chính, nếu thread main gọi)

![[Pasted image 20260706193003.png]]
**b. Parameters của pthread_join**
Nó có đúng 2 tham số chính:

C

```
int pthread_join(pthread_t thread, void** value_ptr);
```

- Tham số 1: `pthread_t thread`

	- **Ý nghĩa:** Đây là **"Số định danh nhân viên"** (Thread ID).
	    
	- **Tại sao cần:** Để Sếp biết chính xác mình đang đợi "nhân viên nào". Bạn phải truyền cái biến `th1` (ID) mà bạn nhận được từ lúc tạo luồng (`pthread_create`) vào đây .
    

-  Tham số 2: `void value_ptr`

	- **Ý nghĩa:** Đây là **"Địa chỉ cái hộp để đựng kết quả trả về"**.
	    
	- Tại sao nó là `void` (con trỏ của con trỏ)?
	    
	    - Luồng con sẽ trả về một con trỏ `void*` (kết quả).
	        
	    - Sếp muốn cất cái kết quả đó vào biến `retval` (của Sếp).
	        
	    - Vì vậy, Sếp phải truyền **địa chỉ** của biến `retval` (`&retval`) vào hàm `join`. Hệ điều hành sẽ nhét kết quả vào đúng địa chỉ đó cho Sếp.

**Mẹo nhớ:** Nếu bạn không cần kết quả từ luồng con, bạn chỉ việc truyền `NULL` vào tham số thứ hai:

C

```
pthread_join(th1, NULL); // "Tôi đợi ông làm xong, nhưng tôi không cần đáp án."
```

**c. giải thích về returning values**
Trong C/C++, vì luồng chạy độc lập, nó không thể dùng lệnh `return` thông thường để báo kết quả về cho `main`. Do đó, POSIX cung cấp cơ chế:

- **Luồng con:** Khi kết thúc, nó trả về một con trỏ (`void *`). Bạn có thể ép kiểu giá trị cần trả về thành con trỏ (ví dụ: `return (void*)152;`).
    
- **Luồng cha:** Trong hàm `pthread_join`, bạn truyền vào tham số thứ hai là **địa chỉ của một con trỏ** (`&retval`). Hệ điều hành sẽ tự động "bốc" cái giá trị `void*` mà luồng con trả về, bỏ vào biến `retval` cho bạn .
____


___ 

#### **5.4. Joining threads in a timely fashion - Did I miss any deadline?**
Ở phần  trước, bạn đã học `pthread_join()`. Nó có một nhược điểm chí mạng trong Real-time: **Nó block (chặn) vĩnh viễn**. Nếu luồng con bị treo, bị kẹt, hoặc chạy quá lâu, luồng cha (`main`) sẽ bị kẹt theo và toàn bộ chương trình sẽ "đơ".

`pthread_timedjoin` sinh ra để khắc phục điều đó:

- **Tính an toàn:** Giúp hệ thống không bao giờ bị treo cứng.
    
- **Tính thời gian thực:** Đảm bảo hệ thống luôn phản hồi trong một khoảng thời gian xác định (deterministic).

![[Pasted image 20260706200541.png]]

Giải thích đoạn code mẫu trên:
Trong lập trình C, thời gian không phải là một con số đơn giản, nó là một cấu trúc dữ liệu để đảm bảo độ chính xác tới từng nano giây .

- `tv_sec`: Lưu số giây.
    
- `tv_nsec`: Lưu số nano giây (1 giây = 1,000,000,000 nano giây).
(Lưu ý không cần code lại đoạn struct này)

Đoạn code này giải quyết bài toán: **"Sếp không thể đợi nhân viên mãi mãi"**.

Hãy nhìn vào luồng logic của nó:

1. **Lấy thời gian hiện tại:** `clock_gettime(CLOCK_REALTIME, &t_deadline);`.
    
2. **Đặt deadline:** `t_deadline.tv_sec += 5;` -> Sếp nói: "Tôi cho ông đúng 5 giây để làm xong, quá 5 giây là tôi không đợi nữa".
    
3. **Hẹn giờ đợi:** `pthread_timedjoin(th1, NULL, &t_deadline);` .
    
    - Nếu luồng con (`th1`) xong trước 5 giây: `retcode` trả về `EOK` (thành công) .
        
    - Nếu quá 5 giây mà luồng con vẫn chưa xong: Hàm này sẽ "bật dậy" ngay lập tức, trả về lỗi `ETIMEDOUT` (quá giờ) để Sếp (`main`) biết mà xử lý thay vì cứ đứng đó chờ chết .
Tổng kết parameters của time joins
Hàm này được dùng để đợi một luồng kết thúc, nhưng với giới hạn thời gian cụ thể (deadline). Nếu quá thời hạn mà luồng vẫn chưa xong, hàm sẽ trả về mã lỗi thay vì đợi mãi mãi.

C

```
int pthread_timedjoin(pthread_t thread, void** value_ptr, const struct timespec* abstime);
```

###### Bảng tổng hợp tham số

| **Tham số**     | **Kiểu dữ liệu**         | **Ý nghĩa**                                                                                                                          |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **`thread`**    | `pthread_t`              | ID của luồng mục tiêu mà bạn muốn đợi .                                                                                              |
| **`value_ptr`** | `void**`                 | Địa chỉ (con trỏ) của biến nơi hàm sẽ lưu trữ kết quả (`return value`) của luồng con sau khi nó kết thúc.                            |
| **`abstime`**   | `const struct timespec*` | Một con trỏ tới cấu trúc `timespec` chỉ định thời điểm cụ thể (deadline) mà bạn cho phép đợi. Phải sử dụng đồng hồ `CLOCK_REALTIME`. |
###### Các lưu ý quan trọng để sử dụng đúng:

- **Thời hạn (Deadline):** Tham số `abstime` không phải là "đợi trong bao nhiêu giây" (ví dụ: không phải là 5 giây kể từ bây giờ), mà là **thời điểm hệ thống** (absolute time). Đó là lý do trong ví dụ, code phải gọi `clock_gettime` trước để lấy thời gian hiện tại rồi mới cộng thêm số giây vào .
    
- **Mã trả về (Return codes):**
    
    - `EOK`: Thành công (luồng đã kết thúc trong thời hạn).
        
    - `ETIMEDOUT` (thường được hiển thị qua `errno`): Quá thời hạn (deadline).
        
- **Cấu trúc `timespec`:** Bạn cần đảm bảo cấu trúc này được khởi tạo đúng với `tv_sec` (giây) và `tv_nsec` (nano giây) .
#### **5.5. Catch lỗi bằng errno**

Trong lập trình hệ thống, khi một hàm (ví dụ: tạo luồng, mở file, gửi tin nhắn) gặp trục trặc và không thể thực thi, nó sẽ không làm chương trình văng (crash) ngay lập tức. Thay vào đó:

- Nó sẽ trả về một giá trị báo lỗi (thường là `-1` hoặc khác `0`).
    
- Đồng thời, hệ điều hành sẽ tự động gán một mã số nguyên vào một biến toàn cục có tên là **`errno`** (Error Number). Biến này nằm trong thư viện `<errno.h>`.
    

**Vấn đề:** Biến `errno` chỉ lưu các con số vô tri (ví dụ: số 9, 13, 16). Để con người hiểu được số đó có ý nghĩa gì, hệ thống cung cấp hàm **`strerror()`** trong thư viện `<string.h>` để dịch con số đó thành một câu thông báo lỗi bằng tiếng Anh.

Đoạn code trong slide cố tình tạo ra một lỗi để xem biến `errno` phản ứng như thế nào.

C

```
#include <stdio.h>
#include <unistd.h>
#include <errno.h> // Chứa biến toàn cục errno
#include <string.h> // Chứa hàm dịch lỗi strerror()

void main (void) {
    int errvalue;
    
    // 1. Khởi tạo giá trị mặc định cho errno (EOK = Error OK = 0 = Không có lỗi)
    errno = EOK; 
    
    // 2. Cố tình gọi một hàm sai để ép hệ thống sinh ra lỗi
    // Hàm write yêu cầu tham số đầu tiên là một File Descriptor hợp lệ (ví dụ 1 là màn hình)
    // Truyền -1 vào đây là một thao tác bất hợp pháp (Illegal call)
    write(-1, "hello, world\n", strlen("hello, world\n"));
    
    // 3. LƯU LẠI MÃ LỖI NGAY LẬP TỨC
    errvalue = errno; 
    
    // 4. In lỗi ra màn hình
    // In ra dưới dạng số nguyên
    printf("The error generated was %d\n", errvalue); 
    // Dùng strerror để dịch số nguyên đó ra chuỗi string dễ hiểu
    printf("That means: %s\n", strerror(errvalue)); 
    
    printf("Main terminated\n");
}
```

Kết quả Console in ra:

> The error generated was 9
> 
> That means: Bad file descriptor
> 
> Main terminated

**Mẹo "sống còn" khi code:** Tại sao ở bước 3, người ta phải copy `errno` vào một biến cục bộ `errvalue = errno;`? Vì `errno` là một biến toàn cục dùng chung cho cả hệ thống. Nếu sau lệnh `write` bị lỗi, bạn gọi thêm một lệnh nào đó (ví dụ lệnh `printf`) và lỡ như lệnh `printf` đó cũng bị lỗi, thì giá trị `errno` sẽ bị ghi đè bằng lỗi mới. Việc lưu nó vào biến `errvalue` ngay lập tức giúp bảo toàn "hiện trường" của cái lỗi ban đầu.

Vó hơn 130 mã lỗi khác nhau trong hệ thống POSIX. Khi bạn dùng `strerror()`, nó sẽ tự động tra cứu bảng này và in ra dòng "Meaning".

Dưới đây là một vài lỗi kinh điển mà bạn sẽ rất hay gặp khi làm Lab:

- **Lỗi số 9 (`EBADF` - Bad file descriptor):** Xảy ra trong ví dụ trên, khi bạn cố đọc/ghi vào một file hoặc channel không tồn tại.
    
- **Lỗi số 13 (`EACCES` - Permission denied):** Bạn cố gắng mở một file hoặc thư mục mà bạn không có quyền truy cập.
    
- **Lỗi số 16 (`EBUSY` - Device or resource is busy):** Bạn cố gắng truy cập vào một phần cứng (như thẻ mạng, port) đang bị một luồng khác chiếm dụng.
    
- **Lỗi số 10 (`ECHILD` - No child processes):** Thường gặp khi bạn dùng `pthread_join` nhưng luồng con mà bạn muốn đợi đã biến mất hoặc không tồn tại.
    

Thay vì phải in ra các số nguyên rồi đi lật tài liệu tra bảng, việc bọc mã lỗi vào hàm `strerror()` sẽ giúp chương trình của bạn tự động báo cáo nguyên nhân một cách rõ ràng bằng tiếng Anh.

Muốn tra cứu mã lỗi thì truy cập: http://www.qnx.com/developers/docs/7.0.0/index.html#com.qnx.doc.neutrino.lib_ref/topic/e/errno.html

### **6. Detached Thread:**
Từ góc độ một người dùng cuối (end-user) chỉ nhìn vào màn hình console, họ sẽ **không thấy bất kỳ sự khác biệt nào** giữa Joined và Detached. Cả hai đều in ra dòng chữ rồi biến mất.

Sự khác biệt hoàn toàn nằm ở "hậu trường", nơi hệ điều hành (OS) đóng vai trò là cô lao công đi dọn rác (giải phóng bộ nhớ RAM).

**Joinable vs Detached Threads**

| **Tiêu chí**              | **Joined Thread**                                                                                                             | **Detached Thread**                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Giải phóng tài nguyên** | Tài nguyên (stack, ID) bị giữ rịt lấy, chỉ được hệ điều hành thu hồi **sau khi** `main` gọi `pthread_join`.                   | Ngay khi luồng chạy xong, hệ thống **lập tức** thu hồi sạch sẽ tài nguyên mà không cần ai phải đợi hay gọi hàm gì cả. |
| **Rủi ro Memory Leak**    | Rất cao. Nếu bạn tạo luồng mà quên gọi `join`, hệ thống sẽ không giải phóng tài nguyên. Tạo nhiều luồng kiểu này máy sẽ sập . | Bằng không. Nó là giải pháp an toàn nhất nếu bạn chỉ muốn "bắn và quên" (fire-and-forget).                            |
Slide này đang đặt ra cho bạn một **câu hỏi thiết kế phần mềm**: Đứng trước một bài toán, bạn nên chọn loại luồng nào?

1. **HÃY DÙNG JOINABLE (Mặc định):** Khi luồng con thực hiện một phép toán phức tạp và bạn **bắt buộc phải lấy kết quả đó** để luồng chính xử lý tiếp. (Nhớ là dùng xong phải gọi `pthread_join` để dọn rác).
    
2. **HÃY DÙNG DETACHED:** Khi luồng con làm những việc "bắn và quên" (fire-and-forget). Ví dụ: Một luồng chuyên để nhấp nháy đèn LED, một luồng chuyên ghi log lỗi ra file, hoặc một luồng đẩy dữ liệu qua mạng. Bạn không cần kết quả trả về từ chúng, hãy biến chúng thành Detached để máy tính tự động dọn dẹp bộ nhớ, giúp chương trình chạy 24/7 mà không lo bị phình to RAM.

![[Pasted image 20260707080003.png]]

Đây là cấu hình hiện tại trong ảnh (bên trái `sleep(10)`, bên phải `sleep(6)`).

- **Bên trái (Joined):** Sếp ngủ 10s. Nhân viên mất 5s là làm xong, in ra "Thread Finished" rồi ngồi yên đó chờ. Sếp ngủ đủ 10s tỉnh dậy, chạy đến lệnh `pthread_join` thì thấy nhân viên làm xong rồi nên thu dọn rác, in "Main terminated" rồi kết thúc.
    
- **Bên phải (Detached):** Sếp ngủ 6s. Nhân viên mất 5s là làm xong, in ra "Thread Finished", tự thu dọn bàn làm việc rồi biến mất. Sếp ngủ đủ 6s tỉnh dậy, in "Main terminated" rồi kết thúc chương trình.
    
- **Kết quả:** Ở góc độ người nhìn màn hình, bạn thấy **cả 2 bên đều in ra đầy đủ** các dòng chữ. Không có gì khác biệt.

NHƯNG Sếp làm việc nhanh hơn Nhân viên (`sleep` trong main < 5s). Giả sử bạn sửa `sleep` trong hàm `main()` của cả 2 bên thành **`sleep(2)`**. Đây là lúc sự khác biệt lộ rõ!

- **Bên trái (Joined):** * Sếp ngủ 2s xong tỉnh dậy. Lúc này nhân viên mới làm được 2s (vẫn còn cần 3s nữa).
    
    - Sếp chạy tiếp đập mặt vào rào chắn `pthread_join(th1, NULL)`. Lệnh này ép Sếp phải đứng **đợi chết dí tại chỗ** cho đến khi nhân viên xong việc.
        
    - 3 giây sau, nhân viên làm xong, in ra "Thread Finished". Lúc này rào chắn mới mở ra cho Sếp đi tiếp để in "Main terminated".
        
    - **Kết quả:** Chương trình vẫn chạy đủ 5 giây, mọi kết quả đều được in ra đầy đủ, không thiếu chữ nào.
        
- **Bên phải (Detached):**
    
    - Sếp ngủ 2s xong tỉnh dậy. Vì là luồng làm khoán (Detached), **không có rào chắn `pthread_join`** nào giữ chân Sếp lại cả.
        
    - Sếp đi thẳng một mạch xuống dòng `return`, in ra "Main terminated" và **kết thúc luôn chương trình (đóng Process)**.
        
    - Khi Process (ngôi nhà chung) bị đóng cửa, tất cả nhân viên bên trong đều bị đuổi ra ngoài ngay lập tức. Nhân viên `thread_ex` lúc này mới ngủ được 2 giây đã bị "giết" chết tươi giữa chừng.
        
    - **Kết quả:** Bạn sẽ **KHÔNG BAO GIỜ** nhìn thấy dòng chữ "Thread Finished" được in ra. Chương trình tắt phụt sau đúng 2 giây.
    
***Lệnh `pthread_join` chính là cái mỏ neo giữ cho toàn bộ chương trình (Process) sống sót cho đến khi luồng con hoàn thành công việc.** Với luồng Detached (bên phải), nếu luồng `main` vô tình kết thúc quá sớm, toàn bộ các luồng Detached sẽ bị tiêu diệt ngay lập tức bất kể chúng đã làm xong việc hay chưa. Do đó, Detached chỉ an toàn khi chương trình chính (như một server) chạy liên tục 24/7 và không bao giờ tự tắt.*

#### **6.1. Detached a Joined Thread at Runtime:**
![[Pasted image 20260707081259.png]]

Nhìn hình ảnh trên, mặc định khi bạn gọi `pthread_create` mà không dùng cấu hình (như truyền `NULL` ở tham số thứ 2), luồng đó sinh ra sẽ là luồng **Joined**. Nghĩa là nó bắt buộc Sếp (`main`) phải đợi nó bằng `pthread_join`.

Tuy nhiên, slide này chỉ ra rằng: *Ngay cả khi luồng đã được sinh ra là Joined và đang chạy, bạn hoàn toàn có thể "hô biến" nó thành luồng **Detached** (làm xong tự nghỉ, tự dọn dẹp)* . Có 2 cách (2 mũi tên đỏ trong hình) để làm việc này:

**Cách 1: Luồng con tự xin nghỉ (Mũi tên đỏ phía trên)**
- Ở đây có dòng lệnh: `pthread_detach(pthread_self());`.
    
- **Tại sao lại cần `pthread_self()`?** Luồng con không hề biết biến `th1` (do Sếp giữ ở `main`). Nên để tự detach chính mình, nó phải gọi hàm `pthread_self()` – đây là cách để một luồng tự hỏi hệ điều hành: _"ID của tôi là gì?"_ .
    
- **Ý nghĩa:** Nhân viên đang làm việc (sau khi ngủ 5 giây), tự thấy không cần báo cáo lại nữa, liền nộp đơn xin tự dọn dẹp bàn làm việc khi xong nhiệm vụ.

**Cách 2: Sếp (`main`) chủ động cho nghỉ (Mũi tên đỏ phía dưới)**

Hãy nhìn vào dòng chữ xanh lá cây được khoanh đỏ trong hàm `main()`:

- `//pthread_detach(th1); // Can be detached here too`.
    
- **Ý nghĩa:** Sếp tạo ra nhân viên (`th1`), nhưng ngay sau đó (hoặc một lúc sau), Sếp quyết định: _"Thôi anh làm xong cứ tự dọn dẹp rồi về đi, không cần gặp tôi báo cáo đâu"_. Sếp dùng chính ID `th1` để cắt đứt liên kết.
##### Điểm nhấn cực kỳ quan trọng ở cuối đoạn code

Bạn hãy để ý đoạn code kiểm tra lỗi ở dưới cùng:

C

```
int retcode = pthread_join(th1, NULL); 
if(retcode == EOK)
    printf("Thread Successfully Joined\n");
else
    printf("Error %i: %s\n", retcode, strerror(retcode));
```

Khi chạy chương trình này, kết quả chắc chắn sẽ nhảy vào nhánh **`else` (báo lỗi)** . Tại sao? Vì ở trên, luồng đã tự gọi `pthread_detach` rồi. Nó đã trở thành luồng tự do. Khi luồng `main` ngoan cố gọi `pthread_join(th1, NULL)` để cố gắng chờ một luồng đã Detached, hệ điều hành sẽ báo lỗi ngay lập tức vì **bạn không thể Join một luồng đã Detach**.

**Tóm lược thông điệp:** Slide này cung cấp cho bạn một công cụ linh hoạt. Bạn không nhất thiết phải lên kế hoạch Detach luồng từ lúc khởi tạo (dùng `pthread_attr_t`). Bạn có thể linh động ép nó thành Detached ngay trong lúc chương trình đang vận hành (Runtime) bằng hàm `pthread_detach()`.

### **7. Thread Attributes** 
![[Pasted image 20260707082253.png]]

Slide giới thiệu 2 cái "biểu mẫu" để bạn điền thông tin :

- **`pthread_attr_t` (Hợp đồng tổng quát):** Chứa các thông tin tổng thể như kích thước bàn làm việc (stack size), có cho phép làm khoán không (detach state), và chính sách làm việc (policy) .
    
- **`sched_param` (Phụ lục hợp đồng):** Đây là một cấu trúc nhỏ nằm bên trong (hoặc đi kèm) hợp đồng chính, chuyên dùng để quy định **Độ ưu tiên (Priority)** của luồng .

##### Tóm tắt luồng code (5 bước lập hợp đồng)

Đoạn code bên trái chính là các bước để điền và áp dụng cái hợp đồng này (THAM SỐ SCHED_RR có ý nghĩa là gì thì xem ở dưới phần ***7.1. Getting and Setting Thread Priority and Schedule***):

- **Bước 1: Lấy mẫu hợp đồng chuẩn (Bắt buộc)**
    
    `pthread_attr_init(&th1_attr);` Khởi tạo tờ hợp đồng trống với các giá trị an toàn mặc định.
    
- **Bước 2: Ghi chính sách làm việc**
    
    `pthread_attr_setschedpolicy(&th1_attr, SCHED_RR);` Quy định nhân viên này làm việc theo kiểu `SCHED_RR` (Round Robin - Xoay vòng chia sẻ thời gian với người khác).
    
- **Bước 3: Định mức ưu tiên (Quyền lực)**
    
    `th1_param.sched_priority = 1;` `pthread_attr_setschedparam(&th1_attr, &th1_param);` Bạn thiết lập mức ưu tiên là 1 vào phụ lục `th1_param`, sau đó "kẹp" cái phụ lục này vào hợp đồng chính `th1_attr`.
    
- **Bước 4: Chống "Con ông cháu cha" (Cực kỳ quan trọng)**
    
    `pthread_attr_setinheritsched(&th1_attr, PTHREAD_EXPLICIT_SCHED);` Mặc định, luồng con sinh ra sẽ thừa kế y hệt priority của luồng cha (main). Dòng lệnh này ép hệ thống: _"Hãy bỏ qua luật thừa kế, bắt buộc phải dùng các thông số tôi vừa thiết lập ở trên"_. Nhớ phải có dòng này thì các cấu hình ở Bước 2 và 3 mới có tác dụng!
    
- **Bước 5: Ký hợp đồng và giao việc**
    
    `pthread_create(&th1, &th1_attr, thread_ex, NULL);` Thay vì truyền `NULL` vào tham số thứ 2 như trước đây, giờ bạn truyền `&th1_attr` (bản hợp đồng vừa viết) vào để tạo luồng.
    

**Tóm lại:** Slide này chỉ cho bạn cách không dùng thiết lập mặc định nữa, mà tự tay can thiệp sâu vào nhân Kernel của hệ điều hành để cấp cho luồng một độ ưu tiên (`priority`) và cách lập lịch (`policy`) theo đúng ý muốn của bạn.

#### 7.1. Getting and Setting Thread Priority and Schedule

![[Pasted image 20260707084032.png]]

Slide này liệt kê các hàm để bạn "hỏi thăm" và "ra lệnh" cho hệ điều hành (Kernel) về trạng thái của một luồng đang chạy.

**Nhóm hàm "Hỏi thăm" (Get):**

- `sched_getparam`: Sếp hỏi hệ điều hành: _"Độ ưu tiên (Priority) hiện tại của luồng này là mấy?"_ .
    
- `sched_getscheduler`: Sếp hỏi hệ điều hành: _"Luồng này đang chạy theo chính sách (Policy) gì? FIFO hay Round Robin?"_ Hệ điều hành sẽ không trả lời bằng chữ (vì máy tính chỉ thích số). Nó sẽ trả về một con số nguyên.
	- Nếu trả về số **1**: Tức là quy tắc **`SCHED_FIFO`**.  (First-In, First-Out - Ai đến trước làm trước)
		- **Đặc điểm:** "Ngồi lì đến chết thì thôi".
		- Cách hoạt động: Nếu Thread A đến trước và ngồi được vào ghế CPU, nó sẽ chạy liên tục không ngừng nghỉ. Nó chỉ chịu nhường ghế trong 3 trường hợp:
			- Nó làm xong việc và kết thúc.
			- Nó tự nguyện đi ngủ (như gặp lệnh `sleep`, hoặc đợi tin nhắn).
			- Có một thằng sếp quyền to hơn (Priority cao hơn) xuất hiện và đá văng nó ra.
	    
	- Nếu trả về số **2**: Tức là quy tắc **`SCHED_RR`**. (Round Robin - Xoay vòng)
	    - **Đặc điểm:** "Chia ngọt sẻ bùi - Mỗi đứa làm một tí".
	    - **Cách hoạt động:** Mọi thứ giống hệt FIFO, nhưng công bằng hơn đối với những luồng **cùng cấp độ**. Hệ điều hành sẽ quy định một khoảng thời gian cố định (gọi là Time Slice, thường cực ngắn cỡ vài mili-giây).
	    - Thread A lên ngồi ghế chạy. Khi hết "quota" thời gian quy định, hệ điều hành lập tức ép A đứng dậy nhường ghế cho Thread B chạy.
	    - B chạy hết thời gian lại bị đuổi xuống để A lên ngồi. Chúng nó cứ xoay vòng đổi chỗ cho nhau liên tục để không ai bị "chết đói" vì chờ đợi.
	- Nếu trả về số **3**: Tức là quy tắc **`SCHED_OTHER`**.
		- Đây là luật mặc định của các hệ điều hành bình thường không có tính khắt khe. Trong môi trường hệ thống thời gian thực (Real-time) như QNX, người ta hiếm khi dùng cái này mà chủ yếu dùng FIFO và RR để kiểm soát chính xác ai chạy lúc nào.
	- Nếu trả về số 4: Tức là quy tắc ``SCHED_SPORADIC``
		- Hãy nhớ lại luật `SCHED_FIFO` (Ngồi lì đến chết thì thôi). Nếu bạn có một luồng rất quan trọng (Priority cao) nhưng lâu lâu nó mới chạy một lần (làm việc lẻ tẻ). Nếu lúc nó chạy, nó gặp một lượng dữ liệu quá lớn, nó sẽ chiếm luôn cái ghế CPU và làm "chết đói" tất cả các luồng khác ở dưới. `SCHED_SPORADIC` sinh ra để khắc phục điều đó. Nó là một sự kết hợp hoàn hảo để luồng vừa có độ ưu tiên cao, vừa **không thể lạm quyền**.
		- **Giải thích cơ chế bằng "Hợp đồng khoán"** Hãy tưởng tượng bạn thuê một **Chuyên gia (Thread Priority cao)** để xử lý sự cố. Hợp đồng `SCHED_SPORADIC` sẽ dùng đến 4 thông số đặc biệt trong slide 23 :
			- **`sched_priority` (Mức ưu tiên gốc):** Mức quyền lực bình thường của chuyên gia (Ví dụ: Mức 15).
			- **`__ss_init_budget` (Quỹ thời gian / Ngân sách):** Bạn quy định: _"Mỗi ngày tôi chỉ trả tiền cho anh tối đa 2 tiếng làm việc ở mức Chuyên gia"_. hông phải là một số nguyên (`int`), mà nó là **`struct timespec`**
				Giả sử bạn muốn cấp ngân sách cho luồng là **1.5 giây**, bạn sẽ phải chia nhỏ nó ra để gán vào `timespec` như sau:
				- param.__ss.__ss_init_budget.tv_sec = 1; // Gán 1 giây
				- param.__ss.__ss_init_budget.tv_nsec = 500000000;  // Gán 0.5 giây (bằng 500 triệu nano-giây)
			- **`__ss_repl_period` (Chu kỳ bơm lại):** Là độ dài của "một ngày" để reset lại cái ngân sách trên (Ví dụ: Cứ sau 24h thì anh lại được cấp quỹ 2 tiếng mới).
			- **`__ss_low_priority` (Mức ưu tiên tụt hạng):** Nếu chuyên gia xài hết sạch 2 tiếng ngân sách mà vẫn chưa làm xong việc, anh ta **không bị đuổi**, nhưng sẽ bị rớt hạng xuống làm **Thực tập sinh** (Ví dụ: Mức 5).

`SCHED_SPORADIC` sinh ra để khắc phục điều đó. Nó là một sự
		- 
		
**Nhóm hàm "Ra lệnh" (Set):**

- `sched_setparam`: Sếp ra lệnh: _"Đổi ngay độ ưu tiên của luồng này thành mức X cho tôi!"_ .
    
- `sched_setscheduler`: Sếp ra lệnh: _"Đổi cả chính sách làm việc (Policy) VÀ độ ưu tiên của nó thành Y ngay lập tức!"_ .


#### **7.2. Passing Data Structures between Threads** 
![[Pasted image 20260707092204.png]]

### **8. Interrupt**
#### 8.1. Bản chất của Interrupt
Interrupt là tín hiệu phần cứng gửi đến CPU, yêu cầu nó tạm dừng việc đang làm để xử lý một sự kiện khẩn cấp ngay lập tức.
- **Context Switch:** Khi ngắt xảy ra, ***CPU lưu lại giá trị các thanh ghi của tiến trình hiện tại vào PCB***, sau đó chuyển ngữ cảnh sang Interrupt Service Routine (ISR).

- **ISR (Interrupt Service Routine):** Là đoạn code xử lý ngắt. Đặc điểm:
	- Cực kỳ hạn chế số lượng lệnh.
	- Stack size rất nhỏ.
	- **Quy tắc vàng:** Chỉ nên thực hiện việc xóa nguyên nhân gây ngắt, sau đó gửi tín hiệu (thông qua message/pulse) để đánh thức một luồng (thread) có độ ưu tiên cao làm nốt phần việc còn lại.


- Hãy nhìn vào vòng đời trạng thái của luồng khi có ngắt (Hình ảnh bên dưới):
	- **Luồng đang chạy (Running)** $\rightarrow$ **Ngắt (Interrupt)** $\rightarrow$ **ISR** $\rightarrow$ **Xong (Int. Exit)** $\rightarrow$ **Quay lại luồng (Running hoặc Ready)**.
	- Nếu ngắt xảy ra, CPU sẽ ưu tiên nhảy vào ISR trước, sau đó mới quay lại luồng chính.
	
![[Pasted image 20260707124622.png]]

____
**Stupidly Simple:**
- **CPU** là bạn đang ngồi làm bài tập (chạy Thread).
    
- **Interrupt** là tiếng chuông điện thoại reo (tín hiệu phần cứng).
    
- **ISR** là việc bạn nhấc máy lên nghe điện thoại.
    
    - Sau khi nghe xong, bạn đặt máy xuống và **tiếp tục làm bài tập** ở đúng câu bạn đang dang dở.
        
    - **Quan trọng:** Bạn không được phép "tám" chuyện cả tiếng đồng hồ trên điện thoại, nếu không bạn sẽ trượt kỳ thi (hệ thống bị treo).

___
#### **8.2. Process Switch:**
|**Đặc điểm**|**Context Switch (Chuyển ngữ cảnh)**|**Process Switch (Chuyển tiến trình)**|
|---|---|---|
|**Bản chất**|Chuyển đổi giữa các luồng (Thread) trong cùng một tiến trình .|Chuyển đổi giữa hai tiến trình (Process) khác nhau.|
|**Không gian bộ nhớ**|Dùng chung không gian địa chỉ (Address space) .|Không gian địa chỉ riêng biệt (có rào cản bộ nhớ) .|
|**Độ phức tạp**|Thấp, tốn ít tài nguyên hơn.|Cao, tốn nhiều tài nguyên hơn (thực hiện 2 lần context switch).|
|**Thao tác**|Lưu/nạp thanh ghi, con trỏ ngăn xếp (Stack Pointer).|Lưu/nạp toàn bộ PCB, thay đổi bảng phân trang (Page table), bộ nhớ .|
|**Ví dụ (Analogy)**|Làm bài Toán $\rightarrow$ Làm bài Lý (cùng trên một bàn học) .|Làm bài Toán ở nhà $\rightarrow$ Làm bài Văn ở một ngôi nhà khác.|
|**Mục đích RTOS**|Ưu tiên dùng để đáp ứng nhanh các sự kiện .|Hạn chế tối đa để tránh lãng phí thời gian nạp lại bộ nhớ .|
Một `Process Switch` thực chất bao gồm **hai** `Context Switch` liên tiếp:

- **Dọn dẹp tiến trình cũ:** Hệ điều hành phải lấy tiến trình đang chạy (`old process`) ra khỏi CPU, lưu trạng thái của nó vào PCB, rồi đẩy nó vào hàng đợi (`ready queue` hoặc `blocked queue`).
    
- **Chọn và Dispatch tiến trình mới:** Bộ lập lịch (Scheduler) chọn tiến trình có độ ưu tiên cao nhất, nạp toàn bộ cấu hình bộ nhớ của nó (bảng phân trang - page table, giới hạn bộ nhớ - limit register) vào CPU .

*`? Tại sao hệ điều hành RTOS lại ghét Process Switch ? `*
Trong các hệ thống thời gian thực (như QNX), mục tiêu tối thượng là **"Đáp ứng kịp thời" (Highly responsive)**.

- Mỗi lần làm `Process Switch`, hệ thống mất một khoảng thời gian khá lớn để nạp lại bản đồ bộ nhớ (memory mapping).
    
- Nếu xảy ra quá nhiều `Process Switch`, hệ thống sẽ mất khả năng đáp ứng các sự kiện khẩn cấp vì CPU bận... "chuyển nhà" chứ không làm việc.


*`? Trực quan hóa bằng sơ đồ ? 
Sơ đồ này mô tả cách *Real-Time Kernel điều khiển CPU :
- **Các "Task" (Tiến trình):** Được xếp hàng từ trái sang phải theo độ ưu tiên (Trái: High Priority, Phải: Low Priority) .
- **Task Selector (Bộ chọn tác vụ):** Giống như một cái kim đồng hồ, nó luôn luôn quét để tìm xem **trong số tất cả các tiến trình đang Ready, thằng nào có độ ưu tiên cao nhất**.
- **Events (Sự kiện):** Các tín hiệu từ phần cứng (ISR) hoặc các tác vụ khác gửi đến Kernel . Ngay khi nhận được "Event", Kernel sẽ kích hoạt "Task Selector" để kiểm tra: _Có cần đổi tiến trình (Process Switch) ngay không?_
![[Pasted image 20260707130043.png]]

| **Hành động**                       | **Ai làm?** | **Bản chất**                                                            |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------- |
| **Ngắt xảy ra**                     | Phần cứng   | Tiếng chuông báo cháy.                                                  |
| **ISR (Interrupt Service Routine)** | Kernel      | Tắt chuông + thông báo cho đội cứu hộ (rất nhanh, không làm việc nặng). |
| **High Priority Task**              | Thread      | Đội cứu hộ (xử lý logic nặng, tốn thời gian, nhưng có độ ưu tiên cao).  |
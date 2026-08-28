# START_T10_GOLDEN_gemini.md

## Câu hỏi
Đây là câu hỏi benchmark. AI phải trả lời với đúng cấu trúc trong file GOLDEN dưới đây (đáp án mẫu). Dùng để đối chiếu rằng pipeline Mermaid → PDF render được đầy đủ mọi thành phần.

## Đáp án mẫu (GOLDEN)

# Process vs Thread trong QNX

## 1. Flowchart quy trình Host-Target

```mermaid
graph TD
    HOST[Development Host<br/>QNX Momentics IDE] -->|Build/Compile| BIN[Binary .bin]
    BIN -->|Deploy qua mạng| VM[Target VM<br/>QNX RTOS]
    VM --> K[Microkernel Scheduler]
    K --> APP[Application Code]
```

## 2. Sequence diagram IPC

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>C: 1. MsgSend() block
    C->>+S: 2. Gửi thông điệp qua Kernel
    S->>S: 3. MsgReceive() xử lý
    S-->>-C: 4. MsgReply() trả kết quả
    Note over C: 5. Client unblock, chạy tiếp
```

## 3. State diagram trạng thái luồng

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Running: Dispatch
    Running --> Ready: Timer_run_out
    Running --> Blocked: Block
    Blocked --> Ready: Wakeup
    Running --> [*]: Exit
```

## 4. Class diagram

```mermaid
classDiagram
    class PCB {
        +currentState
        +processId
        +programCounter
    }
    class Process {
        +pid
        +schedule()
    }
    class Thread {
        +tid
        +run()
    }
    Process "1" *-- "1..*" Thread
    Process "1" *-- "1" PCB
```

## 5. Bảng so sánh

| Đặc điểm | Process | Thread |
|----------|---------|--------|
| Bộ nhớ | Không chia sẻ address space | Chia sẻ address space |
| Tài nguyên riêng | Hoạt động độc lập | Stack riêng |
| Độ tin cậy | Cao (memory barrier) | Thấp (sập chùm) |

## 6. Code C

```c
#include <pthread.h>
int shared_counter = 0;
pthread_mutex_t my_mutex;
```

## 7. Công thức

Inline: $counter = counter + 1$

Display:
$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

> **Kết luận:** Mutex bảo vệ Critical section khỏi Race condition.

QNX có một cơ chế giao tiếp giữa các tiến trình (IPC) "chính chủ" được thiết kế tối ưu cho các hệ thống thời gian thực, vượt trội hơn so với TCP/IP thông thường hay POSIX mqueues.

Cơ chế này hoạt động dựa trên mô hình **Client-Server** và tính chất **Blocking** (chờ đồng bộ) cực kỳ chặt chẽ:

- **Vòng đời của Server:** Server tạo một "kênh" kết nối (gọi là Attach Point) bằng hàm `name_attach()`. Sau đó, nó gọi `MsgReceive()` và sẽ bị "block" (đứng im tại dòng code đó) cho đến khi có một client gửi tin nhắn đến.
    
- **Vòng đời của Client:** Client muốn gửi tin thì dùng `name_open()` để kết nối vào kênh của Server. Sau đó, nó gọi `MsgSend()` để gửi tin. Ngay lập tức, Client cũng bị "block" để chờ Server trả lời.
    
- **Quá trình xử lý & Hồi đáp:** Server nhận được tin, thoát khỏi trạng thái block, tiến hành xử lý dữ liệu. Xử lý xong, Server bắt buộc phải gọi `MsgReply()` để gửi kết quả về. Lúc này, Client nhận được hồi đáp mới được "unblock" để chạy những dòng code tiếp theo. Cuối cùng, kết nối được đóng bằng `name_close()` (Client) và `name_detach()` (Server).
    

**Giao thức QNET:** Đây là "vũ khí bí mật" của QNX. Bằng QNET, Client ở một máy ảo khác hoàn toàn có thể mở kết nối đến Server như thể chúng đang chạy trên cùng một máy, chỉ khác ở cú pháp đường dẫn.

**Pulse (Xung):** Khác với tin nhắn (Message) yêu cầu gửi và chờ reply, Pulse là dạng tín hiệu một chiều, cực nhẹ, gửi xong là thôi. Trong bài này, Client có thể gửi một Pulse để yêu cầu Server tự thoát (Terminate). Server có một biến `Stay_alive`, nếu đổi giá trị này, Server sẽ phớt lờ yêu cầu thoát.



___

Biểu đồ này mô tả trục thời gian giao tiếp giữa Client và Server. Bạn sẽ thấy rõ ai gửi trước, ai chờ ai, và lúc nào thì được "giải phóng" (Unblock).
```mermaid
sequenceDiagram
    participant C as Client (Target02 / Target03)
    participant S as Server (Target01)

    Note over S: 1. Khởi tạo Kênh
    S->>S: name_attach()
    
    Note over S: 2. Chờ nhận tin
    S->>S: MsgReceive()
    rect rgb(255, 200, 200)
        Note right of S: SERVER BỊ BLOCKED (Đứng chờ)
    end

    Note over C: 3. Kết nối vào kênh
    C->>S: name_open()
    
    Note over C: 4. Gửi dữ liệu
    C->>S: MsgSend(Message)
    
    rect rgb(200, 220, 255)
        Note left of C: CLIENT BỊ BLOCKED (Chờ Server trả lời)
    end
    
    Note over S: Nhận được tin nhắn -> SERVER UNBLOCK
    Note over S: 5. Xử lý dữ liệu (Tính toán...)
    
    Note over S: 6. Gửi phản hồi
    S-->>C: MsgReply(Reply)
    
    Note over C: Nhận được hồi đáp -> CLIENT UNBLOCK
    Note over C: Tiếp tục chạy code bên dưới
    
    Note over C,S: 7. Dọn dẹp / Đóng kết nối
    C->>C: name_close()
    S->>S: name_detach()
```


Biểu đồ này tập trung vào luồng code của từng máy ảo độc lập và cách chúng tác động chéo lên nhau. Các đường đứt nét màu đỏ thể hiện luồng dữ liệu truyền qua mạng QNET
```mermaid
graph TD
    subgraph ServerNode [Tiến trình trên VM: Target01]
        S1(name_attach<br/>Tạo Attach Point) --> S2{MsgReceive<br/>Có tin nhắn không?}
        S2 -- Không --> S2_Block((BLOCKED))
        S2_Block -.-> S2
        S2 -- Có --> S3[Xử lý Dữ liệu]
        S3 --> S4(MsgReply<br/>Gửi phản hồi)
        S4 --> S2
        
        S4 -. Kết thúc chương trình .-> S5(name_detach)
    end

    subgraph ClientNode [Tiến trình trên VM: Target02 / 03]
        C1(name_open<br/>Tìm Attach Point) --> C2(MsgSend<br/>Gửi tin nhắn)
        C2 --> C3{Đã có hồi đáp chưa?}
        C3 -- Chưa --> C3_Block((BLOCKED))
        C3_Block -.-> C3
        C3 -- Có --> C4[Tiếp tục chạy phần code còn lại]
        C4 --> C5(name_close)
    end
    
    %% Đường kết nối mạng QNET
    C1 -. "Tìm kiếm qua /net/Target01/..." .-> S1
    C2 == "Truyền Message (QNET)" ===> S2
    S4 == "Truyền Reply (QNET)" ===> C3

    classDef block fill:#ff9999,stroke:#333,stroke-width:2px;
    class S2_Block,C3_Block block;
```

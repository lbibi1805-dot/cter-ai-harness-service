### 1. Mục đích reference và Khi nào dùng của từng tài liệu

**Tài liệu 1: "Getting Started with QNX® Neutrino®: A Guide for Realtime Programmers"**

- **Mục đích reference:** Tài liệu này là sách hướng dẫn dành cho các lập trình viên thời gian thực (realtime programmers), giúp giới thiệu về hệ điều hành QNX Neutrino và hỗ trợ phát triển các ứng dụng cũng như trình quản lý tài nguyên (resource managers). Cuốn sách tập trung vào triết lý thiết kế của QNX và các khái niệm cốt lõi của lập trình hệ thống.
    
- **Khi nào dùng:**
    
    - Khi bạn cần viết mã C/C++ tương tác sâu với hệ điều hành (lập trình hệ thống, viết driver/resource manager).
        
    - Khi cần tìm hiểu cơ chế hoạt động của tiểu nhân (microkernel), tiến trình (processes), luồng (threads), và truyền thông điệp (message passing).
        
    - Khi cần xử lý ngắt (interrupts) phần cứng hoặc làm việc với đồng hồ/bộ định thời gian (timers).
        

**Tài liệu 2: "QNX® Neutrino® RTOS User's Guide"**

- **Mục đích reference:** Tài liệu này dành cho tất cả người dùng hệ thống QNX Neutrino, từ quản trị viên hệ thống (system administrators) đến người dùng cuối (end users). Nó đóng vai trò như một cẩm nang hướng dẫn cách tương tác với môi trường runtime của QNX, cách sử dụng các tiện ích dòng lệnh và cấu hình hệ thống.
    
- **Khi nào dùng:**
    
    - Khi cần cấu hình, cài đặt, quản trị hệ thống (tạo tài khoản, phân quyền file, thiết lập mạng TCP/IP, Qnet).
        
    - Khi cần thao tác với dòng lệnh (shell), viết shell scripts (bash, ksh), hoặc sử dụng các tiện ích hệ thống (như cp, rm, ls, grep).
        
    - Khi cần tìm hiểu cách mount hệ thống file (filesystems), tinh chỉnh hiệu suất hệ thống (fine-tuning) hoặc xử lý sự cố môi trường.
        

### 2. Danh sách các chương của từng tài liệu

**Tài liệu 1: Getting Started with QNX® Neutrino®**

- Chapter 1: Processes and Threads (Tiến trình và Luồng)
    
- Chapter 2: Message Passing (Truyền tin nhắn)
    
- Chapter 3: Clocks, Timers, and Getting a Kick Every So Often (Đồng hồ và Bộ định thời)
    
- Chapter 4: Interrupts (Ngắt hệ thống)
    
- Chapter 5: Resource Managers (Trình quản lý tài nguyên)
    
- Appendix A: QNX 4 to QNX Neutrino (Chuyển đổi từ QNX 4 sang Neutrino)
    
- Appendix B: Calling 911 (Hỗ trợ kỹ thuật/Xử lý sự cố)
    
- Appendix C: Sample Programs (Chương trình mẫu)
    
- Appendix D: Glossary (Thuật ngữ)
    

**Tài liệu 2: QNX® Neutrino® RTOS User's Guide**

- Chapter 1: Getting to Know the OS (Làm quen với HĐH)
    
- Chapter 2: Logging In, Logging Out, and Shutting Down (Đăng nhập, Đăng xuất và Tắt máy)
    
- Chapter 3: Managing User Accounts (Quản lý tài khoản người dùng)
    
- Chapter 4: Using the Command Line (Sử dụng dòng lệnh)
    
- Chapter 5: Working with Files (Làm việc với File)
    
- Chapter 6: Using Editors (Sử dụng trình soạn thảo)
    
- Chapter 7: Configuring Your Environment (Cấu hình môi trường)
    
- Chapter 8: Writing Shell Scripts (Viết Shell Scripts)
    
- Chapter 9: Working with Filesystems (Làm việc với hệ thống File)
    
- Chapter 10: Using Qnet for Transparent Distributed Processing (Sử dụng Qnet)
    
- Chapter 11: TCP/IP Networking (Mạng TCP/IP)
    
- Chapter 12: Backing Up Data (Sao lưu dữ liệu)
    
- Chapter 13: Securing Your System (Bảo mật hệ thống)
    
- Chapter 14: Fine-Tuning Your System (Tinh chỉnh hệ thống)
    
- Chapter 15: Understanding System Limits (Hiểu về các giới hạn hệ thống)
    
- Chapter 16: Technical Support (Hỗ trợ kỹ thuật)
    

### 3. Bảng tổng hợp & Use case tra cứu trong Course (Khóa học)

Dưới đây là bảng tổng hợp so sánh và các Use Case (trường hợp sử dụng) cụ thể khi bạn cần tra cứu trong một khóa học về Hệ điều hành / Hệ thống nhúng:

|**Tiêu chí**|**Getting Started with QNX Neutrino (Sách Lập trình) PDF**|**QNX Neutrino RTOS User's Guide (Sách Người dùng) PDF**|
|---|---|---|
|**Đối tượng mục tiêu**|Lập trình viên C/C++, kỹ sư hệ thống nhúng, kỹ sư phát triển driver.|Quản trị viên hệ thống (Sysadmin), người dùng cuối, người dùng IDE.|
|**Mục đích chính**|Dạy cách lập trình các ứng dụng thời gian thực và viết Resource Manager.|Dạy cách cấu hình, sử dụng dòng lệnh, và quản lý các tài nguyên phần mềm/mạng.|
|**Use case tra cứu trong Course 1:**<br><br>  <br><br>_Làm bài tập C/C++_|Tra cứu API về tạo Thread (`pthread_create`), lập lịch (Scheduling) hoặc khóa Mutex/Semaphore.|Không dùng nhiều cho việc viết code C/C++, trừ khi cần biên dịch hoặc xem cấu trúc file.|
|**Use case tra cứu trong Course 2:**<br><br>  <br><br>_Giao tiếp liên tiến trình (IPC)_|Đọc Chương 2 để hiểu cách viết code gửi/nhận tin nhắn (`MsgSend`, `MsgReceive`, `MsgReply`).|Đọc Chương 10 (Qnet) để hiểu cách QNX định tuyến các tiến trình phân tán trên mạng.|
|**Use case tra cứu trong Course 3:**<br><br>  <br><br>_Phát triển Driver nhúng_|Đọc Chương 4 (Ngắt - Interrupts) và Chương 5 (Viết Resource Manager) để map thiết bị vào cây thư mục `/dev`.|Cấu hình giới hạn hệ thống (System limits) ở Chương 15 để đảm bảo driver không vượt quá tài nguyên.|
|**Use case tra cứu trong Course 4:**<br><br>  <br><br>_Quản trị & Triển khai OS_|Rất ít dùng.|Tra cứu cách thiết lập IP (Chương 11), phân quyền file (Chương 5) hoặc tự động hóa bằng Shell Script (Chương 8).|
|**Use case tra cứu trong Course 5:**<br><br>  <br><br>_Tối ưu hóa (Optimization)_|Đọc phần "Scheduling and the real world" để hiểu cách Kernel xử lý ngữ cảnh (Context Switch).|Đọc Chương 14 (Fine-Tuning) để dùng các công cụ giám sát hiệu năng như `hogs`, `pidin`, `top`.|
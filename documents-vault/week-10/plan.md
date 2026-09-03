### Lộ trình học tập Lecture 8: Deadlock & Scheduling

#### Section 1: Khái niệm cơ bản & Điều kiện xảy ra Deadlock

**Mục tiêu:** Hiểu rõ bản chất của tài nguyên, hiện tượng Deadlock là gì và 4 điều kiện tiên quyết (Necessary Conditions) để Deadlock xảy ra.

- **Slide 3 (Khái niệm cơ bản):** Phân biệt giữa **Deadlock** (Bế tắc - tiến trình chờ một sự kiện không bao giờ xảy ra) và **Indefinite Postponement** (Trì hoãn vô thời hạn/Starvation/Livelock - tiến trình bị trì hoãn chạy vô thời hạn). Ghi nhớ các cách cơ bản để tránh hai tình trạng này (ví dụ: dùng `pthread_mutex_trylock()`, Aging of priorities).
    
- **Slide 4 (Resource Concepts):** Phân biệt 2 loại tài nguyên: **Non-preemptible resources** (Tài nguyên không thể bị thu hồi/tước đoạt, ví dụ như tài nguyên tái sử dụng tuần tự) và **Preemptible resources** (Tài nguyên có thể bị tước đoạt/chia sẻ, ví dụ như CPU, bộ nhớ chính).
    
- **Slide 5 (4 Điều kiện Deadlock):** Trọng tâm lý thuyết. Deadlock chỉ xảy ra khi hội đủ 4 điều kiện: Mutual Exclusion, Hold and Wait, No Preemption, và Circular Wait.
    

#### Section 2: Các chiến lược xử lý Deadlock

**Mục tiêu:** Nắm được 4 hướng tiếp cận chung để xử lý Deadlock và đi sâu vào chiến lược "Deadlock Prevention" (Ngăn ngừa).

- **Slide 6 (4 Approaches):** Tổng quan 4 chiến lược: **Prevention** (Ngăn ngừa bằng cách phá vỡ 1 trong 4 điều kiện), **Avoidance** (Né tránh bằng thuật toán Banker), **Detection** (Phát hiện sau khi xảy ra) và **Recovery** (Phục hồi - nhưng rất rủi ro và lộn xộn).
    
- **Slide 7 & 8 (Deadlock Prevention):** Phân tích tại sao việc ngăn ngừa Deadlock thường **không phù hợp** cho Real Time Systems (RTS).
    
    - Phá vỡ "Hold and Wait" và "No Preemption" gây lãng phí tài nguyên, mất dữ liệu và trễ deadline.
        
    - Phá vỡ "Circular Wait" (bằng cách đánh số tài nguyên) thì khó mở rộng và phụ thuộc nền tảng.
        

#### Section 3: Thuật toán Banker (Deadlock Avoidance)

**Mục tiêu:** Học cách tính toán và kiểm tra trạng thái an toàn (Safe state) của hệ thống bằng thuật toán Banker. (Phần này nặng về bài tập, cần thực hành nhiều).

- **Slide 9 (Giới thiệu):** Nguyên lý của Deadlock Avoidance và các giả định (assumptions) bắt buộc của thuật toán Banker của Dijkstra (ví dụ: số lượng tài nguyên cố định, tiến trình phải khai báo lượng tối đa cần dùng).
    
- **Slide 10 (Nguyên lý Toán học):** Nắm vững công thức: `Need = Maximum - Allocation`. Hiểu định nghĩa về "Safe state".
    
- **Slide 11 & 12 (Ví dụ cơ bản):** Phân tích tay cách một hệ thống 1 loại tài nguyên chuyển từ Safe State sang Unsafe State chỉ bằng việc cấp phát sai 1 tài nguyên.
    
- **Slide 13 - 19 (Ví dụ Nâng cao - Ma trận):** Học cách giải bài toán Banker với nhiều loại tài nguyên (Multiple Resource Types) qua 3 bước: Tính _Need_, Chọn process thỏa mãn, và Cập nhật _Available_.
    
- **Slide 20 - 25 (Kiểm tra Request mới):** Học 3 bước quy trình cấp phát khi có một Request mới đến: Kiểm tra _Available_, kiểm tra _Maximum_, và làm phép thử _Trial Allocation_.
    
- **Slide 26 (Điểm yếu của Banker):** Tại sao Banker ít được dùng trong thực tế (không hỗ trợ cấp phát động, overhead cao, không đảm bảo deadline).
    
- **Slide 34 - 35 (Bài tập thực hành):** Tự giải lại các bài toán mẫu.
    

#### Section 4: Resource Allocation Graph (Deadlock Detection) & Scheduling

**Mục tiêu:** Sử dụng Đồ thị phân bổ tài nguyên (RAG) để phát hiện Deadlock và nắm các kiến thức nền tảng về Lập lịch (Scheduling).

- **Slide 27 & 28 (Lý thuyết RAG):** Cách vẽ và đọc RAG (Resource Allocation Graph) dựa trên Directed Graph. Phân biệt đường "Allocation" (Tài nguyên chỉ vào Tiến trình) và đường "Request" (Tiến trình chỉ vào Tài nguyên).
    
- **Slide 29 - 32 (Cách giảm thiểu RAG):** Học cách "Reduction of a RAG diagram" bằng cách gỡ bỏ dần các task có thể hoàn thành để xem hệ thống có bị Circular chain (Deadlock) không.
    
- **Slide 33 (Mapping RAG sang Banker):** Sự liên kết giữa hai công cụ này (RAG chỉ cho thấy allocation, request và available hiện tại, không có cột Max).
    
- **Slide 38 - 41 (Scheduling Basics):** Học lướt qua các kiến thức cơ sở về lập lịch (Admission, Intermediate, Low-level), các loại lập lịch (Preemptive, Nonpreemptive) và các chiến lược phổ biến (FCFS, SJF, Round-Robin, Priority).
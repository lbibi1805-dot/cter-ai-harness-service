### Section 1: Khởi động & Bức tranh tổng quan về Hệ thống

**Mục tiêu:** Hiểu lý do tại sao phải dùng cấu trúc Task của Gomaa thay vì thiết kế tự do, và nắm được 5 tiêu chí cốt lõi.

- **Slide 3:** Khái niệm Task Structuring Criteria (COMET) của Gomaa. Tìm hiểu vấn đề cốt lõi: các hệ thống lớn sẽ sinh ra quá nhiều task nếu cứ gán bừa (1 task cho 1 I/O hoặc 1 state machine), dẫn đến cần một phương pháp tiếp cận chính quy hóa.
    
- **Slide 4:** Tổng quan 5 phân loại tiêu chí của Gomaa. Hãy chú ý sự phân chia rõ ràng: 3 tiêu chí đầu dùng để bóc tách task ra (separate out), 2 tiêu chí cuối dùng để gom nhóm lại nhằm giảm thiểu overhead do task switching.
    

### Section 2: Bóc tách và Nhận diện Task (Separation)

**Mục tiêu:** Nắm vững cách phân tích một hệ thống phức tạp ra thành các task độc lập theo 3 tiêu chí đầu tiên.

- **Slide 5 (Tiêu chí 1 - I/O Task):** Cách cấp phát task cho phần cứng I/O, bao gồm Asynchronous (điều khiển bằng ngắt) và Passive (lấy mẫu định kỳ hoặc theo yêu cầu). Chú ý sự khác biệt khi xử lý dữ liệu Rời rạc (Discrete) và Liên tục (Continuous).
    
- **Slide 6 (Tiêu chí 2 - Internal Task):** Phân loại 4 dạng task nội bộ: Periodic (theo timer), Asynchronous (theo message/event), Control (chạy state machine), và User Role (giao diện người dùng).
    
- **Slide 7 (Tiêu chí 3 - Task Priority):** Mức độ ưu tiên. Đây là phần cực kỳ quan trọng: các task "Time Critical" phải có ưu tiên cao và đứng độc lập, trong khi các task nặng về tính toán (ví dụ: xử lý dữ liệu) phải ưu tiên thấp để không chiếm trọn CPU (tránh starvation).
    

### Section 3: Tối ưu hóa - Gom nhóm và Đảo ngược Task (Grouping & Minimization)

**Mục tiêu:** Học cách refactor thiết kế để giảm thiểu gánh nặng hệ thống. (Đây là phần nặng nhất, hãy dành nhiều thời gian đọc kỹ các ví dụ).

- **Kỹ thuật 1: Task Clustering (Gom cụm)**
    
    - **Slide 8-9:** Lý thuyết về 4 dạng gom cụm: Temporal (cùng mốc sự kiện/thời gian), Sequential (theo trình tự), Control (kết hợp task điều khiển và biến đổi dữ liệu), và Mutually Exclusive (không bao giờ chạy song song). Đừng quên đọc kỹ điều kiện _khi nào không nên kết hợp_ (khác mức ưu tiên hoặc chạy trên các core CPU khác nhau).
        
    - **Slide 10-11:** Phân tích ví dụ thiết kế máy ATM. Xem cách sơ đồ từ giai đoạn "Analysis Model" với nhiều task được rút gọn thành 1 task điều khiển (ATMController) ở giai đoạn "Final Design Model".
        
- **Kỹ thuật 2: Task Inversion (Đảo ngược Task)**
    
    - **Slide 12-13:** Lý thuyết chung và dạng "Multiple Instance". Xem ví dụ gom nhiều thang máy (Elevators) chung một task điều khiển, thay vì tạo riêng từng task cho mỗi thang.
        
    - **Slide 14-16:** Dạng "Sequential Inversion". Đọc kỹ ví dụ chuyển đổi giao tiếp truyền tin (Message passing) thành việc gọi hàm (Function calls) trong hệ thống Cruise Control (Kiểm soát hành trình).
        
    - **Slide 17:** Dạng "Temporal Inversion" - gom các bộ định thời (timers) hoặc task có chu kỳ liên quan lại với nhau để tiết kiệm tài nguyên.
        

### Section 4: Ứng dụng vào Bài tập lớn (Group Project Assessment)

**Mục tiêu:** Đảm bảo bạn áp dụng đúng lý thuyết vào thiết kế đồ án thực tế và ăn trọn điểm các tiêu chí đánh giá.

- **Slide 2:** Nhìn lại lộ trình học tập. Lưu ý báo cáo Initial Design Report sẽ phải nộp vào tuần 8.
    
- **Slide 18:** Checklist để đạt điểm cao (High Marks) trong Group Project. Bạn cần lên kế hoạch triển khai các phần khó như: fault tolerance (xử lý lỗi giữa các node), thiết kế smart controllers, hoặc tích hợp giao diện GUI/phần cứng tùy chỉnh.
    
- **Slide 19-20:** Mindset thiết kế. Xác định cấu trúc logic giải quyết vấn đề (Fact based, Hypothesis driven). Cần trình bày sơ đồ hệ thống dưới góc độ tư vấn (consultant) để mô phỏng một dự án công nghiệp thực tế, giúp khách hàng/developer thấy rõ chi phí, quy mô dự án và cách xử lý lỗi.
    

Bạn có thể chia lịch ra ôn mỗi ngày một Section, vừa đọc lý thuyết vừa thực hành vẽ lại các UML Diagram (như sơ đồ ATM hoặc Cruise Control) để hiểu tận gốc cách hoạt động của hệ thống thời gian thực nhé.
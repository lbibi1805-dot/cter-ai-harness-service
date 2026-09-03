### 1. Bốn Hướng tiếp cận xử lý Deadlock (Slide 6)

Có 4 phương pháp chính để đối phó với tình trạng bế tắc trong hệ thống.

|**Hướng tiếp cận**|**Cơ chế hoạt động**|**Đặc điểm & Nhược điểm**|
|---|---|---|
|**1. Deadlock Prevention**<br><br>  <br><br>_(Ngăn ngừa)_|Loại bỏ hoàn toàn khả năng xảy ra deadlock bằng cách loại bỏ 1 trong 4 điều kiện (Necessary conditions).|- Có thể dẫn đến hiệu suất sử dụng tài nguyên kém (ví dụ: làm tăng việc chuyển đổi task).|
|**2. Deadlock Avoidance**<br><br>  <br><br>_(Né tránh)_|Phát hiện và né tránh (side-step) khả năng xảy ra bế tắc ngay trước khi nó kịp xảy ra.|- Dùng các thuật toán dự báo (sẽ học chi tiết ở thuật toán Banker).|
|**3. Deadlock Detection**<br><br>  <br><br>_(Phát hiện)_|Phát hiện bế tắc sau khi nó đã xảy ra.|- Vấn đề đặt ra là phải làm gì sau khi phát hiện: Có thể phải xóa các tiến trình bị bế tắc (gây mất dữ liệu), hoặc phải khôi phục (roll back) / reset toàn bộ hệ thống.|
|**4. Deadlock Recovery**<br><br>  <br><br>_(Phục hồi)_|Phát hiện bế tắc và cố gắng phục hồi lại tất cả các tiến trình.|- Mã code để xử lý việc này sẽ rất lộn xộn (messy) và có tiềm năng gây ra các lỗi logic không mong muốn khác.<br><br>  <br><br>- Thường sử dụng các công cụ như watchdogs.|

### 2. Phân tích sâu: Chiến lược Deadlock Prevention (Slide 7 & 8)

Để ngăn ngừa (Prevention) Deadlock, ta phải phá vỡ được ít nhất 1 trong 4 điều kiện. Tuy nhiên, điều kiện **Mutual Exclusion (Loại trừ lẫn nhau)** là không thể tránh khỏi để đảm bảo an toàn, do đó ta chỉ có thể tập trung vào 3 điều kiện còn lại.

**A. Phá vỡ điều kiện "Hold and Wait" (Slide 7)**

- **Cách làm:** Bắt buộc các luồng (threads) phải yêu cầu tất cả các tài nguyên mà nó cần cùng một lúc.
    
- **Hệ quả:** Tiến trình có thể bị trì hoãn (không được giữ tài nguyên nào) nếu chưa có đủ toàn bộ tài nguyên. Việc này loại bỏ được "Hold and Wait" nên deadlock không thể xảy ra.
    
- **Nhược điểm:**
    
    - Rất dễ gây lãng phí tài nguyên nghiêm trọng và làm tăng kích thước của vùng găng (critical section).
        
    - Sự chậm trễ khi chờ đợi tài nguyên dễ dẫn đến việc trễ deadline, điều này đặc biệt tồi tệ đối với Hệ thống Thời gian thực (RTS).
        
    - Làm tăng khả năng phải chuyển đổi task (task switching).
        

**B. Phá vỡ điều kiện "No Preemption" (Slide 7)**

- **Cách làm:** Cho phép tước đoạt tài nguyên từ các tiến trình đang giữ chúng.
    
- **Nhược điểm:**
    
    - Tiến trình có thể bị mất toàn bộ công việc đã thực hiện cho đến thời điểm đó và có thể phải làm lại từ đầu.
        
    - Tồn tại rủi ro gây ra tình trạng "bỏ đói" (starvation) cho tiến trình.
        
- **Kết luận Slide 7:** Cả hai phương pháp trên (A và B) đều không phải là giải pháp tốt cho Hệ thống Thời gian thực vì chúng sẽ làm lỡ deadline, gây mất dữ liệu công việc và lãng phí tài nguyên CPU.
    

**C. Phá vỡ điều kiện "Circular Wait" (Slide 8)**

- **Cách làm:** Tránh việc chờ vòng tròn bằng cách sử dụng một hệ thống phân cấp (hierarchy) để sử dụng tài nguyên.
    
    - Tất cả tài nguyên phải được đánh số duy nhất.
        
    - Các tiến trình bắt buộc phải yêu cầu tài nguyên theo một trình tự tuyến tính tăng dần (linear ascending order) dựa trên số ID của tài nguyên.
        
- **Vấn đề gặp phải (Issues):**
    
    - Khó triển khai vì phần mềm phải biết toàn bộ danh sách tài nguyên và thứ tự của chúng.
        
    - Phần mềm bị phụ thuộc vào ID tài nguyên, có thể đòi hỏi các phiên bản giải pháp đặc biệt, độc nhất cho từng hệ thống.
        
    - Phải cập nhật phần mềm nếu có tài nguyên mới được thêm vào hệ thống.
        
    - Nói chung, giải pháp này không dễ mở rộng (not easily scalable) và phụ thuộc nền tảng rất nhiều (highly platform dependent).
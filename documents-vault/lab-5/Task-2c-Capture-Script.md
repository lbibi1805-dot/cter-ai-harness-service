### Chuẩn bị trước khi chụp:

1. **Build & Run** đoạn code mới cập nhật ở trên trong QNX Momentics.
    
2. Đảm bảo cửa sổ **Console** đang hiển thị rộng rãi, không bị che khuất để các đường kẻ phân cách (`--------------------------------------------------`) và các dòng thông báo `[SENSOR PROMPT]` hiện ra đẹp mắt.
    

### Kịch bản chụp ảnh chi tiết (Gồm 2 hình chính):

#### Hình 1: Minh họa cơ chế đọc phím qua Luồng riêng & Biến chia sẻ (State 2 - Đông-Tây Xanh)

- **Thao tác thực hiện trên QNX Console:**
    
    1. Khi chương trình chạy qua `State 0`, `State 1` và chuyển đến `State 2`, màn hình sẽ dừng lại và hiển thị dòng prompt: `-> [SENSOR PROMPT] Type 'n' (and press Enter) for North-South car:`
        
    2. Anh nhập ký tự **`n`** rồi nhấn **Enter**.
        
    3. Quan sát thấy màn hình lập tức in ra dòng thông báo: `-> SUCCESS: North-South car detected via shared variable! Changing lights...` và chuyển sang đèn vàng (`State 3`).
        
- **Khoảnh khắc chụp:** Anh hãy chụp lại cửa sổ console ngay đoạn này. Bức ảnh sẽ chứng minh được rằng luồng độc lập đã đọc được phím, ghi vào biến chia sẻ và máy trạng thái đã bốc dữ liệu đó ra để xử lý thành công.
    

#### Hình 2: Minh họa chu kỳ toàn cục qua đến State 5 & State 6 (Bắc-Nam Xanh)

- **Thao tác thực hiện tiếp theo:**
    
    1. Để chương trình tiếp tục chạy tự động qua các trạng thái tiếp theo cho đến khi tới `State 5` (Bắc-Nam Xanh).
        
    2. Tại dòng prompt của `State 5`: `-> [SENSOR PROMPT] Type 'e' (and press Enter) for East-West car:`
        
    3. Anh nhập ký tự **`e`** rồi nhấn **Enter** để kích hoạt cảm biến hướng Đông-Tây, giúp đèn chuyển sang vàng (`State 6`).
        
- **Khoảnh khắc chụp:** Chụp lại toàn bộ chuỗi hiển thị từ đầu vòng lặp thứ hai tới State 6.
    

### Gợi ý trình bày trong file Lab Note của báo cáo:

Khi đưa 2 bức ảnh này vào file báo cáo, anh có thể viết thêm chú thích bên dưới theo mẫu chuẩn sau để giảng viên đọc vào là hiểu ngay ưu điểm của kiến trúc đa luồng:

- **Đối với Hình 1:**
    
    > _"Hình minh họa Task 2C (Trạng thái EWG-NSR): Luồng đọc bàn phím chạy độc lập (`pthread`) ghi dữ liệu vào biến chia sẻ `shared_sensor`. Khi luồng máy trạng thái chạy đến `State 2`, nó phát hiện tín hiệu cảm biến `n` từ biến chia sẻ một cách không chặn (non-blocking) và tiến hành chuyển trạng thái đèn giao thông an toàn."_
    
- **Đối với Hình 2:**
    
    > _"Hình minh họa Task 2C (Trạng thái EWR-NSG): Kiểm chứng tính ổn định của hệ thống đa luồng qua chu kỳ tiếp theo tại `State 5`, xác nhận cơ chế giao tiếp giữa thread đọc phím và máy trạng thái hoạt động chính xác theo đúng yêu cầu thời gian thực."_
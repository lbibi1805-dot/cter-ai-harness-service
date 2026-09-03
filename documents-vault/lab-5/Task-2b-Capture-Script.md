Để chuẩn bị hình ảnh chụp màn hình (screen captures) cho phần báo cáo Lab Note của **Task 2B**, anh cần chụp lại quá trình tương tác cảm biến để chứng minh đúng yêu cầu đề bài: đèn giao thông sẽ giữ nguyên ở trạng thái xanh cho đến khi nhận được đúng ký tự cảm biến từ bàn phím (`n` hoặc `e`).

Anh nên chụp **2 hình ảnh màn hình console** sau đây để đưa vào báo cáo:

### Hình ảnh 1: Minh họa cảm biến hướng Bắc-Nam (`n`) khi đèn Đông-Tây đang xanh (`EWG_NSR`)

- **Cách thao tác trên QNX Console:**
    
    1. Chạy chương trình, quan sát nó tự động chạy qua các bước đầu và dừng lại ở `State 2` (Đông-Tây Xanh).
        
    2. Thử nhập một vài ký tự sai (ví dụ: gõ chữ `x` hoặc `a` rồi nhấn Enter) để màn hình hiển thị dòng thông báo không nhận diện được xe, và đèn vẫn giữ nguyên màu xanh.
        
    3. Sau đó, nhập đúng ký tự **`n`** (đại diện cho xe chờ ở hướng Bắc-Nam) rồi nhấn Enter.
        
    4. **Chụp lại màn hình console** đoạn này để thấy rõ cơ chế giữ trạng thái và chuyển đổi khi có cảm biến.
        
- **Nội dung hiển thị mong đợi trên ảnh chụp:**
    
    Plaintext
    
    ```
    [STATE 2] EWG-NSR: East-West is GREEN. (Waiting for North-South car sensor 'n')...
      -> Sensor trigger? (Type 'n' for North-South car): x
      -> No valid car detected. East-West light remains GREEN.
      -> Sensor trigger? (Type 'n' for North-South car): n
      -> North-South car detected! Changing lights...
    [STATE 3] EWY-NSR: East-West is YELLOW (Amber)
    ```
    

### Hình ảnh 2: Minh họa cảm biến hướng Đông-Tây (`e`) khi đèn Bắc-Nam đang xanh (`EWR_NSG`)

- **Cách thao tác trên QNX Console:**
    
    1. Tiếp tục để chương trình chạy tiếp qua các trạng thái tiếp theo cho đến khi dừng lại ở `State 5` (Bắc-Nam Xanh).
        
    2. Nhập ký tự **`e`** (đại diện cho xe chờ ở hướng Đông-Tây) rồi nhấn Enter để kích hoạt cảm biến chuyển làn.
        
    3. **Chụp lại màn hình console** đoạn này.
        
- **Nội dung hiển thị mong đợi trên ảnh chụp:**
    
    Plaintext
    
    ```
    [STATE 5] EWG-NSG: North-South is GREEN. (Waiting for East-West car sensor 'e')...
      -> Sensor trigger? (Type 'e' for East-West car): e
      -> East-West car detected! Changing lights...
    [STATE 6] EWR-NSY: North-South is YELLOW (Amber)
    ```
    

### Gợi ý cách viết chú thích cho Lab Note:

Khi đưa 2 bức ảnh này vào file báo cáo, anh viết kèm 1-2 câu giải thích ngắn gọn bên dưới mỗi hình theo mẫu sau:

- **Hình 1:** "Minh họa trạng thái EWG-NSR của Task 2B: Hệ thống giữ nguyên đèn xanh cho đến khi người dùng nhập đúng ký tự `n` để kích hoạt cảm biến hướng Bắc-Nam. Các ký tự nhập sai sẽ bị bỏ qua và giữ nguyên trạng thái đèn."
    
- **Hình 2:** "Minh họa trạng thái EWR-NSG của Task 2B: Đèn xanh hướng Bắc-Nam duy trì cho đến khi nhận được tín hiệu cảm biến `e` từ phía Đông-Tây để bắt đầu chu kỳ đổi đèn."
### QUY TRÌNH TỔNG QUÁT: THÊM PROJECT MỚI VÀO HỆ THỐNG TEST (N:1)

#### 1. Tại Project Ứng Dụng Mới (Project X)

Bạn code logic bình thường như một dự án C độc lập, chỉ cần tuân thủ 2 nguyên tắc vàng:

- **Quy tắc 1 (Giao tiếp C/C++):** Mọi file `.h` chứa khai báo hàm đều phải bọc trong khối `extern "C"`.
    
    C
    
    ```
    #ifdef __cplusplus
    extern "C" {
    #endif
    // Khai báo hàm của project mới ở đây...
    #ifdef __cplusplus
    }
    #endif
    ```
    
- **Quy tắc 2 (Cô lập điểm bắt đầu):** Phải đặt hàm `main()` của project này vào một file `.c` riêng biệt và có tên dễ nhận diện (VD: `smoke-test-4.c` hoặc `main.c`).
    
- **Hành động bắt buộc:** Sau khi code xong, phải nhấn **Build Project X** để IDE dịch ra các file `.o` mới nhất trong thư mục `build/`.
    

#### 2. Tại Project `test-center`: Cập nhật Makefile

Bạn mở Makefile của `test-center`, tìm đến đoạn `# --- KỊCH BẢN GOM OBJECT FILES ---` và khai báo thêm Project X theo 3 bước (Copy - Paste - Đổi tên):

- **Định nghĩa đường dẫn thư mục build của Project X:**
    
    Makefile
    
    ```
    APP4_BUILD_DIR = ../smoke-test-4/build/$(CONFIG_NAME)/src
    ```
    
- **Quét file `.o` và lọc bỏ file chứa hàm main():**
    
    Makefile
    
    ```
    ALL_APP4_O = $(call rwildcard, $(APP4_BUILD_DIR), o)
    # Nhớ đổi đuôi filter-out thành tên file chứa main() của project X
    APP4_O_FILTERED = $(filter-out %smoke-test-4.o, $(ALL_APP4_O)) 
    ```
    
- **Nạp vào cờ Linker (Thêm `APP4_O_FILTERED` vào dòng `LDFLAGS_all` có sẵn):**
    
    Makefile
    
    ```
    LDFLAGS_all += $(APP2_O_FILTERED) $(APP3_O_FILTERED) $(APP4_O_FILTERED)
    ```
    

#### 3. Tại Project `test-center`: Viết Test Code

- Vào thư mục `test-center/src/unit/`, tạo một file C++ mới (VD: `st4_feature_test.cpp`).
    
- Nhúng GTest và dùng đường dẫn lùi 3 cấp `../../../` để trỏ tới file `.h` của Project X.
    
    C++
    
    ```
    #include <gtest/gtest.h>
    #include "../../../smoke-test-4/src/feature_logic.h"
    
    TEST(NewFeatureTest, verify_logic) {
        // Viết các lệnh EXPECT_TRUE, EXPECT_EQ... tại đây
    }
    ```
    
- Nhấn chuột phải vào `test-center` -> **Clean Project** -> **Build Project**.
    
- Nhấn **Run** là xong!
    

Quy trình đã đóng gói cực kỳ gọn gàng. Bạn định commit luôn bộ khung kiến trúc xịn sò này lên Git, hay muốn tôi hướng dẫn tiếp phần `mock_hardware.cpp` để làm giả lập tín hiệu đèn/cảm biến cho dự án luôn?
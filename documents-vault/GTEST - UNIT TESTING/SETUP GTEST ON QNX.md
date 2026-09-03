

Quy trình này giúp tích hợp mã kiểm thử C++ (GTest) vào một dự án C thuần, cho phép linh hoạt chuyển đổi giữa việc chạy Ứng dụng chính (App) và chạy Mã kiểm thử (Test) trên cùng một dự án.

## 1. Chuẩn bị Mã Nguồn & Cấu trúc (Dùng công tắc Macro)

Để tránh lỗi `multiple definition of 'main'` và giải quyết xung đột trình biên dịch giữa C và C++, hệ thống cần được phân tách như sau:

- **File Header logic C (VD: `src/math_utils.h`):** Bắt buộc phải có khối `extern "C"` để file C++ (GTest) có thể gọi được hàm C mà không bị lỗi Linker.
    
    C
    
    ```
    #ifdef __cplusplus
    extern "C" {
    #endif
    // Khai báo hàm C ở đây...
    #ifdef __cplusplus
    }
    #endif
    ```
    
- **File Ứng dụng chính (VD: `src/smoke-test.c`):** Bọc hàm `main()` thực tế vào khối `#ifndef MODE_TEST`.
    
    C
    
    ```
    #ifndef MODE_TEST
    int main() { /* Logic của App */ return 0; }
    #endif
    ```
    
- **File Kiểm thử (VD: `test/test_main.cpp`):** Đặt trong thư mục `test` riêng biệt để dễ bảo trì. Bọc hàm `main()` của GTest vào khối `#ifdef MODE_TEST`. Trong file này, bắt buộc `#include <gtest/gtest.h>` và gọi `RUN_ALL_TESTS()`.
    
    C++
    
    ```
    #ifdef MODE_TEST
    int main(int argc, char **argv) {
        ::testing::InitGoogleTest(&argc, argv);
        return RUN_ALL_TESTS();
    }
    #endif
    ```
    

## 2. Cấu hình Makefile

Cần chỉnh sửa Makefile để hỗ trợ đồng thời file `.c` và `.cpp`, cũng như cung cấp thư viện GTest.

- **Linker:** Đổi `LD = $(CC)` thành `LD = $(CXX)` để dùng C++ linker.
    
- **Source List:** Gộp cả nguồn C và C++.
    
    Makefile
    
    ```
    SRCS_C = $(call rwildcard, src, c)
    SRCS_CPP = $(call rwildcard, test, cpp)
    SRCS = $(SRCS_C) $(SRCS_CPP)
    ```
    
- **Thư viện (LIBS):** Bắt buộc thêm `-Bdynamic -lregex -lgtest` để nạp GTest và Regex.
    
- **Compiling Rule:** Nhân bản rule biên dịch của `%.c` và sửa thành `%.cpp` đi kèm với trình biên dịch `$(CXX)`.
    
- **Công tắc Test:** Để bật chế độ Test, thêm dòng `CCFLAGS_all += -DMODE_TEST`. Để tắt (chạy App), hãy comment/xóa dòng này đi.
    

## 3. Thiết lập Launch Configuration (Trên QNX IDE)

Trong Launch Configuration > chế độ **Run** > chọn đúng Target, thao tác sẽ khác nhau tùy vào "công tắc" bạn đang bật hay tắt. Luôn nhớ Clean và Build lại project mỗi khi gạt công tắc.

**A. Khi chạy chế độ kiểm thử (Bật `-DMODE_TEST`):**

- **Tab Arguments:** Đánh dấu chọn ô **Test Runner** và chọn **GoogleTest**.
    
- **Tab Upload:** Bắt buộc tích chọn `libgtest.so` và `libregex.so`.
    
- **Kết quả:** Xem tại cửa sổ/tab **C/C++ Unit** để thấy thanh tiến trình và các dấu tích xanh.
    

**B. Khi chạy chế độ Ứng dụng gốc (Tắt `-DMODE_TEST`):**

- **Tab Arguments:** **BỎ** đánh dấu ô **Test Runner**.
    
- **Kết quả:** Mở tab **Console** ở phía dưới IDE để xem các dòng log/printf của chương trình.
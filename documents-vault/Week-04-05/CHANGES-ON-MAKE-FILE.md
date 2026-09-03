Dưới đây là chi tiết 5 vị trí mà chúng ta đã thêm vào hoặc chỉnh sửa so với Makefile gốc để hệ thống có thể biên dịch và chạy được mã kiểm thử GTest:

**1. Đổi Trình liên kết (Linker) sang C++** Để nối được các file C++ của thư viện GTest, chúng ta đã đổi `LD` từ `$(CC)` (trình biên dịch C) sang `$(CXX)` (trình biên dịch C++).

Makefile

```
LD = $(CXX)
```

**2. Thêm thư viện GoogleTest và Regex** Dòng này được thêm vào biến `LIBS` để báo cho trình Linker kéo theo thư viện động của GTest và Regex vào file thực thi.

Makefile

```
LIBS += -Bdynamic -lregex -lgtest
```

**3. Thêm "Công tắc" Macro `#ifdef`** Dòng này tạo ra một biến môi trường `MODE_TEST` để bật/tắt chế độ test ngay trong mã nguồn. Hiện tại nó đang được đóng (comment bằng dấu `#`).

Makefile

```
#CCFLAGS_all += -DMODE_TEST  # <-- THÊM DÒNG NÀY VÀO ĐỂ BẬT CHẾ ĐỘ TEST
```

**4. Bổ sung nguồn quét file `.cpp` trong thư mục `test`** Thay vì chỉ quét file `.c` trong thư mục `src` như cũ, chúng ta đã tách ra quét cả 2 thư mục và gộp lại vào biến `SRCS`.

Makefile

```
#SRCS = $(call rwildcard, src, c)
SRCS_C = $(call rwildcard, src, c)
SRCS_CPP = $(call rwildcard, test, cpp)
SRCS = $(SRCS_C) $(SRCS_CPP)
```

**5. Thêm quy tắc biên dịch (Compiling rule) riêng cho C++** Đoạn này hướng dẫn Make cách biến đổi các file `.cpp` thành file object `.o` bằng cách sử dụng trình biên dịch `$(CXX)`.

Makefile

```
$(OUTPUT_DIR)/%.o: %.cpp
	@mkdir -p $(dir $@)
	$(CXX) -c $(DEPS) -o $@ $(INCLUDES) $(CCFLAGS_all) $(CCFLAGS) $<
```
### Bảng so sánh kích thước kiểu dữ liệu (Bits)

|**Loại dữ liệu**|**Kích thước trên 32-bit**|**Kích thước trên 64-bit**|**Lưu ý**|
|---|---|---|---|
|`char`|8|8|Không đổi|
|`int`|32|32|Không đổi|
|**`long`**|32|**64**|**Thay đổi**|
|`long long`|64|64|Không đổi|
|**`off_t`**|signed 32|**signed 64**|**Thay đổi**|
|**`paddr_t`**|unsigned 32|**unsigned 64**|**Thay đổi**|
|**`ptrdiff_t`**|32|**64**|**Thay đổi**|
|`short`|16|16|Không đổi|
|**`size_t`, `ssize_t`**|32|**64**|**Thay đổi**|
|**`time_t`**|unsigned 32|**signed 64**|**Thay đổi**|
|**`uintptr_t`, `intptr_t`**|32|**64**|**Thay đổi**|
|**`void *`**|32|**64**|**Thay đổi**|

### Tại sao Bách cần thuộc lòng bảng này?

1. **Vấn đề đóng gói (Padding & Alignment):** Khi bạn gửi một `struct` từ máy 32-bit sang 64-bit, nếu trong `struct` đó có các kiểu dữ liệu trên (đặc biệt là con trỏ `void *` hoặc `long`), trình biên dịch ở hai máy sẽ sắp xếp các ô nhớ khác nhau. Kết quả là bên nhận sẽ giải mã sai toàn bộ nội dung thông điệp.
    
2. **Quy tắc vàng trong Lab:**
    
    - **Sử dụng kiểu dữ liệu cố định:** Luôn ưu tiên dùng `uint16_t`, `uint32_t`, `int32_t` cho các trường cần kích thước đồng nhất trên mọi kiến trúc.
        
    - **Tránh truyền con trỏ:** Tuyệt đối không gửi `void *` hoặc bất kỳ loại con trỏ nào qua mạng, vì địa chỉ bộ nhớ ở máy này hoàn toàn vô nghĩa ở máy kia.
        
    - **Header đầu tiên:** Luôn đặt `msg_header_t` lên đầu mỗi `struct` tin nhắn để bên nhận biết cách xử lý dữ liệu tiếp theo.
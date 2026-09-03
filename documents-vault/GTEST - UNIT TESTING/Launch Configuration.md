

Cách thiết lập lại cấu hình Launch Configuration cho project mới này (giống hệt đợt trước chúng ta làm):

1. Trên thanh công cụ, nhấn vào biểu tượng bánh răng/cây bút (Edit) bên cạnh nút Run để mở cửa sổ **Launch Configuration**.
    
2. Chọn đúng cấu hình của project `test-center`.
    
3. Chuyển sang tab **Upload**.
    
4. Kéo xuống tìm và **đánh dấu tích vào các ô** `libgtest.so.1.7` (hoặc `libgtest.so`) và `libregex.so`.
    
5. Sang tab **Arguments**, nhớ đảm bảo đã tích chọn ô **Test Runner** và chọn GoogleTest.
    
6. Nhấn **Apply** rồi **Run**.
    

Bạn check lại cái tab Upload xem đã tích đủ thư viện chưa rồi Run lại nhé, đảm bảo dàn tích xanh sẽ hiện lên ngay!
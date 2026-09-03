Thông thường, khi bạn viết code C trên máy tính Windows, phần mềm biên dịch sẽ tạo ra file chạy (`.exe`) dành riêng cho chip Intel hoặc AMD (gọi chung là kiến trúc **x86** hoặc **x86_64**). Máy ảo VMware bạn đang chạy cũng mô phỏng chip x86 này.

Tuy nhiên, trong thế giới phần cứng và hệ thống nhúng, có một loại chip khác cực kỳ phổ biến là chip **ARM** (giống chip trong điện thoại, hoặc các bo mạch phần cứng thật ở phòng Lab của trường như BeagleBone Black, DE10).
- **ARMv7:** Là tên phiên bản kiến trúc của con chip ARM (32-bit).
    
- **le (Little Endian):** Là cách con chip này sắp xếp các byte dữ liệu trong bộ nhớ (xếp từ byte thấp đến byte cao).
    
- **arm/le binary:** Nghĩa là file thực thi sau khi biên dịch xong chỉ dành riêng cho chip ARM chạy kiểu Little Endian. Nếu bạn cầm file này ném vào máy ảo x86 trên máy tính của bạn, máy ảo sẽ hoàn toàn "ngơ ngác" không hiểu và không chạy được.

Phần mềm Momentics hỗ trợ biên dịch một lúc ra cả 2 phiên bản: một file để chạy thử trên máy ảo (x86_64) và một file để nạp vào bo mạch thật (ARMv7le).

**Ví dụ trực quan: Câu chuyện dịch sách**

- **Máy tính Windows của bạn (Kiến trúc x86):** Giống như một nhà văn chỉ biết nói **tiếng Việt**.
    
- **Máy ảo VMware QNX (Cũng x86):** Giống như một người bạn cũng nói **tiếng Việt**. Bạn viết xong cuốn sách (code C), đưa cho người này đọc (chạy file binary), họ hiểu ngay lập tức.
    
- **Bo mạch phần cứng thật (Kiến trúc ARM):** Giống như một người **tiếng Nhật**. Nếu bạn bê nguyên file code vừa chạy trên máy ảo đưa cho bo mạch này, nó sẽ báo lỗi không hiểu gì cả.
    
- **Biên dịch chéo (Cross-Compile):** Để người Nhật hiểu, phần mềm Momentics của bạn phải đóng vai trò là "Phiên dịch viên". Khi bạn bấm nút Build cho ARM, Momentics sẽ dịch file code của bạn sang tiếng Nhật. Cái file "tiếng Nhật" đó chính là **arm/le binary**.
    

**Tổng hợp: ARMv7le cụ thể là cái gì?** Nó là một bộ tiêu chuẩn thiết kế lõi chip, viết tắt của:

- **ARM (Advanced RISC Machine):** Dòng chip tối ưu hóa cho việc tiết kiệm điện và kích thước nhỏ. Khác hoàn toàn với chip Intel/AMD (x86) to bự và ngốn điện trên laptop của bạn.
    
- **v7:** Là phiên bản thứ 7 của dòng kiến trúc này (hiện tại smartphone đời mới đã dùng đến v8 hoặc v9).
    
- **le (Little-Endian):** Cách con chip này đọc dữ liệu. Nó đọc các byte nhỏ nhất trước rồi mới đến byte lớn.
    

**Các "Instances" (Ví dụ thực tế) sử dụng chip ARMv7le:** Vì đặc tính nhỏ, rẻ, ít tốn pin nên ARMv7le không dùng cho máy tính bàn, mà được nhúng thẳng vào các thiết bị thực tế:

- **Trong phòng Lab trường:** Bo mạch BeagleBone Black, bo mạch DE10-Nano, Raspberry Pi 2.
    
- **Trong đời sống:** Cục phát Wifi (Router) nhà bạn đang dùng, Smart TV, hệ thống màn hình giải trí trên xe hơi, máy quẹt thẻ POS, camera an ninh, và các dòng điện thoại thông minh/máy tính bảng đời cũ.
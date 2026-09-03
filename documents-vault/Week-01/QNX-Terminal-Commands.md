Mục đích cốt lõi của việc này nằm ở mô hình **Host - Target (Máy trạm - Máy đích)**, một đặc trưng bắt buộc trong ngành phát triển Hệ thống nhúng (Embedded Systems).

Tưởng tượng việc này cũng khá tương đồng với tư duy khi bạn phát triển một hệ thống backend (như Java Spring Boot). Bạn dùng IDE trên máy tính cá nhân để gõ code và biên dịch, nhưng cuối cùng file chạy (như file `.jar`) phải được đưa lên môi trường server thật (như Linux/PostgreSQL) thì mới hoạt động đúng chức năng được.

Đối với lập trình C trên QNX, có 4 lý do chính giải thích tại sao bạn phải chạy lệnh trên VM thay vì chạy thẳng trên máy tính:

**1. Khác biệt Hệ điều hành (Môi trường bắt buộc)**

Hệ điều hành Windows (hay Mac/Ubuntu bình thường) của bạn không có kiến trúc Microkernel của QNX và không hiểu được các thư viện thời gian thực (như `<sys/neutrino.h>`). Nếu bạn bấm chạy trực tiếp file `.bin` trên Windows, Windows sẽ báo lỗi không nhận diện được. Máy ảo VM (Target) cung cấp đúng "hệ sinh thái" QNX để code của bạn có thể sống và chạy được.

**2. Đóng giả bo mạch phần cứng thực (Hardware Simulation)** Trong môi trường công nghiệp thực tế, sau khi code xong trên máy tính, bạn sẽ phải dùng cáp mạng nạp cái file thực thi đó vào các con chip nhúng thật nằm trong ô tô hay thiết bị y tế (như board mạch BeagleBone Black, i.MX6). Vì chúng ta không có phần cứng thật, máy ảo VirtualBox được sinh ra để "đóng giả" làm các bo mạch đó.

**3. Kiểm chứng tính Thời gian thực (Real-Time Testing)**

Dự án bạn đang làm là `CooperativeSheduling` (Lập lịch hợp tác). Để kiểm tra xem các luồng (threads) hay tác vụ có thực sự nhường CPU cho nhau đúng từng mili-giây như code bạn viết hay không, nó bắt buộc phải được điều phối bởi ông "Nhạc trưởng" là Bộ lập lịch (Scheduler) của QNX. Nếu bạn ép nó chạy trên Windows, Windows sẽ quản lý thời gian theo cách riêng của nó (ưu tiên trải nghiệm đa phương tiện), làm phá vỡ hoàn toàn tính "thời gian thực" của bài toán.

**4. Làm quen với thao tác Deploy thực tế**

Việc bạn dùng Terminal chuyển file vào `/tmp` rồi gõ lệnh `./CooperativeSheduling` để chạy chính là cách mô phỏng lại chính xác 100% cảnh một kỹ sư cắm cáp nối vào thiết bị phần cứng, điều khiển từ xa thông qua giao thức mạng và ra lệnh cho thiết bị đó chạy thử tính năng mới.

### 1. Bạn sẽ chạy các lệnh này ở đâu?

Theo hướng dẫn trong mục 10 và 10.2, bạn sẽ gõ và chạy các lệnh này tại **Terminal của QNX**. Cụ thể:

PDF

- **Vị trí gõ lệnh:** Bạn có thể sử dụng màn hình Terminal trực tiếp trên máy ảo VM hoặc thông qua kết nối telnet vào máy đích (Target). Khi mở Terminal lên, bạn phải gõ các lệnh này ngay tại vị trí có **dấu nhắc lệnh `#`** (prompt).
    
    PDF+ 1
    
- **Lưu ý quan trọng:** Tất cả các lệnh và tên file trong hệ điều hành QNX đều **phân biệt chữ hoa và chữ thường** (case sensitive).
    
    PDF
    
- **Cách chạy chương trình bạn tự code:**
    
    1. Đầu tiên, bạn dùng QNX Target File explorer trong IDE để kéo thả (copy) file thực thi (executable) vừa biên dịch từ thư mục `build` của dự án sang thư mục `/tmp` trên máy ảo QNX.
        
        PDF
        
    2. Tại Terminal của QNX (ở dấu nhắc `#`), bạn gõ lệnh `./tên_file_của_bạn` để chạy chương trình đó.
        
        PDF
        

### 2. Bảng tóm tắt các lệnh Terminal cơ bản trong QNX (Mục 10.1)

Dưới đây là bảng tổng hợp các lệnh thường dùng để thao tác với máy ảo QNX:

**CLEAR TERMINAL COMMAND:** *CRTL + L*

PDF

| Lệnh (Command) | Chức năng (Description)                                             | Ví dụ / Hướng dẫn thêm                                                                                                             |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `uname -a`     | Hiển thị phiên bản phát hành của kernel trên hệ thống.<br><br>PDF   |                                                                                                                                    |
| `pwd`          | In ra đường dẫn của thư mục hiện tại đang đứng.<br><br>PDF          |                                                                                                                                    |
| `ls`           | Liệt kê danh sách thư mục dạng ngắn (chỉ hiện tên file).<br><br>PDF |                                                                                                                                    |
| `ls -l`        | Liệt kê danh sách thư mục dạng dài (chi tiết hơn).<br><br>PDF       |                                                                                                                                    |
| `less`         | Hiển thị nội dung file văn bản theo từng trang một.<br><br>PDF      | Gõ `Space` hoặc `f` để cuộn tới, `b` để cuộn lùi, `q` để thoát.<br><br>PDF                                                         |
| `vi`           | Chỉnh sửa file văn bản bằng trình soạn thảo vi.<br><br>PDF          | Ví dụ: `vi textfile`.<br><br>PDF                                                                                                   |
| `cd`           | Chuyển sang một thư mục khác.<br><br>PDF                            | Ví dụ: `cd /home/student`.<br><br>PDF                                                                                              |
| `su root`      | Tạm thời mượn quyền của người dùng khác (ở đây là root).<br><br>PDF | Bấm `Ctrl-D` để thoát chế độ. Không cần thiết nếu bạn đã đăng nhập là root.<br><br>PDF                                             |
| `clear`        | Xóa sạch màn hình terminal.<br><br>PDF                              |                                                                                                                                    |
| `cat`          | Nối file và in nội dung ra màn hình.<br><br>PDF                     | `cat textfile` (In nội dung file ra màn hình), `cat file1 file2 > newfile` (Nối file 1 và file 2 thành một file mới).<br><br>PDF   |
| `chmod`        | Thay đổi quyền truy cập của file.<br><br>PDF                        | Ví dụ: `chmod 755 afile` (Cấp quyền đọc/ghi/thực thi cho chủ sở hữu, và quyền đọc/thực thi cho người khác).<br><br>PDF             |
| `cp`           | Copy file.<br><br>PDF                                               | Ví dụ: `cp file1 file2` (Copy file1 thành file2), `cp file1 file2 dir3` (Copy file1 và file2 vào thư mục dir3).<br><br>PDF         |
| `kill`         | Chấm dứt hoặc gửi tín hiệu đến một tiến trình.<br><br>PDF           | Ví dụ: `kill pid` (Giết tiến trình có mã là pid).<br><br>PDF                                                                       |
| `mv`           | Di chuyển hoặc đổi tên file.<br><br>PDF                             | Ví dụ: `mv file1 file2` (Đổi tên file1 thành file2), `mv file1 file2 dir3` (Di chuyển file1 và file2 vào thư mục dir3).<br><br>PDF |
| `on`           | Thực thi một lệnh trên một terminal khác.<br><br>PDF                | Ví dụ: `on -t ttyp2 command [args]` (Thực thi lệnh trên Terminal 2).<br><br>PDF                                                    |
| `pidin`        | Hiển thị số liệu thống kê về các tiến trình đang chạy.<br><br>PDF   | Lệnh này có rất nhiều tùy chọn đi kèm, bạn có thể xem thêm trong Help.<br><br>PDF                                                  |
| `ps`           | Báo cáo trạng thái của tiến trình.<br><br>PDF                       | Xem Help để biết thêm tùy chọn.<br><br>PDF                                                                                         |
| `rm`           | Xóa file.<br><br>PDF                                                | Ví dụ: `rm file1 file2` (Xóa file1 và file2), `rm -r dir3` (Xóa đệ quy thư mục dir3 và toàn bộ nội dung bên trong nó).<br><br>PDF  |
| `rmdir`        | Xóa một thư mục trống.<br><br>PDF                                   |                                                                                                                                    |
| `shutdown`     | Khởi động lại (Restart) máy đích QNX.<br><br>PDF                    |                                                                                                                                    |
| `shutdown -b`  | Tắt nguồn (Power off) máy đích QNX.<br><br>PDF                      |                                                                                                                                    |
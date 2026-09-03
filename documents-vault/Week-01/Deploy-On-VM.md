### BỘ CẨM NANG DEPLOY & TƯƠNG TÁC QNX (Dành cho Bách)

#### 1. Quy trình Deploy (Từ IDE sang Target VM)

- **Build:** Chuột phải vào Project trong IDE > **Build Project**.
    
- **Deploy:** 1. Mở view `Target File System Navigator`. 2. Kéo file thực thi (có biểu tượng "vụ nổ sao" trong `build/x86_64-debug`) thả vào thư mục **`/tmp`** của máy ảo `vm1`.
    
- **Phân quyền (nếu cần):** Nếu chạy bị báo lỗi `Permission denied`, gõ lệnh: `chmod 755 /tmp/Tên_File_Của_Bác`
    

#### 2. Tương tác với Target VM (Màn hình Terminal)

Mỗi lần khởi động lại máy ảo (`vm1`), hệ thống sẽ "quên" cấu hình mạng. Bạn cần thực hiện các lệnh sau để máy ảo có thể giao tiếp:

- **Kích hoạt mạng:** `io-pkt-v6-hc` `mount -T io-pkt lsm-qnet.so`
    
- **Kích hoạt hàng đợi tin nhắn (POSIX message queues):** `mqueue`
    
- **Chạy chương trình:** `cd /tmp` `./Tên_File_Của_Bác` (Sử dụng phím **Tab** để tự động hoàn thiện tên file).
    

#### 3. Bộ lệnh "cứu cánh" khi lạc đường

- **Liệt kê file:** `ls -l` (Xem chi tiết file, bao gồm quyền thực thi `x`).
    
- **Xem đường dẫn hiện tại:** `pwd`
    
- **Dọn màn hình:** `Ctrl + L` (Thay vì lệnh `clear` không tồn tại).
    
- **Dừng/Kết thúc chương trình đang chạy:** Bấm `Ctrl + C`.
    
- **Tắt máy ảo:** `shutdown -b`
    

### Lời khuyên "xương máu" để làm Lab:

1. **Đừng sửa file hệ thống nếu không cần thiết:** Lúc đầu thầy cô có thể bảo bạn sửa file cấu hình, nhưng nếu chưa chắc chắn, cứ gõ tay các lệnh ở **Mục 2** cho an toàn. Khi nào quen rồi hãy tìm hiểu cách nhét chúng vào `startup.sh`.
    
2. **Luôn để ý `ls -l`:** Nếu gõ lệnh mà máy báo `No such file`, gõ `ls -l` ngay lập tức để kiểm tra xem mình có đang đứng nhầm thư mục hay gõ sai chính tả không.
    
3. **Tận dụng IDE:** Đừng ép mình làm mọi thứ trên màn hình đen. Hãy dùng IDE để viết code, debug, và xem log qua tab `Console` của IDE. Màn hình đen (`vm1`) chỉ nên dùng để kiểm tra các tiến trình thực tế đang chạy trên máy ảo bằng lệnh `pidin` hoặc `ps`.

_____________
GIải thích chi tiết hơn
### Quy trình "Từ Code đến Máy ảo" (Dành cho dự án `CooperativeSheduling`)

|**Bước**|**Hành động**|**Sản phẩm (File/Kết quả tạo ra)**|**Mục đích**|
|---|---|---|---|
|**1. Build**|`Build Project` trên IDE|File **Binary** (Ví dụ: `CooperativeSheduling - [x86_64/le]`)|Chuyển đổi mã nguồn C của bạn thành ngôn ngữ mà CPU của máy ảo hiểu được.|
|**2. Deploy**|Kéo-Thả vào `/tmp`|File này xuất hiện trong máy ảo (`vm1`)|Đưa "lệnh" vào đúng "địa điểm" mà máy ảo có thể với tới để thực thi.|
|**3. Setup**|Gõ `io-pkt...` & `mqueue`|Dịch vụ mạng & hàng đợi hoạt động ngầm|Cấp "điện" và "không khí" cho máy ảo để nó biết giao tiếp và xử lý đa nhiệm.|
|**4. Execute**|Gõ `./Tên_File`|Màn hình đen in ra kết quả (Log)|Ra lệnh cho CPU bắt đầu "đọc và chạy" file Binary đã đưa vào.|

### Giải thích kỹ hơn về "Sản phẩm" ở mỗi bước:

#### Bước 1: Sản phẩm là File Binary (Ngôn ngữ máy)

- **Tại sao cần?** Code `.c` chỉ là văn bản bạn gõ. Khi bạn `Build`, IDE gọi trình biên dịch (compiler) biến văn bản đó thành các chỉ thị số (0 và 1) mà CPU x86_64 của máy ảo mới "đọc" được.
    
- **Dấu hiệu nhận biết:** Nó nằm trong thư mục `build/x86_64-debug` và có biểu tượng lạ (thường là hình chip hoặc hình ngôi sao). **Đây là trái tim của chương trình.**
    

#### Bước 2: Sản phẩm là "Sự hiện diện" trong `/tmp`

- **Tại sao cần?** IDE và máy ảo VM là hai thực thể khác nhau. IDE giống như "xưởng sản xuất", còn `/tmp` trên máy ảo VM giống như "kho trung chuyển". Bạn phải đưa hàng ra kho thì mới lắp vào máy được.
    
- **Lưu ý:** Thư mục `/tmp` là thư mục "tạm". Dữ liệu ở đây có thể mất khi bạn khởi động lại máy ảo, nên nó cực kỳ an toàn cho việc test code mà không làm hỏng file hệ thống của QNX.
    

#### Bước 3: Sản phẩm là "Môi trường sống" cho chương trình

- **Tại sao cần?** Chương trình của bạn có thể cần in log ra mạng, hoặc dùng cơ chế đợi tin nhắn. Nếu bạn không chạy `mqueue` hay `io-pkt`, chương trình sẽ bị "nghẹt thở" ngay khi vừa chạy (báo lỗi thiếu thư viện/dịch vụ).
    
- **Hình dung:** Giống như lắp động cơ vào xe nhưng chưa đổ xăng. Máy có đó nhưng không nổ được.
    

#### Bước 4: Sản phẩm là "Luồng xử lý" (Process)

- **Tại sao cần?** Khi bạn gõ `./...`, hệ điều hành QNX tạo ra một **Process** (tiến trình). Lúc này, file Binary từ "vật chết" (nằm trong ổ cứng) biến thành "vật sống" (được nạp vào RAM và CPU bắt đầu nhai).
    
- **Kết quả:** Bạn sẽ thấy màn hình hiện ra kết quả in ấn. Nếu có lỗi, nó sẽ "la" lên ngay trên màn hình đen này, giúp bạn debug thời gian thực .
    

**Mẹo nhớ nhanh:**

- **Build** = Xay bột (từ hạt gạo).
    
- **Deploy** = Đổ bột vào khuôn.
    
- **Setup** = Bật lò nướng.
    
- **Execute** = Thành phẩm bánh ra đời.
    

Bác thấy quy trình này đã "ngấm" hơn chưa? Nếu bác muốn biết file Binary đó cấu tạo ra sao (gồm những section gì), mình có thể giải thích thêm về phần `Binaries` mà bác nhìn thấy trong cây thư mục IDE!

_____
### **DIỄN GIẢI CHI TIẾT**
### 1. Sơ đồ Kiến trúc hệ thống (Development Environment)

Hãy tưởng tượng hệ thống của bạn như một ngôi nhà (Máy Host) và một nhà máy sản xuất (Máy Target/VM).

Plaintext

```
[ MÁY HOST (Windows/Ubuntu) ]              [ MÁY TARGET (VM - QNX) ]
+----------------------------+            +---------------------------+
|   QNX Momentics IDE        |            |   (Bên trong VM)          |
| +------------------------+ |  Kết nối   | +-----------------------+ |
| | Source Code (.c, .h)   | |  (Network)| | QNX RTOS Kernel       | |
| +------------+-----------+ | <--------> | | (Quản lý tiến trình)  | |
|              | Build (Compile)          | +---+---+---+---+-------+ |
|              v             |   Gửi file |     |   |   |   |       | |
| +------------------------+ |  (Deploy)  | +---+---+---+---+-----+ | |
| | Binary File (.bin)     +------------->| | /tmp (Chứa Binary)  | | |
| +------------------------+ |            | +---------------------+ | |
+----------------------------+            +---------------------------+
```

### 2. Trực quan hóa luồng "Lệnh thần thánh" (Hostname & QNET)

Bách hãy tưởng tượng **Target VM** giống như một **căn hộ** trong một tòa nhà chung cư (mạng nội bộ).

1. **Hostname (Tên định danh):**
    
    - Mỗi căn hộ phải có **Số nhà** (ví dụ: `vm1`). Nếu không có số nhà, người đưa thư (IDE của bạn) không biết phải ném thư (file binary) vào cửa nào.
        
    - Lệnh `hostname vm1` chính là hành động dán cái biển số nhà `vm1` lên cửa căn hộ đó.
        
2. **QNET Service (Đường ống thông tin):**
    
    - Nếu Hostname giúp định vị căn hộ, thì QNET là **Hệ thống ống dẫn** nối thẳng từ IDE vào trong căn hộ.
        
    - `io-pkt-v6-hc`: Là hành động **mở khóa van tổng** đường ống.
        
    - `mount -T io-pkt lsm-qnet.so`: Là hành động **nối ống** từ ngoài vào căn hộ. Sau khi nối xong, căn hộ đó hiện ra cái "cổng kết nối" tên là thư mục `/net`.
        
    - **Kết quả:** IDE của bạn giờ đây nhìn thấy thư mục `/net/vm1/tmp` của máy ảo như thể nó là một thư mục nằm ngay trên ổ cứng máy tính của bạn. Bạn thả file vào đó, nó "trôi" thẳng vào máy ảo.
        

### 3. Tại sao phải gõ tay? (Góc nhìn "Kỹ sư")

Thầy cô bắt bạn gõ 3 lệnh đó vì bạn đang làm việc ở **tầng thấp nhất (Low-level)**:

- **Bare-metal mindset:** Trong môi trường nhúng, hệ điều hành không tự thông minh bật mọi thứ lên cho bạn (vì như thế rất tốn RAM/CPU - những tài nguyên cực kỳ quý giá).
    
- **Kiểm soát:** Bạn gõ tay là bạn đang **đích thân cấu hình hệ thống**. Nếu bạn bị lỗi mạng, bạn biết ngay van nào (driver mạng) chưa mở, ống nào (QNET) chưa nối.
    

### Tóm tắt trực quan để nhớ:

- **Build:** Xay lúa thành gạo (Code -> Binary).
    
- **Deploy:** Chuyển gạo vào kho (File -> `/tmp` trên VM).
    
- **QNET/Hostname:** Xây dựng địa chỉ và đường ống để chuyển gạo.
    
- **Execute (`./...`):** Bật bếp nấu cơm (Chạy binary trên QNX).
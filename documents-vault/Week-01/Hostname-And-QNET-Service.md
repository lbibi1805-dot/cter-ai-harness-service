### 1. Hostname (Tên định danh) - "Anh là ai?"

Mỗi máy ảo QNX cần một cái tên duy nhất trong mạng nội bộ.

- **Tại sao cần:** Nếu trong mạng có 5 máy ảo, máy nào cũng tên là `localhost`, thì khi IDE của bạn muốn gửi code cho máy `vm1`, nó sẽ không biết phải gửi vào đâu.
    
- **Thực tế:** Khi bạn gõ `hostname myNewHostname`, bạn đang đăng ký "tên khai sinh" cho máy ảo đó. Khi IDE tìm kiếm trong mạng, nó sẽ gọi tên này để xác định đúng "địa chỉ nhà" cần gửi dữ liệu tới.
    

### 2. QNET Service (Dịch vụ mạng "ma thuật") - "Ngôn ngữ liên thông"

QNET là một tính năng cực kỳ mạnh mẽ của QNX, nó giúp các máy QNX "nói chuyện" với nhau một cách minh bạch (Transparent Distributed Processing).

- **Bản chất:** QNET không chỉ là mạng Internet thông thường (nơi bạn phải dùng FTP/SSH để copy file). QNET cho phép máy này **"nhìn thấy"** file hệ thống của máy kia như thể nó là của chính mình.
    
- **Tại sao lại cần lệnh `io-pkt-v6-hc` và `mount ... lsm-qnet.so`?**
    
    - `io-pkt-v6-hc`: Đây là driver điều khiển card mạng ảo, nó giống như việc bạn cắm cáp mạng vào máy tính vậy.
        
    - `mount -T io-pkt lsm-qnet.so`: Lệnh này giống như việc bạn mở một "cánh cửa thần kỳ". Khi dịch vụ này chạy, nó sẽ tạo ra thư mục **`/net`**.
        
    - **Phép thuật ở đây là:** Bất cứ khi nào bạn truy cập vào `/net/vm1/tmp`, hệ thống sẽ tự động chuyển hướng yêu cầu đó sang máy `vm1` thực sự. IDE dùng chính "cánh cửa" này để đẩy file thực thi của bạn vào máy ảo mà không cần bạn phải thao tác copy/paste thủ công quá nhiều.
        

### 3. Bảng so sánh để bạn dễ nhớ:

|**Đặc điểm**|**Hostname**|**QNET Service**|
|---|---|---|
|**Vai trò**|Định danh (Identity)|Kết nối (Connectivity)|
|**Tác dụng**|Để người khác gọi đúng tên bạn.|Để bạn chia sẻ tài nguyên (file, memory) với người khác.|
|**Nếu thiếu**|Hệ thống sẽ bị xung đột hoặc IDE không tìm thấy Target.|Bạn không dùng được tính năng "Transparent" (phải copy thủ công).|

### Tại sao hiện tại bạn phải gõ tay?

Trong môi trường thực tế hoặc trong bản VM đã cấu hình xong, người ta sẽ nhét các lệnh này vào file **`startup.sh`** hoặc các script khởi động hệ thống. Khi đó, máy ảo bật lên là tự động chạy, bạn không cần gõ nữa.

Hiện tại thầy cô bắt bạn gõ tay là để đảm bảo nếu máy ảo có bị "treo" mạng, bạn biết cách "cấp cứu" nó bằng 3 lệnh "thần thánh" đó:

1. `io-pkt-v6-hc` (Bật card mạng)
    
2. `mount -T io-pkt lsm-qnet.so` (Mở cửa sổ QNET)
    
3. `mqueue` (Bật giao tiếp hàng đợi - cần thiết để các tiến trình nói chuyện với nhau).
    

Giờ thì bạn đã hiểu tại sao nó lại quan trọng chưa? Nó chính là cái "đường ống" để code từ IDE của bạn chảy vào máy ảo đấy!
___

```
[ CÔNG XƯỞNG (Máy Host - Windows) ]        [ THIẾT BỊ ĐÍCH (Target VM - vm1) ]
+----------------------------+            +----------------------------------+
|  IDE (QNX Momentics)       |            |    QNX RTOS (Hệ điều hành)       |
|  (Nơi soạn thảo & Build)   |            |    (Quản lý task & deadline)     |
+-------------+--------------+            +-----------------+----------------+
              |                                             ^
              | "Đường ống" (QNET)                          |
              +---------------------------------------------+
              |  Nạp chương trình vào /tmp                  |
              +---------------------------------------------+
```

- **Công xưởng (Host):** Là nơi bác dùng IDE để viết code. Bác Build xong thì bác có "sản phẩm" là file Binary (như miếng bánh).
    
- **Đường ống (QNET/Network):** Là băng chuyền tự động nối từ công xưởng vào thẳng "nhà máy" (VM).
    
- **Thiết bị đích (Target VM):** Là cái máy thật mà bác muốn code của mình chạy trên đó. Nó có Hệ điều hành (QNX RTOS) để đảm bảo code chạy đúng giờ (Real-time).
    

### 3. Tại sao lại cần "Đường ống" (Networking/QNET)?

Nếu bác không có đường ống:

- Bác phải copy file Binary ra USB, rồi cắm vào VM, rồi copy vào... (quá chậm, không ai làm vậy).
    
- **Có đường ống:** Bác nhấn nút "Run" trên IDE, file Binary tự động "trôi" qua đường ống vào thư mục `/tmp` của máy ảo và tự động chạy luôn.
    

### 4. Vậy tại sao nãy giờ bị lỗi?

Lỗi `No such device` bác gặp nãy giờ là do **"Đường ống" (QNET)** chưa được xây dựng.

- IDE muốn gửi file qua đường ống, nhưng máy ảo bảo: _"Ông chưa nối ống vào (mount), tôi không nhận được!"_.
    
- Khi bác gõ `io-pkt-v6-hc` và `mount ...`, bác đang **đích thân đi nối ống** cho cái nhà máy đó.
    

**Chốt lại:**

- **Host:** Là cái máy tính bác đang ngồi.
    
- **Target VM (vm1):** Là cái "phần cứng giả lập" mà bác phải code cho nó chạy.
    
- **Mối quan hệ:** Host chỉ là nơi bác _soạn thảo_, VM mới là nơi _thực thi_ (để test xem code có bị chậm hay treo không).

___
### ?. `vm1` (Trong VirtualBox) vs. `Hostname` (Bên trong QNX)

- **`vm1` (VirtualBox):** Đây là cái **"nhãn dán" bên ngoài** mà bạn đặt cho máy ảo trong phần mềm VirtualBox. Nó giống như việc bạn đặt tên file là `may_ao_cua_bach.vdi` trên ổ cứng máy tính của bạn vậy. Máy tính thật của bạn (Windows) biết đến máy ảo qua cái nhãn này để quản lý RAM, CPU cho nó.
    
- **`Hostname` (Bên trong QNX):** Đây là cái **"tên khai sinh"** nằm **bên trong** hệ điều hành QNX. Khi máy ảo `vm1` khởi động xong, bản thân nó "tự thấy" mình là một hệ thống độc lập. Nó không hề biết bên ngoài VirtualBox đang gọi nó là `vm1`, `vm2` hay gì cả.
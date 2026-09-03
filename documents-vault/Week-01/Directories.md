### 1. Nhóm chứa Lệnh và Chương trình (Executables)

Đây là nơi chứa các file thực thi, tương tự như thư mục `Program Files` trên Windows.

- **/bin**: Chứa các file lệnh thực thi cơ bản (Command executables).
    
- **/sbin**: Chứa các file lệnh hệ thống, nhưng chỉ tài khoản `root` mới có quyền sử dụng (System executables).
    
- **/usr**: Chứa các chương trình phần mềm tiêu chuẩn (Standard programs).
    

### 2. Nhóm chứa File Hệ thống và Cấu hình (System & Configuration)

Nhóm này chứa "nội tạng" của hệ điều hành, giúp hệ thống khởi động và cung cấp thư viện cho code của bạn chạy.

- **/boot** và **/libexec**: Chứa các file hệ thống cốt lõi (System files).
    
- **/etc**: Chứa các file cấu hình và file khởi tạo hệ thống (Initialization and other files).
    
- **/lib**: Chứa các file thư viện dùng chung, bao gồm các shared objects (Library files).
    

### 3. Nhóm Thiết bị, Mạng và Ổ đĩa (Devices & Network)

Vì mọi thứ trong Linux/QNX đều được coi là một "file", các thiết bị ngoại vi cũng sẽ được hiển thị ở đây.

- **/dev**: Nơi chứa các điểm truy cập (entries) giao tiếp với phần cứng I/O như ổ đĩa (disks) hay thiết bị đầu cuối (terminals).
    
- **/fs**: Nơi chứa các phân vùng ổ đĩa hoặc thẻ nhớ SD đã được gắn (mounted) vào hệ thống.
    
- **/net**: Dùng để truy cập/kết nối với các máy QNX khác nằm trong cùng một mạng cục bộ.
    
    - _Lưu ý đặc biệt từ tài liệu:_ **/net** thực chất không phải là một thư mục có thật trên ổ cứng, mà nó là một đường dẫn ảo do trình quản lý mạng QNET tạo ra. Khi bạn mới tạo máy ảo, thư mục này sẽ không xuất hiện cho đến khi bạn khởi động dịch vụ QNET và cấu hình xong `mqueue` cùng với `hostname`.
        

### 4. Nhóm Dữ liệu động, Tiến trình và Người dùng (Data & Users)

- **/root**: Thư mục cá nhân (Home directory) dành riêng cho tài khoản quản trị `root`.
    
- **/home**: Thư mục cá nhân dành cho các tài khoản người dùng bình thường.
    
- **/proc**: Chứa các thông tin về những tiến trình (processes) đang chạy ngầm trong hệ thống.
    
- **/var**: Chứa các file có dung lượng thường xuyên thay đổi trong quá trình hệ thống hoạt động, điển hình là các file nhật ký (logs) hay spoolers.
    
- **/tmp**: Thư mục mặc định để chứa các file tạm thời. Tài liệu đặc biệt khuyên bạn nên copy các file code đã biên dịch của mình vào thư mục này để chạy thử nghiệm.

![[Pasted image 20260704184953.png]]
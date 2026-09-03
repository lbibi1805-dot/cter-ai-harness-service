"Prompt" dịch nôm na là **"Dấu nhắc lệnh"**.

Khi bạn mở một terminal (màn hình đen) lên, hệ thống sẽ in ra một ký tự để báo hiệu cho bạn biết: _"Tôi đã sẵn sàng nhận lệnh từ bạn, mời gõ"_.

- Trong QNX hoặc Linux, nếu bạn thấy dòng lệnh bắt đầu bằng ký tự **`$`**, nghĩa là bạn đang đăng nhập bằng tài khoản user thường.
    
- Nếu bạn thấy ký tự **`#`** (như trên màn hình VMware của bạn hiện tại), nghĩa là bạn đang ở quyền **Root (Admin tối cao)**.
    

Cụm từ _"telnet to the target to get a # prompt"_ chỉ đơn giản có nghĩa là: Hãy kết nối Telnet vào thiết bị phần cứng để nó hiện ra cái màn hình đen có dấu `#` rồi bắt đầu gõ lệnh.


**Ví dụ trực quan: Thẻ nhân viên và Thẻ giám đốc** Prompt (dấu nhắc lệnh) đơn giản là cái ký hiệu đứng ở đầu mỗi dòng trong màn hình đen (Terminal), chờ bạn gõ lệnh vào. Nó không chỉ là cái để nhìn cho đẹp, nó là thứ **đại diện cho quyền lực** của bạn trong hệ thống.

Hãy nhìn vào mô phỏng màn hình Terminal cực kỳ trực quan dưới đây:

**Trường hợp 1: Thẻ Nhân Viên (Dấu `$`)** Khi bạn đăng nhập bằng tài khoản người dùng bình thường (User), dấu nhắc lệnh sẽ là `$`.

Bash

```
luongchibach@Ubuntu-PC:~$ rm -rf /hệ-thống-quan-trọng
Lỗi: Quyền truy cập bị từ chối (Permission denied). Bạn không có quyền xóa!
luongchibach@Ubuntu-PC:~$ _
```

- _Ý nghĩa:_ Bạn chỉ là nhân viên. Bạn chỉ được làm việc trong thư mục của mình. Đụng vào hệ thống lõi là bảo vệ (hệ điều hành) chặn lại ngay.
    

**Trường hợp 2: Thẻ Giám Đốc (Dấu `#`)** Khi bạn đăng nhập bằng tài khoản quyền lực nhất (Root/Admin), dấu nhắc lệnh lập tức biến thành `#`.

Bash

```
root@VM_x86_Target01:~# rm -rf /hệ-thống-quan-trọng
(Hệ thống bị xóa sạch sẽ không một lời kêu ca)
root@VM_x86_Target01:~# _
```

- _Ý nghĩa:_ Bạn là Tổng Giám Đốc. Dấu `#` (đọc là hash prompt hoặc root prompt) cho bạn quyền sinh sát tối cao. Hệ thống sẽ răm rắp nghe lời mọi lệnh bạn gõ mà không thèm kiểm tra hay ngăn cản.
    

**Đề bài muốn nói gì?** Khi đề bài nói _"telnet to the target to get a # prompt"_, ý họ là: Hãy kết nối với cái bo mạch phần cứng đó đi, đăng nhập bằng tài khoản Admin cao nhất để thấy cái màn hình đen có **dấu `#`** hiện ra, lúc đó bạn mới có đủ quyền để ép cái bo mạch đó chạy file code của bạn!
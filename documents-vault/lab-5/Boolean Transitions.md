Dạ, ký hiệu gạch ngang trên đầu (ví dụ: TEST1) trong sơ đồ trạng thái là ký hiệu toán học và logic dùng để biểu thị phép **NOT (Phủ định)**. Nó dùng để chỉ ra hướng chuyển trạng thái khi điều kiện kiểm tra trả về kết quả **SAI (False)**.
![[Pasted image 20260809114330.png|400]]
Cụ thể sự khác biệt giữa hai ký hiệu này như sau:

- **Không có gạch trên đầu (`TEST1`):** Nghĩa là điều kiện kiểm tra trả về kết quả **ĐÚNG (True / 1)**. Nếu đối chiếu với đoạn code C trong tài liệu, nó tương đương với việc hàm test thỏa mãn điều kiện trong câu lệnh `if (Test1())`. Chẳng hạn, trên sơ đồ từ `State 1`, mũi tên `TEST1` không có gạch sẽ dẫn hướng trạng thái nhảy sang `State3`.
    
    
- **Có gạch trên đầu (TEST1):** Nghĩa là điều kiện kiểm tra trả về kết quả **SAI (False / 0)**. Trong code C, nó tương ứng với nhánh `else` hoặc khi điều kiện được viết dưới dạng phủ định như `if (!Test1())`. Nhìn vào sơ đồ, nếu ở `State 1` mà `TEST1` bị sai (biểu diễn bằng mũi tên TEST1), hệ thống sẽ nhảy sang `State2`.
    
    PDF+ 1
    

Một ví dụ khác rõ ràng hơn thể hiện sự tương quan giữa bản vẽ và code trong tài liệu là ở `State3`:

- Trong code C được viết là `if (!Test3()) CurState = State0;`.
    
    PDF
    
- Trên sơ đồ, mũi tên chỉ từ `State3` vòng ngược về `State0` mang ký hiệu TEST3.
    
    PDF
    
- Đồng thời, mũi tên vòng lại chính nó ở `State3` lại là `TEST3` (nghĩa là nếu điều kiện `Test3` vẫn đang đúng thì trạng thái sẽ tiếp tục đứng yên ở `State3`).
    
    PDF
    

Nói một cách đơn giản, người ta dùng dấu gạch trên đầu để biểu thị trường hợp "False" cho ngắn gọn thay vì phải ghi hẳn chữ "True" hay "False" lên các đường mũi tên của sơ đồ.
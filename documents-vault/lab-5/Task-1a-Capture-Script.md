
Để chạy chương trình này trong môi trường QNX Momentics và chuẩn bị đầy đủ ảnh chụp màn hình (screen captures) cùng các ví dụ input/output cho phần Lab Note theo đúng yêu cầu của đề bài, anh làm theo hướng dẫn chi tiết sau đây nhé:

### Bước 1: Tạo Project và chạy code trong QNX Momentics

1. Mở phần mềm **QNX Momentics IDE**.
    
2. Tạo một C Project mới (chọn loại _C Project_ -> _Executable_ -> _Empty Project_ hoặc _Standard Make C Project_ tùy theo cấu hình của anh, chọn toolchain QNX target).
    
3. Tạo một file source mới đặt tên là `main.c` và dán toàn bộ đoạn code ở trên vào.
    
4. Build project (nhấn biểu tượng búa/build) để đảm bảo code không bị lỗi cú pháp nào.
    
5. Run chương trình trên Target hoặc Simulator của QNX. Khi chạy, màn hình Console sẽ hiển thị dòng thông báo khởi động và đứng lại chờ anh nhập dữ liệu.
    

### Bước 2: Các kịch bản Test (Input & Output) để làm Lab Note

Đề bài yêu cầu tài liệu Lab Note của anh phải chứa các ví dụ về **đầu vào (input)** và **đầu ra (expected output)** khác nhau để chứng minh chương trình chạy đúng theo sơ đồ trạng thái.

Anh hãy chạy thử lần lượt **3 kịch bản** dưới đây, chụp lại màn hình console của từng kịch bản để đưa vào báo cáo:

#### Kịch bản 1: Đi theo nhánh True của State 1 (State0 $\rightarrow$ State1 $\rightarrow$ State3)

- **Mục đích:** Chứng minh khi ở `State1`, nếu test trả về True (`y`), máy trạng thái sẽ chuyển thẳng lên `State3`.
    
- **Thao tác nhập trên console:**
    
    1. Chương trình tự chạy qua `State0` $\rightarrow$ nhảy sang `State1`.
        
    2. Tại dòng prompt của `TEST1`, anh nhập: **`y`** rồi bấm Enter.
        
    3. Sau đó tại dòng prompt của `TEST3`, anh nhập: **`y`** để giữ nguyên ở `State3`, hoặc nhập **`q`** để thoát chương trình.
        
- **Kết quả hiển thị trên Console mong đợi:**
    
    Plaintext
    
    ```
    Starting State Machine from RTS_Lab_Ex_5_rev3.pdf...
    
    [CURRENT STATE] State0: Running Initialise0()...
    
    [CURRENT STATE] State1: Running DoSomething1()...
      -> Evaluate TEST1? (y = true, n = false, q = quit program): y
    
    [CURRENT STATE] State3: Running DoSomething3()...
      -> Evaluate TEST3? (y = true, n = false, q = quit program): q
    
    Exiting State Machine.
    ```
    

#### Kịch bản 2: Đi theo nhánh False của State 1 (State0 $\rightarrow$ State1 $\rightarrow$ State2 $\rightarrow$ State0)

- **Mục đích:** Chứng minh khi ở `State1`, nếu test trả về False (`n`), máy trạng thái sẽ chuyển sang `State2`, rồi từ `State2` nếu test tiếp tục False sẽ vòng ngược về `State0`.
    
- **Thao tác nhập trên console:**
    
    1. Chương trình chạy qua `State0` $\rightarrow$ `State1`.
        
    2. Tại `TEST1`, anh nhập: **`n`** (để rẽ sang `State2`).
        
    3. Tại `TEST2`, anh nhập: **`n`** (để rẽ ngược về `State0`).
        
    4. Sau đó chương trình sẽ lặp lại vòng mới, anh có thể bấm **`q`** ở lần prompt tiếp theo để thoát.
        
- **Kết quả hiển thị trên Console mong đợi:**
    
    Plaintext
    
    ```
    [CURRENT STATE] State0: Running Initialise0()...
    
    [CURRENT STATE] State1: Running DoSomething1()...
      -> Evaluate TEST1? (y = true, n = false, q = quit program): n
    
    [CURRENT STATE] State2: Running DoSomething2()...
      -> Evaluate TEST2? (y = true, n = false, q = quit program): n
    
    [CURRENT STATE] State0: Running Initialise0()...
      -> Evaluate TEST1? (y = true, n = false, q = quit program): q
    
    Exiting State Machine.
    ```
    

#### Kịch bản 3: Kiểm tra vòng lặp tại State 3 ($\overline{\text{TEST3}}$)

- **Mục đích:** Chứng minh tính đúng đắn của mũi tên có gạch ngang ($\overline{\text{TEST3}}$) ở `State3`: nếu trả về False (`n`), nó sẽ thoát khỏi `State3` để về lại `State0`.
    
- **Thao tác nhập trên console:**
    
    1. Đi tới `State3` (bằng cách nhập `y` ở `TEST1`).
        
    2. Tại `TEST3`, anh nhập: **`n`** (phủ định, tương ứng với $\overline{\text{TEST3}}$). Quan sát xem console có tự động nhảy quay vòng về lại `State0` hay không.
        
    3. Bấm **`q`** để kết thúc.
        

### Những gì cần đưa vào file Lab Note của anh:

1. **Source Code (`*.c`):** Đính kèm toàn bộ file code C vào thư mục bài làm.
    
2. **Screen Captures:** Chụp lại các cửa sổ console lúc thực hiện thành công các kịch bản `y` và `n` ở trên.
    
3. **Mô tả ngắn gọn:** Viết 1-2 câu giải thích bên dưới mỗi ảnh chụp màn hình (Ví dụ: _"Hình 1: Minh họa trường hợp TEST1 trả về True (nhập y), hệ thống chuyển từ State1 sang State3"_).
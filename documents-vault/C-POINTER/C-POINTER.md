### 1. Nhóm làm việc với Bộ nhớ (Địa chỉ và Giá trị)

| **Ký hiệu** | **Ngữ cảnh sử dụng**  | **Tên gọi** | **Chức năng trong C/C++**                                     | **Hình ảnh ví dụ (Bản đồ & Kho báu)**                    | **Code minh họa**       |
| ----------- | --------------------- | ----------- | ------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| **`&`**     | Đứng trước biến đã có | Address-of  | **Lấy địa chỉ** (tọa độ) của một biến trong bộ nhớ.           | Đi tìm tọa độ của cái rương xem nó chôn ở đâu.           | `int* ban_do = &ruong;` |
| **`*`**     | Khi khai báo biến     | Pointer     | **Tạo biến con trỏ**, dùng để lưu trữ địa chỉ của người khác. | Mua một tấm bản đồ da dê mới tinh (chỉ ghi được tọa độ). | `int* ban_do;`          |
| **`*`**     | Đứng trước con trỏ    | Dereference | **Truy xuất giá trị** nằm tại ô nhớ mà con trỏ đang trỏ tới.  |                                                          |                         |

### 2. Nhóm làm việc với Đối tượng (Struct / Class)

| **Ký hiệu** | **Ngữ cảnh sử dụng**  | **Chức năng trong C/C++**                                              | **Khi nào thì dùng?**                                                | **Code minh họa**   |
| ----------- | --------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------- |
| **`.`**     | Dùng với biến bản thể | Truy cập vào thuộc tính / phương thức của một đối tượng.               | Khi bạn đang nắm giữ **trực tiếp** đối tượng đó (bản thể gốc).       | `sv1.diem = 10;`    |
| **`->`**    | Dùng với biến con trỏ | Truy cập vào thuộc tính / phương thức của đối tượng thông qua địa chỉ. | Khi bạn **không** nắm đối tượng, bạn chỉ giữ **con trỏ** trỏ tới nó. | `ptrSV->diem = 10;` |

### 3. Tại sao trong hàm lại "truyền vô tội vạ"?

Bạn thấy người ta hay truyền `&` hoặc `*` vào hàm vì 2 lý do chính: **Hiệu năng** và **Khả năng chỉnh sửa**.

#### Cách 1: Truyền bằng giá trị (Mặc định)

Nếu bạn viết `void ham(int x)`, C++ sẽ **copy** toàn bộ giá trị của `x` ra một biến mới. Nếu bạn truyền một cấu trúc dữ liệu khổng lồ (như một danh sách cả triệu phần tử), máy tính sẽ rất chậm vì phải copy toàn bộ.

#### Cách 2: Truyền bằng con trỏ (`*`) hoặc tham chiếu (`&`)

Thay vì copy dữ liệu, ta chỉ truyền **địa chỉ** của dữ liệu đó vào. Hàm sẽ "nhìn" vào địa chỉ gốc để làm việc.

- **Dùng `&` (Tham chiếu - Reference):** Cách viết hiện đại trong C++.
    
    C++
    
    ```
    void tangGiaTri(int &n) { // n bây giờ là "biệt danh" của biến gốc
        n = n + 1; // Thay đổi trực tiếp trên biến gốc
    }
    ```
    
- **Dùng `*` (Con trỏ - Pointer):** Cách truyền thống (của C).
    
    C++
    
    ```
    void tangGiaTri(int *n) { // n là địa chỉ
        *n = *n + 1; // Truy cập tới giá trị tại địa chỉ đó để thay đổi
    }
    ```
    

### 3. Khi nào dùng cái nào? (Quy tắc "bỏ túi")

Bạn nên truyền bằng `&` hoặc `*` trong các trường hợp sau:

1. **Muốn hàm thay đổi giá trị của biến gốc:** Nếu bạn muốn truyền vào biến `a` và muốn sau khi chạy hàm, `a` bị thay đổi, bắt buộc phải dùng `&` hoặc `*`.
    
2. **Truyền dữ liệu lớn (Struct, Class, Array):** Để tránh việc copy tốn bộ nhớ. Khi này ta thường dùng `const` để đảm bảo hàm không làm thay đổi dữ liệu:
    
    - Ví dụ: `void inDanhSach(const vector<int> &data)` (Truyền tham chiếu để tiết kiệm, `const` để không làm hỏng dữ liệu).
        
3. **Khi cần giá trị "rỗng":** Con trỏ (`*`) có thể mang giá trị `nullptr` (không trỏ vào đâu cả), trong khi tham chiếu (`&`) thì bắt buộc phải gắn với một biến thật.
    

**Tóm lại:**

- Dùng `&` (tham chiếu) khi bạn muốn code gọn gàng, an toàn và không cần thay đổi địa chỉ của con trỏ.
    
- Dùng `*` (con trỏ) khi bạn cần sự linh hoạt (ví dụ: cấp phát bộ nhớ động, hoặc trỏ vào các vùng nhớ khác nhau).
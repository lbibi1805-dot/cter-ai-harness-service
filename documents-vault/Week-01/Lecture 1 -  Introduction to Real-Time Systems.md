![[Pasted image 20260629210025.png]]

### 1. What is a Real-Time System?
![[NotebookLM Mind Map (5).png]]

#### 1.1. Core Concepts (Các khái niệm cốt lõi cần biết)
- **Tính đúng đắn (Correctness):** Sự chính xác của hệ thống không chỉ phụ thuộc vào kết quả tính toán mà còn phụ thuộc vào **thời gian (time)** mà kết quả đó được tạo ra.
    
- **Kịp thời (Timely fashion):** Máy tính phải phản hồi các **kích thích (stimuli)** (từ tín hiệu analog, digital, hoặc thiết bị ngoại vi) một cách kịp thời. "Kịp thời" không nhất thiết là cực kỳ nhanh (quickly), mà là phù hợp với thang thời gian của quá trình đang kiểm soát.
    
    - _Ví dụ:_ Phản hồi trước khi người dùng phàn nàn, trước khi lò hơi phát nổ (boiler blows up), hoặc trước khi một phản ứng hóa học bị hỏng (chemical process is spoilt).
        
- **Thời hạn (Deadline):** Là khoảng thời gian cho trước tính từ sau một **sự kiện kích hoạt (trigger event)**, mà phản hồi bắt buộc phải được hoàn thành.
    
- **Yêu cầu bắt buộc:** Hệ thống phải **đáng tin cậy (reliable)** và **có thể dự đoán được (predictable)**.

####  1.2. Phân loại theo Thời hạn (Classification by Deadlines)
- Hệ thống thời gian thực được chia thành **3 loại** dựa trên chi phí  (cost) hoặc hậu quả khi vi phạm thời hạn

| **Loại hệ thống (System Type)**                                           | **Đặc điểm (Characteristics)**                                                                                                                                                                                                                        | **Ví dụ trong slide (Examples)**                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Hệ thống thời gian thực cứng<br><br>  <br><br>(Hard Real-Time Systems) | - Bắt buộc phải đáp ứng mọi thời hạn (Must meet deadlines).<br><br>  <br><br>- Việc thất bại trong việc phản hồi có thể dẫn đến những hậu quả thảm khốc (catastrophic).                                                                               | - Hệ thống điều khiển bay (Flight control system).<br><br>  <br><br>- Kiểm soát nhà máy điện hạt nhân (Nuclear Power plant control).<br><br>  <br><br>- **Ví dụ trực quan:** Hình ảnh máy bay thương mại đang cất cánh.                                     |
| 2. Hệ thống thời gian thực mềm<br><br>  <br><br>(Soft Real-Time Systems)  | - Có thể lỡ một vài thời hạn (May miss some deadlines).<br><br>  <br><br>- Việc phản hồi trễ chỉ gây ra sự khó chịu, phiền toái (annoying) cho người dùng.                                                                                            | - Dịch vụ trang web (Web site service).<br><br>  <br><br>- Bảng hiển thị điện tử (display board).<br><br>  <br><br>- Mạng viễn thông (telecom).<br><br>  <br><br>- **Ví dụ trực quan:** Hình ảnh người đàn ông đứng chờ thang máy và sốt ruột nhìn đồng hồ. |
| 3. Hệ thống thời gian thực vững<br><br>  <br><br>(Firm Real-Time Systems) | - Nếu có lỗi trễ hạn xảy ra, toàn bộ hệ thống không sập (does not fail).<br><br>  <br><br>- Tuy nhiên, các kết quả được tạo ra sau thời hạn sẽ hoàn toàn bị từ chối/loại bỏ (rejected), dẫn đến tổn thất doanh thu hoặc tài nguyên (loss of revenue). | - Hệ thống họp trực tuyến (Video conferencing - đảm bảo chất lượng dịch vụ QoS).                                                                                                                                                                            |
|                                                                           |                                                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                             |
- **Lưu ý:** *Phân biệt rõ ràng hơn giữa Hệ thống thời gian thực (Hard Real-Time Systems) và Hệ thống thời gian thực vững (Firm Real-Time Systems)*

| **Tiêu chí**                   | **Hard Real-Time (Cứng)**                               | **Firm Real-Time (Vững)**                         |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| **Hệ thống khi trễ Deadline?** | Sụp đổ / Gây ra thảm họa.                               | Vẫn chạy bình thường (does not fail).             |
| **Cách xử lý dữ liệu trễ?**    | (Không có cơ hội xử lý vì hệ thống đã sập/gây tai nạn). | Bị từ chối / vứt bỏ (rejected).                   |
| **Mức độ thiệt hại?**          | Tính mạng, tài sản quy mô lớn.                          | Trải nghiệm dịch vụ, doanh thu (loss of revenue). |

#### 1.3. Khi nào **KHÔNG NÊN** dùng (**NOT SUITABLE FOR**)
Điện toán thời gian thực (Real-Time Systems) không phải là giải pháp cho mọi bài toán. Nó không phù hợp với:

- Các ứng dụng điều khiển pha điện áp cao (yêu cầu phản hồi gần như tức thời).
    
- Hệ thống CPR (hồi sức tim phổi - việc phát hiện nhịp tim có thể thực hiện dễ dàng hơn bằng thiết bị điện tử chuyên dụng).
    
- Các máy trạng thái đơn giản (Simple state machines) không cần nhiều hệ thống con (để tránh sự phức tạp quá mức - overkill).
### 2. Real-Time Computing
![[NotebookLM Mind Map (6).png|697]]
#### 2.1. Bản Chất (Core Nature)
- **Phản hồi kịp thời (Timely fashion):** Hệ thống máy tính phải có khả năng phản hồi lại các kích thích (stimuli) một cách đúng lúc.
    
- **Nguồn kích thích (Stimuli):** Các tín hiệu đầu vào này thường bắt nguồn từ tín hiệu tương tự (analog signals), tín hiệu số (digital signals) hoặc các thiết bị ngoại vi (peripheral devices).
    
- **Tính "Kịp thời" (Timely) mang tính tương đối:** Kịp thời không nhất thiết đồng nghĩa với việc xử lý cực kỳ nhanh (quickly), mà là tốc độ phản hồi phải phù hợp với **thang thời gian (time-scale)** của chính quy trình đang được kiểm soát.
    
    - _Mục tiêu:_ Đảm bảo phản hồi hoàn thành trước khi xảy ra sự cố (ví dụ: lò hơi phát nổ, phản ứng hóa học bị hỏng) hoặc trước khi người dùng phàn nàn.
#### 2.2. Những lầm tưởng (Misconceptions)
Tài liệu nhấn mạnh rằng điện toán thời gian thực không phải là giải pháp vạn năng cho mọi vấn đề. Cần làm rõ các lầm tưởng sau:

- **Không đồng nghĩa với Máy tính tốc độ siêu nhanh (Fast computing):** Điện toán thời gian thực không thuộc lĩnh vực của siêu máy tính (supercomputers). Thay vào đó, nó thường được ứng dụng trong các thiết bị nhúng có công suất thấp (low power embedded devices).
    
- **Không dành cho các bài toán tĩnh (Static problems):** Hệ thống này sinh ra để giải quyết các bài toán động (dynamic problems) nhằm kiểm soát các môi trường phức tạp. Áp dụng nó vào môi trường tĩnh là sự lãng phí và phức tạp hóa không cần thiết (overkill).
    
- **Không phải công cụ viết mã cấp thấp:** Không nên dùng hệ thống thời gian thực chỉ để viết trình điều khiển thiết bị (device drivers), trình xử lý ngắt (interrupt handlers) hay lập trình bằng Assembly/C bậc thấp. Bản chất của RTOS là để hỗ trợ phát triển hệ thống ở cấp độ cao hơn (high-level system development)

#### 2.3. Các trường hợp **KHÔNG NÊN** ứng dụng
Để tránh làm hệ thống trở nên cồng kềnh quá mức cần thiết (overkill), tài liệu khuyến cáo không nên sử dụng Real-Time Computing cho các trường hợp sau:

| **Ứng dụng không phù hợp**                                                              | **Lý do (Theo tài liệu)**                                                                                                                          |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ứng dụng điều khiển pha điện áp cao**<br><br>  <br><br>_(High voltage phase control)_ | Các hệ thống này đòi hỏi sự phản hồi gần như ngay lập tức (near instantaneous response) nên phù hợp với mạch phần cứng chuyên biệt hơn.            |
| **Hệ thống phát hiện nhịp tim CPR**<br><br>  <br><br>_(CPR systems)_                    | Việc phát hiện nhịp tim có thể được thực hiện dễ dàng và tối ưu hơn bằng các linh kiện điện tử chuyên dụng (dedicated electronics).                |
| **Các máy trạng thái đơn giản**<br><br>  <br><br>_(Simple state machines)_              | Vì không chứa nhiều hệ thống con (subsystems), việc đưa điện toán thời gian thực vào chỉ gây ra sự phức tạp dư thừa (avoid complexity & overkill). |
### 3. Các thuật ngữ và khải niệm khác:
#### 3.1. Software Concurrency (Sự diễn ra đồng thời trong phần mềm)
- **Định nghĩa:**
	- **Bản chất của Concurrency:** Là trạng thái mà nhiều tác vụ (tasks) _có vẻ như_ đang được thực thi cùng một lúc.
    
	- **Thực tế trên phần cứng đơn nhân (Uniprocessor):** Tại một thời điểm vật lý duy nhất, CPU chỉ có thể xử lý một tác vụ duy nhất.
    
	- **Cơ chế hoạt động:** Để tạo ra ảo giác "đồng thời", hệ điều hành chia nhỏ mỗi tác vụ thành nhiều mảnh thời gian rất nhỏ (chunks) và điều phối CPU liên tục hoán đổi, nhảy qua lại giữa các mảnh tác vụ này với tốc độ cực kỳ nhanh. Quá trình hoán đổi này được gọi là **Chuyển ngữ cảnh (Context Switching)**.
- Tại sao lại cần Concurrency?
	Hãy nhìn vào ví dụ về chiếc **Máy ghi âm (Voice Recorder)** được nhắc tới trong slide 19. Thiết bị này có 5 tác vụ cốt lõi phải xử lý liên tục :

		1. Quét phím bấm từ người dùng (Scan Keys).
		    
		2. Cập nhật giao diện màn hình hiển thị (Update LCD).
		    
		3. Nhận tín hiệu và thu âm (Record).
		    
		4. Xử lý các khối dữ liệu âm thanh (Process data).
		    
		5. Ghi dữ liệu vào bộ nhớ (Save Audio).
    
	
	- **Nếu chạy Tuần tự (Sequential Tasks):** Các tác vụ xếp hàng chạy lần lượt (Tác vụ 1 xong mới đến Tác vụ 2). Giả sử tác vụ _Save Audio_ hoặc _Process Data_ tốn tới 0.5 giây để hoàn thành, trong suốt 0.5 giây đó hệ thống sẽ hoàn toàn bị "đơ". Người dùng nhấn nút dừng (Scan Keys) hệ thống sẽ không ăn, màn hình LCD không cập nhật, gây ra hiện tượng mất dữ liệu hoặc trải nghiệm cực kỳ tệ.
    
	- **Khi có Concurrency:** CPU xử lý một chút âm thanh, ngay lập tức đá qua quét phím bấm, rồi cập nhật màn hình LCD, sau đó quay lại lưu một mẩu dữ liệu . Nhờ tốc độ chuyển đổi mili-giây, người dùng có cảm giác tất cả các tính năng đang chạy song song mượt mà cùng nhau.

![[Pasted image 20260629214709.png]]

#### 3.2. Bảo vệ và Cấp độ đặc quyền (Protection & Privileges)
- **Nhiệm vụ chính của Hệ điều hành (OS):** Bảo vệ hệ thống khỏi các chương trình lỗi của người dùng (errant user programs).
    
- **Cơ chế ngăn chặn:** Hệ điều hành kiểm soát không cho phép các tiến trình người dùng tự ý truy cập vào vùng bộ nhớ (memory) và các thiết bị ngoại vi (I/O devices) nằm ngoài phạm vi được cấp phát của chúng.
    
- **Các cấp độ bảo vệ (Levels of Protection):** OS thường cung cấp từ hai hoặc nhiều mức độ đặc quyền khác nhau:
    
    - Ngăn chặn các tiến trình người dùng không có đặc quyền (non-privileged user processes) can thiệp vào làm ảnh hưởng đến tính toàn vẹn của hệ điều hành.
        
    - Ngăn chặn các tiến trình xâm phạm hoặc truy cập trái phép vào không gian của các tiến trình người dùng khác.
        
- **Các chỉ thị bị cấm (Disallowed Instructions):** Tiến trình người dùng bình thường bị cấm sử dụng trực tiếp các lệnh hệ thống nhạy cảm có thể làm treo hoặc thay đổi trạng thái phần cứng, ví dụ như: `Halt` (Dừng CPU), `Enable Interrupts` / `Disable Interrupts` (Bật/Tắt ngắt toàn cục) .
    
- **Cơ chế chuyển đổi đặc quyền:** Cấp độ đặc quyền của CPU chỉ được phép thay đổi khi có một **Lời gọi hệ thống (System Call)** từ phần mềm hoặc khi xuất hiện một **Ngắt phần cứng (Hardware Interrupt)** từ thiết bị ngoại vi.
#### 3.3. Bản chất của Chuyển ngữ cảnh (Context Switching) trong RTOS
- **Ảo giác đồng thời:** OS cung cấp cơ chế chuyển ngữ cảnh cực nhanh (fast context switching). Về mặt thị giác, tất cả các tác vụ có vẻ như đang thực thi cùng một lúc (concurrently) , nhưng thực tế tại một thời điểm vật lý **chỉ có duy nhất một tác vụ được chạy trên CPU**.
    
- **Đặc tính hỗ trợ của RTOS:** * Cung cấp các giải pháp an toàn để các luồng (threads) có thể giao tiếp, trao đổi dữ liệu với nhau khi có nhu cầu (communication between threads).
    
    - Bộ lập lịch (scheduler) của RTOS cho phép người dùng cấu hình và lựa chọn linh hoạt giữa nhiều thuật toán điều phối khác nhau tùy thuộc vào bài toán, ví dụ: `FIFO` (Vào trước ra trước), `RR` (Round Robin - Luân phiên), hoặc `Sporadic` (Lập lịch rải rác/bất định).
![[Pasted image 20260629215053.png]]
#### 3.4. Process vs Threads
| **Tiêu chí**               | **Tiến trình (Process)**                                                                                                                                                                                   | **Luồng (Thread)**                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Định nghĩa & Tính chất** | Là một chương trình độc lập đang trong quá trình thực thi, sở hữu không gian bộ nhớ bảo vệ riêng biệt (protected memory space). Có mã định danh tiến trình là **PID** (Process ID).                        | Là một đơn vị thực thi nằm bên trong một tiến trình. Có mã định danh luồng riêng gọi là **TID** (Thread ID).                                                                                                      |
| **Cơ chế chia sẻ dữ liệu** | Vì bộ nhớ được bảo vệ nghiêm ngặt, phải thông qua các cơ chế tường minh (explicitly) như: hàng đợi tin nhắn (message queues), các kênh giao tiếp (channels), hoặc đặt tên cho đèn hiệu (named semaphores). | Tất cả các luồng trong cùng tiến trình dùng chung một không gian bộ nhớ, trao đổi qua các biến chia sẻ (shared variables). Tốc độ rất nhanh (fast), nhưng không an toàn (unsafe) nếu thiếu giải pháp đồng bộ hóa. |

![[Pasted image 20260629220435.png]]


#### 3.5. Các Building Blocks trong QNX/POSIX:
Tài liệu cung cấp các công cụ nền tảng (sẽ áp dụng từ Bài thí nghiệm số 2 trở đi) để lập trình luồng và tiến trình trên hệ điều hành QNX:

- **Hàm điều phối luồng:** Sử dụng `pthread_create()` để sản sinh (spawn) một luồng mới và `pthread_join()` để bắt một luồng phải chờ luồng khác hoàn thành.
    
- **Độ ưu tiên (Priority):** Các luồng có dải độ ưu tiên từ 1 đến 63, trong đó giá trị mặc định là 10.
    
- **Chính sách lập lịch (Scheduling Policies):** Hỗ trợ các thuật toán điều phối thời gian thực như `SCHED_RR` (Round-Robin - luân phiên) và `SCHED_FIFO` (First-In, First-Out - vào trước ra trước).
    
- **Kiểm tra hệ thống:** Sử dụng các hàm `getpid()`, `gettid()` trong mã nguồn để lấy ID. Trên môi trường dòng lệnh của hệ thống đích (target), lập trình viên có thể dùng lệnh `pidin` để kiểm tra trực tiếp trạng thái của các luồng đang hoạt động.
#### 3.6. Quy tắc thiết kế cốt lõi (Rule of Thumb):
Khi thiết kế kiến trúc phần mềm nhúng thời gian thực, việc lựa chọn giữa Luồng và Tiến trình tuân theo định hướng sau:

- **Nên chọn LUỒNG (Threads):** Cho các công việc có tính chất gắn kết chặt chẽ (tightly-coupled) và cần chia sẻ, trao đổi dữ liệu liên tục trên cùng một nút mạng (one node).
    
- **Nên chọn TIẾN TRÌNH (Processes):** Khi hệ thống yêu cầu tính cô lập cao (isolation), cần khoanh vùng và chứa đựng lỗi để tránh làm sập toàn bộ hệ thống (fault containment), hoặc khi các tác vụ xử lý được phân tán trên nhiều nút mạng QNX khác nhau (spread across QNX nodes).

#### 3.7. Bare-metal Scheduling (Lập lịch trên phần cứng trống - Vòng lặp Round-robin)
Bạn hãy tưởng tượng CPU giống như một người công nhân duy nhất trong xưởng, và các tác vụ (Tasks) là các đầu việc được giao.
- **Cơ chế hoạt động:** Ở mô hình này, không có hệ điều hành quản lý. Trong hàm chính `main()`, sau khi khởi tạo hệ thống , CPU sẽ chạy một vòng lặp vô hạn `while(1)`. Bên trong vòng lặp, các tác vụ được xếp hàng và gọi ra thực hiện một cách tuần tự từ trên xuống dưới: chạy xong `Task1()` mới chuyển sang chạy `Task2()`, chạy xong `Task2()` lại quay ngược lên đầu chạy lại `Task1()`.
    
- **Đặc điểm:** * Cấu trúc lập trình cực kỳ đơn giản, dễ viết.
    
    - Thời gian thực thi của cả hệ thống rất dễ tính toán (chỉ cần cộng tổng thời gian chạy của các hàm lại).
        
- Nhược điểm chí mạng (Slide đặt câu hỏi "What happens when we add more tasks?" ): * Giả sử đề bài yêu cầu **Task 1 bắt buộc phải được chạy ít nhất một lần mỗi 5 giây (Deadline)**. Hiện tại hệ thống chỉ có Task 1 (chạy mất 500ms) và Task 2 (chạy mất 250ms), tổng một vòng lặp mất 750ms $\rightarrow$ Đáp ứng tốt deadline.
    
    - Nhưng chuyện gì xảy ra nếu bạn thêm vào `Task3()`, `Task4()`, và vô tình `Task4()` bị nghẽn hoặc tốn tới 6 giây để xử lý? Vòng lặp bị tắc nghẽn tại `Task4()`, CPU không thể quay lại phục vụ `Task1()` đúng hạn $\rightarrow$ **Vi phạm deadline nghiêm trọng**.

	![[Pasted image 20260629220905.png]]

***TÓM TẮT:*** Chúng ta có tập hợp các task Task = (A, B, D, ...., Z). Sau khi chạy A -> Z thì lại chạy từ Z -> A lần lượt. Nguyên lý là làm "waterfall" từ A rồi mới đến B rồi mới đến C. Nếu một trong các task bị nghẽn như B thì vòng lặp cũng sẽ mãi mãi kẹt ở đó. Và khi tập Task[] có size càng lớn thì rủi ro bị nghẽn sẽ càng cao. Vậy nên, Cooperative Scheduling mới ra đời.
#### 3.8. Cooperative Scheduling
Để giải quyết nhược điểm của Bare-metal, mô hình **Lập lịch hợp tác** ra đời bằng cách đưa thêm yếu tố **Thời gian hệ thống (System Time)** và **Khoảng thời gian chờ (Task Interval)** vào cuộc chơi.
- **Cơ chế hoạt động:** Hệ thống quản lý một danh sách (mảng) các tác vụ. Khi vòng lặp chạy, CPU không cắm đầu vào chạy tác vụ ngay. Thay vào đó, nó sẽ đọc thời gian hệ thống và thực hiện một phép tính:
$$\text{Thời gian đã trôi qua (Elapsed Time)} = \text{Thời gian hiện tại} - \text{Thời gian chạy cuối cùng của tác vụ đó}$$
- **Hợp tác là gì?** CPU chỉ cho phép chạy Tác vụ $i$ nếu thời gian trôi qua đã lớn hơn hoặc bằng khoảng thời gian định kỳ của tác vụ đó (`ElapsedTime >= TaskInterval`). Nếu chưa đến giờ, CPU sẽ bỏ qua và chuyển sang kiểm tra tác vụ tiếp theo.
    
- **Tại sao lại gọi là "Hợp tác"?** Vì các tác vụ có độ ưu tiên ngang nhau (không có cơ chế giành giật hay cướp CPU). Do đó, các tác vụ phải "biết điều", được lập trình để **thực thi trong khoảng thời gian ngắn nhất có thể rồi chủ động trả lại CPU** để các tác vụ khác còn có cơ hội kiểm tra thời gian và thực thi.
    
- **Ưu điểm:** Tính toán thời gian cực kỳ tường minh (completely deterministic), đảm bảo độ phản hồi theo chu kỳ rất tốt nếu các tác vụ đều tuân thủ nguyên tắc. Có thể kết hợp với Ngắt (Interrupts) bằng cách đưa các việc cực kỳ khẩn cấp vào ngắt, còn việc ít quan trọng hơn thì để ở vòng lặp kiểm tra thời gian này.
    
- **Nhược điểm:** Nếu có một tác vụ "ích kỷ" không chịu trả lại CPU sớm (ví dụ dính vòng lặp vô tận hoặc xử lý tính toán quá lâu), các tác vụ đứng sau chu kỳ đó sẽ bị lỡ deadline ngay lập tức. Việc triển khai code cũng phức tạp hơn nhiều so với vòng lặp tuần tự.
____
##### **3.8.1. Bàn luận sâu về Cooperative Scheduling**
**Bối cảnh đề bài (Context):**  Giả sử hệ thống đang quản lý một mảng gồm 3 tác vụ: 
- Tasks = `[Task A, Task B, Task C]` 
- `Number_of_Tasks = 3`). 
Để dễ hình dung, cấu hình thời gian định kỳ (`TaskInterval`) của các tác vụ lần lượt là: Task A (10ms), Task B (20ms), và Task C (30ms). 
`TaskIntervals` = `[
		`TaskA` = `10ms`,
		`TaskB` = `20ms`,
		 `TaskC` = `30ms`		 
]`
Hiện tại, hệ thống vừa khởi động xong và đồng hồ thời gian thực vừa điểm mốc 
`ElapsedTime` = 10ms.

***Lưu ý:*** Bản chất ta có taskIndex là sản phẩm chính để xác định index hiện tại.
***Ví** **dụ*** ta có mảng ElapsedTime[] là mảng lưu các mốc thời gian các lần chạy cuối của TaskA, TaskB, TaskC thì ElapsedTime[0] sẽ là mốc thời gian lần chạy cuối của TaskA. Các phần tử này sẽ được update liên tục trong quá trình chạy.
**Cơ chế cập nhật:** Các phần tử trong mảng này sẽ được hệ thống cập nhật liên tục (bằng thời gian hiện tại) ngay sau khi tác vụ tương ứng (tại vị trí `TaskIndex`) vừa được thực thi xong.
##### **a. Happy Case:**
**Bắt đầu vòng lặp điều phối:**

- **Bước 1:** `Read System Time` - Hệ thống đọc đồng hồ, ghi nhận thời gian hiện tại = 10ms.
    
- **Bước 2:** `Set TaskIndex = 0`  - Con trỏ mảng bắt đầu ở vị trí 0, trỏ vào **Task A**
**Kiểm tra Task A (TaskIndex = 0):**

- **Bước 3:** `TaskIndex < Number_of_Tasks` (0 < 3)? $\rightarrow$ **Yes** (Vẫn còn tác vụ trong mảng).
    
- **Bước 4:** `Calculate Elapsed time` - Tính thời gian trôi qua = Thời gian hiện tại (10) - Lần chạy cuối (0) = 10ms.
    
- **Bước 5:** `ElapsedTime >= TaskInterval` (10 >= 10)? $\rightarrow$ **Yes** (Đã đến giờ Task A phải chạy).
    
- **Bước 6:** `Run Task i` - CPU thực thi Task A. (Giả sử Task A chạy rất nhanh, mất 2ms rồi chủ động nhả CPU ra).
    
- **Bước 7:** `Store Elapsed Time` - Hệ thống lưu lại mốc thời gian Task A vừa chạy xong để làm cơ sở tính toán cho chu kỳ sau.
    
- **Bước 8:** `TaskIndex++` - Tăng con trỏ lên 1, chuẩn bị xét tới tác vụ tiếp theo.
    

**Kiểm tra Task B (TaskIndex = 1):**

- **Bước 9:** `TaskIndex < Number_of_Tasks` (1 < 3)? $\rightarrow$ **Yes**.
    
- **Bước 10:** `Calculate Elapsed time` - Do Task A vừa ngốn 2ms, System Time lúc này là 12ms. Thời gian trôi qua của B = 12 - 0 = 12ms.
    
- **Bước 11:** `ElapsedTime >= TaskInterval` (12 >= 20)? $\rightarrow$ **No** (Chưa đến giờ chạy của Task B).
    
- **Bước 12:** Nhảy sang khối xám `TaskIndex++` theo đường đứt nét màu xanh lá. CPU bỏ qua không chạy Task B, tăng con trỏ lên 2.
    

**Kiểm tra Task C (TaskIndex = 2):**

- **Bước 13:** `TaskIndex < Number_of_Tasks` (2 < 3)? $\rightarrow$ **Yes**.
    
- **Bước 14:** `Calculate Elapsed time` - Thời gian hiện tại vẫn là 12ms (do B bị bỏ qua nên không tốn thời gian). Thời gian trôi qua của C = 12 - 0 = 12ms.
    
- **Bước 15:** `ElapsedTime >= TaskInterval` (12 >= 30)? $\rightarrow$ **No** (Chưa đến giờ chạy của Task C).
    
- **Bước 16:** Nhảy sang khối xám `TaskIndex++`. CPU bỏ qua Task C, tăng con trỏ lên 3.
**Kết thúc một lượt quét mảng:**

- **Bước 17:** `TaskIndex < Number_of_Tasks` (3 < 3)? $\rightarrow$ **No** (Đã duyệt hết mảng tác vụ).
    
- **Bước 18:** Thuật toán đi theo mũi tên vòng ngược lại lên đỉnh, thực hiện một lệnh `Read System Time` mới để bắt đầu một vòng lặp kiểm tra tiếp theo.


**Chạy tay Vòng lặp thứ 2 (Bắt đầu từ Bước 19)**

**Bắt đầu vòng lặp:**

- **Bước 19:** `Read System Time` - Hệ thống đọc đồng hồ, ghi nhận thời gian hiện tại = 20ms.
    
- **Bước 20:** `Set TaskIndex = 0` - Con trỏ lại quay về đầu mảng, trỏ vào **Task A**.
    

**Xét Task A (TaskIndex = 0):**

- **Bước 21:** `TaskIndex < 3`? $\rightarrow$ **Yes**.
    
- **Bước 22:** `Calculate Elapsed time` - Tính thời gian trôi qua = Thời gian hiện tại (20) - Lần chạy A cuối cùng (10) = 10ms.
    
- **Bước 23:** `ElapsedTime >= TaskInterval` (10 >= 10)? $\rightarrow$ **Yes** (Đúng chu kỳ của Task A).
    
- **Bước 24:** `Run Task A` - CPU lại lôi Task A ra chạy (mất 2ms).
    
- **Bước 25:** `Store Elapsed Time` - Lưu mốc chạy xong của A là 20 (hoặc 22 tùy cách code).
    
- **Bước 26:** `TaskIndex++` - Tăng con trỏ lên 1 (Lúc này đồng hồ thực tế đã trôi đến `22ms` vì A vừa chạy).
    

**Xét Task B (TaskIndex = 1):**

- **Bước 27:** `TaskIndex < 3`? $\rightarrow$ **Yes**.
    
- **Bước 28:** `Calculate Elapsed time` - Thời gian trôi qua của B = Thời gian hiện tại (22) - Lần chạy B cuối cùng (0) = 22ms.
    
- **Bước 29:** `ElapsedTime >= TaskInterval` (22 >= 20)? $\rightarrow$ **YES!** (Đã lố 2ms so với chu kỳ 20ms của Task B, B đã "chín").
    
- **Bước 30:** `Run Task B` - CPU cấp quyền cho B. (Giả sử B chạy tác vụ của nó mất 3ms).
    
- **Bước 31:** `Store Elapsed Time` - Lưu mốc chạy của B (Lúc này đồng hồ thực tế bị đẩy lên `25ms`).
    
- **Bước 32:** `TaskIndex++` - Tăng con trỏ lên 2.
    

**Xét Task C (TaskIndex = 2):**

- **Bước 33:** `TaskIndex < 3`? $\rightarrow$ **Yes**.
    
- **Bước 34:** `Calculate Elapsed time` - Thời gian trôi qua của C = Thời gian hiện tại (25) - Lần chạy C cuối cùng (0) = 25ms.
    
- **Bước 35:** `ElapsedTime >= TaskInterval` (25 >= 30)? $\rightarrow$ **No**. (Task C đòi 30ms, mới có 25ms nên C vẫn phải ngậm ngùi đợi).
    
- **Bước 36:** Bỏ qua C, nhảy tới `TaskIndex++` - Tăng con trỏ lên 3.
    

**Kết thúc vòng lặp 2:**

- **Bước 37:** `TaskIndex < 3` (3 < 3)? $\rightarrow$ **No**.
    
- **Bước 38:** Quay ngược lên đỉnh chờ vòng lặp tiếp theo.
    

**Tóm tắt lại luật chơi:** Qua ví dụ này bạn có thể thấy thuật toán này giống hệt một ông bảo vệ cầm danh sách đi tuần tra liên tục. Ông ấy cứ đi từ đầu đến cuối hàng, nhìn đồng hồ xem đã đến giờ của ai chưa.

- Ai đến giờ thì cho làm việc.
    
- Ai chưa đến giờ thì lướt qua luôn không thương tiếc.
    
- Và vòng lặp thứ 3 (khi đồng hồ vượt qua 30ms), cuối cùng **Task C** mới được ông bảo vệ gật đầu cho chạy!
____
**TRƯỜNG HỢP KHÔNG HAPPY CASE**
##### Bối cảnh mô phỏng (Context)

- **3 tác vụ:** Task A (chu kỳ `TaskInterval` = 10ms), Task B (20ms), Task C (30ms).
    
- **Trạng thái trước khi nghẽn:** Hệ thống vừa chạy xong một vòng trơn tru. Hiện tại đồng hồ `System Time = 20ms`.
    
- Mảng `LastRunTime` đang lưu mốc chạy cuối cùng: `[Task A: 10, Task B: 0, Task C: 0]`.
    
- **Kịch bản sự cố:** Lần này, Task B gặp một vòng lặp phức tạp (hoặc mạng lag) nên thay vì chạy mất 3ms, nó ngốn tới **20ms** của CPU.
##### Chạy tay thuật toán (Bottleneck Case)

**Bắt đầu vòng lặp:**

- **Bước 1:** `Read System Time` $\rightarrow$ Thời gian hiện tại = 20ms.
    
- **Bước 2:** `Set TaskIndex = 0` (Xét Task A).
    

**Xét Task A (Đang bình thường):**

- **Bước 3:** `Calculate Elapsed time` $\rightarrow$ 20 - 10 = 10ms.
    
- **Bước 4:** `ElapsedTime >= TaskInterval` (10 >= 10) $\rightarrow$ **Yes**.
    
- **Bước 5:** `Run Task A` $\rightarrow$ CPU chạy Task A mất 2ms.
    
- **Bước 6:** `Store Elapsed Time` $\rightarrow$ Cập nhật `LastRunTime[0] = 22`. (Đồng hồ thực tế trôi đến **22ms**).
    
- **Bước 7:** `TaskIndex++` $\rightarrow$ Chuyển sang Task B.
    

**Xét Task B (SỰ CỐ NGHẼN BẮT ĐẦU):**

- **Bước 8:** `Calculate Elapsed time` $\rightarrow$ Thời gian hiện tại là 22. Elapsed B = 22 - 0 = 22ms.
    
- **Bước 9:** `ElapsedTime >= TaskInterval` (22 >= 20) $\rightarrow$ **Yes**.
    
- **Bước 10:** `Run Task B` $\rightarrow$ CPU cấp quyền cho B. **[ĐIỂM NGHẼN]:** Task B bị kẹt logic, nó ôm khư khư CPU chạy miệt mài mất **20ms**. Vì đây là Lập lịch hợp tác (không có Pre-emption ngắt ngang), hệ thống hoàn toàn bất lực đứng nhìn.
    
- **Bước 11:** `Store Elapsed Time` $\rightarrow$ B chạy xong. Cập nhật `LastRunTime[1] = 42`. (Đồng hồ thực tế bị đẩy một mạch lên **42ms**).
    
- **Bước 12:** `TaskIndex++` $\rightarrow$ Chuyển sang Task C.
    

**Xét Task C (Hệ lụy 1 - Trễ thời gian):**

- **Bước 13:** `Calculate Elapsed time` $\rightarrow$ Thời gian hiện tại là 42. Elapsed C = 42 - 0 = 42ms.
    
- **Bước 14:** `ElapsedTime >= TaskInterval` (42 >= 30) $\rightarrow$ **Yes**. (Đáng lẽ C được chạy từ mốc 30ms, nhưng vì B chiếm CPU nên C phải đợi đến tận 42ms mới được chạy).
    
- **Bước 15:** `Run Task C` $\rightarrow$ CPU chạy C mất 3ms.
    
- **Bước 16:** `Store Elapsed Time` $\rightarrow$ Cập nhật `LastRunTime[2] = 45`. (Đồng hồ trôi đến **45ms**).
    
- **Bước 17:** `TaskIndex++` $\rightarrow$ Tăng lên 3. Vượt quá `Number_of_Tasks`, quay lại đỉnh vòng lặp.
    

**Vòng lặp tiếp theo - Xét lại Task A (Hệ lụy 2 - Phá vỡ Deadline hoàn toàn):**

- **Bước 18:** `Read System Time` $\rightarrow$ Thời gian hiện tại = 45ms.
    
- **Bước 19:** `Set TaskIndex = 0` (Xét lại Task A).
    
- **Bước 20:** `Calculate Elapsed time` $\rightarrow$ Thời gian hiện tại (45) - `LastRunTime[0]` (22) = **23ms**.
    
- **Phân tích lỗi:** Chu kỳ yêu cầu của Task A là **10ms**. Đáng lý ra, sau khi chạy xong ở mốc 22ms, Task A phải được gọi lại vào khoảng mốc **32ms**. Nhưng vì ông "Task B" đứng trước nó trong mảng chiếm dụng CPU quá lâu (từ 22ms đến 42ms), vòng lặp không thể quay lại vòng mới để cấp CPU cho A. Kết quả là Task A bị "bỏ đói" tận 23ms, lỡ mất 2 nhịp định kỳ!

![[Pasted image 20260630103049.png|697]]

| **Tiêu chí**        | **Bare-metal (Round-robin)**             | **Cooperative Scheduling**                              |
| ------------------- | ---------------------------------------- | ------------------------------------------------------- |
| **Tính chủ động**   | Bị động (chạy theo danh sách).           | Chủ động (kiểm tra giờ mới chạy).                       |
| **Sử dụng CPU**     | Luôn chạy hết công suất (High power).    | Biết "nghỉ ngơi" khi các task chưa đến giờ (Low power). |
| **Khả năng dự báo** | Khó (phụ thuộc tổng thời gian các Task). | Dễ (mỗi task có chu kỳ riêng).                          |
| **Độ phức tạp**     | Rất thấp.                                | Trung bình (cần logic so sánh thời gian).               |
![[Pasted image 20260630105741.png]]
### **(Slide bị sai, check lại với thầy)**
Sai ở đạn cập nhật lại taskIndex
### 4. Real-Time Operating Systems (RTOS) (Phần 5 tìm hiểu QNX RTOS, còn phần này là lý thuyết tổng quan về RTOS)

![[NotebookLM Mind Map (7).png|697]]
#### 4.1. RTOS là gì?
- RTOS viết tắt Real-time Operating Systems.
- Nếu một Hệ điều hành thông thường (như Windows, Linux trên PC) ưu tiên việc **"làm được nhiều việc cùng lúc"** (throughput) mà không quá quan trọng việc cái nào xong trước, thì **RTOS** lại tập trung vào sự **"đúng giờ tuyệt đối"** (timing accuracy).
- Hãy tưởng tượng dàn nhạc giao hưởng (hệ thống nhúng):
	- **Các nhạc công (Tasks/Threads):** Đang chơi các loại nhạc cụ khác nhau (đọc cảm biến, gửi dữ liệu, điều khiển động cơ).
	- **RTOS (Nhạc trưởng):** Đảm bảo rằng dù nhạc công nào chơi nhanh hay chậm, họ đều phải khớp nhịp đúng mốc thời gian quy định.
- **Bối cảnh gắn với QNX:** QNX là tên của một Hệ điều hành thời gian thực (**Real-Time Operating System - RTOS**) thương mại, được thiết kế chuyên biệt cho các hệ thống nhúng đòi hỏi độ tin cậy và chính xác về thời gian cực cao.
	- **Nguồn gốc:** Nó được phát triển bởi công ty QNX Software Systems (nay thuộc BlackBerry) và đã có hơn 30 năm phát triển.
	- **Ứng dụng:** Thường thấy trong các hệ thống đòi hỏi tính "sống còn" như: thiết bị y tế, ô tô, mạng công nghiệp và viễn thông.
#### 4.2. Các trụ cột của RTOS
RTOS được xây dựng dựa trên 6 yếu tố cốt lõi giúp hệ thống trở nên "thông minh" và có thể dự đoán được:
![[Pasted image 20260630110614.png|697]]
- **Multi-tasking (Đa nhiệm):** Cho phép hệ thống thực hiện nhiều việc song song.
    
- **Predictable execution time (Thời gian thực thi dự đoán được):** Bạn biết chính xác mỗi tác vụ sẽ mất bao lâu.
    
- **Known maximum response times (Phản hồi tối đa):** Hệ thống đảm bảo sẽ không bao giờ phản hồi chậm hơn một mốc thời gian nhất định.
    
- **Bounded latency (Độ trễ giới hạn):** Mọi thời gian chờ đợi đều nằm trong tầm kiểm soát.
    
- **Task interrupts (Ngắt tác vụ) - Preemption:** Khả năng "dừng ngay" một việc đang làm để xử lý việc khẩn cấp.
    
- **Deterministic (Tính xác định):** Kết quả luôn khớp với thời gian dự kiến, không phụ thuộc vào may rủi.
#### 4.3. Tại sao RTOS lại cần thiết? (So sánh thực tế)
Tài liệu cung cấp một ví dụ rất trực quan về việc tại sao các hệ thống như Voice Recorder cần sự trợ giúp của RTOS.

- **Sequential Tasks (Tuần tự):** Nếu bạn chỉ có một vòng lặp chạy Task 1 xong mới đến Task 2, bạn sẽ không thể vừa **Update LCD** (màn hình) vừa **Scan Keys** (phím bấm) một cách mượt mà.
    
- **RTOS Concurrency (Đa nhiệm):** RTOS chia nhỏ các công việc thành các "chunk" (lát cắt) thời gian. CPU chuyển đổi cực nhanh giữa việc Update LCD, Scan Keys và Save Audio, tạo cảm giác cho người dùng là tất cả đang chạy cùng một lúc.
#### 4.4. Kiến trúc RTOS: Cách tổ chức "Công ty" (QNX Architecture)

Dựa trên kiến trúc Microkernel của QNX, hệ thống được tổ chức theo mô hình "tối giản":

- **Kernel (Scheduler) - "Giám đốc":** Là phần "bare minimum" (tối thiểu), nằm ở trung tâm để quản lý lập lịch.
    
- **User Space - "Các phòng ban":** Mọi thành phần khác như **Network protocols**, **File system**, **Device drivers** đều nằm ngoài Kernel.
    
    - Sự tách biệt này giúp tăng độ tin cậy: Nếu một trình điều khiển (Driver) bị lỗi, nó không làm sập toàn bộ Kernel.
        
- **BSP (Board Support Package):** Là lớp dưới cùng, giúp OS "giao tiếp" với phần cứng cụ thể (CPU, bộ nhớ).
    
![[Pasted image 20260630115010.png]]
#### 4.5. Hai chiến lược thiết kế (Native vs. RT Extensions)

Có hai cách tiếp cận để tạo ra một RTOS:

- **Native RTOS (Thiết kế từ đầu - QNX):**
    
    - Được xây dựng từ đầu cho mục đích thời gian thực.
        
    - Tối ưu cho hệ thống cần độ an toàn cực cao (fail-safe) như y tế, ô tô, quân sự.
        
    - Tiết kiệm tài nguyên phần cứng.
        
- **RT Extensions (Mở rộng từ OS sẵn có - RT-Linux, Windows Embedded):**
    
    - "Chắp vá" một bộ phận thời gian thực vào một OS thông thường.
        
    - Ưu điểm: Tận dụng được kho ứng dụng và phần cứng phong phú của OS gốc.
        
    - Nhược điểm: Tiêu tốn nhiều tài nguyên (CPU, RAM) và độ tin cậy không bằng Native RTOS.
        
![[Pasted image 20260630115103.png]]
#### 4.6. Công cụ lập trình RTOS (IPC & Synchronization)

Vì các tác vụ (Tasks) trong RTOS chạy song song (concurrent), bạn cần các công cụ để chúng "nói chuyện" và không "đâm" vào nhau:

- **Message Passing (Gửi tin nhắn):** Cách các Task trao đổi dữ liệu. QNX rất mạnh về cơ chế này (MsgSend, MsgReceive).
    
- **Mutex/Semaphores (Đèn giao thông):** Công cụ đồng bộ hóa. Dùng để bảo vệ vùng dữ liệu dùng chung, đảm bảo chỉ 1 Task được truy cập tại một thời điểm (Mutual Exclusion).
    
- **POSIX Standard:** QNX tuân thủ chuẩn POSIX, giúp bạn dễ dàng di chuyển code giữa các hệ điều hành khác nhau.
    

#### 4.7. Các "bẫy" chết người (Common Hazards)

Khi lập trình RTOS, nếu quản lý Task không tốt, bạn sẽ gặp các rủi ro:

- **Deadlock (Bế tắc):** Hai Task cùng chờ tài nguyên của nhau, kết quả là cả hệ thống "đứng hình" mãi mãi.
    
- **Starvation (Đói tài nguyên):** Một Task quan trọng bị các Task khác cướp hết tài nguyên, không bao giờ được chạy.
    
- **Livelock:** Các Task liên tục thay đổi trạng thái để né tránh nhau (như hai người đi đường né trái rồi né phải liên tục) nhưng không Task nào hoàn thành được việc.
    

#### 4.8. Đặc điểm kỹ thuật cần lưu ý

Để đạt được tính "Real-time", RTOS phải đảm bảo:

- **Interrupt Latency (Độ trễ ngắt):** Thời gian tối đa kể từ khi ngắt xảy ra đến khi trình phục vụ ngắt (ISR) bắt đầu chạy phải được đảm bảo (càng thấp càng tốt).
    
- **Preemption (Ngắt ngang):** Khả năng Task ưu tiên cao "đá" Task thấp ưu tiên ra khỏi CPU ngay lập tức.
    
- **High Resolution Clock:** Cần bộ đếm thời gian cực chính xác (đơn vị micro giây) để đảm bảo deadline.

### 5. QNX RTOS
#### **5.1. QNX là gì?**

- **Lý thuyết:** Là một Hệ điều hành thời gian thực (RTOS) thương mại, chuyên trị các hệ thống "sống còn" (mission-critical) như thiết bị y tế, ô tô, mạng công nghiệp.
    
- **Ví dụ trực quan:** Nếu hệ điều hành Windows/Linux là "Cảnh sát khu vực" xử lý đủ mọi loại việc từ giấy tờ đến tuần tra (đa năng nhưng đôi khi bị quá tải và trễ nải), thì QNX là "Lực lượng đặc nhiệm Cấp cứu". Đã gọi là phải có mặt ngay lập tức để giữ mạng sống (điều khiển phanh xe ô tô, máy trợ thở), không có chuyện "đang bận chờ chút".
    

#### **5.2. Kiến trúc Microkernel (Vi nhân) - Linh hồn của QNX**

- **Lý thuyết:** Hạt nhân (Kernel) siêu nhỏ (dưới 400KB), chỉ làm đúng một việc là điều phối (Scheduler). Mọi thứ khác như Trình điều khiển (Drivers), Hệ thống File, Mạng... đều bị đẩy ra chạy độc lập bên ngoài Kernel, trong một vùng nhớ an toàn gọi là "User Space".
    
- **Ví dụ trực quan:** Hãy tưởng tượng một con tàu biển chở khách.
    
    - _Hệ điều hành thường (Linux/Windows):_ Động cơ, hành khách, khoang hàng nằm chung một không gian. Nếu khoang hàng cháy (Lỗi Driver), cả tàu sẽ chìm (Hiện tượng Màn hình xanh - Blue Screen).
        
    - _QNX Microkernel:_ Tàu được chia thành nhiều khoang kín nước hoàn toàn độc lập. Nếu khoang hàng bị thủng (Driver mạng bị lỗi), cửa khoang tự đóng lại, buồng lái (Kernel) vẫn khô ráo, tàu vẫn chạy bình thường.


![[Pasted image 20260630130450.png]]

![[Pasted image 20260630130530.png]]

![[Pasted image 20260630130542.png]]
#### **5.3. Bốn điểm mạnh kỹ thuật**

- **Tính Mô-đun (Modularity):** Có thể tắt/bật bất kỳ chức năng nào mà không cần chỉnh sửa hay biên dịch lại Kernel.
    
    - _Ví dụ:_ Giống hệt như chơi xếp hình Lego. Nền tảng cốt lõi luôn giữ nguyên. Hôm nay bạn lắp thêm khối "Wifi", ngày mai tháo ra cắm khối "Bluetooth" vào cực kỳ nhẹ nhàng.
        
- **Chuẩn POSIX:** Tuân thủ chuẩn giao diện POSIX.
    
    - _Ví dụ:_ Giống như dùng chung ổ cắm điện quốc tế. Đoạn code C/C++ bạn viết cho máy Linux hoàn toàn có thể "bê" sang cắm thẳng vào QNX chạy mượt mà không cần viết lại từ đầu.
        
- **Hiệu năng & Mở rộng:** Chuyển ngữ cảnh cực nhanh, độ trễ ngắt thấp, hỗ trợ tốt CPU đa nhân (Scalable).
    
    - _Ví dụ:_ Giống như một tổng đài viên siêu đẳng, có thể chuyển máy giữa hàng ngàn cuộc gọi khẩn cấp trong nháy mắt mà không ai cảm thấy bị gián đoạn.
        

#### **5.4. Công cụ: QNX Momentics IDE**

- **Lý thuyết:** Là phần mềm đồ họa để viết code, quản lý file, gỡ lỗi (debug) và biên dịch mã nguồn chạy trên nhiều loại chip khác nhau cùng lúc.
    
- **Ví dụ trực quan:** Bách đang làm quen với Java/Spring Boot qua IntelliJ IDEA đúng không? Momentics IDE cũng xịn xò và đầy đủ tính năng y hệt như IntelliJ. Điểm thú vị là bạn gõ code trên máy tính của mình, bấm nút "Run", code sẽ bay thẳng qua dây mạng và chạy trực tiếp trên con bo mạch nhúng nằm ở trên bàn làm việc của bạn.
### 6. System Validation
hần này tập trung vào việc làm thế nào để đảm bảo một hệ thống thời gian thực hoạt động an toàn và đúng đắn, đặc biệt là khi đối mặt với các tình huống xấu nhất. (worst cases)

#### a. Đánh giá độc lập và Thời gian thực thi xấu nhất (Worst Case Execution Time - WCET)

- **Lý thuyết:** Yêu cầu tiên quyết là phải có khả năng kiểm chứng từng thành phần một cách độc lập với bối cảnh của toàn hệ thống. Hệ thống cần tính toán "Worst case execution times" bằng cách thiết lập các giới hạn trên đối với hiệu suất tệ nhất.
    
- **Ví dụ trực quan:** Giống như khi bạn tính toán thời gian đi làm. Ngày bình thường mất 15 phút, nhưng "Worst Case" là lúc trời mưa ngập, tắc đường cứng ngắc, bạn phải mất tới 45 phút. Trong RTOS, hệ thống phải được thiết kế để sống sót qua được mức 45 phút này chứ không thể thiết kế theo mức 15 phút lý tưởng.
    

#### b. Xử lý các bẫy rủi ro hệ thống (System Hazards)

Đôi khi việc tính toán hiệu suất tệ nhất là bất khả thi tùy thuộc vào ứng dụng, do đó cần phải xem xét cách hệ thống đối phó với các tình huống lỗi như deadlock hoặc starvation.

**+) Deadlock (Bế tắc)**

- **Lý thuyết:** Xảy ra khi hai hoặc nhiều hành động cạnh tranh đang chờ đợi lẫn nhau kết thúc, dẫn đến việc không có hành động nào bao giờ hoàn thành. Tức là các tác vụ đang giữ tài nguyên của nhau và cùng đợi nhau nhả ra.
    
- **Ví dụ trực quan:** Tưởng tượng Bách và đồng nghiệp tên Hùng đang cùng tích hợp một tính năng. Bách đang giữ quyền ghi vào bảng User trong Database và gọi sang API của Hùng để lấy dữ liệu. Trong khi đó, Hùng lại đang "khóa" API đó để xử lý và ngồi đợi Bách nhả bảng User ra thì mới chạy tiếp được. Kết quả: Hai anh em ôm máy nhìn nhau mãi mãi. Hoặc đơn giản là kẹt xe chữ thập ở ngã tư, không đầu xe nào nhúc nhích được.
    

**+) Starvation (Đói tài nguyên)**

- **Lý thuyết:** Xảy ra khi một tiến trình liên tục bị từ chối cấp phát các tài nguyên cần thiết để xử lý công việc của nó, dẫn đến việc nó không bao giờ được chạy.
    
- **Ví dụ trực quan:** Hãy nghĩ đến cảnh bạn đang nổ máy chiếc Honda Wave, chực chờ rẽ từ một con ngõ nhỏ ra trục đường lớn. Nhưng trên đường lớn, các xe tải cỡ bự (tượng trưng cho các Task ưu tiên cao) cứ nối đuôi nhau chạy rầm rập không dứt. Trừ phi có đèn đỏ ngắt ngang (Preemption), nếu không chiếc Wave của bạn sẽ bị "chết đói" ở đầu ngõ, không bao giờ ra được đường lớn.
    

**+) Livelock (Bế tắc động)**

- **Lý thuyết:** Là một trường hợp đặc biệt của starvation, xảy ra khi hai hoặc nhiều tiến trình liên tục thay đổi trạng thái của chúng để phản hồi lại sự thay đổi của các tiến trình khác. Hậu quả là không có tiến trình nào sẽ hoàn thành được công việc.
    
- **Ví dụ trực quan:** Bạn đi bộ trong hành lang công ty và đụng mặt một người đi ngược chiều. Bạn lịch sự bước sang trái để nhường, người kia cũng bước sang phải (cùng một phía với bạn). Bạn lúng túng bước lại sang phải, người kia cũng lật đật bước sang trái. Cứ thế, hai người liên tục "nhảy múa" qua lại, tốn rất nhiều năng lượng (CPU) nhưng không ai đi qua được ai. Điều này cũng tương tự như ví dụ hai xe ô tô ở ngã tư cùng nhích lên rồi lại lùi xuống nhường nhau trong slide bài giảng.
    

#### c. Các phương pháp kiểm chứng (Verification Methods)

Để đảm bảo hệ thống không dính phải các lỗi trên, kỹ sư cần thực hiện:

- **Simulations (Mô phỏng):** Bắt buộc phải thực hiện bằng cách tạo ra các sự kiện gây áp lực (stress) lên hệ thống. Đồng thời, phải kiểm thử tất cả các tổ hợp đầu vào có thể xảy ra.
    
    - _Ví dụ thực tế:_ Cầm tool bắn 10.000 request cùng lúc vào server để xem Deadlock có thực sự xảy ra trong môi trường high-load hay không.
        
- **Formal verification (Kiểm chứng hình thức):** Bao gồm việc xác minh từng thành phần phần cứng riêng lẻ và xác minh thuật toán nền tảng.
    
    - _Ví dụ thực tế:_ Dùng các mô hình toán học và logic để chứng minh thiết kế phần cứng và thuật toán cốt lõi là hoàn toàn đúng đắn, không có lỗ hổng logic nào trước khi bắt tay vào code.
### 7. Real-Time Systems Design

![[NotebookLM Mind Map (8).png|697]]

#### 7.1. Phương pháp tiếp cận (Design Approaches)

Hệ thống thời gian thực có thể được thiết kế theo hai hướng tiếp cận chính:

- **Top-down (Từ trên xuống):** Tập trung vào việc xây dựng kiến trúc tổng thể của hệ thống trước (Architecture). Cách này khá giống với việc bạn áp dụng tư duy Domain-Driven Design (DDD) trong thiết kế phần mềm, nhìn vào các module lớn và sự tương tác giữa chúng trước khi đi sâu vào code chi tiết từng entity.
    
- **Bottom-up (Từ dưới lên):** Tập trung vào việc hoàn thiện từng thành phần nhỏ trước (Individual components). Giống như bạn viết và test chuẩn các hàm hoặc module nhỏ, sau đó mới lắp ghép chúng lại thành hệ thống hoàn chỉnh.
    
- Các hệ thống này có thể được triển khai dưới dạng bộ xử lý đơn (Uni-processor), vi xử lý (Microprocessor), hoặc hệ thống phân tán (Distributed system).
    

#### 7.2. Chế độ thực thi (Execution Mode) - Rất quan trọng

Trong hệ điều hành, cách quản lý quyền sử dụng CPU chia làm hai loại:

- **Preemptive (Có ngắt ngang):** Một Task đang chạy có thể bị "đá" ra khỏi CPU bất cứ lúc nào nếu có một Task khác với độ ưu tiên cao hơn (higher priority) xuất hiện.
    
    - _Ví dụ trực quan:_ Bạn đang ngồi code một tính năng phụ bình thường, đột nhiên có một bug critical trên production (priority cao nhất). Bạn ngay lập tức phải dừng việc đang làm để xử lý bug đó. RTOS thường bắt buộc phải dùng cơ chế này.
        
- **Non-preemptive (Không ngắt ngang):** Một khi một Task đã bắt đầu chạy, không một Task nào khác có thể tước quyền sử dụng CPU của nó cho đến khi nó tự kết thúc (như lập lịch Cooperative Scheduling mà bạn đã hỏi ở trên).
    

#### 7.3. Vòng đời phát triển phần mềm (Software Lifecycle Phases)

Phát triển hệ thống nhúng cũng tuân theo các bước của kỹ thuật phần mềm thông thường : Kỹ thuật Hệ thống (System Engineering) $\rightarrow$ Phân tích Yêu cầu (Requirements Analysis) $\rightarrow$ Thiết kế Chi tiết (Detailed Design) $\rightarrow$ Lập trình (Coding) $\rightarrow$ Kiểm thử (Testing) $\rightarrow$ Bảo trì (Maintenance).

- **Điểm lưu ý ở biểu đồ:** Nó đi theo luồng thác nước từ Yêu cầu (Requirements) , Thiết kế (Design) , Phát triển (Development) , Kiểm thử (Testing) đến Triển khai (Implementation). Tuy nhiên, có một đường nét đứt (vòng lặp phản hồi) nối từ bước **Testing** ngược lại **Requirements**. Điều này có nghĩa là, trong quá trình test, nếu hệ thống không đáp ứng được deadline thời gian thực, bạn bắt buộc phải quay lại từ đầu để xem xét lại yêu cầu và cấu trúc thiết kế.
    
![[Pasted image 20260630125531.png]]
#### 7.4. Công cụ Đặc tả & Thiết kế (Specification & Design)

Để thiết kế một hệ thống nhiều tác vụ chạy song song, bạn không thể chỉ dùng flowchart thông thường. Bạn cần dùng:

- **State Charts (Sơ đồ trạng thái) / Finite State Machines (Máy trạng thái hữu hạn):** Giúp kiểm soát logic hệ thống đi từ trạng thái này sang trạng thái khác.
    
- **UML:** Dành riêng để mô hình hóa các đối tượng chạy song song (concurrent objects).
    
- **Quan trọng nhất:** Bất kỳ bản thiết kế nào cũng phải đưa các **yêu cầu về thời gian (timing requirements)** vào một cách rõ ràng.
    

(Phần thiết kế State Charts và UML này sẽ là nội dung của các bài học tiếp theo trên lớp ).
### 8. Thực hành: Làm quen với QNX Momentics IDE và C (Practical Demo)

_Phần này đưa các lý thuyết trừu tượng về Kernel, Process xuống thành những dòng code C thực tế chạy trên hệ điều hành QNX._

#### 8.1. Ví dụ thực hành: Chương trình C đầu tiên trên QNX (Sample Program)

Đoạn code trong slide minh họa cách một chương trình ứng dụng (Application Code) gọi các hàm hệ thống (System Calls) để "hỏi" thông tin từ Kernel.

- **Lấy số lượng CPU (`_syspage_ptr -> num_cpu`):** * _Liên kết lý thuyết:_ QNX là một hệ điều hành hỗ trợ đa nhân (multi-core CPUs) và xử lý phân tán (như đã đề cập ở slide đặc điểm kiến trúc). Lệnh này sử dụng thư viện `<sys/syspage.h>` để chọc vào thông tin phần cứng (Hardware Layer/BSP) và biết được máy có bao nhiêu luồng xử lý.
    
- **Định danh Tiến trình (`getpid()`):** * _Liên kết lý thuyết:_ Ở mục **3.4. Process vs Threads**, chúng ta đã biết mỗi Tiến trình (Process) khi chạy sẽ được hệ điều hành cấp cho một không gian bộ nhớ độc lập và một mã định danh duy nhất gọi là PID. Lệnh `getpid()` chính là cách để in cái "Căn cước công dân" đó ra màn hình (trong ví dụ slide, PID = 86039).
    
- **Định danh Máy chủ (`gethostname()`):** Lấy tên của thiết bị đích (Target system) đang chạy code, ví dụ: 'Panda01'.
    
- **Hàm `sleep(10)` (Tạm dừng 10 giây):**
    
    - _Tại sao lại cần?_ Trong lập trình nhúng, CPU chạy lệnh chớp nhoáng rồi kết thúc. Lệnh `sleep(10)` ép tiến trình này "ngủ" trong 10 giây trước khi gọi `return EXIT_SUCCESS;`. Điều này giúp hệ thống không bị thoát ngay lập tức, tạo đủ thời gian để lập trình viên quan sát được kết quả in ra trên cửa sổ **Console** của QNX Momentics IDE.
        

#### 8.2. Ôn tập Hàm C cơ bản (Review C functions - printf)

Trong lập trình QNX/C, giao tiếp bằng console (in log) là cách debug phổ biến nhất. Khác với `cout <<` của C++, hàm `printf` trong C yêu cầu sử dụng các **Bộ định dạng (Format Specifiers)** lồng trực tiếp vào trong chuỗi ký tự.

_Mẹo trực quan: Hãy coi chuỗi string của `printf` như một "câu văn đục lỗ", và các specifiers (`%d`, `%c`,...) là hình dáng của các mảnh ghép lấp vào lỗ trống đó._

**Bảng tra cứu nhanh Format Specifiers (Thường dùng trong Lab):**

| **Định dạng**   | **Ý nghĩa (Data Type)**        | **Ví dụ & Mẹo dùng**                                                                                                                       |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`%d`**        | Số nguyên có dấu (Integer)     | `1977`                                                                                                                                     |
| **`%c`**        | Ký tự đơn (Character)          | `'a'` hoặc in ra ký tự ASCII tương ứng với số (VD: 65 = 'A').                                                                              |
| **`%10d`**      | Căn lề phải 10 ô (Padding)     | Thêm khoảng trắng ở đầu cho đủ 10 ký tự. Rất hữu ích khi muốn in các cột số liệu thẳng hàng nhau trên màn hình console.                    |
| **`%010d`**     | Điền số 0 ở đầu (Zero-padding) | `0000001977`. Cực kỳ phổ biến khi ghi log thời gian thực (timestamps) để số ký tự luôn cố định.                                            |
| **`%x` / `%o`** | Hexa (Hệ 16) / Octal (Hệ 8)    | `0x64` / `0144`. Đây là "bảo bối" của kỹ sư nhúng vì khi đọc/ghi các thanh ghi phần cứng (Hardware Registers), người ta luôn dùng mã Hexa. |
| **`%4.2f`**     | Số thực (Float)                | Giới hạn in ra 2 chữ số thập phân. VD: `3.14`                                                                                              |

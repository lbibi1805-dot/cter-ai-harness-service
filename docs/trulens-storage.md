# TruLens — lưu trữ dữ liệu có cần setup Database không?

**Trả lời ngắn:** Không. TruLens chạy theo kiểu plug-and-play — mặc định tự tạo file SQLite, không cần cài hay cấu hình hệ quản trị CSDL nào. Chỉ khi cần dashboard dùng chung cho cả team mới phải trỏ sang DB server.

## 1. Mặc định — cá nhân / thử nghiệm

- **Lưu ở đâu:** lần đầu chạy code TruLens, nó tự tạo file `default.sqlite` trong thư mục làm việc hiện tại (thường là thư mục project / notebook).
- **Phải làm gì:** không gì cả. TruLens dùng **SQLAlchemy** để tự tạo bảng và lưu toàn bộ lịch sử:
  - câu hỏi (input), câu trả lời (output)
  - ngữ cảnh truy xuất (retrieved context — với RAG)
  - thời gian chạy (latency), chi phí / số token
  - điểm của các **Feedback Functions** (groundedness, context relevance, answer relevance, …)
- **Dashboard:** `run_dashboard(session)` bật một web app **Streamlit** đọc trực tiếp từ file SQLite đó để hiển thị bảng xếp hạng, biểu đồ, chi tiết từng record.

```python
from trulens.core import TruSession
from trulens.dashboard import run_dashboard

session = TruSession()   # -> tự tạo ./default.sqlite
run_dashboard(session)   # mở dashboard Streamlit
```

## 2. Production — team / cloud

File SQLite nằm trên máy cá nhân nên người khác không xem được. Khi cả team cần chung một dashboard, theo dõi dài hạn, hoặc tích hợp vào backend chung → mới cần cấu hình DB.

- **Hỗ trợ:** mọi DB mà SQLAlchemy hỗ trợ — **PostgreSQL**, **MySQL / MariaDB**, … Ngoài ra có connector riêng cho **Snowflake** (`trulens-connectors-snowflake`).
- **Cách cấu hình:** truyền connection string (database URL) khi khởi tạo session:

```python
from trulens.core import TruSession

# Dùng PostgreSQL thay cho file SQLite mặc định
session = TruSession(
    database_url="postgresql://username:password@host:port/dbname"
)
```

> Không hard-code mật khẩu — đọc URL từ biến môi trường (vd. `TRULENS_DATABASE_URL`).

## Lưu ý phiên bản API

Các bài viết / ví dụ cũ dùng package `trulens_eval`:

```python
from trulens_eval import Tru               # API cũ (< 1.0), đã deprecated
tru = Tru(database_url="postgresql://...")
tru.run_dashboard()
```

Từ TruLens **1.x** trở đi: `pip install trulens`, dùng `TruSession` (`trulens.core`) và `run_dashboard` (`trulens.dashboard`). Tham số `database_url` vẫn giữ nguyên ý nghĩa.

## Liên quan tới `cter-ai-harness-service`

TruLens là thư viện **Python**, còn service này viết bằng **TypeScript** — không gọi trực tiếp được. Nếu muốn đánh giá RAG pipeline (`src/modules/retrieval/`) bằng TruLens, cần chạy một script/sidecar Python riêng (vd. gọi API của harness rồi log kết quả qua TruLens).

## Tóm lại

| Tình huống | Lưu trữ | Cần setup? |
|---|---|---|
| Học, làm bài tập, thử nghiệm trên máy / Jupyter | `default.sqlite` tự tạo | Không |
| Team dùng chung dashboard, theo dõi dài hạn, tích hợp backend | PostgreSQL / MySQL / Snowflake qua `database_url` | Có — chỉ cần connection string |

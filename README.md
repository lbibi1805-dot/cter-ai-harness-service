# Canvas File Helper

Canvas File Helper là một daemon Node.js/TypeScript chạy nền để tự động lấy file từ Canvas, gửi nội dung file sang AI, rồi upload kết quả trả lời dạng `.docx` ngược lại Canvas.

Ứng dụng phù hợp cho workflow:

1. Người dùng upload câu hỏi/tài liệu vào Canvas.
2. App tự phát hiện file mới trong thư mục `Materials/Q`.
3. App chọn AI provider theo tên file.
4. App tạo file kết quả trong `Materials/A`.

## Tính năng

- Theo dõi nhiều tài khoản Canvas cùng lúc.
- Poll Canvas theo chu kỳ cấu hình bằng `.env`.
- Chỉ xử lý file có tên bắt đầu bằng `START_`.
- Chọn AI provider qua tên file: `claude`, `gemini`, hoặc `grok`.
- Cho phép chỉ định model trực tiếp trong tên file.
- Dùng default model khi tên file không chỉ định model.
- Kiểm tra model hợp lệ trước khi gọi AI.
- Hỗ trợ input dạng `.txt`, `.md`, `.docx`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.
- Trích xuất text và ảnh từ file `.docx`.
- Gửi text và ảnh sang AI nếu provider/model hỗ trợ.
- Tự chèn nội dung `knowledge.md` vào mỗi request AI nếu file này có nội dung.
- Dùng `system-prompt.md` làm system prompt chung cho AI.
- Tạo output `.docx` từ Markdown trả về bởi AI.
- Upload file kết quả vào thư mục `Materials/A` trên Canvas.
- Tạo file `.docx` báo lỗi nếu xử lý thất bại hoặc model không hợp lệ.
- Lưu trạng thái xử lý local tại `data/processed.json` để tránh xử lý lại.
- Bỏ qua file nếu file `_DONE.docx` đã tồn tại trên Canvas.
- Retry khi lỗi theo `MAX_RETRY_COUNT`.
- Timeout từng lượt gọi AI theo `AI_TIMEOUT_MS`.
- Reset trạng thái `processing` quá lâu để có thể thử lại ở các lần poll sau.
- Gửi email thông báo thành công/thất bại qua Gmail nếu được cấu hình.
- Cung cấp API nội bộ để start/stop polling khi app đang chạy.
- Gửi email thông báo cho các tài khoản Canvas khi polling được bật hoặc tạm dừng qua API.
- Log rõ từng bước: fetch, validate, download, extract, AI, upload, retry, failed.

## Luồng chạy

1. App khởi động từ `src/index.ts`.
2. App đọc `.env`, `system-prompt.md`, `knowledge.md` và trạng thái trong `data/processed.json`.
3. App tạo email notifier nếu có cấu hình Gmail.
4. App khởi động API server trên `API_PORT` và chờ lệnh điều khiển.
5. Khi gọi `GET /start`, app validate AI keys, poll tất cả tài khoản Canvas ngay một lần, sau đó lặp lại theo `POLL_INTERVAL_MS`.
6. Với mỗi tài khoản Canvas, app tìm thư mục `Materials`.
7. Trong `Materials`, app tìm thư mục input `Q`.
8. App tìm hoặc tự tạo thư mục output `A`.
9. App lấy danh sách file trong `Q` có `search_term=START_`.
10. App lấy danh sách toàn bộ file trong `A` để kiểm tra file kết quả đã có chưa.
11. Với mỗi file input, app parse tên file để lấy provider, model và extension.
12. Nếu file không đúng format, đã có `_DONE.docx`, hoặc đã có trong state local thì app bỏ qua.
13. Nếu model được chỉ định nhưng không nằm trong danh sách hỗ trợ, app upload file lỗi `.docx`.
14. Nếu hợp lệ, app tải file từ Canvas.
15. App trích xuất nội dung file thành text và/hoặc ảnh.
16. App chèn nội dung `knowledge.md` vào đầu text nếu có.
17. App gọi AI provider tương ứng với system prompt và model đã chọn.
18. App chuyển phản hồi Markdown của AI thành file `.docx`.
19. App upload file kết quả vào `Materials/A`.
20. App cập nhật `data/processed.json`.
21. Nếu tài khoản có `CANVAS_EMAIL_n` và Gmail được cấu hình, app gửi email thông báo.

## Cấu trúc thư mục Canvas

App làm việc với thư mục trong Canvas personal files:

```text
Materials/
  Q/  ← nơi đặt file cần xử lý
  A/  ← nơi app upload file kết quả
```

Lưu ý:

- Nếu không có `Materials`, app bỏ qua tài khoản đó.
- Nếu không có `Materials/Q`, app bỏ qua tài khoản đó.
- Nếu chưa có `Materials/A`, app tự tạo.

## Quy ước đặt tên file

Format:

```text
START_<ten_tu_do>_<provider>[_<model>].<extension>
```

Trong đó:

- `START_` là prefix bắt buộc.
- `<ten_tu_do>` là tên bất kỳ.
- `<provider>` là một trong `claude`, `gemini`, `grok`.
- `<model>` là tuỳ chọn.
- `<extension>` là phần mở rộng file.

Ví dụ:

```text
START_bai_tap_1_claude.txt
START_cau_hoi_gemini_gemini-2.0-flash.docx
START_anh_bai_lam_grok_grok-4-fast-reasoning.png
```

File output luôn có dạng:

```text
<ten_file_goc>_DONE.docx
```

Ví dụ:

```text
START_bai_tap_1_claude.txt
→ START_bai_tap_1_claude_DONE.docx
```

## Provider và model hỗ trợ

### Claude

- `claude-opus-4-7`
- `claude-sonnet-4-6`
- `claude-haiku-4-5-20251001`

Default:

- `claude-sonnet-4-6`

### Gemini

- `gemini-2.0-flash`
- `gemini-1.5-pro`

Default:

- `gemini-2.0-flash`

### Grok

- `grok-4.3`
- `grok-4.20-0309-reasoning`
- `grok-4.20-0309-non-reasoning`
- `grok-4-1-fast-reasoning`
- `grok-4-1-fast-non-reasoning`
- `grok-4-fast-reasoning`
- `grok-4-fast-non-reasoning`
- `grok-code-fast-1`

Default trong code:

- `grok-3`

Lưu ý: nếu bạn muốn dùng Grok theo danh sách validate hiện tại, nên đặt `DEFAULT_MODEL_GROK` thành một model nằm trong danh sách hỗ trợ, ví dụ `grok-4.3` hoặc `grok-4-fast-reasoning`.

### OpenAI

Catalog OpenAI hỗ trợ GPT-6 Astra, các model Codex (`gpt-5.3-codex`,
`gpt-5.2-codex`, `gpt-5.1-codex`, `gpt-5.1-codex-mini`, `codex-mini-latest`)
và các model OpenAI hiện có.

GPT-6 Astra và Codex dùng Responses API; các model OpenAI còn lại dùng Chat
Completions. Fallback chỉ chuyển giữa các model cùng API mode.

## File hỗ trợ

| Loại file | Cách xử lý |
|---|---|
| `.txt` | Đọc như text UTF-8 |
| `.md` | Đọc như text UTF-8 |
| `.docx` | Trích xuất text và ảnh bằng `mammoth` |
| `.jpg`, `.jpeg` | Gửi ảnh sang AI |
| `.png` | Gửi ảnh sang AI |
| `.gif` | Gửi ảnh sang AI |
| `.webp` | Gửi ảnh sang AI |
| Khác | Thử đọc như text UTF-8 |

## Biến môi trường

Tạo file `.env` từ `.env.example`:

```bash
copy .env.example .env
```

### Canvas accounts

| Biến | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `CANVAS_URL_1` | Có | URL Canvas, ví dụ `https://rmit.instructure.com` |
| `CANVAS_KEY_1` | Có | Canvas API token |
| `CANVAS_EMAIL_1` | Không | Email nhận thông báo cho tài khoản Canvas số 1 |

Có thể thêm nhiều tài khoản bằng cách tăng số:

```env
CANVAS_URL_2=https://another.instructure.com
CANVAS_KEY_2=your_canvas_api_token_2
CANVAS_EMAIL_2=you@example.com
```

App sẽ đọc lần lượt từ `CANVAS_URL_1`, `CANVAS_KEY_1`, sau đó `CANVAS_URL_2`, `CANVAS_KEY_2`, ... và dừng khi thiếu URL hoặc key.

### Cách lấy Canvas API token

1. Đăng nhập vào Canvas trên trình duyệt.
2. Bấm `Account` ở thanh menu bên trái.
3. Chọn `Settings`.
4. Kéo xuống mục `Approved Integrations`.
5. Bấm `+ New Access Token`.
6. Điền mục đích sử dụng, ví dụ `Canvas File Helper`.
7. Chọn ngày hết hạn nếu Canvas yêu cầu.
8. Bấm `Generate Token`.
9. Copy token vừa tạo ngay lúc đó.
10. Dán token vào `.env`:

```env
CANVAS_URL_1=https://your-school.instructure.com
CANVAS_KEY_1=token_vua_copy
```

Lưu ý:

- Canvas chỉ hiển thị token một lần sau khi tạo, nên cần copy và lưu ngay.
- Không commit token lên git.
- Nếu không thấy nút `+ New Access Token`, có thể tổ chức/trường học đã tắt quyền tự tạo token. Khi đó cần liên hệ admin Canvas hoặc bộ phận IT để xin API token.
- `CANVAS_URL_1` là domain Canvas đang dùng, ví dụ `https://rmit.instructure.com`, không phải link đến một course cụ thể.

### AI provider keys

| Biến | Khi nào cần |
|---|---|
| `CLAUDE_API_KEY` | Cần khi xử lý file dùng provider `claude` |
| `GEMINI_API_KEY` | Cần khi xử lý file dùng provider `gemini` |
| `GROK_API_KEY` | Cần khi xử lý file dùng provider `grok` |

Bạn chỉ cần điền key cho provider thật sự sử dụng.

### Default models

| Biến | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `DEFAULT_MODEL_CLAUDE` | `claude-sonnet-4-6` | Model Claude mặc định |
| `DEFAULT_MODEL_GEMINI` | `gemini-2.0-flash` | Model Gemini mặc định |
| `DEFAULT_MODEL_GROK` | `grok-3` | Model Grok mặc định |

Default model được dùng khi tên file chỉ có provider mà không có model.

Ví dụ:

```text
START_bai_tap_claude.txt
```

File trên sẽ dùng `DEFAULT_MODEL_CLAUDE`.

### Runtime settings

| Biến | Mặc định | Ý nghĩa |
|---|---:|---|
| `API_PORT` | `3000` | Port cho API server điều khiển polling |
| `POLL_INTERVAL_MS` | `60000` | Khoảng cách giữa các lần poll Canvas |
| `AI_TIMEOUT_MS` | `120000` | Timeout cho mỗi lần gọi AI |
| `MAX_RETRY_COUNT` | `3` | Số lần retry tối đa khi xử lý lỗi |
| `GROK_BASE_URL` | `https://api.x.ai/v1` | Base URL cho Grok/xAI API |

### Gmail notification

| Biến | Bắt buộc | Ý nghĩa |
|---|---:|---|
| `GMAIL_USER` | Không | Gmail dùng để gửi thông báo |
| `GMAIL_APP_PASSWORD` | Không | Gmail App Password |

Email chỉ hoạt động khi:

- `GMAIL_USER` và `GMAIL_APP_PASSWORD` đều được điền.
- Tài khoản Canvas có `CANVAS_EMAIL_n`.

Nên dùng Gmail App Password, không dùng mật khẩu đăng nhập Gmail thông thường.

## File cấu hình nội dung AI

### `system-prompt.md`

Nội dung file này được dùng làm system prompt cho tất cả request AI.

Nếu file không tồn tại hoặc rỗng, app dùng prompt mặc định:

```text
You are a helpful assistant.
```

### `knowledge.md`

Nội dung file này được chèn vào đầu mỗi input gửi sang AI dưới dạng knowledge base.

Nếu không cần knowledge base chung, để file rỗng hoặc giữ nội dung tối thiểu.

## Cài đặt

Yêu cầu:

- Node.js phiên bản có hỗ trợ `fetch`, `Blob`, `FormData`.
- npm.
- Canvas API token.
- API key của provider AI muốn dùng.

Cài dependencies:

```bash
npm install
```

Tạo `.env`:

```bash
copy .env.example .env
```

Điền ít nhất:

- `CANVAS_URL_1`
- `CANVAS_KEY_1`
- API key của provider sẽ dùng, ví dụ `CLAUDE_API_KEY`

## Chạy ứng dụng

Chạy development mode:

```bash
npm run dev
```

Build TypeScript:

```bash
npm run build
```

Chạy bản build:

```bash
npm start
```

Sau khi app chạy, API server sẽ listen trên `API_PORT` nhưng chưa bắt đầu polling cho đến khi gọi `GET /start`.

## API điều khiển polling

API server dùng để kiểm tra trạng thái và start/stop vòng poll Canvas trong lúc app đang chạy.

Base URL mặc định:

```text
http://localhost:3000
```

Nếu cấu hình `API_PORT` khác, thay `3000` bằng port tương ứng.

### `GET /`

Kiểm tra API server còn hoạt động và xem danh sách tài khoản Canvas đang được cấu hình. Phần tên email trước `@` chỉ hiện 2 ký tự đầu và 2 ký tự cuối, phần giữa được che bằng dấu `*`.

Ví dụ:

```bash
curl http://localhost:3000/
```

Response:

```json
{
  "status": "up",
  "polling": "running",
  "canvasAccounts": [
    {
      "index": 1,
      "email": "ng***en@gmail.com"
    }
  ]
}
```

Nếu tài khoản Canvas không cấu hình `CANVAS_EMAIL_n`, trường `email` sẽ là `null`.

### `GET /start`

Validate AI keys, chạy một lượt poll ngay lập tức, rồi tiếp tục poll định kỳ theo `POLL_INTERVAL_MS`.
Khi polling được bật thành công, app gửi email thông báo tới các `CANVAS_EMAIL_n` đã cấu hình.

Ví dụ:

```bash
curl http://localhost:3000/start
```

Response khi start thành công:

```json
{
  "status": "started",
  "validation": [
    {
      "provider": "claude",
      "ok": true
    }
  ]
}
```

Nếu polling đã chạy, API trả về:

```json
{
  "status": "already_running"
}
```

### `GET /stop`

Dừng vòng poll định kỳ. Job đang chạy dở sẽ tiếp tục hoàn tất.
Khi polling được tạm dừng thành công, app gửi email cảnh báo tới các `CANVAS_EMAIL_n` đã cấu hình rằng người dùng có thể sẽ không nhận được AI response cho file mới cho đến khi gọi `GET /start`.

Ví dụ:

```bash
curl http://localhost:3000/stop
```

Response khi stop thành công:

```json
{
  "status": "stopped"
}
```

Nếu polling đã dừng, API trả về:

```json
{
  "status": "already_stopped"
}
```

Lưu ý:

- API chỉ hỗ trợ method `GET`.
- Endpoint không hợp lệ trả về `404` với `{ "error": "Not found" }`.
- Method khác `GET` trả về `405` với `{ "error": "Method not allowed" }`.

## Kiểm tra nhanh

1. Tạo thư mục `Materials/Q` trên Canvas.
2. Upload một file hợp lệ, ví dụ `START_test_claude.txt`.
3. Chạy app bằng `npm run dev`.
4. Gọi `GET /start`, ví dụ `curl http://localhost:3000/start`.
5. Đợi một chu kỳ poll.
6. Kiểm tra thư mục `Materials/A`.
7. File `START_test_claude_DONE.docx` sẽ xuất hiện nếu xử lý thành công.

## Trạng thái xử lý

App lưu trạng thái vào:

```text
data/processed.json
```

Các trạng thái:

- `processing`: file đang được xử lý.
- `done`: file đã xử lý thành công.
- `failed`: file đã xử lý thất bại và đã tạo file lỗi.
- `pending`: trạng thái nội bộ khi reset file bị kẹt quá lâu.

`data/processed.json` được gitignore để tránh commit dữ liệu runtime.

## Xử lý lỗi

Nếu lỗi xảy ra sau tất cả retry, app sẽ:

1. Tạo file `.docx` chứa thông tin lỗi.
2. Upload file lỗi vào `Materials/A` với tên `_DONE.docx`.
3. Ghi trạng thái `failed` vào `data/processed.json`.
4. Gửi email lỗi nếu email notification được bật.

Nếu model trong tên file không hợp lệ, app cũng tạo file `.docx` báo model không được hỗ trợ và liệt kê danh sách model hợp lệ.

## Cấu trúc source chính

```text
src/index.ts                      Entry point
src/config.ts                     Đọc .env, system-prompt.md, knowledge.md
src/types.ts                      Type dùng chung
src/orchestrator/pollOrchestrator.ts  Luồng poll và xử lý file
src/canvas/canvasClient.ts        Gọi Canvas API
src/extractor/fileExtractor.ts    Trích xuất text/ảnh từ file
src/ai/aiRouter.ts                Chọn AI adapter
src/ai/claudeAdapter.ts           Adapter Claude
src/ai/geminiAdapter.ts           Adapter Gemini
src/ai/grokAdapter.ts             Adapter Grok
src/state/stateManager.ts         Lưu trạng thái runtime
src/utils/fileParser.ts           Parse tên file
src/utils/resultBuilder.ts        Tạo file kết quả/lỗi
src/utils/markdownToDocx.ts       Convert Markdown sang DOCX
src/utils/injectKnowledge.ts      Chèn knowledge base
src/utils/emailNotifier.ts        Gửi email Gmail
src/utils/logger.ts               Log terminal
src/utils/withTimeout.ts          Timeout promise gọi AI
```

## Lưu ý vận hành

- Không commit `.env`.
- Không commit `data/processed.json`.
- Canvas token cần có quyền đọc file, tải file và upload file vào personal files.
- App xử lý tuần tự từng file để đơn giản và giảm rủi ro rate limit.
- Nếu đổi tên file trên Canvas, app xem đó như file mới và xử lý lại.
- Nếu xoá `data/processed.json`, app vẫn tránh xử lý lại nếu file `_DONE.docx` còn tồn tại trong `Materials/A`.
- Nếu muốn chạy lâu dài trên server, nên dùng process manager như PM2, systemd hoặc Docker tùy môi trường deploy.

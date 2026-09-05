# Frontend

Giao diện Gradio. **Không nạp model nào** — chỉ gọi backend qua HTTP, nên image nhẹ và không cần GPU.

Phụ thuộc: `gradio`, `openai`, `requests`. Không có torch, không có transformers.

---

## Hai tab

### 📁 Quản lý tài liệu

Thêm PDF vào hàng đợi rồi index hàng loạt.

| Tuỳ chọn | Ý nghĩa |
|---|---|
| **Collection** | Các file cùng collection được tìm kiếm chung |
| **Tách đôi trang** | Bật khi sách scan 2 trang trên một tờ |
| **Giới hạn số trang** | Để trống là xử lý toàn bộ |

Hàng đợi hiển thị trạng thái từng file (⏳ chờ / ✅ xong / ❌ lỗi) và số mục đã index.

### 💬 Hỏi đáp

Nhập câu hỏi, nhận câu trả lời kèm các ảnh-mục làm căn cứ.

| Tuỳ chọn | Mặc định | Ý nghĩa |
|---|---|---|
| **Số mục lấy về** | 5 | Càng nhiều càng chậm, VLM phải đọc nhiều ảnh hơn |
| **Viết lại câu hỏi theo mục lục** | bật | Xem bên dưới |
| **System prompt** | trống | Để trống dùng prompt mặc định (tiếng Nhật, buộc trích dẫn trang) |

Cột phải theo dõi từng bước xử lý — hữu ích khi chẩn đoán truy vấn chậm hoặc trả lời sai.

---

## Viết lại câu hỏi theo mục lục

Bước này (`services/chat.py`) neo câu hỏi vào **mục lục thật của corpus** thay vì kiến thức chung của LLM:

```
Câu hỏi người dùng
   │
   ├─► lấy ảnh mục "noname" (bìa + mục lục của mọi cuốn)
   │
   ├─► VLM nhìn các ảnh đó, viết lại câu hỏi bằng thuật ngữ CÓ THẬT trong tài liệu
   │
   ├─► câu tìm kiếm = "câu gốc (câu viết lại)"     ← giữ cả hai
   │
   └─► truy xuất → VLM đọc ảnh-mục → trả lời
```

Giữ cả câu gốc vì câu viết lại có thể lệch ý; câu gốc neo lại ý định người dùng.

Nếu không lấy được mục lục hoặc VLM trả về sai định dạng, hệ thống **tự động dùng câu hỏi gốc** thay vì báo lỗi.

Tắt tuỳ chọn này khi tài liệu không có mục lục, hoặc khi muốn truy vấn nhanh hơn (bớt một lượt gọi VLM).

---

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8000` | Địa chỉ backend |
| `FRONTEND_PORT` | `7860` | Cổng Gradio |
| `FRONTEND_SEARCH_TIMEOUT` | `1000` | Giây. Một lượt search có thể rất lâu |
| `FRONTEND_UPLOAD_TIMEOUT` | `3600` | Giây. Index sách vài trăm trang rất lâu |
| `VLM_ENDPOINT` | — | Endpoint OpenAI-compatible của VLM |
| `VLM_MODEL_NAME` | — | Tên model VLM |
| `OPENAI_API_KEY` | `EMPTY` | Key cho VLM endpoint |

Frontend gọi VLM **trực tiếp**, không qua backend — backend chỉ lo truy xuất. Vì vậy frontend cần `VLM_ENDPOINT`.

---

## Chạy local

```bash
pip install -r requirements.txt

export BACKEND_URL=http://localhost:8000
export VLM_ENDPOINT=http://your-vllm:8000/v1
export VLM_MODEL_NAME=OpenGVLab/InternVL3-78B-AWQ
export OPENAI_API_KEY=EMPTY

python -m frontend.app.main
```

Chạy từ thư mục gốc repo (cha của `frontend/`).

---

## Cấu trúc

```
frontend/app/
├── main.py           # dựng Blocks, launch
├── config.py         # đọc env
├── api_client.py     # HTTP client gọi backend
├── rag.py            # gọi VLM đọc ảnh
├── prompts.py        # prompt RAG + prompt viết lại câu hỏi
├── services/
│   ├── chat.py       # luồng hỏi–đáp
│   └── files.py      # hàng đợi file
└── ui/
    ├── chat.py             # tab hỏi đáp
    ├── file_management.py  # tab quản lý tài liệu
    └── agent_panel.py      # bảng theo dõi xử lý
```

---

## Test

```bash
pytest frontend/tests/ -v
```

Mock backend và VLM — không cần service nào chạy thật.

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Banner "🔴 không kết nối được" | Backend chưa chạy, hoặc `BACKEND_URL` sai |
| Ảnh không hiện trong gallery | Frontend không mount chung volume `/data` với backend |
| Truy vấn treo rất lâu | Bình thường với `top_k` lớn. Tắt viết lại câu hỏi để bớt một lượt VLM |
| "Không tìm thấy tài liệu phù hợp" | Collection chưa index, hoặc gõ sai tên collection |

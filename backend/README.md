# Backend

Hai service dùng chung một codebase:

| Service | Entrypoint | Cổng | Nạp model |
|---|---|---|---|
| **API** | `backend.app.main:app` | 8000 (host 2005) | ColQwen (embed + truy vấn) |
| **Worker** | `backend.worker.main:app` | 8001 (host 2222) | PaddleOCR + PP-DocLayout |

Tách tiến trình vì hai bộ model không vừa chung một GPU. Chúng trao đổi qua HTTP và dùng chung volume `METADATA_DIR`.

---

## API Reference

Tất cả endpoint đều ở root, không có prefix. Swagger UI: `http://localhost:2005/docs`.

### `GET /health`

```bash
curl http://localhost:2005/health
```
```json
{"status": "healthy", "service": "cosmo-chatpdf-backend", "version": "1.0.0"}
```

---

### `POST /search_with_images`

Tìm kiếm ngữ nghĩa, trả về ảnh-mục kèm base64.

```bash
curl -X POST http://localhost:2005/search_with_images \
  -H "Content-Type: application/json" \
  -d '{"query": "軸方向圧縮力を受ける部材", "user_id": "demo", "top_k": 5}'
```
```json
{
  "user_id": "demo",
  "query": "軸方向圧縮力を受ける部材",
  "top_k": 5,
  "results": [
    {
      "section_title": "5.4.4 軸方向圧縮力を受ける部材",
      "ancestors": ["5章", "5.4"],
      "section_pages": ["-92-", "-93-"],
      "formulas": [{"content": "...", "coordinate": [120, 340, 480, 400], "page": "-93-"}],
      "image_path": "/data/metadata/demo/0/section_images/section_12_....png",
      "image_base64": "data:image/png;base64,...",
      "chunk_images": ["data:image/png;base64,..."],
      "metadata": {"file_name": "quyen1.pdf", "db_name": "demo"}
    }
  ],
  "total_results": 1
}
```

| Trường | Ý nghĩa |
|---|---|
| `section_pages` | **Số trang in trên giấy** (`-93-`), không phải index — để trích dẫn khớp sách thật |
| `ancestors` | Chuỗi mục cha, giữ ngữ cảnh phân cấp |
| `formulas` | Công thức trong mục, toạ độ đã map sang ảnh ghép |
| `chunk_images` | Ảnh từng trang gốc, để đối chiếu với ảnh ghép |

---

### `POST /search`

Như trên nhưng không trả dữ liệu ảnh — nhanh hơn nhiều.

```bash
curl -X POST http://localhost:2005/search \
  -H "Content-Type: application/json" \
  -d '{"query": "限界状態", "user_id": "demo", "top_k": 3}'
```

---

### `POST /search_by_section_title`

Lọc theo tên mục. Dùng chính với `noname` — mục chứa bìa và mục lục.

```bash
curl -X POST http://localhost:2005/search_by_section_title \
  -H "Content-Type: application/json" \
  -d '{"section_title": "noname", "user_id": "demo", "limit": 20}'
```

Chỉ hỗ trợ backend Qdrant; Milvus trả `501`.

---

### `POST /upload_files`

Upload và index nhiều PDF vào cùng collection. Mỗi file thành một "cuốn".

```bash
curl -X POST http://localhost:2005/upload_files \
  -F "files=@quyen1.pdf" \
  -F "files=@quyen2.pdf" \
  -F "user_id=demo" \
  -F "db_name=demo" \
  -F 'metadata=[{"display_name":"Quyển 1","vertical_split":true,"max_pages":300},{"display_name":"Quyển 2","vertical_split":false}]'
```

| Trường metadata | Ý nghĩa |
|---|---|
| `display_name` | Tên hiển thị |
| `vertical_split` | `true` khi sách scan 2 trang trên một tờ |
| `max_pages` | Giới hạn số trang, bỏ trống là toàn bộ |

Số phần tử `metadata` phải khớp số file. Sau khi xong, mục lục tổng của collection được sinh lại tự động.

---

### `POST /index`

Index một PDF đã có sẵn trên đĩa server.

```bash
curl -X POST http://localhost:2005/index \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "/data/pdf/quyen1.pdf", "user_id": "demo", "media_dir": "demo/0", "max_pages": 300}'
```

---

### `GET /table_of_contents`

```bash
curl "http://localhost:2005/table_of_contents?collection_name=demo"
```

Trả mục lục tổng hợp của mọi cuốn trong collection. Dùng để nạp vào prompt cho agent biết knowledge base có gì.

`POST /table_of_contents/regenerate` sinh lại khi metadata trên đĩa đã đổi mà chưa index lại.

---

### `GET /list_collections/{user_id}`

```bash
curl http://localhost:2005/list_collections/demo
```

---

### Endpoint tương thích ngược

`POST /search_default` và `POST /search_default_base64` — bản cũ hardcode collection `default`. Vẫn hoạt động nhưng đánh dấu deprecated; code mới nên dùng `/search` với `user_id` tường minh.

---

## Worker API

### `POST /upload_pdf/`

```bash
curl -X POST http://localhost:2222/upload_pdf/ \
  -H "Content-Type: application/json" \
  -d '{"id": "demo/0", "pdf_path": "/data/pdf/quyen1.pdf", "custom_config": {"max_pages": 300, "vertical_split": true}}'
```

Trả `{"message": "...", "metadatas": [...]}` — mỗi phần tử là một ảnh-mục. Backend gọi endpoint này, người dùng thường không gọi trực tiếp.

---

## Pipeline xử lý PDF

`document/` giữ nguyên thuật toán từ bản gốc:

| Bước | Module | Việc |
|---|---|---|
| 1 | `pdf_manager.py` | PDF → ảnh: **DPI động** (chuẩn hoá pixel giữa các khổ sách), tách đôi trang |
| 1b | `padding_remover.py` | Cắt lề bằng text detection — bỏ lề trắng là bỏ visual token vô nghĩa |
| 2 | `element_detector.py` | PP-DocLayout: tiêu đề / công thức / số trang |
| 3 | `section_analyzer.py` | Suy biên mục `(page, y)`: một mục = từ tiêu đề này đến trước tiêu đề kế |
| 4 | `section_analyzer.py` | Gán công thức vào mục tương ứng |
| 5 | `summary_reporter.py` | OCR một lần, **ghi ra JSON** để bước 7 không phải chạy lại model |
| 6 | `llm_report_valid.py` | LLM lọc tiêu đề giả, dựng cây cha-con, **gộp ngược** mục bị loại |
| 7 | `section_merger.py` | Ghép ảnh-mục, cắt số trang, **transform toạ độ công thức** sang ảnh ghép |

Bước 6 quan trọng: layout model biết "đây là tiêu đề" nhưng không biết `5.4.2` là con của `5.4`. Mục bị LLM loại được gộp vào mục liền trước nên lỗi detect không sinh chunk rác.

---

## Truy xuất 2 tầng

Multi-vector ColBERT rất đắt: mỗi ảnh-mục ~8203 vector 128 chiều (~4,2 MB). Cách xử lý trong `vectordb/qdrant_manager.py`:

| Named vector | Nội dung | HNSW |
|---|---|---|
| `original` | Multi-vector đầy đủ | `m=0` — **không index**, chỉ rerank |
| `mean_r` | Pooled theo hàng patch | `m=16` — có index |
| `mean_c` | Pooled theo cột patch | `m=16` — có index |

Search = prefetch `mean_r` + `mean_c` lấy `topk×10` ứng viên → rerank bằng `original`. Lọc thô bằng vector nhẹ, chấm điểm chính xác trên tập nhỏ.

---

## Chạy local (không Docker)

```bash
# Worker
pip install -r requirements-worker.txt
sudo apt install poppler-utils          # bắt buộc cho pdf2image
export METADATA_DIR=$PWD/../data/metadata GEMINI_API_KEY=...
uvicorn backend.worker.main:app --port 8001

# API (terminal khác)
pip install torch --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
export METADATA_DIR=$PWD/../data/metadata OPENAI_API_KEY=EMPTY GEMINI_API_KEY=...
export VECTORDB_URI=http://localhost:6333 PDF_WORKER_ENDPOINT=http://localhost:2222/upload_pdf/
uvicorn backend.app.main:app --port 8000
```

Chạy từ thư mục gốc repo (cha của `backend/`) để package resolve đúng.

---

## Test

```bash
pytest backend/tests/ -v
```

Test chạy được **không cần GPU** — `conftest.py` mock torch, paddleocr, qdrant_client. Chúng kiểm tra config, sinh mục lục, và hợp đồng API (path + shape response), không kiểm tra chất lượng truy xuất.

---

## Ghi chú vận hành

- **Model cache**: lần chạy đầu tải ColQwen ~6GB về `HF_HOME`. Trong Docker đã trỏ vào volume `/data/.cache/huggingface` nên không tải lại sau khi restart.
- **`LOG_LEVEL=DEBUG`** in chi tiết từng bước pipeline. Với sách 300 trang log sẽ rất dài — chỉ bật khi cần chẩn đoán.
- **Timeout**: một lượt search gồm embed query + rerank + VLM đọc ảnh, có thể tới vài phút. Client nên đặt timeout rộng.

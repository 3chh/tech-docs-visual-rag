# Trạng thái kiểm chứng

Tài liệu này nói rõ **cái gì đã được kiểm chứng thật** và **cái gì bạn phải tự chạy**. Đọc trước khi đưa lên môi trường thật.

Môi trường tái cấu trúc: Windows, Python 3.13, **không GPU**, **không model weights**, **không Qdrant**, Docker daemon không chạy.

---

## ✅ Đã kiểm chứng

| Hạng mục | Cách kiểm | Kết quả |
|---|---|---|
| Cú pháp toàn bộ code | `python -m compileall backend frontend` | Pass |
| Import graph | Phân tích AST 98 relative import | Tất cả resolve được |
| Config loader | `pytest backend/tests/test_config.py` | 9/9 pass |
| Fail-fast khi thiếu secret | Test riêng cho `GEMINI_API_KEY`, `OPENAI_API_KEY` | Pass |
| `config.yaml` không chứa secret | Test quét file | Pass |
| Sinh mục lục | `pytest backend/tests/test_toc.py` | 9/9 pass |
| FastAPI app khởi động | `TestClient(app)`, gọi `GET /health` | 200 OK |
| **OpenAPI schema sinh được** | `app.openapi()` | Pass — bản gốc lỗi ở đây |
| Đủ 11 endpoint | Test tham số hoá theo path + method | Pass |
| Shape `SearchResult`/`SearchResponse` | Test kiểm từng field | Pass |
| Client HTTP frontend | `pytest frontend/tests/` | 8/8 pass |
| Luồng viết lại câu hỏi | Mock backend + VLM | 7/7 pass |
| Frontend không kéo torch | Quét import | Sạch |
| `docker compose config` | Cả bản CPU và GPU | Pass |

**Tổng: 50/50 test pass.**

```bash
pytest              # chạy lại toàn bộ
```

---

## ❌ Chưa kiểm chứng — bạn phải tự chạy

Những phần dưới đây **không thể** kiểm trong môi trường không GPU. Chạy theo đúng thứ tự.

### 1. Build Docker image

Docker daemon không chạy được lúc tái cấu trúc nên **chưa có image nào được build thật**.

```bash
docker compose build
```

Rủi ro cao nhất: `paddlepaddle-gpu==3.0.0` lấy từ index riêng của Paddle, hay gãy. Nếu lỗi, thử:
- Bỏ ghim version trong `backend/requirements-worker.txt`
- Hoặc đổi sang `paddlepaddle` (bản CPU) nếu worker chạy CPU

### 2. Khởi động stack

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
docker compose ps          # cả 4 service phải healthy
docker compose logs -f backend
```

Backend cần vài phút lần đầu để tải ColQwen (~6GB).

```bash
curl http://localhost:8000/health
curl http://localhost:8001/health
```

### 3. Index một PDF ngắn

**Bắt đầu bằng file 5–10 trang**, không phải sách 300 trang.

```bash
curl -X POST http://localhost:8000/upload_files \
  -F "files=@test-10-trang.pdf" \
  -F "user_id=test" -F "db_name=test" \
  -F 'metadata=[{"display_name":"Test","vertical_split":false,"max_pages":10}]'
```

Cần xác nhận:
- [ ] Worker chạy hết 7 bước không lỗi
- [ ] `LOG_LEVEL=DEBUG` cho thấy LLM sửa mục lục trả JSON hợp lệ
- [ ] Ảnh-mục xuất hiện trong `METADATA_DIR/test/0/section_images/`
- [ ] **Mở vài ảnh-mục xem mắt thường** — chữ có đọc được không, ghép có đúng thứ tự không
- [ ] Số mục hợp lý so với mục lục thật của tài liệu

### 4. Truy vấn

```bash
curl -X POST http://localhost:8000/search_with_images \
  -H "Content-Type: application/json" \
  -d '{"query": "câu hỏi về nội dung tài liệu", "user_id": "test", "top_k": 3}'
```

Cần xác nhận:
- [ ] Trả về đúng mục liên quan
- [ ] `section_pages` khớp số trang in trên sách
- [ ] `image_base64` mở ra được

### 5. Luồng đầy đủ trên UI

http://localhost:7860 → tab Hỏi đáp:
- [ ] Ảnh hiện trong gallery (nếu không, kiểm tra volume `/data` có mount chung không)
- [ ] Câu trả lời trích dẫn đúng số trang
- [ ] Bảng theo dõi hiển thị đủ các bước
- [ ] Tắt "viết lại câu hỏi theo mục lục" vẫn chạy

### 6. Đối chiếu với bản gốc

Nếu bạn còn Qdrant chứa dữ liệu do `chatpdf_ver_2` index:

```bash
# Cùng một query, so kết quả giữa bản cũ và bản mới
curl -X POST http://<backend-cũ>:2005/search_with_images -d '{...}'
curl -X POST http://localhost:8000/search_with_images -d '{...}'
```

Kết quả phải **giống nhau** — thuật toán truy xuất không đổi.

---

## Thay đổi hành vi có chủ ý

Những chỗ dưới đây **khác bản gốc**, đều là sửa lỗi:

| Chỗ | Bản gốc | Bản mới | Lý do |
|---|---|---|---|
| Lỗi khi xử lý PDF | In traceback rồi `return` bình thường | Ném exception, trả HTTP 500 | Bản gốc báo lỗi index thành công |
| `/search` | Dựng `SearchResult(doc_id=, score=)` — field không tồn tại | Dùng đúng model | Bản gốc trả 500 |
| `/search_by_section_title` | `logger.info(..., collection_name=)` | Bỏ kwarg sai | Bản gốc TypeError ngay dòng đầu |
| `import pdf_manager` | Crash (`DetectedElements`, `PaddingRemover` không tồn tại) | Import được | Sai tên class |
| Vòng lặp cuối `validate_report` | `remove` trong khi `enumerate` | Duyệt trên bản sao | Bỏ sót phần tử |
| `MilvusManager` | Thiếu `get_list_collection_name` | Đã bổ sung | `/list_collections` sẽ AttributeError với Milvus |
| Nơi ghi metadata | `os.getcwd()/metadata` | `METADATA_DIR` | Để worker và backend chia sẻ volume |
| Gemini validator | Nhánh `genai` SDK không bao giờ chạy (đọc sai khoá config) | Chỉ dùng OpenAI client | Gemini có endpoint OpenAI-compatible; nhánh kia là code chết |

Mục cuối đáng lưu ý: bản gốc đọc `config.get("provider")` nhưng YAML ghi `type:`, nên **luôn** rơi vào nhánh OpenAI. Vì endpoint Gemini trong config là bản OpenAI-compatible nên nó vẫn chạy đúng. Bản mới giữ nguyên hành vi thực tế đó và bỏ nhánh chết.

---

## Rủi ro còn lại

| Rủi ro | Mức | Cách phát hiện sớm |
|---|---|---|
| `paddlepaddle-gpu` không cài được | 🔴 | `docker compose build worker` |
| Thuật toán bị đổi ngoài ý muốn khi port | 🟠 | So kết quả với bản gốc (mục 6) |
| Volume `/data` không chia sẻ đúng | 🟠 | Ảnh không hiện trong UI |
| VRAM không đủ khi index và truy vấn đồng thời | 🟠 | Giảm `EMBEDDING_MAX_NUM_VISUAL_TOKENS` xuống 4096 |
| Model cache tải lại mỗi lần restart | 🟡 | Kiểm tra volume `/data/.cache/huggingface` |

---

## So sánh phạm vi test

Test hiện có kiểm **hợp đồng và cấu hình**, không kiểm **chất lượng**:

| Kiểm được | Không kiểm được |
|---|---|
| API path và shape response | Truy xuất có đúng mục không |
| Config load và fail-fast | Ảnh-mục ghép có đọc được không |
| Sinh mục lục từ metadata | LLM sửa cây mục lục có chuẩn không |
| Luồng viết lại câu hỏi (mock) | VLM trả lời có chính xác không |
| Xử lý lỗi HTTP | Hiệu năng, VRAM thực tế |

Muốn kiểm chất lượng thì cần bộ câu hỏi có nhãn vàng — nằm ngoài phạm vi lần tái cấu trúc này.

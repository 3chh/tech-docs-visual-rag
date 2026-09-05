# Đối chiếu với `chatpdf_ver_2`

Bản đồ từ repo cũ sang repo mới, và những gì đã đổi.

---

## Ánh xạ file

| Bản cũ | Bản mới | Ghi chú |
|---|---|---|
| `middleware/app.py` (555 dòng) | `backend/app/api/routes/*.py` + `schemas/` | Tách theo nhóm chức năng |
| `middleware/middleware.py` | `backend/app/services/indexing.py` + `retrieval.py` | Tách index và truy xuất |
| `middleware/generate_tableofcontent.py` | `backend/app/services/toc.py` | Gộp với `tableofcontent_utils.py` |
| `pdf_manager/` | `backend/document/` | Sửa import, giữ nguyên thuật toán |
| `pdf_manager/app.py` | `backend/worker/main.py` + `routes.py` | |
| `embedding_manager/` | `backend/embeddings/` | `embedding_manager.py` → `base.py` |
| `database/` | `backend/vectordb/` | Thêm `base.py` khai interface |
| `long_colqwen/` | `backend/document/models/long_colqwen/` | Không sửa |
| `prompts/` | `backend/prompts/` + `frontend/app/prompts.py` | ToC prompt ở backend, RAG prompt ở frontend |
| `new_app.py` (1012 dòng) | `frontend/app/` | Tách thành ui/ + services/ |
| `app.py` | — | **Bỏ**: gần trùng `new_app.py`, gọi middleware in-process nên frontend phải có GPU |
| `config.yaml` | `backend/config/config.yaml` | **Đã gỡ API key** |
| `database/docker-compose.yml` | `docker-compose.yml` | Viết lại cho cả stack |
| `test_*.py`, `*.ipynb` | — | Script thử nghiệm rời rạc, không mang sang |
| `milvus_c21f969b.db`, `*.pdf`, `*.png` | — | File nhị phân, đã cho vào `.gitignore` |

---

## Bug đã sửa

| ID | Bug | Ở đâu | Hệ quả |
|---|---|---|---|
| B1 | `__init__.py` import `DetectedElements`, `PaddingRemover` (không tồn tại), `import app` (vòng) | `pdf_manager/__init__.py` | `import pdf_manager` **crash** — đây là lý do bản gốc buộc phải tách service HTTP |
| B2 | Flat import (`from section_analyzer import ...`) | `pdf_manager/*.py` | Chỉ chạy khi `cwd=pdf_manager/` |
| B3 | Thiếu `LongColQwenManager` trong `__init__` | `embedding_manager/__init__.py` | Chỉ chạy nhờ `importlib` động |
| B4 | `/search` dựng `SearchResult(doc_id=, score=)` | `middleware/app.py` | HTTP 500 |
| B5 | `logger.info(..., collection_name=)` | `middleware/app.py:80` | TypeError |
| B6 | Gemini API key hardcode, đã commit | `config.yaml:52` | Lộ secret |
| B7 | `process()` nuốt exception rồi return | `pdf_manager/pdf_manager.py` | Lỗi index báo thành công |
| B8 | `max_pages` không truyền qua `custom_config` | `pdf_manager/app.py` | Bỏ qua giới hạn trang |
| B9 | `remove` trong khi `enumerate` | `llm_report_valid.py` | Bỏ sót phần tử khi gộp mục |
| B10 | `MilvusManager` thiếu `get_list_collection_name` | `database/milvus_manager.py` | `/list_collections` AttributeError với Milvus |

> **B6 — việc cần làm ngay:** Gemini API key hardcode trong `chatpdf_ver_2/config.yaml` đã nằm trong lịch sử git. Repo mới không còn key nào, nhưng **key cũ vẫn cần thu hồi** ở Google Cloud Console — xoá khỏi file hiện tại không xoá được khỏi lịch sử.

---

## Chức năng giữ nguyên

| ID | Chức năng | Ở đâu trong bản mới |
|---|---|---|
| F1 | Upload nhiều PDF + index | `POST /upload_files` |
| F2 | Index 1 PDF | `POST /index` |
| F3 | Semantic search + ảnh base64 | `POST /search_with_images` |
| F4 | Search theo section title | `POST /search_by_section_title` |
| F5 | Table of contents | `GET /table_of_contents` |
| F6 | List collections | `GET /list_collections/{user_id}` |
| F7 | Health check | `GET /health` |
| F8 | Pipeline xử lý PDF 7 bước | `backend/document/` |
| F9 | Sinh `tableofcontent_*.json` | `services/toc.py`, tự chạy sau upload |
| F10 | UI quản lý file | `frontend/app/ui/file_management.py` |
| F11 | UI hỏi đáp + bảng theo dõi | `frontend/app/ui/chat.py` + `agent_panel.py` |
| F12 | Viết lại câu hỏi theo mục lục | `frontend/app/services/chat.py` |
| F13 | Đa backend vector DB | `backend/vectordb/__init__.py` |
| F14 | Đa backend embedding | `backend/embeddings/__init__.py` |

Hai endpoint cũ `/search_default` và `/search_default_base64` được giữ dưới dạng alias deprecated.

---

## Thuật toán không đổi

Những phần này **không được sửa** vì là phần giá trị cốt lõi:

- `smart_resize_long` — ghim chiều rộng, thả chiều cao để ảnh-mục cao vẫn đọc được chữ
- Dynamic token batching — sort theo token, gộp batch theo ngân sách
- Truy xuất 2 tầng Qdrant — tham số HNSW, `topk*10` prefetch
- Biên mục `(page, y)` từ vị trí tiêu đề
- Ghép ảnh-mục + transform toạ độ công thức
- Cơ chế gộp ngược mục bị LLM loại
- Bộ lọc công thức theo tỉ lệ hình học

Thay đổi trong các file này chỉ gồm: import, `print` → `logger`, và xử lý exception.

---

## Khác biệt vận hành

| | Bản cũ | Bản mới |
|---|---|---|
| Cổng | 2005 / 2222 | **giữ nguyên 2005 / 2222** |
| VLM | Host thủ công bên ngoài | vLLM trong stack, cổng **3333** |
| Nơi ghi metadata | `cwd/metadata` | `METADATA_DIR` (env) |
| Secret | Trong `config.yaml` | Chỉ từ env, fail-fast khi thiếu |
| Log | `print` | `logging` có level |
| Vector DB client | Tạo mới mỗi request | Cache theo collection |
| Chạy | Thủ công 3 tiến trình + vLLM riêng | `make up-gpu` |

Cổng đã map khớp bản cũ nên **client hiện có không phải đổi số cổng**.

---

## `agent_tung` cần đổi gì

Chỉ **một dòng** — địa chỉ host:

```yaml
chunk_search_tool:
  url: http://localhost:2005/             # ← đổi dòng này
  endpoint_semantic: search_with_images    # giữ nguyên
  endpoint_title: search_by_section_title  # giữ nguyên
  get_ToC: table_of_contents               # giữ nguyên
  timeout: 1000                            # giữ nguyên
```

Ba endpoint giữ nguyên tên **và shape response** nên `get_title.py`, `agent_manager.py` không phải sửa.

`custom_llm` thì khớp sẵn, không cần đổi gì:

```yaml
custom_llm:
  base_url: "http://localhost:3333/v1"     # ← vLLM trong stack đã ở cổng này
  model_name: "hostedvllm/OpenGVLab/InternVL3-8B"
```

Chỉ cần `VLM_MODEL_NAME` trong `.env` khớp phần sau tiền tố `hostedvllm/`. Mặc định đã đúng.

Nếu `agent_tung` chạy trong container cùng network thì dùng tên service thay vì `localhost`:

```yaml
chunk_search_tool:
  url: http://backend:8000/
custom_llm:
  base_url: "http://vllm:8000/v1"
```

Hai service `page_search_tool` (:3000) và `mcp_server` (:9000) không thuộc stack này — vẫn tự quản lý như cũ.

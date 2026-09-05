# Cosmo ChatPDF

Hỏi–đáp trên tài liệu PDF scan bằng **Visual RAG cấp mục**.

Hệ thống **không trích xuất text từ PDF**. Mỗi trang được coi là ảnh, embed trực tiếp bằng ColQwen (vision-language retriever), và một VLM đọc thẳng ảnh tài liệu để trả lời. Điểm khác biệt so với Visual RAG thông thường: đơn vị truy xuất không phải **trang** mà là **mục theo mục lục thật** của tài liệu — mỗi mục là một ảnh dài ghép từ nhiều trang.

Phù hợp với tài liệu kỹ thuật dày, phân cấp sâu, nhiều công thức và bảng, chỉ tồn tại dưới dạng scan (tiêu chuẩn kỹ thuật, quy chuẩn, sổ tay tra cứu).

---

## Kiến trúc

```
                                  ┌──────────────┐
                                  │   Frontend   │  Gradio, cổng 7860
                                  │  (không GPU) │  gọi backend qua HTTP
                                  └──────┬───────┘
                                         │ HTTP
                                  ┌──────▼───────┐
                    ┌─────────────┤   Backend    │  FastAPI, cổng 8000
                    │             │  ColQwen GPU │  embed + truy xuất
                    │             └──────┬───────┘
              HTTP  │                    │
                    │                    │ gRPC
             ┌──────▼───────┐     ┌──────▼───────┐
             │  PDF Worker  │     │    Qdrant    │  cổng 6333/6334
             │ PaddleOCR GPU│     │ multi-vector │
             │  cổng 8001   │     └──────────────┘
             └──────┬───────┘
                    │ ghi ảnh-mục
             ┌──────▼───────┐
             │  volume /data│  dùng chung giữa worker và backend
             └──────────────┘
```

Ba service tách riêng vì **profile tài nguyên khác nhau**: worker giữ PaddleOCR + layout model, backend giữ ColQwen, frontend không nạp model nào. Gộp chung một tiến trình sẽ hết VRAM.

### Luồng xử lý

**Index** — PDF → ảnh (DPI động, tách đôi trang, cắt lề) → layout detection → suy biên mục từ vị trí tiêu đề → OCR một lần lưu ra JSON → **LLM sửa cây mục lục** → ghép ảnh-mục + transform toạ độ công thức → embed ColQwen → Qdrant.

**Truy vấn** — câu hỏi → **viết lại theo mục lục thật của corpus** → embed → truy xuất 2 tầng (prefetch bằng vector pooled có index, rerank bằng multi-vector đầy đủ) → VLM đọc ảnh-mục → trả lời kèm trích dẫn số trang.

---

## Bắt đầu nhanh

```bash
git clone <repo> && cd cosmo-chatpdf

cp .env.example .env
# Điền tối thiểu: GEMINI_API_KEY, VLM_ENDPOINT, VLM_MODEL_NAME

docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

Mở http://localhost:7860.

Không có GPU thì `docker compose up -d` vẫn chạy, nhưng embed và OCR sẽ rất chậm — chỉ dùng để kiểm tra giao diện.

```bash
make help     # xem các lệnh có sẵn
make up-gpu   # chạy với GPU
make logs     # theo dõi log
make down     # dừng
```

---

## Cấu hình

Mọi giá trị trong `backend/config/config.yaml` đều override được bằng biến môi trường. **Secret chỉ đọc từ env, không bao giờ để trong YAML.**

### Biến bắt buộc

| Biến | Ý nghĩa |
|---|---|
| `GEMINI_API_KEY` | LLM sửa cây mục lục (bước 6 của pipeline index) |
| `VLM_ENDPOINT` | Endpoint OpenAI-compatible của VLM đọc ảnh |
| `VLM_MODEL_NAME` | Tên model VLM |
| `OPENAI_API_KEY` | Key cho VLM endpoint (`EMPTY` nếu là vLLM tự host) |

Thiếu secret bắt buộc thì service **báo lỗi ngay lúc khởi động**, không phải lúc gọi API.

### Biến hay dùng

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `EMBEDDING_TYPE` | `longcolqwen` | `longcolqwen` \| `colqwen` \| `colpali` \| `colidefics` |
| `EMBEDDING_MAX_NUM_VISUAL_TOKENS` | `8192` | Giảm xuống 4096 nếu thiếu VRAM |
| `EMBEDDING_MIN_WIDTH` | `600` | Chiều rộng tối thiểu khi resize ảnh-mục |
| `VECTORDB_TYPE` | `qdrant-standalone` | `qdrant-standalone` \| `milvus-lite` \| `milvus-standalone` |
| `METADATA_DIR` | `./data/metadata` | Nơi lưu ảnh-mục; worker và backend phải trỏ chung |
| `LOG_LEVEL` | `INFO` | `DEBUG` để xem chi tiết từng bước pipeline |

Danh sách đầy đủ: [.env.example](.env.example).

---

## Yêu cầu phần cứng

| Thành phần | VRAM | Ghi chú |
|---|---|---|
| Backend (ColQwen 3B) | ~8–10 GB | Với `max_num_visual_tokens=8192` |
| Worker (PaddleOCR + layout) | ~4–6 GB | Chạy theo đợt khi index |
| VLM sinh câu trả lời | tuỳ model | Thường host riêng bằng vLLM |
| Frontend | 0 | Không nạp model |

Backend và worker có thể chung một GPU 24GB nếu không index và truy vấn đồng thời.

---

## Tài liệu từng phần

- [backend/README.md](backend/README.md) — API reference, chạy local, cấu trúc pipeline
- [frontend/README.md](frontend/README.md) — giao diện, cấu hình, chạy local
- [docs/VERIFICATION.md](docs/VERIFICATION.md) — **đã kiểm chứng gì, còn gì phải tự chạy**
- [docs/MIGRATION.md](docs/MIGRATION.md) — đối chiếu với bản `chatpdf_ver_2` cũ

---

## Cấu trúc thư mục

```
cosmo-chatpdf/
├── backend/
│   ├── app/              # API service (cổng 8000)
│   │   ├── api/routes/   # search, indexing, toc, health
│   │   ├── schemas/      # pydantic request/response
│   │   └── services/     # indexing, retrieval, toc, images
│   ├── worker/           # PDF worker (cổng 8001)
│   ├── core/             # config, logging, paths
│   ├── embeddings/       # ColQwen/ColPali manager
│   ├── vectordb/         # Qdrant/Milvus manager
│   ├── document/         # pipeline xử lý PDF
│   ├── prompts/
│   └── tests/
├── frontend/
│   └── app/
│       ├── ui/           # tab quản lý file, tab hỏi–đáp
│       └── services/     # chat, files
├── docker-compose.yml
└── docker-compose.gpu.yml
```

---

## Phát triển

```bash
# Backend
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
uvicorn backend.app.main:app --reload --port 8000

# Worker (tiến trình riêng)
pip install -r backend/requirements-worker.txt
uvicorn backend.worker.main:app --reload --port 8001

# Frontend
pip install -r frontend/requirements.txt
python -m frontend.app.main

# Test — chạy được không cần GPU
pytest
```

---

## Giấy phép

Nội bộ.

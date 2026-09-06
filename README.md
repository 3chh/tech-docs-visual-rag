# Cosmo ChatPDF

Hỏi–đáp trên tài liệu PDF scan bằng **Visual RAG cấp mục**.

Hệ thống **không trích xuất text từ PDF**. Mỗi trang được coi là ảnh, embed trực tiếp bằng ColQwen (vision-language retriever), và một VLM đọc thẳng ảnh tài liệu để trả lời. Điểm khác biệt so với Visual RAG thông thường: đơn vị truy xuất không phải **trang** mà là **mục theo mục lục thật** của tài liệu — mỗi mục là một ảnh dài ghép từ nhiều trang.

Phù hợp với tài liệu kỹ thuật dày, phân cấp sâu, nhiều công thức và bảng, chỉ tồn tại dưới dạng scan (tiêu chuẩn kỹ thuật, quy chuẩn, sổ tay tra cứu).

---

## Kiến trúc

```
                    ┌──────────────┐         ┌──────────────┐
                    │   Frontend   │ ──────► │     vLLM     │  :3333
                    │  Gradio 7860 │  HTTP   │  VLM đọc ảnh │  Docker image
                    │  (không GPU) │         │     GPU      │  vllm/vllm-openai
                    └──────┬───────┘         └──────▲───────┘
                           │ HTTP                   │
                    ┌──────▼───────┐                │
       ┌────────────┤   Backend    ├────────────────┘
       │            │  FastAPI 2005│
       │            │  ColQwen GPU │
       │ HTTP       └──────┬───────┘
       │                   │ gRPC
┌──────▼───────┐    ┌──────▼───────┐
│  PDF Worker  │    │    Qdrant    │  :6333 / :6334
│ PaddleOCR GPU│    │ multi-vector │
│    :2222     │    └──────────────┘
└──────┬───────┘
       │ ghi ảnh-mục
┌──────▼───────────────┐
│ volume /data (chung) │  worker ghi, backend và frontend đọc
└──────────────────────┘
```

Các service tách riêng vì **profile tài nguyên khác nhau**: worker giữ PaddleOCR + layout model, backend giữ ColQwen, vLLM giữ VLM, frontend không nạp model nào. Gộp chung một tiến trình sẽ hết VRAM.

### Cổng

Map khớp bản `chatpdf_ver_2` cũ nên **`agent_tung` và client hiện có không phải sửa gì**:

| Service | Cổng | Ai gọi |
|---|---|---|
| vLLM | **3333** | `agent_tung` → `custom_llm.base_url` |
| Backend | **2005** | `agent_tung` → `chunk_search_tool.url` |
| Worker | **2222** | Backend gọi nội bộ |
| Qdrant | 6333 / 6334 | Backend gọi nội bộ |
| Frontend | 7860 | Trình duyệt |

Đổi cổng bằng biến trong `.env` (`BACKEND_PORT`, `VLLM_PORT`…).

### Luồng xử lý

**Index** — PDF → ảnh (DPI động, tách đôi trang, cắt lề) → layout detection → suy biên mục từ vị trí tiêu đề → OCR một lần lưu ra JSON → **LLM sửa cây mục lục** → ghép ảnh-mục + transform toạ độ công thức → embed ColQwen → Qdrant.

**Truy vấn** — câu hỏi → **viết lại theo mục lục thật của corpus** → embed → truy xuất 2 tầng (prefetch bằng vector pooled có index, rerank bằng multi-vector đầy đủ) → VLM đọc ảnh-mục → trả lời kèm trích dẫn số trang.

---

## Chỉ xem giao diện (không cần GPU, không cần model)

Muốn kiểm tra build hoặc phát triển frontend:

```bash
cd cosmo-chatpdf
make deploy-demo
```

Lên trong khoảng một phút — frontend + Qdrant + một backend trả dữ liệu mẫu, không nạp model nào, không cần API key. Mở http://localhost:7860.

Đây là kiểu duy nhất không cần NVIDIA Container Toolkit.

---

## Bắt đầu nhanh (chạy thật)

Chỉ cần Docker + NVIDIA Container Toolkit. **Không cài gì trên máy** — vLLM, ColQwen, PaddleOCR đều chạy trong container và tự tải model.

```bash
git clone <repo> && cd cosmo-chatpdf

cp .env.example .env
# Điền CREDENTIALS_SECRET — đó là biến bắt buộc duy nhất
#   openssl rand -base64 32

make deploy-full   # một lệnh, cả stack lên
```

API key của mô hình **không** nằm trong `.env`. Người dùng nhập trên giao diện,
key được mã hoá bằng `CREDENTIALS_SECRET` rồi lưu xuống đĩa, và không endpoint
nào trả lại key gốc — đọc lên chỉ được bản che `sk-proj-••••7890`.

`make deploy-full` có vLLM trong stack nên tạo sẵn một kết nối trỏ vào đó;
tạo bộ tài liệu, chọn kết nối này là dùng được ngay. Các kiểu deploy khác
(`deploy-hybrid`) thì tự thêm kết nối OpenAI hoặc Gemini trên giao diện trước.

Lần đầu mất **15–30 phút** để tải model (~15GB). Theo dõi:

```bash
make logs-vllm     # tiến trình tải VLM
make health        # kiểm tra khi xong
```

Xong thì mở http://localhost:7860.

Muốn tải model trước cho khỏi chờ lúc khởi động:

```bash
make pull-models && make deploy-full
```

```bash
make help          # xem tất cả lệnh
make ps            # trạng thái service
make down          # dừng
```

Không có GPU thì dùng `make deploy-demo` để xem giao diện. Các kiểu khác đều cần NVIDIA Container Toolkit.

---

## Model

Hệ thống dùng ba model, hai chạy trên GPU của bạn:

| Model | Việc | Ở đâu | VRAM |
|---|---|---|---|
| **VLM** (InternVL3-8B) | Đọc ảnh-mục, sinh câu trả lời | vLLM trong stack | ~8 GB |
| **ColQwen 2.5-3B** | Embed ảnh-mục để truy xuất | backend, tự tải | ~10 GB |
| **PaddleOCR + PP-DocLayout** | Layout detection, OCR | worker, tự tải | ~5 GB |
| LLM sửa cây mục lục | Sửa cây mục lục sau khi phân tích | Kết nối người dùng chọn cho bộ | 0 |

vLLM chạy bằng **Docker image** `vllm/vllm-openai`, không phải pip install. Model weights tải vào volume `cosmo_hf-cache` dùng chung, chỉ tải một lần.

Chọn model theo VRAM, tách GPU, dùng VLM host sẵn ở nơi khác, xử lý OOM — xem **[docs/MODEL_HOSTING.md](docs/MODEL_HOSTING.md)**.

Nếu đã có vLLM chạy ở máy khác:

Không cần deploy lại: vào giao diện > **Cấu hình** > thêm kết nối với
provider `custom`, endpoint `http://192.168.1.50:8000/v1`, rồi chọn nó cho bộ
tài liệu. Dùng `make deploy-hybrid` để khỏi khởi động vLLM trong stack.

---

## Cấu hình

Mọi giá trị trong `backend/config/config.yaml` đều override được bằng biến môi trường. **`config.yaml` không bao giờ chứa secret** — có test kiểm điều đó.

API key của mô hình không đi qua env lẫn YAML: người dùng nhập trên giao diện, key được mã hoá bằng `CREDENTIALS_SECRET` rồi lưu trong `data/model_connections.json`. Service vẫn lên được khi chưa có key nào — nếu không thì không ai vào được giao diện để nhập.

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `CREDENTIALS_SECRET` | — | **Bắt buộc.** Khoá mã hoá API key người dùng nhập |
| `DEFAULT_VLM_PROVIDER` | `none` | `builtin` để tạo sẵn kết nối tới vLLM trong stack |
| `VLM_MODEL_NAME` | `OpenGVLab/InternVL3-8B` | Chọn theo VRAM |
| `VLLM_GPU_MEMORY_UTILIZATION` | `0.35` | Chừa VRAM cho ColQwen và PaddleOCR |
| `EMBEDDING_MAX_NUM_VISUAL_TOKENS` | `8192` | Giảm 4096 nếu thiếu VRAM |
| `EMBEDDING_MIN_WIDTH` | `600` | Chiều rộng tối thiểu khi resize ảnh-mục |
| `VECTORDB_TYPE` | `qdrant-standalone` | `qdrant-standalone` \| `milvus-lite` \| `milvus-standalone` |
| `LOG_LEVEL` | `INFO` | `DEBUG` để xem chi tiết từng bước pipeline |

Danh sách đầy đủ: [.env.example](.env.example).

---

## Yêu cầu phần cứng

**Tối thiểu: một GPU 24GB** (RTX 4090, A5000) với cấu hình mặc định:

```
vLLM (InternVL3-8B)      ~8.4 GB
ColQwen 2.5-3B           ~9.5 GB
PaddleOCR + layout       ~4.5 GB
                        ─────────
                         ~22.4 GB / 24 GB
```

Sát ngưỡng — chạy được nếu không index sách lớn trong khi có người truy vấn. Máy nhiều GPU thì tách vLLM ra riêng, xem [docs/MODEL_HOSTING.md](docs/MODEL_HOSTING.md).

Đĩa: ~50GB cho image và model cache.

---

## Tài liệu từng phần

- [docs/MODEL_HOSTING.md](docs/MODEL_HOSTING.md) — **chọn model, chia VRAM, xử lý OOM**
- [docs/VERIFICATION.md](docs/VERIFICATION.md) — **đã kiểm chứng gì, còn gì phải tự chạy**
- [docs/MIGRATION.md](docs/MIGRATION.md) — đối chiếu với bản `chatpdf_ver_2` cũ
- [backend/README.md](backend/README.md) — API reference, chạy local, cấu trúc pipeline
- [frontend/README.md](frontend/README.md) — giao diện, cấu hình, chạy local

---

## Cấu trúc thư mục

```
cosmo-chatpdf/
├── backend/
│   ├── app/              # API service (cổng 8000)
│   │   ├── api/routes/   # search, indexing, toc, health,
│   │   │                 #   connections, collections, settings
│   │   ├── schemas/      # pydantic request/response
│   │   └── services/     # indexing, retrieval, toc, images
│   ├── worker/           # PDF worker (cổng 8001)
│   ├── core/             # config, logging, paths
│   │                     #   connections + crypto: kho API key mã hoá
│   │                     #   collections: cấu hình mô hình theo từng bộ
│   │                     #   builtin: kết nối vLLM tạo sẵn cho deploy-full
│   ├── embeddings/       # ColQwen/ColPali manager
│   ├── vectordb/         # Qdrant/Milvus manager
│   ├── document/         # pipeline xử lý PDF
│   ├── prompts/
│   └── tests/
├── frontend/             # Vite + React + TypeScript + Tailwind
│   └── src/
│       ├── features/     # ask, documents, outline, source, settings
│       ├── components/   # shadcn/ui
│       └── lib/          # client gọi API
├── deploy/               # Caddyfile + hướng dẫn chọn kiểu deploy
├── docker-compose.yml    # mọi kiểu deploy, chọn bằng profile
└── docker-compose.gpu.yml
```

Chỉ hai file compose: `docker-compose.yml` chứa mọi kiểu triển khai và chọn
bằng profile (`full`, `hybrid`, `gpu-node`, `worker-node`, `demo`, `prod`).
File GPU phải riêng vì khối cấp GPU làm container không khởi động nổi trên máy
chưa cài NVIDIA Container Toolkit. Xem [deploy/README.md](deploy/README.md).

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
cd frontend && npm install && npm run dev

# Test — chạy được không cần GPU
pytest
```

---

## Giấy phép

Nội bộ.

# Quy trình host model

Hệ thống dùng **ba model**, hai trong số đó chạy trên GPU của bạn.

| Model | Việc | Ở đâu | VRAM |
|---|---|---|---|
| **VLM** (InternVL3 / Qwen2.5-VL) | Đọc ảnh-mục, sinh câu trả lời | vLLM trong stack | 8–40 GB |
| **ColQwen 2.5-3B** | Embed ảnh-mục để truy xuất | backend, tự tải | ~10 GB |
| **PaddleOCR + PP-DocLayout** | Layout detection, OCR | worker, tự tải | ~5 GB |
| Gemini Flash | Sửa cây mục lục | API ngoài | 0 |

ColQwen và PaddleOCR **tự tải khi khởi động lần đầu** — không cần làm gì. Tài liệu này chủ yếu nói về VLM.

---

## Chọn model theo VRAM

Đây là quyết định quan trọng nhất. `VLLM_GPU_MEMORY_UTILIZATION` phải chừa đủ chỗ cho ColQwen (~10GB) và PaddleOCR (~5GB) nếu dùng chung GPU.

### Một GPU 24GB (RTX 4090, A5000)

```bash
VLM_MODEL_NAME=OpenGVLab/InternVL3-8B
VLLM_GPU_MEMORY_UTILIZATION=0.35      # ~8.4GB cho vLLM
EMBEDDING_MAX_NUM_VISUAL_TOKENS=8192
```

Chật nhưng chạy được nếu **không index và truy vấn đồng thời**. Nếu OOM, hạ `EMBEDDING_MAX_NUM_VISUAL_TOKENS=4096`.

Chật hơn nữa thì dùng bản lượng tử hoá:

```bash
VLM_MODEL_NAME=OpenGVLab/InternVL3-8B-AWQ
VLLM_GPU_MEMORY_UTILIZATION=0.30
```

### Một GPU 48GB (A6000, L40S)

```bash
VLM_MODEL_NAME=OpenGVLab/InternVL3-14B
VLLM_GPU_MEMORY_UTILIZATION=0.50
```

### Một GPU 80GB (A100, H100)

```bash
VLM_MODEL_NAME=OpenGVLab/InternVL3-38B
VLLM_GPU_MEMORY_UTILIZATION=0.55
```

### Nhiều GPU

Tách vLLM sang GPU riêng — cách này thoải mái nhất. Sửa `docker-compose.gpu.yml`:

```yaml
services:
  vllm:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["0"]      # GPU 0 riêng cho vLLM
              capabilities: [gpu]
  backend:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["1"]      # GPU 1 cho ColQwen + PaddleOCR
              capabilities: [gpu]
  worker:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ["1"]
              capabilities: [gpu]
```

Rồi nâng `VLLM_GPU_MEMORY_UTILIZATION=0.90`.

Model 78B cần tensor parallel qua nhiều GPU — thêm `--tensor-parallel-size=2` vào `command` của service `vllm`.

---

## Khởi động lần đầu

```bash
cd cosmo-chatpdf
cp .env.example .env
# Điền GEMINI_API_KEY, chọn VLM_MODEL_NAME theo VRAM

make up-gpu
```

**Lần đầu mất 15–30 phút** vì phải tải:
- VLM: 8–80 GB tuỳ model
- ColQwen 2.5-3B: ~6 GB
- PaddleOCR + PP-DocLayout: ~1 GB

Theo dõi tiến trình:

```bash
make logs-vllm        # tải model VLM
make logs             # tất cả
docker compose ps     # đợi tới khi healthy
```

Model tải về volume `hf-cache` dùng chung, nên **các lần sau khởi động chỉ mất 1–3 phút**.

### Kiểm tra khi xong

```bash
make health
```

Hoặc thủ công:

```bash
curl http://localhost:3333/v1/models     # vLLM
curl http://localhost:2005/health        # backend
curl http://localhost:2222/health        # worker
curl http://localhost:6333/healthz       # qdrant
```

---

## Tải model trước (khuyến nghị cho môi trường sản xuất)

Tránh việc container chờ tải model lúc khởi động:

```bash
make pull-models
```

Lệnh này tải VLM và ColQwen vào volume `hf-cache` trước, rồi `make up-gpu` sẽ khởi động nhanh.

Với model gated (Llama, một số bản Qwen) cần token:

```bash
# Trong .env
HUGGING_FACE_HUB_TOKEN=hf_xxxxx
```

---

## Dùng VLM host sẵn ở nơi khác

Nếu đã có vLLM chạy trên máy khác:

```bash
# Trong .env
VLM_ENDPOINT=http://192.168.1.50:8000/v1
VLM_MODEL_NAME=OpenGVLab/InternVL3-78B-AWQ

make up-external-vlm
```

Stack sẽ không khởi động service `vllm`, tiết kiệm toàn bộ VRAM cho ColQwen và PaddleOCR.

Endpoint phải là **OpenAI-compatible** và hỗ trợ **input ảnh** (`image_url` trong message content). Kiểm tra:

```bash
curl http://your-host:8000/v1/models
```

---

## Tự chạy vLLM ngoài Docker

Nếu muốn kiểm soát kỹ hơn:

```bash
pip install vllm==0.9.2

vllm serve OpenGVLab/InternVL3-8B \
  --served-model-name OpenGVLab/InternVL3-8B \
  --gpu-memory-utilization 0.35 \
  --max-model-len 8192 \
  --trust-remote-code \
  --host 0.0.0.0 --port 3333
```

Rồi `VLM_ENDPOINT=http://host.docker.internal:3333/v1` và chạy `make up-external-vlm`.

---

## Đổi model đang chạy

```bash
# Sửa VLM_MODEL_NAME trong .env
docker compose up -d --force-recreate vllm backend worker frontend
```

Cả bốn service phải cùng biết tên model mới vì client gửi `model=` trong mỗi request.

---

## Xử lý sự cố

### vLLM OOM lúc khởi động

```
torch.OutOfMemoryError: CUDA out of memory
```

Theo thứ tự thử:
1. Hạ `VLLM_GPU_MEMORY_UTILIZATION` (0.35 → 0.25)
2. Hạ `VLLM_MAX_MODEL_LEN` (8192 → 4096)
3. Đổi sang model nhỏ hơn hoặc bản AWQ
4. Tách vLLM sang GPU riêng

### Backend OOM khi index

ColQwen với 8192 visual token rất tốn. Hạ xuống:

```bash
EMBEDDING_MAX_NUM_VISUAL_TOKENS=4096
EMBEDDING_MAX_TOKEN=6500
```

Đánh đổi: ảnh-mục bị nén nhiều hơn, chữ nhỏ có thể khó đọc — ảnh hưởng chất lượng truy xuất.

### vLLM healthy nhưng backend gọi lỗi

Kiểm tra tên model khớp chính xác:

```bash
curl http://localhost:3333/v1/models | grep '"id"'
```

Chuỗi này phải **giống hệt** `VLM_MODEL_NAME` trong `.env`.

### Model tải lại mỗi lần restart

Volume `hf-cache` chưa được mount đúng:

```bash
docker volume inspect cosmo-chatpdf_hf-cache
docker compose exec backend ls -la /data/.cache/huggingface
```

### Không thấy GPU trong container

```bash
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

Lỗi thì cài NVIDIA Container Toolkit:
https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html

Và nhớ dùng `make up-gpu`, không phải `make up` — bản `up` không cấp GPU.

---

## Theo dõi VRAM

```bash
watch -n 1 nvidia-smi
```

Phân bổ điển hình trên 24GB khi mọi thứ đã nạp:

```
vLLM (InternVL3-8B)      ~8.4 GB
ColQwen 2.5-3B           ~9.5 GB
PaddleOCR + layout       ~4.5 GB
                        ─────────
                         ~22.4 GB / 24 GB
```

Sát ngưỡng. Nếu index sách lớn trong khi có người truy vấn thì sẽ OOM — cân nhắc tách GPU hoặc index ngoài giờ.

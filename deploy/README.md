# Các kiểu triển khai

Hệ thống có bốn thành phần nạp model, mỗi cái một profile tài nguyên khác nhau.
Chia deploy theo đó, không theo "frontend/backend".

| Thành phần | Model | VRAM | Chạy khi nào |
|---|---|---|---|
| **worker** | PaddleOCR + PP-DocLayout | ~5-6 GB | Lúc index tài liệu |
| **backend** | ColQwen 2.5-3B | ~9-10 GB | Cả lúc index và lúc truy vấn |
| **vllm** | VLM (InternVL3-8B) | ~8 GB | Chỉ lúc trả lời |
| **frontend + qdrant** | không | 0 | Luôn luôn |

Điểm quan trọng: **vllm là thứ tốn VRAM mà bỏ được** — thay bằng API ngoài
(OpenAI, Gemini) thì tiết kiệm 8GB và chất lượng thường tốt hơn.

---

## Bốn kiểu triển khai

### 1. `full` — tất cả trên một máy có GPU

```bash
make deploy-full
```

Mọi thứ tự host, tài liệu không rời khỏi máy.

| | |
|---|---|
| VRAM tối thiểu | **24 GB** (RTX 4090, A5000) |
| Service | qdrant, worker, backend, vllm, frontend |
| Dùng khi | Tài liệu nhạy cảm, không được gửi ra ngoài |

Phân bổ VRAM:
```
vLLM (InternVL3-8B)      ~8.4 GB   (gpu-memory-utilization 0.35)
ColQwen 2.5-3B           ~9.5 GB
PaddleOCR + layout       ~4.5 GB
                        ─────────
                         ~22.4 GB / 24 GB
```
Sát ngưỡng: đừng index sách lớn trong khi có người truy vấn.

---

### 2. `hybrid` — GPU vừa, VLM dùng API ngoài ⭐ *khuyến nghị*

```bash
# .env
DEFAULT_VLM_PROVIDER=gemini
GEMINI_API_KEY=...

make deploy-hybrid
```

Chỉ tự host phần **bắt buộc phải có GPU** (OCR, layout, embedding). Khâu đọc
ảnh và trả lời giao cho API ngoài.

| | |
|---|---|
| VRAM tối thiểu | **16 GB** (RTX 4080, A4000) |
| Service | qdrant, worker, backend, frontend |
| Đánh đổi | Ảnh-mục gửi lên nhà cung cấp API |

Đây là kiểu hợp lý nhất cho phần lớn trường hợp: OCR và embedding **phải**
chạy local (chúng xử lý toàn bộ tài liệu), còn VLM chỉ đọc 3-5 ảnh mỗi câu hỏi
nên gửi ra ngoài rẻ và nhanh hơn tự host.

Người dùng vẫn đổi được provider trên giao diện mà không cần deploy lại.

---

### 3. `split` — hai máy, tách theo profile VRAM

```bash
# Máy A (GPU nhẹ, 8GB): chỉ xử lý PDF
make deploy-worker-node

# Máy B (GPU mạnh, 16GB+): truy xuất và trả lời
BACKEND_WORKER_URL=http://may-a:2222/upload_pdf/ make deploy-gpu-node
```

Tách vì hai việc có **nhịp sử dụng khác nhau**: index chạy theo đợt rồi nghỉ,
truy vấn chạy liên tục. Máy A rảnh phần lớn thời gian nên dùng GPU rẻ.

| Máy | Service | VRAM |
|---|---|---|
| A | worker | 8 GB |
| B | qdrant, backend, vllm, frontend | 16-24 GB |

---

### 4. `demo` — không model, chỉ xem giao diện

```bash
make deploy-demo
```

Chạy `demo_server.py` trả dữ liệu mẫu. Không cần GPU, không cần API key.
Dùng để xem giao diện, phát triển frontend, hoặc demo cho người khác.

| | |
|---|---|
| VRAM | 0 |
| Service | qdrant, demo-backend, frontend |

---

## Chọn kiểu nào

```
Tài liệu có được gửi ra ngoài không?
├── KHÔNG ──> có ≥24GB VRAM? ──> full
│                             └── không ──> split (2 máy)
└── CÓ ──────> hybrid  ⭐
```

Chỉ muốn xem giao diện: `demo`.

---

## Đưa lên server công khai

**Mặc định của `docker-compose.yml` không an toàn cho server có IP công khai** —
nó phơi cả 6 cổng ra `0.0.0.0`, trong đó Qdrant **không có xác thực**.

Dùng `docker-compose.prod.yml`:

```bash
make deploy-prod
```

Nó làm ba việc:
1. Chỉ phơi cổng 80/443 ra ngoài; qdrant, worker, backend, vllm chỉ nằm trong
   network nội bộ của Docker
2. Caddy đứng trước, tự xin chứng chỉ Let's Encrypt
3. Bật xác thực cơ bản cho toàn site

```bash
# .env
DOMAIN=chatpdf.congty.vn
[email protected]
BASIC_AUTH_USER=cosmo
BASIC_AUTH_HASH=$(docker run --rm caddy caddy hash-password --plaintext 'matkhau')
```

### Nếu `agent_tung` cần gọi backend

Ở chế độ prod, cổng 2005 và 3333 **không còn phơi ra ngoài**. Hai cách:

- **Cùng máy**: cho agent chạy trong network `cosmo_default`, gọi
  `http://backend:8000` và `http://vllm:8000/v1`
- **Khác máy**: mở cổng cho riêng IP của agent
  ```yaml
  backend:
    ports:
      - "10.0.0.5:2005:8000"   # chỉ IP nội bộ này
  ```

---

## Bảng cổng

| Service | Cổng trong | Cổng ra (dev) | Cổng ra (prod) |
|---|---|---|---|
| frontend | 7860 | 7860 | qua Caddy 443 |
| backend | 8000 | 2005 | không phơi |
| worker | 8001 | 2222 | không phơi |
| vllm | 8000 | 3333 | không phơi |
| qdrant | 6333/6334 | 6333/6334 | không phơi |

Cổng dev map khớp bản `chatpdf_ver_2` cũ nên client hiện có không phải sửa.

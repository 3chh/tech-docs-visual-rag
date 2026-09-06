# Các kiểu triển khai

Hệ thống có bốn thành phần nạp model, mỗi cái một profile tài nguyên khác nhau.
Chia deploy theo đó, không theo "frontend/backend".

| Thành phần | Model | VRAM | Chạy khi nào |
|---|---|---|---|
| **worker** | PaddleOCR + PP-DocLayout | **0 — chạy CPU** | Lúc index tài liệu |
| **backend** | ColQwen 2.5-3B | ~9-10 GB | Cả lúc index và lúc truy vấn |
| **vllm** | VLM (InternVL3-8B) | ~8 GB | Chỉ lúc trả lời |
| **frontend + qdrant** | không | 0 | Luôn luôn |

Worker chạy CPU vì Paddle chưa có wheel biên dịch cho GPU Blackwell (sm_120);
bản GPU mới nhất chỉ tới sm_90. Index chậm hơn nhưng đó là việc offline, còn
phần trả lời câu hỏi vẫn GPU đầy đủ. Số luồng đặt bằng `OMP_NUM_THREADS`.

Điểm quan trọng: **vllm là thứ tốn VRAM mà bỏ được** — thay bằng API ngoài
(OpenAI, Gemini) thì tiết kiệm 8GB và chất lượng thường tốt hơn.

## Chỉ có hai file compose

Mọi kiểu triển khai nằm trong `docker-compose.yml`, chọn bằng
[profile của Compose](https://docs.docker.com/compose/how-tos/profiles/).

Profile đặt tên theo **khối tài nguyên**, không theo kiểu deploy — vì cùng một
kiểu vẫn cần bật/tắt khối tuỳ VRAM của máy:

| Profile | Service | VRAM | Cần khi nào |
|---|---|---|---|
| `app` | qdrant, backend, frontend | ~10 GB (ColQwen) | Mọi bản chạy thật |
| `worker` | worker | 0, chạy CPU | Khi cần index tài liệu |
| `vllm` | vllm | ~8 GB (InternVL3-8B) | Khi muốn tự host VLM |
| `demo` | backend-demo, frontend | 0 | Chỉ xem giao diện |
| `prod` | caddy | 0 | Server công khai |

Kiểu deploy là **tổ hợp** các khối:

| Lệnh | Profile | Service thực tế |
|---|---|---|
| `make deploy-full` | `app,worker,vllm` | qdrant, backend, frontend, worker, vllm |
| `make deploy-hybrid` | `app,worker` | qdrant, backend, frontend, worker |
| `make deploy-worker-node` | `worker` | worker |
| `make deploy-gpu-node` | `app,vllm` | qdrant, backend, frontend, vllm |
| `make deploy-gpu-node VLLM=0` | `app` | qdrant, backend, frontend |
| `make deploy-demo` | `demo` | backend-demo, frontend |

Cách đặt tên này giải quyết đúng một tình huống thật: máy B của kiểu `split`
chỉ có 16GB thì không đủ cho cả ColQwen (~10GB) và vLLM (~8GB), nên phải bỏ
được khối `vllm` — `make deploy-gpu-node VLLM=0`.

### `prod` là lớp bọc, không phải một kiểu

Hai chiều độc lập nhau:

| | |
|---|---|
| **Khối nào chạy** | full / hybrid / worker-node / gpu-node / demo |
| **Phơi ra đâu** | `PUBLIC=0` mặc định, hay `PUBLIC=1` |

`PUBLIC=1` thêm khối `prod` (Caddy ở 80/443) và đặt `BIND_ADDR=127.0.0.1`.
Vì là lớp bọc nên nó là **flag**, ghép được với kiểu nào có giao diện:

```bash
make deploy-full PUBLIC=1        # tự host tất cả, ra Internet
make deploy-hybrid PUBLIC=1      # VLM API ngoài, ra Internet
make deploy-gpu-node PUBLIC=1 VLLM=0 PDF_WORKER_ENDPOINT=...
make deploy-demo PUBLIC=1        # demo cho khách xem qua HTTPS
make deploy-prod                 # = deploy-full PUBLIC=1
```

Không áp cho `deploy-worker-node`: máy A không phục vụ giao diện nên Caddy
không có gì để proxy.

**Vì sao không gộp `PUBLIC=1` thành mặc định:** `deploy/Caddyfile` dùng
`{$DOMAIN}` làm site block, nên bắt buộc phải có domain công khai và DNS trỏ
về máy để Let's Encrypt cấp được chứng chỉ. Máy local không có thứ đó — gộp
vào thì mỗi lần chạy thử trên laptop cũng đòi domain thật. Ngoài ra
`BIND_ADDR=127.0.0.1` sẽ làm `agent_tung` ở máy khác mất đường gọi cổng 2005
và 3333.

`docker-compose.gpu.yml` là overlay duy nhất còn lại, và nó **buộc phải** là
file riêng: khối `deploy.resources.reservations.devices` khiến container không
khởi động nổi trên máy chưa cài NVIDIA Container Toolkit — kể cả khi đặt
`count: 0`, Docker vẫn đi tìm driver rồi báo
`could not select device driver "nvidia"`. Không biến môi trường nào tắt được
khối đó, nên cách duy nhất là bỏ hẳn file khi chạy trên máy không GPU.

Dùng `make deploy-*` là xong, không cần nhớ profile. Muốn gọi tay:

```bash
COMPOSE_PROFILES=app,worker docker compose \
    -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

Xem một profile sẽ bật những gì mà không chạy gì cả:

```bash
make config PROFILES=demo
```

---

## Bốn kiểu triển khai

### 1. `full` — tất cả trên một máy có GPU

```bash
make deploy-full
```

Mọi thứ tự host, tài liệu không rời khỏi máy.

| | |
|---|---|
| VRAM tối thiểu | **32 GB** (vLLM ~20 + ColQwen ~10; worker chạy CPU) |
| Service | qdrant, worker, backend, vllm, frontend |
| Dùng khi | Tài liệu nhạy cảm, không được gửi ra ngoài |

Phân bổ VRAM:
```
vLLM (InternVL3-8B)     ~20 GB   (weights 16GB bf16 + KV cache, util 0.60)
ColQwen 2.5-3B          ~10 GB
PaddleOCR + layout         0      (CPU)
                        ─────────
                         ~30 GB / 32 GB
```
Sát ngưỡng. Card nhỏ hơn 32GB thì đổi `VLM_MODEL_NAME` sang
`OpenGVLab/InternVL3-2B` (~4.4GB), hoặc dùng `hybrid` cho VLM đi API ngoài.

Kiểu này tự đặt `DEFAULT_VLM_PROVIDER=builtin`, nên khi service lên đã có sẵn
một kết nối tên **"vLLM tự host (built-in)"** trỏ vào `http://vllm:8000/v1`.
Tạo bộ tài liệu và chọn nó là dùng được ngay, không phải nhập API key nào.

Kết nối đó khai cả `vlm` và `llm` vì vLLM nói giao thức OpenAI: cùng một
endpoint vừa đọc ảnh trả lời, vừa sửa được cây mục lục. Sửa endpoint hay model
trên giao diện thì lần khởi động sau không bị ghi đè; xoá đi thì nó quay lại
(kết nối này mô tả thực tế của bản deploy, muốn bỏ hẳn thì đặt
`DEFAULT_VLM_PROVIDER=none`).

---

### 2. `hybrid` — GPU vừa, VLM dùng API ngoài ⭐ *khuyến nghị*

```bash
make deploy-hybrid
```

Chỉ tự host phần **bắt buộc phải có GPU** (OCR, layout, embedding). Khâu đọc
ảnh và trả lời giao cho API ngoài.

| | |
|---|---|
| VRAM tối thiểu | **10 GB** (chỉ ColQwen; worker CPU, VLM API ngoài) |
| Service | qdrant, worker, backend, frontend |
| Đánh đổi | Ảnh-mục gửi lên nhà cung cấp API |

Không có API key nào trong `.env`. Sau khi service lên:

1. Mở giao diện > **Cấu hình** > thêm kết nối tới OpenAI hoặc Gemini
2. **Tạo bộ tài liệu**, chọn kết nối đó cho bộ
3. Tải PDF lên

Chưa làm bước 1 và 2 thì `/upload_files` trả 409 — chặn ngay thay vì để chờ
20 phút index rồi mới báo thiếu mô hình.

Đây là kiểu hợp lý nhất cho phần lớn trường hợp: OCR và embedding **phải**
chạy local (chúng xử lý toàn bộ tài liệu), còn VLM chỉ đọc 3-5 ảnh mỗi câu hỏi
nên gửi ra ngoài rẻ và nhanh hơn tự host.

---

### 3. `split` — hai máy, tách theo profile VRAM

```bash
# Máy A (không cần GPU): chỉ xử lý PDF
make deploy-worker-node

# Máy B (GPU mạnh, 16GB+): truy xuất và trả lời
PDF_WORKER_ENDPOINT=http://may-a:2222/upload_pdf/ make deploy-gpu-node
```

Tách vì hai việc có **nhịp sử dụng khác nhau**: index chạy theo đợt rồi nghỉ,
truy vấn chạy liên tục. Máy A rảnh phần lớn thời gian nên dùng GPU rẻ.

| Máy | Service | VRAM |
|---|---|---|
| A | worker | 0, chạy CPU |
| B | qdrant, backend, frontend, vllm | 24 GB |
| B (`VLLM=0`) | qdrant, backend, frontend | 16 GB, VLM qua API ngoài |

Máy A phơi cổng worker ra mạng. Nếu không phải mạng nội bộ kín, giới hạn lại:
`BIND_ADDR=10.0.0.5 make deploy-worker-node`.

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
| Service | backend-demo, frontend |

Không dựng qdrant: `demo_server.py` là HTTP server thuần stdlib trả dữ liệu
mẫu, không nối vector DB nào.

`backend-demo` mang alias mạng `backend` nên `nginx.conf` của frontend không
phải sửa gì. Đây cũng là kiểu duy nhất không kèm `docker-compose.gpu.yml`.

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

**Mặc định không an toàn cho server có IP công khai** — nó phơi cả 6 cổng ra
`0.0.0.0`, trong đó Qdrant **không có xác thực**.

```bash
make deploy-prod                 # tự host VLM
make deploy-hybrid PUBLIC=1      # VLM qua API ngoài
```

`PUBLIC=1` làm ba việc:
1. Đặt `BIND_ADDR=127.0.0.1`, nên qdrant, worker, backend, vllm chỉ nghe
   loopback của host — vào được bằng SSH tunnel để debug, không vào được từ
   Internet
2. Caddy đứng trước ở 80/443, tự xin chứng chỉ Let's Encrypt
3. Bật xác thực cơ bản cho toàn site

```bash
# .env
DOMAIN=chatpdf.congty.vn
[email protected]
BASIC_AUTH_USER=cosmo
BASIC_AUTH_HASH=$(docker run --rm caddy caddy hash-password --plaintext 'matkhau')
```

`make deploy-prod` là `deploy-full PUBLIC=1`. Muốn dùng VLM API ngoài:

```bash
make deploy-hybrid PUBLIC=1
```

### Nếu `agent_tung` cần gọi backend

Ở chế độ prod, cổng 2005 và 3333 chỉ nghe `127.0.0.1`. Ba cách:

- **Cùng máy, cùng host**: gọi `http://127.0.0.1:2005` như bình thường
- **Cùng máy, trong Docker**: cho agent chạy trong network `cosmo_default`,
  gọi `http://backend:8000` và `http://vllm:8000/v1`
- **Khác máy**: mở cổng cho riêng IP của agent
  ```bash
  BIND_ADDR=10.0.0.5 make deploy-prod
  ```

---

## Bảng cổng

| Service | Cổng trong | Cổng ra (dev) | Cổng ra (prod) |
|---|---|---|---|
| frontend | 7860 | 7860 | qua Caddy 443 |
| backend | 8000 | 2005 | chỉ 127.0.0.1 |
| worker | 8001 | 2222 | chỉ 127.0.0.1 |
| vllm | 8000 | 3333 | chỉ 127.0.0.1 |
| qdrant | 6333/6334 | 6333/6334 | chỉ 127.0.0.1 |

Cổng dev map khớp bản `chatpdf_ver_2` cũ nên client hiện có không phải sửa.

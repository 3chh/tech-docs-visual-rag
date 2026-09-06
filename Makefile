COMPOSE := docker compose -f docker-compose.yml
GPU     := -f docker-compose.gpu.yml

# Lệnh vận hành (down, ps, logs) phải thấy được mọi service bất kể đang chạy
# kiểu nào, nên bật hết profile.
ALL_PROFILES := app,worker,vllm,demo,prod
ANY := COMPOSE_PROFILES=$(ALL_PROFILES) $(COMPOSE)

.PHONY: help setup setup-demo build pull-models \
        deploy-full deploy-hybrid deploy-worker-node deploy-gpu-node deploy-demo deploy-prod \
        down restart ps health logs logs-vllm logs-backend logs-worker logs-frontend \
        config test lint clean clean-all _check-public _after-up

help:
	@echo "Cosmo ChatPDF"
	@echo ""
	@echo "  TRIỂN KHAI (xem deploy/README.md để chọn kiểu)"
	@echo "    make deploy-hybrid       GPU 16GB, VLM dùng API ngoài    <- khuyến nghị"
	@echo "    make deploy-full         Tất cả tự host, cần GPU 24GB"
	@echo "    make deploy-demo         Không model, chỉ xem giao diện"
	@echo ""
	@echo "    make deploy-worker-node  Máy A: chỉ xử lý PDF (8GB)"
	@echo "    make deploy-gpu-node     Máy B: truy xuất và trả lời (24GB)"
	@echo "      thêm VLLM=0            Máy B chỉ 16GB, VLM qua API ngoài"
	@echo ""
	@echo "  ĐƯA RA INTERNET — thêm PUBLIC=1 vào kiểu có giao diện"
	@echo "    make deploy-full PUBLIC=1     Caddy + HTTPS + xác thực"
	@echo "    make deploy-hybrid PUBLIC=1   dùng được cho cả gpu-node, demo"
	@echo "    make deploy-prod              (= deploy-full PUBLIC=1)"
	@echo "    Cần DOMAIN và BASIC_AUTH_HASH trong .env"
	@echo "    Không áp cho deploy-worker-node: máy A không phục vụ giao diện"
	@echo ""
	@echo "  VẬN HÀNH"
	@echo "    make down  make restart  make ps  make health  make config"
	@echo "    make logs  make logs-vllm  make logs-backend  make logs-worker"
	@echo ""
	@echo "  CHUẨN BỊ"
	@echo "    make setup               Tạo .env từ mẫu"
	@echo "    make pull-models         Tải model trước cho khỏi chờ"
	@echo "    make build               Build image"
	@echo ""
	@echo "  PHÁT TRIỂN"
	@echo "    make test  make lint  make clean  make clean-all"
	@echo ""
	@echo "  Cổng: vLLM 3333 | backend 2005 | worker 2222 | qdrant 6333 | UI 7860"

# --- Chuẩn bị -----------------------------------------------------------

setup:
	@test -f .env || (cp .env.example .env && \
		echo "Đã tạo .env — điền CREDENTIALS_SECRET trước khi chạy")
	@grep -q '^CREDENTIALS_SECRET=.\+' .env || \
		(echo "CREDENTIALS_SECRET còn trống. Sinh bằng: openssl rand -base64 32" && exit 1)

# Demo không gọi model nào nên không cần key.
setup-demo:
	@test -f .env || cp .env.example .env

build:
	COMPOSE_PROFILES=$(ALL_PROFILES) $(COMPOSE) build

pull-models: setup
	@bash scripts/pull_models.sh

# --- Triển khai ---------------------------------------------------------
#
# Kiểu deploy = tổ hợp khối tài nguyên. Hai chiều độc lập nhau:
#
#   CHIỀU 1, khối nào chạy:  full / hybrid / worker-node / gpu-node / demo
#   CHIỀU 2, phơi ra đâu:    PUBLIC=0 (mặc định) hay PUBLIC=1
#
# PUBLIC=1 thêm Caddy ở 80/443 và đẩy mọi cổng khác về loopback. Nó là lớp
# bọc, không phải một kiểu riêng — nên là flag chứ không phải target: bất kỳ
# kiểu nào cũng bọc được, `make deploy-hybrid PUBLIC=1` chẳng hạn.
#
# Không gộp PUBLIC=1 thành mặc định được: Caddyfile dùng $$DOMAIN làm site
# block nên bắt buộc có domain công khai + DNS trỏ về máy để Let's Encrypt
# cấp cert. Máy local không có thứ đó.

PUBLIC ?= 0
ifeq ($(PUBLIC),1)
HARDEN := ,prod
BIND    := BIND_ADDR=127.0.0.1
else
HARDEN :=
BIND    :=
endif

# DEFAULT_VLM_PROVIDER=builtin: bản này có vLLM trong stack nên tạo sẵn kết
# nối tới nó, người dùng không phải tự đoán endpoint nội bộ.
deploy-full: setup _check-public
	COMPOSE_PROFILES=app,worker,vllm$(HARDEN) DEFAULT_VLM_PROVIDER=builtin $(BIND) \
		$(COMPOSE) $(GPU) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="tất cả tự host (24GB VRAM)"

deploy-hybrid: setup _check-public
	COMPOSE_PROFILES=app,worker$(HARDEN) $(BIND) $(COMPOSE) $(GPU) up -d --build
	@echo ""
	@echo "vLLM không chạy ở kiểu này. Vào giao diện > Cấu hình > thêm kết nối"
	@echo "tới OpenAI hoặc Gemini, rồi tạo bộ tài liệu chọn kết nối đó."
	@$(MAKE) --no-print-directory _after-up KIND="hybrid, VLM qua API ngoài (16GB VRAM)"

deploy-worker-node: setup
	COMPOSE_PROFILES=worker $(COMPOSE) $(GPU) up -d --build
	@echo ""
	@echo "Máy A đang chạy: chỉ worker xử lý PDF."
	@echo "Trên máy B chạy:"
	@echo "  PDF_WORKER_ENDPOINT=http://<ip-may-a>:$${WORKER_PORT:-2222}/upload_pdf/ make deploy-gpu-node"
	@echo "Máy B chỉ 16GB thì thêm VLLM=0 để dùng VLM qua API ngoài."

# Máy B có tự host VLM hay không. 16GB không đủ cho cả ColQwen (~10GB) và
# vLLM (~8GB) nên đặt VLLM=0 rồi thêm kết nối OpenAI/Gemini trên giao diện.
VLLM ?= 1
ifeq ($(VLLM),0)
GPU_NODE_PROFILES := app
GPU_NODE_VLM := none
else
GPU_NODE_PROFILES := app,vllm
GPU_NODE_VLM := builtin
endif

deploy-gpu-node: setup _check-public
	@test -n "$(PDF_WORKER_ENDPOINT)" || \
		(echo "Cần PDF_WORKER_ENDPOINT trỏ tới worker ở máy A" && exit 1)
	COMPOSE_PROFILES=$(GPU_NODE_PROFILES)$(HARDEN) \
		PDF_WORKER_ENDPOINT=$(PDF_WORKER_ENDPOINT) \
		DEFAULT_VLM_PROVIDER=$(GPU_NODE_VLM) $(BIND) \
		$(COMPOSE) $(GPU) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="máy GPU, worker ở xa"

# Không kèm $(GPU): demo chạy được trên máy không có NVIDIA toolkit.
deploy-demo: setup-demo _check-public
	COMPOSE_PROFILES=demo$(HARDEN) $(BIND) $(COMPOSE) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="demo, không model"

# Kiểm điều kiện của PUBLIC=1 trước khi build, thay vì để Caddy fail sau
# 20 phút build image.
_check-public:
ifeq ($(PUBLIC),1)
	@grep -q '^DOMAIN=.\+' .env || \
		(echo "PUBLIC=1 cần DOMAIN trong .env để xin chứng chỉ TLS" && exit 1)
	@grep -q '^BASIC_AUTH_HASH=.\+' .env || \
		(echo "PUBLIC=1 cần BASIC_AUTH_HASH. Sinh bằng:" && \
		 echo "  docker run --rm caddy caddy hash-password --plaintext 'matkhau'" && exit 1)
endif

# Giữ tên cũ cho khỏi phải sửa tài liệu và thói quen: nó chỉ là deploy-full
# với lớp bọc công khai.
deploy-prod:
	@$(MAKE) --no-print-directory deploy-full PUBLIC=1

_after-up:
ifeq ($(PUBLIC),1)
	@echo ""
	@echo "Chế độ công khai: chỉ Caddy phơi 80/443. Backend, worker, vllm,"
	@echo "qdrant chỉ nghe 127.0.0.1 của host — debug bằng SSH tunnel."
endif
	@echo ""
	@echo "Kiểu triển khai: $(KIND)"
	@echo "Lần đầu mất 15-30 phút để tải model. Theo dõi: make logs-vllm"
	@echo ""
ifeq ($(PUBLIC),1)
	@echo "  Giao diện: https://$$(grep '^DOMAIN=' .env | cut -d= -f2)"
else
	@echo "  Giao diện: http://localhost:$${FRONTEND_PORT:-7860}"
endif

# --- Vận hành -----------------------------------------------------------

down:
	$(ANY) down

restart:
	$(ANY) restart

ps:
	$(ANY) ps

# Kiểm cấu hình đã hợp lệ chưa mà không chạy gì. PROFILES=... để xem kiểu khác.
PROFILES ?= $(ALL_PROFILES)

config:
	@COMPOSE_PROFILES=$(PROFILES) $(COMPOSE) $(GPU) config --services

health:
	@printf "vLLM     "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${VLLM_PORT:-3333}/v1/models 2>/dev/null || echo "không chạy"
	@printf "backend  "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${BACKEND_PORT:-2005}/health 2>/dev/null || echo "không chạy"
	@printf "worker   "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${WORKER_PORT:-2222}/health 2>/dev/null || echo "không chạy"
	@printf "qdrant   "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${QDRANT_HTTP_PORT:-6333}/healthz 2>/dev/null || echo "không chạy"
	@printf "frontend "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${FRONTEND_PORT:-7860}/ 2>/dev/null || echo "không chạy"

logs:
	$(ANY) logs -f

logs-vllm:
	$(ANY) logs -f vllm

logs-backend:
	$(ANY) logs -f backend

logs-worker:
	$(ANY) logs -f worker

logs-frontend:
	$(ANY) logs -f frontend

# --- Phát triển ---------------------------------------------------------

test:
	pytest

lint:
	ruff check backend
	cd frontend && npx tsc -b

clean:
	$(ANY) down

clean-all:
	$(ANY) down -v
	@echo "Đã xoá cả model đã tải — lần sau phải tải lại."

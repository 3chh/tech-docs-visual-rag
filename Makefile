COMPOSE   := docker compose
BASE      := -f docker-compose.yml
GPU       := -f docker-compose.gpu.yml

C_FULL    := $(COMPOSE) $(BASE) $(GPU)
C_HYBRID  := $(COMPOSE) $(BASE) -f docker-compose.hybrid.yml $(GPU)
C_WORKER  := $(COMPOSE) $(BASE) -f docker-compose.worker-node.yml $(GPU)
C_GPUNODE := $(COMPOSE) $(BASE) -f docker-compose.gpu-node.yml $(GPU)
C_DEMO    := $(COMPOSE) $(BASE) -f docker-compose.demo.yml
C_PROD    := $(COMPOSE) $(BASE) -f docker-compose.prod.yml $(GPU)

.PHONY: help setup setup-demo build pull-models \
        deploy-full deploy-hybrid deploy-worker-node deploy-gpu-node deploy-demo deploy-prod \
        down restart ps health logs logs-vllm logs-backend logs-worker logs-frontend \
        test lint clean clean-all

help:
	@echo "Cosmo ChatPDF"
	@echo ""
	@echo "  TRIỂN KHAI (xem deploy/README.md để chọn kiểu)"
	@echo "    make deploy-hybrid       GPU 16GB, VLM dùng API ngoài    <- khuyến nghị"
	@echo "    make deploy-full         Tất cả tự host, cần GPU 24GB"
	@echo "    make deploy-demo         Không model, chỉ xem giao diện"
	@echo "    make deploy-prod         Server công khai, HTTPS + xác thực"
	@echo ""
	@echo "    make deploy-worker-node  Máy A: chỉ xử lý PDF (8GB)"
	@echo "    make deploy-gpu-node     Máy B: truy xuất và trả lời (16GB+)"
	@echo ""
	@echo "  VẬN HÀNH"
	@echo "    make down  make restart  make ps  make health"
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
		echo "Đã tạo .env — điền GEMINI_API_KEY trước khi chạy")
	@grep -q '^GEMINI_API_KEY=.\+' .env || \
		(echo "GEMINI_API_KEY còn trống trong .env" && exit 1)

# Demo không gọi model nào nên không cần key.
setup-demo:
	@test -f .env || cp .env.example .env

build:
	$(COMPOSE) $(BASE) build

pull-models: setup
	@bash scripts/pull_models.sh

# --- Triển khai ---------------------------------------------------------

deploy-full: setup
	$(C_FULL) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="tất cả tự host (24GB VRAM)"

deploy-hybrid: setup
	@grep -qE '^DEFAULT_VLM_PROVIDER=(openai|gemini|custom)' .env || \
		(echo "Kiểu hybrid cần DEFAULT_VLM_PROVIDER=gemini (hoặc openai/custom) trong .env" && exit 1)
	$(C_HYBRID) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="hybrid, VLM qua API ngoài (16GB VRAM)"

deploy-worker-node: setup
	$(C_WORKER) up -d --build
	@echo ""
	@echo "Máy A đang chạy: chỉ worker xử lý PDF."
	@echo "Trên máy B chạy:"
	@echo "  BACKEND_WORKER_URL=http://<ip-may-a>:$${WORKER_PORT:-2222}/upload_pdf/ make deploy-gpu-node"

deploy-gpu-node: setup
	@test -n "$(BACKEND_WORKER_URL)" || \
		(echo "Cần BACKEND_WORKER_URL trỏ tới worker ở máy A" && exit 1)
	$(C_GPUNODE) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="máy GPU, worker ở xa"

deploy-demo: setup-demo
	$(C_DEMO) up -d --build
	@$(MAKE) --no-print-directory _after-up KIND="demo, không model"

deploy-prod: setup
	@grep -q '^DOMAIN=.\+' .env || \
		(echo "Cần DOMAIN trong .env để xin chứng chỉ TLS" && exit 1)
	$(C_PROD) up -d --build
	@echo ""
	@echo "Đang chạy chế độ production."
	@echo "Chỉ cổng 80/443 phơi ra ngoài; backend, worker, vllm, qdrant nằm trong network nội bộ."

_after-up:
	@echo ""
	@echo "Kiểu triển khai: $(KIND)"
	@echo "Lần đầu mất 15-30 phút để tải model. Theo dõi: make logs-vllm"
	@echo ""
	@echo "  Giao diện: http://localhost:$${FRONTEND_PORT:-7860}"

# --- Vận hành -----------------------------------------------------------

down:
	$(COMPOSE) $(BASE) down

restart:
	$(COMPOSE) $(BASE) restart

ps:
	$(COMPOSE) $(BASE) ps

health:
	@printf "vLLM     "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${VLLM_PORT:-3333}/v1/models 2>/dev/null || echo "không chạy"
	@printf "backend  "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${BACKEND_PORT:-2005}/health 2>/dev/null || echo "không chạy"
	@printf "worker   "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${WORKER_PORT:-2222}/health 2>/dev/null || echo "không chạy"
	@printf "qdrant   "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${QDRANT_HTTP_PORT:-6333}/healthz 2>/dev/null || echo "không chạy"
	@printf "frontend "; curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:$${FRONTEND_PORT:-7860}/ 2>/dev/null || echo "không chạy"

logs:
	$(COMPOSE) $(BASE) logs -f

logs-vllm:
	$(COMPOSE) $(BASE) logs -f vllm

logs-backend:
	$(COMPOSE) $(BASE) logs -f backend

logs-worker:
	$(COMPOSE) $(BASE) logs -f worker

logs-frontend:
	$(COMPOSE) $(BASE) logs -f frontend

# --- Phát triển ---------------------------------------------------------

test:
	pytest

lint:
	ruff check backend
	cd frontend && npx tsc -b

clean:
	$(COMPOSE) $(BASE) down

clean-all:
	$(COMPOSE) $(BASE) down -v
	@echo "Đã xoá cả model đã tải — lần sau phải tải lại."

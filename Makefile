COMPOSE      := docker compose
COMPOSE_GPU  := docker compose -f docker-compose.yml -f docker-compose.gpu.yml
COMPOSE_EXT  := docker compose -f docker-compose.yml -f docker-compose.external-vlm.yml -f docker-compose.gpu.yml
COMPOSE_UI   := docker compose -f docker-compose.yml -f docker-compose.ui-only.yml

.PHONY: help setup setup-ui build build-ui up up-ui up-gpu up-external-vlm down restart \
        logs logs-vllm logs-backend logs-frontend ps health pull-models test lint clean clean-all

help:
	@echo "Cosmo ChatPDF"
	@echo ""
	@echo "  Chạy"
	@echo "    make up-ui            Chỉ giao diện + Qdrant, KHÔNG cần GPU/model"
	@echo "    make up-gpu           Lên toàn bộ stack với GPU  <- chạy thật"
	@echo "    make up               Lên stack không cấp GPU (model sẽ rất chậm)"
	@echo "    make up-external-vlm  Lên stack, dùng VLM host sẵn ở nơi khác"
	@echo "    make down             Dừng"
	@echo "    make restart          Khởi động lại"
	@echo ""
	@echo "  Theo dõi"
	@echo "    make ps               Trạng thái service"
	@echo "    make health           Kiểm tra tất cả endpoint"
	@echo "    make logs             Log tất cả"
	@echo "    make logs-vllm        Log vLLM (xem tiến trình tải model)"
	@echo "    make logs-backend     Log backend"
	@echo ""
	@echo "  Chuẩn bị"
	@echo "    make setup            Tạo .env từ .env.example"
	@echo "    make pull-models      Tải model trước khi chạy"
	@echo "    make build            Build image"
	@echo ""
	@echo "  Phát triển"
	@echo "    make test             Chạy test (không cần GPU)"
	@echo "    make lint             Kiểm tra code style"
	@echo "    make clean            Xoá container, giữ model đã tải"
	@echo "    make clean-all        Xoá tất cả kể cả model"
	@echo ""
	@echo "  Cổng: vLLM 3333 | backend 2005 | worker 2222 | qdrant 6333 | UI 7860"

setup:
	@test -f .env || (cp .env.example .env && \
		echo "Đã tạo .env — hãy điền GEMINI_API_KEY trước khi chạy")
	@grep -q '^GEMINI_API_KEY=.\+' .env || \
		(echo "GEMINI_API_KEY còn trống trong .env" && exit 1)

# Chế độ chỉ-UI không gọi model nào nên không cần API key.
setup-ui:
	@test -f .env || cp .env.example .env

build:
	$(COMPOSE) build

build-ui:
	$(COMPOSE_UI) build frontend

up: setup
	$(COMPOSE) up -d
	@$(MAKE) --no-print-directory _after-up

up-ui: setup-ui
	$(COMPOSE_UI) up -d --build
	@echo ""
	@echo "Chỉ giao diện + Qdrant. Backend không chạy nên UI sẽ hiện"
	@echo "banner 'backend không kết nối được' — đúng như mong đợi."
	@echo ""
	@echo "  Giao diện: http://localhost:$${FRONTEND_PORT:-7860}"
	@echo "  Qdrant:    http://localhost:$${QDRANT_HTTP_PORT:-6333}/dashboard"

up-gpu: setup
	$(COMPOSE_GPU) up -d
	@$(MAKE) --no-print-directory _after-up

up-external-vlm: setup
	$(COMPOSE_EXT) up -d
	@$(MAKE) --no-print-directory _after-up

_after-up:
	@echo ""
	@echo "Đang khởi động. Lần đầu mất 15-30 phút để tải model."
	@echo ""
	@echo "  make logs-vllm    theo dõi tải model"
	@echo "  make health       kiểm tra khi xong"
	@echo ""
	@echo "  Giao diện: http://localhost:$${FRONTEND_PORT:-7860}"

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f

logs-vllm:
	$(COMPOSE) logs -f vllm

logs-backend:
	$(COMPOSE) logs -f backend

ps:
	$(COMPOSE) ps

health:
	@echo "vLLM     $$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$${VLLM_PORT:-3333}/v1/models 2>/dev/null || echo 'không phản hồi')"
	@echo "backend  $$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$${BACKEND_PORT:-2005}/health 2>/dev/null || echo 'không phản hồi')"
	@echo "worker   $$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$${WORKER_PORT:-2222}/health 2>/dev/null || echo 'không phản hồi')"
	@echo "qdrant   $$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$${QDRANT_HTTP_PORT:-6333}/healthz 2>/dev/null || echo 'không phản hồi')"
	@echo "frontend $$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$${FRONTEND_PORT:-7860}/ 2>/dev/null || echo 'không phản hồi')"

# Tải model vào volume trước để container không phải chờ lúc khởi động.
pull-models: setup
	@bash scripts/pull_models.sh

test:
	pytest

lint:
	ruff check backend frontend

clean:
	$(COMPOSE) down

clean-all:
	$(COMPOSE) down -v
	@echo "Đã xoá cả model đã tải — lần chạy sau phải tải lại."

logs-frontend:
	$(COMPOSE) logs -f frontend

.PHONY: help setup build up up-gpu down logs ps clean test lint

help:
	@echo "Cosmo ChatPDF"
	@echo ""
	@echo "  make setup     Tạo .env từ .env.example"
	@echo "  make build     Build toàn bộ image"
	@echo "  make up        Chạy stack (CPU)"
	@echo "  make up-gpu    Chạy stack với GPU"
	@echo "  make down      Dừng stack"
	@echo "  make logs      Xem log"
	@echo "  make ps        Trạng thái service"
	@echo "  make test      Chạy test backend"
	@echo "  make lint      Kiểm tra code style"
	@echo "  make clean     Xoá container và volume"

setup:
	@test -f .env || (cp .env.example .env && echo "Đã tạo .env — hãy điền GEMINI_API_KEY và VLM_ENDPOINT")

build:
	docker compose build

up: setup
	docker compose up -d

up-gpu: setup
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

test:
	cd backend && python -m pytest tests/ -v

lint:
	ruff check backend frontend

clean:
	docker compose down -v

#!/usr/bin/env bash
# Tải model vào volume hf-cache trước, để container không phải chờ lúc khởi động.
#
#   make pull-models
#
# Chạy trong container tạm nên máy host không cần cài python hay huggingface-hub.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

VLM_MODEL_NAME="${VLM_MODEL_NAME:-OpenGVLab/InternVL3-8B}"
EMBEDDING_MODEL_NAME="${EMBEDDING_MODEL_NAME:-tsystems/colqwen2.5-3b-multilingual-v1.0}"
HF_TOKEN="${HUGGING_FACE_HUB_TOKEN:-}"

# Khớp với `name: cosmo` trong docker-compose.yml.
VOLUME_NAME="cosmo_hf-cache"
docker volume create "$VOLUME_NAME" >/dev/null

echo "Tải model vào volume $VOLUME_NAME"
echo "  VLM:       $VLM_MODEL_NAME"
echo "  Embedding: $EMBEDDING_MODEL_NAME"
echo ""
echo "Lần đầu có thể mất 15-30 phút tuỳ mạng và kích thước model."
echo ""

docker run --rm \
    -v "$VOLUME_NAME:/root/.cache/huggingface" \
    -e "HUGGING_FACE_HUB_TOKEN=$HF_TOKEN" \
    -e "VLM_MODEL_NAME=$VLM_MODEL_NAME" \
    -e "EMBEDDING_MODEL_NAME=$EMBEDDING_MODEL_NAME" \
    python:3.11-slim \
    bash -c '
        set -e
        pip install --quiet --no-cache-dir "huggingface_hub[cli]"
        for model in "$VLM_MODEL_NAME" "$EMBEDDING_MODEL_NAME"; do
            echo ""
            echo "=== $model ==="
            hf download "$model" || huggingface-cli download "$model"
        done
    '

echo ""
echo "Xong. Model đã nằm trong volume, chạy 'make up-gpu' sẽ khởi động nhanh."
echo "PaddleOCR và PP-DocLayout tự tải lần đầu worker chạy (~1GB, không tải trước được)."

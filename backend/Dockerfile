# API service: nạp ColQwen để embed ảnh-mục và truy vấn.
# Cần GPU khi chạy thật (EMBEDDING_DEVICE=cuda).
#
# Dùng image torch chính thức thay vì "cuda base + pip install torch": GPU
# Blackwell (RTX 5090, sm_120) cần torch build với CUDA 12.8. Bản cu121 chỉ có
# kernel tới sm_90 và chết ngay với "no kernel image is available for execution
# on the device" — đã kiểm trên máy thật.
FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    HF_HOME=/data/.cache/huggingface

# curl cho HEALTHCHECK; image torch không có sẵn.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid app --create-home app

# torch đã nằm trong base image nên requirements.txt không cài lại.
COPY requirements-base.txt requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app . ./backend/
RUN touch /srv/__init__.py && chown app:app /srv/__init__.py && \
    mkdir -p /data && chown -R app:app /data

USER app

ENV DATA_DIR=/data \
    METADATA_DIR=/data/metadata \
    CONFIG_PATH=/srv/backend/config/config.yaml

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# API service: nạp ColQwen để embed ảnh-mục và truy vấn.
# Cần GPU khi chạy thật (EMBEDDING_DEVICE=cuda).
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    HF_HOME=/data/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3.11-dev python3-pip \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3

WORKDIR /srv

RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid app --create-home app

# torch cài riêng trước để tận dụng cache: nó nặng và hiếm khi đổi version.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cu121

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

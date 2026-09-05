# Frontend chỉ gọi HTTP nên dùng base slim, không cần CUDA.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

RUN groupadd --gid 1000 app && \
    useradd --uid 1000 --gid app --create-home app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=app:app . ./frontend/
RUN touch /srv/__init__.py && chown app:app /srv/__init__.py

USER app

ENV GRADIO_SERVER_NAME=0.0.0.0 \
    FRONTEND_PORT=7860

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/').read()" || exit 1

CMD ["python", "-m", "frontend.app.main"]

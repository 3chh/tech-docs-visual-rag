"""Entrypoint API service.

Chạy: uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..core.config import get_settings
from ..core.logging import get_logger, setup_logging
from . import __version__
from .api.routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.log_level)
    logger = get_logger(__name__)

    logger.info("Khởi động Cosmo ChatPDF API v%s", __version__)
    logger.info("Vector DB: %s @ %s", settings.database.type, settings.database.uri)
    logger.info("Embedding: %s (%s)", settings.embedding.type, settings.embedding.model_name)
    logger.info("PDF worker: %s", settings.document.worker_endpoint)
    settings.paths.metadata_dir.mkdir(parents=True, exist_ok=True)

    yield

    logger.info("Tắt Cosmo ChatPDF API")


app = FastAPI(
    title="Cosmo ChatPDF API",
    description="Visual RAG cấp mục trên tài liệu PDF scan",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

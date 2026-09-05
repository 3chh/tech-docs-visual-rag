"""Entrypoint PDF worker.

Tách khỏi API service vì hai bên nạp model khác nhau: worker giữ PaddleOCR +
layout detection, API giữ ColQwen. Gộp chung một tiến trình sẽ hết VRAM.

Chạy: uvicorn backend.worker.main:app --host 0.0.0.0 --port 8001
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from ..core.config import get_settings
from ..core.logging import get_logger, setup_logging
from .routes import router

__version__ = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.log_level)
    logger = get_logger(__name__)

    logger.info("Khởi động PDF worker v%s", __version__)
    logger.info("Layout model: %s", settings.document.element_detector.model_name)
    logger.info("Text detection: %s", settings.document.preprocess_pdf.text_model)
    logger.info("ToC validator: %s", settings.document.llm_validator.model_name)

    yield

    logger.info("Tắt PDF worker")


app = FastAPI(
    title="Cosmo ChatPDF — PDF Worker",
    description="Xử lý PDF scan thành ảnh-mục kèm metadata",
    version=__version__,
    lifespan=lifespan,
)

app.include_router(router)

"""Route của PDF worker."""

import threading
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import get_settings
from ..core.logging import get_logger
from ..document import PdfManager

logger = get_logger(__name__)
router = APIRouter(tags=["worker"])

_pdf_manager: PdfManager | None = None
_lock = threading.Lock()


def get_pdf_manager() -> PdfManager:
    """Singleton — layout model và OCR model nạp một lần cho cả tiến trình."""
    global _pdf_manager
    if _pdf_manager is not None:
        return _pdf_manager

    with _lock:
        if _pdf_manager is None:
            settings = get_settings()
            # PdfManager nhận dict để giữ nguyên code pipeline; Settings chỉ là
            # lớp validate ở ngoài.
            _pdf_manager = PdfManager(settings.document.model_dump(by_alias=True))
    return _pdf_manager


class UploadRequest(BaseModel):
    id: str
    pdf_path: str
    custom_config: Optional[dict] = None


class UploadResponse(BaseModel):
    message: str
    metadatas: list[dict[str, Any]]


@router.post("/upload_pdf/", response_model=UploadResponse)
async def upload_pdf(request: UploadRequest) -> UploadResponse:
    """Xử lý một PDF thành các ảnh-mục.

    `custom_config` nhận `max_pages` và `vertical_split`.
    """
    logger.info(
        "Xử lý PDF | id=%s path=%s config=%s",
        request.id,
        request.pdf_path,
        request.custom_config,
    )
    try:
        manager = get_pdf_manager()
        full_metadatas = manager.process_with_corrected_summary(
            output_dir=request.id,
            pdf_path=request.pdf_path,
            custom_config=request.custom_config or {},
        )
        logger.info("Đã tạo %d ảnh-mục", len(full_metadatas))
        return UploadResponse(
            message=f"Đã xử lý PDF thành {len(full_metadatas)} mục",
            metadatas=full_metadatas,
        )
    except Exception as e:
        logger.exception("Lỗi xử lý PDF %s", request.pdf_path)
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý PDF: {e}") from e


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "cosmo-chatpdf-worker"}

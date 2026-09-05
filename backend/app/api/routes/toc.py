"""Endpoint mục lục tổng hợp của collection."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ....core.logging import get_logger
from ...services.toc import generate_and_save, load_table_of_content

logger = get_logger(__name__)
router = APIRouter(tags=["toc"])


@router.get("/table_of_contents")
async def get_table_of_contents(collection_name: str = Query(...)) -> dict[str, Any]:
    """Đọc mục lục đã sinh của một collection."""
    logger.info("Lấy mục lục cho collection %s", collection_name)

    toc = load_table_of_content(collection_name)
    if toc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Chưa có mục lục cho collection: {collection_name}",
        )
    return toc


@router.post("/table_of_contents/regenerate")
async def regenerate_table_of_contents(collection_name: str = Query(...)) -> dict[str, Any]:
    """Sinh lại mục lục — dùng khi metadata trên đĩa đã đổi mà chưa index lại."""
    try:
        return generate_and_save(collection_name)
    except Exception as e:
        logger.exception("Không sinh lại được mục lục cho %s", collection_name)
        raise HTTPException(status_code=500, detail=str(e)) from e

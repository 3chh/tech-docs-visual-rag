"""Endpoint tìm kiếm ảnh-mục."""

from fastapi import APIRouter, HTTPException

from ....core.logging import get_logger
from ...schemas import (
    SearchBySectionTitleRequest,
    SearchImageRequest,
    SearchRequest,
    SearchResponse,
    SearchResult,
)
from ...services.images import encode_chunk_images, encode_image_base64
from ...services.retrieval import RetrievalService

logger = get_logger(__name__)
router = APIRouter(tags=["search"])


def _to_result(payload: dict, include_base64: bool) -> SearchResult:
    """Chuyển payload từ vector DB thành response, kèm ảnh nếu được yêu cầu."""
    image_path = payload.get("image_path", "")
    return SearchResult(
        section_title=payload.get("section_title", ""),
        formulas=payload.get("formulas", []),
        section_pages=payload.get("section_pages", []),
        ancestors=payload.get("ancestors", []),
        metadata=payload.get("metadata") or {},
        image_path=image_path,
        image_base64=encode_image_base64(image_path) if include_base64 and image_path else None,
        chunk_images=encode_chunk_images(payload.get("chunk_images_dir")) if include_base64 else [],
    )


@router.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest) -> SearchResponse:
    """Tìm kiếm nhanh, không kèm dữ liệu ảnh."""
    logger.info("Search | user=%s query=%r top_k=%d", request.user_id, request.query, request.top_k)
    try:
        service = RetrievalService(request.user_id)
        search_results = service.search([request.query], request.top_k)

        payloads = search_results[0][: request.top_k] if search_results else []
        results = [_to_result(p, include_base64=False) for p in payloads if isinstance(p, dict)]

        return SearchResponse(
            user_id=request.user_id,
            query=request.query,
            top_k=request.top_k,
            results=results,
            total_results=len(results),
        )
    except Exception as e:
        logger.exception("Search thất bại cho user %s", request.user_id)
        raise HTTPException(status_code=500, detail=f"Search failed: {e}") from e


@router.post("/search_with_images", response_model=SearchResponse)
async def search_with_images(request: SearchImageRequest) -> SearchResponse:
    """Tìm kiếm kèm ảnh-mục dạng base64."""
    logger.info(
        "Search+images | user=%s query=%r top_k=%d", request.user_id, request.query, request.top_k
    )
    try:
        service = RetrievalService(request.user_id)
        search_results = service.search([request.query], request.top_k)

        payloads = search_results[0][: request.top_k] if search_results else []
        results = [
            _to_result(p, include_base64=request.include_base64)
            for p in payloads
            if isinstance(p, dict)
        ]

        return SearchResponse(
            user_id=request.user_id,
            query=request.query,
            top_k=request.top_k,
            results=results,
            total_results=len(results),
        )
    except Exception as e:
        logger.exception("Search with images thất bại cho user %s", request.user_id)
        raise HTTPException(status_code=500, detail=f"Search failed: {e}") from e


@router.post("/search_by_section_title", response_model=SearchResponse)
async def search_by_section_title(request: SearchBySectionTitleRequest) -> SearchResponse:
    """Lọc theo tên mục.

    Dùng chủ yếu với `noname` — mục chứa bìa và mục lục.
    """
    logger.info(
        "Search theo tiêu đề | user=%s section=%r limit=%d collection=%s",
        request.user_id,
        request.section_title,
        request.limit,
        request.collection_name,
    )
    try:
        service = RetrievalService(request.user_id)
        payloads = service.search_by_section_title(
            request.section_title, request.limit, request.collection_name
        )

        results = [
            _to_result(p, include_base64=request.include_base64)
            for p in (payloads or [])
            if isinstance(p, dict)
        ]

        return SearchResponse(
            user_id=request.user_id,
            query=f"section_title:{request.section_title}",
            top_k=len(results),
            results=results,
            total_results=len(results),
        )
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e)) from e
    except Exception as e:
        logger.exception("Search theo tiêu đề thất bại cho user %s", request.user_id)
        raise HTTPException(status_code=500, detail=f"Search by section title failed: {e}") from e


# --- Endpoint tương thích ngược ---------------------------------------------
# Bản cũ hardcode collection "default". Giữ lại để client cũ không gãy; code mới
# nên dùng /search và /search_with_images với user_id tường minh.

DEFAULT_COLLECTION = "default"


class _LegacySearchRequest(SearchRequest):
    user_id: str = DEFAULT_COLLECTION


@router.post("/search_default", response_model=SearchResponse, deprecated=True)
async def search_default(request: _LegacySearchRequest) -> SearchResponse:
    """Không dùng cho code mới — hãy gọi /search với user_id."""
    return await search_documents(request)


class _LegacySearchImageRequest(SearchImageRequest):
    user_id: str = DEFAULT_COLLECTION


@router.post("/search_default_base64", response_model=SearchResponse, deprecated=True)
async def search_default_base64(request: _LegacySearchImageRequest) -> SearchResponse:
    """Không dùng cho code mới — hãy gọi /search_with_images với user_id."""
    return await search_with_images(request)

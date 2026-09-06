"""Endpoint hỏi đáp: truy xuất rồi để VLM đọc ảnh và trả lời."""

from fastapi import APIRouter, HTTPException

from ....core.logging import get_logger
from ...schemas.chat import AskRequest, AskResponse
from ...services.rag import RagService
from .search import _to_result

logger = get_logger(__name__)
router = APIRouter(tags=["chat"])


@router.post("/ask", response_model=AskResponse)
async def ask(request: AskRequest) -> AskResponse:
    """Trả lời câu hỏi kèm các mục nguồn.

    VLM chạy phía backend nên API key không đi ra trình duyệt.
    """
    logger.info(
        "Ask | collection=%s query=%r top_k=%d rewrite=%s",
        request.user_id,
        request.query,
        request.top_k,
        request.use_toc_rewrite,
    )
    try:
        service = RagService(request.user_id, connection_id=request.connection_id)
        result = service.ask(
            query=request.query,
            top_k=request.top_k,
            system_prompt=request.system_prompt,
            use_toc_rewrite=request.use_toc_rewrite,
            toc_preview_limit=request.toc_preview_limit,
            vlm_temperature=request.vlm_temperature,
        )

        sources = [
            _to_result(p, include_base64=request.include_base64)
            for p in result["payloads"]
            if isinstance(p, dict)
        ]

        return AskResponse(
            query=request.query,
            answer=result["answer"],
            rewritten_query=result["rewritten_query"],
            sources=sources,
            total_sources=len(sources),
            connection_id=result.get("connection_id"),
            model_name=result.get("model_name"),
        )
    except ValueError as e:
        # Bộ chưa cấu hình, kết nối không tồn tại, hoặc kết nối thiếu key:
        # đều là lỗi của người gọi, không phải lỗi server.
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Ask thất bại cho collection %s", request.user_id)
        raise HTTPException(status_code=500, detail=f"Ask failed: {e}") from e

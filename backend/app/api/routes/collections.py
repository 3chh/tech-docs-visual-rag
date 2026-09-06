"""Tạo và cấu hình bộ tài liệu.

Bộ phải được cấu hình (chọn mô hình) trước khi thêm tài liệu vào. Đó là lý do
endpoint tạo bộ bắt buộc có `vlm_connection_id` và `llm_connection_id`.
"""

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..errors import (
    COLLECTION_EXISTS,
    COLLECTION_NOT_FOUND,
    CONNECTION_INVALID,
    INVALID_NAME,
    NO_MODELS_CONFIGURED,
    api_error,
)

from ....core.collections import (
    CollectionExists,
    InvalidCollectionName,
    create_collection,
    delete_config,
    list_configured,
    load_config,
    save_config,
)
from ....core.logging import get_logger
from ...schemas.overrides import AskOverrides, ProcessingOverrides
from ....core.providers import (
    ConnectionNotFound,
    ConnectionNotUsable,
    resolve_connection,
)

logger = get_logger(__name__)
router = APIRouter(tags=["collections"])


class CollectionOut(BaseModel):
    name: str
    description: str
    vlm_connection_id: str
    llm_connection_id: str
    created_at: str
    updated_at: str
    processing: dict[str, Any] = Field(default_factory=dict)
    #: Mặc định hỏi đáp của bộ.
    ask: dict[str, Any] = Field(default_factory=dict)
    #: Cả hai kết nối còn dùng được không. False nghĩa là cần chọn lại mô hình.
    is_ready: bool = True
    #: Vì sao chưa dùng được, nếu is_ready là False.
    blocked_reason: Optional[str] = None


class CollectionListResponse(BaseModel):
    collections: list[CollectionOut]
    #: Đã có kết nối nào dùng được chưa. False thì UI phải dẫn người dùng
    #: sang phần Cấu hình trước khi cho tạo bộ.
    can_create: bool
    #: Loại mô hình còn thiếu ("vlm", "llm"), để UI nói rõ cần thêm cái gì.
    missing_capabilities: list[str] = Field(default_factory=list)


class CreateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=63)
    vlm_connection_id: str = Field(min_length=1)
    llm_connection_id: str = Field(min_length=1)
    description: str = ""
    processing: ProcessingOverrides = Field(default_factory=ProcessingOverrides)
    ask: AskOverrides = Field(default_factory=AskOverrides)


class UpdateCollectionRequest(BaseModel):
    vlm_connection_id: Optional[str] = None
    llm_connection_id: Optional[str] = None
    description: Optional[str] = None
    processing: Optional[ProcessingOverrides] = None
    ask: Optional[AskOverrides] = None


def _to_out(config) -> CollectionOut:
    """Kiểm cả hai kết nối để UI biết bộ này còn dùng được không."""
    blocked: Optional[str] = None

    for connection_id, capability, label in (
        (config.vlm_connection_id, "vlm", "trả lời"),
        (config.llm_connection_id, "llm", "sửa mục lục"),
    ):
        try:
            resolve_connection(connection_id, capability)
        except (ConnectionNotFound, ConnectionNotUsable) as e:
            blocked = f"Mô hình {label}: {e}"
            break

    return CollectionOut(
        name=config.name,
        description=config.description,
        vlm_connection_id=config.vlm_connection_id,
        llm_connection_id=config.llm_connection_id,
        created_at=config.created_at,
        updated_at=config.updated_at,
        processing=config.processing,
        ask=config.ask,
        is_ready=blocked is None,
        blocked_reason=blocked,
    )


def _missing_capabilities() -> list[str]:
    """Loại mô hình còn thiếu. Rỗng nghĩa là tạo bộ được."""
    from ....core.providers import has_usable_connection

    return [c for c in ("vlm", "llm") if not has_usable_connection(c)]


@router.get("/collections", response_model=CollectionListResponse)
async def list_collections_configured() -> CollectionListResponse:
    return CollectionListResponse(
        collections=[_to_out(c) for c in list_configured()],
        can_create=not _missing_capabilities(),
        missing_capabilities=_missing_capabilities(),
    )


@router.post("/collections", response_model=CollectionOut, status_code=201)
async def create_new_collection(request: CreateCollectionRequest) -> CollectionOut:
    """Tạo bộ tài liệu mới.

    Hai kết nối được kiểm ngay lúc tạo, để người dùng không phát hiện sai sót
    sau khi đã chờ 20 phút index xong.
    """
    missing = _missing_capabilities()
    if missing:
        raise api_error(
            409,
            NO_MODELS_CONFIGURED,
            "Chưa có mô hình nào dùng được. Vào Cấu hình thêm ít nhất một mô hình "
            "cho mỗi loại trước khi tạo bộ tài liệu.",
            missing_capabilities=missing,
        )

    try:
        resolve_connection(request.vlm_connection_id, "vlm")
        resolve_connection(request.llm_connection_id, "llm")
    except (ConnectionNotFound, ConnectionNotUsable) as e:
        raise api_error(400, CONNECTION_INVALID, str(e)) from e

    try:
        config = create_collection(
            name=request.name,
            vlm_connection_id=request.vlm_connection_id,
            llm_connection_id=request.llm_connection_id,
            description=request.description,
            processing=request.processing.model_dump(exclude_none=True),
            ask=request.ask.model_dump(exclude_none=True),
        )
    except InvalidCollectionName as e:
        raise api_error(422, INVALID_NAME, str(e)) from e
    except CollectionExists as e:
        raise api_error(409, COLLECTION_EXISTS, str(e)) from e

    return _to_out(config)


@router.get("/collections/{name}", response_model=CollectionOut)
async def get_collection(name: str) -> CollectionOut:
    config = load_config(name)
    if config is None:
        raise api_error(
            404,
            COLLECTION_NOT_FOUND,
            f"Bộ '{name}' chưa được cấu hình. Tạo bộ trước khi dùng.",
        )
    return _to_out(config)


@router.put("/collections/{name}", response_model=CollectionOut)
async def update_collection(name: str, request: UpdateCollectionRequest) -> CollectionOut:
    config = load_config(name)
    if config is None:
        raise api_error(404, COLLECTION_NOT_FOUND, f"Bộ '{name}' chưa được cấu hình.")

    if request.vlm_connection_id is not None:
        try:
            resolve_connection(request.vlm_connection_id, "vlm")
        except (ConnectionNotFound, ConnectionNotUsable) as e:
            raise api_error(400, CONNECTION_INVALID, str(e)) from e
        config.vlm_connection_id = request.vlm_connection_id

    if request.llm_connection_id is not None:
        try:
            resolve_connection(request.llm_connection_id, "llm")
        except (ConnectionNotFound, ConnectionNotUsable) as e:
            raise api_error(400, CONNECTION_INVALID, str(e)) from e
        config.llm_connection_id = request.llm_connection_id

    if request.description is not None:
        config.description = request.description.strip()
    if request.processing is not None:
        config.processing = request.processing.model_dump(exclude_none=True)
    if request.ask is not None:
        config.ask = request.ask.model_dump(exclude_none=True)

    return _to_out(save_config(config))


@router.delete("/collections/{name}")
async def delete_collection_config(name: str) -> dict[str, str]:
    """Xoá cấu hình bộ. Tài liệu đã index vẫn còn trong vector DB."""
    if not delete_config(name):
        raise api_error(404, COLLECTION_NOT_FOUND, f"Bộ '{name}' chưa được cấu hình.")

    return {
        "status": "deleted",
        "note": "Cấu hình đã xoá. Tài liệu đã index vẫn còn trong vector DB.",
    }

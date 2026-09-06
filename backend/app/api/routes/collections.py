"""Tạo và cấu hình bộ tài liệu.

Bộ phải được cấu hình (chọn mô hình) trước khi thêm tài liệu vào. Đó là lý do
endpoint tạo bộ bắt buộc có `vlm_connection_id` và `llm_connection_id`.
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
    #: Cả hai kết nối còn dùng được không. False nghĩa là cần chọn lại mô hình.
    is_ready: bool = True
    #: Vì sao chưa dùng được, nếu is_ready là False.
    blocked_reason: Optional[str] = None


class CollectionListResponse(BaseModel):
    collections: list[CollectionOut]
    #: Đã có kết nối nào dùng được chưa. False thì UI phải dẫn người dùng
    #: sang phần Cấu hình trước khi cho tạo bộ.
    can_create: bool


class CreateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=63)
    vlm_connection_id: str = Field(min_length=1)
    llm_connection_id: str = Field(min_length=1)
    description: str = ""
    processing: dict[str, Any] = Field(default_factory=dict)


class UpdateCollectionRequest(BaseModel):
    vlm_connection_id: Optional[str] = None
    llm_connection_id: Optional[str] = None
    description: Optional[str] = None
    processing: Optional[dict[str, Any]] = None


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
        is_ready=blocked is None,
        blocked_reason=blocked,
    )


def _can_create() -> bool:
    from ....core.providers import has_usable_connection

    return has_usable_connection("vlm") and has_usable_connection("llm")


@router.get("/collections", response_model=CollectionListResponse)
async def list_collections_configured() -> CollectionListResponse:
    return CollectionListResponse(
        collections=[_to_out(c) for c in list_configured()],
        can_create=_can_create(),
    )


@router.post("/collections", response_model=CollectionOut, status_code=201)
async def create_new_collection(request: CreateCollectionRequest) -> CollectionOut:
    """Tạo bộ tài liệu mới.

    Hai kết nối được kiểm ngay lúc tạo, để người dùng không phát hiện sai sót
    sau khi đã chờ 20 phút index xong.
    """
    try:
        resolve_connection(request.vlm_connection_id, "vlm")
        resolve_connection(request.llm_connection_id, "llm")
    except (ConnectionNotFound, ConnectionNotUsable) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        config = create_collection(
            name=request.name,
            vlm_connection_id=request.vlm_connection_id,
            llm_connection_id=request.llm_connection_id,
            description=request.description,
            processing=request.processing,
        )
    except InvalidCollectionName as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except CollectionExists as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return _to_out(config)


@router.get("/collections/{name}", response_model=CollectionOut)
async def get_collection(name: str) -> CollectionOut:
    config = load_config(name)
    if config is None:
        raise HTTPException(
            status_code=404,
            detail=f"Bộ '{name}' chưa được cấu hình. Tạo bộ trước khi dùng.",
        )
    return _to_out(config)


@router.put("/collections/{name}", response_model=CollectionOut)
async def update_collection(name: str, request: UpdateCollectionRequest) -> CollectionOut:
    config = load_config(name)
    if config is None:
        raise HTTPException(status_code=404, detail=f"Bộ '{name}' chưa được cấu hình.")

    if request.vlm_connection_id is not None:
        try:
            resolve_connection(request.vlm_connection_id, "vlm")
        except (ConnectionNotFound, ConnectionNotUsable) as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        config.vlm_connection_id = request.vlm_connection_id

    if request.llm_connection_id is not None:
        try:
            resolve_connection(request.llm_connection_id, "llm")
        except (ConnectionNotFound, ConnectionNotUsable) as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        config.llm_connection_id = request.llm_connection_id

    if request.description is not None:
        config.description = request.description.strip()
    if request.processing is not None:
        config.processing = request.processing

    return _to_out(save_config(config))


@router.delete("/collections/{name}")
async def delete_collection_config(name: str) -> dict[str, str]:
    """Xoá cấu hình bộ. Tài liệu đã index vẫn còn trong vector DB."""
    if not delete_config(name):
        raise HTTPException(status_code=404, detail=f"Bộ '{name}' chưa được cấu hình.")

    return {
        "status": "deleted",
        "note": "Cấu hình đã xoá. Tài liệu đã index vẫn còn trong vector DB.",
    }

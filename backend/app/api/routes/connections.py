"""Quản lý kết nối mô hình do người dùng cấu hình.

Không endpoint nào trả về API key gốc. Đọc lên chỉ được bản che
(`sk-proj-••••4f2a`); muốn đổi thì nhập lại từ đầu.
"""

from typing import Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..errors import (
    CONNECTION_NOT_FOUND,
    DUPLICATE_NAME,
    MISSING_API_KEY,
    MISSING_ENDPOINT,
    api_error,
)

from ....core.connections import (
    DEFAULT_ENDPOINTS,
    PROVIDERS_WITHOUT_KEY,
    DuplicateNameError,
    get_connection_store,
)
from ....core.crypto import is_encryption_enabled
from ....core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["connections"])

ProviderKind = Literal["openai", "gemini", "vllm", "custom"]
Capability = Literal["vlm", "llm"]


class ConnectionOut(BaseModel):
    """Bản gửi ra client. Không có api_key."""

    id: str
    name: str
    provider: str
    endpoint: str
    model_name: str
    capabilities: list[str]
    #: Bản che của key, ví dụ `sk-proj-••••4f2a`.
    masked_key: Optional[str] = None
    has_key: bool
    created_at: str
    updated_at: str

    model_config = {"protected_namespaces": ()}


class ConnectionListResponse(BaseModel):
    connections: list[ConnectionOut]
    #: Key trên đĩa có được mã hoá không.
    encryption_enabled: bool
    #: Endpoint gợi ý theo từng nhà cung cấp, để UI điền sẵn.
    default_endpoints: dict[str, str]
    #: Nhà cung cấp không cần API key.
    providers_without_key: list[str]


class CreateConnectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    provider: ProviderKind
    model_name: str = Field(min_length=1, max_length=200)
    capabilities: list[Capability] = Field(min_length=1)
    api_key: Optional[str] = Field(default=None, min_length=8)
    endpoint: Optional[str] = None

    model_config = {"protected_namespaces": ()}


class UpdateConnectionRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    model_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    capabilities: Optional[list[Capability]] = Field(default=None, min_length=1)
    #: Bỏ trống để giữ key hiện tại.
    api_key: Optional[str] = Field(default=None, min_length=8)
    endpoint: Optional[str] = None

    model_config = {"protected_namespaces": ()}


def _list_response() -> ConnectionListResponse:
    store = get_connection_store()
    return ConnectionListResponse(
        connections=[ConnectionOut(**vars(c.masked())) for c in store.list_all()],
        encryption_enabled=is_encryption_enabled(),
        default_endpoints=dict(DEFAULT_ENDPOINTS),
        providers_without_key=sorted(PROVIDERS_WITHOUT_KEY),
    )


@router.get("/connections", response_model=ConnectionListResponse)
async def list_connections() -> ConnectionListResponse:
    """Danh sách kết nối kèm bản che của key. Không trả key gốc."""
    return _list_response()


@router.post("/connections", response_model=ConnectionListResponse, status_code=201)
async def create_connection(request: CreateConnectionRequest) -> ConnectionListResponse:
    if request.provider not in PROVIDERS_WITHOUT_KEY and not request.api_key:
        raise api_error(
            400, MISSING_API_KEY, f"Nhà cung cấp '{request.provider}' cần API key."
        )

    endpoint = (request.endpoint or DEFAULT_ENDPOINTS.get(request.provider, "")).strip()
    if not endpoint:
        raise api_error(
            400,
            MISSING_ENDPOINT,
            "Cần endpoint. Nhà cung cấp custom không có endpoint mặc định.",
        )

    try:
        get_connection_store().create(
            name=request.name,
            provider=request.provider,
            model_name=request.model_name,
            capabilities=list(request.capabilities),
            api_key=request.api_key,
            endpoint=endpoint,
        )
    except DuplicateNameError as e:
        raise api_error(409, DUPLICATE_NAME, str(e)) from e

    return _list_response()


@router.put("/connections/{connection_id}", response_model=ConnectionListResponse)
async def update_connection(
    connection_id: str, request: UpdateConnectionRequest
) -> ConnectionListResponse:
    """Chỉ cập nhật trường được truyền. Bỏ trống api_key để giữ key cũ."""
    try:
        updated = get_connection_store().update(
            connection_id,
            name=request.name,
            model_name=request.model_name,
            endpoint=request.endpoint,
            capabilities=list(request.capabilities) if request.capabilities else None,
            api_key=request.api_key,
        )
    except DuplicateNameError as e:
        raise api_error(409, DUPLICATE_NAME, str(e)) from e

    if updated is None:
        raise api_error(404, CONNECTION_NOT_FOUND, f"Không có kết nối '{connection_id}'")

    return _list_response()


@router.delete("/connections/{connection_id}", response_model=ConnectionListResponse)
async def delete_connection(connection_id: str) -> ConnectionListResponse:
    """Xoá kết nối.

    Bộ tài liệu đang trỏ tới kết nối này sẽ báo lỗi lúc tra cứu và cần chọn
    lại mô hình. Không tự dọn hộ vì người dùng có thể muốn trỏ sang kết nối
    khác chứ không phải bỏ bộ tài liệu.
    """
    if not get_connection_store().delete(connection_id):
        raise api_error(404, CONNECTION_NOT_FOUND, f"Không có kết nối '{connection_id}'")

    return _list_response()

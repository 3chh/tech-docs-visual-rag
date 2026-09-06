"""Endpoint lưu API key người dùng nhập trên giao diện.

Quy tắc bất di bất dịch: **không endpoint nào trả về key gốc.** Đọc lên chỉ
được bản che. Muốn đổi key thì nhập lại từ đầu, không có chức năng "xem key".
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ....core.credentials import get_credential_store
from ....core.logging import get_logger
from ....core.providers import list_vlm_providers

logger = get_logger(__name__)
router = APIRouter(tags=["credentials"])

# builtin không cần key nên không cho lưu.
STORABLE_PROVIDERS = {"openai", "gemini", "custom"}


class SaveCredentialRequest(BaseModel):
    api_key: str = Field(min_length=8, description="Key gốc, chỉ đi một chiều lên server")
    model_name: str | None = None
    endpoint: str | None = None

    model_config = {"protected_namespaces": ()}


class CredentialStatus(BaseModel):
    provider_id: str
    is_configured: bool
    #: Bản che, ví dụ `sk-proj-••••4f2a`. Không bao giờ là key gốc.
    masked_key: str | None = None
    #: "ui" nếu người dùng nhập, "env" nếu từ biến môi trường.
    key_source: str
    #: Key từ env thì không xoá được trên giao diện.
    can_delete: bool
    model_name: str | None = None
    endpoint: str | None = None

    model_config = {"protected_namespaces": ()}


class CredentialListResponse(BaseModel):
    credentials: list[CredentialStatus]
    #: Key trên đĩa có được mã hoá không. False nghĩa là chưa đặt CREDENTIALS_SECRET.
    encryption_enabled: bool


def _status_for_all() -> CredentialListResponse:
    store = get_credential_store()
    return CredentialListResponse(
        encryption_enabled=store.is_encrypted,
        credentials=[
            CredentialStatus(
                provider_id=p.id,
                is_configured=p.is_configured,
                masked_key=p.masked_key,
                key_source=p.key_source,
                can_delete=p.key_source == "ui",
                model_name=p.model_name or None,
                endpoint=p.endpoint or None,
            )
            for p in list_vlm_providers()
        ],
    )


@router.get("/credentials", response_model=CredentialListResponse)
async def list_credentials() -> CredentialListResponse:
    """Provider nào đã có key, kèm bản che. Không trả key gốc."""
    return _status_for_all()


@router.put("/credentials/{provider_id}", response_model=CredentialListResponse)
async def save_credential(
    provider_id: str, request: SaveCredentialRequest
) -> CredentialListResponse:
    """Lưu key cho một provider.

    Key được mã hoá trước khi ghi đĩa nếu đã đặt CREDENTIALS_SECRET. Response
    chỉ chứa bản che.
    """
    if provider_id not in STORABLE_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Provider '{provider_id}' không nhận key. "
                f"Chỉ: {', '.join(sorted(STORABLE_PROVIDERS))}"
            ),
        )

    if provider_id == "custom" and not (request.endpoint or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Provider custom cần endpoint.",
        )

    store = get_credential_store()
    store.set(
        provider_id,
        api_key=request.api_key.strip(),
        model_name=(request.model_name or "").strip() or None,
        endpoint=(request.endpoint or "").strip() or None,
    )

    if not store.is_encrypted:
        logger.warning(
            "Đã lưu key cho %s nhưng chưa bật mã hoá at-rest (thiếu CREDENTIALS_SECRET)",
            provider_id,
        )

    return _status_for_all()


@router.delete("/credentials/{provider_id}", response_model=CredentialListResponse)
async def delete_credential(provider_id: str) -> CredentialListResponse:
    """Xoá key người dùng đã nhập. Key từ biến môi trường không xoá được ở đây."""
    if provider_id not in STORABLE_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider '{provider_id}' không hợp lệ.")

    if not get_credential_store().delete(provider_id):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Provider '{provider_id}' chưa có key do người dùng nhập. "
                "Key từ biến môi trường phải sửa trong .env."
            ),
        )

    return _status_for_all()

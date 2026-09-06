"""Nhiều nhà cung cấp VLM, chọn được lúc chạy.

Người dùng chọn provider trên giao diện; API key luôn nằm ở server, không bao
giờ đi ra trình duyệt. UI chỉ biết provider nào đã cấu hình key, không biết
key là gì.

Tất cả provider ở đây đều nói giao thức OpenAI nên chỉ cần một client duy
nhất, chỉ khác `base_url` và `api_key`.
"""

import os
from dataclasses import dataclass, replace
from typing import Literal

from .credentials import get_credential_store, mask_key

ProviderId = Literal["builtin", "openai", "gemini", "custom"]

# Endpoint OpenAI-compatible chính thức của từng nhà cung cấp.
GEMINI_OPENAI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/"
OPENAI_ENDPOINT = "https://api.openai.com/v1"


@dataclass(frozen=True)
class VlmProvider:
    id: ProviderId
    label: str
    endpoint: str
    model_name: str
    api_key: str | None
    description: str
    needs_gpu: bool
    # Nguồn của key: "ui" nếu người dùng nhập trên giao diện, "env" nếu từ
    # biến môi trường. Quyết định người dùng có xoá được key hay không.
    key_source: str = "env"

    @property
    def is_configured(self) -> bool:
        """Builtin không cần key; các provider ngoài thì bắt buộc."""
        if self.id == "builtin":
            return bool(self.endpoint)
        return bool(self.api_key)

    @property
    def masked_key(self) -> str | None:
        """Bản che để hiển thị. Đây là thứ DUY NHẤT được gửi ra client."""
        return mask_key(self.api_key)


def _env(key: str, default: str | None = None) -> str | None:
    value = os.environ.get(key)
    return default if value is None or value == "" else value


def _apply_stored_credentials(providers: list[VlmProvider]) -> list[VlmProvider]:
    """Key người dùng nhập trên UI đè lên key từ biến môi trường.

    Nhờ vậy đổi key không cần khởi động lại service.
    """
    store = get_credential_store()
    result: list[VlmProvider] = []

    for provider in providers:
        stored = store.get(provider.id)
        if stored is None:
            result.append(provider)
            continue

        result.append(
            replace(
                provider,
                api_key=stored.api_key,
                model_name=stored.model_name or provider.model_name,
                endpoint=stored.endpoint or provider.endpoint,
                key_source="ui",
            )
        )

    return result


def list_vlm_providers() -> list[VlmProvider]:
    """Danh sách provider, gộp key từ env và key người dùng nhập trên UI."""
    return _apply_stored_credentials(_env_providers())


def _env_providers() -> list[VlmProvider]:
    """Chỉ đọc biến môi trường, chưa gộp key từ UI."""
    return [
        VlmProvider(
            id="builtin",
            label="Model tự host",
            endpoint=_env("VLM_ENDPOINT", "http://vllm:8000/v1") or "",
            model_name=_env("VLM_MODEL_NAME", "OpenGVLab/InternVL3-8B") or "",
            api_key=_env("OPENAI_API_KEY", "EMPTY"),
            description=(
                "vLLM chạy trong stack. Không gửi tài liệu ra ngoài, nhưng cần "
                "GPU riêng cho model."
            ),
            needs_gpu=True,
        ),
        VlmProvider(
            id="openai",
            label="OpenAI",
            endpoint=_env("OPENAI_BASE_URL", OPENAI_ENDPOINT) or OPENAI_ENDPOINT,
            model_name=_env("OPENAI_VLM_MODEL", "gpt-4o") or "gpt-4o",
            api_key=_env("OPENAI_CLOUD_API_KEY"),
            description="Không cần GPU cho khâu trả lời. Ảnh tài liệu gửi lên OpenAI.",
            needs_gpu=False,
        ),
        VlmProvider(
            id="gemini",
            label="Google Gemini",
            endpoint=_env("GEMINI_BASE_URL", GEMINI_OPENAI_ENDPOINT) or GEMINI_OPENAI_ENDPOINT,
            model_name=_env("GEMINI_VLM_MODEL", "gemini-2.0-flash") or "gemini-2.0-flash",
            api_key=_env("GEMINI_API_KEY"),
            description="Không cần GPU cho khâu trả lời. Ảnh tài liệu gửi lên Google.",
            needs_gpu=False,
        ),
        VlmProvider(
            id="custom",
            label="Endpoint tuỳ chỉnh",
            endpoint=_env("CUSTOM_VLM_ENDPOINT", "") or "",
            model_name=_env("CUSTOM_VLM_MODEL", "") or "",
            api_key=_env("CUSTOM_VLM_API_KEY"),
            description="Bất kỳ endpoint nào nói giao thức OpenAI và đọc được ảnh.",
            needs_gpu=False,
        ),
    ]


def get_vlm_provider(provider_id: str | None = None) -> VlmProvider:
    """Lấy provider theo id, mặc định lấy DEFAULT_VLM_PROVIDER.

    Nếu provider được chọn chưa cấu hình key thì báo lỗi rõ ràng thay vì để
    lệnh gọi API thất bại với thông báo khó hiểu.
    """
    wanted = provider_id or _env("DEFAULT_VLM_PROVIDER", "builtin")
    providers = {p.id: p for p in list_vlm_providers()}

    provider = providers.get(wanted)
    if provider is None:
        raise ValueError(
            f"Provider '{wanted}' không tồn tại. Chọn: {', '.join(providers)}"
        )

    if not provider.is_configured:
        env_hint = {
            "openai": "OPENAI_CLOUD_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "custom": "CUSTOM_VLM_ENDPOINT và CUSTOM_VLM_API_KEY",
        }.get(provider.id, "VLM_ENDPOINT")
        raise ValueError(
            f"Provider '{provider.label}' chưa cấu hình. Đặt {env_hint} trong .env "
            "rồi khởi động lại backend."
        )

    return provider

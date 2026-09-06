"""Giải kết nối mô hình thành client gọi được.

Khác bản trước: **không còn provider mặc định từ biến môi trường**. Người dùng
phải tự thêm kết nối trước, và mỗi bộ tài liệu chọn một kết nối cụ thể.

Mọi nhà cung cấp ở đây đều nói giao thức OpenAI nên chỉ cần một client duy
nhất, chỉ khác `base_url` và `api_key`.
"""

from dataclasses import dataclass

from .connections import ModelConnection, get_connection_store
from .logging import get_logger

logger = get_logger(__name__)

# vLLM tự host thường không bật xác thực nên chấp nhận key rỗng.
PROVIDERS_WITHOUT_KEY = {"vllm"}


class ConnectionNotFound(ValueError):
    """Kết nối bị xoá hoặc chưa từng tồn tại."""


class ConnectionNotUsable(ValueError):
    """Kết nối có tồn tại nhưng thiếu thông tin để gọi được."""


@dataclass(frozen=True)
class ResolvedModel:
    """Đủ thông tin để tạo client và gọi API."""

    connection_id: str
    name: str
    provider: str
    endpoint: str
    model_name: str
    api_key: str

    def as_client_kwargs(self) -> dict:
        return {"base_url": self.endpoint, "api_key": self.api_key}


def _validate(connection: ModelConnection, capability: str) -> ResolvedModel:
    if capability not in connection.capabilities:
        raise ConnectionNotUsable(
            f"Kết nối '{connection.name}' không khai báo khả năng '{capability}'. "
            f"Nó chỉ hỗ trợ: {', '.join(connection.capabilities)}."
        )

    if not connection.endpoint:
        raise ConnectionNotUsable(f"Kết nối '{connection.name}' chưa có endpoint.")

    if not connection.model_name:
        raise ConnectionNotUsable(f"Kết nối '{connection.name}' chưa có tên model.")

    needs_key = connection.provider not in PROVIDERS_WITHOUT_KEY
    if needs_key and not connection.api_key:
        raise ConnectionNotUsable(
            f"Kết nối '{connection.name}' chưa có API key. Vào Cấu hình để nhập."
        )

    return ResolvedModel(
        connection_id=connection.id,
        name=connection.name,
        provider=connection.provider,
        endpoint=connection.endpoint,
        model_name=connection.model_name,
        # vLLM không kiểm tra key nhưng client OpenAI vẫn đòi một chuỗi.
        api_key=connection.api_key or "EMPTY",
    )


def resolve_connection(connection_id: str, capability: str = "vlm") -> ResolvedModel:
    """Lấy kết nối và kiểm tra nó dùng được cho việc này.

    Báo lỗi cụ thể thay vì để lệnh gọi API thất bại với thông báo khó hiểu.
    """
    if not connection_id:
        raise ConnectionNotFound(
            "Chưa chọn mô hình. Vào Cấu hình để thêm kết nối, rồi chọn cho bộ tài liệu."
        )

    connection = get_connection_store().get(connection_id)
    if connection is None:
        raise ConnectionNotFound(
            f"Kết nối '{connection_id}' không còn tồn tại. Có thể đã bị xoá; "
            "hãy chọn lại mô hình cho bộ tài liệu."
        )

    return _validate(connection, capability)


def has_usable_connection(capability: str = "vlm") -> bool:
    """Có ít nhất một kết nối dùng được cho việc này không.

    Dùng để chặn luồng index và tra cứu khi người dùng chưa cấu hình gì.
    """
    for connection in get_connection_store().list_by_capability(capability):
        try:
            _validate(connection, capability)
            return True
        except ConnectionNotUsable:
            continue
    return False

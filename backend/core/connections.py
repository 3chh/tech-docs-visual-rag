"""Kho kết nối mô hình do người dùng cấu hình.

Khác với bản trước ở chỗ: không còn key mặc định từ biến môi trường. Người
dùng phải tự thêm ít nhất một kết nối trước khi làm được gì, và mỗi bộ tài
liệu chọn một kết nối cụ thể.

Ba nguyên tắc giữ nguyên:
1. Key gốc không bao giờ ra khỏi server, đọc lên chỉ được bản che.
2. Mã hoá at-rest bằng CREDENTIALS_SECRET.
3. Không hash: hash là một chiều, còn ta cần key gốc để gọi API.
"""

import json
import os
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from .crypto import decrypt_value, encrypt_value, is_encryption_enabled, mask_key
from .logging import get_logger

logger = get_logger(__name__)

CONNECTIONS_FILE = "model_connections.json"

ProviderKind = Literal["openai", "gemini", "vllm", "custom"]
Capability = Literal["vlm", "llm"]

# Endpoint mặc định gợi ý theo nhà cung cấp; người dùng vẫn sửa được.
DEFAULT_ENDPOINTS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "vllm": "http://vllm:8000/v1",
    "custom": "",
}

# vLLM tự host thường không bật xác thực.
PROVIDERS_WITHOUT_KEY = {"vllm"}


@dataclass
class ModelConnection:
    """Một kết nối tới mô hình.

    `capabilities` quyết định kết nối này dùng được vào việc gì:
      - "vlm": đọc ảnh tài liệu và trả lời
      - "llm": sửa cây mục lục lúc phân tích tài liệu

    Model đa phương thức (GPT-4o, Gemini Flash) làm được cả hai.
    """

    id: str
    name: str
    provider: ProviderKind
    endpoint: str
    model_name: str
    capabilities: list[Capability]
    api_key: str | None = None
    created_at: str = ""
    updated_at: str = ""

    def masked(self) -> "MaskedConnection":
        return MaskedConnection(
            id=self.id,
            name=self.name,
            provider=self.provider,
            endpoint=self.endpoint,
            model_name=self.model_name,
            capabilities=list(self.capabilities),
            masked_key=mask_key(self.api_key),
            has_key=bool(self.api_key),
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


@dataclass
class MaskedConnection:
    """Bản gửi ra client. Không chứa key gốc."""

    id: str
    name: str
    provider: str
    endpoint: str
    model_name: str
    capabilities: list[str]
    masked_key: str | None
    has_key: bool
    created_at: str
    updated_at: str


class DuplicateNameError(ValueError):
    """Tên kết nối đã tồn tại. Tên là thứ người dùng nhìn thấy nên phải duy nhất."""


class ConnectionStore:
    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()

    # --- đọc ghi thô -------------------------------------------------------

    def _read(self) -> dict[str, dict]:
        if not self.path.exists():
            return {}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            logger.error("Không đọc được %s: %s", self.path, e)
            return {}

    def _write(self, data: dict[str, dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp.replace(self.path)

        try:
            os.chmod(self.path, 0o600)
        except (OSError, NotImplementedError):
            pass

    @staticmethod
    def _to_connection(entry: dict) -> ModelConnection:
        return ModelConnection(
            id=entry["id"],
            name=entry["name"],
            provider=entry["provider"],
            endpoint=entry.get("endpoint", ""),
            model_name=entry.get("model_name", ""),
            capabilities=entry.get("capabilities", ["vlm"]),
            api_key=decrypt_value(entry.get("api_key", "")) or None,
            created_at=entry.get("created_at", ""),
            updated_at=entry.get("updated_at", ""),
        )

    # --- API công khai -----------------------------------------------------

    def list_all(self) -> list[ModelConnection]:
        with self._lock:
            data = self._read()
        return [self._to_connection(e) for e in data.values()]

    def get(self, connection_id: str) -> ModelConnection | None:
        with self._lock:
            entry = self._read().get(connection_id)
        return self._to_connection(entry) if entry else None

    def list_by_capability(self, capability: Capability) -> list[ModelConnection]:
        return [c for c in self.list_all() if capability in c.capabilities]

    def create(
        self,
        name: str,
        provider: ProviderKind,
        model_name: str,
        capabilities: list[Capability],
        api_key: str | None = None,
        endpoint: str | None = None,
    ) -> ModelConnection:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        connection_id = uuid.uuid4().hex[:12]

        with self._lock:
            data = self._read()

            if any(e["name"].strip().lower() == name.strip().lower() for e in data.values()):
                raise DuplicateNameError(f"Đã có kết nối tên '{name}'")

            data[connection_id] = {
                "id": connection_id,
                "name": name.strip(),
                "provider": provider,
                "endpoint": (endpoint or DEFAULT_ENDPOINTS.get(provider, "")).strip(),
                "model_name": model_name.strip(),
                "capabilities": capabilities,
                "api_key": encrypt_value(api_key) if api_key else "",
                "created_at": now,
                "updated_at": now,
            }
            self._write(data)

        logger.info("Đã tạo kết nối %s (%s, %s)", name, provider, model_name)
        return self._to_connection(data[connection_id])

    def update(
        self,
        connection_id: str,
        name: str | None = None,
        model_name: str | None = None,
        endpoint: str | None = None,
        capabilities: list[Capability] | None = None,
        api_key: str | None = None,
    ) -> ModelConnection | None:
        """Chỉ cập nhật trường được truyền. `api_key=None` giữ nguyên key cũ."""
        with self._lock:
            data = self._read()
            entry = data.get(connection_id)
            if entry is None:
                return None

            if name is not None:
                clashes = any(
                    other_id != connection_id
                    and other["name"].strip().lower() == name.strip().lower()
                    for other_id, other in data.items()
                )
                if clashes:
                    raise DuplicateNameError(f"Đã có kết nối tên '{name}'")
                entry["name"] = name.strip()

            if model_name is not None:
                entry["model_name"] = model_name.strip()
            if endpoint is not None:
                entry["endpoint"] = endpoint.strip()
            if capabilities is not None:
                entry["capabilities"] = capabilities
            if api_key:
                entry["api_key"] = encrypt_value(api_key)

            entry["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            self._write(data)

        logger.info("Đã cập nhật kết nối %s", connection_id)
        return self._to_connection(entry)

    def delete(self, connection_id: str) -> bool:
        with self._lock:
            data = self._read()
            existed = data.pop(connection_id, None) is not None
            if existed:
                self._write(data)

        if existed:
            logger.info("Đã xoá kết nối %s", connection_id)
        return existed

    @property
    def is_encrypted(self) -> bool:
        return is_encryption_enabled()


_store: ConnectionStore | None = None
_store_lock = threading.Lock()


def get_connection_store() -> ConnectionStore:
    global _store
    if _store is not None:
        return _store

    with _store_lock:
        if _store is None:
            # Đọc DATA_DIR thẳng từ env: kho kết nối không phụ thuộc cấu hình
            # model, và không nên fail chỉ vì thiếu cái gì đó ở nơi khác.
            data_dir = Path(os.environ.get("DATA_DIR") or "./data").expanduser()
            _store = ConnectionStore(data_dir / CONNECTIONS_FILE)
    return _store


def reset_connection_store() -> None:
    """Chỉ dùng trong test."""
    global _store
    _store = None

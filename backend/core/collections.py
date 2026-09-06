"""Cấu hình của từng bộ tài liệu.

Mỗi bộ chọn một kết nối VLM (để trả lời) và một kết nối LLM (để sửa cây mục
lục lúc phân tích). Chọn lúc tạo bộ, vì tài liệu đã index bằng cấu hình nào
thì nên tra cứu bằng cấu hình đó.

Lưu cạnh dữ liệu của bộ: `metadata/<bộ>/collection.json`. Nhờ vậy sao chép
thư mục bộ đi nơi khác là mang theo cả cấu hình.
"""

import json
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .logging import get_logger
from .paths import collection_dir

logger = get_logger(__name__)

CONFIG_FILE = "collection.json"

# Tên bộ đi vào đường dẫn thư mục và tên collection của vector DB.
VALID_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$")


class InvalidCollectionName(ValueError):
    pass


class CollectionExists(ValueError):
    pass


class CollectionNotConfigured(ValueError):
    """Bộ chưa chọn mô hình. Phải cấu hình trước khi thêm tài liệu."""


def validate_name(name: str) -> str:
    name = (name or "").strip()
    if not VALID_NAME.match(name):
        raise InvalidCollectionName(
            "Tên bộ chỉ gồm chữ, số, gạch ngang và gạch dưới, bắt đầu bằng chữ "
            "hoặc số, tối đa 63 ký tự."
        )
    return name


@dataclass
class CollectionConfig:
    name: str
    #: Kết nối dùng để đọc ảnh và trả lời.
    vlm_connection_id: str
    #: Kết nối dùng để sửa cây mục lục lúc phân tích tài liệu.
    llm_connection_id: str
    description: str = ""
    created_at: str = ""
    updated_at: str = ""
    #: Tham số xử lý riêng của bộ này, ghi đè mặc định của server.
    processing: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "vlm_connection_id": self.vlm_connection_id,
            "llm_connection_id": self.llm_connection_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "processing": self.processing,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CollectionConfig":
        return cls(
            name=data["name"],
            description=data.get("description", ""),
            vlm_connection_id=data.get("vlm_connection_id", ""),
            llm_connection_id=data.get("llm_connection_id", ""),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            processing=data.get("processing", {}),
        )


_lock = threading.Lock()


def _config_path(name: str):
    return collection_dir(name) / CONFIG_FILE


def load_config(name: str) -> CollectionConfig | None:
    """None nếu bộ chưa được cấu hình."""
    path = _config_path(name)
    if not path.exists():
        return None

    try:
        with open(path, "r", encoding="utf-8") as f:
            return CollectionConfig.from_dict(json.load(f))
    except (OSError, json.JSONDecodeError, KeyError) as e:
        logger.error("Không đọc được cấu hình bộ %s: %s", name, e)
        return None


def require_config(name: str) -> CollectionConfig:
    """Dùng ở chỗ bắt buộc phải có cấu hình, ví dụ trước khi index."""
    config = load_config(name)
    if config is None:
        raise CollectionNotConfigured(
            f"Bộ tài liệu '{name}' chưa được cấu hình. Tạo bộ và chọn mô hình "
            "trước khi thêm tài liệu."
        )
    return config


def save_config(config: CollectionConfig) -> CollectionConfig:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    config.updated_at = now
    if not config.created_at:
        config.created_at = now

    with _lock:
        path = _config_path(config.name)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(config.to_dict(), f, ensure_ascii=False, indent=2)
        tmp.replace(path)

    logger.info("Đã lưu cấu hình bộ %s", config.name)
    return config


def create_collection(
    name: str,
    vlm_connection_id: str,
    llm_connection_id: str,
    description: str = "",
    processing: dict[str, Any] | None = None,
) -> CollectionConfig:
    name = validate_name(name)

    if load_config(name) is not None:
        raise CollectionExists(f"Bộ tài liệu '{name}' đã tồn tại")

    return save_config(
        CollectionConfig(
            name=name,
            description=description.strip(),
            vlm_connection_id=vlm_connection_id,
            llm_connection_id=llm_connection_id,
            processing=processing or {},
        )
    )


def list_configured() -> list[CollectionConfig]:
    """Các bộ đã có collection.json, sắp theo thời gian tạo mới nhất trước."""
    from .paths import metadata_dir

    root = metadata_dir()
    if not root.exists():
        return []

    configs = []
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        config = load_config(entry.name)
        if config is not None:
            configs.append(config)

    return sorted(configs, key=lambda c: c.created_at, reverse=True)


def delete_config(name: str) -> bool:
    """Chỉ xoá cấu hình, không xoá tài liệu đã index."""
    path = _config_path(name)
    if not path.exists():
        return False

    with _lock:
        path.unlink()

    logger.info("Đã xoá cấu hình bộ %s", name)
    return True

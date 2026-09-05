"""Embedding manager: chọn backend động theo config, khởi tạo một lần duy nhất."""

import importlib
import threading

from ..core.config import EmbeddingSettings, get_settings
from ..core.logging import get_logger
from .base import BaseEmbeddingManager

logger = get_logger(__name__)

# Map từ tên trong config sang module chứa manager tương ứng.
_MANAGER_MODULES = {
    "longcolqwen": ".longcolqwen_manager",
    "colqwen": ".colqwen_manager",
    "colpali": ".colpali_manager",
    "colidefics": ".colidefics_manager",
}

_instance: BaseEmbeddingManager | None = None
_lock = threading.Lock()


def _resolve_manager_cls(emb_type: str) -> type[BaseEmbeddingManager]:
    module_path = _MANAGER_MODULES.get(emb_type)
    if module_path is None:
        raise ValueError(
            f"Embedding type '{emb_type}' không hợp lệ. "
            f"Chọn một trong: {', '.join(_MANAGER_MODULES)}"
        )

    # Import động để chỉ nạp đúng backend đang dùng, tránh kéo theo model không cần.
    importlib.import_module(module_path, package=__name__)

    cls = BaseEmbeddingManager.registry.get(f"{emb_type}manager")
    if cls is None:
        raise ValueError(f"Manager cho '{emb_type}' không đăng ký được vào registry.")
    return cls


def build_embedding_manager(settings: EmbeddingSettings) -> BaseEmbeddingManager:
    """Tạo manager mới. Dùng get_embedding_manager() nếu muốn bản singleton."""
    cls = _resolve_manager_cls(settings.type)
    logger.info(
        "Khởi tạo %s | model=%s device=%s kwargs=%s",
        cls.__name__,
        settings.model_name,
        settings.device,
        settings.manager_kwargs(),
    )
    return cls(
        device=settings.device,
        model_name=settings.model_name,
        **settings.manager_kwargs(),
    )


def get_embedding_manager() -> BaseEmbeddingManager:
    """Singleton — model nặng vài GB VRAM, chỉ nạp một lần cho cả tiến trình."""
    global _instance
    if _instance is not None:
        return _instance

    with _lock:
        if _instance is None:
            _instance = build_embedding_manager(get_settings().embedding)
    return _instance


def reset_embedding_manager() -> None:
    """Giải phóng singleton — chỉ dùng trong test."""
    global _instance
    _instance = None


__all__ = [
    "BaseEmbeddingManager",
    "build_embedding_manager",
    "get_embedding_manager",
    "reset_embedding_manager",
]

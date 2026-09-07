"""Embedding manager: chọn backend động theo config, cache hai tầng.

Hai tầng vì weights và processor có vòng đời khác nhau:

- **Model** nặng vài GB VRAM, chỉ phụ thuộc `(type, model_name, device)`.
- **Processor** rẻ (quy tắc resize ảnh + tokenizer), phụ thuộc thêm
  `max_num_visual_tokens` và `min_width` — hai tham số của từng bộ tài liệu.

Nhờ tách ra, nhiều bộ với tham số resize khác nhau vẫn dùng chung một model.
Nếu cache một tầng theo cả cấu hình thì mỗi bộ khác `max_num_visual_tokens`
là nạp thêm ~7.5GB VRAM, và việc cho phép cấu hình theo bộ thành vô nghĩa.
"""

import importlib
import threading
from typing import Any

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

ModelKey = tuple[str, str, str]
ManagerKey = tuple[str, str, str, Any, Any]

_models: dict[ModelKey, Any] = {}
_managers: dict[ManagerKey, BaseEmbeddingManager] = {}
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


def _effective(overrides: dict[str, Any] | None) -> tuple[str, str, str, Any, Any]:
    """Trộn cấu hình của bộ với cấu hình server, trả về giá trị cụ thể.

    Trường None hoặc thiếu thì lấy từ server — UI gửi thiếu trường là chuyện
    thường và không được tách cache vì thế.
    """
    server: EmbeddingSettings = get_settings().embedding
    overrides = overrides or {}

    def pick(key: str, fallback: Any) -> Any:
        value = overrides.get(key)
        return fallback if value is None else value

    return (
        pick("type", server.type),
        pick("model_name", server.model_name),
        server.device,
        pick("max_num_visual_tokens", server.max_num_visual_tokens),
        pick("min_width", server.min_width),
    )


def embedding_settings_for(
    overrides: dict[str, Any] | None = None,
) -> EmbeddingSettings:
    """EmbeddingSettings đã trộn cấu hình của bộ.

    Cần cho tầng vector DB: `doc_dim` được tính từ `max_num_visual_tokens`, mà
    Milvus dùng nó để chia batch truy vấn. Lấy giá trị của server trong khi bộ
    đã chốt giá trị khác là lệch âm thầm.
    """
    emb_type, model_name, _device, max_tokens, min_width = _effective(overrides)

    return get_settings().embedding.model_copy(
        update={
            "type": emb_type,
            "model_name": model_name,
            "max_num_visual_tokens": max_tokens,
            "min_width": min_width,
        }
    )


def build_embedding_manager(settings: EmbeddingSettings) -> BaseEmbeddingManager:
    """Tạo manager mới, không qua cache. Dùng trong test và script rời."""
    cls = _resolve_manager_cls(settings.type)
    return cls(
        device=settings.device,
        model_name=settings.model_name,
        **settings.manager_kwargs(),
    )


def get_embedding_manager(
    overrides: dict[str, Any] | None = None,
) -> BaseEmbeddingManager:
    """Manager cho một cấu hình embedding, dùng chung model khi có thể.

    `overrides` là `CollectionConfig.embedding` của bộ tài liệu. Bỏ trống thì
    dùng cấu hình server.
    """
    emb_type, model_name, device, max_tokens, min_width = _effective(overrides)
    manager_key: ManagerKey = (emb_type, model_name, device, max_tokens, min_width)

    cached = _managers.get(manager_key)
    if cached is not None:
        return cached

    with _lock:
        # Kiểm lại trong lock: hai request cùng lúc có thể vào đây cùng nhau.
        cached = _managers.get(manager_key)
        if cached is not None:
            return cached

        cls = _resolve_manager_cls(emb_type)
        model_key: ModelKey = (emb_type, model_name, device)

        model = _models.get(model_key)
        if model is None:
            model = cls.load_model(device, model_name)
            _models[model_key] = model
        else:
            logger.info(
                "Dùng lại model đã nạp cho %s, chỉ dựng processor mới "
                "(max_num_visual_tokens=%s min_width=%s)",
                model_name,
                max_tokens,
                min_width,
            )

        manager = cls(
            device=device,
            model_name=model_name,
            max_num_visual_tokens=max_tokens,
            min_width=min_width,
            model=model,
        )
        _managers[manager_key] = manager

    return manager


def reset_embedding_manager() -> None:
    """Giải phóng cache — chỉ dùng trong test."""
    _models.clear()
    _managers.clear()


__all__ = [
    "BaseEmbeddingManager",
    "build_embedding_manager",
    "embedding_settings_for",
    "get_embedding_manager",
    "reset_embedding_manager",
]
